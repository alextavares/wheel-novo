import { useCallback } from 'react';
import { useWheelLowLevel } from './useWheel';
import { WheelResult } from '@/types';

export function useWheel() {
  const {
    state,
    addItem: addItemBase,
    removeItem,
    updateItem: updateItemBase,
    duplicateItem: duplicateItemBase,
    reorderItems,
    setSpinning,
    setResult,
    clearResult,
    updateConfig,
    loadTemplate,
    resetWheel,
    shuffleItems,
    pickWeightedIndex,
    exportItemsCSV,
    importItemsCSV,
  } = useWheelLowLevel();

  // Simplified addItem - just text
  const addItem = useCallback((text: string) => {
    addItemBase(text);
  }, [addItemBase]);

  // Simplified updateItem - just id and text
  const updateItem = useCallback((id: string, text: string) => {
    const item = state.items.find(i => i.id === id);
    if (item) {
      updateItemBase({ ...item, text });
    }
  }, [state.items, updateItemBase]);

  // Duplicate item by id
  const duplicateItem = useCallback((id: string) => {
    duplicateItemBase(id);
  }, [duplicateItemBase]);

  // Clear all items
  const clearItems = useCallback(() => {
    reorderItems([]);
  }, [reorderItems]);

  // Spin the wheel (tolerante: 'hidden' pode não existir no tipo)
  const spin = useCallback(() => {
    if (state.items.filter(item => !(item as any).hidden).length >= 2 && !state.isSpinning) {
      setSpinning(true);
    }
  }, [state.items, state.isSpinning, setSpinning]);

  return {
    items: state.items,
    isSpinning: state.isSpinning,
    result: state.result,
    history: state.history,
    config: state.config,
    addItem,
    removeItem,
    updateItem,
    clearItems,
    duplicateItem,
    spin,
    setSpinning,
    setResult,
    updateConfig,
    loadTemplate,
    resetWheel,
    shuffleItems,
    exportItemsCSV,
    importItemsCSV,
  };
}