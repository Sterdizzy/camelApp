
import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Calendar,
  DollarSign,
  Target,
  Plus,
  Minus,
  Loader2,
  BarChart3,
  Info,
  Edit,
  Trash2,
  AlertCircle,
  RefreshCw,
  Calculator, // Added new icon
  FileText // Added new icon
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { Transaction, Portfolio } from "@/api/entities";
import { calculateTotalPortfolioValue } from "./portfolioCalculations";
import AddTransactionDialog from "../components/journal/AddTransactionDialog";
import { classifyAsset } from '../components/ui/assetClassifier';

// Loading state enum for better state management
const LOADING_STATE = {
  INITIAL: 'initial',
  LOADING_BASIC: 'loading_basic',
  LOADING_PRICES: 'loading_prices',
  COMPLETE: 'complete',
  ERROR: 'error'
};

export default function AssetDetails() {
  const location = useLocation();
  const [assetData, setAssetData] = useState(null);
  const [loadingState, setLoadingState] = useState(LOADING_STATE.INITIAL);
  const [error, setError] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [transactionType, setTransactionType] = useState('buy');
  const [assetType, setAssetType] = useState('stock'); // Add state for asset type

  // Get URL parameters
  const urlParams = new URLSearchParams(location.search);
  const symbol = urlParams.get('symbol');
  const portfolioId = urlParams.get('portfolio');

  useEffect(() => {
    if (symbol && portfolioId) {
      loadAssetDetails();
    }
  }, [symbol, portfolioId]);

  // Progressive loading: Load data in stages for better UX
  const loadAssetDetails = async () => {
    try {
      setLoadingState(LOADING_STATE.LOADING_BASIC);
      setError(null);

      // Stage 1: Load basic transaction and portfolio data (fast)
      const [transactions, portfolios] = await Promise.all([
        Transaction.filter({
          symbol: symbol.toUpperCase(),
          portfolio_id: portfolioId
        }, "-transaction_date"), // Transactions ordered by date descending
        Portfolio.list()
      ]);

      const portfolio = portfolios.find(p => p.id === portfolioId);

      // Calculate comprehensive asset data including P/L breakdown
      const assetAnalysis = calculateCompleteAssetAnalysis(transactions);
      const classified = classifyAsset(assetAnalysis.currentHolding || { symbol });
      setAssetType(classified.type); // Store the type

      setAssetData({
        symbol: symbol.toUpperCase(),
        portfolio,
        transactions,
        currentHolding: assetAnalysis.currentHolding,
        realizedPL: assetAnalysis.realizedPL,
        totalPL: assetAnalysis.totalPL,
        fifoBreakdown: assetAnalysis.fifoBreakdown,
        totalTransactions: transactions.length,
        isClosedPosition: assetAnalysis.currentHolding === null
      });

      // Stage 2: Load live prices (may take longer)
      // Only attempt to get live prices if there's a current holding
      if (assetAnalysis.currentHolding) {
        setLoadingState(LOADING_STATE.LOADING_PRICES);

        try {
          const completePortfolioData = await Promise.race([
            calculateTotalPortfolioValue(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Price fetch timeout')), 10000)
            )
          ]);

          // Update with live prices
          const liveHolding = completePortfolioData.holdings.find(h =>
            h.symbol === symbol.toUpperCase() && h.portfolio_id === portfolioId
          );

          console.log('=== ASSET DETAILS PRICE UPDATE ===');
          console.log('Symbol searched:', symbol.toUpperCase());
          console.log('Portfolio ID:', portfolioId);
          console.log('Live holding found:', liveHolding);
          console.log('All holdings:', completePortfolioData.holdings.map(h => ({ symbol: h.symbol, portfolio_id: h.portfolio_id, current_price: h.current_price, total_value: h.total_value })));
          console.log('================================');

          if (liveHolding) {
            setAssetData(prev => ({
              ...prev,
              currentHolding: liveHolding,
              // Update total P/L with live unrealized P/L
              totalPL: {
                ...prev.totalPL,
                unrealized: liveHolding.unrealized_pl || 0,
                total: (prev.realizedPL.total || 0) + (liveHolding.unrealized_pl || 0)
              }
            }));
          } else {
            console.warn('Live holding not found, keeping basic holding data');
          }
        } catch (priceError) {
          console.warn('Live prices failed, using basic data:', priceError);
          // Continue with basic data - don't fail completely
        }
      }

      setLoadingState(LOADING_STATE.COMPLETE);

    } catch (error) {
      console.error("Error loading asset details:", error);
      setError(error.message);
      setLoadingState(LOADING_STATE.ERROR);
    }
  };

  const calculateCompleteAssetAnalysis = (transactions) => {
    if (!transactions || transactions.length === 0) {
      return {
        currentHolding: null,
        realizedPL: { total: 0, shortTerm: 0, longTerm: 0, transactions: [] },
        totalPL: { realized: 0, unrealized: 0, total: 0 },
        fifoBreakdown: []
      };
    }

    // Sort transactions by date (oldest first) for proper FIFO processing
    const sortedTx = [...transactions].sort((a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime());
    
    let currentQuantity = 0;
    let currentTotalCost = 0; // Represents the total cost basis of remaining shares
    let realizedPLTotal = 0;
    let shortTermGains = 0;
    let longTermGains = 0;
    const fifoQueue = []; // Stores purchase lots { quantity, price, date, transactionId }
    const realizedTransactions = []; // For future use if we need a list of transactions that resulted in realized P/L
    const fifoBreakdown = []; // Stores detailed breakdown for each sell transaction

    console.log('=== COMPLETE ASSET ANALYSIS ===');
    console.log(`Analyzing ${sortedTx.length} transactions for ${symbol}`);

    for (const tx of sortedTx) {
      const txQuantity = parseFloat(tx.quantity) || 0;
      const txPrice = parseFloat(tx.price) || 0;
      const txDate = new Date(tx.transaction_date);

      if (tx.type === 'buy') {
        currentQuantity += txQuantity;
        const buyCost = txQuantity * txPrice;
        currentTotalCost += buyCost;
        
        // Add to FIFO queue
        fifoQueue.push({
          quantity: txQuantity,
          price: txPrice,
          date: txDate,
          cost: buyCost,
          transactionId: tx.id
        });

        console.log(`BUY: ${txQuantity} @ $${txPrice} | Current: ${currentQuantity} shares, $${currentTotalCost} cost`);

      } else if (tx.type === 'sell') {
        console.log(`SELL: ${txQuantity} @ $${txPrice}`);
        
        let remainingToSell = txQuantity;
        const sellPrice = txPrice;
        let salePL = 0;
        let saleShortTerm = 0;
        let saleLongTerm = 0;
        const currentSellBreakdown = [];

        // Process sale against FIFO queue
        while (remainingToSell > 0 && fifoQueue.length > 0) {
          const lot = fifoQueue[0]; // Get the oldest lot
          const sellFromLot = Math.min(remainingToSell, lot.quantity);
          
          // Calculate holding period
          const holdingDays = Math.floor((txDate.getTime() - lot.date.getTime()) / (1000 * 60 * 60 * 24));
          const isLongTerm = holdingDays > 365;
          
          // Calculate P/L for this portion of the lot
          const proceeds = sellFromLot * sellPrice;
          const cost = sellFromLot * lot.price;
          const lotPL = proceeds - cost;
          
          salePL += lotPL;
          if (isLongTerm) {
            saleLongTerm += lotPL;
          } else {
            saleShortTerm += lotPL;
          }

          currentSellBreakdown.push({
            purchaseDate: lot.date,
            purchasePrice: lot.price,
            sellPrice: sellPrice,
            quantity: sellFromLot,
            holdingDays: holdingDays,
            isLongTerm: isLongTerm,
            proceeds: proceeds,
            cost: cost,
            gainLoss: lotPL
          });

          // Update lot quantity or remove if exhausted
          lot.quantity -= sellFromLot;
          if (lot.quantity <= 0.000001) { // Use a small epsilon for floating point comparison
            fifoQueue.shift(); // Remove the lot if fully sold
          }

          remainingToSell -= sellFromLot;
        }

        // Update overall quantities and costs
        // The current `totalCost` represents the cost basis of all currently held shares.
        // When selling, we remove the *average* cost of sold shares from the total cost basis.
        // This makes `currentTotalCost` a 'weighted average cost basis' for the remaining shares,
        // while `salePL` is strictly FIFO. This hybrid approach is common for portfolio tracking.
        currentQuantity = Math.max(0, currentQuantity - txQuantity);
        const avgCostPerShareBeforeSale = currentQuantity + txQuantity > 0 ? currentTotalCost / (currentQuantity + txQuantity) : 0;
        currentTotalCost = Math.max(0, currentTotalCost - (txQuantity * avgCostPerShareBeforeSale));
        
        realizedPLTotal += salePL;
        shortTermGains += saleShortTerm;
        longTermGains += saleLongTerm;

        realizedTransactions.push({
          ...tx,
          realizedPL: salePL,
          shortTermPL: saleShortTerm,
          longTermPL: saleLongTerm
        });

        fifoBreakdown.push({
          sellTransaction: tx,
          breakdown: currentSellBreakdown,
          totalPL: salePL,
          shortTermPL: saleShortTerm,
          longTermPL: saleLongTerm
        });

        console.log(`SELL COMPLETE: ${txQuantity} shares sold for P/L of $${salePL} | Remaining: ${currentQuantity} shares`);
      }
    }

    // Determine current holding
    let currentHolding = null;
    if (currentQuantity > 0.000001) { // Check if there's an actual holding remaining
      const lastTx = sortedTx[sortedTx.length - 1]; // Get name/sector from the last transaction
      const purchasePrice = currentTotalCost / currentQuantity;
      
      currentHolding = {
        id: `${portfolioId}-${symbol}`,
        symbol: symbol.toUpperCase(),
        name: lastTx.name, // Use name from a transaction, preferably latest
        sector: lastTx.sector, // Use sector from a transaction, preferably latest
        portfolio_id: portfolioId,
        quantity: currentQuantity,
        purchase_price: purchasePrice,
        current_price: purchasePrice, // Placeholder, updated by live prices
        total_value: purchasePrice * currentQuantity, // Placeholder, updated by live prices
        total_cost: currentTotalCost,
        unrealized_pl: 0, // Placeholder, updated by live prices
        unrealized_pl_percent: 0 // Placeholder, updated by live prices
      };
    }

    console.log('=== ANALYSIS COMPLETE ===');
    console.log(`Final position: ${currentQuantity} shares`);
    console.log(`Realized P/L: $${realizedPLTotal} (ST: $${shortTermGains}, LT: $${longTermGains})`);
    console.log(`Position ${currentQuantity > 0 ? 'ACTIVE' : 'CLOSED'}`);

    return {
      currentHolding,
      realizedPL: {
        total: realizedPLTotal,
        shortTerm: shortTermGains,
        longTerm: longTermGains,
        transactions: realizedTransactions
      },
      totalPL: {
        realized: realizedPLTotal,
        unrealized: 0, // This will be updated later with live prices
        total: realizedPLTotal // Will be realized + unrealized
      },
      fifoBreakdown
    };
  };

  const handleRetry = () => {
    setError(null);
    loadAssetDetails();
  };

  const handleAddBuy = () => {
    setTransactionType('buy');
    setEditingTransaction(null);
    setIsDialogOpen(true);
  };

  const handleAddSell = () => {
    setTransactionType('sell');
    setEditingTransaction(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (transaction) => {
    setEditingTransaction(transaction);
    setIsDialogOpen(true);
  };

  const handleDelete = async (transactionId) => {
    if (window.confirm("Are you sure you want to delete this transaction?")) {
      try {
        await Transaction.delete(transactionId);
        loadAssetDetails();
      } catch (error) {
        console.error("Failed to delete transaction:", error);
        alert("Failed to delete transaction. Please try again.");
      }
    }
  };

  const handleDialogClose = (isOpen) => {
    setIsDialogOpen(isOpen);
    if (!isOpen) {
      setEditingTransaction(null);
    }
  };

  const handleSuccess = () => {
    setIsDialogOpen(false);
    setEditingTransaction(null);
    setTimeout(() => {
      loadAssetDetails();
    }, 500); // Small delay to ensure data refresh
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  const formatPercentage = (percent) => {
    return `${percent >= 0 ? '+' : ''}${(percent || 0).toFixed(2)}%`;
  };

  const formatQuantity = (quantity) => {
    return (quantity || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  const getPercentageColor = (percent) => {
    if (percent > 0) return 'text-green-600';
    if (percent < 0) return 'text-red-600';
    return 'text-slate-600';
  };

  // Loading skeleton component
  const LoadingSkeleton = () => (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6 lg:space-y-8">
        {/* Header skeleton */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-slate-200 rounded animate-pulse"></div>
            <div className="space-y-2">
              <div className="w-32 h-8 bg-slate-200 rounded animate-pulse"></div>
              <div className="w-48 h-4 bg-slate-200 rounded animate-pulse"></div>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="w-24 h-10 bg-slate-200 rounded animate-pulse"></div>
            <div className="w-24 h-10 bg-slate-200 rounded animate-pulse"></div>
          </div>
        </div>

        {/* Cards skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="bg-white/70">
              <CardContent className="p-6">
                <div className="w-20 h-4 bg-slate-200 rounded animate-pulse mb-4"></div>
                <div className="w-24 h-8 bg-slate-200 rounded animate-pulse mb-2"></div>
                <div className="w-16 h-3 bg-slate-200 rounded animate-pulse"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );

  // Show loading skeleton for initial load
  if (loadingState === LOADING_STATE.INITIAL || loadingState === LOADING_STATE.LOADING_BASIC) {
    return <LoadingSkeleton />;
  }

  // Error state with retry option
  if (loadingState === LOADING_STATE.ERROR) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 lg:p-8 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Failed to Load Asset</h2>
          <p className="text-slate-600 mb-4">{error || 'An unexpected error occurred'}</p>
          <div className="flex gap-3 justify-center">
            <Button onClick={handleRetry} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Retry
            </Button>
            <Link to={createPageUrl("Dashboard")}>
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!assetData) {
    // Should ideally not happen after initial loading states, but as a fallback
    return <LoadingSkeleton />;
  }

  const { currentHolding, realizedPL, totalPL, isClosedPosition } = assetData;
  const isLoadingPrices = loadingState === LOADING_STATE.LOADING_PRICES;

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6 lg:space-y-8" role="main" aria-label="Asset Details">
          {/* Header */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 lg:gap-6">
            <div className="flex items-center gap-4">
              <Link to={createPageUrl("Dashboard")}>
                <Button variant="outline" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl lg:text-4xl font-bold text-slate-900 flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-xl font-bold text-white">
                      {assetData.symbol?.charAt(0) || '?'}
                    </span>
                  </div>
                  {assetData.symbol}
                  {isClosedPosition && (
                    <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                      CLOSED
                    </Badge>
                  )}
                </h1>
                <p className="text-slate-600 text-base lg:text-lg mt-1">
                  {currentHolding?.name || assetData.transactions[0]?.name || 'Asset Details'} • {assetData.portfolio?.name}
                </p>

                {/* Loading indicator for prices */}
                {isLoadingPrices && (
                  <div className="flex items-center gap-2 mt-2" aria-live="polite">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    <span className="text-sm text-blue-600">Updating live prices...</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleAddBuy} className="bg-green-600 hover:bg-green-700">
                <Plus className="w-4 h-4 mr-2" />
                Add Buy
              </Button>
              <Button onClick={handleAddSell} variant="outline" className="border-red-300 text-red-600 hover:bg-red-50">
                <Minus className="w-4 h-4 mr-2" />
                Add Sell
              </Button>
            </div>
          </div>

          {/* Comprehensive P/L Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            {/* Current Position */}
            <Card className="bg-white/70 backdrop-blur-sm border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Current Position
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl lg:text-3xl font-bold text-slate-900 mb-1">
                  {currentHolding ? formatQuantity(currentHolding.quantity) : "0.00"}
                </div>
                <div className="text-sm text-slate-600">
                  {currentHolding ? "shares/units held" : "position closed"}
                </div>
                {currentHolding && (
                  <div className="text-xs text-slate-500 mt-1">
                    Avg Cost: {formatCurrency(currentHolding.purchase_price)}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Current Value */}
            <Card className="bg-white/70 backdrop-blur-sm border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Current Value
                  {isLoadingPrices && <Loader2 className="w-3 h-3 animate-spin text-blue-500" />}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl lg:text-3xl font-bold text-slate-900 mb-1">
                  {currentHolding ? formatCurrency(currentHolding.total_value) : formatCurrency(0)}
                </div>
                <div className="text-sm text-slate-600">
                  {currentHolding ? `@ ${formatCurrency(currentHolding.current_price)} per share` : "no active position"}
                </div>
              </CardContent>
            </Card>

            {/* Realized P/L */}
            <Card className="bg-white/70 backdrop-blur-sm border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Calculator className="w-4 h-4" />
                  Realized P/L
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl lg:text-3xl font-bold mb-1 ${getPercentageColor(realizedPL?.total || 0)}`}>
                  {formatCurrency(realizedPL?.total || 0)}
                </div>
                <div className="text-xs text-slate-500 space-y-1">
                  <div>Short-term: {formatCurrency(realizedPL?.shortTerm || 0)}</div>
                  <div>Long-term: {formatCurrency(realizedPL?.longTerm || 0)}</div>
                </div>
              </CardContent>
            </Card>

            {/* Total P/L */}
            <Card className={`bg-white/70 backdrop-blur-sm border-slate-200 ${
              (totalPL?.total || 0) >= 0
                ? 'border-green-200 bg-green-50/50'
                : 'border-red-200 bg-red-50/50'
            }`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  {(totalPL?.total || 0) >= 0 ? (
                    <TrendingUp className="w-4 h-4 text-green-600" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-600" />
                  )}
                  Total P/L
                  {isLoadingPrices && <Loader2 className="w-3 h-3 animate-spin text-blue-500" />}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl lg:text-3xl font-bold mb-1 ${getPercentageColor(totalPL?.total || 0)}`}>
                  {formatCurrency(totalPL?.total || 0)}
                </div>
                <div className="text-xs text-slate-500 space-y-1">
                  <div>Realized: {formatCurrency(totalPL?.realized || 0)}</div>
                  <div>Unrealized: {formatCurrency(totalPL?.unrealized || 0)}</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* FIFO Tax Analysis */}
          {assetData.fifoBreakdown && assetData.fifoBreakdown.length > 0 && (
            <Card className="bg-white/70 backdrop-blur-sm border-slate-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
                  <FileText className="w-5 h-5 text-blue-600" />
                  Tax Analysis - FIFO Breakdown
                </CardTitle>
                <p className="text-sm text-slate-600">
                  Detailed breakdown of realized gains/losses for tax reporting purposes.
                </p>
              </CardHeader>
              <CardContent>
                {assetData.fifoBreakdown.map((sale, index) => (
                  <div key={index} className="mb-6 p-4 border border-slate-200 rounded-lg">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-semibold text-slate-800">
                        Sale on {formatDate(sale.sellTransaction.transaction_date)} for {formatQuantity(sale.sellTransaction.quantity)} units
                      </h4>
                      <Badge variant={sale.totalPL >= 0 ? "default" : "destructive"} className={getPercentageColor(sale.totalPL)}>
                        Total P/L: {formatCurrency(sale.totalPL)}
                      </Badge>
                    </div>
                    
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Purchase Date</TableHead>
                            <TableHead>Quantity Sold</TableHead>
                            <TableHead>Purchase Price</TableHead>
                            <TableHead>Sale Price</TableHead>
                            <TableHead>Holding Period</TableHead>
                            <TableHead>Term</TableHead>
                            <TableHead className="text-right">Gain/Loss</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sale.breakdown.map((lot, lotIndex) => (
                            <TableRow key={lotIndex}>
                              <TableCell>{formatDate(lot.purchaseDate)}</TableCell>
                              <TableCell>{formatQuantity(lot.quantity)}</TableCell>
                              <TableCell>{formatCurrency(lot.purchasePrice)}</TableCell>
                              <TableCell>{formatCurrency(lot.sellPrice)}</TableCell>
                              <TableCell>{lot.holdingDays} days</TableCell>
                              <TableCell>
                                <Badge variant={lot.isLongTerm ? "default" : "secondary"}>
                                  {lot.isLongTerm ? "Long-term" : "Short-term"}
                                </Badge>
                              </TableCell>
                              <TableCell className={`text-right font-semibold ${getPercentageColor(lot.gainLoss)}`}>
                                {formatCurrency(lot.gainLoss)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="flex justify-end gap-4 mt-3 pt-3 border-t border-slate-200">
                      <div className="text-sm">
                        <span className="text-slate-600">Short-term P/L:</span>
                        <span className={`ml-1 font-semibold ${getPercentageColor(sale.shortTermPL)}`}>
                          {formatCurrency(sale.shortTermPL)}
                        </span>
                      </div>
                      <div className="text-sm">
                        <span className="text-slate-600">Long-term P/L:</span>
                        <span className={`ml-1 font-semibold ${getPercentageColor(sale.longTermPL)}`}>
                          {formatCurrency(sale.longTermPL)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}


          {/* Transaction History */}
          <Card className="bg-white/70 backdrop-blur-sm border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                Transaction History ({assetData.totalTransactions})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {assetData.transactions.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="w-16 h-16 mx-auto mb-4 text-slate-400" />
                  <p className="text-slate-600 text-lg">No transactions found</p>
                  <p className="text-slate-500 text-sm mt-2">Start by adding a buy or sell transaction for {assetData.symbol}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Total Value</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead className="text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assetData.transactions.map((transaction) => (
                        <TableRow key={transaction.id}>
                          <TableCell>{formatDate(transaction.transaction_date)}</TableCell>
                          <TableCell>
                            <Badge
                              variant={transaction.type === 'buy' ? 'secondary' : 'destructive'}
                              className={transaction.type === 'buy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                            >
                              {transaction.type.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{formatQuantity(transaction.quantity)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(transaction.price)}</TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(transaction.quantity * transaction.price)}
                          </TableCell>
                          <TableCell className="max-w-32 truncate" title={transaction.notes}>
                            {transaction.notes || '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(transaction)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(transaction.id)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add/Edit Transaction Dialog */}
      <AddTransactionDialog
        key={isDialogOpen ? (editingTransaction?.id || `new-${transactionType}-${Date.now()}`) : 'closed-dialog'}
        open={isDialogOpen}
        onOpenChange={handleDialogClose}
        portfolios={assetData.portfolio ? [assetData.portfolio] : []}
        onSuccess={handleSuccess}
        editingTransaction={editingTransaction}
        prefilledData={editingTransaction ? null : {
          portfolio_id: portfolioId,
          symbol: assetData.symbol,
          name: currentHolding?.name || assetData.transactions[0]?.name || '', // Use name from current holding or first transaction
          sector: currentHolding?.sector || assetData.transactions[0]?.sector || '', // Use sector from current holding or first transaction
          type: transactionType
        }}
      />
    </>
  );
}
