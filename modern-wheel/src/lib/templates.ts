import { Template } from '@/types';

const TEMPLATES_KEY = 'modern-wheel:templates';
const FAVORITES_KEY = 'modern-wheel:templates:favorites';

export const DEFAULT_TEMPLATES: Template[] = [
  {
    id: 'yes-no',
    name: 'Sim ou Não',
    description: 'Decisão simples entre sim e não',
    category: 'Decisão',
    tags: ['decisão', 'simples', 'binário'],
    isPublic: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [
      { id: '1', text: 'Sim', color: '#2ECC71' },
      { id: '2', text: 'Não', color: '#E74C3C' }
    ]
  },
  {
    id: 'colors',
    name: 'Cores Básicas',
    description: 'Roda com cores primárias e secundárias',
    category: 'Cores',
    tags: ['cores', 'arte', 'design'],
    isPublic: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [
      { id: '1', text: 'Vermelho', color: '#FF0000' },
      { id: '2', text: 'Azul', color: '#0000FF' },
      { id: '3', text: 'Amarelo', color: '#FFFF00' },
      { id: '4', text: 'Verde', color: '#00FF00' },
      { id: '5', text: 'Roxo', color: '#800080' },
      { id: '6', text: 'Laranja', color: '#FFA500' }
    ]
  },
  {
    id: 'numbers-1-10',
    name: 'Números 1-10',
    description: 'Números de 1 a 10 para sorteios',
    category: 'Números',
    tags: ['números', 'sorteio', 'matemática'],
    isPublic: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: Array.from({ length: 10 }, (_, i) => ({
      id: (i + 1).toString(),
      text: (i + 1).toString(),
      color: `hsl(${(i * 36) % 360}, 70%, 60%)`
    }))
  },
  {
    id: 'food-choices',
    name: 'Escolhas de Comida',
    description: 'Opções populares de comida para decidir o que comer',
    category: 'Comida',
    tags: ['comida', 'restaurante', 'decisão'],
    isPublic: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [
      { id: '1', text: 'Pizza', color: '#FF6B6B' },
      { id: '2', text: 'Hambúrguer', color: '#4ECDC4' },
      { id: '3', text: 'Sushi', color: '#45B7D1' },
      { id: '4', text: 'Pasta', color: '#96CEB4' },
      { id: '5', text: 'Tacos', color: '#FFEAA7' },
      { id: '6', text: 'Salada', color: '#DDA0DD' },
      { id: '7', text: 'Churrasco', color: '#F39C12' },
      { id: '8', text: 'Comida Chinesa', color: '#E74C3C' }
    ]
  },
  {
    id: 'activities',
    name: 'Atividades de Fim de Semana',
    description: 'Ideias para atividades de lazer',
    category: 'Lazer',
    tags: ['atividades', 'fim de semana', 'lazer'],
    isPublic: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [
      { id: '1', text: 'Cinema', color: '#9B59B6' },
      { id: '2', text: 'Parque', color: '#2ECC71' },
      { id: '3', text: 'Shopping', color: '#3498DB' },
      { id: '4', text: 'Praia', color: '#F1C40F' },
      { id: '5', text: 'Museu', color: '#E67E22' },
      { id: '6', text: 'Restaurante', color: '#E74C3C' },
      { id: '7', text: 'Casa de Amigos', color: '#1ABC9C' },
      { id: '8', text: 'Ficar em Casa', color: '#34495E' }
    ]
  },
  {
    id: 'study-subjects',
    name: 'Matérias de Estudo',
    description: 'Matérias escolares para organizar estudos',
    category: 'Educação',
    tags: ['estudo', 'escola', 'matérias'],
    isPublic: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [
      { id: '1', text: 'Matemática', color: '#FF6B6B' },
      { id: '2', text: 'Português', color: '#4ECDC4' },
      { id: '3', text: 'História', color: '#45B7D1' },
      { id: '4', text: 'Geografia', color: '#96CEB4' },
      { id: '5', text: 'Ciências', color: '#FFEAA7' },
      { id: '6', text: 'Inglês', color: '#DDA0DD' },
      { id: '7', text: 'Educação Física', color: '#F39C12' },
      { id: '8', text: 'Arte', color: '#E74C3C' }
    ]
  }
];

export function getTemplatesByCategory(category?: string): Template[] {
  if (!category) return DEFAULT_TEMPLATES;
  return DEFAULT_TEMPLATES.filter(template => template.category === category);
}

export function getTemplateCategories(): string[] {
  return Array.from(new Set(DEFAULT_TEMPLATES.map(template => template.category)));
}

