'use client';
import React, { useEffect, useMemo, useRef, useState } from "react";
import { WheelItem } from "@/types/wheel";

/**
 * Extensão local para suportar controles por imagem no painel (apenas UI)
 */
type PanelItem = WheelItem & {
  imageUrl?: string;
  imageFit?: "cover" | "contain";
  imageZoom?: number; // 0.5–2
  imageOpacity?: number; // 0–1
};

export interface InputsPanelProps {
  items: WheelItem[];
  onChange: (items: WheelItem[]) => void;

  // props elevadas para opções de sorteio (Sidebar)
  config?: any;
  onConfigChange?: (next: any) => void;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

/** Seção colapsável simples */
function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b pb-3">
      <button
        className="w-full flex items-center justify-between py-2 text-left font-semibold"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>{title}</span>
        <span className="text-sm text-gray-500">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="mt-2 space-y-3">{children}</div>}
    </section>
  );
}

export default function InputsPanel({
  items,
  onChange,
  config,
  onConfigChange,
}: InputsPanelProps) {
  const itemsCast = items as PanelItem[];
  const [newText, setNewText] = useState("");
  const [importText, setImportText] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [error, setError] = useState<string>("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Validações por item
  const [fieldErrors, setFieldErrors] = useState<
    Record<
      string,
      Partial<Record<"label" | "weight" | "url" | "zoom" | "opacity", string>>
    >
  >({});

  // Evitar mismatch de hidratação: derive visibleCount apenas no cliente após mount
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const visibleCount = useMemo(() => {
    if (!mounted) {
      // Igualar SSR: assume 0 até montar
      return 0;
    }
    return itemsCast.filter((i) => !i.hidden).length;
  }, [mounted, itemsCast]);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  // Utils de validação e atualização
  const setErr = (
    id: string,
    key: "label" | "weight" | "url" | "zoom" | "opacity",
    msg?: string
  ) => {
    setFieldErrors((prev) => {
      const cur = { ...(prev[id] || {}) };
      if (msg) cur[key] = msg;
      else delete cur[key];
      return { ...prev, [id]: cur };
    });
  };
  const getErr = (
    id: string,
    key: "label" | "weight" | "url" | "zoom" | "opacity"
  ) => fieldErrors[id]?.[key];

  const isHttpUrl = (s: string) => /^https?:\/\//i.test(s);

  const addItem = () => {
    const raw = String(newText ?? "");
    const trimmed = raw.trim();
    if (!trimmed) {
      setError("O rótulo não pode estar vazio.");
      if (inputRef.current) inputRef.current.focus();
      return;
    }
    const label = trimmed.slice(0, 80);
    if (trimmed.length > 80) {
      setError("Limite de 80 caracteres. O texto foi truncado.");
    } else {
      setError("");
    }
    const next: PanelItem = {
      id: uid(),
      label,
      hidden: false,
      weight: 1,
      imageUrl: "",
      imageFit: "cover",
      imageZoom: 1,
      imageOpacity: 1,
    };
    onChange([...(itemsCast as WheelItem[]), (next as unknown) as WheelItem]);
    setNewText("");
    if (inputRef.current) inputRef.current.focus();
  };

  const updateItem = (id: string, patch: Partial<PanelItem>) => {
    onChange(
      itemsCast.map((it) =>
        it.id === id
          ? (({ ...it, ...patch } as unknown) as WheelItem)
          : (it as WheelItem)
      )
    );
  };

  const removeItem = (id: string) => {
    onChange(itemsCast.filter((it) => it.id !== id) as WheelItem[]);
  };

  const duplicateItem = (id: string) => {
    const idx = itemsCast.findIndex((i) => i.id === id);
    if (idx === -1) return;
    const orig = itemsCast[idx];
    const copy: PanelItem = { ...orig, id: uid() };
    const next = [
      ...itemsCast.slice(0, idx + 1),
      copy,
      ...itemsCast.slice(idx + 1),
    ];
    onChange((next as unknown) as WheelItem[]);
  };

  const moveUp = (id: string) => {
    const idx = itemsCast.findIndex((i) => i.id === id);
    if (idx <= 0) return;
    const next = [...itemsCast];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    onChange((next as unknown) as WheelItem[]);
  };

  const moveDown = (id: string) => {
    const idx = itemsCast.findIndex((i) => i.id === id);
    if (idx === -1 || idx >= itemsCast.length - 1) return;
    const next = [...itemsCast];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    onChange((next as unknown) as WheelItem[]);
  };

  const shuffle = () => {
    const next = [...itemsCast];
    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    onChange((next as unknown) as WheelItem[]);
  };

  const exportText = () => {
    const text = itemsCast
      .map((i) => {
        const parts = [i.label, String(i.weight)];
        if (i.hidden) parts.push("hidden");
        if (i.imageUrl) parts.push(String(i.imageUrl));
        if (i.imageFit) parts.push(String(i.imageFit));
        if (typeof i.imageZoom === "number") parts.push(String(i.imageZoom));
        if (typeof (i as any).imageOpacity === "number")
          parts.push(String((i as any).imageOpacity));
        return parts.join("\t");
      })
      .join("\n");
    navigator.clipboard?.writeText(text).catch(() => {});
  };

  const openImport = () => setImportOpen(true);
  const closeImport = () => setImportOpen(false);

  const handleImport = (replace: boolean) => {
    const lines = importText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const parsed: PanelItem[] = [];
    for (const line of lines) {
      // texto | texto\tweight | texto\tweight\thidden | texto\tweight\thidden\timageUrl | texto\tweight\thidden\timageUrl\timageFit\timageZoom[ \t]imageOpacity
      const parts = line.split(/\t|,|;/).map((p) => p.trim());
      if (!parts[0]) continue;
      const label = parts[0].slice(0, 80);
      let weight = 1;
      let hidden = false;
      let imageUrl: string | undefined = undefined;
      let imageFit: "cover" | "contain" = "cover";
      let imageZoom: number | undefined = undefined;
      let imageOpacity: number | undefined = undefined;

      if (parts[1]) {
        const w = parseInt(parts[1], 10);
        if (!isNaN(w)) weight = Math.max(1, Math.min(999, Math.trunc(w)));
      }
      if (parts[2]) {
        hidden = /true|hidden|1/i.test(parts[2]);
      }
      if (parts[3]) {
        const url = parts[3];
        if (/^https?:\/\//i.test(url)) imageUrl = url;
      }
      if (parts[4]) {
        const f = parts[4].toLowerCase();
        if (f === "cover" || f === "contain") imageFit = f;
      }
      if (parts[5]) {
        const z = parseFloat(parts[5]);
        if (!isNaN(z)) imageZoom = Math.max(0.5, Math.min(2, z));
      }
      if (parts[6]) {
        const op = parseFloat(parts[6]);
        if (!isNaN(op)) imageOpacity = Math.max(0, Math.min(1, op));
      }
      parsed.push({
        id: uid(),
        label,
        weight,
        hidden,
        ...(imageUrl ? { imageUrl } : {}),
        imageFit,
        ...(typeof imageZoom === "number" ? { imageZoom } : {}),
        ...(typeof imageOpacity === "number" ? { imageOpacity } : {}),
      });
    }
    if (!parsed.length) {
      setError("Nenhum item válido encontrado para importar.");
      return;
    }
    onChange(((replace ? parsed : [...itemsCast, ...parsed]) as unknown) as WheelItem[]);
    setImportText("");
    setImportOpen(false);
    setError("");
  };

  // Helpers de config elevadas
  const pushConfig = (patch: any) => {
    if (typeof onConfigChange === "function") {
      onConfigChange(patch);
      return;
    }
    // fallback: persistir direto se não recebido via props
    try {
      if (typeof window !== "undefined") {
        const prevRaw = window.localStorage.getItem("modern-wheel:config");
        const prev = prevRaw ? JSON.parse(prevRaw) : {};
        const merged = { ...prev, ...patch };
        window.localStorage.setItem("modern-wheel:config", JSON.stringify(merged));
        window.dispatchEvent(new Event("modern-wheel:config-updated"));
      }
    } catch {}
  };

  const getCfg = (key: string, def: any) => {
    const c = (config as any) || {};
    if (Object.prototype.hasOwnProperty.call(c, key)) return c[key];
    return def;
  };

  // --- Drag & Drop (HTML5) para reordenar itens da lista ---
  const dragSrcIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const onDragStart = (index: number, e: React.DragEvent) => {
    dragSrcIndexRef.current = index;
    try { e.dataTransfer.setData("text/plain", String(index)); } catch {}
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragOver = (index: number, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIndex !== index) setDragOverIndex(index);
  };
  const onDragLeave = (_index: number, _e: React.DragEvent) => {
    setDragOverIndex(null);
  };
  const onDrop = (index: number, e: React.DragEvent) => {
    e.preventDefault();
    const from = dragSrcIndexRef.current ?? Number(e.dataTransfer.getData("text/plain"));
    const to = index;
    setDragOverIndex(null);
    dragSrcIndexRef.current = null;
    if (!Number.isInteger(from) || !Number.isInteger(to)) return;
    if (from === to) return;

    const next = [...itemsCast];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange((next as unknown) as WheelItem[]);
  };
  const onDragEnd = () => {
    setDragOverIndex(null);
    dragSrcIndexRef.current = null;
  };

  const getDragClass = (index: number) =>
    dragOverIndex === index ? "ring-2 ring-emerald-400 rounded-md" : "";

  return (
    <div className="space-y-4" aria-label="Painel de entradas da roda" data-testid="inputs-panel-root">
      {/* Seção: Itens */}
      <Section title={`Itens (${mounted ? visibleCount : 0}/${mounted ? itemsCast.length : 0})`} defaultOpen>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              className={`input w-full ${error ? "border-red-500" : ""}`}
              value={newText}
              placeholder="Novo item"
              aria-label="Novo item (máx. 80 caracteres)"
              maxLength={80}
              onChange={(e) => {
                setNewText(e.target.value);
                if (error) setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") addItem();
                if (e.key === "Escape") {
                  setNewText("");
                  setError("");
                }
              }}
              title="Digite o rótulo do novo item (máx. 80 caracteres)"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 select-none">
              {newText.length}/80
            </span>
          </div>
          <button
            className="btn-primary"
            onClick={addItem}
            aria-label="Adicionar item"
            title="Adicionar novo item (Enter)"
          >
            <span>Adicionar</span>
          </button>
          <button
            className="btn"
            onClick={shuffle}
            aria-label="Embaralhar itens"
            title="Embaralhar itens visíveis"
          >
            Shuffle
          </button>
          <button
            className="btn"
            onClick={exportText}
            aria-label="Exportar itens"
            title="Exportar itens (label, peso, hidden, imagem) para a área de transferência"
          >
            Exportar
          </button>
          <button
            className="btn"
            onClick={() => setImportOpen(true)}
            aria-label="Importar itens"
            title="Importar itens por texto"
          >
            Importar
          </button>
        </div>

        {error && (
          <div
            className="text-sm text-red-600"
            role="alert"
            aria-live="assertive"
            title={error}
          >
            {error}
          </div>
        )}

        {(!mounted || items.length === 0) ? (
          <p className="text-sm text-gray-500">
            {!mounted ? 'Carregando…' : 'Nenhum item ainda. Adicione alguns acima.'}
          </p>
        ) : (
          <ul className="space-y-2 max-h-[50vh] overflow-auto pr-1">
            {itemsCast.map((item, idx) => (
              <li
                key={item.id}
                className={`flex items-start gap-2 ${getDragClass(idx)}`}
                draggable
                onDragStart={(e) => onDragStart(idx, e)}
                onDragOver={(e) => onDragOver(idx, e)}
                onDragLeave={(e) => onDragLeave(idx, e)}
                onDrop={(e) => onDrop(idx, e)}
                onDragEnd={onDragEnd}
                aria-grabbed="true"
              >
                <button
                  className="btn-xs"
                  onClick={() => moveUp(item.id)}
                  aria-label="Subir item"
                  title="Subir item"
                >
                  ▲
                </button>
                <button
                  className="btn-xs"
                  onClick={() => moveDown(item.id)}
                  aria-label="Descer item"
                  title="Descer item"
                >
                  ▼
                </button>

                <div className="flex-1 flex items-center gap-2 cursor-move select-none" title="Arraste para reordenar">
                  {Boolean((item as any).imageUrl) && (
                    <img
                      src={(item as any).imageUrl}
                      alt=""
                      className="w-8 h-8 object-cover rounded"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display =
                          "none";
                      }}
                      title="Prévia da imagem"
                    />
                  )}
                  <div className="flex-1">
                    <div className="relative">
                      <input
                        data-testid={`label-input-${item.id}`}
                        className={`input w-full ${
                          getErr(item.id, "label") ? "border-red-500" : ""
                        }`}
                        value={item.label}
                        aria-label="Editar rótulo do item (máx. 80 caracteres)"
                        maxLength={80}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const trimmed = raw.replace(/\s+/g, " ");
                          const val = trimmed.slice(0, 80);
                          updateItem(item.id, { label: val });
                          if (!val.trim())
                            setErr(
                              item.id,
                              "label",
                              "O rótulo não pode estar vazio."
                            );
                          else if (val.length > 80)
                            setErr(item.id, "label", "Máximo de 80 caracteres.");
                          else {
                            if (val.length >= 70)
                              setErr(
                                item.id,
                                "label",
                                `Próximo do limite: ${val.length}/80`
                              );
                            else setErr(item.id, "label");
                          }
                        }}
                        onBlur={(e) => {
                          const val = (e.target.value || "").trim();
                          if (!val) setErr(item.id, "label", "Label vazio");
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                        title={
                          item.label.length >= 80
                            ? "Rótulo no limite de 80 caracteres"
                            : "Rótulo do item (máximo 80 caracteres)"
                        }
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 select-none">
                        {item.label.length}/80
                      </span>
                    </div>
                    {getErr(item.id, "label") && (
                      <div
                        className="text-xs text-red-600 mt-1"
                        role="alert"
                        aria-live="assertive"
                      >
                        {getErr(item.id, "label")}
                      </div>
                    )}
                  </div>
                </div>

                <div className="w-24">
                  <input
                    data-testid={`weight-input-${item.id}`}
                    className={`input w-full ${
                      getErr(item.id, "weight") ? "border-red-500" : ""
                    }`}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={999}
                    aria-label="Peso do item (entre 1 e 999)"
                    value={item.weight}
                    onChange={(e) => {
                      const raw = e.target.value || "1";
                      let v = parseInt(raw, 10);
                      if (isNaN(v)) v = 1;
                      if (!Number.isInteger(v)) v = Math.trunc(v);
                      if (v < 1) setErr(item.id, "weight", "Peso mínimo");
                      else if (v > 999)
                        setErr(item.id, "weight", "Peso máximo");
                      else setErr(item.id, "weight");
                      v = Math.max(1, Math.min(999, v));
                      updateItem(item.id, { weight: v });
                    }}
                    onBlur={(e) => {
                      let v = parseInt(e.target.value || "1", 10);
                      if (isNaN(v)) v = 1;
                      v = Math.trunc(v);
                      v = Math.max(1, Math.min(999, v));
                      if (v !== item.weight) updateItem(item.id, { weight: v });
                      if (v < 1) setErr(item.id, "weight", "Peso mínimo");
                      else if (v > 999)
                        setErr(item.id, "weight", "Peso máximo");
                      else setErr(item.id, "weight");
                    }}
                    title={
                      item.weight >= 999
                        ? "Peso no limite máximo (999)"
                        : "Peso (inteiro entre 1 e 999)"
                    }
                  />
                  {getErr(item.id, "weight") && (
                    <div
                      className="text-xs text-red-600 mt-1"
                      role="alert"
                      aria-live="assertive"
                    >
                      {getErr(item.id, "weight")}
                    </div>
                  )}
                </div>

                <div className="w-56">
                  <input
                    data-testid={`image-url-input-${item.id}`}
                    className={`input w-full ${
                      getErr(item.id, "url") ? "border-red-500" : ""
                    }`}
                    type="url"
                    placeholder="URL da imagem (http...)"
                    aria-label="URL da imagem para este item"
                    value={item.imageUrl || ""}
                    onChange={(e) => {
                      const url = e.target.value.trim();
                      updateItem(item.id, { imageUrl: url });
                      if (url && !isHttpUrl(url))
                        setErr(
                          item.id,
                          "url",
                          "URL inválida (use http/https)."
                        );
                      else setErr(item.id, "url");
                    }}
                    onBlur={(e) => {
                      const url = (e.target.value || "").trim();
                      if (url && !isHttpUrl(url))
                        setErr(
                          item.id,
                          "url",
                          "URL inválida (use http/https)."
                        );
                    }}
                    title="Cole um link http(s) de imagem. A imagem será recortada no setor."
                  />
                  {getErr(item.id, "url") && (
                    <div
                      className="text-xs text-red-600 mt-1"
                      role="alert"
                      aria-live="assertive"
                    >
                      {getErr(item.id, "url")}
                    </div>
                  )}
                </div>

                <select
                  className="input w-28"
                  aria-label="Ajuste de encaixe da imagem"
                  title="Como a imagem preenche o setor"
                  value={item.imageFit || "cover"}
                  onChange={(e) =>
                    updateItem(item.id, {
                      imageFit: (e.target.value as "cover" | "contain") || "cover",
                    })
                  }
                >
                  <option value="cover">Cover</option>
                  <option value="contain">Contain</option>
                </select>

                <input
                  className={`input w-24 ${
                    getErr(item.id, "zoom") ? "border-red-500" : ""
                  }`}
                  type="number"
                  step={0.1}
                  min={0.5}
                  max={2}
                  aria-label="Zoom da imagem (0.5 a 2)"
                  value={typeof item.imageZoom === "number" ? item.imageZoom : 1}
                  onChange={(e) => {
                    let v = parseFloat(e.target.value);
                    if (isNaN(v)) v = 1;
                    v = Math.max(0.5, Math.min(2, v));
                    if (v < 0.5) setErr(item.id, "zoom", "Mínimo 0.5");
                    else if (v > 2) setErr(item.id, "zoom", "Máximo 2");
                    else setErr(item.id, "zoom");
                    updateItem(item.id, { imageZoom: v });
                  }}
                  title="Zoom aplicado na imagem (0.5–2)"
                />

                <input
                  className={`input w-24 ${
                    getErr(item.id, "opacity") ? "border-red-500" : ""
                  }`}
                  type="number"
                  step={0.05}
                  min={0}
                  max={1}
                  aria-label="Opacidade da imagem (0 a 1)"
                  value={
                    typeof (item as any).imageOpacity === "number"
                      ? (item as any).imageOpacity
                      : 1
                  }
                  onChange={(e) => {
                    let v = parseFloat(e.target.value);
                    if (isNaN(v)) v = 1;
                    v = Math.max(0, Math.min(1, v));
                    if (v < 0) setErr(item.id, "opacity", "Mínimo 0");
                    else if (v > 1) setErr(item.id, "opacity", "Máximo 1");
                    else setErr(item.id, "opacity");
                    updateItem(item.id, { imageOpacity: v });
                  }}
                  title="Transparência da imagem (0–1)"
                />

                <button
                  className="btn"
                  onClick={() => duplicateItem(item.id)}
                  aria-label="Duplicar item"
                  title="Duplicar item"
                >
                  Duplicar
                </button>
                <button
                  className="btn-danger"
                  onClick={() => removeItem(item.id)}
                  aria-label="Remover item"
                  title="Remover item"
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Seção: Opções de Sorteio (props elevadas) */}
      <Section title="Opções de Sorteio" defaultOpen={true}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex items-center justify-between gap-3">
            <span>Volume (0–100)</span>
            <input
              className="input w-24"
              type="number"
              min={0}
              max={100}
              value={Math.round(Number(getCfg("volume", 80)))}
              onChange={(e) => {
                let v = parseInt(e.target.value || "80", 10);
                if (isNaN(v)) v = 80;
                v = Math.max(0, Math.min(100, v));
                pushConfig({ volume: v / 100 });
              }}
              aria-label="Volume global de áudio"
              title="Volume global dos sons (0–100)"
            />
          </label>
          <label className="flex items-center justify-between gap-3">
            <span>Modo</span>
            <select
              className="input w-40"
              value={String(getCfg("mode", "normal"))}
              onChange={(e) => pushConfig({ mode: e.target.value })}
              aria-label="Modo de ação da roda"
              title="Normal, Eliminação ou Acumulação"
            >
              <option value="normal">Normal</option>
              <option value="elimination">Eliminação</option>
              <option value="accumulation">Acumulação</option>
            </select>
          </label>

          <label className="flex items-center justify-between gap-3">
            <span>Não repetir</span>
            <input
              type="checkbox"
              checked={!!getCfg("noRepeat", false)}
              onChange={(e) => pushConfig({ noRepeat: e.target.checked })}
            />
          </label>

          <label className="flex items-center justify-between gap-3">
            <span>Janela (não repetir)</span>
            <input
              type="number"
              min={1}
              max={10}
              className="input w-24"
              value={Math.max(1, Math.min(10, Number(getCfg("noRepeatWindow", 1))))}
              onChange={(e) => {
                let v = parseInt(e.target.value || "1", 10);
                if (isNaN(v)) v = 1;
                v = Math.max(1, Math.min(10, v));
                pushConfig({ noRepeatWindow: v });
              }}
              aria-label="Tamanho da janela para 'não repetir' (1 a 10)"
              title="Quantidade de giros recentes bloqueados de se repetirem (1–10)"
            />
          </label>

          <label className="flex items-center justify-between gap-3">
            <span>Melhor de N</span>
            <input
              type="number"
              min={1}
              max={10}
              className="input w-24"
              value={Math.max(1, Math.min(10, Number(getCfg("bestOfN", 1))))}
              onChange={(e) => {
                let v = parseInt(e.target.value || "1", 10);
                if (isNaN(v)) v = 1;
                v = Math.max(1, Math.min(10, v));
                pushConfig({ bestOfN: v });
              }}
              aria-label="Melhor de N (1 a 10)"
              title="Executa N sorteios internos e escolhe o de maior peso (1–10)"
            />
          </label>

          <label className="flex items-center justify-between gap-3">
            <span>Ângulo inicial aleatório</span>
            <input
              type="checkbox"
              checked={!!getCfg("randomStart", true)}
              onChange={(e) => pushConfig({ randomStart: e.target.checked })}
            />
          </label>

          {/* Modo eliminação clássico do PickerWheel */}
          <label className="flex items-center justify-between gap-3">
            <span>Remover entrada após escolha</span>
            <input
              type="checkbox"
              data-testid="remove-after-choice-toggle"
              checked={!!getCfg("removeAfterChoiceEnabled", false)}
              onChange={(e) =>
                pushConfig({ removeAfterChoiceEnabled: e.target.checked })
              }
            />
          </label>
        </div>
      </Section>

      {/* Seção: Importar/Exportar */}
      <Section title="Importar/Exportar" defaultOpen={false}>
        {!importOpen ? (
          <div className="flex items-center gap-2">
            <button
              className="btn"
              onClick={() => setImportOpen(true)}
              aria-label="Colar itens rapidamente"
              title="Colar lista de itens (uma por linha, opcional peso após vírgula)"
            >
              Colar lista
            </button>
            <button
              className="btn"
              onClick={() => setImportOpen(true)}
              aria-label="Importar itens"
            >
              Abrir importação
            </button>
            <button
              className="btn"
              onClick={exportText}
              aria-label="Exportar para área de transferência"
            >
              Exportar (copiar)
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <textarea
              className="input w-full h-24"
              placeholder={`Cole linhas no formato:\ntexto\\tpeso\\thidden\\timageUrl\\timageFit\\timageZoom\\timageOpacity`}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              aria-label="Área de texto para importação"
            />
            <div className="flex gap-2">
              <button
                className="btn-primary"
                onClick={() => handleImport(true)}
                aria-label="Importar substituindo lista"
              >
                Importar (substituir)
              </button>
              <button
                className="btn"
                onClick={() => handleImport(false)}
                aria-label="Importar adicionando ao final"
              >
                Importar (acrescentar)
              </button>
              <button
                className="btn-ghost"
                onClick={closeImport}
                aria-label="Fechar importação"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </Section>

      {/* Dicas */}
      <Section title="Dicas" defaultOpen={false}>
        <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
          <li>Use Importar/Exportar para salvar/restaurar rapidamente listas.</li>
          <li>Você pode colar URLs de imagens para ilustrar cada item.</li>
          <li>O peso ajusta a probabilidade de saída no sorteio.</li>
        </ul>
      </Section>
    </div>
  );
}