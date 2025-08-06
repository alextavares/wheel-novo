import { useReducer, useCallback, useEffect, useMemo, useState } from 'react';
import { WheelState, WheelAction, WheelItem, WheelResult, WheelConfig } from '@/types';
import { createWheelItem, generateId, shuffleArray, weightedPickIndex, importCSV, downloadCSV } from '@/lib/utils';
import {
  getItemsV2,
  setItemsV2,
  getConfig as storageGetConfig,
  setConfig as storageSetConfig,
  getHistory as storageGetHistory,
  setHistory as storageSetHistory,
  dispatchUpdate,
  runMigrations,
} from '@/lib/storage';

// Extensão mínima da config para paridade planejada
type WheelMode = 'normal' | 'elimination';

const initialConfig: WheelConfig & {
  mode?: WheelMode;
  easing?: 'linear' | 'easeOutCubic' | 'easeOutQuart';
} = {
  spinDuration: 4000,
  minSpins: 3,
  maxSpins: 6,
  soundEnabled: true,
  confettiEnabled: true,
  showResultModal: true,
  mode: 'normal',
  easing: 'easeOutCubic',
};

const initialState: WheelState = {
  items: [
    createWheelItem('Opção 1', '#FF6B6B'),
    createWheelItem('Opção 2', '#4ECDC4'),
    createWheelItem('Opção 3', '#45B7D1'),
    createWheelItem('Opção 4', '#96CEB4'),
  ],
  isSpinning: false,
  result: null,
  history: [],
  config: initialConfig,
};

function wheelReducer(state: WheelState, action: WheelAction): WheelState {
  switch (action.type) {
    case 'ADD_ITEM':
      return {
        ...state,
        items: [...state.items, action.payload],
      };

    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter(item => item.id !== action.payload),
      };

    case 'UPDATE_ITEM':
      return {
        ...state,
        items: state.items.map(item =>
          item.id === action.payload.id ? action.payload : item
        ),
      };

    case 'DUPLICATE_ITEM': {
      const itemToDuplicate = state.items.find(item => item.id === action.payload);
      if (!itemToDuplicate) return state;
      const duplicatedItem: WheelItem = {
        ...itemToDuplicate,
        id: generateId(),
        text: `${itemToDuplicate.text} (cópia)`,
      };
      return {
        ...state,
        items: [...state.items, duplicatedItem],
      };
    }

    case 'REORDER_ITEMS':
      return {
        ...state,
        items: action.payload,
      };

    case 'SET_SPINNING':
      return {
        ...state,
        isSpinning: action.payload,
      };

    case 'SET_RESULT': {
      const nextHistory = [action.payload, ...state.history.slice(0, 49)];
      let nextItems = state.items;

      // Suporte ao modo elimination: remove item vencedor da lista
      if ((state.config as any).mode === 'elimination' && action.payload?.item?.id) {
        nextItems = state.items.filter(it => it.id !== action.payload.item.id);
      }

      return {
        ...state,
        result: action.payload,
        history: nextHistory,
        isSpinning: false,
        items: nextItems,
      };
    }

    case 'CLEAR_RESULT':
      return {
        ...state,
        result: null,
      };

    case 'UPDATE_CONFIG':
      return {
        ...state,
        config: { ...state.config, ...action.payload },
      };

    case 'LOAD_TEMPLATE':
      return {
        ...state,
        items: action.payload.items.map((item: WheelItem) => ({ ...item, id: generateId() })),
        result: null,
      };

    case 'RESET_WHEEL':
      return {
        ...initialState,
        config: state.config,
      };

    case 'SET_STATE':
      return {
        ...state,
        items: action.payload.items ?? state.items,
        config: action.payload.config ?? state.config,
        history: action.payload.history ?? state.history,
        result: null,
      };

    default:
      return state;
  }
}

