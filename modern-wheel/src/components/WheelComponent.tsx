"use client";

// touch: force rebuild
import React, { useRef, useCallback, useEffect } from 'react';
import { WheelItem, WheelResult } from '@/types';
import { calculateAngle } from '@/lib/utils';

interface WheelComponentProps {
  items: WheelItem[];
  isSpinning: boolean;
  onSpin: () => void;
  onResult: (result: WheelResult) => void;
  config: {
    spinDuration: number;
    soundEnabled: boolean;
    confettiEnabled: boolean;
    noRepeat?: boolean;          // evita repetir vencedores recentes
    noRepeatWindow?: number;     // tamanho da janela (quantidade de giros) para bloquear repetição
    bestOfN?: number;            // realiza N giros internos e escolhe o melhor (maior peso)
    easing?: 'linear' | 'easeOutCubic' | 'easeOutQuart';
    randomStart?: boolean;
  };
  highlightItemId?: string;       // realce visual do slice vencedor
}

export default function WheelComponent({ items, isSpinning, onSpin, onResult, config, highlightItemId }: WheelComponentProps) {
  const wheelRef = useRef<SVGSVGElement>(null);
  const currentRotation = useRef(0);
  const spinAudioRef = useRef<HTMLAudioElement | null>(null);
  const tickAudioRef = useRef<HTMLAudioElement | null>(null); // novo: som de tick
  const lastTickAngleRef = useRef<number>(0);                 // controle de passo de tick
  const soundEnabledRef = useRef<boolean>(config?.soundEnabled ?? false);
  const lastStartAppliedRef = useRef<number | null>(null);
  // garante apenas uma declaração de recentWinnersRef
  const recentWinnersRef = useRef<string[]>([]); // guarda IDs recentes para modo "não repetir"

  const safeConfig = {
    spinDuration: config?.spinDuration ?? 3000,
    soundEnabled: config?.soundEnabled ?? false,
    confettiEnabled: config?.confettiEnabled ?? false,
    easing: (config as any)?.easing || "easeOutCubic",
    randomStart: (config as any)?.randomStart ?? true,
    noRepeat: !!(config as any)?.noRepeat,
    noRepeatWindow: Math.max(1, Number((config as any)?.noRepeatWindow ?? 1)),
    bestOfN: Math.max(1, Math.min(10, Number((config as any)?.bestOfN ?? 1))),
  } as const;

  // Keep hooks at top-level and BEFORE any conditional return
  // removido log ruidoso sobre imagens

  useEffect(() => {
    soundEnabledRef.current = safeConfig.soundEnabled;
    if (!safeConfig.soundEnabled) {
      // parar spin
      if (spinAudioRef.current) {
        try {
          spinAudioRef.current.pause();
          spinAudioRef.current.currentTime = 0;
        } catch {}
        spinAudioRef.current = null;
      }
      // parar tick
      if (tickAudioRef.current) {
        try {
          tickAudioRef.current.pause();
          tickAudioRef.current.currentTime = 0;
        } catch {}
        tickAudioRef.current = null;
      }
    }
  }, [safeConfig.soundEnabled]);

  const easingToCss = (easing: string) => {
    switch (easing) {
      case 'easeOutQuart': return 'cubic-bezier(0.165, 0.84, 0.44, 1)';
      case 'easeOutCubic': return 'cubic-bezier(0.215, 0.61, 0.355, 1)';
      case 'linear': default: return 'linear';
    }
  };

  // Instrumentação de debug
  useEffect(() => {
    // montagem
    try { console.debug('[WheelComponent] mount items=', items.length, 'isSpinning=', isSpinning, 'cfg=', safeConfig); } catch {}
    return () => { try { console.debug('[WheelComponent] unmount'); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const spin = useCallback(() => {
    try { console.debug('[WheelComponent] spin() called'); } catch {}

    try {
      const cfgRaw = typeof window !== 'undefined' ? window.localStorage.getItem('modern-wheel:config') : null;
      const cfg = cfgRaw ? JSON.parse(cfgRaw) : {};
      const vol = Math.max(0, Math.min(1, Number(cfg.volume ?? 0.8)));
      (window as any).__MW_VOLUME__ = vol;
    } catch {}

    // Filtra itens visíveis (sem imagem/peso aqui pois este componente usa o formato antigo)
    const visible = items.filter(Boolean);
    if (isSpinning || visible.length < 2) {
      try { console.debug('[WheelComponent] guard stop. isSpinning=', isSpinning, 'visible=', visible.length); } catch {}
      return;
    }

    try { console.debug('[WheelComponent] onSpin() dispatch'); } catch {}
    onSpin();

    // Start spin sound (loop) respecting the flag
    if (soundEnabledRef.current) {
      try {
        // spin loop
        if (spinAudioRef.current) {
          spinAudioRef.current.pause();
          spinAudioRef.current.currentTime = 0;
        }
        const audio = new Audio('/sounds/spin.mp3');
        audio.loop = true;
        try { audio.volume = (window as any).__MW_VOLUME__ ?? 0.6; } catch { audio.volume = 0.6; }
        spinAudioRef.current = audio;
        audio.play().catch(() => {});
        // coeficiente dedicado para o tick (fallback se ausente)
        try {
          const cfgRaw = window.localStorage.getItem('modern-wheel:config');
          const cfg = cfgRaw ? JSON.parse(cfgRaw) : {};
          (window as any).__MW_TICK_COEF__ = Number.isFinite(cfg.tickVolumeCoef) ? Math.max(0, Math.min(1.5, cfg.tickVolumeCoef)) : 0.8;
        } catch { (window as any).__MW_TICK_COEF__ = 0.8; }
      } catch {}
      try {
        // pré-carrega áudio de tick (curto)
        if (tickAudioRef.current) {
          tickAudioRef.current.pause();
          tickAudioRef.current.currentTime = 0;
        }
        // usa asset dedicado curto de tick
        const tick = new Audio('/sounds/tick.mp3');
        tick.loop = false;
        tickAudioRef.current = tick;
      } catch {}
    }

    // Seleção ponderada com suporte a Best-of-N usando items:v2 (hidden/weight)
    let selectedIndex = 0;
    let winner = visible[0];

    try {
      if (typeof window !== 'undefined') {
        const rawV2 = window.localStorage.getItem('modern-wheel:items:v2');
        type V2 = { id: string; label: string; hidden: boolean; weight: number };
        const list = rawV2 ? (JSON.parse(rawV2) as V2[]) : [];
        const sanitized: V2[] = Array.isArray(list)
          ? list
              .filter(i => i && typeof i.id === 'string' && typeof i.label === 'string')
              .map(i => ({
                ...i,
                label: String(i.label || '').slice(0, 80),
                hidden: !!i.hidden,
                weight: Math.max(1, Number.isFinite(i.weight) ? (i.weight as number) : 1),
              }))
          : [];

        // Mapa id -> índice no array visível (para retornar selectedIndex)
        const mapIdToIndex: Record<string, number> = {};
        visible.forEach((it, idx) => {
          mapIdToIndex[it.id] = idx;
        });

        // Constrói pool base ativo presente na roda visível
        const active = sanitized.filter(i => !i.hidden);
        let baseEntries = active
          .map(a => ({ a, idx: mapIdToIndex[a.id] }))
          .filter(e => e.idx !== undefined);

        // Filtro "não repetir" aplicado sobre o pool da rodada
        if (safeConfig.noRepeat && recentWinnersRef.current.length > 0) {
          const block = new Set(recentWinnersRef.current);
          const filtered = baseEntries.filter(e => !block.has(e.a.id));
          if (filtered.length >= 1) baseEntries = filtered;
        }

        // Fallback defensivo
        if (baseEntries.length === 0) {
          // se nada sobrou, considera todos visíveis com peso 1
          selectedIndex = Math.floor(Math.random() * visible.length);
          winner = visible[selectedIndex];
        } else {
          // Função para escolher 1 candidato ponderado do pool informado
          const pickOne = (pool: { a: V2; idx: number }[]) => {
            const total = pool.reduce((sum, e) => sum + Math.max(1, e.a.weight), 0);
            if (total <= 0) return pool[0];
            let r = Math.random() * total;
            for (const e of pool) {
              r -= Math.max(1, e.a.weight);
              if (r < 0) return e;
            }
            return pool[pool.length - 1];
          };

          const N = safeConfig.bestOfN ?? 1;
          if (N <= 1) {
            const chosen = pickOne(baseEntries);
            selectedIndex = chosen.idx!;
            winner = visible[selectedIndex];
          } else {
            // Sorteios internos independentes (pool fixo da rodada)
            const recentSet = new Set(recentWinnersRef.current);
            const picks: { a: V2; idx: number }[] = [];
            for (let k = 0; k < N; k++) {
              picks.push(pickOne(baseEntries));
            }

            // Score: maior peso; tie-break por menor frequência recente; tie-break final aleatório
            const freqRecent: Record<string, number> = {};
            recentWinnersRef.current.forEach(id => {
              freqRecent[id] = (freqRecent[id] || 0) + 1;
            });

            // Random salt único para rodada
            const salt = Math.random();

            const best = picks.reduce((acc, cur) => {
              if (!acc) return cur;
              const wA = Math.max(1, acc.a.weight);
              const wB = Math.max(1, cur.a.weight);
              if (wB > wA) return cur;
              if (wB < wA) return acc;

              const fa = freqRecent[acc.a.id] || 0;
              const fb = freqRecent[cur.a.id] || 0;
              if (fb < fa) return cur;
              if (fb > fa) return acc;

              // tie-break final pseudo-aleatório estável para esta rodada
              const ra = (acc.a.id + salt).toString().length % 1000;
              const rb = (cur.a.id + salt).toString().length % 1000;
              return rb > ra ? cur : acc;
            }, picks[0]);

            selectedIndex = best.idx!;
            winner = visible[selectedIndex];
          }
        }
      } else {
        selectedIndex = Math.floor(Math.random() * visible.length);
        winner = visible[selectedIndex];
      }
    } catch {
      selectedIndex = Math.floor(Math.random() * visible.length);
      winner = visible[selectedIndex];
    }

    // Ângulo inicial aleatório por giro (se ativado): aplica imediatamente antes do cálculo de destino
    if (safeConfig.randomStart) {
      const start = Math.floor(Math.random() * 360);
      lastStartAppliedRef.current = start;
      currentRotation.current = start;
      if (wheelRef.current) {
        wheelRef.current.style.animation = '';
        wheelRef.current.style.transform = `rotate(${currentRotation.current}deg)`;
      }
    }

    const minSpins = 3;
    const maxSpins = 6;
    const spins = minSpins + Math.random() * (maxSpins - minSpins);
    const targetAngle = calculateAngle(visible, selectedIndex);
    const totalRotation = spins * 360 + targetAngle;
    const finalRotation = currentRotation.current + totalRotation;

    // Duração base
    let duration = safeConfig.spinDuration;

    // Reset do controle de tick
    lastTickAngleRef.current = currentRotation.current % 360;

    if (wheelRef.current) {
      // Interrompe o idle sway durante o spin
      wheelRef.current.classList.remove('wheel-idle-sway');

      // Animação simplificada com uma única rotação suave
      const easing = easingToCss(safeConfig.easing);
      
      // Define as propriedades CSS customizadas
      wheelRef.current.style.setProperty('--rotation-start', `${currentRotation.current}deg`);
      wheelRef.current.style.setProperty('--rotation', `${finalRotation}deg`);
      wheelRef.current.style.setProperty('--duration', `${duration}ms`);
      wheelRef.current.style.setProperty('--easing', easing);
      
      // Remove qualquer animação anterior e aplica a nova
      wheelRef.current.style.animation = '';
      // Force reflow para reiniciar keyframes (SVG não tem offsetHeight tipado; usa getBoundingClientRect)
      void wheelRef.current.getBoundingClientRect();
      wheelRef.current.style.animation = `spin-wheel ${duration}ms ${easing} forwards`;
    }

    // Scheduler de "ticks" inspirado no pickerwheel:
    // toca ao cruzar cada fronteira de segmento com aceleração/retardo de frequência
    if (soundEnabledRef.current && items.length > 0) {
      const segAngle = items.length > 0 ? 360 / items.length : 360;
      const tickStep = Math.max(10, segAngle); // discretização mínima 10°
      const startTs = performance.now();
      const endTs = startTs + duration;

      // rampa de frequência: ticks mais frequentes no meio (velocidade máx), menos no início/fim
      let lastTickTime = 0;
      const baseMinInterval = 26; // intervalo mínimo em ms quando na velocidade máxima (~38 fps cap)
      const maxInterval = 80;     // quando devagar (start/end)

      const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
      const easeInOut = (t: number) => t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2) / 2;

      const tickTimer = () => {
        const now = performance.now();
        const t = Math.min(1, (now - startTs) / duration);

        // velocidade relativa: pico no meio
        const speed = 1 - Math.abs(0.5 - t) * 2; // 0..1..0
        const minTickInterval = Math.round(lerp(maxInterval, baseMinInterval, easeInOut(speed)));

        // ângulo projetado
        const projected = (currentRotation.current + totalRotation * t) % 360;
        const prev = lastTickAngleRef.current;

        // cruzamento de fronteira
        const crossed = (() => {
          const next = (Math.floor(prev / tickStep) + 1) * tickStep;
          const passed = (prev <= next && next <= projected) || (projected < prev && (next >= prev || next <= projected));
          if (passed) {
            lastTickAngleRef.current = next % 360;
            return true;
          }
          return false;
        })();

        if (crossed && tickAudioRef.current) {
          if (now - lastTickTime >= minTickInterval) {
            try {
              const vol = (window as any).__MW_VOLUME__ ?? 0.6;
              const coef = (window as any).__MW_TICK_COEF__ ?? 0.8;
              tickAudioRef.current.volume = Math.max(0, Math.min(1, vol * coef));
              tickAudioRef.current.currentTime = 0;
              tickAudioRef.current.play().catch(() => {});
            } catch {}
            lastTickTime = now;
          }
        }

        if (now < endTs && isSpinning) {
          requestAnimationFrame(tickTimer);
        }
      };
      requestAnimationFrame(tickTimer);
    }

    currentRotation.current = finalRotation % 360;

    const totalTimeout = duration;
    setTimeout(async () => {
      const result: WheelResult = {
        item: winner,
        timestamp: new Date(),
        angle: finalRotation,
      };

      // atualiza janela de "não repetir"
      if (safeConfig.noRepeat && winner?.id) {
        recentWinnersRef.current.unshift(winner.id);
        const limit = Math.max(1, safeConfig.noRepeatWindow);
        if (recentWinnersRef.current.length > limit) {
          recentWinnersRef.current = recentWinnersRef.current.slice(0, limit);
        }
      }

      // evita duplicação: manter apenas um bloco de atualização da janela "não repetir"
      // (bloco acima em 223-229 já executa; removemos o duplicado)

      // Stop spin sound before playing finish
      if (spinAudioRef.current) {
        try {
          spinAudioRef.current.pause();
          spinAudioRef.current.currentTime = 0;
        } catch {}
        spinAudioRef.current = null;
      }

      // Play finish sound (respect flag)
      if (soundEnabledRef.current) {
        try {
          const audio = new Audio('/sounds/finish.mp3');
          try { audio.volume = (window as any).__MW_VOLUME__ ?? 0.8; } catch { audio.volume = 0.8; }
          audio.play().catch(() => {});
        } catch {}
      }
      // limpa instâncias de tick
      if (tickAudioRef.current) {
        try {
          tickAudioRef.current.pause();
          tickAudioRef.current.currentTime = 0;
        } catch {}
        tickAudioRef.current = null;
      }

      // Fire confetti (respect flag)
      if (safeConfig.confettiEnabled) {
        try {
          const mod: any = await import('canvas-confetti');
          const confetti = mod.default || mod;
          confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
        } catch {}
      }

      try {
        const cfgRaw = typeof window !== 'undefined' ? window.localStorage.getItem('modern-wheel:config') : null;
        const cfg = cfgRaw ? JSON.parse(cfgRaw) : {};
        if (cfg.removeAfterChoiceEnabled && winner?.id) {
          const rawV2 = window.localStorage.getItem('modern-wheel:items:v2');
          const list = rawV2 ? JSON.parse(rawV2) : [];
          const next = Array.isArray(list)
            ? list.map((i: any) => (i && i.id === winner.id ? { ...i, hidden: true } : i))
            : list;
          window.localStorage.setItem('modern-wheel:items:v2', JSON.stringify(next));
          window.dispatchEvent(new Event('modern-wheel:items-updated'));
        }
      } catch {}

      try { console.debug('[WheelComponent] onResult()', result); } catch {}
      onResult(result);
   }, totalTimeout);
 }, [items, isSpinning, onSpin, onResult, safeConfig.easing, safeConfig.randomStart, safeConfig.spinDuration]);

  useEffect(() => {
    if (!wheelRef.current) return;

    // Quando parar de girar, limpa animações de spin
    if (!isSpinning) {
      // fixa a base atual e aplica balanço sutil
      const base = currentRotation.current % 360;
      wheelRef.current.style.animation = '';
      wheelRef.current.style.setProperty('--sway-base', `${base}deg`);
      wheelRef.current.style.setProperty('--sway-ampl', `4deg`);       // amplitude ±4°
      wheelRef.current.style.setProperty('--sway-duration', `4200ms`); // duração suave 4.2s
      wheelRef.current.classList.add('wheel-idle-sway');
      // garante estilo inicial
      wheelRef.current.style.transform = `rotate(${base}deg)`;
    } else {
      // Em spin real: remove o idle sway para evitar conflito visual
      wheelRef.current.classList.remove('wheel-idle-sway');
      // a animação principal de spin já é aplicada em spin()
    }
  }, [isSpinning]);

  // CSS keyframes (garante existência) + idle sway
  useEffect(() => {
    const id = 'mw-spin-keyframes';
    let styleEl = document.getElementById(id);
    if (styleEl) {
      styleEl.remove();
    }
    const style = document.createElement('style');
    style.id = id;
    style.innerHTML = `
      @keyframes spin-wheel {
        from { transform: rotate(var(--rotation-start, 0deg)); }
        to { transform: rotate(var(--rotation, 360deg)); }
      }

      /* Idle sway (balanço sutil) */
      @keyframes mw-idle-sway {
        0%   { transform: rotate(calc(var(--sway-base, 0deg) - var(--sway-ampl, 4deg))); }
        50%  { transform: rotate(calc(var(--sway-base, 0deg) + var(--sway-ampl, 4deg))); }
        100% { transform: rotate(calc(var(--sway-base, 0deg) - var(--sway-ampl, 4deg))); }
      }
      
      .wheel-spinning {
        transform-origin: center center !important;
        animation: spin-wheel var(--duration, 3s) var(--easing, cubic-bezier(0.215, 0.61, 0.355, 1)) forwards;
      }

      /* classe aplicada quando parado para dar vida */
      .wheel-idle-sway {
        transform-origin: center center !important;
        animation: mw-idle-sway var(--sway-duration, 3800ms) ease-in-out infinite;
        will-change: transform;
      }`;
    document.head.appendChild(style);
  }, []);

  // Ativa idle sway logo após montar (se não estiver girando)
  useEffect(() => {
    const el = wheelRef.current;
    if (!el) return;
    if (!isSpinning) {
      const base = currentRotation.current % 360;
      el.style.setProperty('--sway-base', `${base}deg`);
      el.style.setProperty('--sway-ampl', `4deg`);
      el.style.setProperty('--sway-duration', `4200ms`);
      el.classList.add('wheel-idle-sway');
    }
    return () => {
      try { el.classList.remove('wheel-idle-sway'); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  const centerX = 160;
  const centerY = 160;
  const radius = 140;
  const segmentAngle = items.length > 0 ? 360 / items.length : 0;

  return (
    <div className="relative">
      {items.length === 0 ? (
        <div className="flex items-center justify-center w-[min(88vw,36rem)] aspect-square bg-gray-100 dark:bg-neutral-800 rounded-full border-4 border-gray-300 dark:border-neutral-700">
          <p className="text-gray-500 dark:text-gray-300 text-center px-4">
            Adicione pelo menos 2 itens
            <br />
            para usar a roda
          </p>
        </div>
      ) : (
        <>
          {/* Container responsivo da roda - maior e centrada */}
          <div className="relative mx-auto w-[min(92vw,32rem)] sm:w-[min(92vw,36rem)] lg:w-[min(92vw,40rem)] aspect-square">
            {/* Ponteiro/top marker invertido para apontar a seleção para baixo */}
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 z-20">
              {/* base do pointer */}
              <div className="mx-auto w-20 h-6 bg-white/95 dark:bg-neutral-900/95 border border-slate-300 dark:border-neutral-700 rounded-b-2xl shadow-md" />
              {/* seta principal (apontando para baixo) */}
              <div className="w-0 h-0 mx-auto -mt-1 border-l-[16px] border-r-[16px] border-t-[24px] border-l-transparent border-r-transparent border-t-rose-500 dark:border-t-rose-400 drop-shadow" />
              {/* contorno sutil da seta */}
              <div className="w-0 h-0 mx-auto -mt-[24px] border-l-[18px] border-r-[18px] border-t-[26px] border-l-transparent border-r-transparent border-t-black/15 pointer-events-none" />
            </div>

            {/* Botão central "SPIN" sobreposto */}
            <button
              type="button"
              onClick={() => spin()}
              className="absolute z-30 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none rounded-full bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-extrabold shadow-lg border-4 border-white/70 dark:border-neutral-800 tracking-wide"
              style={{
                width: 'clamp(84px, calc(min(92vw, 40rem) * 0.22), 168px)',
                height: 'clamp(84px, calc(min(92vw, 40rem) * 0.22), 168px)',
              }}
              aria-label="Girar a roda"
            >
              SPIN
            </button>

            {/* SVG dimensionado para o container responsivo */}
            <svg
              ref={wheelRef}
              viewBox="0 0 320 320"
              className="drop-shadow-2xl w-full h-full"
              style={{ transformOrigin: 'center center' }}
              onClick={() => { try { console.debug('[WheelComponent] svg onClick'); } catch {} ; spin(); }}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  try { console.debug('[WheelComponent] svg keyDown', e.key); } catch {}
                  spin();
                }
              }}
              role="button"
              tabIndex={0}
              aria-label="Roda de sorteio"
            >
              <defs>
                {/* Sombra suave global para a roda (drop shadow) */}
                <filter id="wheelShadow" x="-50%" y="-50%" width="200%" height="200%">
                  <feOffset dx="0" dy="6" in="SourceAlpha" result="off" />
                  <feGaussianBlur in="off" stdDeviation="6" result="blur" />
                  <feColorMatrix in="blur" type="matrix" values="
                    0 0 0 0 0
                    0 0 0 0 0
                    0 0 0 0 0
                    0 0 0 0.35 0" result="shadow"/>
                  <feMerge>
                    <feMergeNode in="shadow" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>

                {/* Glow para o slice destacado */}
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>

                {/* Gradiente do anel/rim externo */}
                <linearGradient id="rimGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="#cbd5e1" stopOpacity="0.85" />
                </linearGradient>

                {/* Gradiente interno do hub/miolo */}
                <radialGradient id="hubGrad" cx="50%" cy="50%" r="60%">
                  <stop offset="0%" stopColor="#f8fafc" />
                  <stop offset="100%" stopColor="#e2e8f0" />
                </radialGradient>

                {/* Apenas clipPaths por fatia; imagens serão renderizadas fora de <defs> */}
                {items.map((item, index) => {
                  const imageAny = ((item as any).image || (item as any).imageUrl) as string | undefined;
                  if (!imageAny) return null;

                  const startAngle = (index * segmentAngle - 90) * (Math.PI / 180);
                  const endAngle = ((index + 1) * segmentAngle - 90) * (Math.PI / 180);

                  // Geometria do setor para clip
                  const x1 = centerX + radius * Math.cos(startAngle);
                  const y1 = centerY + radius * Math.sin(startAngle);
                  const x2 = centerX + radius * Math.cos(endAngle);
                  const y2 = centerY + radius * Math.sin(endAngle);
                  const largeArcFlag = segmentAngle > 180 ? 1 : 0;
                  const sectorPath = [
                    `M ${centerX} ${centerY}`,
                    `L ${x1} ${y1}`,
                    `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
                    'Z'
                  ].join(' ');

                  const clipId = `clip-${item.id}`;

                  return (
                    <clipPath key={`clip-${item.id}`} id={clipId}>
                      <path d={sectorPath} />
                    </clipPath>
                  );
                })}
              </defs>

              {/* Rim/Aro externo com gradiente e bordas (ajuste fino) */}
              <g filter="url(#wheelShadow)">
                <circle
                  cx={centerX}
                  cy={centerY}
                  r={radius + 12}
                  fill="url(#rimGrad)"
                  stroke="#0f172a"
                  strokeWidth="2.25"
                />
                {/* filete interno para dar profundidade */}
                <circle
                  cx={centerX}
                  cy={centerY}
                  r={radius + 7.5}
                  fill="none"
                  stroke="#93a0b3"
                  strokeWidth="1.35"
                  opacity="0.9"
                />
                {/* filete externo adicional para acabamento */}
                <circle
                  cx={centerX}
                  cy={centerY}
                  r={radius + 14}
                  fill="none"
                  stroke="rgba(15,23,42,0.25)"
                  strokeWidth="0.85"
                />
                {/* área de segurança do hub para evitar sobreposição aparente com o SPIN em telas pequenas */}
                <circle
                  cx={centerX}
                  cy={centerY}
                  r={radius * 0.14}
                  fill="rgba(255,255,255,0.02)"
                />
              </g>

              {items.map((item, index) => {
                const startAngle = (index * segmentAngle - 90) * (Math.PI / 180);
                const endAngle = ((index + 1) * segmentAngle - 90) * (Math.PI / 180);
                const midAngle = (startAngle + endAngle) / 2;

                const x1 = centerX + radius * Math.cos(startAngle);
                const y1 = centerY + radius * Math.sin(startAngle);
                const x2 = centerX + radius * Math.cos(endAngle);
                const y2 = centerY + radius * Math.sin(endAngle);

                const largeArcFlag = segmentAngle > 180 ? 1 : 0;

                const pathData = [
                  `M ${centerX} ${centerY}`,
                  `L ${x1} ${y1}`,
                  `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
                  'Z'
                ].join(' ');

                // Alternância de cores estilo PickerWheel quando não houver imagem/cores fornecidas
                const fallbackA = '#ef4444';
                const fallbackB = '#3b82f6';
                const altFill = index % 2 === 0 ? fallbackA : fallbackB;

                const hasImage = Boolean((item as any).image || (item as any).imageUrl);
                const fillColor = hasImage ? undefined : (item.color || altFill);

                // Geometria do box de imagem (iguais aos usados nas defs)
                const rInner = radius * 0.2;
                const rOuter = radius;
                const ringThickness = rOuter - rInner;
                const boxW = ringThickness;
                const boxH = ringThickness;
                const boxCenterR = (rInner + rOuter) / 2;
                const boxCx = centerX + boxCenterR * Math.cos(midAngle);
                const boxCy = centerY + boxCenterR * Math.sin(midAngle);

                // Opacidade configurável
                const opacity = (() => {
                  const v = (items[index] as any).imageOpacity;
                  const num = Number(v);
                  if (!isFinite(num)) return 1;
                  if (num < 0) return 0;
                  if (num > 1) return 1;
                  return num;
                })();

                const clipId = `clip-${item.id}`;
                const imageAny = ((item as any).image || (item as any).imageUrl) as string | undefined;

                const textAngle = (index * segmentAngle + segmentAngle / 2 - 90) * (Math.PI / 180);
                const textRadius = radius * 0.7;
                const textX = centerX + textRadius * Math.cos(textAngle);
                const textY = centerY + textRadius * Math.sin(textAngle);

                // Tipografia dinâmica
                const n = Math.max(1, items.length);
                let fontPx = 12;
                let maxChars = 24;
                if (n <= 8) { fontPx = 16; maxChars = 28; }
                else if (n <= 12) { fontPx = 13; maxChars = 22; }
                else if (n <= 20) { fontPx = 12; maxChars = 18; }
                else { fontPx = 10.5; maxChars = 15; }

                // quebras
                const rawLabel = String(item.text || '');
                const baseText = (hasImage)
                  ? rawLabel.slice(0, Math.max(10, Math.min(18, maxChars)))
                  : rawLabel.slice(0, maxChars);
                const words = baseText.split(' ');
                const lines: string[] = [];
                let current = '';
                for (const w of words) {
                  const tentative = current ? current + ' ' + w : w;
                  if (tentative.length <= Math.ceil(maxChars / 2)) {
                    current = tentative;
                  } else {
                    if (current) lines.push(current);
                    current = w;
                    if (lines.length >= 1) break;
                  }
                }
                if (current && lines.length < 2) lines.push(current);
                if (lines.length === 0) lines.push(baseText);

                // contraste
                const baseHex = (item.color || altFill).replace('#', '');
                const r = parseInt(baseHex.substring(0, 2), 16);
                const g = parseInt(baseHex.substring(2, 4), 16);
                const b = parseInt(baseHex.substring(4, 6), 16);
                const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
                const preferDarkText = luminance > 0.6;
                const textFill = hasImage ? '#FFFFFF' : (preferDarkText ? '#111111' : '#FFFFFF');
                const textStroke = hasImage ? '#000000' : (preferDarkText ? '#FFFFFF' : '#000000');

                const isHighlighted = item.id === highlightItemId;

                return (
                  <g key={item.id} className="wheel-segment" filter={isHighlighted ? 'url(#glow)' : undefined}>
                    {/* guia visual removido */}

                    {/* Imagem clipada pelo setor (render fora de <defs>) */}
                    {hasImage && (
                      <g clipPath={`url(#${clipId})`} pointerEvents="none">
                        <g transform={`translate(${boxCx}, ${boxCy})`}>
                          {/^https?:\/\//i.test(String(imageAny)) ? (
                            <foreignObject
                              x={-boxW / 2}
                              y={-boxH / 2}
                              width={boxW}
                              height={boxH}
                              opacity={opacity}
                              requiredExtensions="http://www.w3.org/1999/xhtml"
                            >
                              {React.createElement(
                                'div' as any,
                                {
                                  xmlns: 'http://www.w3.org/1999/xhtml',
                                  style: {
                                    width: '100%',
                                    height: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  } as React.CSSProperties,
                                },
                                React.createElement('img', {
                                  src: imageAny!,
                                  alt: '',
                                  style: {
                                    maxWidth: '100%',
                                    maxHeight: '100%',
                                    objectFit: 'contain',
                                    display: 'block',
                                  } as React.CSSProperties,
                                  crossOrigin: 'anonymous',
                                  loading: 'eager',
                                })
                              )}
                            </foreignObject>
                          ) : (
                            <image
                              href={imageAny}
                              x={-boxW / 2}
                              y={-boxH / 2}
                              width={boxW}
                              height={boxH}
                              preserveAspectRatio="xMidYMid meet"
                              opacity={opacity}
                              crossOrigin="anonymous"
                            />
                          )}
                        </g>
                      </g>
                    )}

                    {/* borda do slice */}
                    <path
                      d={pathData}
                      fill={fillColor || 'transparent'}
                      stroke={isHighlighted ? '#F6E05E' : '#0b1220'}
                      strokeWidth={isHighlighted ? 3.5 : 1.5}
                    />

                    {/* marca radial */}
                    <line
                      x1={centerX}
                      y1={centerY}
                      x2={x1}
                      y2={y1}
                      stroke="rgba(15,23,42,0.25)"
                      strokeWidth="0.75"
                    />

                    {/* texto */}
                    <text
                      x={textX}
                      y={textY}
                      fill={textFill}
                      stroke={textStroke}
                      strokeWidth={2.5}
                      paintOrder="stroke"
                      fontSize={fontPx}
                      fontWeight="700"
                      letterSpacing="0.2px"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      style={{ userSelect: 'none', fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial' }}
                      lengthAdjust="spacingAndGlyphs"
                    >
                      {lines.length === 1 ? (
                        <tspan x={textX} dy="0">{lines[0]}</tspan>
                      ) : (
                        <>
                          <tspan x={textX} dy="-0.45em">{lines[0]}</tspan>
                          <tspan x={textX} dy="1.1em">{lines[1]}</tspan>
                        </>
                      )}
                    </text>

                    {isHighlighted && (
                      <circle
                        cx={centerX}
                        cy={centerY}
                        r={radius + 3}
                        fill="none"
                        stroke="#F6E05E"
                        strokeWidth="3"
                        strokeDasharray="5 6"
                        opacity="0.9"
                      />
                    )}
                  </g>
                );
              })}
              {/* Hub/miolo decorativo para dar acabamento */}
              {/* hub mais evidente no estilo pickerwheel */}
              <circle cx={centerX} cy={centerY} r={radius * 0.2} fill="url(#hubGrad)" stroke="#94a3b8" strokeWidth="1.6" opacity="0.98" />
              <circle cx={centerX} cy={centerY} r={radius * 0.12} fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.2" opacity="0.98" />
            </svg>
          </div>

          {/* Botão inferior secundário no estilo pickerwheel (reserva de acessibilidade) */}
          <div className="mt-6 flex justify-center">
            <button
              data-testid="spin-button"
              onClick={spin}
              disabled={isSpinning || items.length < 2}
              className="px-6 py-2.5 rounded-lg bg-emerald-500 text-white font-semibold shadow hover:bg-emerald-600 disabled:opacity-50"
              aria-disabled={isSpinning || items.length < 2}
              aria-label="Girar roleta"
            >
              {isSpinning ? 'Girando...' : 'Girar a Roda'}
            </button>
          </div>

          {/* Overlay de resultado removido.
             O modal de resultado deve ser controlado por um único componente (ResultModal),
             evitando sobreposição de backdrops que interceptam cliques.
             Se desejar reintroduzir um overlay aqui no futuro, garanta que o estado
             que controla sua renderização seja o mesmo que fecha o backdrop no onClose. */}
        </>
      )}
    </div>
  );
}