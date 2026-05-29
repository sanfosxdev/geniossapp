import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getTablesFromCache as getTables, addTable, updateTable, deleteTable, setTableOverrideStatus, enrichTables, occupyTableAndGenerateCode, updateTableSession } from '../../services/tableService';
import { getOrdersFromCache as getOrders, saveOrder, updateOrder, updateOrderStatus, isOrderFinished, markOrderAsPaid } from '../../services/orderService';
import { getReservationsFromCache as getReservations } from '../../services/reservationService';
import { isBusinessOpen } from '../../services/scheduleService';
import type { Table, Order, Reservation, EnrichedTable, TableStatus, PaymentMethod } from '../../types';
import { OrderType, ReservationStatus, CreatedBy, OrderStatus } from '../../types';
import { PlusIcon } from '../icons/PlusIcon';
import { EditIcon } from '../icons/EditIcon';
import { TrashIcon } from '../icons/TrashIcon';
import { InfoIcon } from '../icons/InfoIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { ClockIcon } from '../icons/ClockIcon';
import { PackageIcon } from '../icons/PackageIcon';
import { LayoutGridIcon } from '../icons/LayoutGridIcon';
import { LockIcon } from '../icons/LockIcon';
import { UnlockIcon } from '../icons/UnlockIcon';
import { QrCodeIcon } from '../icons/QrCodeIcon';
import AddEditTableModal from './AddEditTableModal';
import DeleteTableConfirmationModal from './DeleteTableConfirmationModal';
import AddOrderModal from './AddOrderModal';
import StatusTimer from './StatusTimer';
import TableDetailsModal from './TableDetailsModal';
import PayOrderModal from './PayOrderModal';
import QRCodeModal from './QRCodeModal';
import { toastService } from '../../services/toastService';
import { Spinner } from './Spinner';

interface TablesPanelProps {
    dataTimestamp: number;
}