// Lazy initializer: leitura segura do localStorage e migração de dados
function initWheelState(): WheelState {
  try {
    if (typeof window === 'undefined') return initialState;

    // Garante migrações básicas do storage central
    try { runMigrations(); } catch {}

    // Carrega config do storage central
    const cfg = storageGetConfig<any>({}) || {};
    const normEasing = (cfg.easing === 'linear' || cfg.easing === 'easeOutCubic' || cfg.easing === 'easeOutQuart') ? cfg.easing : 'easeOutCubic';
    const mergedConfig: WheelConfig & { mode?: WheelMode; easing?: 'linear' | 'easeOutCubic' | 'easeOutQuart' } = {
      ...initialConfig,
      ...cfg,
      easing: normEasing,
    };

    // Constrói itens visíveis a partir de items:v2
    const v2 = getItemsV2();
    const items: WheelItem[] = (v2 || [])
      .filter(i => !i.hidden && String(i.label || '').trim().length > 0)
      .map(i => ({
        id: i.id || generateId(),
        text: String(i.label || ''),
        color: '#4ECDC4',
        weight: Number.isFinite(i.weight) ? Math.max(1, Math.min(100, i.weight as number)) : 1,
      }));

    // Histórico centralizado
    const history = Array.isArray(storageGetHistory()) ? (storageGetHistory() as any) : [];

    return {
      items: items.length > 0 ? items : initialState.items,
      config: mergedConfig,
      history,
      isSpinning: false,
      result: null,
    };
  } catch {
    // fallback
  }
  return initialState;
}

export function useWheelLowLevel() {
  const [state, dispatch] = useReducer(wheelReducer, undefined as unknown as WheelState, initWheelState);
  const [isHydrated, setIsHydrated] = useState(false);

  // Mark as hydrated after initial mount
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Persist state (items, config, history)
  // Persistência centralizada e notificação
  useEffect(() => {
    try {
      // Persistir config
      storageSetConfig(state.config as any, false);
      dispatchUpdate('modern-wheel:config-updated');
    } catch {}

    try {
      // Persistir itens visíveis no items:v2 mantendo pesos (padrão 1 se ausente)
      const currentV2 = getItemsV2();
      const itemsMap = new Map((currentV2 || []).map(i => [i.id, i]));
      const nextV2 = state.items.map(it => {
        const prev = itemsMap.get(it.id);
        return {
          id: it.id,
          label: it.text,
          hidden: false,
          weight: Math.max(1, Number.isFinite(prev?.weight) ? (prev!.weight as number) : (it as any).weight ?? 1),
        };
      });
      setItemsV2(nextV2, false);
      dispatchUpdate('modern-wheel:items-updated');
    } catch {}

    try {
      // Persistir histórico
      storageSetHistory(state.history as any, false);
      dispatchUpdate('modern-wheel:history-updated');
    } catch {}
  }, [state.items, state.config, state.history]);

  // Itens válidos para sorteio (filtro futuro para hidden se adotarmos o campo)
  const activeItems = useMemo(() => {
    return state.items.filter(i => (i.text ?? '').trim().length > 0 && (i.weight ?? 1) >= 1);
  }, [state.items]);

  // API de manipulação
  const addItem = useCallback((text: string, color?: string, image?: string) => {
    if (text.trim()) {
      const newItem = createWheelItem(text, color);
      if (image) {
        (newItem as any).image = image;
      }
      dispatch({ type: 'ADD_ITEM', payload: newItem });
    }
  }, []);

  const removeItem = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_ITEM', payload: id });
  }, []);

  const updateItem = useCallback((item: WheelItem) => {
    // normalizar weight mínimo
    const normalized: WheelItem = { ...item, weight: Math.max(1, Math.min(100, item.weight ?? 1)) };
    dispatch({ type: 'UPDATE_ITEM', payload: normalized });
  }, []);

  const duplicateItem = useCallback((id: string) => {
    dispatch({ type: 'DUPLICATE_ITEM', payload: id });
  }, []);

  const reorderItems = useCallback((items: WheelItem[]) => {
    dispatch({ type: 'REORDER_ITEMS', payload: items });
  }, []);

  const setSpinning = useCallback((spinning: boolean) => {
    dispatch({ type: 'SET_SPINNING', payload: spinning });
  }, []);

  const setResult = useCallback((result: WheelResult) => {
    dispatch({ type: 'SET_RESULT', payload: result });
  }, []);

  const clearResult = useCallback(() => {
    dispatch({ type: 'CLEAR_RESULT' });
  }, []);

  const updateConfig = useCallback((config: Partial<WheelConfig & { mode?: WheelMode; easing?: 'linear' | 'easeOutCubic' | 'easeOutQuart'; }>) => {
    dispatch({ type: 'UPDATE_CONFIG', payload: config as Partial<WheelConfig> });
  }, []);

  const loadTemplate = useCallback((template: any) => {
    dispatch({ type: 'LOAD_TEMPLATE', payload: template });
  }, []);

  const resetWheel = useCallback(() => {
    dispatch({ type: 'RESET_WHEEL' });
  }, []);

  const shuffleItems = useCallback(() => {
    const shuffled = shuffleArray(state.items);
    dispatch({ type: 'REORDER_ITEMS', payload: shuffled });
  }, [state.items]);

  // Seleção ponderada baseada na lista ativa (não oculta)
  const pickWeightedIndex = useCallback(() => {
    if (activeItems.length === 0) return -1;
    // Mapear índice relativo (active) para índice absoluto (state.items)
    const tempIndex = weightedPickIndex(activeItems);
    const picked = activeItems[tempIndex];
    const absoluteIndex = state.items.findIndex(i => i.id === picked.id);
    return absoluteIndex >= 0 ? absoluteIndex : tempIndex;
  }, [activeItems, state.items]);

  const exportItemsCSV = useCallback(() => {
    downloadCSV(state.items);
  }, [state.items]);

  const importItemsCSV = useCallback((text: string) => {
    const items = importCSV(text);
    if (items.length > 0) dispatch({ type: 'REORDER_ITEMS', payload: items });
  }, []);

  return {
    state: {
      ...state,
      results: state.history,
    },
    isHydrated,
    addItem,
    removeItem,
    updateItem,
    duplicateItem,
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
  };
}

