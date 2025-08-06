import React, { useEffect, useState, useCallback } from "react";
import {
  STORAGE_KEYS,
  getHistory,
  setHistory,
  clearHistory as storageClearHistory,
  dispatchUpdate
} from "@/lib/storage";

type UIPeriod = "today" | "7d" | "30d" | "all";
type UIState = {
  period: UIPeriod;
  query: string;
  pageSize: 5 | 10 | 25;
  page: number;
};

type HistoryEntry = { id: string; label: string; timestamp: string };

function toCSV(entries: HistoryEntry[]): string {
  const header = ["id", "label", "timestamp"].join(",");
  const rows = entries.map(e => {
    // CSV-safe: escapar aspas duplas e envolver em aspas
    const id = `"${String(e.id ?? "").replace(/"/g, '""')}"`;
    const label = `"${String(e.label ?? "").replace(/"/g, '""')}"`;
    const ts = `"${String(e.timestamp ?? "").replace(/"/g, '""')}"`;
    return [id, label, ts].join(",");
  });
  return [header, ...rows].join("\n");
}

function toStatsCSV(stats: Array<{ label: string; count: number; percent: number }>): string {
  const header = ["label", "count", "percent"].join(",");
  const rows = stats.map(s => {
    const l = `"${String(s.label ?? "").replace(/"/g, '""')}"`;
    const c = String(s.count ?? 0);
    const p = String(Number.isFinite(s.percent) ? s.percent.toFixed(2) : "0");
    return [l, c, p].join(",");
  });
  return [header, ...rows].join("\n");
}

function download(filename: string, mime: string, content: string) {
  try {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 0);
  } catch {}
}

