import React, { useState, useEffect, useMemo } from 'react';
import type { Order, OrderItem, Product, Table, Customer, Reservation, Promotion } from '../../types';
import { OrderType, PaymentMethod } from '../../types';
import { getProductsFromCache as getProducts } from '../../services/productService';
import { getPromotionsFromCache as getPromotions } from '../../services/promotionService';
import { getTablesFromCache as getTables, getAvailableTablesForDineIn } from '../../services/tableService';
import { getCustomersFromCache as getCustomers } from '../../services/customerService';
import { CloseIcon } from '../icons/CloseIcon';
import { PlusIcon } from '../icons/PlusIcon';
import { TrashIcon } from '../icons/TrashIcon';
import { ChevronDownIcon } from '../icons/ChevronDownIcon';
import { Spinner } from './Spinner';

interface AddOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (order: Omit<Order, 'id' | 'status' | 'createdAt' | 'statusHistory' | 'finishedAt' | 'isPaid' | 'createdBy'> & { id?: string }) => void;
  orderToEdit?: Order | null;
  preselectedTableIds?: string[] | null;
  reservationToConvert?: Reservation | null;
  isSaving?: boolean;
  isStoreOpen?: boolean;
  fixedGuests?: number;
  fixedCustomer?: { name: string; phone?: string; address?: string };
  bypassAvailabilityCheck?: boolean;
}

const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
};

const findTableCombination = (availableTables: Table[], guests: number): Table[] | null => {
    // 1. Try to find a single table that fits
    const singleFit = availableTables
        .filter(t => t.capacity >= guests)
        .sort((a, b) => a.capacity - b.capacity)[0];
    if (singleFit) {
        return [singleFit];
    }
    
    // 2. If no single table fits, try a greedy approach for a combination
    const sortedTables = [...availableTables].sort((a, b) => b.capacity - a.capacity); // Descending capacity
    const selectedTables: Table[] = [];
    let currentCapacity = 0;
    
    for (const table of sortedTables) {
        if (currentCapacity < guests) {
            selectedTables.push(table);
            currentCapacity += table.capacity;
        }
    }

    if (currentCapacity >= guests) {
        return selectedTables;
    }

    return null; // No combination found
}

