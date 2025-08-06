"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";

import WheelComponent from "../components/WheelComponent";
import HistoryPanel from "../components/HistoryPanel";
import InputsPanel from "../components/InputsPanel";
import SidebarLayout from "../components/Layout/SidebarLayout";

import { WheelItem as OldWheelItem, WheelResult } from "@/types";
import { generateId, getRandomColor } from "@/lib/utils";
import { WheelItem as NewWheelItem } from "@/types/wheel";
import {
  STORAGE_KEYS,
  getItemsV2,
  setItemsV2,
  getConfig as storageGetConfig,
  setConfig as storageSetConfig,
  getHistory as storageGetHistory,
  setHistory as storageSetHistory,
  dispatchUpdate,
} from "@/lib/storage";

// Diagnóstico: marca global para Playwright confirmar montagem e rota
if (typeof window !== "undefined") {
  (window as any).__MW_DIAG__ = {
    ts: Date.now(),
    href: window.location.href,
    pathname: window.location.pathname,
    mounted: false,
  };
  // Log inicial de carregamento do bundle client
  try { console.log("[ClientApp] bundle carregado", window.location.href); } catch {}
}

const STORAGE_KEY = STORAGE_KEYS.legacyItems;        // formato antigo (OldWheelItem[])
const STORAGE_KEY_V2 = STORAGE_KEYS.itemsV2;         // formato novo (NewWheelItem[])
const CONFIG_KEY = STORAGE_KEYS.config;
const HISTORY_KEY = STORAGE_KEYS.history;

function fromUrlSafeBase64(b64: string): string {
  try {
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const normalized = b64.replace(/-/g, "+").replace(/_/g, "/") + pad;
    const json = typeof window !== "undefined"
      ? decodeURIComponent(escape(window.atob(normalized)))
      : Buffer.from(normalized, "base64").toString("utf-8");
    return json;
  } catch {
    return "";
  }
}

function toUrlSafeBase64(json: string) {
  try {
    const b64 = typeof window !== "undefined"
      ? window.btoa(unescape(encodeURIComponent(json)))
      : Buffer.from(json, "utf-8").toString("base64");
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  } catch {
    return json;
  }
}

// Migração/normalização de itens vindos do localStorage
function migrateItemsToOld(raw: any): OldWheelItem[] {
  // 1) Já no formato antigo esperado pelo WheelComponent
  if (Array.isArray(raw) && raw.every(i => typeof i?.id === "string" && typeof i?.text === "string")) {
    return raw as OldWheelItem[];
  }

  // 2) Formato novo v2 (label/hidden/weight)
  if (Array.isArray(raw) && raw.every(i => typeof i?.id === "string" && typeof i?.label === "string")) {
    const v2 = raw as NewWheelItem[];
    const sanitized = v2
      .map(i => ({
        ...i,
        label: String(i.label || "").slice(0, 80),
        hidden: !!i.hidden,
        weight: Math.max(1, Number.isFinite(i.weight) ? (i.weight as number) : 1),
      }))
      .filter(i => i.label.trim().length > 0);

    const visible = sanitized.filter(i => !i.hidden);
    return visible.map<OldWheelItem>(i => ({
      id: i.id,
      text: i.label,
      color: getRandomColor(),
    }));
  }

  // 3) Array simples de strings
  if (Array.isArray(raw) && raw.every(i => typeof i === "string")) {
    const normalized = (raw as string[])
      .map(s => String(s || "").trim())
      .filter(s => s.length > 0)
      .slice(0, 1000);
    return normalized.map<OldWheelItem>(text => ({
      id: generateId(),
      text: text.slice(0, 80),
      color: getRandomColor(),
    }));
  }

  return [];
}

