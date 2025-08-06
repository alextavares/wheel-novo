/**
 * Módulo central de persistência (localStorage) com chaves unificadas,
 * migrações leves e APIs utilitárias.
 *
 * Objetivo:
 * - Padronizar acesso/gravação aos dados: itens v2, config, histórico, templates e favoritos.
 * - Encapsular JSON parse/stringify com tolerância a erro.
 * - Expor eventos customizados para sincronização imediata entre componentes/abas.
 *
 * Observação:
 * - Este módulo não deve importar componentes/React. É agnóstico de UI.
 * - Datas são persistidas como string ISO. Conversão para Date deve ser feita por consumidores quando necessário.
 */

export type StorageEventName =
  | "modern-wheel:items-updated"
  | "modern-wheel:config-updated"
  | "modern-wheel:history-updated"
  | "modern-wheel:templates-updated"
  | "modern-wheel:favorites-updated";

export const STORAGE_KEYS = {
  itemsV2: "modern-wheel:items:v2",         // [{ id, label/text, weight, hidden }]
  legacyItems: "modern-wheel:items",         // compat legada, quando necessário
  config: "modern-wheel:config",             // objeto de configuração
  history: "modern-wheel:history",           // [{ id, label, timestamp }]
  templates: "modern-wheel:templates",       // templates custom do usuário
  favorites: "modern-wheel:templates:favorites", // ids favoritos
  ui: {
    history: "modern-wheel:history:ui",       // preferências de UI do histórico
  },
} as const;

function hasWindow(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function dispatchUpdate(eventName: StorageEventName) {
  if (!hasWindow()) return;
  try {
    window.dispatchEvent(new Event(eventName));
  } catch {
    // silencioso
  }
}

function safeParse<T>(raw: string | null, fallback: T): T {
  try {
    if (raw == null) return fallback;
    const parsed = JSON.parse(raw);
    return parsed as T;
  } catch {
    return fallback;
  }
}

function safeStringify(data: unknown): string {
  try {
    return JSON.stringify(data);
  } catch {
    return "null";
  }
}

/**
 * API base para get/set/remove sob uma chave.
 */
export function storageGet<T>(key: string, fallback: T): T {
  if (!hasWindow()) return fallback;
  const raw = window.localStorage.getItem(key);
  return safeParse<T>(raw, fallback);
}

export function storageSet(key: string, value: unknown) {
  if (!hasWindow()) return;
  try {
    window.localStorage.setItem(key, safeStringify(value));
  } catch {
    // silencioso
  }
}

export function storageRemove(key: string) {
  if (!hasWindow()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // silencioso
  }
}

/**
 * Camada de alto nível por domínio
 */

// Itens V2
export type V2Item = {
  id: string;
  label?: string;  // compat com painéis
  text?: string;   // alguns lugares usam text
  weight?: number;
  hidden?: boolean;
  color?: string;
};

export function getItemsV2(): V2Item[] {
  const list = storageGet<V2Item[]>(STORAGE_KEYS.itemsV2, []);
  if (!Array.isArray(list)) return [];
  // normalização leve
  return list.map((it) => ({
    ...it,
    weight: typeof it.weight === "number" && it.weight >= 1 ? it.weight : 1,
    hidden: !!it.hidden,
  }));
}

export function setItemsV2(items: V2Item[], emitEvent = true) {
  storageSet(STORAGE_KEYS.itemsV2, items);
  if (emitEvent) dispatchUpdate("modern-wheel:items-updated");
}

// Config
export type AppConfig = Record<string, unknown>; // tipar conforme necessário

export function getConfig<T extends AppConfig = AppConfig>(fallback: T): T {
  return storageGet<T>(STORAGE_KEYS.config, fallback);
}

export function setConfig(value: AppConfig, emitEvent = true) {
  storageSet(STORAGE_KEYS.config, value);
  if (emitEvent) dispatchUpdate("modern-wheel:config-updated");
}

// Histórico
export type HistoryEntry = { id: string; label: string; timestamp: string };

export function getHistory(): HistoryEntry[] {
  const list = storageGet<HistoryEntry[]>(STORAGE_KEYS.history, []);
  return Array.isArray(list) ? list : [];
}

export function setHistory(entries: HistoryEntry[], emitEvent = true) {
  storageSet(STORAGE_KEYS.history, entries);
  if (emitEvent) dispatchUpdate("modern-wheel:history-updated");
}

export function clearHistory(emitEvent = true) {
  storageRemove(STORAGE_KEYS.history);
  if (emitEvent) dispatchUpdate("modern-wheel:history-updated");
}

// Templates custom do usuário
export type StoredTemplate = {
  // tipagem compatível com Template de '@/types', mas como storage cru
  id: string;
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
  isPublic?: boolean;
  createdAt?: string; // salvar como ISO
  updatedAt?: string; // salvar como ISO
  items: Array<{ id: string; text: string; color?: string }>;
};

export function getUserTemplates(): StoredTemplate[] {
  const list = storageGet<StoredTemplate[]>(STORAGE_KEYS.templates, []);
  return Array.isArray(list) ? list : [];
}

export function setUserTemplates(templates: StoredTemplate[], emitEvent = true) {
  // salvar datas como ISO
  const normalized = templates.map((t) => ({
    ...t,
    createdAt: t.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
  storageSet(STORAGE_KEYS.templates, normalized);
  if (emitEvent) dispatchUpdate("modern-wheel:templates-updated");
}

// Favoritos
export function getFavoriteTemplateIds(): string[] {
  const ids = storageGet<string[]>(STORAGE_KEYS.favorites, []);
  return Array.isArray(ids) ? ids : [];
}

export function setFavoriteTemplateIds(ids: string[], emitEvent = true) {
  storageSet(STORAGE_KEYS.favorites, ids);
  if (emitEvent) dispatchUpdate("modern-wheel:favorites-updated");
}

/**
 * Migrações leves
 * - Ponto para evoluções futuras. Ex.: migrar legacy items -> items:v2, normalizar config antiga etc.
 */
export function runMigrations() {
  // Exemplo de migração: se não houver items:v2 mas houver legacy items, criar um v2 mínimo
  const v2 = storageGet<V2Item[]>(STORAGE_KEYS.itemsV2, []);
  if ((!v2 || v2.length === 0)) {
    const legacy = storageGet<any[]>(STORAGE_KEYS.legacyItems, []);
    if (Array.isArray(legacy) && legacy.length > 0) {
      const mapped: V2Item[] = legacy.map((it, idx) => ({
        id: String(it?.id ?? idx),
        label: String(it?.label ?? it?.text ?? ""),
        text: String(it?.text ?? it?.label ?? ""),
        weight: typeof it?.weight === "number" && it.weight >= 1 ? it.weight : 1,
        hidden: !!it?.hidden,
        color: it?.color,
      }));
      setItemsV2(mapped, false);
      // sem evento na migração inicial
    }
  }
}