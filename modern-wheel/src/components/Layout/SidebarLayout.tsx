"use client";

import React, { useState, useEffect } from "react";

interface SidebarLayoutProps {
  children: React.ReactNode;
  sidebarContent: React.ReactNode;
  title?: string;
  onShare?: () => void;
  onExport?: () => void;
}

export default function SidebarLayout({
  children,
  sidebarContent,
  title = "Modern Wheel",
  onShare,
  onExport,
}: SidebarLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [collapsedDesktop, setCollapsedDesktop] = useState(false); // novo: colapso no desktop

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const toggleSidebar = () => {
    setIsSidebarOpen((v) => !v);
  };

  const toggleDesktopCollapse = () => {
    setCollapsedDesktop((v) => !v);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-900">
      {/* Header Desktop - estilo similar ao pickerwheel: topo simples, central, com título e switch menu */}
      <header className="hidden md:flex items-center justify-between px-6 py-3 border-b bg-white dark:bg-neutral-900 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleDesktopCollapse}
            className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-neutral-800"
            aria-label={collapsedDesktop ? "Expandir painel" : "Recolher painel"}
            title={collapsedDesktop ? "Expandir painel" : "Recolher painel"}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5"
                 viewBox="0 0 20 20" fill="currentColor">
              {collapsedDesktop ? (
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 111.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              ) : (
                <path fillRule="evenodd" d="M12.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 111.414 1.414L9.414 10l3.293 3.293a1 1 0 010 1.414z" clipRule="evenodd" />
              )}
            </svg>
          </button>
          <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">{title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onShare?.()}
            disabled={!onShare}
            className="px-3 py-1.5 rounded-md text-sm bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
            aria-label="Compartilhar"
          >
            Compartilhar
          </button>
          <button
            onClick={() => onExport?.()}
            disabled={!onExport}
            className="px-3 py-1.5 rounded-md text-sm border border-gray-300 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800 disabled:opacity-50"
            aria-label="Exportar"
          >
            Exportar
          </button>
        </div>
      </header>

      {/* Header Mobile */}
      {isMobile && (
        <header className="bg-white dark:bg-neutral-900 shadow-sm border-b px-4 py-3 flex items-center justify-between sticky top-0 z-40">
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{title}</h1>
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
            aria-label="Abrir menu"
          >
            {/* Simple menu icon to avoid extra deps */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </header>
      )}

      <div className="flex h-[calc(100vh-0px)] md:h-[calc(100vh-48px)]">
        {/* Sidebar */}
        <aside
          className={[
            isMobile
              ? "fixed inset-y-0 left-0 z-50 w-80 bg-white dark:bg-neutral-900 shadow-xl"
              : collapsedDesktop
                ? "relative w-[3.25rem] bg-white dark:bg-neutral-900 border-r"
                : "relative w-[22rem] xl:w-[24rem] bg-white dark:bg-neutral-900 border-r",
            isMobile && !isSidebarOpen ? "-translate-x-full" : "translate-x-0",
            "transition-all duration-300 ease-in-out flex flex-col"
          ].join(" ")}
        >
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
              {collapsedDesktop && !isMobile ? "Cfg" : "Configurações"}
            </h2>
            <div className="flex items-center gap-2">
              {!isMobile && (
                <button
                  onClick={toggleDesktopCollapse}
                  className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-neutral-800"
                  aria-label={collapsedDesktop ? "Expandir sidebar" : "Recolher sidebar"}
                  title={collapsedDesktop ? "Expandir" : "Recolher"}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5"
                       viewBox="0 0 20 20" fill="currentColor">
                    {collapsedDesktop ? (
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 111.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    ) : (
                      <path fillRule="evenodd" d="M12.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 111.414 1.414L9.414 10l3.293 3.293a1 1 0 010 1.414z" clipRule="evenodd" />
                    )}
                  </svg>
                </button>
              )}
              {isMobile && (
                <button
                  onClick={toggleSidebar}
                  className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-neutral-800"
                  aria-label="Fechar menu"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {collapsedDesktop && !isMobile ? (
              <div className="px-2 py-3 text-xs text-gray-500 dark:text-gray-400">
                Colapsado
              </div>
            ) : (
              sidebarContent
            )}
          </div>

          {!collapsedDesktop && (
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <button
                  className="flex-1 p-2 rounded-md bg-blue-500 text-white text-sm hover:bg-blue-600 transition-colors disabled:opacity-50"
                  onClick={() => onShare?.()}
                  disabled={!onShare}
                  aria-label="Compartilhar configuração"
                  title={onShare ? "Compartilhar" : "Ação indisponível"}
                >
                  Compartilhar
                </button>
                <button
                  className="flex-1 p-2 rounded-md border border-gray-300 dark:border-neutral-700 text-sm hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
                  onClick={() => onExport?.()}
                  disabled={!onExport}
                  aria-label="Exportar dados"
                  title={onExport ? "Exportar" : "Ação indisponível"}
                >
                  Exportar
                </button>
              </div>
            </div>
          )}
        </aside>

        {/* Overlay Mobile */}
        {isMobile && isSidebarOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={toggleSidebar} />
        )}

        {/* Main centralizado com a roda grande como no pickerwheel */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1100px] px-4 md:px-8 py-4 md:py-8">
            <div className="flex flex-col items-center justify-start">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}