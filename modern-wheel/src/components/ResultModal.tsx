'use client';

import React, { useEffect } from 'react';
import { WheelResult } from '@/types';
import { X, Trophy, Clock, RotateCcw } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface ResultModalProps {
  result: WheelResult | null;
  onClose: () => void;
  onSpinAgain: () => void;
  confettiEnabled: boolean;
}

export function ResultModal({
  result,
  onClose,
  onSpinAgain,
  confettiEnabled,
}: ResultModalProps) {
  useEffect(() => {
    if (result && confettiEnabled) {
      // Trigger confetti effect
      if (typeof window !== 'undefined' && (window as any).confetti) {
        (window as any).confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
    }
  }, [result, confettiEnabled]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (result) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [result, onClose]);

  if (!result) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 animate-bounce-in">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-full">
              <Trophy className="w-6 h-6 text-yellow-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-800">Resultado!</h2>
          </div>
          <button
            onClick={onClose}
            className="btn-icon text-gray-500 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>

        {/* Result Content */}
        <div className="p-6 text-center">
          {/* Winner Display */}
          <div className="mb-6">
            <div
              className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center text-white font-bold text-lg shadow-lg"
              style={{ backgroundColor: result.item.color }}
            >
              {result.item.image ? (
                <img
                  src={result.item.image}
                  alt={result.item.text}
                  className="w-full h-full object-cover rounded-full"
                />
              ) : (
                result.item.text.charAt(0).toUpperCase()
              )}
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">
              {result.item.text}
            </h3>
            <p className="text-gray-600">foi o item sorteado!</p>
          </div>

          {/* Timestamp */}
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-6">
            <Clock size={16} />
            <span>{formatDate(result.timestamp)}</span>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onSpinAgain}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              <RotateCcw size={18} />
              Girar Novamente
            </button>
            <button
              onClick={onClose}
              className="btn-secondary flex-1"
            >
              Fechar
            </button>
          </div>
        </div>

        {/* Fun Facts */}
        <div className="px-6 pb-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-semibold text-gray-700 mb-2">Estatísticas</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Ângulo final:</span>
                <div className="font-medium">{Math.round(result.angle % 360)}°</div>
              </div>
              <div>
                <span className="text-gray-500">Voltas completas:</span>
                <div className="font-medium">{Math.floor(result.angle / 360)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}