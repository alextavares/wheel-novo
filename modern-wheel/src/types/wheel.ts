export interface WheelItem { id: string; label: string; hidden: boolean; weight: number; imageUrl?: string }
export interface WheelConfigLite { soundEnabled: boolean; confettiEnabled: boolean; spinDuration: number }
export type ImportFormat = "lines" | "csv"