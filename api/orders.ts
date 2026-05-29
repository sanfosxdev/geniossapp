import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cleanUndefinedDeep, getAdminDb, getRequestRole, roleCanManageOrders } from './_firebaseAdmin';
import { CreatedBy, OrderStatus } from '../types';

const allowedOrderTypes = new Set(['pickup', 'delivery', 'dine-in']);
const allowedPaymentMethods = new Set(['Efectivo', 'Credito', 'Transferencia']);

const isObject = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isString = (value: unknown, max = 500): value is string => (
  typeof value === 'string' && value.trim().length > 0 && value.length <= max
);

const validateOrderPayload = (payload: Record<string, unknown>) => {
  if (!isObject(payload.customer)) throw new Error('Cliente invalido.');
  if (!isString(payload.customer.name, 80)) throw new Error('Nombre del cliente invalido.');
  if (!Array.isArray(payload.items) || payload.items.length === 0 || payload.items.length > 50) {
    throw new Error('Items del pedido invalidos.');
  }
  if (typeof payload.total !== 'number' || payload.total < 0 || payload.total > 10000000) {
    throw new Error('Total del pedido invalido.');
  }
  if (!isString(payload.type, 20) || !allowedOrderTypes.has(payload.type)) {
    throw new Error('Tipo de pedido invalido.');
  }
  if (!isString(payload.paymentMethod, 40) || !allowedPaymentMethods.has(payload.paymentMethod)) {
    throw new Error('Metodo de pago invalido.');
  }

  payload.items.forEach((item) => {
    if (!isObject(item)) throw new Error('Item invalido.');
    if (!isString(item.name, 120)) throw new Error('Nombre de item invalido.');
    if (typeof item.quantity !== 'number' || item.quantity < 1 || item.quantity > 99) {
      throw new Error('Cantidad de item invalida.');
    }
    if (typeof item.price !== 'number' || item.price < 0 || item.price > 10000000) {
      throw new Error('Precio de item invalido.');
    }
  });
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const payload = isObject(req.body) ? req.body : {};
    validateOrderPayload(payload);
    const role = await getRequestRole(req).catch(() => null);
    const isStaff = roleCanManageOrders(role);

    const now = new Date().toISOString();
    const id = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const order = cleanUndefinedDeep({
      ...payload,
      id,
      status: OrderStatus.PENDING,
      createdAt: now,
      statusHistory: [{ status: OrderStatus.PENDING, startedAt: now }],
      finishedAt: null,
      isPaid: Boolean(payload.paymentProofUrl),
      createdBy: isStaff && payload.createdBy === CreatedBy.ADMIN
        ? CreatedBy.ADMIN
        : (payload.createdBy === CreatedBy.WHATSAPP_ASSISTANT ? CreatedBy.WHATSAPP_ASSISTANT : CreatedBy.WEB_ASSISTANT),
    });

    await getAdminDb().collection('Orders').doc(id).set(order);
    return res.status(201).json(order);
  } catch (error) {
    console.error('Error creating order:', error);
    const message = error instanceof Error ? error.message : 'No se pudo crear el pedido.';
    return res.status(500).json({ error: message });
  }
}