export function searchTemplates(query: string): Template[] {
  const lowercaseQuery = query.toLowerCase();
  return DEFAULT_TEMPLATES.filter(template =>
    template.name.toLowerCase().includes(lowercaseQuery) ||
    template.description.toLowerCase().includes(lowercaseQuery) ||
    template.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery))
  );
}

/**
 * Persistência de templates do usuário (CRUD) + favoritos.
 * Mantém DEFAULT_TEMPLATES como base imutável (isPublic=true).
 * Armazena customizados em localStorage, mesclando nas leituras.
 */
function safeParse<T>(raw: string | null, fallback: T): T {
  try {
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed as T;
  } catch {
    return fallback;
  }
}

function readUserTemplates(): Template[] {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(TEMPLATES_KEY);
  // normaliza datas quando possível (mantemos string ou Date? converteremos ao uso se necessário)
  const list = safeParse<Template[]>(raw, []);
  return Array.isArray(list) ? list : [];
}

function writeUserTemplates(templates: Template[]) {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
    }
  } catch {}
}

export function listAllTemplates(): Template[] {
  // públicos primeiro, depois do usuário
  const user = readUserTemplates();
  // evita duplicar IDs públicos se usuário criar com mesmo id (preferimos o do usuário)
  const pubById = new Map(DEFAULT_TEMPLATES.map(t => [t.id, t]));
  const merged: Template[] = [...DEFAULT_TEMPLATES];
  for (const t of user) {
    const idx = merged.findIndex(x => x.id === t.id);
    if (idx >= 0) {
      merged[idx] = t; // sobrescreve público por custom (prioridade ao custom)
    } else {
      merged.push(t);
    }
  }
  return merged;
}

export function createTemplate(input: Omit<Template, 'createdAt' | 'updatedAt' | 'isPublic'> & Partial<Pick<Template, 'isPublic'>>) {
  const now = new Date();
  const tpl: Template = {
    ...input,
    isPublic: !!input.isPublic && input.isPublic === true ? true : false,
    createdAt: now,
    updatedAt: now,
  } as Template;

  // somente templates não públicos ficam no storage do usuário
  const user = readUserTemplates();
  const exists = user.find(t => t.id === tpl.id);
  if (exists) {
    // se id já existe entre custom, sobrescreve
    const next = user.map(t => (t.id === tpl.id ? tpl : t));
    writeUserTemplates(next);
  } else {
    writeUserTemplates([...user, tpl]);
  }
  return tpl;
}

export function updateTemplate(id: string, patch: Partial<Template>) {
  const user = readUserTemplates();
  const idx = user.findIndex(t => t.id === id);
  const now = new Date();
  if (idx >= 0) {
    const next = { ...user[idx], ...patch, updatedAt: now };
    user[idx] = next;
    writeUserTemplates(user);
    return next;
  }
  // se não existe entre custom mas existe entre public, criamos uma cópia custom editável
  const pub = DEFAULT_TEMPLATES.find(t => t.id === id);
  if (pub) {
    const copy = { ...pub, ...patch, isPublic: false, updatedAt: now } as Template;
    const next = [...user, copy];
    writeUserTemplates(next);
    return copy;
  }
  return null;
}

export function deleteTemplate(id: string) {
  const user = readUserTemplates();
  const next = user.filter(t => t.id !== id);
  writeUserTemplates(next);
}

export function getTemplateById(id: string): Template | undefined {
  return listAllTemplates().find(t => t.id === id);
}

export function duplicateTemplate(id: string, newId: string) {
  const base = getTemplateById(id);
  if (!base) return null;
  const now = new Date();
  const copy: Template = {
    ...base,
    id: newId,
    name: `${base.name} (cópia)`,
    isPublic: false,
    createdAt: now,
    updatedAt: now,
  };
  const user = readUserTemplates();
  writeUserTemplates([...user, copy]);
  return copy;
}

// Favoritos
function readFavorites(): string[] {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(FAVORITES_KEY);
  const ids = safeParse<string[]>(raw, []);
  return Array.isArray(ids) ? ids : [];
}

function writeFavorites(ids: string[]) {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
    }
  } catch {}
}

export function listFavorites(): Template[] {
  const ids = new Set(readFavorites());
  return listAllTemplates().filter(t => ids.has(t.id));
}

export function toggleFavorite(id: string): boolean {
  const ids = new Set(readFavorites());
  let favored: boolean;
  if (ids.has(id)) {
    ids.delete(id);
    favored = false;
  } else {
    ids.add(id);
    favored = true;
  }
  writeFavorites(Array.from(ids));
  return favored;
}