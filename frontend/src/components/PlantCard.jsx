import React, { useState } from 'react';
import { Pencil, Trash, MapPin, Leaf, Check, X } from 'lucide-react';

const PlantCard = ({ plant, onOpenDetail, onInlineSave, onDelete }) => {
  const [editingField, setEditingField] = useState(null);
  const [editValues, setEditValues] = useState({
    name: plant?.name || '',
    location: plant?.location || '',
    description: plant?.description || ''
  });

  const pid = plant?.id; // usa id normalizzato

  const handleEditStart = (field, e) => {
    e.stopPropagation();
    setEditingField(field);
  };

  const handleEditCancel = (e) => {
    e.stopPropagation();
    setEditingField(null);
    setEditValues({
      name: plant?.name || '',
      location: plant?.location || '',
      description: plant?.description || ''
    });
  };

  const handleEditSave = async (field, e) => {
    e.stopPropagation();
    if (!pid) return; // guard
    try {
      await onInlineSave(pid, { [field]: editValues[field] });
      setEditingField(null);
    } catch (error) {
      console.error('Errore nel salvataggio:', error);
    }
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    if (!pid) return;
    if (window.confirm(`Sei sicuro di voler eliminare "${plant?.name || 'questa pianta'}"?`)) {
      onDelete(pid);
    }
  };

  const handleCardClick = () => {
    if (pid) onOpenDetail?.(plant);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Non disponibile';
    return new Date(dateString).toLocaleDateString('it-IT');
  };

  return (
    <div
      className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group"
      onClick={handleCardClick}
    >
      {/* Immagine */}
      <div className="relative h-48 bg-gradient-to-br from-green-100 to-green-200 rounded-t-xl overflow-hidden">
        {plant?.imageUrl ? (
          <img
            src={plant.imageUrl}
            alt={plant.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Leaf className="h-16 w-16 text-green-600 opacity-50" />
          </div>
        )}

        {/* Azioni overlay */}
        <div className="absolute top-3 right-3 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => handleEditStart('name', e)}
            className="bg-white bg-opacity-90 p-2 rounded-full hover:bg-opacity-100 transition-colors"
            title="Modifica"
          >
            <Pencil className="h-4 w-4 text-gray-600" />
          </button>
          <button
            onClick={handleDelete}
            className="bg-white bg-opacity-90 p-2 rounded-full hover:bg-opacity-100 transition-colors"
            title="Elimina"
          >
            <Trash className="h-4 w-4 text-red-600" />
          </button>
        </div>
      </div>

      {/* Contenuto */}
      <div className="p-6">
        
        {/* Nome (inline edit) */}
        <div className="mb-3">
          {editingField === 'name' ? (
            <div
              className="flex items-center gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="text"
                value={editValues.name}
                onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                className="min-w-0 flex-1 text-xl font-bold text-gray-900 border-b-2 border-green-500 focus:outline-none bg-transparent"
                autoFocus
              />
              <button
                onClick={(e) => handleEditSave('name', e)}
                className="shrink-0 text-green-600 hover:text-green-700"
                title="Salva"
              >
                <Check className="h-5 w-5" />
              </button>
              <button
                onClick={handleEditCancel}
                className="shrink-0 text-red-600 hover:text-red-700"
                title="Annulla"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <h3 className="text-xl font-bold text-gray-900 group-hover:text-green-700 transition-colors">
              {plant?.name}
            </h3>
          )}
        </div>

        {/* Specie & Terreno */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
             <p className="text-gray-600 italic">{plant?.species}</p>
             
             {/* 🟢 NUOVO: Mostra il terreno invece della fase */}
             {plant?.soil && (
                 <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full border border-amber-200">
                    {plant.soil}
                 </span>
             )}
        </div>

       {/* Location (inline edit) */}
        <div className="mb-3">
          {editingField === 'location' ? (
            <div
              className="flex items-center gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <MapPin className="h-4 w-4 text-gray-500 shrink-0" />
              <input
                type="text"
                value={editValues.location}
                onChange={(e) => setEditValues({ ...editValues, location: e.target.value })}
                className="min-w-0 flex-1 text-sm text-gray-600 border-b border-green-500 focus:outline-none bg-transparent"
                placeholder="Aggiungi posizione..."
                autoFocus
              />
              <button
                onClick={(e) => handleEditSave('location', e)}
                className="shrink-0 text-green-600 hover:text-green-700"
                title="Salva"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={handleEditCancel}
                className="shrink-0 text-red-600 hover:text-red-700"
                title="Annulla"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div
              className="flex items-center gap-2 cursor-pointer hover:text-green-600 transition-colors"
              onClick={(e) => handleEditStart('location', e)}
            >
              <MapPin className="h-4 w-4 text-gray-500 shrink-0" />
              <span className="truncate text-sm text-gray-600">
                {plant?.location || 'Aggiungi posizione...'}
              </span>
            </div>
          )}
        </div>

        {/* Descrizione (inline edit) */}
        <div className="mb-4">
          {editingField === 'description' ? (
            <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start gap-2">
                <textarea
                  value={editValues.description}
                  onChange={(e) => setEditValues({ ...editValues, description: e.target.value })}
                  className="min-w-0 flex-1 text-sm text-gray-600 border border-green-500 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                  placeholder="Aggiungi descrizione..."
                  rows="2"
                  autoFocus
                />
                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    onClick={(e) => handleEditSave('description', e)}
                    className="text-green-600 hover:text-green-700"
                    title="Salva"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleEditCancel}
                    className="text-red-600 hover:text-red-700"
                    title="Annulla"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <p
              className="text-sm text-gray-600 cursor-pointer hover:text-green-600 transition-colors line-clamp-2"
              onClick={(e) => handleEditStart('description', e)}
            >
              {plant?.description || 'Aggiungi descrizione...'}
            </p>
          )}
        </div>

        {/* Footer: Data creazione */}
        <div className="space-y-2 text-xs text-gray-500 border-t border-gray-100 pt-3">
          <div className="flex justify-between">
            <span>Creata il:</span>
            <span>{formatDate(plant?.createdAt)}</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default PlantCard;