export default function ClientApp() {
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        (window as any).__MW_DIAG__ = {
          ...(window as any).__MW_DIAG__,
          mounted: true,
        };
        console.log("[ClientApp] montado", window.location.href);
      } catch {}
    }
  }, []);

  const [items, setItems] = useState<OldWheelItem[]>([]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [lastResult, setLastResult] = useState<WheelResult | null>(null);
  const initializedRef = useRef(false);
  const toast = useToast();

  // Config (defaults)
  const [spinDuration, setSpinDuration] = useState<number>(3000);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [confettiEnabled, setConfettiEnabled] = useState<boolean>(false);
  // restringe easing ao union aceito pelo WheelComponent
  const [easing, setEasing] = useState<'linear' | 'easeOutCubic' | 'easeOutQuart'>('easeOutCubic');
  const [randomStart, setRandomStart] = useState<boolean>(true);
  const [removeAfterChoiceEnabled, setRemoveAfterChoiceEnabled] = useState<boolean>(false);
  const configInitializedRef = useRef(false);

  // Carregar itens com migração (uma vez)
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    // 0) Importação via URL (?data=...) — se existir, aplica antes de carregar estado
    try {
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        const dataParam = url.searchParams.get("data");
        if (dataParam) {
          const json = fromUrlSafeBase64(dataParam);
          if (json) {
            try {
              const payload = JSON.parse(json);
              // Esperado: { version, items, config, history }
              if (payload && typeof payload === "object") {
                if (Array.isArray(payload.items)) {
                  setItemsV2(payload.items as any, false);
                  // Reflete imediatamente no legado com itens visíveis
                  const visibleOld = (payload.items as NewWheelItem[])
                    .filter(i => !i.hidden && String(i.label || "").trim().length > 0)
                    .map<OldWheelItem>(i => ({
                      id: i.id || generateId(),
                      text: String(i.label || ""),
                      color: getRandomColor()
                    }));
                  if (typeof window !== "undefined") {
                    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(visibleOld));
                  }
                  setItems(visibleOld);
                  dispatchUpdate("modern-wheel:items-updated");
                }
                if (payload.config && typeof payload.config === "object") {
                  storageSetConfig(payload.config as any, false);
                  // aplica em memória quando possível
                  const c: any = payload.config;
                  if (typeof c.spinDuration === "number") setSpinDuration(c.spinDuration);
                  if (typeof c.soundEnabled === "boolean") setSoundEnabled(c.soundEnabled);
                  if (typeof c.confettiEnabled === "boolean") setConfettiEnabled(c.confettiEnabled);
                  if (typeof c.easing === "string") setEasing(c.easing);
                  if (typeof c.randomStart === "boolean") setRandomStart(c.randomStart);
                  if (typeof c.removeAfterChoiceEnabled === "boolean") setRemoveAfterChoiceEnabled(c.removeAfterChoiceEnabled);
                  dispatchUpdate("modern-wheel:config-updated");
                }
                if (Array.isArray(payload.history)) {
                  storageSetHistory(payload.history as any, false);
                  dispatchUpdate("modern-wheel:history-updated");
                }
              }
            } catch {}
          }
          // Limpa o parâmetro para evitar reimportações ao navegar/refresh
          url.searchParams.delete("data");
          const clean = url.pathname + url.search + url.hash;
          window.history.replaceState({}, "", clean);
        }
      }
    } catch {}
    try {
      // Prioriza v2 via storage central
      const v2 = getItemsV2();
      if (Array.isArray(v2) && v2.length > 0) {
        const migrated = migrateItemsToOld(v2 as any);
        if (migrated.length > 0) {
          setItems(migrated);
          if (typeof window !== "undefined") {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
          }
          return;
        }
      }

      // Fallback: ler legado direto (compat)
      const rawLegacy = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
      if (rawLegacy) {
        const parsed = JSON.parse(rawLegacy);
        const migrated = migrateItemsToOld(parsed);
        if (migrated.length > 0) {
          setItems(migrated);
          if (typeof window !== "undefined") {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
          }
          return;
        }
      }
    } catch {}

    // Seed padrão
    setItems([
      { id: generateId(), text: "Item 1", color: getRandomColor() },
      { id: generateId(), text: "Item 2", color: getRandomColor() }
    ]);
  }, []);

  // Persistência do formato antigo usado pela roda
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      }
    } catch {}
  }, [items]);

  // Carregar config (uma vez)
  useEffect(() => {
    if (configInitializedRef.current) return;
    configInitializedRef.current = true;
    try {
      const parsed = storageGetConfig<any>({}) || {};
      if (parsed && typeof parsed === "object") {
        if (typeof parsed.spinDuration === "number") setSpinDuration(parsed.spinDuration);
        if (typeof parsed.soundEnabled === "boolean") setSoundEnabled(parsed.soundEnabled);
        if (typeof parsed.confettiEnabled === "boolean") setConfettiEnabled(parsed.confettiEnabled);
        if (typeof parsed.easing === "string") {
          const v = parsed.easing as string;
          if (v === 'linear' || v === 'easeOutCubic' || v === 'easeOutQuart') {
            setEasing(v);
          } else {
            // normaliza valores antigos (ex: cubic-bezier...) para o padrão
            setEasing('easeOutCubic');
          }
        }
        if (typeof parsed.randomStart === "boolean") setRandomStart(parsed.randomStart);
        if (typeof parsed.removeAfterChoiceEnabled === "boolean") setRemoveAfterChoiceEnabled(parsed.removeAfterChoiceEnabled);
      }
    } catch {}
  }, []);

  // Persistir config
  useEffect(() => {
    try {
      const cfg = { spinDuration, soundEnabled, confettiEnabled, easing, randomStart, removeAfterChoiceEnabled };
      storageSetConfig(cfg, false);
      dispatchUpdate("modern-wheel:config-updated");
    } catch {}
  }, [spinDuration, soundEnabled, confettiEnabled, easing, randomStart, removeAfterChoiceEnabled]);

  const config = useMemo(() => ({
    spinDuration,
    soundEnabled,
    confettiEnabled,
    easing,
    randomStart,
    removeAfterChoiceEnabled,
  }), [spinDuration, soundEnabled, confettiEnabled, easing, randomStart, removeAfterChoiceEnabled]);

  // Utilitário: obter itens v2 atuais do storage (usados para export/share)
  const getCurrentV2Items = useCallback((): NewWheelItem[] => {
    try {
      const parsed = getItemsV2() as any[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as NewWheelItem[];
    } catch {}
    // fallback: derivar dos itens legados visíveis
    return items.map<NewWheelItem>(i => ({
      id: i.id,
      label: i.text,
      hidden: false,
      weight: 1,
    }));
  }, [items]);

  const buildExportPayload = useCallback(() => {
    let v2 = getCurrentV2Items();
    let cfg: any = {};
    let hist: any[] = [];
    try {
      cfg = storageGetConfig<any>({}) || {};
      hist = storageGetHistory() || [];
    } catch {}
    return {
      version: 2,
      items: v2,
      config: { ...config, ...cfg },
      history: hist,
      exportedAt: new Date().toISOString(),
    };
  }, [config, getCurrentV2Items]);

  const handleExport = useCallback(async () => {
    const payload = buildExportPayload();
    const text = JSON.stringify(payload, null, 2);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // fallback: download de arquivo JSON
      try {
        const blob = new Blob([text], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "modern-wheel-export.json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch {}
    }
  }, [buildExportPayload]);

  const handleShare = useCallback(async () => {
    const payload = buildExportPayload();
    const compact = JSON.stringify(payload);
    const b64 = toUrlSafeBase64(compact);
    // monta URL atual + query ?data=
    try {
      const base = typeof window !== "undefined" ? window.location.origin + window.location.pathname : "https://modern-wheel.local/";
      const url = `${base}?data=${b64}`;
      await navigator.clipboard.writeText(url);
    } catch {
      // se clipboard falhar, tenta alert
      try {
        const base = typeof window !== "undefined" ? window.location.origin + window.location.pathname : "https://modern-wheel.local/";
        const url = `${base}?data=${b64}`;
        window.alert(`URL de compartilhamento:\n${url}`);
      } catch {}
    }
  }, [buildExportPayload]);

  // Mapeia itens atuais (old) -> formato do painel (v2) preservando estado salvo em STORAGE_KEY_V2
  const panelItems: NewWheelItem[] = useMemo(() => {
    try {
      const parsed = getItemsV2() as NewWheelItem[];
      if (Array.isArray(parsed)) {
        const sanitized = parsed.map<NewWheelItem>(i => ({
          id: i.id || generateId(),
          label: String(i.label || "").slice(0, 80),
          hidden: !!i.hidden,
          weight: Math.max(1, Number.isFinite(i.weight) ? (i.weight as number) : 1),
        })).filter(i => i.label.trim().length > 0);
        if (sanitized.length > 0) return sanitized;
      }
    } catch {}
    // fallback: derivar dos itens legados (todos visíveis, peso 1)
    return items.map<NewWheelItem>(i => ({
      id: i.id,
      label: i.text,
      hidden: false,
      weight: 1,
    }));
  }, [items]);

  // Recebe alterações do painel em v2, persiste v2 e reflete apenas visíveis na roda
  const handlePanelChange = useCallback((list: NewWheelItem[]) => {
    let sanitized: NewWheelItem[] = [];
    try {
      sanitized = list.map<NewWheelItem>(i => ({
        id: i.id || generateId(),
        label: String(i.label || "").slice(0, 80),
        hidden: !!i.hidden,
        weight: Math.max(1, Number.isFinite(i.weight) ? (i.weight as number) : 1),
      })).filter(i => i.label.trim().length > 0);

      setItemsV2(sanitized, false);
      dispatchUpdate("modern-wheel:items-updated");
    } catch {}

    const visibleOld = sanitized
      .filter(i => !i.hidden && String(i.label || "").trim().length > 0)
      .map<OldWheelItem>(i => ({ id: i.id || generateId(), text: String(i.label || ""), color: getRandomColor() }));
    setItems(visibleOld);
  }, []);

  const onSpin = useCallback(() => {
    // Limpa último resultado para remover highlight durante o giro
    setLastResult(undefined as any);
    setIsSpinning(true);
    try { console.log("[ClientApp] onSpin"); } catch {}
  }, []);

  const onResult = useCallback((result: WheelResult) => {
    setIsSpinning(false);
    setLastResult(result);
    try { console.log("[ClientApp] onResult", result); } catch {}

    // Atualiza histórico local (últimos 50) + notifica painel em tempo real
    try {
      type HistItem = { id: string; label: string; timestamp: string };
      let list: HistItem[] = storageGetHistory() as any;
      if (!Array.isArray(list)) list = [];
      const entry: HistItem = {
        id: (result.item as any)?.id ?? "",
        label: (result.item as any)?.text ?? "",
        timestamp: new Date(result.timestamp || new Date()).toISOString(),
      };
      list.unshift(entry);
      if (list.length > 50) list = list.slice(0, 50);
      storageSetHistory(list as any, false);
      dispatchUpdate("modern-wheel:history-updated");
    } catch {}

    // Remover entrada após escolha (modo ocultar) — atua sobre items:v2 e reflete na UI/roda
    try {
      const cfg = storageGetConfig<any>({}) || {};
      const enabled = !!cfg.removeAfterChoiceEnabled;
      const winnerId = (result.item as any)?.id as string | undefined;

      if (enabled && winnerId) {
        const v2 = getItemsV2();
        const nextV2 = v2.map(i => (i.id === winnerId ? { ...i, hidden: true } : i));
        setItemsV2(nextV2, false);

        // Recalcula lista visível para a roda (legado)
        const visibleOld = nextV2
          .filter(i => !i.hidden && String(i.label || "").trim().length > 0)
          .map<OldWheelItem>(i => ({
            id: i.id || generateId(),
            text: String(i.label || ""),
            color: getRandomColor()
          }));
        if (typeof window !== "undefined") {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(visibleOld));
        }
        setItems(visibleOld);

        dispatchUpdate("modern-wheel:items-updated");
      }
    } catch {}
  }, []);

  return (
    <SidebarLayout
      title="Modern Wheel"
      onExport={handleExport}
      onShare={handleShare}
      sidebarContent={
        <div className="p-3">
          <InputsPanel
            items={panelItems}
            onChange={handlePanelChange}
            config={config as any}
            onConfigChange={(next: any) => {
              // Atualiza estados locais quando existirem (sincronismo com ClientApp)
              if (typeof next.spinDuration === "number") setSpinDuration(next.spinDuration);
              if (typeof next.soundEnabled === "boolean") setSoundEnabled(next.soundEnabled);
              if (typeof next.confettiEnabled === "boolean") setConfettiEnabled(next.confettiEnabled);
              if (typeof next.easing === "string") setEasing(next.easing);
              if (typeof next.randomStart === "boolean") setRandomStart(next.randomStart);
              if (typeof next.removeAfterChoiceEnabled === "boolean") setRemoveAfterChoiceEnabled(next.removeAfterChoiceEnabled);

              // Persiste config via storage central e notifica
              try {
                const merged = { ...(config as any), ...next };
                storageSetConfig(merged, false);
                dispatchUpdate("modern-wheel:config-updated");
              } catch {}
            }}
          />
          <div className="mt-4">
            <HistoryPanel />
          </div>
        </div>
      }
    >
      <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 gap-6">
        <WheelComponent
          items={items}
          isSpinning={isSpinning}
          onSpin={onSpin}
          onResult={onResult}
          config={config}
          highlightItemId={!isSpinning ? (lastResult as any)?.item?.id : undefined}
        />

        <div className="mt-2 text-center" aria-live="polite">
          <span className="text-sm text-gray-700">
            Último resultado: <strong>{(lastResult as any)?.item?.text || "—"}</strong>
          </span>
        </div>
      </div>
    </SidebarLayout>
  );
}