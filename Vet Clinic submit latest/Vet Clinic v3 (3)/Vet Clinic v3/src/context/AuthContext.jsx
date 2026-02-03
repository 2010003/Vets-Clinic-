import { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc, addDoc, collection } from 'firebase/firestore';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (fbUser) => {
            if (!fbUser) {
                setUser(null);
                setLoading(false);
                return;
            }

            try {
                const userDoc = await getDoc(doc(db, 'users', fbUser.uid));
                const profile = userDoc.exists() ? userDoc.data() : {};
                const mergedUser = {
                    id: fbUser.uid,
                    email: fbUser.email,
                    name: profile.name || fbUser.email,
                    role: profile.role || 'client',
                    phone: profile.phone || '',
                };
                setUser(mergedUser);
                localStorage.setItem('user', JSON.stringify(mergedUser));
            } catch (e) {
                console.error('Auth state error', e);
                setUser(null);
            } finally {
                setLoading(false);
            }
        });
        return () => unsub();
    }, []);

    // Login with Firebase Auth
    const login = async (email, password) => {
        try {
            const cred = await signInWithEmailAndPassword(auth, email, password);
            const fbUser = cred.user;
            const userDoc = await getDoc(doc(db, 'users', fbUser.uid));
            const profile = userDoc.exists() ? userDoc.data() : {};
            const mergedUser = {
                id: fbUser.uid,
                email: fbUser.email,
                name: profile.name || fbUser.email,
                role: profile.role || 'client',
                phone: profile.phone || '',
            };
            setUser(mergedUser);
            localStorage.setItem('user', JSON.stringify(mergedUser));
            await addDoc(collection(db, 'audit_logs'), {
                user_email: mergedUser.email,
                action: 'LOGIN_SUCCESS',
                details: 'User logged in successfully',
                timestamp: new Date().toISOString(),
            }).catch((e) => {
                console.error('Failed to write login audit log', e);
            });
            return { success: true, role: mergedUser.role };
        } catch (error) {
            // Let callers inspect Firebase error codes (e.g., for multi-factor auth)
            throw error;
        }
    };

    // Register with Firebase Auth + Firestore profile
    const register = async ({ name, email, phone, password }) => {
        try {
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            const fbUser = cred.user;
            await setDoc(doc(db, 'users', fbUser.uid), {
                name,
                email,
                phone,
                role: 'client',
            });
        } catch (error) {
            throw new Error(error.message || 'Registration failed');
        }
    };

    const logout = async () => {
        const currentUser = auth.currentUser;
        const email = currentUser?.email || user?.email || 'unknown';
        await signOut(auth);
        setUser(null);
        localStorage.removeItem('user');
        try {
            await addDoc(collection(db, 'audit_logs'), {
                user_email: email,
                action: 'LOGOUT',
                details: 'User logged out',
                timestamp: new Date().toISOString(),
            });
        } catch (e) {
            console.error('Failed to write logout audit log', e);
        }
    };

    const updateUser = (partial) => {
        setUser((prev) => (prev ? { ...prev, ...partial } : prev));
        if (partial && Object.keys(partial).length > 0) {
            try {
                const stored = localStorage.getItem('user');
                const parsed = stored ? JSON.parse(stored) : null;
                if (parsed) {
                    const merged = { ...parsed, ...partial };
                    localStorage.setItem('user', JSON.stringify(merged));
                }
            } catch (e) {
                console.error('Failed to sync user to localStorage', e);
            }
        }
    };

    return (
        <AuthContext.Provider value={{ user, login, register, logout, loading, updateUser }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);

