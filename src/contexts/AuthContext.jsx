import React, { createContext, useContext, useEffect, useState } from 'react';
import authService from '../services/auth-simple';

const AuthContext = createContext({
  user: null,
  loading: true,
  signInWithGoogle: () => Promise.resolve(),
  signInWithEmail: () => Promise.resolve(),
  signUpWithEmail: () => Promise.resolve(),
  signOut: () => Promise.resolve(),
  sendPasswordReset: () => Promise.resolve(),
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = authService.onAuthStateChanged((user) => {
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      const result = await authService.signInWithGoogle();
      return result;
    } finally {
      setLoading(false);
    }
  };

  const signInWithEmail = async (email, password) => {
    setLoading(true);
    try {
      const result = await authService.signInWithEmail(email, password);
      return result;
    } finally {
      setLoading(false);
    }
  };

  const signUpWithEmail = async (email, password, displayName) => {
    setLoading(true);
    try {
      const result = await authService.signUpWithEmail(email, password, displayName);
      return result;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await authService.signOut();
    } finally {
      setLoading(false);
    }
  };

  const sendPasswordReset = async (email) => {
    return authService.sendPasswordReset(email);
  };

  const value = {
    user,
    loading,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    sendPasswordReset,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};