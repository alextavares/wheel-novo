import { WheelItem } from '@/types';

export function calculateAngle(items: WheelItem[], winnerIndex: number): number {
  const segmentAngle = 360 / items.length;
  const targetAngle = winnerIndex * segmentAngle + segmentAngle / 2;
  return 360 - targetAngle;
}

export function getWinnerIndex(items: WheelItem[], angle: number): number {
  const segmentAngle = 360 / items.length;
  const normalizedAngle = ((angle % 360) + 360) % 360;
  const index = Math.floor(normalizedAngle / segmentAngle);
  return index < items.length ? index : 0;
}

export function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

export function getRandomColor(): string {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
    '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D7BDE2'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

export function cn(...inputs: any[]): string {
  return inputs.filter(Boolean).join(' ');
}

export function createWheelItem(text: string, color?: string): WheelItem {
  return {
    id: generateId(),
    text: text.trim(),
    color: color || getRandomColor(),
    weight: 1,
  };
}

export function validateWheelItems(items: WheelItem[]): boolean {
  return items.length >= 2 && items.every(item => item.text.trim().length > 0);
}

export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

export function downloadAsJSON(data: any, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function generateShareUrl(items: WheelItem[]): string {
  const encodedItems = btoa(JSON.stringify(items.map(item => ({
    text: item.text,
    color: item.color,
    weight: item.weight ?? 1,
    image: item.image ?? undefined
  }))));
  return `${window.location.origin}?items=${encodedItems}`;
}

export function parseSharedItems(encodedItems: string): WheelItem[] | null {
  try {
    const decoded = atob(encodedItems);
    const parsed = JSON.parse(decoded);
    return parsed.map((item: any) => ({
      ...createWheelItem(item.text, item.color),
      weight: typeof item.weight === 'number' ? item.weight : 1,
      image: item.image || undefined,
    }));
  } catch {
    return null;
  }
}

export function weightedPickIndex(items: WheelItem[]): number {
  const weights = items.map(i => Math.max(0, Math.min(100, i.weight ?? 1)));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return Math.floor(Math.random() * items.length);
  const r = Math.random() * total;
  let acc = 0;
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i];
    if (r < acc) return i;
  }
  return items.length - 1;
}

export function exportCSV(items: WheelItem[]): string {
  const header = 'text,color,weight\n';
  const rows = items.map(i => `${escapeCsv(i.text)},${i.color},${i.weight ?? 1}`).join('\n');
  return header + rows;
}

export function downloadCSV(items: WheelItem[], filename = 'wheel-items.csv') {
  const csv = exportCSV(items);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function importCSV(text: string): WheelItem[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];
  const hasHeader = /^text\s*,\s*color\s*,\s*weight/i.test(lines[0]);
  const dataLines = hasHeader ? lines.slice(1) : lines;
  return dataLines.map(line => {
    const [text, color, weightStr] = splitCsv(line);
    const item = createWheelItem(text || 'Item', color || undefined);
    const w = parseInt(weightStr || '1', 10);
    item.weight = Number.isFinite(w) ? Math.max(1, Math.min(100, w)) : 1;
    return item;
  });
}

function escapeCsv(v: string): string {
  if (/[",\n]/.test(v)) return '"' + v.replace(/"/g, '""') + '"';
  return v;
}

function splitCsv(line: string): [string, string, string] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { current += '"'; i++; }
        else { inQuotes = false; }
      } else current += ch;
    } else {
      if (ch === ',') { result.push(current); current = ''; }
      else if (ch === '"') { inQuotes = true; }
      else current += ch;
    }
  }
  result.push(current);
  while (result.length < 3) result.push('');
  return [result[0].trim(), result[1].trim(), result[2].trim()] as [string,string,string];
}