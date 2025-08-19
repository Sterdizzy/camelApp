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
  Calculator,
  AlertCircle,
  Clock,
  FileText
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { Transaction } from "@/api/entities";

export default function TradeDetails() {
  const location = useLocation();
  const [tradeData, setTradeData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Get URL parameters
  const urlParams = new URLSearchParams(location.search);
  const sellTransactionId = urlParams.get('sellId');

  useEffect(() => {
    if (sellTransactionId) {
      loadTradeDetails();
    }
  }, [sellTransactionId]);

  const loadTradeDetails = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get all transactions to perform FIFO calculation
      const allTransactions = await Transaction.list("-transaction_date");
      const sellTransaction = allTransactions.find(tx => tx.id === sellTransactionId);
      
      if (!sellTransaction) {
        throw new Error("Sell transaction not found");
      }

      if (sellTransaction.type !== 'sell') {
        throw new Error("Selected transaction is not a sell transaction");
      }

      // Get all transactions for the same symbol and portfolio
      const relatedTransactions = allTransactions.filter(tx => 
        tx.symbol === sellTransaction.symbol && 
        tx.portfolio_id === sellTransaction.portfolio_id &&
        new Date(tx.transaction_date) <= new Date(sellTransaction.transaction_date)
      ).sort((a, b) => new Date(a.transaction_date) - new Date(b.transaction_date));

      // Calculate FIFO breakdown
      const fifoBreakdown = calculateFIFOBreakdown(relatedTransactions, sellTransaction);

      setTradeData({
        sellTransaction,
        fifoBreakdown,
        totalGainLoss: fifoBreakdown.reduce((sum, lot) => sum + lot.gainLoss, 0),
        totalShortTerm: fifoBreakdown.filter(lot => lot.isShortTerm).reduce((sum, lot) => sum + lot.gainLoss, 0),
        totalLongTerm: fifoBreakdown.filter(lot => !lot.isShortTerm).reduce((sum, lot) => sum + lot.gainLoss, 0)
      });

    } catch (error) {
      console.error("Error loading trade details:", error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateFIFOBreakdown = (transactions, sellTx) => {
    const breakdown = [];
    let remainingToSell = parseFloat(sellTx.quantity);
    const sellPrice = parseFloat(sellTx.price);
    const sellDate = new Date(sellTx.transaction_date);
    
    // Process buy transactions in FIFO order
    for (const tx of transactions) {
      if (tx.type === 'buy' && remainingToSell > 0) {
        const buyQuantity = parseFloat(tx.quantity);
        const buyPrice = parseFloat(tx.price);
        const buyDate = new Date(tx.transaction_date);
        
        // Calculate how much of this lot we're selling
        const quantitySold = Math.min(remainingToSell, buyQuantity);
        
        // Calculate holding period (short-term if <= 365 days)
        const holdingPeriodDays = Math.floor((sellDate - buyDate) / (1000 * 60 * 60 * 24));
        const isShortTerm = holdingPeriodDays <= 365;
        
        // Calculate gain/loss for this lot
        const proceedsFromLot = quantitySold * sellPrice;
        const costBasisLot = quantitySold * buyPrice;
        const gainLoss = proceedsFromLot - costBasisLot;
        
        breakdown.push({
          buyDate: tx.transaction_date,
          buyPrice: buyPrice,
          quantitySold: quantitySold,
          costBasis: costBasisLot,
          proceeds: proceedsFromLot,
          gainLoss: gainLoss,
          holdingPeriodDays: holdingPeriodDays,
          isShortTerm: isShortTerm,
          buyTransactionId: tx.id
        });
        
        remainingToSell -= quantitySold;
      }
    }
    
    return breakdown;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  const getGainLossColor = (amount) => {
    if (amount > 0) return 'text-green-600';
    if (amount < 0) return 'text-red-600';
    return 'text-slate-600';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 lg:p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading trade details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 lg:p-8 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Error Loading Trade</h2>
          <p className="text-slate-600 mb-4">{error}</p>
          <Link to={createPageUrl("Analytics")}>
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Analytics
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!tradeData) {
    return null;
  }

  const { sellTransaction, fifoBreakdown, totalGainLoss, totalShortTerm, totalLongTerm } = tradeData;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6 lg:space-y-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 lg:gap-6">
          <div className="flex items-center gap-4">
            <Link to={createPageUrl("Analytics")}>
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Analytics
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold text-slate-900 flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                Trade Details
              </h1>
              <p className="text-slate-600 text-base lg:text-lg mt-1">
                FIFO breakdown for {sellTransaction.symbol} sale
              </p>
            </div>
          </div>
        </div>

        {/* Sale Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          <Card className="bg-white/70 backdrop-blur-sm border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Target className="w-4 h-4" />
                Shares Sold
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl lg:text-3xl font-bold text-slate-900 mb-1">
                {sellTransaction.quantity}
              </div>
              <div className="text-sm text-slate-600">
                @ {formatCurrency(sellTransaction.price)} per share
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/70 backdrop-blur-sm border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Total Proceeds
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl lg:text-3xl font-bold text-slate-900 mb-1">
                {formatCurrency(sellTransaction.quantity * sellTransaction.price)}
              </div>
              <div className="text-sm text-slate-600">
                {formatDate(sellTransaction.transaction_date)}
              </div>
            </CardContent>
          </Card>

          <Card className={`bg-white/70 backdrop-blur-sm border-slate-200 ${
            totalGainLoss >= 0
              ? 'border-green-200 bg-green-50/50'
              : 'border-red-200 bg-red-50/50'
          }`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
                {totalGainLoss >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-green-600" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-600" />
                )}
                Total Gain/Loss
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl lg:text-3xl font-bold mb-1 ${getGainLossColor(totalGainLoss)}`}>
                {formatCurrency(totalGainLoss)}
              </div>
              <div className="text-sm text-slate-600">
                All tax lots combined
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/70 backdrop-blur-sm border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Tax Classification
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Short-term:</span>
                  <span className={`font-semibold ${getGainLossColor(totalShortTerm)}`}>
                    {formatCurrency(totalShortTerm)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Long-term:</span>
                  <span className={`font-semibold ${getGainLossColor(totalLongTerm)}`}>
                    {formatCurrency(totalLongTerm)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* FIFO Breakdown Table */}
        <Card className="bg-white/70 backdrop-blur-sm border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
              <Calculator className="w-5 h-5 text-blue-600" />
              FIFO Tax Lot Breakdown
            </CardTitle>
            <p className="text-slate-600 text-sm mt-1">
              First-In, First-Out calculation showing which purchase lots were sold
            </p>
          </CardHeader>
          <CardContent>
            {fifoBreakdown.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                <p className="text-slate-600">No matching purchase lots found for this sale</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Purchase Date</TableHead>
                      <TableHead className="text-right">Purchase Price</TableHead>
                      <TableHead className="text-right">Shares Sold</TableHead>
                      <TableHead className="text-right">Cost Basis</TableHead>
                      <TableHead className="text-right">Proceeds</TableHead>
                      <TableHead className="text-right">Gain/Loss</TableHead>
                      <TableHead className="text-center">Holding Period</TableHead>
                      <TableHead className="text-center">Tax Treatment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fifoBreakdown.map((lot, index) => (
                      <TableRow key={index}>
                        <TableCell>{formatDate(lot.buyDate)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(lot.buyPrice)}</TableCell>
                        <TableCell className="text-right">{lot.quantitySold}</TableCell>
                        <TableCell className="text-right">{formatCurrency(lot.costBasis)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(lot.proceeds)}</TableCell>
                        <TableCell className={`text-right font-semibold ${getGainLossColor(lot.gainLoss)}`}>
                          {formatCurrency(lot.gainLoss)}
                        </TableCell>
                        <TableCell className="text-center">
                          {lot.holdingPeriodDays} days
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge 
                            variant={lot.isShortTerm ? "destructive" : "secondary"}
                            className={lot.isShortTerm ? "bg-orange-100 text-orange-800" : "bg-blue-100 text-blue-800"}
                          >
                            {lot.isShortTerm ? "Short-term" : "Long-term"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tax Summary */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <FileText className="w-6 h-6 text-blue-600 mt-1" />
              <div>
                <h3 className="font-semibold text-blue-900 mb-2">Tax Reporting Summary</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-blue-800">Short-term capital gains:</span>
                    <div className={`text-lg font-bold ${getGainLossColor(totalShortTerm)}`}>
                      {formatCurrency(totalShortTerm)}
                    </div>
                    <div className="text-blue-700 text-xs">Taxed as ordinary income</div>
                  </div>
                  <div>
                    <span className="font-medium text-blue-800">Long-term capital gains:</span>
                    <div className={`text-lg font-bold ${getGainLossColor(totalLongTerm)}`}>
                      {formatCurrency(totalLongTerm)}
                    </div>
                    <div className="text-blue-700 text-xs">Preferential tax rates apply</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}