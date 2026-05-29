import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cleanUndefinedDeep, getAdminDb } from './_firebaseAdmin.js';

const isObject = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const validatePayload = (payload: Record<string, unknown>) => {
  if (!isObject(payload.metrics)) throw new Error('Metricas invalidas.');

  const latestSession = payload.latestSession;
  if (latestSession !== null && latestSession !== undefined) {
    if (!isObject(latestSession)) throw new Error('Sesion invalida.');
    if (typeof latestSession.id !== 'string' || latestSession.id.length > 120) throw new Error('ID de sesion invalido.');
    if (!Array.isArray(latestSession.messages) || latestSession.messages.length > 100) {
      throw new Error('Mensajes de sesion invalidos.');
    }
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const payload = isObject(req.body) ? req.body : {};
    validatePayload(payload);

    const adminDb = getAdminDb();
    const batch = adminDb.batch();
    batch.set(adminDb.collection('SliceBotMetrics').doc('main'), cleanUndefinedDeep(payload.metrics), { merge: true });

    if (isObject(payload.latestSession)) {
      batch.set(
        adminDb.collection('ChatHistory').doc(String(payload.latestSession.id)),
        cleanUndefinedDeep(payload.latestSession),
        { merge: true },
      );
    }

    await batch.commit();
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Error saving chat history:', error);
    const message = error instanceof Error ? error.message : 'No se pudo guardar el historial.';
    return res.status(500).json({ error: message });
  }
}
