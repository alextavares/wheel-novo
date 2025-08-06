"use client";

import React, { useState, useRef } from 'react';
import { WheelItem } from '@/types';
import { Plus, X, Copy, GripVertical, Image, Palette } from 'lucide-react';
import { getRandomColor } from '@/lib/utils';

interface ItemManagerProps {
  items: WheelItem[];
  onAddItem: (text: string, color?: string) => void;
  onRemoveItem: (id: string) => void;
  onUpdateItem: (item: WheelItem) => void;
  onDuplicateItem: (id: string) => void;
  onReorderItems: (items: WheelItem[]) => void;
}

export default function ItemManager({
  items,
  onAddItem,
  onRemoveItem,
  onUpdateItem,
  onDuplicateItem,
  onReorderItems,
}: ItemManagerProps) {
  const [newItemText, setNewItemText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [currentUploadItemId, setCurrentUploadItemId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddItem = () => {
    if (newItemText.trim()) {
      onAddItem(newItemText.trim());
      setNewItemText('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddItem();
    }
  };

  const startEditing = (item: WheelItem) => {
    setEditingId(item.id);
    setEditingValue(item.text);
  };

  const saveEdit = () => {
    if (editingId && editingValue.trim()) {
      const item = items.find(i => i.id === editingId);
      if (item) {
        onUpdateItem({ ...item, text: editingValue.trim() });
      }
    }
    setEditingId(null);
    setEditingValue('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingValue('');
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  const changeItemColor = (item: WheelItem) => {
    const newColor = getRandomColor();
    onUpdateItem({ ...item, color: newColor });
  };

  const handleImageUpload = (file: File) => {
    if (!currentUploadItemId) return;
    
    const item = items.find(i => i.id === currentUploadItemId);
    if (!item) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageUrl = e.target?.result as string;
      onUpdateItem({ ...item, image: imageUrl });
      setCurrentUploadItemId(null);
    };
    reader.readAsDataURL(file);
  };

  const triggerImageUpload = (itemId: string) => {
    setCurrentUploadItemId(itemId);
    fileInputRef.current?.click();
  };

  return (
    <div className="card p-6 max-w-md">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">Itens da Roda</h2>
        <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
          {items.length} {items.length === 1 ? 'item' : 'itens'}
        </span>
      </div>

      {/* Add new item */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={newItemText}
          onChange={(e) => setNewItemText(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Digite um novo item..."
          className="input-item flex-1"
          maxLength={50}
        />
        <button
          onClick={handleAddItem}
          disabled={!newItemText.trim()}
          className="btn-primary p-2"
          title="Adicionar item"
        >
          <Plus size={20} />
        </button>
      </div>

      {/* Items list */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {items.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>Nenhum item adicionado ainda.</p>
            <p className="text-sm">Adicione pelo menos 2 itens para usar a roda.</p>
          </div>
        ) : (
          items.map((item, index) => (
            <div
              key={item.id}
              className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
            >
              {/* Drag handle */}
              <div className="cursor-move text-gray-400 hover:text-gray-600">
                <GripVertical size={16} />
              </div>

              {/* Color indicator */}
              <div className="relative">
                <div
                  className="w-4 h-4 rounded-full border-2 border-white shadow-sm cursor-pointer"
                  style={{ backgroundColor: item.color }}
                  onClick={() => changeItemColor(item)}
                  title="Clique para mudar a cor"
                />
                {/* Image indicator */}
                {item.image && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full border border-white" 
                       title="Item com imagem" />
                )}
              </div>

              {/* Item text */}
              <div className="flex-1 min-w-0">
                {editingId === item.id ? (
                  <input
                    type="text"
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    onKeyDown={handleEditKeyDown}
                    onBlur={saveEdit}
                    className="input-item w-full"
                    autoFocus
                    maxLength={50}
                  />
                ) : (
                  <span
                    className="block truncate cursor-pointer hover:text-blue-600"
                    onClick={() => startEditing(item)}
                    title={item.text}
                  >
                    {item.text}
                  </span>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {/* Image upload */}
                <button
                  onClick={() => triggerImageUpload(item.id)}
                  className="btn-icon text-gray-500 hover:text-blue-600"
                  title="Adicionar imagem"
                >
                  <Image size={16} />
                </button>

                {/* Color change */}
                <button
                  onClick={() => changeItemColor(item)}
                  className="btn-icon text-gray-500 hover:text-purple-600"
                  title="Mudar cor"
                >
                  <Palette size={16} />
                </button>

                {/* Duplicate */}
                <button
                  onClick={() => onDuplicateItem(item.id)}
                  className="btn-icon text-gray-500 hover:text-green-600"
                  title="Duplicar"
                >
                  <Copy size={16} />
                </button>

                {/* Remove */}
                <button
                  onClick={() => onRemoveItem(item.id)}
                  className="btn-icon text-gray-500 hover:text-red-600"
                  title="Remover"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Hidden file input */}
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        onChange={(e) => e.target.files && e.target.files[0] && handleImageUpload(e.target.files[0])}
        className="hidden"
      />
    </div>
  );
}