const AddOrderModal: React.FC<AddOrderModalProps> = ({ isOpen, onClose, onSave, orderToEdit, preselectedTableIds, reservationToConvert, isSaving, isStoreOpen = true, fixedGuests, fixedCustomer, bypassAvailabilityCheck }) => {
  // State variables
  const [customer, setCustomer] = useState<{ name: string; phone?: string; address?: string; }>({ name: '', phone: '', address: '' });
  const [items, setItems] = useState<OrderItem[]>([]);
  const [orderType, setOrderType] = useState<OrderType>(OrderType.PICKUP);
  const [guests, setGuests] = useState(1);
  const [tableIds, setTableIds] = useState<string[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);
  
  // Data lists
  const [products, setProducts] = useState<Product[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [allTables, setAllTables] = useState<Table[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  
  // Control state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('new_customer');
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const isEditing = !!orderToEdit;
  const isConvertingReservation = !!reservationToConvert;

  useEffect(() => {
    if (isOpen) {
      // Fetch all necessary data
      setProducts(getProducts());
      setPromotions(getPromotions().filter(p => p.isActive));
      setAllTables(getTables());
      setCustomers(getCustomers());
      setSubmissionError(null);

      if (reservationToConvert) {
        setOrderType(OrderType.DINE_IN);
        setSelectedCustomerId(''); 
        setCustomer({ name: reservationToConvert.customerName, phone: reservationToConvert.customerPhone || '' });
        setItems([]);
        setGuests(reservationToConvert.guests);
        setTableIds(reservationToConvert.tableIds);
        setPaymentMethod(PaymentMethod.CASH);
        setPaymentProofFile(null);
      } else if (orderToEdit) {
        setOrderType(orderToEdit.type);
        const existingCustomer = getCustomers().find(c => c.name === orderToEdit.customer.name && c.phone === orderToEdit.customer.phone);
        setSelectedCustomerId(existingCustomer ? existingCustomer.id : 'new_customer');
        setCustomer(orderToEdit.customer);
        setItems(orderToEdit.items);
        setGuests(orderToEdit.guests || 1);
        setTableIds(orderToEdit.tableIds || []);
        setPaymentMethod(orderToEdit.paymentMethod || PaymentMethod.CASH);
        setPaymentProofFile(null);
      } else if (preselectedTableIds) {
        setOrderType(OrderType.DINE_IN);
        
        if (fixedCustomer) {
             const existingCustomer = getCustomers().find(c => c.name === fixedCustomer.name && c.phone === fixedCustomer.phone);
             setSelectedCustomerId(existingCustomer ? existingCustomer.id : 'new_customer');
             setCustomer(fixedCustomer);
        } else {
            setSelectedCustomerId('new_customer');
            setCustomer({ name: '', phone: '', address: '' });
        }

        setItems([]);
        setGuests(fixedGuests || 1);
        setTableIds(preselectedTableIds);
        setPaymentMethod(PaymentMethod.CASH);
        setPaymentProofFile(null);
      } else {
        setOrderType(OrderType.PICKUP);
        setSelectedCustomerId('new_customer');
        setCustomer({ name: '', phone: '', address: '' });
        setItems([]);
        setGuests(1);
        setTableIds([]);
        setPaymentMethod(PaymentMethod.CASH);
        setPaymentProofFile(null);
      }
    }
  }, [isOpen, orderToEdit, preselectedTableIds, reservationToConvert, fixedGuests, fixedCustomer]);
  
  useEffect(() => {
    if (orderType === OrderType.DELIVERY) {
        // Default to TRANSFER but allow CASH
        setPaymentMethod(PaymentMethod.TRANSFER);
    } else if (orderType !== OrderType.DINE_IN) {
        setPaymentMethod(PaymentMethod.CASH);
    }
  }, [orderType]);

  const total = useMemo(() => {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [items]);

  const handleCustomerSelect = (customerId: string) => {
    setSelectedCustomerId(customerId);
    if (customerId === 'new_customer') {
        setCustomer({ name: '', phone: '', address: '' });
    } else {
        const selected = customers.find(c => c.id === customerId);
        if (selected) {
            setCustomer({
                name: selected.name,
                phone: selected.phone || '',
                address: selected.address || '',
            });
        }
    }
  };

  const handleCustomerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomer({ ...customer, [e.target.name]: e.target.value });
    setSelectedCustomerId('new_customer'); // When user types, it becomes a custom entry
  };
  
  const handleTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newType = e.target.value as OrderType;
    setOrderType(newType);
    if (newType !== OrderType.DELIVERY) {
      setCustomer(c => ({ ...c, address: '' }));
    }
    if (newType !== OrderType.DINE_IN) {
      setTableIds([]);
      setGuests(1);
    } else {
      setSelectedCustomerId('new_customer');
      setCustomer({ name: '', phone: '', address: '' });
    }
  };

  const handleAddProduct = () => {
    if (products.length > 0) {
      const firstProduct = products[0];
      setItems([...items, { name: firstProduct.name, quantity: 1, price: Number(firstProduct.price), isPromotion: false, itemId: firstProduct.id }]);
    }
  };
  
  const handleAddPromotion = () => {
    if (promotions.length > 0) {
      const firstPromo = promotions[0];
      setItems([...items, { name: firstPromo.name, quantity: 1, price: firstPromo.price, isPromotion: true, itemId: firstPromo.id }]);
    }
  };

  const handleItemChange = (index: number, field: 'name' | 'quantity', value: string | number) => {
    const newItems = [...items];
    const currentItem = newItems[index];

    if (field === 'name') {
        if(currentItem.isPromotion) {
            const selectedPromotion = promotions.find(p => p.name === value);
            if(selectedPromotion) {
                newItems[index] = { ...newItems[index], name: selectedPromotion.name, price: selectedPromotion.price, itemId: selectedPromotion.id };
            }
        } else {
            const selectedProduct = products.find(p => p.name === value);
            if(selectedProduct) {
                newItems[index] = { ...newItems[index], name: selectedProduct.name, price: Number(selectedProduct.price), itemId: selectedProduct.id };
            }
        }
    } else { // quantity
        const newQuantity = Number(value);
        if (newQuantity > 10) {
            alert('No puedes pedir más de 10 unidades de un mismo producto.');
            newItems[index] = { ...newItems[index], [field]: 10 };
        } else {
            newItems[index] = { ...newItems[index], [field]: newQuantity };
        }
    }
    setItems(newItems);
  };
  
  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        setPaymentProofFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmissionError(null);

    if (!isEditing && !isStoreOpen) {
      setSubmissionError('No se pueden crear pedidos nuevos mientras el local está cerrado.');
      return;
    }

    if (!isConvertingReservation && orderType !== OrderType.DINE_IN && !customer.name) {
      setSubmissionError('Por favor, ingresa el nombre del cliente.');
      return;
    }
     if (items.length === 0) {
      setSubmissionError('Por favor, agrega al menos un artículo.');
      return;
    }

    // Check for reservation conversion
    if (isConvertingReservation && reservationToConvert) {
        const availableTables = getAvailableTablesForDineIn(reservationToConvert.id);
        const availableTableIds = new Set(availableTables.map(t => t.id));
        const allReservedTablesAreAvailable = reservationToConvert.tableIds.every(id => availableTableIds.has(id));

        if (!allReservedTablesAreAvailable) {
            setSubmissionError('Una o más mesas de esta reserva ya no están disponibles. Libera la mesa primero.');
            return;
        }
    }
    
    // Check for pre-selected tables from TablesPanel
    if (!isEditing && !isConvertingReservation && preselectedTableIds && preselectedTableIds.length > 0) {
        if (!bypassAvailabilityCheck) {
            const availableTables = getAvailableTablesForDineIn();
            const availableTableIds = new Set(availableTables.map(t => t.id));
            const allPreselectedTablesAreAvailable = preselectedTableIds.every(id => availableTableIds.has(id));

            if (!allPreselectedTablesAreAvailable) {
                setSubmissionError('La mesa seleccionada ya no está disponible. Refresca el panel y vuelve a intentarlo.');
                return;
            }
        }

        // Validate capacity for pre-selected tables
        const totalCapacity = preselectedTableIds.reduce((sum, id) => {
            const t = allTables.find(table => table.id === id);
            return sum + (t?.capacity || 0);
        }, 0);

        if (guests > totalCapacity) {
            setSubmissionError(`El número de comensales (${guests}) excede la capacidad de la mesa (${totalCapacity}).`);
            return;
        }
    }

    let finalTableIds = tableIds;
    if (orderType === OrderType.DINE_IN && !isEditing && !isConvertingReservation && (!preselectedTableIds || preselectedTableIds.length === 0)) {
        if (guests <= 0) {
            setSubmissionError('El número de comensales debe ser mayor a 0.');
            return;
        }
        const availableTables = getAvailableTablesForDineIn();
        const foundCombination = findTableCombination(availableTables, guests);
        if (!foundCombination) {
            setSubmissionError('No hay mesas disponibles para el número de comensales especificado.');
            return;
        }
        finalTableIds = foundCombination.map(t => t.id);
    }
    
    let paymentProofUrl: string | null | undefined = orderToEdit?.paymentProofUrl;
    if (paymentProofFile) {
        paymentProofUrl = await fileToDataUrl(paymentProofFile);
    }
    
    const finalCustomerName = (orderType === OrderType.DINE_IN && !customer.name.trim() && finalTableIds.length > 0)
      ? `Mesa ${allTables.find(t => t.id === finalTableIds[0])?.name || ''}`
      : customer.name;

    const orderData = {
      id: orderToEdit?.id,
      customer: {
        ...customer,
        name: finalCustomerName,
      },
      items,
      total,
      type: orderType,
      tableIds: orderType === OrderType.DINE_IN ? finalTableIds : undefined,
      guests: orderType === OrderType.DINE_IN ? guests : undefined,
      paymentMethod: orderType === OrderType.DINE_IN && !isEditing ? PaymentMethod.CASH : paymentMethod,
      paymentProofUrl,
      reservationId: reservationToConvert?.id,
    };
    onSave(orderData);
  };
  
  const assignedTableNames = useMemo(() => {
      if (orderType !== OrderType.DINE_IN || !tableIds || tableIds.length === 0) return 'Se asignará automáticamente';
      return tableIds.map(id => allTables.find(t => t.id === id)?.name || id).join(', ');
  }, [orderType, tableIds, allTables]);

  const accessCode = useMemo(() => {
      if (orderType === OrderType.DINE_IN && tableIds && tableIds.length === 1) {
          const table = allTables.find(t => t.id === tableIds[0]);
          return table?.accessCode;
      }
      return null;
  }, [orderType, tableIds, allTables]);

  const maxGuests = useMemo(() => {
    if (orderType === OrderType.DINE_IN && tableIds.length > 0) {
        return tableIds.reduce((acc, id) => {
            const table = allTables.find(t => t.id === id);
            return acc + (table?.capacity || 0);
        }, 0);
    }
    return 100;
  }, [orderType, tableIds, allTables]);


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl transform animate-slide-in-up max-h-[90vh] flex flex-col">
        <header className="flex justify-between items-center p-5 border-b dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{isEditing ? 'Editar Pedido' : isConvertingReservation ? 'Crear Pedido para Reserva' : 'Agregar Nuevo Pedido'}</h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white"><CloseIcon className="w-6 h-6" /></button>
        </header>
        <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto">
          <div className="p-6 space-y-6">
            
            {!isEditing && !isStoreOpen && (
                <div className="p-3 mb-2 rounded-md bg-yellow-100 border border-yellow-300 text-yellow-800 text-sm font-semibold text-center">
                    <strong>Atención:</strong> El local está actualmente cerrado. No se pueden crear nuevos pedidos.
                </div>
            )}
            
            {/* 1. Delivery Method */}
            <fieldset className="border dark:border-gray-600 p-4 rounded-md">
                <legend className="text-lg font-semibold px-2 text-gray-700 dark:text-gray-200">Forma de Entrega</legend>
                 <div className="mt-2 text-gray-800 dark:text-gray-200">
                    <div className="flex flex-col sm:flex-row flex-wrap gap-4">
                        <label className="flex items-center"><input type="radio" name="orderType" value={OrderType.PICKUP} checked={orderType === OrderType.PICKUP} onChange={handleTypeChange} disabled={isConvertingReservation || isEditing || (!!preselectedTableIds && preselectedTableIds.length > 0)} className="mr-2 h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-gray-500"/>Retira de Local</label>
                        <label className="flex items-center"><input type="radio" name="orderType" value={OrderType.DELIVERY} checked={orderType === OrderType.DELIVERY} onChange={handleTypeChange} disabled={isConvertingReservation || isEditing || (!!preselectedTableIds && preselectedTableIds.length > 0)} className="mr-2 h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-gray-500"/>Envío a Domicilio</label>
                        <label className="flex items-center"><input type="radio" name="orderType" value={OrderType.DINE_IN} checked={orderType === OrderType.DINE_IN} onChange={handleTypeChange} disabled={isConvertingReservation || isEditing || (!!preselectedTableIds && preselectedTableIds.length > 0)} className="mr-2 h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-gray-500"/>En Mesa</label>
                    </div>
                </div>
                {orderType === OrderType.DELIVERY && (
                  <div className="mt-4 animate-fade-in">
                      <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Dirección de Envío</label>
                      <input id="address" name="address" value={customer.address || ''} onChange={handleCustomerChange} placeholder="Calle, número, ciudad" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary" required/>
                  </div>
                )}
                 {orderType === OrderType.DINE_IN && (
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
                    <div>
                        <label htmlFor="guests" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Comensales {preselectedTableIds && preselectedTableIds.length > 0 && <span className="text-xs text-gray-500">(Máx: {maxGuests})</span>}</label>
                        <input 
                            id="guests" 
                            name="guests" 
                            type="number" 
                            value={guests} 
                            onChange={(e) => {
                                const val = Number(e.target.value);
                                if (preselectedTableIds && preselectedTableIds.length > 0 && val > maxGuests) {
                                    return; // Prevent exceeding capacity
                                }
                                setGuests(val);
                            }} 
                            min="1" 
                            max={preselectedTableIds && preselectedTableIds.length > 0 ? maxGuests : undefined}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:text-gray-500" 
                            required 
                            disabled={isConvertingReservation || isEditing || !!fixedGuests}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mesa(s) Asignada(s)</label>
                        <div className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600/50 rounded-md text-gray-600 dark:text-gray-400 min-h-[42px] flex items-center justify-between">
                            <span>{assignedTableNames}</span>
                            {accessCode && (
                                <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-1 rounded-md">
                                    Código: {accessCode}
                                </span>
                            )}
                        </div>
                    </div>
                  </div>
                )}
            </fieldset>

            {/* 2. Customer Details */}
            <fieldset className="border dark:border-gray-600 p-4 rounded-md">
              <legend className="text-lg font-semibold px-2 text-gray-700 dark:text-gray-200">Detalles del Cliente</legend>
              <div className="mt-2 space-y-4">
                  {orderType === OrderType.DINE_IN ? (
                     <div className="animate-fade-in">
                        {isConvertingReservation ? (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Creando pedido para la reserva de <strong className="dark:text-white">{customer.name}</strong>.</p>
                        ) : (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Para pedidos en mesa, se registra como cliente ocasional. Puedes añadir un nombre de referencia si lo deseas.</p>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input name="name" value={customer.name || ''} onChange={handleCustomerChange} placeholder="Nombre (Opcional)" disabled={isConvertingReservation || !!fixedCustomer} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary disabled:bg-gray-100 dark:disabled:bg-gray-600"/>
                            <input name="phone" value={customer.phone || ''} onChange={handleCustomerChange} placeholder="Teléfono (Opcional)" disabled={isConvertingReservation || !!fixedCustomer} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary disabled:bg-gray-100 dark:disabled:bg-gray-600"/>
                        </div>
                    </div>
                  ) : (
                    <>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cliente</label>
                            <select value={selectedCustomerId} onChange={e => handleCustomerSelect(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary">
                                <option value="new_customer">-- Nuevo Cliente --</option>
                                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input name="name" value={customer.name || ''} onChange={handleCustomerChange} placeholder="Nombre" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary" required/>
                            <input name="phone" value={customer.phone || ''} onChange={handleCustomerChange} placeholder="Teléfono" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"/>
                        </div>
                    </>
                  )}
              </div>
            </fieldset>

            {/* 3. Order Items */}
            <fieldset className="border dark:border-gray-600 p-4 rounded-xl bg-white dark:bg-gray-800/50 shadow-sm">
                <legend className="text-lg font-bold px-2 text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    <span>Artículos del Pedido</span>
                    <span className="text-sm font-normal text-gray-500 dark:text-gray-400">({items.length})</span>
                </legend>
                <div className="space-y-3 mt-4">
                    {items.length === 0 ? (
                        <div className="text-center py-8 text-gray-400 dark:text-gray-500 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
                            <p>No hay artículos en el pedido.</p>
                            <p className="text-sm">Agrega productos o promociones abajo.</p>
                        </div>
                    ) : (
                        items.map((item, index) => (
                            <div key={index} className="flex flex-col sm:flex-row items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-100 dark:border-gray-700 hover:border-primary/30 transition-colors group">
                                <div className="relative w-full sm:flex-1">
                                    <select
                                        value={item.name}
                                        onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                                        className="w-full appearance-none bg-white dark:bg-gray-800 dark:text-white px-3 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all font-medium"
                                    >
                                        {item.isPromotion 
                                            ? promotions.map(p => <option key={p.id} value={p.name}>{p.name}</option>)
                                            : products.map(p => <option key={p.id} value={p.name}>{p.name}</option>)
                                        }
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500 dark:text-gray-400">
                                        <ChevronDownIcon className="h-4 w-4" />
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
                                    <div className="flex items-center">
                                        <label className="sr-only">Cantidad</label>
                                        <input
                                            type="number"
                                            value={item.quantity}
                                            onChange={(e) => handleItemChange(index, 'quantity', Number(e.target.value))}
                                            min="1"
                                            max="10"
                                            className="w-20 px-2 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-md shadow-sm text-center focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-bold"
                                        />
                                    </div>
                                    
                                    <span className="w-24 text-right font-bold text-gray-800 dark:text-gray-200 text-lg">
                                        ${(item.price * item.quantity).toLocaleString('es-AR')}
                                    </span>
                                    
                                    <button 
                                        type="button" 
                                        onClick={() => handleRemoveItem(index)} 
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                                        title="Eliminar artículo"
                                    >
                                        <TrashIcon className="w-5 h-5"/>
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
                <div className="flex flex-wrap gap-3 mt-4">
                  <button 
                    type="button" 
                    onClick={handleAddProduct} 
                    className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2 border border-primary text-primary hover:bg-primary hover:text-white rounded-md transition-colors font-medium text-sm"
                  >
                    <PlusIcon className="w-4 h-4 mr-2"/> Agregar Producto
                  </button>
                   <button 
                    type="button" 
                    onClick={handleAddPromotion} 
                    className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2 border border-purple-600 text-purple-600 hover:bg-purple-600 hover:text-white rounded-md transition-colors font-medium text-sm dark:border-purple-400 dark:text-purple-400 dark:hover:bg-purple-500 dark:hover:text-white"
                  >
                    <PlusIcon className="w-4 h-4 mr-2"/> Agregar Promoción
                  </button>
                </div>
            </fieldset>
            
            {/* 4. Payment and Total */}
            {orderType !== OrderType.DINE_IN && (
                <fieldset className="border dark:border-gray-600 p-4 rounded-xl bg-white dark:bg-gray-800/50 shadow-sm">
                    <legend className="text-lg font-bold px-2 text-gray-800 dark:text-gray-100">Pago</legend>
                    <div className="mt-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <label className={`
                                cursor-pointer flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all
                                ${paymentMethod === PaymentMethod.CASH 
                                    ? 'border-primary bg-primary/5 text-primary dark:bg-primary/10' 
                                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-600 dark:text-gray-400'}
                            `}>
                                <input type="radio" name="paymentMethod" value={PaymentMethod.CASH} checked={paymentMethod === PaymentMethod.CASH} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)} className="sr-only"/>
                                <span className="font-semibold">Efectivo</span>
                            </label>
                            
                            <label className={`
                                cursor-pointer flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all
                                ${paymentMethod === PaymentMethod.CREDIT 
                                    ? 'border-primary bg-primary/5 text-primary dark:bg-primary/10' 
                                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-600 dark:text-gray-400'}
                            `}>
                                <input type="radio" name="paymentMethod" value={PaymentMethod.CREDIT} checked={paymentMethod === PaymentMethod.CREDIT} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)} className="sr-only"/>
                                <span className="font-semibold">Crédito</span>
                            </label>
                            
                            <label className={`
                                cursor-pointer flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all
                                ${paymentMethod === PaymentMethod.TRANSFER 
                                    ? 'border-primary bg-primary/5 text-primary dark:bg-primary/10' 
                                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-600 dark:text-gray-400'}
                            `}>
                                <input type="radio" name="paymentMethod" value={PaymentMethod.TRANSFER} checked={paymentMethod === PaymentMethod.TRANSFER} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)} className="sr-only"/>
                                <span className="font-semibold">Transferencia</span>
                            </label>
                        </div>
                    </div>
                    {paymentMethod === PaymentMethod.TRANSFER && (
                        <div className="mt-4 p-4 border-l-4 border-blue-400 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-500 animate-fade-in rounded-r-lg">
                            <h4 className="font-semibold text-blue-800 dark:text-blue-300">Datos para la Transferencia</h4>
                            <p className="text-sm text-blue-700 dark:text-blue-400 mt-1 font-mono bg-white/50 dark:bg-black/20 p-2 rounded">
                                <strong>CBU:</strong> 1234567890123456789012<br/>
                                <strong>Alias:</strong> PIZZERIA.LOS.GENIOS
                            </p>
                            <div className="mt-3">
                                <label htmlFor="paymentProof" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subir Comprobante (Opcional)</label>
                                <input type="file" id="paymentProof" onChange={handleFileChange} accept="image/*" className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-red-700 transition-colors cursor-pointer"/>
                            </div>
                        </div>
                    )}
                </fieldset>
            )}

            <div className="flex justify-end items-center bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                <span className="text-gray-600 dark:text-gray-300 font-medium mr-3">Total del Pedido:</span>
                <span className="text-3xl font-bold text-primary">${total.toLocaleString('es-AR')}</span>
            </div>
          </div>
          <footer className="flex justify-end items-center p-5 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-lg sticky bottom-0">
            {submissionError && <p className="text-sm text-red-600 dark:text-red-400 mr-auto">{submissionError}</p>}
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 dark:border-gray-500 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">Cancelar</button>
            <button type="submit" disabled={isSaving || (!isEditing && !isStoreOpen)} className="ml-3 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-red-700 min-w-[150px] flex justify-center items-center disabled:opacity-50 disabled:bg-gray-400">
              {isSaving ? <Spinner /> : (isEditing ? 'Guardar Cambios' : 'Guardar Pedido')}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default AddOrderModal;