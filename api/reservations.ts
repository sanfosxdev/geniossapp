import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cleanUndefinedDeep, getAdminDb, getRequestRole, roleCanManageReservations } from './_firebaseAdmin';
import { CreatedBy, ReservationStatus } from '../types';

const isObject = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isString = (value: unknown, max = 500): value is string => (
  typeof value === 'string' && value.trim().length > 0 && value.length <= max
);

const validateReservationPayload = (payload: Record<string, unknown>) => {
  if (!isString(payload.customerName, 80)) throw new Error('Nombre del cliente invalido.');
  if (payload.customerPhone !== undefined && payload.customerPhone !== null && !isString(payload.customerPhone, 40)) {
    throw new Error('Telefono invalido.');
  }
  if (typeof payload.guests !== 'number' || payload.guests < 1 || payload.guests > 30) {
    throw new Error('Cantidad de personas invalida.');
  }
  if (!isString(payload.reservationTime, 80) || Number.isNaN(new Date(payload.reservationTime).getTime())) {
    throw new Error('Fecha de reserva invalida.');
  }
  if (new Date(payload.reservationTime).getTime() <= Date.now()) {
    throw new Error('La reserva debe ser para una fecha futura.');
  }
  if (!Array.isArray(payload.tableIds) || payload.tableIds.length === 0 || payload.tableIds.length > 10) {
    throw new Error('Mesas invalidas.');
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const payload = isObject(req.body) ? req.body : {};
    validateReservationPayload(payload);
    const role = await getRequestRole(req).catch(() => null);
    const isStaff = roleCanManageReservations(role);

    const now = new Date().toISOString();
    const id = `RES-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const reservation = cleanUndefinedDeep({
      ...payload,
      id,
      status: ReservationStatus.PENDING,
      createdAt: now,
      statusHistory: [{ status: ReservationStatus.PENDING, startedAt: now }],
      finishedAt: null,
      createdBy: isStaff && payload.createdBy === CreatedBy.ADMIN
        ? CreatedBy.ADMIN
        : (payload.createdBy === CreatedBy.WHATSAPP_ASSISTANT ? CreatedBy.WHATSAPP_ASSISTANT : CreatedBy.WEB_ASSISTANT),
    });

    await getAdminDb().collection('Reservations').doc(id).set(reservation);
    return res.status(201).json(reservation);
  } catch (error) {
    console.error('Error creating reservation:', error);
    const message = error instanceof Error ? error.message : 'No se pudo crear la reserva.';
    return res.status(500).json({ error: message });
  }
}
