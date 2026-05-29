import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, getDocFromServer, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import type { User } from '../types';

export type AuthUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  profile: User | null;
};

const mapAuthUser = (user: FirebaseUser, profile: User | null = null): AuthUser => ({
  uid: user.uid,
  email: user.email,
  displayName: user.displayName,
  profile,
});

export const fetchUserProfile = async (uid: string): Promise<User | null> => {
  const profileRef = doc(db, 'Users', uid);
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const profileSnap = attempt === 0
        ? await getDocFromServer(profileRef)
        : await getDoc(profileRef);

      if (!profileSnap.exists()) return null;
      const profile = profileSnap.data() as User;
      return profile.active === false ? null : { ...profile, id: uid };
    } catch (error) {
      lastError = error;
      await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }

  throw lastError;
};

export const subscribeToAuthState = (
  onChange: (user: AuthUser | null) => void,
): (() => void) => {
  return onAuthStateChanged(auth, (user) => {
    if (!user) {
      onChange(null);
      return;
    }

    fetchUserProfile(user.uid)
      .then((profile) => onChange(mapAuthUser(user, profile)))
      .catch((error) => {
        console.error('Failed to fetch auth user profile:', error);
        onChange(mapAuthUser(user, null));
      });
  });
};

export const loginWithEmailAndPassword = async (
  email: string,
  password: string,
): Promise<AuthUser> => {
  const credentials = await signInWithEmailAndPassword(auth, email.trim(), password);
  const profile = await fetchUserProfile(credentials.user.uid);
  if (!profile) {
    await signOut(auth);
    throw new Error('auth/missing-profile');
  }

  setDoc(doc(db, 'Users', credentials.user.uid), {
    lastAccess: new Date().toISOString(),
  }, { merge: true }).catch((error) => {
    console.warn('No se pudo actualizar lastAccess del usuario:', error);
  });

  return mapAuthUser(credentials.user, profile);
};

export const logout = async (): Promise<void> => {
  await signOut(auth);
};