const TableCard: React.FC<{
    table: EnrichedTable;
    onEdit: () => void;
    onDelete: () => void;
    onOccupy: () => void;
    onFreeUp: () => void;
    onViewDetails: () => void;
    onModifyOrder: (order: Order) => void;
    onNewOrder: (table: EnrichedTable) => void;
    onPay: (table: EnrichedTable) => void;
    onSetOverrideStatus: (tableId: string, status: 'Bloqueada' | 'Ocupada' | null) => void;
    onShowQr: () => void;
    isOpen: boolean;
    isUpdatingStatus: boolean;
}> = ({ table, onEdit, onDelete, onOccupy, onFreeUp, onViewDetails, onModifyOrder, onNewOrder, onPay, onSetOverrideStatus, onShowQr, isOpen, isUpdatingStatus }) => {
  
  const statusConfig: Record<TableStatus, { color: string, bg: string, border: string, icon: React.ReactNode }> = {
    'Libre': { 
        color: 'text-green-600 dark:text-green-400', 
        bg: 'bg-green-100 dark:bg-green-900/30', 
        border: 'border-green-200 dark:border-green-800',
        icon: <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
    },
    'Ocupada': { 
        color: 'text-red-600 dark:text-red-400', 
        bg: 'bg-red-100 dark:bg-red-900/30', 
        border: 'border-red-200 dark:border-red-800',
        icon: <PackageIcon className="w-5 h-5" />
    },
    'Reservada': { 
        color: 'text-blue-600 dark:text-blue-400', 
        bg: 'bg-blue-100 dark:bg-blue-900/30', 
        border: 'border-blue-200 dark:border-blue-800',
        icon: <ClockIcon className="w-5 h-5" />
    },
    'Bloqueada': { 
        color: 'text-orange-600 dark:text-orange-400', 
        bg: 'bg-orange-100 dark:bg-orange-900/30', 
        border: 'border-orange-200 dark:border-orange-800',
        icon: <LockIcon className="w-5 h-5" />
    },
  };

  const config = statusConfig[table.status];
  const isManuallyBlocked = table.overrideStatus === 'Bloqueada';
  const isEditable = table.status !== 'Ocupada' && !isManuallyBlocked;
  const editableOrder = table.activeOrdersOnTable?.find(o => [OrderStatus.PENDING, OrderStatus.CONFIRMED].includes(o.status));
  const allOrdersPaid = table.activeOrdersOnTable?.every(o => o.isPaid) ?? false;

  return (
    <div className={`
        relative flex flex-col h-full
        bg-white dark:bg-gray-800 
        rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 
        border border-gray-100 dark:border-gray-700
        overflow-hidden group
    `}>
      {/* Header Section */}
      <div className={`px-5 py-4 flex justify-between items-center border-b border-gray-50 dark:border-gray-700/50 ${table.status === 'Ocupada' ? 'bg-red-50/30 dark:bg-red-900/10' : ''}`}>
        <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${config.bg} ${config.color} shadow-sm`}>
                {config.icon}
            </div>
            <div>
                <h3 className={`text-lg font-bold text-gray-800 dark:text-gray-100 leading-none ${table.status !== 'Libre' ? 'mb-1' : ''}`}>
                    {table.name}
                </h3>
                {table.status !== 'Libre' ? (
                    <span className={`text-xs font-bold uppercase tracking-wider ${config.color}`}>
                        {table.status}
                    </span>
                ) : (
                    <span className={`text-xs font-bold uppercase tracking-wider ${config.color}`}>
                        Disponible
                    </span>
                )}
            </div>
        </div>
        
        {/* Secondary Actions (Top Right) */}
         <div className="flex items-center gap-1">
            <button onClick={onShowQr} title="Ver QR" className="p-1.5 text-gray-400 hover:text-primary hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <QrCodeIcon className="w-4 h-4" />
            </button>
            <button onClick={onViewDetails} title="Ver Detalles" className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <InfoIcon className="w-4 h-4" />
            </button>
             <button onClick={onEdit} disabled={!isEditable} title="Editar" className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-30">
                <EditIcon className="w-4 h-4" />
            </button>
             <button onClick={onDelete} disabled={!isEditable} title="Eliminar" className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-30">
                <TrashIcon className="w-4 h-4" />
            </button>
        </div>
      </div>

      {/* Body Content */}
      <div className="p-5 flex-grow flex flex-col gap-4">
        {/* Capacity & Info */}
        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-700/50 px-2.5 py-1 rounded-lg border border-gray-100 dark:border-gray-700">
                <UsersIcon className="w-4 h-4" />
                <span className="font-medium">{table.capacity} Pers.</span>
            </div>
            {table.details?.startTime && (
                 <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-700/50 px-2.5 py-1 rounded-lg border border-gray-100 dark:border-gray-700">
                    <ClockIcon className="w-4 h-4" />
                    <StatusTimer startDate={table.details.startTime} />
                </div>
            )}
            {isManuallyBlocked && (
                <div className="flex items-center gap-1.5 bg-orange-50 dark:bg-orange-900/20 px-2.5 py-1 rounded-lg border border-orange-100 dark:border-orange-900/30 text-orange-600 dark:text-orange-400">
                    <LockIcon className="w-3 h-3" />
                    <span className="font-medium text-xs">Bloqueada</span>
                </div>
            )}
        </div>

        {/* Occupied State Details */}
        {table.status === 'Ocupada' && (
            <div className="mt-auto animate-fade-in">
                <div className="flex flex-col gap-1 mb-3">
                    <div className="flex justify-between items-end">
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Total</p>
                         <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border flex items-center gap-1 uppercase tracking-wide ${allOrdersPaid ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' : 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${allOrdersPaid ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                            {allOrdersPaid ? 'Pagado' : 'Pendiente'}
                        </span>
                    </div>
                    <p className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white tracking-tight leading-none truncate" title={`$${(table.accumulatedTotal || 0).toLocaleString('es-AR')}`}>
                        ${(table.accumulatedTotal || 0).toLocaleString('es-AR')}
                    </p>
                </div>
                {table.details?.customerName && (
                     <div className="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/30 p-3 rounded-xl border border-gray-100 dark:border-gray-700/50 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                            <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300 shrink-0">
                                {table.details.customerName.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium truncate">{table.details.customerName}</span>
                        </div>
                        <span className="text-xs text-gray-400 font-mono shrink-0">#{table.details.id.split('-')[1]}</span>
                    </div>
                )}
            </div>
        )}
        
        {/* Other States Details */}
         {table.details && table.status !== 'Ocupada' && (
            <div className="mt-auto text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/30 p-3 rounded-xl border border-gray-100 dark:border-gray-700/50">
                <p className="font-medium text-gray-900 dark:text-gray-200 mb-1">{table.details.customerName}</p>
                {table.details.time && <p className="flex items-center gap-2 text-xs"><ClockIcon className="w-3 h-3"/> {table.details.time}</p>}
            </div>
        )}
      </div>

      {/* Actions Footer */}
      <div className="p-4 pt-0 mt-auto">
        {isUpdatingStatus ? (
            <div className="flex justify-center items-center h-12 w-full bg-gray-50 dark:bg-gray-700/50 rounded-xl"><Spinner /></div>
        ) : (
            <>
                {table.status === 'Libre' && (
                    <div className="relative group w-full">
                        <button onClick={onOccupy} disabled={!isOpen} className="w-full bg-primary text-white font-bold py-3 px-4 rounded-xl hover:bg-red-700 active:bg-red-800 transition-all shadow-sm hover:shadow-md text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group-hover:translate-y-[-1px]">
                            <PlusIcon className="w-5 h-5" />
                            <span>Ocupar Mesa</span>
                        </button>
                        {!isOpen && <span className="absolute hidden group-hover:block bg-gray-800 text-white text-xs rounded py-1 px-2 bottom-full mb-2 left-1/2 -translate-x-1/2 w-max z-10 shadow-lg">El local está cerrado</span>}
                    </div>
                )}
                
                {isManuallyBlocked && (
                    <button onClick={() => onSetOverrideStatus(table.id, null)} className="w-full bg-orange-500 text-white font-bold py-3 px-4 rounded-xl hover:bg-orange-600 transition-all shadow-sm text-sm flex items-center justify-center gap-2">
                        <UnlockIcon className="w-5 h-5" /> Desbloquear
                    </button>
                )}
                
                {table.status === 'Ocupada' && (
                    <div className="grid grid-cols-2 gap-3">
                        {editableOrder ? (
                            <button onClick={() => onModifyOrder(editableOrder)} disabled={!isOpen} className="bg-amber-500 text-white font-bold py-3 px-2 rounded-xl hover:bg-amber-600 transition-colors text-sm disabled:opacity-50 truncate shadow-sm hover:shadow">
                                Modificar
                            </button>
                        ) : (
                            <button onClick={() => onNewOrder(table)} disabled={!isOpen} className="bg-blue-500 text-white font-bold py-3 px-2 rounded-xl hover:bg-blue-600 transition-colors text-sm disabled:opacity-50 truncate shadow-sm hover:shadow">
                                + Pedido
                            </button>
                        )}
                        
                        {!allOrdersPaid ? (
                            <button onClick={() => onPay(table)} className="bg-green-600 text-white font-bold py-3 px-2 rounded-xl hover:bg-green-700 transition-colors text-sm truncate shadow-sm hover:shadow">
                                Pagar
                            </button>
                        ) : (
                            <button onClick={onFreeUp} className="bg-gray-700 text-white font-bold py-3 px-2 rounded-xl hover:bg-gray-800 transition-colors text-sm truncate shadow-sm hover:shadow">
                                Liberar
                            </button>
                        )}
                    </div>
                )}
                
                {table.status !== 'Ocupada' && !isManuallyBlocked && table.status !== 'Libre' && (
                     <button onClick={() => onSetOverrideStatus(table.id, 'Bloqueada')} className="w-full border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 font-semibold py-3 px-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all text-sm flex items-center justify-center gap-2">
                        <LockIcon className="w-4 h-4" /> Bloquear
                    </button>
                )}
                
                 {/* Quick Block Action for Free Tables (Secondary) */}
                 {table.status === 'Libre' && (
                    <button onClick={() => onSetOverrideStatus(table.id, 'Bloqueada')} className="w-full mt-2 text-xs text-gray-400 hover:text-orange-500 font-medium py-1 flex items-center justify-center gap-1 transition-colors">
                        <LockIcon className="w-3 h-3" /> Bloquear Mesa
                    </button>
                )}
            </>
        )}
      </div>
    </div>
  );
};


const TablesPanel: React.FC<TablesPanelProps> = ({ dataTimestamp }) => {
    const [enrichedTables, setEnrichedTables] = useState<EnrichedTable[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Modals state
    const [isAddEditModalOpen, setAddEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [isPayModalOpen, setIsPayModalOpen] = useState(false);
    const [isQrModalOpen, setIsQrModalOpen] = useState(false);

    const [tableToEdit, setTableToEdit] = useState<Table | null>(null);
    const [tableToDelete, setTableToDelete] = useState<Table | null>(null);
    const [orderToEdit, setOrderToEdit] = useState<Order | null>(null);
    const [preselectedTableIds, setPreselectedTableIds] = useState<string[] | null>(null);
    const [viewingTable, setViewingTable] = useState<EnrichedTable | null>(null);
    const [tableToPay, setTableToPay] = useState<EnrichedTable | null>(null);
    const [tableForQr, setTableForQr] = useState<Table | null>(null);
    const [updatingStatusTableId, setUpdatingStatusTableId] = useState<string | null>(null);
    const [isSavingOrder, setIsSavingOrder] = useState(false);
    const [fixedGuests, setFixedGuests] = useState<number | undefined>(undefined);
    const [fixedCustomer, setFixedCustomer] = useState<{ name: string; phone?: string; address?: string } | undefined>(undefined);
    
    const isOpen = isBusinessOpen();

    const fetchDataAndEnrichTables = useCallback(() => {
        const tables = getTables();
        const orders = getOrders();
        const reservations = getReservations();
        const newEnrichedTables = enrichTables(tables, orders, reservations);
        setEnrichedTables(newEnrichedTables);
        setIsLoading(false);
    }, []);

    useEffect(() => {
        setIsLoading(true);
        fetchDataAndEnrichTables();
    }, [fetchDataAndEnrichTables, dataTimestamp]);

    // Modals Handlers
    const handleOpenAddModal = () => { setTableToEdit(null); setAddEditModalOpen(true); };
    const handleOpenEditModal = (table: Table) => { setTableToEdit(table); setAddEditModalOpen(true); };
    const handleOpenDeleteModal = (table: Table) => { setTableToDelete(table); setDeleteModalOpen(true); };
    const handleOpenDetailsModal = (table: EnrichedTable) => { setViewingTable(table); setIsDetailsModalOpen(true); };
    const handleOpenQrModal = (table: Table) => { setTableForQr(table); setIsQrModalOpen(true); };


    const handleCloseModals = () => {
        setAddEditModalOpen(false);
        setDeleteModalOpen(false);
        setIsOrderModalOpen(false);
        setIsDetailsModalOpen(false);
        setIsPayModalOpen(false);
        setIsQrModalOpen(false);
        setTableToEdit(null);
        setTableToDelete(null);
        setPreselectedTableIds(null);
        setOrderToEdit(null);
        setViewingTable(null);
        setTableToPay(null);
        setTableForQr(null);
    };
    const handleSaveTable = (tableData: Omit<Table, 'id'> & { id?: string }) => {
        if (tableData.id) {
            updateTable(tableData as Table);
        } else {
            addTable(tableData);
        }
        fetchDataAndEnrichTables();
        handleCloseModals();
    };
    const handleConfirmDelete = () => {
        if (tableToDelete) {
            deleteTable(tableToDelete.id);
            fetchDataAndEnrichTables();
            handleCloseModals();
        }
    };
    
    // Interactive Buttons Handlers
    const handleOccupy = async (tableId: string) => {
        try {
            await occupyTableAndGenerateCode(tableId);
            fetchDataAndEnrichTables();
        } catch (error) {
            console.error("Error setting table as occupied:", error);
        }
        setPreselectedTableIds([tableId]);
        setFixedGuests(undefined);
        setFixedCustomer(undefined);
        setOrderToEdit(null);
        setIsOrderModalOpen(true);
    };
    const handleFreeUp = async (table: EnrichedTable) => {
        let hasUnpaidOrders = false;
        
        // Check for unpaid orders first (including finished ones in the current session)
        if (table.activeOrdersOnTable) {
            for (const order of table.activeOrdersOnTable) {
                // If order is not paid (regardless of status, unless it's cancelled), block release
                if (!order.isPaid && order.status !== OrderStatus.CANCELLED) {
                    hasUnpaidOrders = true;
                    break;
                }
            }
        }

        if (hasUnpaidOrders) {
            toastService.show('No se puede liberar la mesa. Hay pedidos pendientes de pago.', 'warning');
            return;
        }

        const updatePromises: Promise<any>[] = [];
        table.activeOrdersOnTable?.forEach(order => {
             if (!isOrderFinished(order.status) && order.isPaid) {
                updatePromises.push(updateOrderStatus(order.id, OrderStatus.COMPLETED_DINE_IN));
            }
        });
        
        await Promise.all(updatePromises);

        // Clear the manual 'Ocupada' status
        try {
            await setTableOverrideStatus(table.id, null);
            toastService.show('Mesa liberada con éxito.', 'success');
        } catch (e) {
            console.error("Failed to clear table override status", e);
            toastService.show('Error al liberar la mesa.', 'error');
        }
        
        fetchDataAndEnrichTables();
    };
    const handleSaveOrder = async (orderData: Omit<Order, 'id' | 'status' | 'createdAt' | 'statusHistory' | 'finishedAt' | 'isPaid' | 'createdBy'> & { id?: string }) => {
        setIsSavingOrder(true);
        try {
            if (orderData.id) {
                await updateOrder(orderData as Partial<Order> & { id: string });
                toastService.show('Pedido de mesa actualizado.', 'success');
            } else {
                await saveOrder({ ...orderData, createdBy: CreatedBy.ADMIN });
                if (orderData.type === OrderType.DINE_IN && orderData.tableIds && orderData.tableIds.length > 0) {
                    for (const tableId of orderData.tableIds) {
                        await updateTableSession(tableId, orderData.customer.name || 'Cliente', orderData.guests || 1);
                    }
                }
                toastService.show('Pedido de mesa creado.', 'success');
            }
            handleCloseModals();
            fetchDataAndEnrichTables();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Error al guardar el pedido.';
            toastService.show(message, 'error');
        } finally {
            setIsSavingOrder(false);
        }
    };
    
    const handleModifyOrder = (order: Order) => {
        setOrderToEdit(order);
        setPreselectedTableIds(null);
        setIsOrderModalOpen(true);
    };
    
    const handleNewOrder = (table: EnrichedTable) => {
        setPreselectedTableIds(table.activeOrdersOnTable?.[0]?.tableIds || [table.id]);
        
        // Find guests from the first active order (assuming all orders in session have same guests)
        const existingGuests = table.activeOrdersOnTable?.[0]?.guests;
        setFixedGuests(existingGuests);

        // Find customer from the first active order
        const existingCustomer = table.activeOrdersOnTable?.[0]?.customer;
        setFixedCustomer(existingCustomer);

        setOrderToEdit(null);
        setIsOrderModalOpen(true);
    };
    
    const handlePay = (table: EnrichedTable) => {
        setTableToPay(table);
        setIsPayModalOpen(true);
    };
    
    const handleConfirmPayment = async (paymentMethod: PaymentMethod, paymentProofUrl?: string) => {
        if (tableToPay && tableToPay.activeOrdersOnTable) {
            const unpaidOrders = tableToPay.activeOrdersOnTable.filter(o => !o.isPaid);
            const updatePromises = unpaidOrders.map(order => 
                 markOrderAsPaid(order.id, paymentMethod, paymentProofUrl)
            );

            try {
                await Promise.all(updatePromises);
                toastService.show('Pagos registrados con éxito.', 'success');
                fetchDataAndEnrichTables();
                handleCloseModals();
            } catch (error) {
                console.error("Error processing payments:", error);
                toastService.show('Error al registrar los pagos.', 'error');
            }
        } else {
            handleCloseModals();
        }
    };
    
    const handleSetOverrideStatus = async (tableId: string, status: 'Bloqueada' | 'Ocupada' | null) => {
        setUpdatingStatusTableId(tableId);
        try {
            await setTableOverrideStatus(tableId, status);
            const statusText = status === 'Bloqueada' ? 'bloqueada' : status === 'Ocupada' ? 'ocupada' : 'desbloqueada/liberada';
            toastService.show(`Mesa ${statusText}.`, 'success');
            fetchDataAndEnrichTables();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Error al actualizar estado.';
            toastService.show(message, 'error');
        } finally {
            setUpdatingStatusTableId(null);
        }
    };

    return (
        <div>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center mb-6">
                <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Estado de Mesas</h2>
                <button onClick={handleOpenAddModal} className="flex items-center justify-center sm:justify-start bg-primary text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 transition-colors">
                    <PlusIcon className="w-5 h-5 mr-2" /> Agregar Mesa
                </button>
            </div>

            {isLoading ? <p className="dark:text-white">Cargando mesas...</p> : enrichedTables.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-lg shadow-md">
                  <LayoutGridIcon className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300">No hay mesas configuradas</h3>
                  <p className="text-gray-500 dark:text-gray-400 mt-2">Comienza agregando tu primera mesa.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 sm:gap-8">
                    {enrichedTables.map(table => (
                        <TableCard
                            key={table.id}
                            table={table}
                            onEdit={() => handleOpenEditModal(table)}
                            onDelete={() => handleOpenDeleteModal(table)}
                            onOccupy={() => handleOccupy(table.id)}
                            onFreeUp={() => handleFreeUp(table)}
                            onViewDetails={() => handleOpenDetailsModal(table)}
                            onModifyOrder={handleModifyOrder}
                            onNewOrder={handleNewOrder}
                            onPay={handlePay}
                            onSetOverrideStatus={handleSetOverrideStatus}
                            onShowQr={() => handleOpenQrModal(table)}
                            isOpen={isOpen}
                            isUpdatingStatus={updatingStatusTableId === table.id}
                        />
                    ))}
                </div>
            )}
            
            <AddEditTableModal isOpen={isAddEditModalOpen} onClose={handleCloseModals} onSave={handleSaveTable} tableToEdit={tableToEdit} />
            <DeleteTableConfirmationModal isOpen={isDeleteModalOpen} onClose={handleCloseModals} onConfirm={handleConfirmDelete} tableName={tableToDelete?.name || ''} />
            <AddOrderModal 
                isOpen={isOrderModalOpen} 
                onClose={handleCloseModals} 
                onSave={handleSaveOrder} 
                preselectedTableIds={preselectedTableIds}
                orderToEdit={orderToEdit}
                isSaving={isSavingOrder} 
                isStoreOpen={isOpen}
                fixedGuests={fixedGuests}
                fixedCustomer={fixedCustomer}
                bypassAvailabilityCheck={!!preselectedTableIds} // Always bypass if we preselected tables from the panel (Occupy or New Order)
            />
            <TableDetailsModal 
                isOpen={isDetailsModalOpen}
                onClose={handleCloseModals}
                table={viewingTable}
            />
            <PayOrderModal
                isOpen={isPayModalOpen}
                onClose={handleCloseModals}
                onConfirm={handleConfirmPayment}
                table={tableToPay}
            />
            <QRCodeModal
                isOpen={isQrModalOpen}
                onClose={handleCloseModals}
                table={tableForQr}
            />
        </div>
    );
};

export default TablesPanel;