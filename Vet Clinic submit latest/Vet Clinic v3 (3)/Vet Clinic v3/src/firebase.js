// Firebase Web SDK initialization for the React app
// Uses the config you provided.
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCgs1AH169QQNW2ykvzrWILRxcvtChv6_E',
  authDomain: 'vetclinic-31ec2.firebaseapp.com',
  projectId: 'vetclinic-31ec2',
  storageBucket: 'vetclinic-31ec2.firebasestorage.app',
  messagingSenderId: '700362575448',
  appId: '1:700362575448:web:c25d020e52bae48ba8842d',
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
