import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Use ONLY the DEFAULT Firestore database as requested by the user
export const db = getFirestore(app);

