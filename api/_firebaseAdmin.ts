import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { VercelRequest } from '@vercel/node';

const getServiceAccount = () => {
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT;

  const serviceAccount = encoded
    ? JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'))
    : raw
      ? JSON.parse(raw)
      : null;

  if (!serviceAccount) {
    throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_BASE64, FIREBASE_SERVICE_ACCOUNT_JSON, or FIREBASE_SERVICE_ACCOUNT.');
  }

  if (typeof serviceAccount.private_key === 'string') {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }

  return serviceAccount;
};

const getAdminApp = () => (
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        credential: cert(getServiceAccount()),
      })
);

export const getAdminDb = (): Firestore => getFirestore(getAdminApp());
export const getAdminAuth = () => getAuth(getAdminApp());

export const getRequestRole = async (req: VercelRequest): Promise<string | null> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;

  const decoded = await getAdminAuth().verifyIdToken(authHeader.slice('Bearer '.length));
  const profileSnap = await getAdminDb().collection('Users').doc(decoded.uid).get();
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
