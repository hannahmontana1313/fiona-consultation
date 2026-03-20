import { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        // Si c'est l'admin, passer en ligne automatiquement
        const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
        if (firebaseUser.email === adminEmail) {
          await fetch('/api/set-statut', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ statut: 'En ligne' }),
          }).catch(() => {});
        }
        const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (snap.exists()) {
          setUserData(snap.data());
        } else {
          const newUserData = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            prenom: firebaseUser.displayName || '',
            role: 'client',
            createdAt: serverTimestamp(),
            bloque: false,
          };
          await setDoc(doc(db, 'users', firebaseUser.uid), newUserData);
          setUserData(newUserData);
        }
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const inscription = async (email, password, prenom, dateNaissance) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: prenom });
    await setDoc(doc(db, 'users', cred.user.uid), {
      uid: cred.user.uid,
      email,
      prenom,
      role: 'client',
      dateNaissance: dateNaissance || null,
      createdAt: serverTimestamp(),
      bloque: false,
    });
    return cred.user;
  };

  const connexion = (email, password) =>
    signInWithEmailAndPassword(auth, email, password);

  const deconnexion = async () => {
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
    if (user?.email === adminEmail) {
      try {
        await fetch('/api/set-statut', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ statut: 'Hors ligne' }),
        });
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch(e) {}
    }
    return signOut(auth);
  };

  const isAdmin = userData?.role === 'admin' ||
    user?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;

  return (
    <AuthContext.Provider value={{ user, userData, loading, inscription, connexion, deconnexion, isAdmin }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
