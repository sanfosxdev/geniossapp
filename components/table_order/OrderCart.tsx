import React from 'react';
import type { Order, OrderItem } from '../../types';
import { ShoppingCartIcon } from '../icons/ShoppingCartIcon';
import { CloseIcon } from '../icons/CloseIcon';
import { TrashIcon } from '../icons/TrashIcon';

interface OrderCartProps {
    order: Order | null;
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    onUpdateOrder: (items: OrderItem[]) => void;
    onConfirmOrder: () => void;
    onMaxQuantityReached?: () => void;
}

const OrderCart: React.FC<OrderCartProps> = ({ order, isOpen, setIsOpen, onUpdateOrder, onConfirmOrder, onMaxQuantityReached }) => {
    
    const itemCount = order?.items.reduce((sum, item) => sum + item.quantity, 0) || 0;

    const handleQuantityChange = (itemId: string, newQuantity: number) => {
        if (!order) return;
        if (newQuantity > 10) {
            if (onMaxQuantityReached) onMaxQuantityReached();
            return;
        }
        let newItems: OrderItem[];
        if (newQuantity <= 0) {
            newItems = order.items.filter(i => i.itemId !== itemId);
        } else {
            newItems = order.items.map(i => i.itemId === itemId ? { ...i, quantity: newQuantity } : i);
        }
        onUpdateOrder(newItems);
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 bg-secondary text-dark w-16 h-16 rounded-full flex items-center justify-center shadow-lg transform transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary dark:focus:ring-offset-dark z-50 group"
                aria-label="Ver pedido"
            >
                <ShoppingCartIcon className="w-8 h-8 group-hover:animate-bounce" />
                {itemCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white text-xs font-bold shadow-sm border-2 border-white dark:border-gray-800">
                        {itemCount}
                    </span>
                )}
            </button>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center animate-fade-in p-0 sm:p-4">
            <div className="bg-white dark:bg-gray-800 w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[85vh] flex flex-col transform animate-slide-in-up transition-all">
                <header className="flex justify-between items-center p-5 border-b border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/10 p-2 rounded-full">
                            <ShoppingCartIcon className="w-6 h-6 text-primary" />
                        </div>
                        <h3 className="text-xl font-bold font-display text-gray-800 dark:text-gray-100">Tu Pedido</h3>
                    </div>
                    <button onClick={() => setIsOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                        <CloseIcon className="w-6 h-6" />
                    </button>
                </header>
                
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {(!order || order.items.length === 0) ? (
                        <div className="text-center py-12 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
                            <ShoppingCartIcon className="w-16 h-16 mb-4 opacity-20" />
                            <p className="text-lg font-medium">Tu pedido está vacío</p>
                            <p className="text-sm mt-1">¡Agrega algunas delicias del menú!</p>
                        </div>
                    ) : (
                        <ul className="space-y-4">
                            {order.items.map(item => (
                                <li key={item.itemId} className="flex items-center gap-4 bg-gray-50 dark:bg-gray-700/30 p-3 rounded-xl border border-gray-100 dark:border-gray-700/50">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-gray-800 dark:text-gray-100 truncate">{item.name}</p>
                                        <p className="text-sm text-primary font-bold mt-0.5">${Number(item.price).toLocaleString('es-AR')}</p>
                                    </div>
                                    
                                    <div className="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-lg p-1 shadow-sm border border-gray-200 dark:border-gray-600">
                                        <button 
                                            onClick={() => handleQuantityChange(item.itemId, item.quantity - 1)} 
                                            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors font-bold text-lg"
                                        >
                                            -
                                        </button>
                                        <span className="w-6 text-center font-bold text-gray-800 dark:text-gray-100">{item.quantity}</span>
                                        <button 
                                            onClick={() => handleQuantityChange(item.itemId, item.quantity + 1)} 
                                            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-primary transition-colors font-bold text-lg"
                                        >
                                            +
                                        </button>
                                    </div>
                                    
                                    <div className="text-right min-w-[4rem]">
                                        <p className="font-bold text-gray-900 dark:text-white">
                                            ${(item.price * item.quantity).toLocaleString('es-AR')}
                                        </p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                
                 <footer className="p-5 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-2xl">
                    <div className="flex justify-between items-end mb-4">
                        <span className="text-gray-600 dark:text-gray-400 font-medium">Total a pagar</span>
                        <span className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                            ${(order?.total || 0).toLocaleString('es-AR')}
                        </span>
                    </div>
                    <button 
                        onClick={onConfirmOrder}
                        disabled={!order || order.items.length === 0}
                        className="w-full bg-primary text-white font-bold py-4 px-6 rounded-xl hover:bg-red-600 active:bg-red-700 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed disabled:shadow-none disabled:transform-none flex justify-center items-center gap-2"
                    >
                        <span>Confirmar Pedido</span>
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default OrderCart;
