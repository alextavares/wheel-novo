'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { Template } from '@/types';
import {
  DEFAULT_TEMPLATES,
  getTemplateCategories,
  listAllTemplates,
  searchTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  duplicateTemplate,
  toggleFavorite,
  listFavorites,
} from '@/lib/templates';
import { Search, Grid, List, Star, Users, BookOpen, Utensils, Gamepad2, X, Copy, Trash2, Edit3, Heart } from 'lucide-react';

interface TemplateManagerProps {
  onClose: () => void;
  onSelectTemplate: (template: Template) => void;
}

const categoryIcons: Record<string, React.ReactNode> = {
  'Decisão': <Star size={20} />,
  'Cores': <Grid size={20} />,
  'Números': <List size={20} />,
  'Comida': <Utensils size={20} />,
  'Lazer': <Gamepad2 size={20} />,
  'Educação': <BookOpen size={20} />,
};

export function TemplateManager({ onClose, onSelectTemplate }: TemplateManagerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);

  // Audio config states
  const [volume, setVolume] = useState(1);
  const [tickCoef, setTickCoef] = useState(0.8);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('modern-wheel:config');
      const cfg = raw ? JSON.parse(raw) : {};
      const v = typeof cfg.volume === 'number' ? cfg.volume : 1;
      const c = typeof cfg.tickVolumeCoef === 'number' ? cfg.tickVolumeCoef : 0.8;
      setVolume(Math.min(1, Math.max(0, v)));
      setTickCoef(Math.min(1.5, Math.max(0, c)));
    } catch {
      // ignore JSON errors
    }
  }, []);

  const persistAudio = (nextVol: number, nextCoef: number) => {
    try {
      const raw = localStorage.getItem('modern-wheel:config');
      const cfg = raw ? JSON.parse(raw) : {};
      cfg.volume = Math.min(1, Math.max(0, nextVol));
      cfg.tickVolumeCoef = Math.min(1.5, Math.max(0, nextCoef));
      localStorage.setItem('modern-wheel:config', JSON.stringify(cfg));
      window.dispatchEvent(new Event('modern-wheel:config-updated'));
      // also reflect globals used por áudio, se existentes
      (window as any).__MW_VOLUME__ = cfg.volume;
      (window as any).__MW_TICK_COEF__ = cfg.tickVolumeCoef;
    } catch {
      // ignore
    }
  };

  const onVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Math.min(1, Math.max(0, parseFloat(e.target.value)));
    setVolume(v);
    persistAudio(v, tickCoef);
  };

  const onTickCoefChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const c = Math.min(1.5, Math.max(0, parseFloat(e.target.value)));
    setTickCoef(c);
    persistAudio(volume, c);
  };

  const categories = getTemplateCategories();

  const allTemplates = useMemo(() => listAllTemplates(), []);
  const favoritesSet = useMemo(() => new Set(listFavorites().map(t => t.id)), []);

  const filteredTemplates = useMemo(() => {
    let base = allTemplates;
    const q = searchQuery.trim();
    if (q) {
      base = searchTemplates(q);
    }
    if (selectedCategory) {
      base = base.filter(t => t.category === selectedCategory);
    }
    if (showOnlyFavorites) {
      const favIds = new Set(listFavorites().map(t => t.id));
      base = base.filter(t => favIds.has(t.id));
    }
    return base;
  }, [allTemplates, searchQuery, selectedCategory, showOnlyFavorites]);

  const handleDuplicate = (tpl: Template) => {
    const newId = `${tpl.id}-${Math.random().toString(36).slice(2, 6)}`;
    const copy = duplicateTemplate(tpl.id, newId);
    // refresh simplistic: reload page list by forcing state changes
    setSearchQuery(prev => prev + '');
  };

  const handleDelete = (tpl: Template) => {
    if (tpl.isPublic) return; // não deletar públicos
    deleteTemplate(tpl.id);
    setSearchQuery(prev => prev + '');
  };

  const handleEdit = (tpl: Template) => {
    const newName = prompt('Novo nome para o template:', tpl.name);
    if (!newName) return;
    updateTemplate(tpl.id, { name: newName });
    setSearchQuery(prev => prev + '');
  };

  const handleFavorite = (tpl: Template) => {
    toggleFavorite(tpl.id);
    setShowOnlyFavorites(prev => prev); // mantém estado, mas força re-render
    setSearchQuery(prev => prev + '');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-800">Templates</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`btn-icon ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : ''}`}
                title="Grade"
              >
                <Grid size={18} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`btn-icon ${viewMode === 'list' ? 'bg-blue-100 text-blue-600' : ''}`}
                title="Lista"
              >
                <List size={18} />
              </button>
              <button
                onClick={onClose}
                className="btn-icon text-gray-500 hover:text-gray-700"
                title="Fechar"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Configurações de Áudio */}
          <div className="mb-6 p-4 rounded-xl border border-gray-200 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Configurações de Áudio</h3>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="mw-volume" className="text-sm text-gray-600">Volume Global</label>
                  <span className="text-xs text-gray-500">{volume.toFixed(2)}</span>
                </div>
                <input
                  id="mw-volume"
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={onVolumeChange}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                  <span>0</span><span>1</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="mw-tickcoef" className="text-sm text-gray-600">Tick Coef</label>
                  <span className="text-xs text-gray-500">{tickCoef.toFixed(2)}</span>
                </div>
                <input
                  id="mw-tickcoef"
                  type="range"
                  min={0}
                  max={1.5}
                  step={0.05}
                  value={tickCoef}
                  onChange={onTickCoefChange}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                  <span>0</span><span>1.5</span>
                </div>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-item pl-10 w-full"
            />
          </div>

          {/* Category + Favorites Filter */}
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <button
              onClick={() => setSelectedCategory('')}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                selectedCategory === ''
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Todos
            </button>
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1 rounded-full text-sm transition-colors flex items-center gap-1 ${
                  selectedCategory === category
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {categoryIcons[category]}
                {category}
              </button>
            ))}
            <button
              onClick={() => setShowOnlyFavorites(v => !v)}
              className={`ml-auto px-3 py-1 rounded-full text-sm transition-colors flex items-center gap-1 ${
                showOnlyFavorites ? 'bg-pink-100 text-pink-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title="Mostrar apenas favoritos"
            >
              <Heart size={16} /> Favoritos
            </button>
          </div>

          {/* Templates Grid/List */}
          <div className={`${viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'space-y-3'} max-h-96 overflow-y-auto`}>
            {filteredTemplates.length === 0 ? (
              <div className="col-span-full text-center py-8 text-gray-500">
                <p>Nenhum template encontrado.</p>
                <p className="text-sm">Tente ajustar sua busca ou filtros.</p>
              </div>
            ) : (
              filteredTemplates.map(template => {
                const isFav = favoritesSet.has(template.id) || listFavorites().some(t => t.id === template.id);
                return (
                  <div
                    key={template.id}
                    className={`bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow ${
                      viewMode === 'list' ? 'flex items-center gap-4' : ''
                    }`}
                  >
                    {/* Template Preview */}
                    <div className={`${viewMode === 'list' ? 'w-16 h-16' : 'w-full h-20'} mb-3 flex items-center justify-center bg-gray-50 rounded-lg overflow-hidden`}>
                      <div className="flex flex-wrap gap-1 p-2">
                        {template.items.slice(0, 6).map((item, index) => (
                          <div
                            key={index}
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: item.color }}
                            title={item.text}
                          />
                        ))}
                        {template.items.length > 6 && (
                          <div className="w-3 h-3 rounded-full bg-gray-300 flex items-center justify-center text-xs text-gray-600">
                            +
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Template Info */}
                    <div className={viewMode === 'list' ? 'flex-1' : ''}>
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-gray-800">{template.name}</h3>
                        <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">
                          {template.category}
                        </span>
                        {isFav && <span className="text-xs text-pink-600">★</span>}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{template.description}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          {template.items.length} {template.items.length === 1 ? 'item' : 'itens'}
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {template.tags.slice(0, 3).map(tag => (
                            <span
                              key={tag}
                              className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="mt-3 flex gap-2">
                        <button
                          className="btn-outline text-xs"
                          title="Usar este template"
                          onClick={() => onSelectTemplate(template)}
                        >
                          Usar
                        </button>
                        <button
                          className="btn-outline text-xs"
                          title="Duplicar"
                          onClick={() => handleDuplicate(template)}
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          className="btn-outline text-xs"
                          title="Editar nome"
                          onClick={() => handleEdit(template)}
                          disabled={template.isPublic}
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          className="btn-outline text-xs"
                          title={isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                          onClick={() => handleFavorite(template)}
                        >
                          <Heart size={14} className={isFav ? 'text-pink-600' : ''} />
                        </button>
                        <button
                          className="btn-outline text-xs text-red-600"
                          title="Excluir (apenas customizados)"
                          onClick={() => handleDelete(template)}
                          disabled={template.isPublic}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Template Stats */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>{filteredTemplates.length} templates encontrados</span>
              <span>{DEFAULT_TEMPLATES.length} templates públicos</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}