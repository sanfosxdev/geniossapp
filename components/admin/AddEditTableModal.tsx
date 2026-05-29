

import React, { useState, useEffect } from 'react';
import type { Table } from '../../types';
import { CloseIcon } from '../icons/CloseIcon';

interface AddEditTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (table: Omit<Table, 'id'> & { id?: string }) => void;
  tableToEdit?: Table | null;
}

const AddEditTableModal: React.FC<AddEditTableModalProps> = ({ isOpen, onClose, onSave, tableToEdit }) => {
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState(2);
  const [allowsReservations, setAllowsReservations] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isEditing = !!tableToEdit;

  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (tableToEdit) {
        setName(tableToEdit.name);
        setCapacity(tableToEdit.capacity);
        setAllowsReservations(tableToEdit.allowsReservations);
      } else {
        setName('');
        setCapacity(2);
        setAllowsReservations(true);
      }
    }
  }, [isOpen, tableToEdit]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!name.trim()) {
      setError('El nombre de la mesa es obligatorio.');
      return;
    }
    if (capacity < 1) {
      setError('La capacidad debe ser mayor a 0.');
      return;
    }
    
    onSave({
      id: tableToEdit?.id,
      name,
      capacity,
      allowsReservations,
      overrideStatus: tableToEdit?.overrideStatus ?? null,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg transform animate-slide-in-up transition-all">
        <header className="flex justify-between items-center p-5 border-b dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{isEditing ? 'Editar Mesa' : 'Agregar Nueva Mesa'}</h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors">
            <CloseIcon className="w-6 h-6" />
          </button>
        </header>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre</label>
              <input 
                id="name" 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white transition-shadow" 
                placeholder="Ej: Mesa 1, Barra, Exterior 2"
                required 
              />
            </div>
            <div>
              <label htmlFor="capacity" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Capacidad (Personas)</label>
              <input 
                id="capacity" 
                type="number" 
                value={capacity} 
                onChange={(e) => setCapacity(Number(e.target.value))} 
                min="1" 
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white transition-shadow" 
                required 
              />
            </div>
            <div className="flex items-center">
                <input
                    id="allowsReservations"
                    type="checkbox"
                    checked={allowsReservations}
                    onChange={(e) => setAllowsReservations(e.target.checked)}
                    className="h-5 w-5 text-primary rounded border-gray-300 focus:ring-primary dark:bg-gray-700 dark:border-gray-600"
                />
                <label htmlFor="allowsReservations" className="ml-3 block text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                    Permite Reservas
                </label>
            </div>
          </div>
          <footer className="flex justify-end items-center p-5 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-lg gap-3">
            {error && <p className="text-sm text-red-600 dark:text-red-400 mr-auto">{error}</p>}
            <button 
                type="button" 
                onClick={onClose} 
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
                Cancelar
            </button>
            <button 
                type="submit" 
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
            >
                {isEditing ? 'Guardar Cambios' : 'Agregar Mesa'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default AddEditTableModal;