// Firebase Cloud Functions
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';

// Cloud Function wrappers
export const livePrices = httpsCallable(functions, 'livePrices');
export const getHistoricalPrices = httpsCallable(functions, 'getHistoricalPrices');
export const calculateAnalytics = httpsCallable(functions, 'calculateAnalytics');

// Add additional cloud functions as needed
export const updatePortfolioValue = httpsCallable(functions, 'updatePortfolioValue');
export const processTransactionBatch = httpsCallable(functions, 'processTransactionBatch');