export default function HistoryPanel() {
  const [list, setList] = useState<HistoryEntry[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});

  // UI: período, busca, paginação
  const [period, setPeriod] = useState<UIPeriod>("all");
  const [query, setQuery] = useState<string>("");
  const [pageSize, setPageSize] = useState<5 | 10 | 25>(10);
  const [page, setPage] = useState<number>(1);

  // carregar UI state da persistência leve
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEYS.ui.history) : null;
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<UIState>;
        if (parsed.period === "today" || parsed.period === "7d" || parsed.period === "30d" || parsed.period === "all") {
          setPeriod(parsed.period);
        }
        if (typeof parsed.query === "string") setQuery(parsed.query);
        if (parsed.pageSize === 5 || parsed.pageSize === 10 || parsed.pageSize === 25) setPageSize(parsed.pageSize);
        if (typeof parsed.page === "number" && parsed.page >= 1) setPage(parsed.page);
      }
    } catch {}
  }, []);

  // salvar UI state quando mudar
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const ui: UIState = { period, query, pageSize, page };
        window.localStorage.setItem(STORAGE_KEYS.ui.history, JSON.stringify(ui));
      }
    } catch {}
  }, [period, query, pageSize, page]);

  // Função para carregar do localStorage e recalcular contagens
  const loadFromStorage = useCallback(() => {
    try {
      const hist = getHistory();
      setList(hist);

      const map: Record<string, number> = {};
      for (const it of hist) {
        const key = (it?.label ?? "").trim();
        if (!key) continue;
        map[key] = (map[key] || 0) + 1;
      }
      setCounts(map);
    } catch {}
  }, []);

  useEffect(() => {
    // carga inicial
    loadFromStorage();

    // 1) Escuta mudanças entre abas (evento 'storage')
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.history) {
        loadFromStorage();
      }
    };

    // 2) Escuta evento customizado no mesmo tab após onResult
    const onCustom = () => loadFromStorage();

    if (typeof window !== "undefined") {
      window.addEventListener("storage", onStorage);
      window.addEventListener("modern-wheel:history-updated", onCustom as EventListener);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener("modern-wheel:history-updated", onCustom as EventListener);
      }
    };
  }, [loadFromStorage]);

  const clearHistory = useCallback(() => {
    try {
      storageClearHistory(false);
      dispatchUpdate("modern-wheel:history-updated");
      setList([]);
      setCounts({});
    } catch {}
  }, []);

  const handleExport = useCallback((type: "json" | "csv") => {
    if (!list || list.length === 0) return;
    if (type === "json") {
      const content = JSON.stringify(list, null, 2);
      download("modern-wheel-history.json", "application/json;charset=utf-8", content);
    } else {
      const csv = toCSV(list);
      download("modern-wheel-history.csv", "text/csv;charset=utf-8", csv);
    }
  }, [list]);

  // Helpers de filtro de período
  const isSameLocalDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const now = new Date();
  const start7d = new Date(now);
  start7d.setDate(now.getDate() - 6); // inclui hoje + 6 dias anteriores
  start7d.setHours(0, 0, 0, 0);

  const start30d = new Date(now);
  start30d.setDate(now.getDate() - 29);
  start30d.setHours(0, 0, 0, 0);

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  // derivar lista filtrada por período e query
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((it) => {
      const d = new Date(it.timestamp);
      // filtro período
      let passPeriod = true;
      if (period === "today") {
        passPeriod = isSameLocalDay(d, now);
      } else if (period === "7d") {
        passPeriod = d >= start7d;
      } else if (period === "30d") {
        passPeriod = d >= start30d;
      }
      if (!passPeriod) return false;

      // filtro query
      if (q) {
        const text = String(it.label ?? "").toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [list, period, query]);
  const totalFiltered = filtered.length;

  // resetar página quando filtros mudarem
  useEffect(() => {
    setPage(1);
  }, [period, query, pageSize]);

  // paginação
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const end = start + pageSize;
  const filteredPage = filtered.slice(start, end);

  // estatísticas por item (baseadas na lista filtrada)
  const stats = React.useMemo(() => {
    const map: Record<string, number> = {};
    for (const it of filtered) {
      const key = (it?.label ?? "").trim();
      if (!key) continue;
      map[key] = (map[key] || 0) + 1;
    }
    const arr = Object.entries(map)
      .map(([label, count]) => ({ label, count, percent: totalFiltered > 0 ? (count / totalFiltered) * 100 : 0 }))
      .sort((a, b) => b.count - a.count);
    return arr;
  }, [filtered, totalFiltered]);

  const exportStatsCSV = useCallback(() => {
    if (!stats || stats.length === 0) return;
    const csv = toStatsCSV(stats);
    download("modern-wheel-history-stats.csv", "text/csv;charset=utf-8", csv);
  }, [stats]);

  return (
    <div className="p-4 border rounded-lg bg-white shadow">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Histórico (últimos 50)</h2>
        <div className="flex items-center gap-3">
          <button
            data-testid="history-export-json"
            className="text-sm text-blue-600 hover:underline"
            onClick={() => handleExport("json")}
            disabled={list.length === 0}
            title={list.length === 0 ? "Sem dados para exportar" : "Exportar como JSON"}
          >
            Exportar JSON
          </button>
          <button
            data-testid="history-export-csv"
            className="text-sm text-blue-600 hover:underline"
            onClick={() => handleExport("csv")}
            disabled={list.length === 0}
            title={list.length === 0 ? "Sem dados para exportar" : "Exportar como CSV"}
          >
            Exportar CSV (linhas)
          </button>
          <button
            data-testid="history-export-stats-csv"
            className="text-sm text-blue-600 hover:underline"
            onClick={exportStatsCSV}
            disabled={stats.length === 0}
            title={stats.length === 0 ? "Sem dados para exportar" : "Exportar estatísticas como CSV"}
          >
            Exportar CSV (estatísticas)
          </button>
          <button
            data-testid="history-clear"
            className="text-sm text-red-600 hover:underline"
            onClick={clearHistory}
          >
            Limpar
          </button>
        </div>
      </div>

      {/* Controles de filtro e paginação */}
      <div className="flex flex-wrap gap-3 items-end mb-3">
        <label className="text-sm">
          Período
          <select
            data-testid="history-period"
            className="ml-2 border rounded px-2 py-1 text-sm"
            value={period}
            onChange={(e) => setPeriod(e.target.value as UIPeriod)}
            title="Filtrar por período"
            aria-label="Filtrar histórico por período"
          >
            <option value="today">Hoje</option>
            <option value="7d">7 dias</option>
            <option value="30d">30 dias</option>
            <option value="all">Todos</option>
          </select>
        </label>

        <label className="text-sm flex-1 min-w-[180px]">
          Buscar
          <input
            data-testid="history-query"
            className="ml-2 border rounded px-2 py-1 text-sm w-56"
            placeholder="Texto no rótulo"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            title="Busca por texto no label"
            aria-label="Buscar no histórico por texto do rótulo"
          />
        </label>

        <label className="text-sm">
          Por página
          <select
            data-testid="history-page-size"
            className="ml-2 border rounded px-2 py-1 text-sm"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value) as 5 | 10 | 25)}
            title="Itens por página"
            aria-label="Selecionar quantidade por página"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={25}>25</option>
          </select>
        </label>
      </div>

      {/* Lista filtrada + paginação */}
      {filteredPage.length === 0 ? (
        <div className="text-sm text-gray-500" role="status" aria-live="polite">
          {list.length === 0 ? "Sem resultados ainda." : "Nenhum resultado para os filtros aplicados."}
        </div>
      ) : (
        <>
          <div className="text-xs text-gray-600 mb-1">
            {totalFiltered} resultado{totalFiltered !== 1 ? "s" : ""} • Página {safePage} de {totalPages}
          </div>
          <ul className="max-h-64 overflow-auto divide-y" aria-label="Lista de resultados do histórico">
            {filteredPage.map((it, idx) => (
              <li key={`${it.timestamp}-${idx}`} className="py-2 flex items-center justify-between">
                <span className="truncate">{it.label || "(vazio)"}</span>
                <span className="text-xs text-gray-500 ml-3">{new Date(it.timestamp).toLocaleString()}</span>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-end gap-2 mt-2">
            <button
              className="text-sm px-2 py-1 border rounded disabled:opacity-50"
              onClick={() => setPage(Math.max(1, safePage - 1))}
              disabled={safePage <= 1}
              title="Página anterior"
              aria-label="Ir para página anterior"
            >
              Anterior
            </button>
            <button
              className="text-sm px-2 py-1 border rounded disabled:opacity-50"
              onClick={() => setPage(Math.min(totalPages, safePage + 1))}
              disabled={safePage >= totalPages}
              title="Próxima página"
              aria-label="Ir para próxima página"
            >
              Próxima
            </button>
          </div>
        </>
      )}

      <h3 className="font-semibold mt-4 mb-2">Contagem por item</h3>
      {stats.length === 0 ? (
        <div className="text-sm text-gray-500">Sem contagens ainda.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border" role="table" aria-label="Tabela de contagem por item">
            <thead>
              <tr className="bg-gray-50">
                <th scope="col" className="text-left px-3 py-2 border-b">Item</th>
                <th scope="col" className="text-right px-3 py-2 border-b">Contagem</th>
                <th scope="col" className="text-right px-3 py-2 border-b">%</th>
              </tr>
            </thead>
            <tbody>
              {stats.map(({ label, count, percent }) => (
                <tr key={label} className="odd:bg-white even:bg-gray-50">
                  <td className="px-3 py-2 border-b">
                    <span className="truncate inline-block max-w-[320px]" title={label || "(vazio)"}>{label || "(vazio)"}</span>
                  </td>
                  <td className="px-3 py-2 border-b text-right">{count}</td>
                  <td className="px-3 py-2 border-b text-right">{percent.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}