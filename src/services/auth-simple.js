import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  GoogleAuthProvider,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { User } from './entities';

// Google OAuth Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('profile');
googleProvider.addScope('email');

class SimpleAuthService {
  constructor() {
    this.currentUser = null;
    this.isLoading = true;
    
    // Set up auth state listener
    this.unsubscribe = onAuthStateChanged(auth, (user) => {
      this.currentUser = user;
      this.isLoading = false;
      
      // Create or update user profile in Firestore
      if (user) {
        this.createOrUpdateUserProfile(user);
      }
    });
  }

  // Google OAuth Sign-in
  async signInWithGoogle() {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return {
        user: result.user,
        isNewUser: result._tokenResponse?.isNewUser || false
      };
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  // Email/Password Authentication
  async signInWithEmail(email, password) {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      return {
        user: result.user,
        isNewUser: false
      };
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  async signUpWithEmail(email, password, displayName = '') {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      
      // Update display name if provided
      if (displayName) {
        await updateProfile(result.user, { displayName });
      }

      // Send verification email
      await sendEmailVerification(result.user);

      return {
        user: result.user,
        isNewUser: true
      };
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  async sendPasswordReset(email) {
    try {
      await sendPasswordResetEmail(auth, email);
      return { success: true };
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  async signOut() {
    try {
      await signOut(auth);
      return { success: true };
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  // User Profile Management
  async createOrUpdateUserProfile(user) {
    try {
      const profileData = {
        displayName: user.displayName || '',
        email: user.email,
        photoURL: user.photoURL || '',
        provider: user.providerData[0]?.providerId || 'email',
        emailVerified: user.emailVerified,
        lastLoginAt: new Date().toISOString(),
      };

      await User.createProfile(profileData);
    } catch (error) {
      console.error('Error creating/updating user profile:', error);
    }
  }

  // Auth State Management
  onAuthStateChanged(callback) {
    return onAuthStateChanged(auth, callback);
  }

  getCurrentUser() {
    return auth.currentUser;
  }

  isAuthenticated() {
    return !!auth.currentUser;
  }

  // Error Handling
  handleAuthError(error) {
    console.error('Auth Error:', error);
    
    switch (error.code) {
      case 'auth/user-not-found':
        return new Error('No account found with this email address.');
      
      case 'auth/wrong-password':
        return new Error('Incorrect password.');
      
      case 'auth/email-already-in-use':
        return new Error('An account already exists with this email address.');
      
      case 'auth/weak-password':
        return new Error('Password should be at least 6 characters long.');
      
      case 'auth/invalid-email':
        return new Error('Please enter a valid email address.');
      
      case 'auth/popup-closed-by-user':
        return new Error('Sign-in was cancelled.');
      
      case 'auth/popup-blocked':
        return new Error('Pop-up was blocked. Please allow pop-ups and try again.');
      
      case 'auth/account-exists-with-different-credential':
        return new Error('An account already exists with this email but different sign-in method.');
      
      case 'auth/network-request-failed':
        return new Error('Network error. Please check your connection and try again.');
      
      default:
        return new Error(error.message || 'An unexpected error occurred.');
    }
  }

  // Cleanup
  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }
}

// Create singleton instance
const authService = new SimpleAuthService();

export default authService;