import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Order, Table, Product, Category, Promotion, OrderItem } from '../types';
import { OrderType, CreatedBy, OrderStatus, PaymentMethod } from '../types';
import { getEnrichedTableById, getTablesFromCache, fetchAndCacheTables, verifyTableAccessCode, updateTableSession } from '../services/tableService';
import { getOrdersFromCache, saveOrder, updateOrder, updateOrderStatus, fetchAndCacheOrders } from '../services/orderService';
import { getReservationsFromCache, fetchAndCacheReservations } from '../services/reservationService';
import { fetchAndCacheProducts } from '../services/productService';
import { fetchAndCacheCategories } from '../services/categoryService';
import { fetchAndCachePromotions } from '../services/promotionService';
import { addNotification } from '../services/notificationService';
import { getSettings } from '../services/settingsService';
import { calculateDistance } from '../utils/geoUtils';

import { PizzaIcon } from './icons/PizzaIcon';
import { LockIcon } from './icons/LockIcon';
import { UnlockIcon } from './icons/UnlockIcon';
import { UsersIcon } from './icons/UsersIcon';
import { UserIcon } from './icons/UserIcon';
import { BellIcon } from './icons/BellIcon';
import { CreditCardIcon } from './icons/CreditCardIcon';
import { Toast } from './ui/Toast';
import OrderCart from './table_order/OrderCart';

type ViewStatus = 'loading' | 'welcome' | 'ready' | 'occupied' | 'error' | 'ordered' | 'login' | 'guest_info';

interface ToastMessage {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
}

