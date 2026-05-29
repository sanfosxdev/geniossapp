import React from 'react';
import type { EnrichedTable } from '../../types';
import { CloseIcon } from '../icons/CloseIcon';

interface TableDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  table: EnrichedTable | null;
}

const TableDetailsModal: React.FC<TableDetailsModalProps> = ({ isOpen, onClose, table }) => {
  if (!isOpen || !table) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg transform animate-slide-in-up">
        <header className="flex justify-between items-center p-5 border-b dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Detalles de la Mesa: {table.name}</h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white">
            <CloseIcon className="w-6 h-6" />
          </button>
        </header>

        <div className="p-6 space-y-4">
            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Capacidad</p>
                    <p className="font-semibold text-gray-800 dark:text-gray-200">{table.capacity} personas</p>
                </div>
                <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Permite Reservas</p>
                    <p className={`font-semibold ${table.allowsReservations ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {table.allowsReservations ? 'Sí' : 'No'}
                    </p>
                </div>
            </div>

            <div>
                <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Estado Actual</h3>
                <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                         <p className="font-bold text-lg text-gray-800 dark:text-gray-100">{table.status}</p>
                         {table.status === 'Ocupada' && (
                             <div className="flex items-center gap-2">
                                 {table.accessCode && (
                                     <span className="bg-primary/10 text-primary text-xs font-mono px-2.5 py-0.5 rounded">
                                         Código: {table.accessCode}
                                     </span>
                                 )}
                                 <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded dark:bg-red-900 dark:text-red-300">
                                     Ocupada
                                 </span>
                             </div>
                         )}
                    </div>
                    
                    {table.details ? (
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-2 space-y-2 border-t border-gray-200 dark:border-gray-600 pt-2">
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                               <p><strong>Tipo:</strong> {table.details.type === 'order' ? 'Pedido' : 'Reserva'}</p>
                               <p><strong>ID:</strong> #{table.details.id.split('-')[1]}</p>
                           </div>
                           <p><strong>Cliente:</strong> {table.details.customerName}</p>
                           {table.details.time && <p><strong>Hora Inicio:</strong> {new Date(table.details.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>}
                           
                           {table.activeOrdersOnTable && table.activeOrdersOnTable.length > 0 && (
                               <div className="mt-4 border-t border-gray-200 dark:border-gray-600 pt-2">
                                   <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Pedidos en la Mesa:</h4>
                                   <div className="space-y-2 max-h-40 overflow-y-auto">
                                       {table.activeOrdersOnTable.map(order => (
                                           <div key={order.id} className="flex justify-between items-center bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-600">
                                               <div>
                                                   <span className="font-medium text-gray-800 dark:text-gray-200">#{order.id.split('-')[1]}</span>
                                                   <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                                                       order.status === 'Entregado' ? 'bg-green-100 text-green-800' : 
                                                       order.status === 'Cancelado' ? 'bg-red-100 text-red-800' : 
                                                       'bg-yellow-100 text-yellow-800'
                                                   }`}>
                                                       {order.status}
                                                   </span>
                                                   {order.isPaid && <span className="ml-1 text-xs text-green-600 font-bold">(Pagado)</span>}
                                               </div>
                                               <span className="font-bold text-gray-700 dark:text-gray-300">${order.total.toLocaleString('es-AR')}</span>
                                           </div>
                                       ))}
                                   </div>
                                   <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-200 dark:border-gray-600">
                                       <span className="font-bold text-gray-800 dark:text-gray-100">Total Acumulado:</span>
                                       <span className="font-bold text-xl text-primary">${(table.accumulatedTotal || 0).toLocaleString('es-AR')}</span>
                                   </div>
                               </div>
                           )}

                           {table.overrideStatus === 'Bloqueada' && (
                               <div className="mt-2 p-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded text-xs text-orange-700 dark:text-orange-400 italic">
                                   Manualmente bloqueada por un administrador.
                               </div>
                           )}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">La mesa está disponible para clientes.</p>
                    )}
                </div>
            </div>

        </div>

        <footer className="flex justify-end items-center p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-lg">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-500 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  );
};

export default TableDetailsModal;
