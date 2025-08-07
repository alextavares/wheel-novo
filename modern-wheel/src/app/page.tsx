"use client";

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import SimpleInputPanel from '@/components/SimpleInputPanel';
import { ResultModal } from '@/components/ResultModal';
import { useWheel } from '@/hooks/useWheel';
import { WheelResult } from '@/types';
import { Settings, Moon, Sun } from 'lucide-react';

const WheelComponent = dynamic(() => import('@/components/WheelComponent'), {
  ssr: false
});

export default function CleanHomePage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return <CleanHomePageContent />;
}

function CleanHomePageContent() {
  const {
    items,
    isSpinning,
    history,
    config,
    isHydrated,
    addItem,
    removeItem,
    updateItem,
    clearItems,
    duplicateItem,
    spin,
    updateConfig
  } = useWheel();

  const [showResult, setShowResult] = useState(false);
  const [currentResult, setCurrentResult] = useState<WheelResult | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check for dark mode preference
    const darkMode = localStorage.getItem('theme') === 'dark';
    setIsDark(darkMode);
    if (darkMode) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  const handleSpin = () => {
    // itens em memória vêm do hook e podem não ter a prop 'hidden' no tipo WheelItem.
    // Considera hidden === false por padrão quando ausente.
    if (items.filter(item => !(item as any).hidden).length >= 2) {
      spin();
    }
  };

  const handleResult = (result: WheelResult) => {
    setCurrentResult(result);
    setShowResult(true);
  };

  const toggleTheme = () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    localStorage.setItem('theme', newTheme ? 'dark' : 'light');
    if (newTheme) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // visibilidade tolerante: trata 'hidden' ausente como false
  const visibleItems = items.filter(item => !(item as any).hidden);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-xl">W</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Wheel Picker
              </h1>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Settings"
              >
                <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <button
                onClick={toggleTheme}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Toggle theme"
              >
                {isDark ? (
                  <Sun className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                ) : (
                  <Moon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <p className="text-gray-600 dark:text-gray-400">
            Spin the wheel to make random decisions
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Wheel Column - Takes 2/3 on large screens */}
          <div className="lg:col-span-2 flex justify-center">
            <WheelComponent
              items={visibleItems}
              isSpinning={isSpinning}
              onSpin={handleSpin}
              onResult={handleResult}
              config={config}
            />
          </div>

          {/* Input Panel Column - Takes 1/3 on large screens */}
          <div className="lg:col-span-1">
            <SimpleInputPanel
              items={visibleItems}
              onAddItem={addItem}
              onRemoveItem={removeItem}
              onUpdateItem={updateItem}
              onClearAll={clearItems}
              onDuplicateItem={duplicateItem}
            />

            {/* Settings Panel (when visible) */}
            {showSettings && (
              <div className="mt-4 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                  Settings
                </h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-gray-600 dark:text-gray-400">
                      Spin Duration
                    </label>
                    <select
                      value={config.spinDuration}
                      onChange={(e) => updateConfig({ spinDuration: Number(e.target.value) })}
                      className="px-3 py-1 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                    >
                      <option value="2000">2s</option>
                      <option value="3000">3s</option>
                      <option value="4000">4s</option>
                      <option value="5000">5s</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="text-sm text-gray-600 dark:text-gray-400">
                      Sound Effects
                    </label>
                    <button
                      onClick={() => updateConfig({ soundEnabled: !config.soundEnabled })}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        config.soundEnabled 
                          ? 'bg-emerald-500' 
                          : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                        config.soundEnabled ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="text-sm text-gray-600 dark:text-gray-400">
                      Confetti
                    </label>
                    <button
                      onClick={() => updateConfig({ confettiEnabled: !config.confettiEnabled })}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        config.confettiEnabled 
                          ? 'bg-emerald-500' 
                          : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                        config.confettiEnabled ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Recent Results */}
            {history.length > 0 && (
              <div className="mt-4 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">
                  Recent Results
                </h3>
                <div className="space-y-2">
                  {history.slice(0, 5).map((result, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-gray-600 dark:text-gray-400">
                        {result.item?.text || 'Unknown'}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {new Date(result.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
      
            {/* Result Modal inline removed to avoid duplication */}
          </div>
        </div>
      </main>
      
      {/* Single Result Modal (type-safe props) */}
      {showResult && currentResult && (
        <ResultModal
          result={currentResult}
          onClose={() => setShowResult(false)}
          onSpinAgain={() => {
            setShowResult(false);
            handleSpin();
          }}
          confettiEnabled={config.confettiEnabled}
        />
      )}
    </div>
  );
}