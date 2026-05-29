import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { AppSettings } from '../types';

const SETTINGS_COLLECTION = 'settings';
const SETTINGS_DOC_ID = 'general';

export const getSettings = async (): Promise<AppSettings | null> => {
    try {
        const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data() as AppSettings;
        } else {
            return null;
        }
    } catch (error) {
        console.error("Error getting settings:", error);
        return null;
    }
};

export const saveSettings = async (settings: AppSettings): Promise<void> => {
    try {
        const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
        await setDoc(docRef, settings, { merge: true });
    } catch (error) {
        console.error("Error saving settings:", error);
        throw error;
    }
};

export const clearLocalStorage = (): void => {
    const keysToKeep = ['pizzeria-theme']; // Example: keep theme settings
    
    // Create a copy of keys to iterate over, as we'll be modifying localStorage
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !keysToKeep.includes(key)) {
            keysToRemove.push(key);
        }
    }

    keysToRemove.forEach(key => {
        localStorage.removeItem(key);
    });

    // Reload to apply changes and fetch fresh data from Firebase
    window.location.reload();
};