const TableOrderView: React.FC<{ tableId: string }> = ({ tableId }) => {
    const [viewStatus, setViewStatus] = useState<ViewStatus>('loading');
    const [table, setTable] = useState<Table | null>(null);
    const [order, setOrder] = useState<Order | null>(null);
    const [menu, setMenu] = useState<{ products: Product[], promotions: Promotion[], categories: Category[] }>({ products: [], promotions: [], categories: [] });
    const [errorMessage, setErrorMessage] = useState('');
    const [isCartOpen, setIsCartOpen] = useState(false);

    // Access Code State
    const [accessCode, setAccessCode] = useState<string | null>(null);
    const [showAccessCodeModal, setShowAccessCodeModal] = useState(false);
    const [inputCode, setInputCode] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [activeOrders, setActiveOrders] = useState<Order[]>([]);
    const previousOrdersRef = React.useRef<Order[]>([]);

    // Guest Info State
    const [customerName, setCustomerName] = useState('');
    const [guests, setGuests] = useState(1);
    const [showAssistanceRequest, setShowAssistanceRequest] = useState(false);
    const [isRequestingBill, setIsRequestingBill] = useState(false);
    const [isCallingWaiter, setIsCallingWaiter] = useState(false);
    
    // Toast State
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    const addToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts(prev => [...prev, { id, message, type }]);
    };

    const removeToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    const initialize = useCallback(async () => {
        try {
            setViewStatus('loading');

            // Step 1: Fetch all data to ensure caches are fresh
            const [products, categories, promotions] = await Promise.all([
                fetchAndCacheProducts(),
                fetchAndCacheCategories(),
                fetchAndCachePromotions(),
                fetchAndCacheTables(),
                fetchAndCacheOrders(),
                fetchAndCacheReservations()
            ]);
            setMenu({ products, promotions: promotions.filter(p => p.isActive), categories });

            // Step 2: Find the table
            const tableInfo = getTablesFromCache().find(t => t.id === tableId);
            if (!tableInfo) {
                throw new Error(`Mesa con ID "${tableId}" no encontrada.`);
            }
            setTable(tableInfo);

            // Step 3: Check Table Status & Authentication
            const enrichedTable = getEnrichedTableById(tableId);
            if (!enrichedTable) throw new Error('No se pudieron obtener los detalles completos de la mesa.');

            if (enrichedTable.activeOrdersOnTable) {
                setActiveOrders(enrichedTable.activeOrdersOnTable);
                previousOrdersRef.current = enrichedTable.activeOrdersOnTable;
            }

            const sessionCodeKey = `pizzeria-table-code-${tableId}`;
            const storedCode = sessionStorage.getItem(sessionCodeKey);

            if (enrichedTable.status === 'Libre') {
                // Table is free -> Block access until admin occupies it
                setErrorMessage('Esta mesa aún no ha sido habilitada. Por favor, solicite a un miembro del personal que habilite la mesa.');
                setViewStatus('occupied');
            } else if (enrichedTable.status === 'Ocupada') {
                // Table is occupied -> Check code
                if (storedCode && verifyTableAccessCode(tableId, storedCode)) {
                    setIsAuthenticated(true);
                    setAccessCode(storedCode);
                    
                    // Check for existing order session
                    const sessionOrderKey = `pizzeria-table-order-${tableId}`;
                    const sessionOrderId = sessionStorage.getItem(sessionOrderKey);
                    
                    if (sessionOrderId) {
                        const existingOrder = getOrdersFromCache().find(o => o.id === sessionOrderId);
                        if (existingOrder && existingOrder.status === OrderStatus.PENDING) {
                            setOrder(existingOrder);
                            setViewStatus('ready');
                            return;
                        } else {
                            sessionStorage.removeItem(sessionOrderKey);
                        }
                    }

                    // Check if guest info is already set
                    if (enrichedTable.currentSession) {
                         setViewStatus('welcome');
                    } else {
                         setViewStatus('guest_info');
                    }

                } else {
                    // Not authenticated
                    setIsAuthenticated(false);
                    setViewStatus('login');
                }
            } else {
                // Blocked or Reserved
                 setErrorMessage(`Esta mesa está actualmente ${enrichedTable.status.toLowerCase()}. Por favor, consulta con un miembro del personal.`);
                 setViewStatus('occupied');
            }

        } catch (err) {
            console.error("Error during table order initialization:", err);
            const message = err instanceof Error ? err.message : 'Ocurrió un error al cargar la información.';
            setErrorMessage(message);
            setViewStatus('error');
        }
    }, [tableId]);

    useEffect(() => {
        initialize();
    }, [initialize]);

    useEffect(() => {
        // Polling for updates
        const intervalId = setInterval(async () => {
             if (tableId) {
                try {
                    await fetchAndCacheOrders();
                    await fetchAndCacheTables(); // Fetch latest table status
                    const enrichedTable = getEnrichedTableById(tableId);
                    
                    if (enrichedTable) {
                        if (enrichedTable.status === 'Libre') {
                            // Table was freed by admin
                            const sessionCodeKey = `pizzeria-table-code-${tableId}`;
                            sessionStorage.removeItem(sessionCodeKey);
                            setIsAuthenticated(false);
                            setAccessCode(null);
                            setErrorMessage('Esta mesa aún no ha sido habilitada. Por favor, solicite a un miembro del personal que habilite la mesa.');
                            setViewStatus('occupied');
                            return;
                        } else if (enrichedTable.status === 'Ocupada' && !isAuthenticated && viewStatus === 'occupied') {
                            // Table was occupied by admin, user was waiting
                            setViewStatus('login');
                        }

                        if (isAuthenticated && enrichedTable.activeOrdersOnTable) {
                            const newOrders = enrichedTable.activeOrdersOnTable;
                            const previousOrders = previousOrdersRef.current;

                            // Check for status changes
                            newOrders.forEach(newOrder => {
                                const oldOrder = previousOrders.find(o => o.id === newOrder.id);
                                if (oldOrder && oldOrder.status !== newOrder.status) {
                                    let message = `El estado de tu pedido ha cambiado a: ${newOrder.status}`;
                                    let type: 'info' | 'success' | 'warning' = 'info';

                                    if (newOrder.status === OrderStatus.CONFIRMED) {
                                        message = '¡Tu pedido ha sido confirmado!';
                                        type = 'success';
                                    } else if (newOrder.status === OrderStatus.IN_PREPARATION) {
                                        message = '¡Tu pedido se está preparando en la cocina!';
                                        type = 'info';
                                    } else if (newOrder.status === OrderStatus.READY_FOR_PICKUP) {
                                        message = '¡Tu pedido está listo para ser servido!';
                                        type = 'success';
                                    } else if (newOrder.status === OrderStatus.DELIVERED) {
                                        message = '¡Tu pedido ha sido entregado! ¡Buen provecho!';
                                        type = 'success';
                                    }

                                    addToast(message, type);
                                }
                            });

                            setActiveOrders(newOrders);
                            previousOrdersRef.current = newOrders;
                        }
                    }
                } catch (e) {
                    console.error("Error polling updates:", e);
                }
             }
        }, 10000); // Poll every 10 seconds

        return () => clearInterval(intervalId);

    }, [isAuthenticated, tableId, viewStatus]);
    
    const handleLoginSubmit = () => {
        if (verifyTableAccessCode(tableId, inputCode)) {
            const sessionCodeKey = `pizzeria-table-code-${tableId}`;
            sessionStorage.setItem(sessionCodeKey, inputCode);
            setIsAuthenticated(true);
            setAccessCode(inputCode);
            
            // Check for existing order session
            const sessionOrderKey = `pizzeria-table-order-${tableId}`;
            const sessionOrderId = sessionStorage.getItem(sessionOrderKey);
            
            const enrichedTable = getEnrichedTableById(tableId);

            if (sessionOrderId) {
                const existingOrder = getOrdersFromCache().find(o => o.id === sessionOrderId);
                if (existingOrder && existingOrder.status === OrderStatus.PENDING) {
                    setOrder(existingOrder);
                    setViewStatus('ready');
                } else {
                     sessionStorage.removeItem(sessionOrderKey);
                     if (enrichedTable?.currentSession) {
                        setViewStatus('welcome');
                     } else {
                        setViewStatus('guest_info');
                     }
                }
            } else {
                if (enrichedTable?.currentSession) {
                    setViewStatus('welcome');
                } else {
                    setViewStatus('guest_info');
                }
            }
        } else {
            setErrorMessage('Código incorrecto. Por favor, intenta de nuevo.');
            // Clear error message after 3 seconds
            setTimeout(() => setErrorMessage(''), 3000);
        }
    };

    const handleGuestInfoSubmit = async () => {
        if (!customerName.trim()) {
            setErrorMessage('Por favor, ingresa tu nombre.');
            setTimeout(() => setErrorMessage(''), 3000);
            return;
        }
        if (guests > (table?.capacity || 4)) {
             setShowAssistanceRequest(true);
             return;
        }

        try {
            await updateTableSession(tableId, customerName, guests);
            // Refresh local table state
            const updatedTable = getEnrichedTableById(tableId);
            setTable(updatedTable);
            setViewStatus('welcome');
        } catch (e) {
            console.error("Error updating session:", e);
            setErrorMessage('Error al guardar la información. Intenta de nuevo.');
        }
    };

    const handleRequestAssistance = () => {
        addNotification({
            message: `Solicitud de asistencia en Mesa ${table?.name}: ${guests} comensales (Capacidad: ${table?.capacity}).`,
            type: 'general',
            relatedId: tableId
        });
        alert("Se ha notificado al personal. En breve se acercarán a asistirte.");
        setShowAssistanceRequest(false);
        // Allow them to proceed anyway or maybe wait? 
        // For now, let's proceed but with the warning sent.
        handleGuestInfoSubmit(); 
    };

    const handleCallWaiter = async () => {
        setIsCallingWaiter(true);
        try {
            await addNotification({
                message: `Mesa ${table?.name} solicita asistencia del personal.`,
                type: 'general',
                relatedId: tableId
            });
            alert("Se ha notificado al personal. En breve se acercarán a tu mesa.");
        } catch (error) {
            console.error("Error calling waiter:", error);
            alert("No se pudo enviar la solicitud. Por favor intenta de nuevo.");
        } finally {
            setIsCallingWaiter(false);
        }
    };

    const handleRequestBill = async () => {
        const unpaidOrders = activeOrders.filter(o => o.status !== OrderStatus.DINE_IN_PENDING_PAYMENT && o.status !== OrderStatus.COMPLETED_DINE_IN && o.status !== OrderStatus.CANCELLED);
        
        if (unpaidOrders.length === 0) {
            alert("No tienes pedidos pendientes de pago o ya has solicitado la cuenta.");
            return;
        }

        setIsRequestingBill(true);
        try {
            // Update status of all relevant orders to DINE_IN_PENDING_PAYMENT
            await Promise.all(unpaidOrders.map(order => 
                updateOrderStatus(order.id, OrderStatus.DINE_IN_PENDING_PAYMENT)
            ));

            await addNotification({
                message: `Mesa ${table?.name} solicita la cuenta.`,
                type: 'general', // Or a specific 'bill' type if available
                relatedId: tableId
            });

            // Refresh active orders
            const updatedOrders = await fetchAndCacheOrders();
            const enrichedTable = getEnrichedTableById(tableId);
            if (enrichedTable && enrichedTable.activeOrdersOnTable) {
                setActiveOrders(enrichedTable.activeOrdersOnTable);
            }

            alert("Se ha solicitado la cuenta. El personal se acercará en breve.");
        } catch (error) {
            console.error("Error requesting bill:", error);
            alert("No se pudo solicitar la cuenta. Por favor intenta de nuevo.");
        } finally {
            setIsRequestingBill(false);
        }
    };
    
    const handleStartOrder = useCallback(async () => {
        if (!table) return;
        setViewStatus('loading');
        try {
            const newOrder = await saveOrder({
                customer: { name: table.currentSession?.customerName || `Mesa ${table.name}` },
                items: [],
                total: 0,
                type: OrderType.DINE_IN,
                tableIds: [table.id],
                guests: table.currentSession?.guests || 1, 
                createdBy: CreatedBy.WEB_ASSISTANT,
                paymentMethod: PaymentMethod.CASH,
            });
            const sessionOrderKey = `pizzeria-table-order-${table.id}`;
            sessionStorage.setItem(sessionOrderKey, newOrder.id);
            setOrder(newOrder);
            setViewStatus('ready');
        } catch (err) {
            console.error("Error creating order:", err);
            setErrorMessage("No se pudo iniciar el pedido. Por favor, intenta de nuevo.");
            setViewStatus('error');
        }
    }, [table]);

    const handleUpdateOrder = (newItems: OrderItem[]) => {
        if (!order) return;
        const newTotal = newItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const updatedOrder = { ...order, items: newItems, total: newTotal };
        setOrder(updatedOrder);
        updateOrder(updatedOrder).catch(err => console.error("Failed to sync cart changes:", err));
    };

    const handleConfirmOrder = async () => {
        if (!order || order.items.length === 0) return;
        try {
            setViewStatus('loading');
            
            const confirmedOrder = {
                ...order,
                status: OrderStatus.CONFIRMED,
                statusHistory: [ ...order.statusHistory, { status: OrderStatus.CONFIRMED, startedAt: new Date().toISOString() } ]
            };

            await updateOrder(confirmedOrder);
            
            // Notify admin panel of the new order
            addNotification({
                message: `Nuevo pedido en ${confirmedOrder.customer.name} por $${confirmedOrder.total.toLocaleString('es-AR')}.`,
                type: 'order',
                relatedId: confirmedOrder.id,
            });
            // Trigger a storage event to force other tabs (like the admin dashboard) to refresh
            localStorage.setItem('pizzeria-data-updated', Date.now().toString());

            const sessionOrderKey = `pizzeria-table-order-${tableId}`;
            sessionStorage.removeItem(sessionOrderKey);
            
            // Refresh active orders immediately
            const updatedOrders = await fetchAndCacheOrders();
            const enrichedTable = getEnrichedTableById(tableId);
            if (enrichedTable && enrichedTable.activeOrdersOnTable) {
                setActiveOrders(enrichedTable.activeOrdersOnTable);
            }
            
            setViewStatus('welcome'); // Go back to welcome screen which shows active orders
        } catch (err) {
            console.error(err);
            setErrorMessage('Hubo un problema al confirmar tu pedido. Por favor, avisa al personal.');
            setViewStatus('error');
        }
    };
    
    const menuItemsByCategory = useMemo(() => {
        const grouped: { [key: string]: (Product | Promotion)[] } = {};
        
        menu.promotions.forEach(promo => {
            if (!grouped['Promociones']) grouped['Promociones'] = [];
            grouped['Promociones'].push(promo);
        });
        
        menu.products.forEach(prod => {
            if (!grouped[prod.category]) grouped[prod.category] = [];
            grouped[prod.category].push(prod);
        });

        const categoryOrder = ['Promociones', ...menu.categories.map(c => c.name).filter(name => name !== 'Promociones')];

        return categoryOrder
            .map(name => ({ name, items: grouped[name] || [] }))
            .filter(cat => cat.items.length > 0);

    }, [menu.products, menu.promotions, menu.categories]);


    const addItemToOrder = (item: Product | Promotion) => {
        if (!order) return;
        
        const isPromo = 'isActive' in item;
        const existingItemIndex = order.items.findIndex(i => i.itemId === item.id);
        
        let newItems: OrderItem[];

        if(existingItemIndex > -1) {
            const currentQuantity = order.items[existingItemIndex].quantity;
            if (currentQuantity >= 10) {
                addToast('No puedes pedir más de 10 unidades de un mismo producto.', 'warning');
                return;
            }
            newItems = order.items.map((orderItem, index) => 
                index === existingItemIndex 
                ? { ...orderItem, quantity: orderItem.quantity + 1 }
                : orderItem
            );
        } else {
            newItems = [...order.items, {
                itemId: item.id,
                name: item.name,
                quantity: 1,
                price: Number(item.price),
                isPromotion: isPromo,
            }];
        }
        handleUpdateOrder(newItems);
    }


    if (viewStatus === 'loading') {
        return (
            <div className="flex h-screen w-screen justify-center items-center bg-gray-50 dark:bg-gray-900">
                <div className="text-center">
                    <PizzaIcon className="w-16 h-16 text-primary mx-auto animate-bounce" />
                    <p className="text-lg font-semibold mt-4 text-gray-700 dark:text-gray-200">
                        Preparando tu mesa digital...
                    </p>
                </div>
            </div>
        );
    }
    
    if (viewStatus === 'error' || viewStatus === 'occupied') {
         return (
            <div className="flex h-screen w-screen justify-center items-center bg-gray-50 dark:bg-gray-900 p-4">
                <div className="text-center bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg max-w-md w-full">
                    <PizzaIcon className="w-16 h-16 text-primary mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-dark dark:text-light mb-2">Pizzería Los Genios</h1>
                    <p className="text-lg text-red-600 dark:text-red-400 mb-4">{errorMessage}</p>
                    
                    {errorMessage.includes("Permiso") && (
                        <div className="mb-6 text-sm text-gray-600 dark:text-gray-300 bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg text-left border border-yellow-100 dark:border-yellow-800">
                            <p className="font-bold mb-2 text-yellow-800 dark:text-yellow-200">Cómo habilitar la ubicación:</p>
                            <ol className="list-decimal pl-5 space-y-2">
                                <li>Haz clic en el icono de <strong>candado 🔒</strong> o configuración a la izquierda de la barra de direcciones.</li>
                                <li>Busca la opción <strong>"Ubicación"</strong> o "Permisos".</li>
                                <li>Cambia el ajuste a <strong>"Permitir"</strong> o "Preguntar".</li>
                                <li>Presiona el botón <strong>"Reintentar"</strong> de abajo.</li>
                            </ol>
                        </div>
                    )}

                    <button 
                        onClick={() => initialize()} 
                        className="bg-primary text-white font-bold py-3 px-8 rounded-lg hover:bg-red-700 transition-colors shadow-md hover:shadow-lg transform hover:-translate-y-0.5 active:translate-y-0"
                    >
                        Reintentar
                    </button>
                </div>
            </div>
        );
    }

    if (viewStatus === 'login') {
        return (
            <div className="flex h-screen w-screen justify-center items-center bg-gray-50 dark:bg-gray-900 p-4">
                <div className="text-center bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg max-w-md w-full animate-fade-in">
                    <LockIcon className="w-16 h-16 text-primary mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-dark dark:text-light mb-2">Mesa Ocupada</h1>
                    <p className="text-gray-600 dark:text-gray-300 mb-6">
                        Esta mesa está ocupada. Por favor, ingresa el código de acceso de 4 dígitos para continuar.
                    </p>
                    
                    <div className="mb-6">
                        <input
                            type="text"
                            maxLength={4}
                            value={inputCode}
                            onChange={(e) => setInputCode(e.target.value.replace(/\D/g, ''))}
                            className="w-full text-center text-3xl tracking-widest font-bold py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-primary bg-transparent text-dark dark:text-light"
                            placeholder="0000"
                        />
                        {errorMessage && <p className="text-red-500 text-sm mt-2">{errorMessage}</p>}
                    </div>

                    <button
                        onClick={handleLoginSubmit}
                        disabled={inputCode.length !== 4}
                        className="w-full bg-primary text-white font-bold py-3 px-6 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Ingresar
                    </button>
                </div>
            </div>
        );
    }

    if (viewStatus === 'guest_info') {
        return (
            <div className="flex h-screen w-screen justify-center items-center bg-gray-50 dark:bg-gray-900 p-4">
                <div className="text-center bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg max-w-md w-full animate-fade-in">
                    <UsersIcon className="w-16 h-16 text-primary mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-dark dark:text-light mb-2">Bienvenido</h1>
                    <p className="text-gray-600 dark:text-gray-300 mb-6">
                        Por favor, ingresa tus datos para comenzar.
                    </p>
                    
                    <div className="space-y-4 mb-6 text-left">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tu Nombre</label>
                            <div className="relative">
                                <UserIcon className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                                <input
                                    type="text"
                                    value={customerName}
                                    onChange={(e) => setCustomerName(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-primary bg-transparent text-dark dark:text-light"
                                    placeholder="Ej: Juan Pérez"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cantidad de Personas</label>
                            <div className="relative">
                                <UsersIcon className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                                <input
                                    type="number"
                                    min={1}
                                    max={20}
                                    value={guests}
                                    onChange={(e) => setGuests(parseInt(e.target.value) || 1)}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-primary bg-transparent text-dark dark:text-light"
                                />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Capacidad de la mesa: {table?.capacity} personas</p>
                        </div>
                    </div>

                    {errorMessage && <p className="text-red-500 text-sm mb-4">{errorMessage}</p>}

                    {showAssistanceRequest ? (
                        <div className="space-y-3">
                            <p className="text-amber-600 dark:text-amber-400 text-sm bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
                                La cantidad de personas excede la capacidad de la mesa. ¿Deseas solicitar asistencia para reubicarte o agregar sillas?
                            </p>
                            <button
                                onClick={handleRequestAssistance}
                                className="w-full bg-amber-500 text-white font-bold py-3 px-6 rounded-lg hover:bg-amber-600 transition-colors flex items-center justify-center gap-2"
                            >
                                <BellIcon className="w-5 h-5" />
                                Solicitar Asistencia
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={handleGuestInfoSubmit}
                            className="w-full bg-primary text-white font-bold py-3 px-6 rounded-lg hover:bg-red-700 transition-colors"
                        >
                            Continuar
                        </button>
                    )}
                </div>
            </div>
        );
    }
    
    if (viewStatus === 'welcome') {
        return (
             <div className="flex h-screen w-screen justify-center items-center bg-gray-50 dark:bg-gray-900 p-4 relative">
                {/* Access Code Modal */}
                {showAccessCodeModal && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                        <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl max-w-sm w-full text-center animate-scale-in border border-gray-200 dark:border-gray-700">
                            <UnlockIcon className="w-16 h-16 text-green-500 mx-auto mb-4" />
                            <h2 className="text-2xl font-bold text-dark dark:text-light mb-2">¡Mesa Asignada!</h2>
                            <p className="text-gray-600 dark:text-gray-300 mb-6">
                                Tu código de acceso para esta mesa es:
                            </p>
                            <div className="bg-gray-100 dark:bg-gray-900 py-4 px-8 rounded-xl mb-6 inline-block">
                                <span className="text-4xl font-mono font-bold text-primary tracking-widest">
                                    {accessCode}
                                </span>
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                                Guarda este código. Lo necesitarás si quieres volver a ingresar a esta mesa desde otro dispositivo o si cierras la pestaña.
                            </p>
                            <button
                                onClick={() => setShowAccessCodeModal(false)}
                                className="w-full bg-primary text-white font-bold py-3 px-6 rounded-lg hover:bg-red-700 transition-transform duration-200 hover:scale-105"
                            >
                                Entendido, continuar
                            </button>
                        </div>
                    </div>
                )}

                <div className="text-center bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg max-w-md animate-fade-in w-full">
                    <PizzaIcon className="w-16 h-16 text-primary mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-dark dark:text-light mb-2">
                        {table?.currentSession?.customerName ? `Hola, ${table.currentSession.customerName}` : `¡Bienvenido a la Mesa ${table?.name}!`}
                    </h1>
                    <p className="text-gray-600 dark:text-gray-300 mb-6">
                        {activeOrders.length > 0 
                            ? 'Aquí tienes el estado de tus pedidos. Puedes agregar más cosas si lo deseas.'
                            : 'Estás a punto de empezar tu pedido. Presiona el botón para ver nuestro menú.'
                        }
                    </p>

                    {activeOrders.length > 0 && (
                        <div className="mb-6 bg-gray-50 dark:bg-gray-700 p-4 rounded-lg text-left shadow-inner">
                            <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-3 border-b border-gray-200 dark:border-gray-600 pb-2 flex justify-between items-center">
                                <span>Pedidos en curso</span>
                                <span className="text-xs font-normal bg-primary/10 text-primary px-2 py-1 rounded-full animate-pulse">Actualizando...</span>
                            </h3>
                            <div className="space-y-4 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                                {activeOrders.map(order => (
                                    <div key={order.id} className="text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 p-3 rounded-md shadow-sm border border-gray-100 dark:border-gray-600">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className={`font-bold px-2 py-1 rounded-md text-xs uppercase tracking-wide ${
                                                order.status === 'Confirmado' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200' :
                                                order.status === 'En Preparación' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200' :
                                                order.status === 'Listo para Retirar/Entregar' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200' :
                                                'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                                            }`}>
                                                {order.status}
                                            </span>
                                            <span className="text-xs text-gray-400 font-mono">
                                                {new Date(order.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </span>
                                        </div>
                                        <ul className="list-disc list-inside pl-1 mt-2 text-xs space-y-1 text-gray-500 dark:text-gray-400">
                                            {order.items.map((item, idx) => (
                                                <li key={idx}>
                                                    <span className="font-semibold text-gray-700 dark:text-gray-300">{item.quantity}x</span> {item.name}
                                                </li>
                                            ))}
                                        </ul>
                                        <div className="text-right font-bold mt-2 text-primary border-t border-gray-100 dark:border-gray-700 pt-2">
                                            Total: ${order.total.toLocaleString('es-AR')}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                     <button
                        onClick={handleStartOrder}
                        className="w-full bg-primary text-white font-bold py-3 px-6 rounded-lg hover:bg-red-700 transition-transform duration-300 ease-in-out transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center justify-center gap-2 mb-4"
                    >
                        <PizzaIcon className="w-5 h-5" />
                        {activeOrders.length > 0 ? 'Agregar más productos' : 'Ver Menú y Pedir'}
                    </button>

                    {activeOrders.length > 0 && (
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={handleCallWaiter}
                                disabled={isCallingWaiter}
                                className="w-full bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold py-3 px-4 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex flex-col items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                            >
                                <BellIcon className="w-6 h-6 text-amber-500" />
                                <span className="text-sm">Solicitar Asistencia</span>
                            </button>
                            
                            {activeOrders.some(o => o.status !== OrderStatus.DINE_IN_PENDING_PAYMENT && o.status !== OrderStatus.COMPLETED_DINE_IN && o.status !== OrderStatus.CANCELLED) ? (
                                <button
                                    onClick={handleRequestBill}
                                    disabled={isRequestingBill}
                                    className="w-full bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold py-3 px-4 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex flex-col items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                                >
                                    <CreditCardIcon className="w-6 h-6 text-green-500" />
                                    <span className="text-sm">Pedir la Cuenta</span>
                                </button>
                            ) : (
                                <div className="w-full bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 font-bold py-3 px-4 rounded-lg border border-green-200 dark:border-green-800 flex flex-col items-center justify-center gap-2 shadow-sm opacity-80 cursor-default">
                                    <CreditCardIcon className="w-6 h-6" />
                                    <span className="text-sm">Cuenta Solicitada</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Toast Notifications */}
                {toasts.map((toast, index) => (
                    <div key={toast.id} style={{ top: `${index * 80 + 20}px` }} className="fixed right-4 z-50 transition-all duration-300">
                        <Toast
                            message={toast.message}
                            type={toast.type}
                            onClose={() => removeToast(toast.id)}
                        />
                    </div>
                ))}
            </div>
        );
    }

    if (viewStatus === 'ordered') {
        // This state is now transient, mostly redirects to welcome, but kept as fallback
        return (
            <div className="flex h-screen w-screen justify-center items-center bg-gray-50 dark:bg-gray-900 p-4">
                <div className="text-center bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg max-w-md">
                    <PizzaIcon className="w-16 h-16 text-primary mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-dark dark:text-light mb-2">¡Pedido enviado!</h1>
                    <p className="text-gray-600 dark:text-gray-300">
                        Tu pedido ha sido enviado a la cocina.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-light dark:bg-dark text-dark dark:text-light font-sans antialiased min-h-screen">
            <header className="bg-white dark:bg-gray-800 shadow-md sticky top-0 z-40">
                 <div className="container mx-auto px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <PizzaIcon className="w-8 h-8 text-primary" />
                      <h1 className="text-2xl font-bold font-display text-dark dark:text-light">Mesa {table?.name}</h1>
                    </div>
                    {/* Access Code Indicator */}
                    {accessCode && (
                        <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">
                            <LockIcon className="w-4 h-4 text-gray-500" />
                            <span className="text-sm font-mono font-bold text-gray-700 dark:text-gray-300">
                                {accessCode}
                            </span>
                        </div>
                    )}
                 </div>
            </header>
            
            <main className="container mx-auto px-6 py-8">
                <div className="space-y-12">
                     {menuItemsByCategory.map(({ name, items }) => (
                         <section key={name}>
                             <h2 className="text-3xl font-bold font-display text-dark dark:text-light mb-6 border-b-2 border-primary pb-2">
                                {name}
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {items.map(item => (
                                    <div key={item.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md border border-gray-100 dark:border-gray-700 flex flex-col h-full transition-all duration-300 hover:-translate-y-1 overflow-hidden group">
                                        {item.imageUrl && (
                                            <div className="relative h-40 w-full overflow-hidden">
                                                <img 
                                                    src={item.imageUrl} 
                                                    alt={item.name} 
                                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                            </div>
                                        )}
                                        <div className="p-4 flex flex-col flex-grow">
                                            <div className="flex justify-between items-start mb-2">
                                                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 leading-tight pr-2">{item.name}</h3>
                                                <span className="text-lg font-bold text-primary whitespace-nowrap bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-lg">
                                                    ${Number(item.price).toLocaleString('es-AR')}
                                                </span>
                                            </div>
                                            {'description' in item && item.description && (
                                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-3 leading-relaxed flex-grow">
                                                    {item.description}
                                                </p>
                                            )}
                                            {'items' in item && (
                                                <div className="mb-3 flex-grow">
                                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Incluye:</p>
                                                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
                                                        {item.items.map(i => `${i.quantity}x ${i.name}`).join(' + ')}
                                                    </p>
                                                </div>
                                            )}
                                            
                                            <button 
                                                onClick={() => addItemToOrder(item)} 
                                                className="mt-auto w-full bg-primary text-white font-bold py-3 px-4 rounded-xl hover:bg-red-600 active:bg-red-700 transition-colors shadow-sm hover:shadow flex items-center justify-center gap-2 group/btn"
                                            >
                                                <span className="group-hover/btn:scale-110 transition-transform duration-200">+</span> Agregar
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                         </section>
                     ))}
                </div>
            </main>
            
            <OrderCart 
                order={order}
                isOpen={isCartOpen}
                setIsOpen={setIsCartOpen}
                onUpdateOrder={handleUpdateOrder}
                onConfirmOrder={handleConfirmOrder}
                onMaxQuantityReached={() => addToast('No puedes pedir más de 10 unidades de un mismo producto.', 'warning')}
            />

            {/* Toast Notifications */}
            {toasts.map((toast, index) => (
                <div key={toast.id} style={{ top: `${index * 80 + 20}px` }} className="fixed right-4 z-50 transition-all duration-300">
                    <Toast
                        message={toast.message}
                        type={toast.type}
                        onClose={() => removeToast(toast.id)}
                    />
                </div>
            ))}

        </div>
    );
};

export default TableOrderView;