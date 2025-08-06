export interface WheelItem {
  id: string;
  text: string;
  color: string;
  image?: string;
  weight?: number; // 1 a 100, default 1
}

export interface WheelResult {
  item: WheelItem;
  timestamp: Date;
  angle: number;
}

export interface WheelConfig {
  spinDuration: number;
  minSpins: number;
  maxSpins: number;
  soundEnabled: boolean;
  confettiEnabled: boolean;
  showResultModal: boolean;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  items: WheelItem[];
  category: string;
  tags: string[];
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WheelState {
  items: WheelItem[];
  isSpinning: boolean;
  result: WheelResult | null;
  history: WheelResult[];
  config: WheelConfig;
}

export type WheelAction =
  | { type: 'ADD_ITEM'; payload: WheelItem }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'UPDATE_ITEM'; payload: WheelItem }
  | { type: 'DUPLICATE_ITEM'; payload: string }
  | { type: 'REORDER_ITEMS'; payload: WheelItem[] }
  | { type: 'SET_SPINNING'; payload: boolean }
  | { type: 'SET_RESULT'; payload: WheelResult }
  | { type: 'CLEAR_RESULT' }
  | { type: 'UPDATE_CONFIG'; payload: Partial<WheelConfig> }
  | { type: 'LOAD_TEMPLATE'; payload: Template }
  | { type: 'RESET_WHEEL' }
  | { type: 'SET_STATE'; payload: Partial<WheelState> };

export interface SEOData {
  title: string;
  description: string;
  keywords: string[];
  ogImage?: string;
  canonicalUrl?: string;
}