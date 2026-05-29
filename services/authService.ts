import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
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
  const profileSnap = await getDoc(doc(db, 'Users', uid));
  if (!profileSnap.exists()) return null;
  const profile = profileSnap.data() as User;
  return profile.active === false ? null : { ...profile, id: uid };
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

  await setDoc(doc(db, 'Users', credentials.user.uid), {
    lastAccess: new Date().toISOString(),
  }, { merge: true });

  return mapAuthUser(credentials.user, profile);
};

export const logout = async (): Promise<void> => {
  await signOut(auth);
};
