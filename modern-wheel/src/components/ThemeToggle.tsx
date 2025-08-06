"use client";

import React, { useEffect, useState } from "react";

/**
 * ThemeToggle (Client)
 * - Persiste preferência em localStorage (mw:theme: 'light' | 'dark')
 * - Sincroniza com html.dark imediatamente em client
 * - Observa alterações externas (ex.: delegação do layout) e reflete no estado local
 * - Fallback seguro caso localStorage não esteja disponível
 */
export default function ThemeToggle() {
  const [isDark, setIsDark] = useState<boolean>(false);

  // boot: ler preferência e aplicar
  useEffect(() => {
    try {
      const pref = localStorage.getItem("mw:theme");
      const mql = window.matchMedia("(prefers-color-scheme: dark)");
      const wantDark = pref ? pref === "dark" : mql.matches;
      setIsDark(wantDark);
      const html = document.documentElement;
      if (wantDark) html.classList.add("dark");
      else html.classList.remove("dark");
    } catch {
      // fallback: não faz nada
    }
  }, []);

  // observar mudanças externas (e.g., delegação por script no layout)
  useEffect(() => {
    const handler = () => {
      try {
        const htmlHasDark = document.documentElement.classList.contains("dark");
        setIsDark(htmlHasDark);
      } catch {}
    };
    // observar evento de clique global em data-theme-toggle também reflete aqui
    window.addEventListener("click", (ev) => {
      const target = ev.target as HTMLElement | null;
      if (target && (target as any).closest && (target as any).closest("[data-theme-toggle]")) {
        handler();
      }
    });
    // observar mutação na classe do html
    const obs = new MutationObserver(handler);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => {
      obs.disconnect();
    };
  }, []);

  const toggle = () => {
    try {
      const html = document.documentElement;
      const next = !isDark;
      if (next) {
        html.classList.add("dark");
        localStorage.setItem("mw:theme", "dark");
      } else {
        html.classList.remove("dark");
        localStorage.setItem("mw:theme", "light");
      }
      setIsDark(next);
    } catch {
      // fallback silencioso
      setIsDark((v) => !v);
    }
  };

  return (
    <button
      type="button"
      aria-label="Alternar tema"
      title="Alternar tema"
      className="px-3 py-1.5 rounded-md border border-gray-200 dark:border-neutral-700 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-neutral-800 transition cursor-pointer select-none inline-flex items-center gap-2"
      onClick={toggle}
    >
      {/* ícone simples sol/lua para evitar deps */}
      <span aria-hidden className="inline-block">
        {isDark ? "🌙" : "☀️"}
      </span>
      <span className="hidden sm:inline">{isDark ? "Escuro" : "Claro"}</span>
    </button>
  );
}