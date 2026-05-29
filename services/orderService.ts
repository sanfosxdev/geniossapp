import { OrderStatus, OrderType, PaymentMethod, CreatedBy, type Order, type StatusHistory } from '../types';
import { addNotification } from './notificationService';
import { auth, db, collection, getDocs, doc, setDoc, deleteDoc, writeBatch } from './firebase';

const ORDERS_STORAGE_KEY = 'pizzeria-orders';
const SHEET_NAME = 'Orders';

let ordersCache: Order[] | null = null;

// Helper function to remove undefined properties from an object
const cleanUndefined = (obj: any) => {
  const newObj = { ...obj };
  Object.keys(newObj).forEach(key => {
    if (newObj[key] === undefined) {
      delete newObj[key];
    }
  });
  return newObj;
};

const readApiResponse = async (response: Response): Promise<any> => {
    const text = await response.text();
    if (!text) return {};

    try {
        return JSON.parse(text);
    } catch {
        return { error: text };
    }
};

export const updateCaches = (orders: Order[]) => {
    ordersCache = orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(ordersCache));
};

const initializeOrders = () => {
    try {
        const localData = localStorage.getItem(ORDERS_STORAGE_KEY);
        if (localData) {
            ordersCache = JSON.parse(localData);
        } else {
            ordersCache = [];
        }
    } catch(e) {
        console.error(e);
        ordersCache = [];
    }
};

initializeOrders();

const FINISHED_STATUSES: OrderStatus[] = [
    OrderStatus.COMPLETED_PICKUP,
    OrderStatus.COMPLETED_DELIVERY,
    OrderStatus.COMPLETED_DINE_IN,
    OrderStatus.CANCELLED,
];

export const isOrderFinished = (status: OrderStatus): boolean => {
    return FINISHED_STATUSES.includes(status) || status === ('Completado' as any);
}

export const getOrdersFromCache = (): Order[] => {
    return ordersCache || [];
};

export const fetchAndCacheOrders = async (): Promise<Order[]> => {
    try {
        const querySnapshot = await getDocs(collection(db, SHEET_NAME));
        
        const orders = querySnapshot.docs.map(doc => doc.data() as Order);
        updateCaches(orders);
        return orders;
    } catch (error) {
        console.warn('Failed to fetch orders from Firebase, using local cache.', error);
        return getOrdersFromCache();
    }
};

export const saveOrder = async (orderData: Omit<Order, 'id' | 'status' | 'createdAt' | 'statusHistory' | 'finishedAt' | 'isPaid'>): Promise<Order> => {
  try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/orders', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(cleanUndefined(orderData)),
      });

      const data = await readApiResponse(response);
      if (!response.ok) {
          throw new Error(data.error || 'Error al guardar pedido en la nube.');
      }

      return data as Order;
  } catch (e) {
      throw new Error(`Error al guardar pedido en la nube: ${e instanceof Error ? e.message : String(e)}`);
  }
};

export const updateOrder = async (orderUpdates: Partial<Order> & { id: string }): Promise<Order> => {
    const orders = getOrdersFromCache();
    const orderIndex = orders.findIndex(o => o.id === orderUpdates.id);
    if (orderIndex === -1) throw new Error("Order not found");

    const updatedOrder = { ...orders[orderIndex], ...orderUpdates };
    
    try {
        await setDoc(doc(db, SHEET_NAME, updatedOrder.id), cleanUndefined(updatedOrder));
        // Optimistic update removed to let Firebase listener handle it
        return updatedOrder;
    } catch (e) {
        throw new Error(`Error al actualizar pedido en la nube: ${e instanceof Error ? e.message : String(e)}`);
    }
};

export const updateOrderStatus = async (orderId: string, status: OrderStatus): Promise<Order> => {
    const orders = getOrdersFromCache();
    const orderIndex = orders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) throw new Error(`Order with id ${orderId} not found.`);
    
    const order = { ...orders[orderIndex] };

    if (isOrderFinished(order.status)) return order;

    // Allow completion if it's being marked as paid simultaneously or if it's already paid.
    // But here we only check current state. The frontend should handle marking as paid before or during this call if needed.
    // However, for Cash on Delivery/Pickup, we might want to allow the transition and mark as paid automatically?
    // For now, let's stick to the rule: Must be paid to be COMPLETED.
    if ((status === OrderStatus.COMPLETED_PICKUP || status === OrderStatus.COMPLETED_DELIVERY || status === OrderStatus.COMPLETED_DINE_IN) && !order.isPaid) {
        throw new Error('No se puede completar un pedido cuyo pago no ha sido aprobado. Por favor, registre el pago primero.');
    }

    // Relaxed rule: Delivery orders CAN go to PREPARING even if unpaid, especially for Cash.
    // Only block if strict prepayment is required (which we assume is not for Cash).
    // if (order.status === OrderStatus.CONFIRMED && status === OrderStatus.PREPARING && order.type === OrderType.DELIVERY && !order.isPaid) {
    //    // Optional: Only block if NOT cash?
    //    // For now, removing this block to allow flexibility as requested.
    // }
    
    order.status = status;
    order.statusHistory.push({ status, startedAt: new Date().toISOString() });

    if (isOrderFinished(status)) {
        order.finishedAt = new Date().toISOString();
        if (status !== OrderStatus.CANCELLED) order.isPaid = true;
    }
    
    try {
        await setDoc(doc(db, SHEET_NAME, order.id), cleanUndefined(order));
        // Optimistic update removed to let Firebase listener handle it
        addNotification({ message: `El pedido #${order.id.split('-')[1]} (${order.customer.name}) cambió a: ${status}.`, type: 'order', relatedId: order.id });
        return order;
    } catch (e) {
        throw new Error(`Error al actualizar estado en la nube: ${e instanceof Error ? e.message : String(e)}`);
    }
};

export const markOrderAsPaid = async (orderId: string, paymentMethod: PaymentMethod, paymentProofUrl?: string | null): Promise<Order> => {
    const orders = getOrdersFromCache();
    const orderIndex = orders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) throw new Error(`Order with id ${orderId} not found.`);
    
    const order = { ...orders[orderIndex] };
    order.isPaid = true;
    order.paymentMethod = paymentMethod;
    if (paymentProofUrl !== undefined) order.paymentProofUrl = paymentProofUrl;
    
    if (order.status === OrderStatus.DINE_IN_PENDING_PAYMENT) {
        order.status = OrderStatus.COMPLETED_DINE_IN;
        const now = new Date().toISOString();
        if (!order.statusHistory) order.statusHistory = [];
        order.statusHistory.push({ status: OrderStatus.COMPLETED_DINE_IN, startedAt: now });
    }
    
    try {
        await setDoc(doc(db, SHEET_NAME, order.id), cleanUndefined(order));
        // Optimistic update removed to let Firebase listener handle it
        addNotification({ message: `Se aprobó el pago para el pedido #${orderId.split('-')[1]} de ${order.customer.name}.`, type: 'order', relatedId: orderId });
        return order;
    } catch (e) {
        throw new Error(`Error al actualizar pago en la nube: ${e instanceof Error ? e.message : String(e)}`);
    }
};

export const deleteOrder = async (orderId: string): Promise<void> => {
    try {
        await deleteDoc(doc(db, SHEET_NAME, orderId));
        // Optimistic update removed to let Firebase listener handle it
    } catch (e) {
        throw new Error(`Error al eliminar pedido en la nube: ${e instanceof Error ? e.message : String(e)}`);
    }
};
