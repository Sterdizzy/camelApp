import {onRequest, onCall} from "firebase-functions/v2/https";
import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import * as cors from "cors";
import axios from "axios";

// Initialize Firebase Admin SDK
initializeApp();
const db = getFirestore();

const corsHandler = cors({origin: true});

/**
 * Live Prices Function
 * Fetches current stock prices from financial APIs
 */
export const livePrices = onCall(async (request) => {
  const {symbols} = request.data;
  
  if (!symbols || !Array.isArray(symbols)) {
    throw new Error("symbols parameter is required and must be an array");
  }

  try {
    // Example using Alpha Vantage API (replace with your preferred API)
    const results = await Promise.allSettled(
      symbols.map(async (symbol: string) => {
        // Mock implementation - replace with actual API call
        const mockPrice = Math.random() * 1000 + 50;
        return {
          symbol: symbol.toUpperCase(),
          price: mockPrice,
          change: Math.random() * 20 - 10,
          changePercent: Math.random() * 10 - 5,
          lastUpdated: new Date().toISOString(),
          source: "mock"
        };
      })
    );

    return {
      data: results.map((result, index) => ({
        symbol: symbols[index],
        ...(result.status === "fulfilled" ? result.value : {error: "Failed to fetch"}),
      })),
      status: "success"
    };
  } catch (error) {
    console.error("Error fetching live prices:", error);
    throw new Error("Failed to fetch live prices");
  }
});

/**
 * Historical Prices Function
 * Fetches historical price data for analytics
 */
export const getHistoricalPrices = onCall(async (request) => {
  const {symbol, period = "1y"} = request.data;
  
  if (!symbol) {
    throw new Error("symbol parameter is required");
  }

  try {
    // Mock historical data - replace with actual API
    const data = [];
    const days = period === "1y" ? 365 : 30;
    
    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      data.push({
        date: date.toISOString().split('T')[0],
        open: Math.random() * 1000 + 50,
        high: Math.random() * 1000 + 100,
        low: Math.random() * 1000 + 25,
        close: Math.random() * 1000 + 75,
        volume: Math.floor(Math.random() * 1000000),
      });
    }

    return {
      data: {
        symbol: symbol.toUpperCase(),
        period,
        prices: data,
      },
      status: "success"
    };
  } catch (error) {
    console.error("Error fetching historical prices:", error);
    throw new Error("Failed to fetch historical prices");
  }
});

/**
 * Calculate Analytics Function
 * Processes portfolio data and returns analytics
 */
export const calculateAnalytics = onCall(async (request) => {
  const {timeRange = "ALL", portfolioId} = request.data;
  const userId = request.auth?.uid;
  
  if (!userId) {
    throw new Error("User must be authenticated");
  }

  try {
    const db = getFirestore();
    
    // Fetch user's transactions
    let transactionsQuery = db.collection("transactions")
      .where("userId", "==", userId);
    
    if (portfolioId) {
      transactionsQuery = transactionsQuery.where("portfolio_id", "==", portfolioId);
    }

    const transactionsSnapshot = await transactionsQuery.get();
    const transactions = transactionsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Calculate basic metrics
    const totalInvested = transactions
      .filter(tx => tx.type === "buy")
      .reduce((sum, tx) => sum + (tx.quantity * tx.price), 0);

    const realizedPL = transactions
      .filter(tx => tx.type === "sell")
      .reduce((sum, tx) => {
        // Simplified P/L calculation
        return sum + (tx.quantity * tx.price * 0.1); // Mock 10% gain
      }, 0);

    // Mock historical data for chart
    const historicalData = [];
    const days = timeRange === "1W" ? 7 : timeRange === "1M" ? 30 : 365;
    
    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      historicalData.push({
        date: date.toISOString().split('T')[0],
        value: totalInvested + (Math.random() * totalInvested * 0.2),
      });
    }

    return {
      data: {
        currentMetrics: {
          totalCostBasis: totalInvested,
          totalCashBalance: 0,
          activePositions: transactions.length,
        },
        realizedPL: {
          total: realizedPL,
          transactions: transactions.filter(tx => tx.type === "sell"),
        },
        historicalData,
        dataPoints: historicalData.length,
        transactionCount: transactions.length,
      },
      status: "success"
    };
  } catch (error) {
    console.error("Error calculating analytics:", error);
    throw new Error("Failed to calculate analytics");
  }
});

/**
 * Update Portfolio Value Function
 * Recalculates portfolio values when transactions change
 */
export const updatePortfolioValue = onCall(async (request) => {
  const {portfolioId} = request.data;
  const userId = request.auth?.uid;
  
  if (!userId) {
    throw new Error("User must be authenticated");
  }

  try {
    const db = getFirestore();
    
    // Fetch portfolio transactions
    const transactionsSnapshot = await db.collection("transactions")
      .where("userId", "==", userId)
      .where("portfolio_id", "==", portfolioId)
      .get();

    const transactions = transactionsSnapshot.docs.map(doc => doc.data());
    
    // Calculate current holdings
    const holdings = new Map();
    
    transactions.forEach(tx => {
      const key = tx.symbol;
      if (!holdings.has(key)) {
        holdings.set(key, {quantity: 0, totalCost: 0});
      }
      
      const holding = holdings.get(key);
      if (tx.type === "buy") {
        holding.quantity += tx.quantity;
        holding.totalCost += tx.quantity * tx.price;
      } else if (tx.type === "sell") {
        holding.quantity -= tx.quantity;
        holding.totalCost -= tx.quantity * tx.price;
      }
    });

    // Update portfolio document
    await db.collection("portfolios").doc(portfolioId).update({
      lastUpdated: new Date().toISOString(),
      holdingsCount: holdings.size,
    });

    return {
      status: "success",
      holdingsCount: holdings.size,
    };
  } catch (error) {
    console.error("Error updating portfolio value:", error);
    throw new Error("Failed to update portfolio value");
  }
});

/**
 * Process Transaction Batch Function
 * Handles bulk transaction imports
 */
export const processTransactionBatch = onCall(async (request) => {
  const {transactions, batchId} = request.data;
  const userId = request.auth?.uid;
  
  if (!userId) {
    throw new Error("User must be authenticated");
  }

  try {
    const db = getFirestore();
    const batch = db.batch();
    
    transactions.forEach((transaction: any) => {
      const docRef = db.collection("transactions").doc();
      batch.set(docRef, {
        ...transaction,
        userId,
        batchId,
        createdAt: new Date().toISOString(),
      });
    });

    await batch.commit();

    return {
      status: "success",
      processedCount: transactions.length,
      batchId,
    };
  } catch (error) {
    console.error("Error processing transaction batch:", error);
    throw new Error("Failed to process transaction batch");
  }
});

/**
 * Trigger function to update portfolio when transactions are created
 */
export const onTransactionCreated = onDocumentCreated(
  "transactions/{transactionId}",
  async (event) => {
    const transaction = event.data?.data();
    
    if (!transaction) return;

    const db = getFirestore();
    
    try {
      // Update portfolio last modified timestamp
      await db.collection("portfolios").doc(transaction.portfolio_id).update({
        lastUpdated: new Date().toISOString(),
      });
      
      console.log(`Portfolio ${transaction.portfolio_id} updated after transaction creation`);
    } catch (error) {
      console.error("Error updating portfolio after transaction:", error);
    }
  }
);