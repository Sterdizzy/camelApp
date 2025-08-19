import FirestoreService from './firestore.js';
import { auth } from '../lib/firebase';

// Helper function to wait for auth state to be loaded
const waitForAuth = () => {
  return new Promise((resolve, reject) => {
    if (auth.currentUser) {
      resolve(auth.currentUser);
      return;
    }
    
    const unsubscribe = auth.onAuthStateChanged((user) => {
      unsubscribe();
      if (user) {
        resolve(user);
      } else {
        reject(new Error('User not authenticated'));
      }
    });
  });
};

// Portfolio Service
class PortfolioService extends FirestoreService {
  constructor() {
    super('portfolios');
  }

  async create(data) {
    const user = await waitForAuth();
    
    return super.create({
      ...data,
      userId: user.uid,
      cash_balance: data.cash_balance || data.cashBalance || 0,
      createdAt: new Date().toISOString(),
    });
  }

  async list(orderByField = '-createdAt') {
    const user = await waitForAuth();
    return super.filter({ userId: user.uid }, orderByField);
  }

  async getUserPortfolios() {
    return this.list();
  }
}

// Transaction Service
class TransactionService extends FirestoreService {
  constructor() {
    super('transactions');
  }

  async create(data) {
    const user = await waitForAuth();
    
    return super.create({
      ...data,
      userId: user.uid,
      transactionDate: data.transaction_date || data.transactionDate || new Date().toISOString(),
    });
  }

  async list(orderByField = '-transactionDate') {
    const user = await waitForAuth();
    return super.filter({ userId: user.uid }, orderByField);
  }

  async filter(filters, orderByField = '-transactionDate') {
    const user = await waitForAuth();
    
    return super.filter({
      ...filters,
      userId: user.uid,
    }, orderByField);
  }
}

// Sector Service
class SectorService extends FirestoreService {
  constructor() {
    super('sectors');
  }

  async create(data) {
    const user = await waitForAuth();
    
    return super.create({
      ...data,
      userId: user.uid,
    });
  }

  async list(orderByField = 'createdAt') {
    const user = await waitForAuth();
    return super.filter({ userId: user.uid }, orderByField);
  }
}

// Import History Service
class ImportHistoryService extends FirestoreService {
  constructor() {
    super('importHistory');
  }

  async create(data) {
    const user = await waitForAuth();
    
    return super.create({
      ...data,
      userId: user.uid,
    });
  }

  async list(orderByField = 'createdAt') {
    const user = await waitForAuth();
    return super.filter({ userId: user.uid }, orderByField);
  }
}

// Price Cache Service (for storing fetched stock prices)
class PriceCacheService extends FirestoreService {
  constructor() {
    super('priceCache');
  }

  async getPrice(symbol) {
    try {
      return await this.get(symbol.toUpperCase());
    } catch (error) {
      return null; // Price not found in cache
    }
  }

  async setPrice(symbol, priceData) {
    const data = {
      symbol: symbol.toUpperCase(),
      currentPrice: priceData.price,
      lastUpdated: new Date().toISOString(),
      source: priceData.source || 'unknown',
      dayChange: priceData.change || 0,
      dayChangePercent: priceData.changePercent || 0,
    };

    try {
      // Try to update existing document
      await super.update(symbol.toUpperCase(), data);
    } catch (error) {
      // If document doesn't exist, create it
      await super.create({ ...data, id: symbol.toUpperCase() });
    }

    return data;
  }

  async getPrices(symbols) {
    const promises = symbols.map(symbol => this.getPrice(symbol));
    const results = await Promise.allSettled(promises);
    
    return results.map((result, index) => ({
      symbol: symbols[index],
      price: result.status === 'fulfilled' ? result.value : null,
    }));
  }
}

// User Service (for user profile management)
class UserService extends FirestoreService {
  constructor() {
    super('users');
  }

  async createProfile(userData) {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    
    const profile = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || userData.displayName || '',
      photoURL: user.photoURL || userData.photoURL || '',
      ...userData,
    };

    try {
      // Try to update existing profile
      await super.update(user.uid, profile);
    } catch (error) {
      // If profile doesn't exist, create it
      await super.create({ ...profile, id: user.uid });
    }

    return profile;
  }

  async getProfile() {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    
    try {
      return await super.get(user.uid);
    } catch (error) {
      // Profile doesn't exist, create default profile
      return this.createProfile({});
    }
  }

  async updateProfile(data) {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    
    return super.update(user.uid, data);
  }
}

// Create service instances
export const Portfolio = new PortfolioService();
export const Transaction = new TransactionService();
export const Sector = new SectorService();
export const ImportHistory = new ImportHistoryService();
export const PriceCache = new PriceCacheService();
export const User = new UserService();

// Auth service wrapper for compatibility
export const Auth = {
  getCurrentUser: () => auth.currentUser,
  onAuthStateChanged: (callback) => auth.onAuthStateChanged(callback),
};

// Default export for backward compatibility
export default {
  Portfolio,
  Transaction,
  Sector,
  ImportHistory,
  PriceCache,
  User,
  Auth,
};