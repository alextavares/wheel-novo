"use client";

import React, { useState, KeyboardEvent, useRef } from 'react';
import { Plus, X, Copy, GripVertical, Trash2, Download, Upload, Image } from 'lucide-react';

interface SimpleInputPanelProps {
  items: Array<{ id: string; text: string; image?: string }>;
  onAddItem: (text: string, image?: string) => void;
  onRemoveItem: (id: string) => void;
  onUpdateItem: (id: string, text: string, image?: string) => void;
  onClearAll: () => void;
  onDuplicateItem: (id: string) => void;
  onImportCSV?: (text: string) => void;
  onUpdateItemImage?: (id: string, image: string) => void;
}

export default function SimpleInputPanel({
  items,
  onAddItem,
  onRemoveItem,
  onUpdateItem,
  onClearAll,
  onDuplicateItem,
  onImportCSV
}: SimpleInputPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showBulkInput, setShowBulkInput] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  const handleAdd = () => {
    if (inputValue.trim()) {
      onAddItem(inputValue.trim());
      setInputValue('');
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleAdd();
    }
  };

  const handleEdit = (id: string, text: string) => {
    setEditingId(id);
    setEditValue(text);
  };

  const handleSaveEdit = (id: string) => {
    if (editValue.trim()) {
      onUpdateItem(id, editValue.trim());
    }
    setEditingId(null);
    setEditValue('');
  };

  const handleBulkAdd = () => {
    const lines = bulkText.split('\n').filter(line => line.trim());
    lines.forEach(line => onAddItem(line.trim()));
    setBulkText('');
    setShowBulkInput(false);
  };

  const handleImageUpload = (itemId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageData = e.target?.result as string;
        const item = items.find(i => i.id === itemId);
        if (item && onUpdateItem) {
          onUpdateItem(itemId, item.text, imageData);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerImageUpload = (itemId: string) => {
    fileInputRefs.current[itemId]?.click();
  };

  const handleExport = () => {
    const csv = items.map(item => item.text).join('\n');
    const blob = new Blob([csv], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'wheel-items.txt';
    a.click();
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">INPUTS</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setShowBulkInput(!showBulkInput)}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            title="Bulk input"
          >
            <Upload className="w-4 h-4 text-gray-600" />
          </button>
          <button
            onClick={handleExport}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            title="Export items"
          >
            <Download className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Input Field */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Input text here..."
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        />
        <button
          onClick={handleAdd}
          className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors flex items-center gap-1"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Bulk Input */}
      {showBulkInput && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder="Enter multiple items (one per line)"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            rows={4}
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleBulkAdd}
              className="px-3 py-1.5 bg-emerald-500 text-white text-sm rounded-lg hover:bg-emerald-600 transition-colors"
            >
              Add All
            </button>
            <button
              onClick={() => {
                setShowBulkInput(false);
                setBulkText('');
              }}
              className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Items List */}
      <div className="space-y-1 max-h-96 overflow-y-auto">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="group flex items-center gap-2 p-2 hover:bg-gray-50 rounded-lg transition-colors"
          >
            <GripVertical className="w-4 h-4 text-gray-400 cursor-move opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className="text-gray-500 text-sm w-6">{index + 1}</span>
            
            {/* Image thumbnail */}
            {item.image && (
              <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0">
                <img
                  src={item.image}
                  alt={item.text}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {editingId === item.id ? (
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => handleSaveEdit(item.id)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveEdit(item.id);
                  }
                }}
                className="flex-1 px-2 py-1 border border-emerald-500 rounded focus:outline-none"
                autoFocus
              />
            ) : (
              <span
                onClick={() => handleEdit(item.id, item.text)}
                className="flex-1 cursor-pointer hover:text-emerald-600 transition-colors"
              >
                {item.text}
              </span>
            )}

            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {/* Image upload button */}
              <button
                onClick={() => triggerImageUpload(item.id)}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
                title="Add image"
              >
                <Image className="w-3.5 h-3.5 text-gray-600" />
              </button>
              <input
                ref={(el) => (fileInputRefs.current[item.id] = el)}
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(item.id, e)}
                className="hidden"
              />
              
              <button
                onClick={() => onDuplicateItem(item.id)}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
                title="Duplicate"
              >
                <Copy className="w-3.5 h-3.5 text-gray-600" />
              </button>
              <button
                onClick={() => onRemoveItem(item.id)}
                className="p-1 hover:bg-red-100 rounded transition-colors"
                title="Delete"
              >
                <X className="w-3.5 h-3.5 text-red-500" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Footer Actions */}
      {items.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between">
          <span className="text-sm text-gray-500">{items.length} items</span>
          <button
            onClick={onClearAll}
            className="text-sm text-red-500 hover:text-red-600 transition-colors flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear All
          </button>
        </div>
      )}
    </div>
  );
}