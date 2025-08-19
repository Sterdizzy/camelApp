
import React, { useState, useEffect, useRef } from "react";
import { Portfolio, Transaction } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  TrendingUp,
  Plus,
  DollarSign,
  Target,
  AlertTriangle,
  Clock,
  BookOpen,
  BarChart3,
  TrendingDown,
  MoreVertical,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { calculateHoldingsFromTransactions, calculateTotalPortfolioValue } from "./portfolioCalculations";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PriceDisplay, PriceChangeIndicator } from '@/components/ui/PriceDisplay';
import SellAssetDialog from '../components/dashboard/SellAssetDialog';

export default function Dashboard() {
  const [portfolioData, setPortfolioData] = useState({
    totalValue: 0,
    totalHoldingsValue: 0,
    totalCostBasis: 0,
    totalUnrealizedPL: 0,
    totalUnrealizedPLPercent: 0,
    totalCashBalance: 0,
    portfolios: [],
    holdings: [],
    transactions: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isPriceLoading, setIsPriceLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [activePortfolioId, setActivePortfolioId] = useState(null);
  const [lastPriceUpdate, setLastPriceUpdate] = useState(null);
  const [priceUpdateStatus, setPriceUpdateStatus] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // New state for sell functionality
  const [sellDialogOpen, setSellDialogOpen] = useState(false);
  const [selectedHoldingForSale, setSelectedHoldingForSale] = useState(null);

  const abortControllerRef = useRef(null);
  const MAX_RETRIES = 3;
  const INITIAL_RETRY_DELAY_MS = 1000;

  useEffect(() => {
    loadPortfolioData();

    // Start background refresh on component mount
    import('./portfolioCalculations').then(({ startBackgroundPriceRefresh }) => {
      startBackgroundPriceRefresh();
    });

    // Cleanup on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      import('./portfolioCalculations').then(({ stopBackgroundPriceRefresh }) => {
        stopBackgroundPriceRefresh();
      });
    };
  }, []);

  const loadPortfolioData = async (forceRefresh = false) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setIsPriceLoading(true);
    setPriceUpdateStatus(forceRefresh ? 'Force refreshing data...' : 'Loading portfolio data...');

    let currentRetry = 0;
    let success = false;
    let lastError = null;

    while (currentRetry <= MAX_RETRIES && !success) {
      try {
        console.log(`Attempt ${currentRetry + 1}/${MAX_RETRIES + 1}: Starting portfolio data load...`);
        setPriceUpdateStatus(`${forceRefresh ? 'Force refreshing' : 'Loading'} data (attempt ${currentRetry + 1}/${MAX_RETRIES + 1})...`);

        const data = await calculateTotalPortfolioValue(controller.signal, forceRefresh);

        if (controller.signal.aborted) {
          console.log('Portfolio data load aborted by user or new request.');
          setPriceUpdateStatus('Data fetch cancelled.');
          return;
        }

        setPortfolioData(data);
        setLastPriceUpdate(new Date());

        // Set status based on fetch result
        if (data.pricesFetchStatus === 'success') {
          setPriceUpdateStatus('Portfolio data updated successfully!');
        } else if (data.pricesFetchStatus === 'failed') {
          setPriceUpdateStatus('Updated with cached prices (API unavailable)');
        } else {
          setPriceUpdateStatus('Portfolio data loaded');
        }

        success = true;

        console.log('Portfolio data loaded successfully:', {
          totalValue: data.totalValue,
          totalUnrealizedPL: data.totalUnrealizedPL,
          holdingsCount: data.holdings.length,
          fetchStatus: data.pricesFetchStatus
        });

      } catch (error) {
        lastError = error;
        if (error.name === 'AbortError') {
          console.log('Portfolio data load aborted by AbortController signal.');
          setPriceUpdateStatus('Data fetch cancelled.');
          return;
        }

        console.error(`Error loading portfolio data (attempt ${currentRetry + 1}):`, error);

        if (currentRetry < MAX_RETRIES) {
          const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, currentRetry);
          setPriceUpdateStatus(`Failed to fetch data. Retrying in ${delay / 1000}s...`);
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          currentRetry++;
        } else {
          setPriceUpdateStatus('Failed to load portfolio data after multiple attempts. Please try again later.');
          console.error("All retry attempts failed.");
        }
      } finally {
        if (success || currentRetry > MAX_RETRIES) {
          if (abortControllerRef.current === controller) {
            setIsLoading(false);
            setIsPriceLoading(false);
            abortControllerRef.current = null;

            if (success) {
                setTimeout(() => setPriceUpdateStatus(''), 5000); // Show status longer
            }
          }
        }
      }
    }
  };

  const handleRefresh = () => {
    loadPortfolioData(true); // Force refresh when user clicks Sync All
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getFilteredHoldings = () => {
    if (!portfolioData?.holdings) return [];

    let currentHoldings = portfolioData.holdings;

    if (activeTab !== "all") {
      const portfoliosOfType = portfolioData.portfolios.filter(p => p.type === activeTab);
      currentHoldings = currentHoldings.filter(h =>
        portfoliosOfType.some(p => p.id === h.portfolio_id)
      );
    }

    if (activePortfolioId) {
      currentHoldings = currentHoldings.filter(h => h.portfolio_id === activePortfolioId);
    }

    return currentHoldings;
  };

  const getSortedHoldings = () => {
    const filtered = getFilteredHoldings();

    if (!sortConfig.key) return filtered;

    return [...filtered].sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      // Handle different data types
      switch (sortConfig.key) {
        case 'name':
        case 'symbol':
          aValue = (aValue || '').toLowerCase();
          bValue = (bValue || '').toLowerCase();
          break;
        case 'quantity':
        case 'current_price':
        case 'total_value':
        case 'purchase_price':
        case 'unrealized_pl':
        case 'unrealized_pl_percent':
          aValue = parseFloat(aValue) || 0;
          bValue = parseFloat(bValue) || 0;
          break;
        default:
          break;
      }

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  };

  const SortableHeader = ({ sortKey, children, className = "", align = "left" }) => {
    const isSorted = sortConfig.key === sortKey;
    const direction = sortConfig.direction;

    return (
      <TableHead
        className={`text-gray-400 cursor-pointer hover:text-gray-200 transition-colors select-none ${className}`}
        onClick={() => handleSort(sortKey)}
      >
        <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
          <span>{children}</span>
          <div className="w-4 h-4 flex items-center justify-center">
            {isSorted ? (
              direction === 'asc' ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )
            ) : (
              <ChevronsUpDown className="w-3 h-3 opacity-40" />
            )}
          </div>
        </div>
      </TableHead>
    );
  };

  const getFilteredAssetsValue = () => {
    const filteredHoldings = getFilteredHoldings();
    return filteredHoldings.reduce((sum, h) => sum + h.total_value, 0);
  };

  const getPortfoliosForCurrentTab = () => {
    if (!portfolioData?.portfolios || activeTab === "all") return [];
    return portfolioData.portfolios.filter(p => p.type === activeTab);
  };

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    setActivePortfolioId(null);
  };

  const handlePortfolioSelect = (portfolioId) => {
    setActivePortfolioId(portfolioId);
  };

  const getCurrentSelectionText = () => {
    if (activeTab === "all") {
      return "All Assets";
    }

    if (activePortfolioId) {
      const portfolio = portfolioData.portfolios?.find(p => p.id === activePortfolioId);
      return portfolio ? portfolio.name : "Unknown Portfolio";
    }

    return activeTab === "long_term" ? "All Long-Term Portfolios" : "All Trading Portfolios";
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

  const getPercentageColor = (percent) => {
    if (percent === null || percent === undefined || isNaN(percent)) return 'text-gray-400';
    return percent >= 0 ? 'text-green-400' : 'text-red-400';
  };

  const formatQuantity = (quantity) => {
    return (quantity || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8
    });
  };

  // New functions for sell functionality
  const handleSellAsset = (holding) => {
    console.log('Opening sell dialog for:', holding.symbol);
    setSelectedHoldingForSale(holding);
    setSellDialogOpen(true);
  };

  const handleSellSuccess = () => {
    setSellDialogOpen(false);
    setSelectedHoldingForSale(null);
    // Refresh portfolio data after successful sale
    setTimeout(() => {
      loadPortfolioData(false);
    }, 500);
  };

  const sortedHoldings = getSortedHoldings();
  const portfoliosForCurrentTab = getPortfoliosForCurrentTab();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading portfolio...</p>
          {priceUpdateStatus && (
            <p className="text-sm text-blue-400 mt-2">{priceUpdateStatus}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-3 sm:p-4 lg:p-6 pb-20">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">

        {/* Mobile-First Header */}
        <div className="space-y-3 sm:space-y-4">
          <h1 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold text-white">
            Dashboard
          </h1>

          {/* Mobile-Optimized Total Worth Display */}
          <div className="bg-gray-800/50 rounded-xl p-4 sm:p-5 lg:p-6 border border-gray-700">
            <p className="text-gray-400 text-xs sm:text-sm mb-2">Total Worth</p>

            <div className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold text-white mb-3">
              {formatCurrency(portfolioData?.totalValue || 0)}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 sm:w-6 sm:h-6 bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full ${isPriceLoading ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}></div>
                </div>
                <div className={`flex flex-col sm:flex-row sm:items-center sm:gap-2 ${getPercentageColor(portfolioData?.totalUnrealizedPL || 0)}`}>
                  <span className="text-sm sm:text-base lg:text-lg font-semibold">
                    {formatCurrency(portfolioData?.totalUnrealizedPL || 0)}
                  </span>
                  <span className="flex items-center gap-1 text-xs sm:text-sm">
                    {(portfolioData?.totalUnrealizedPL || 0) >= 0 ? '▲' : '▼'}
                    {formatPercentage(portfolioData?.totalUnrealizedPLPercent || 0)}
                  </span>
                </div>
              </div>

              <Badge variant="secondary" className="bg-gray-700 text-gray-300 w-fit text-xs">
                All Time
              </Badge>
            </div>

            {/* Mobile-Friendly Status Messages */}
            {priceUpdateStatus && (
              <div className="text-xs sm:text-sm text-blue-400 mt-3 flex items-center gap-2">
                <span>{priceUpdateStatus}</span>
              </div>
            )}

            {lastPriceUpdate && (
              <div className="text-xs text-gray-500 mt-2">
                Last updated: {lastPriceUpdate.toLocaleTimeString()}
              </div>
            )}
          </div>

          {/* Mobile-First Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <Button
              variant="outline"
              className="bg-gray-800 border-gray-600 text-white hover:bg-gray-700 h-11 sm:h-12 touch-manipulation w-full sm:w-auto"
              onClick={handleRefresh}
              disabled={isPriceLoading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isPriceLoading ? 'animate-spin' : ''}`} />
              {isPriceLoading ? 'Syncing...' : 'Sync All'}
            </Button>

            <Link to={createPageUrl("TradeJournal")} className="w-full sm:w-auto">
              <Button className="bg-orange-500 hover:bg-orange-600 w-full h-11 sm:h-12 touch-manipulation">
                <BookOpen className="w-4 h-4 mr-2" />
                Record a Trade
              </Button>
            </Link>
          </div>
        </div>

        {/* Mobile-First Portfolio Navigation */}
        <div className="w-full space-y-3 sm:space-y-4">
          {/* Main Portfolio Type Tabs - Mobile Optimized */}
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleTabChange("all")}
                className={`px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg text-sm font-medium transition-all touch-manipulation min-h-[44px] flex-1 sm:flex-none ${
                  activeTab === "all"
                    ? "bg-gray-700 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
                }`}
              >
                All Assets
              </button>
              <button
                onClick={() => handleTabChange("long_term")}
                className={`px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg text-sm font-medium transition-all touch-manipulation min-h-[44px] flex-1 sm:flex-none ${
                  activeTab === "long_term"
                    ? "bg-gray-700 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
                }`}
              >
                Long-Term
              </button>
              <button
                onClick={() => handleTabChange("trading")}
                className={`px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg text-sm font-medium transition-all touch-manipulation min-h-[44px] flex-1 sm:flex-none ${
                  activeTab === "trading"
                    ? "bg-gray-700 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
                }`}
              >
                Trading
              </button>
            </div>

            <div className="text-center sm:text-right">
              <p className="text-gray-400 text-sm break-words">
                {getCurrentSelectionText()}: {formatCurrency(getFilteredAssetsValue())}
              </p>
            </div>
          </div>

          {/* Sub-Portfolio Buttons - Mobile Optimized */}
          {(activeTab === "long_term" || activeTab === "trading") && portfoliosForCurrentTab.length > 0 && (
            <div className="flex flex-wrap gap-2 pl-2 sm:pl-4 border-l-2 border-gray-700">
              {portfoliosForCurrentTab.length > 1 && (
                <button
                  onClick={() => handlePortfolioSelect(null)}
                  className={`px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-all touch-manipulation min-h-[44px] ${
                    activePortfolioId === null
                      ? "bg-blue-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
                  }`}
                >
                  All {activeTab === "long_term" ? "Long-Term" : "Trading"}
                </button>
              )}
              {portfoliosForCurrentTab.map((portfolio) => (
                <button
                  key={portfolio.id}
                  onClick={() => handlePortfolioSelect(portfolio.id)}
                  className={`px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-all touch-manipulation min-h-[44px] break-words ${
                    activePortfolioId === portfolio.id
                      ? "bg-blue-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
                  }`}
                >
                  {portfolio.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Mobile-First Assets Display */}
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-0">
            {sortedHoldings.length === 0 ? (
              <div className="text-center py-8 sm:py-12 px-4 text-gray-400">
                <TrendingUp className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-gray-600" />
                <p className="text-base sm:text-lg">No assets found</p>
                <p className="text-sm mt-2 break-words">
                  {activeTab === "all"
                    ? "No investments in any portfolio"
                    : activePortfolioId
                      ? `No assets in ${portfolioData.portfolios?.find(p => p.id === activePortfolioId)?.name || "this portfolio"}`
                      : `No assets in ${activeTab === "long_term" ? "long-term" : "trading"} portfolios`
                  }
                </p>
              </div>
            ) : (
              <>
                {/* Desktop Table - Hidden on mobile */}
                <div className="hidden lg:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-700 hover:bg-transparent">
                        <SortableHeader sortKey="name">Name</SortableHeader>
                        <SortableHeader sortKey="quantity" align="right">Amount</SortableHeader>
                        <SortableHeader sortKey="current_price" align="right">Price</SortableHeader>
                        <SortableHeader sortKey="total_value" align="right">Total</SortableHeader>
                        <SortableHeader sortKey="purchase_price" align="right">
                          <div>Avg Buy</div>
                          <div className="text-xs font-normal">All Time</div>
                        </SortableHeader>
                        <SortableHeader sortKey="unrealized_pl" align="right">
                          <div>P/L</div>
                          <div className="text-xs font-normal">All Time</div>
                        </SortableHeader>
                        <SortableHeader sortKey="unrealized_pl" align="right">Profit / Unrealized</SortableHeader>
                        <TableHead className="text-gray-400 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedHoldings.map((holding) => (
                        <TableRow key={holding.id} className="border-gray-700 hover:bg-gray-800/50">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-bold text-white">
                                  {holding.symbol?.charAt(0) || '?'}
                                </span>
                              </div>
                              <div>
                                <Link
                                  to={`${createPageUrl("AssetDetails")}?symbol=${holding.symbol}&portfolio=${holding.portfolio_id}`}
                                  className="hover:underline cursor-pointer"
                                >
                                  <div className="font-semibold text-white hover:text-blue-400 transition-colors">
                                    {holding.name || 'Unknown'}
                                  </div>
                                </Link>
                                <div className="text-sm text-gray-400">• {holding.symbol || 'N/A'}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-white">
                            {formatQuantity(holding.quantity)}
                          </TableCell>
                          <TableCell className="text-right">
                            <PriceDisplay
                              price={holding.current_price}
                              priceStatus={holding.price_status}
                              lastUpdate={holding.last_price_update}
                              size="small"
                              showRetryButton={holding.price_status === 'failed'}
                              onRetry={() => handleRefresh()}
                            />
                          </TableCell>
                          <TableCell className="text-right text-white font-semibold">
                            {formatCurrency(holding.total_value)}
                          </TableCell>
                          <TableCell className="text-right text-white">
                            {formatCurrency(holding.purchase_price)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-col items-end gap-1">
                              <div className={`font-semibold ${getPercentageColor(holding.unrealized_pl)}`}>
                                {formatCurrency(holding.unrealized_pl || 0)}
                              </div>
                              <PriceChangeIndicator
                                currentPrice={holding.current_price}
                                previousPrice={holding.purchase_price}
                                percentage={holding.unrealized_pl_percent}
                                size="small"
                              />
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className={getPercentageColor(holding.unrealized_pl || 0)}>
                              {formatCurrency(holding.unrealized_pl || 0)}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSellAsset(holding)}
                              className="bg-red-600 hover:bg-red-700 border-red-600 text-white hover:text-white min-h-[44px] px-3"
                              aria-label={`Sell ${holding.symbol}`}
                            >
                              <TrendingDown className="w-4 h-4 mr-1" />
                              Sell
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Card View - Touch Optimized */}
                <div className="lg:hidden p-3 sm:p-4 space-y-3 sm:space-y-4">
                  {sortedHoldings.map((holding) => (
                    <Card key={holding.id} className="bg-gray-750 border-gray-600 touch-manipulation">
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex items-start justify-between mb-3 sm:mb-4">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
                              <span className="text-xs sm:text-sm font-bold text-white">
                                {holding.symbol?.charAt(0) || '?'}
                              </span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <Link
                                to={`${createPageUrl("AssetDetails")}?symbol=${holding.symbol}&portfolio=${holding.portfolio_id}`}
                                className="hover:underline cursor-pointer touch-manipulation"
                              >
                                <div className="font-bold text-base sm:text-lg text-white hover:text-blue-400 transition-colors truncate">
                                  {holding.symbol || 'N/A'}
                                </div>
                              </Link>
                              <div className="text-xs sm:text-sm text-gray-400 truncate">{holding.name || 'Unknown'}</div>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="font-bold text-white text-base sm:text-lg">
                              {formatCurrency(holding.total_value)}
                            </div>
                            <div className="text-xs text-gray-400">Total Value</div>
                          </div>
                        </div>

                        {/* Mobile-Optimized Grid */}
                        <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4">
                          <div>
                            <div className="text-xs text-gray-400 mb-1">Quantity</div>
                            <div className="text-sm font-medium text-white break-all">
                              {formatQuantity(holding.quantity)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-400 mb-1">Current Price</div>
                            <PriceDisplay
                              price={holding.current_price}
                              priceStatus={holding.price_status}
                              lastUpdate={holding.last_price_update}
                              size="medium"
                              showRetryButton={holding.price_status === 'failed'}
                              onRetry={() => handleRefresh()}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4">
                          <div>
                            <div className="text-xs text-gray-400 mb-1">Avg Buy Price</div>
                            <div className="text-sm font-medium text-white">
                              {formatCurrency(holding.purchase_price)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-400 mb-1">P/L</div>
                            <div className={`text-sm font-semibold ${getPercentageColor(holding.unrealized_pl || 0)}`}>
                              {formatCurrency(holding.unrealized_pl || 0)}
                            </div>
                          </div>
                        </div>

                        {/* Mobile P/L Indicator and Sell Button */}
                        <div className="pt-2 sm:pt-3 border-t border-gray-600">
                          <div className="flex items-center justify-between">
                            <PriceChangeIndicator
                              currentPrice={holding.current_price}
                              previousPrice={holding.purchase_price}
                              percentage={holding.unrealized_pl_percent}
                              size="large"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSellAsset(holding)}
                              className="bg-red-600 hover:bg-red-700 border-red-600 text-white hover:text-white min-h-[44px] px-4 touch-manipulation"
                              aria-label={`Sell ${holding.symbol}`}
                            >
                              <TrendingDown className="w-4 h-4 mr-2" />
                              Sell Now
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sell Asset Dialog */}
      <SellAssetDialog
        open={sellDialogOpen}
        onOpenChange={setSellDialogOpen}
        holding={selectedHoldingForSale}
        currentPrice={selectedHoldingForSale?.current_price}
        onSuccess={handleSellSuccess}
      />
    </div>
  );
}