// Export simplified version for backward compatibility
export function useWheel() {
  const wheelData = useWheelLowLevel();
  
  // Simplified API
  const addItem = useCallback((text: string, image?: string) => {
    wheelData.addItem(text, undefined, image);
  }, [wheelData]);

  const updateItem = useCallback((id: string, text: string, image?: string) => {
    const item = wheelData.state.items.find(i => i.id === id);
    if (item) {
      wheelData.updateItem({ ...item, text, image });
    }
  }, [wheelData.state.items, wheelData]);

  const clearItems = useCallback(() => {
    wheelData.reorderItems([]);
  }, [wheelData]);

  const spin = useCallback(() => {
    if (wheelData.state.items.filter(item => !(item as any).hidden).length >= 2 && !wheelData.state.isSpinning) {
      wheelData.setSpinning(true);
    }
  }, [wheelData.state.items, wheelData.state.isSpinning, wheelData]);

  return {
    items: wheelData.state.items,
    isSpinning: wheelData.state.isSpinning,
    result: wheelData.state.result,
    history: wheelData.state.history,
    config: wheelData.state.config,
    isHydrated: wheelData.isHydrated,
    addItem,
    removeItem: wheelData.removeItem,
    updateItem,
    clearItems,
    duplicateItem: wheelData.duplicateItem,
    spin,
    setSpinning: wheelData.setSpinning,
    setResult: wheelData.setResult,
    updateConfig: wheelData.updateConfig,
    loadTemplate: wheelData.loadTemplate,
    resetWheel: wheelData.resetWheel,
    shuffleItems: wheelData.shuffleItems,
    exportItemsCSV: wheelData.exportItemsCSV,
    importItemsCSV: wheelData.importItemsCSV,
  };
}