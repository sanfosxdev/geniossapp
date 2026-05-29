import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import type { VercelRequest } from '@vercel/node';

const getServiceAccount = () => {
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT;

  if (encoded) {
    return JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
  }

  if (raw) {
    return JSON.parse(raw);
  }

  throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_BASE64, FIREBASE_SERVICE_ACCOUNT_JSON, or FIREBASE_SERVICE_ACCOUNT.');
};

const app = getApps().length > 0
  ? getApps()[0]
  : initializeApp({
      credential: cert(getServiceAccount()),
    });

export const adminDb = getFirestore(app);
export const adminAuth = getAuth(app);

export const getRequestRole = async (req: VercelRequest): Promise<string | null> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;

  const decoded = await adminAuth.verifyIdToken(authHeader.slice('Bearer '.length));
  const profileSnap = await adminDb.collection('Users').doc(decoded.uid).get();
  if (!profileSnap.exists) return null;

  const profile = profileSnap.data();
  if (!profile?.active) return null;
  return typeof profile.role === 'string' ? profile.role : null;
};

export const roleCanManageOrders = (role: string | null): boolean => (
  role === 'DEV' || role === 'ADMIN' || role === 'MOZO' || role === 'COCINA'
);

export const roleCanManageReservations = (role: string | null): boolean => (
  role === 'DEV' || role === 'ADMIN' || role === 'MOZO'
);

export const cleanUndefinedDeep = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map(cleanUndefinedDeep) as T;
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((acc, [key, entryValue]) => {
      if (entryValue !== undefined) {
        (acc as Record<string, unknown>)[key] = cleanUndefinedDeep(entryValue);
      }
      return acc;
    }, {} as T);
  }

  return value;
};
