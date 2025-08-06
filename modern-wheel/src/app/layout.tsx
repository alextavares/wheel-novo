import "./globals.css";
import type { Metadata } from "next";
import { ToastProvider } from "@/components/ui/ToastProvider";
import React from "react";
import ThemeToggle from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "Modern Wheel Picker",
  description: "A modern wheel picker similar to PickerWheel.com",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="min-h-screen">
        <ToastProvider>
          {/* Header fixo semelhante ao PickerWheel */}
          <header className="fixed top-0 inset-x-0 z-40 border-b bg-white/90 dark:bg-neutral-900/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
            <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-blue-500 shadow-inner" />
                <span className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                  Modern Wheel
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Toggle de Tema (Client) com persistência + fallback por delegação */}
                <ThemeToggle />
              </div>
            </div>
          </header>

          {/* Espaço para o header fixo */}
          <div className="h-14" />

          {/* Conteúdo principal */}
          <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
            {children}
          </main>

          <footer className="border-t mt-8 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
            Modern Wheel Picker — inspirado em PickerWheel.com
          </footer>
        </ToastProvider>
        {/* Script de boot + delegação do toggle sem passar handler via props */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function() {
  try {
    const pref = localStorage.getItem('mw:theme');
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const wantDark = pref ? pref === 'dark' : mql.matches;
    if (wantDark) document.documentElement.classList.add('dark');
  } catch(e) {}

  // Delegação de evento para alternar tema sem enviar onClick via props
  try {
    window.addEventListener('click', function(ev) {
      const el = ev.target;
      if (el && el.closest && el.closest('[data-theme-toggle]')) {
        const html = document.documentElement;
        const next = !html.classList.contains('dark');
        if (next) {
          html.classList.add('dark');
          localStorage.setItem('mw:theme', 'dark');
        } else {
          html.classList.remove('dark');
          localStorage.setItem('mw:theme', 'light');
        }
      }
    }, { passive: true });
  } catch(e) {}
})();
`,
          }}
        />
      </body>
    </html>
  );
}