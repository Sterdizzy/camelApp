
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
// Removed: Select, SelectContent, SelectItem, SelectTrigger, SelectValue (no longer used)
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  Calendar,
  DollarSign,
  Target,
  Info,
  RefreshCw,
  Download,
  Loader2,
  ChevronDown
} from "lucide-react";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Cell, Pie } from 'recharts';
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

import { calculateAnalytics } from "@/api/functions";
import { calculateTotalPortfolioValue } from "./portfolioCalculations";

export default function Analytics() {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [livePortfolioData, setLivePortfolioData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState('ALL');
  const [selectedPortfolio, setSelectedPortfolio] = useState('all'); // New portfolio filter state
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState(null);

  const timeRanges = [
    { key: '24H', label: '24H', days: 1 },
    { key: '1W', label: '1W', days: 7 },
    { key: '1M', label: '1M', days: 30 },
    { key: '3M', label: '3M', days: 90 },
    { key: '6M', label: '6M', days: 180 },
    { key: '1Y', label: '1Y', days: 365 },
    { key: 'ALL', label: 'ALL', days: null }
  ];

  useEffect(() => {
    loadAnalyticsData();
  }, []);

  useEffect(() => {
    if (selectedTimeRange || selectedPortfolio) {
      loadAnalyticsData(selectedTimeRange, selectedPortfolio);
    }
  }, [selectedTimeRange, selectedPortfolio]);

  const loadAnalyticsData = async (timeRange = selectedTimeRange, portfolioFilter = selectedPortfolio, forceRefresh = false) => {
    if (forceRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    
    setError(null);

    try {
      // Load analytics data from server
      // The backend calculateAnalytics function is assumed to handle portfolioFilter being 'long_term' or 'trading' as a type filter.
      const { data: serverAnalytics } = await calculateAnalytics({ 
        timeRange,
        portfolioId: portfolioFilter === 'all' ? null : portfolioFilter
      });

      setAnalyticsData(serverAnalytics);
      setLastUpdate(new Date());

      // Load current portfolio data with live prices
      if (forceRefresh || !livePortfolioData) {
        try {
          const liveData = await calculateTotalPortfolioValue(null, forceRefresh); // Fetches all live data; client-side filtering occurs later
          setLivePortfolioData(liveData);
        } catch (priceError) {
          console.warn('Live price fetch failed, using server data only:', priceError);
        }
      }

    } catch (error) {
      console.error("Error loading analytics data:", error);
      setError(error.message || 'Failed to load analytics data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    loadAnalyticsData(selectedTimeRange, selectedPortfolio, true);
  };

  const handleTimeRangeChange = (newRange) => {
    if (newRange !== selectedTimeRange) {
      setSelectedTimeRange(newRange);
    }
  };

  const handleTabChange = (newTab) => {
    setSelectedPortfolio(newTab);
  };

  const handlePortfolioSelect = (portfolioId) => {
    setSelectedPortfolio(portfolioId);
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
    if (percent > 0) return 'text-green-600';
    if (percent < 0) return 'text-red-600';
    return 'text-slate-600';
  };

  // Filter data based on selected portfolio/category
  const getFilteredPortfolioData = () => {
    if (!livePortfolioData) {
      return null;
    }

    if (selectedPortfolio === 'all' || !livePortfolioData.portfolios || livePortfolioData.portfolios.length === 0) {
      return livePortfolioData;
    }

    let relevantPortfolios = [];
    if (selectedPortfolio === 'long_term' || selectedPortfolio === 'trading') {
      relevantPortfolios = livePortfolioData.portfolios.filter(p => p.type === selectedPortfolio);
    } else {
      // Specific portfolio ID selected
      const specificPortfolio = livePortfolioData.portfolios.find(p => p.id === selectedPortfolio);
      if (specificPortfolio) {
        relevantPortfolios.push(specificPortfolio);
      } else {
        // If a specific portfolio is selected but not found, fall back to all live data
        return livePortfolioData; 
      }
    }

    const filteredHoldings = livePortfolioData.holdings?.filter(h =>
      relevantPortfolios.some(p => p.id === h.portfolio_id)
    ) || [];

    // Recalculate totals for the relevant portfolios
    const totalHoldingsValue = filteredHoldings.reduce((sum, h) => sum + (h.total_value || 0), 0);
    const totalCostBasis = filteredHoldings.reduce((sum, h) => sum + (h.total_cost || 0), 0);
    const totalUnrealizedPL = totalHoldingsValue - totalCostBasis;
    const totalUnrealizedPLPercent = totalCostBasis > 0 ? (totalUnrealizedPL / totalCostBasis) * 100 : 0;
    
    const portfolioCashBalance = relevantPortfolios.reduce((sum, p) => sum + (p.cash_balance || 0), 0);
    const totalValue = totalHoldingsValue + portfolioCashBalance;

    return {
      ...livePortfolioData, // Preserve other properties not affected by filtering (like historical data etc. if they exist here)
      totalValue,
      totalHoldingsValue,
      totalCostBasis,
      totalUnrealizedPL,
      totalUnrealizedPLPercent,
      totalCashBalance: portfolioCashBalance,
      holdings: filteredHoldings,
      portfolios: relevantPortfolios // Only return the relevant portfolios for display/further filtering
    };
  };

  // Calculate sector allocation from filtered data
  const getSectorAllocation = () => {
    const filteredData = getFilteredPortfolioData();
    if (!filteredData?.holdings) return [];

    // Group by sector
    const sectorMap = new Map();
    let totalValue = 0;

    filteredData.holdings.forEach(holding => {
      const sector = holding.sector || 'Other';
      const value = holding.total_value || 0;
      
      if (sectorMap.has(sector)) {
        sectorMap.set(sector, sectorMap.get(sector) + value);
      } else {
        sectorMap.set(sector, value);
      }
      totalValue += value;
    });

    // Convert to array and calculate percentages
    const sectorData = Array.from(sectorMap.entries())
      .map(([sector, value]) => ({
        sector,
        value,
        percentage: totalValue > 0 ? (value / totalValue) * 100 : 0
      }))
      .sort((a, b) => b.value - a.value);

    return sectorData;
  };

  const getCurrentSelectionText = () => {
    if (selectedPortfolio === 'all') {
      return "All Portfolios";
    }

    if (selectedPortfolio === 'long_term') {
      return "All Long-Term Portfolios";
    }

    if (selectedPortfolio === 'trading') {
      return "All Trading Portfolios";
    }

    const portfolio = livePortfolioData?.portfolios?.find(p => p.id === selectedPortfolio);
    return portfolio ? portfolio.name : "Unknown Portfolio";
  };

  const getPortfoliosForCurrentTab = () => {
    if (!livePortfolioData?.portfolios) return [];
    
    let categoryType = null;
    if (selectedPortfolio === 'long_term' || selectedPortfolio === 'trading') {
      categoryType = selectedPortfolio;
    } else {
      const selectedP = livePortfolioData.portfolios.find(p => p.id === selectedPortfolio);
      if (selectedP) {
        categoryType = selectedP.type;
      }
    }

    if (categoryType) {
      return livePortfolioData.portfolios.filter(p => p.type === categoryType);
    }
    return [];
  };

  const getMainTabType = () => {
    if (selectedPortfolio === 'all') return 'all';
    if (selectedPortfolio === 'long_term' || selectedPortfolio === 'trading') return selectedPortfolio;
    
    const portfolio = livePortfolioData?.portfolios?.find(p => p.id === selectedPortfolio);
    return portfolio?.type || 'all';
  };

  const sectorAllocation = getSectorAllocation();
  const filteredData = getFilteredPortfolioData();

  const portfoliosForCurrentTab = getPortfoliosForCurrentTab();
  const mainTabType = getMainTabType();

  // Use filtered data when available, fall back to server analytics
  const totalValue = filteredData?.totalValue || (analyticsData?.currentMetrics?.totalCostBasis + analyticsData?.currentMetrics?.totalCashBalance) || 0;
  const totalUnrealizedPL = filteredData?.totalUnrealizedPL || 0;
  const totalUnrealizedPLPercent = filteredData?.totalUnrealizedPLPercent || 0;
  const totalCostBasis = filteredData?.totalCostBasis || analyticsData?.currentMetrics?.totalCostBasis || 0;
  const realizedPL = analyticsData?.realizedPL || { total: 0, transactions: [] };

  // Calculate combined P&L
  const allTimePL = totalUnrealizedPL + realizedPL.total;
  const allTimePLPercent = totalCostBasis > 0 ? (allTimePL / totalCostBasis) * 100 : 0;

  if (isLoading && !analyticsData) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 mx-auto animate-spin text-blue-600 mb-4" />
          <p className="text-slate-600">Loading analytics...</p>
          <p className="text-sm text-slate-500 mt-1">Calculating portfolio performance...</p>
        </div>
      </div>
    );
  }

  if (error && !analyticsData) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-500 mb-4">
            <Info className="w-12 h-12 mx-auto" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Failed to Load Analytics</h2>
          <p className="text-slate-600 mb-4">{error}</p>
          <Button onClick={() => loadAnalyticsData()} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 pb-20">
      <div className="max-w-7xl mx-auto space-y-6 lg:space-y-8">
        {/* Header with Action Buttons */}
        <div className="space-y-4">
          <div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 mb-2">
              Analytics
            </h1>
            <p className="text-slate-600 text-lg">
              Portfolio performance and diversification insights
            </p>
            {lastUpdate && (
              <p className="text-sm text-slate-500 mt-1">
                Updated {lastUpdate.toLocaleTimeString()}
                {analyticsData && (
                  <span className="ml-2">
                    • {analyticsData.dataPoints} data points • {analyticsData.transactionCount} transactions
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={handleRefresh}
              variant="outline"
              className="gap-2 bg-white hover:bg-slate-50"
              disabled={isRefreshing}
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
            <Button variant="outline" className="gap-2 bg-white hover:bg-slate-50">
              <Download className="w-4 h-4" />
              Export
            </Button>
          </div>
        </div>

        {/* Portfolio Navigation - Button Style */}
        <div className="w-full space-y-3 sm:space-y-4">
          {/* Main Portfolio Type Buttons */}
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleTabChange("all")}
                className={`px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg text-sm font-medium transition-all touch-manipulation min-h-[44px] flex-1 sm:flex-none ${
                  mainTabType === "all"
                    ? "bg-gray-700 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
                }`}
              >
                All Assets
              </button>
              <button
                onClick={() => handleTabChange("long_term")}
                className={`px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg text-sm font-medium transition-all touch-manipulation min-h-[44px] flex-1 sm:flex-none ${
                  mainTabType === "long_term"
                    ? "bg-blue-600 text-white border-2 border-blue-400"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
                }`}
              >
                Long-Term
              </button>
              <button
                onClick={() => handleTabChange("trading")}
                className={`px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg text-sm font-medium transition-all touch-manipulation min-h-[44px] flex-1 sm:flex-none ${
                  mainTabType === "trading"
                    ? "bg-blue-600 text-white border-2 border-blue-400"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
                }`}
              >
                Trading
              </button>
            </div>

            <div className="text-center sm:text-right">
              <p className="text-gray-400 text-sm break-words">
                {getCurrentSelectionText()}
              </p>
            </div>
          </div>

          {/* Sub-Portfolio Buttons */}
          {(mainTabType === "long_term" || mainTabType === "trading") && portfoliosForCurrentTab.length > 0 && (
            <div className="flex flex-wrap gap-2 pl-2 sm:pl-4 border-l-2 border-gray-700">
              {portfoliosForCurrentTab.length > 1 && (
                <button
                  onClick={() => handlePortfolioSelect(mainTabType)}
                  className={`px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-all touch-manipulation min-h-[44px] ${
                    selectedPortfolio === mainTabType
                      ? "bg-blue-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
                  }`}
                >
                  All {mainTabType === "long_term" ? "Long-Term" : "Trading"}
                </button>
              )}
              {portfoliosForCurrentTab.map((portfolio) => (
                <button
                  key={portfolio.id}
                  onClick={() => handlePortfolioSelect(portfolio.id)}
                  className={`px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-all touch-manipulation min-h-[44px] break-words ${
                    selectedPortfolio === portfolio.id
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

        {/* Performance indicator for live data */}
        {!livePortfolioData && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-amber-600" />
              <span className="text-sm text-amber-800">
                Displaying cached portfolio data. Current market prices may not be reflected.
              </span>
            </div>
          </div>
        )}

        {/* Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-white border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Total Value
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl lg:text-3xl font-bold text-slate-900 mb-1">
                {formatCurrency(totalValue)}
              </div>
              <div className="text-sm text-slate-500">
                {getCurrentSelectionText()}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Unrealized P&L
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl lg:text-3xl font-bold text-slate-900 mb-1">
                {formatCurrency(totalUnrealizedPL)}
              </div>
              <div className={`text-sm font-medium ${getPercentageColor(totalUnrealizedPLPercent)}`}>
                {formatPercentage(totalUnrealizedPLPercent)}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                <Target className="w-4 h-4" />
                Realized P&L
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl lg:text-3xl font-bold text-slate-900 mb-1">
                {formatCurrency(realizedPL.total)}
              </div>
              <div className="text-sm text-slate-500">
                {realizedPL.transactions?.length || 0} completed trades
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Total Return
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl lg:text-3xl font-bold text-slate-900 mb-1">
                {formatCurrency(allTimePL)}
              </div>
              <div className={`text-sm font-medium ${getPercentageColor(allTimePLPercent)}`}>
                {formatPercentage(allTimePLPercent)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sector Allocation Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-white border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-slate-900">
                {getCurrentSelectionText()} Allocation
              </CardTitle>
              <p className="text-sm text-slate-600">Portfolio diversification across sectors</p>
            </CardHeader>
            <CardContent>
              {sectorAllocation.length > 0 ? (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <defs>
                        <linearGradient id="pieGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#1e293b" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#475569" stopOpacity={0.8}/>
                        </linearGradient>
                      </defs>
                      <Tooltip
                        formatter={(value, name) => [formatCurrency(value), name]}
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                          fontSize: '12px'
                        }}
                      />
                      <Pie
                        data={sectorAllocation}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="url(#pieGradient)"
                        dataKey="value"
                        nameKey="sector"
                      >
                        {sectorAllocation.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={`hsl(${(index * 45) % 360}, 45%, ${45 + (index * 5) % 30}%)`}
                          />
                        ))}
                      </Pie>
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-slate-500">
                  <div className="text-center">
                    <PieChart className="w-12 h-12 mx-auto mb-3 text-slate-400" />
                    <p>No holdings found</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-slate-900">Sector Breakdown</CardTitle>
              <p className="text-sm text-slate-600">Detailed allocation percentages</p>
            </CardHeader>
            <CardContent>
              {sectorAllocation.length > 0 ? (
                <div className="space-y-3">
                  {sectorAllocation.map((sector, index) => (
                    <div key={sector.sector} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ 
                            backgroundColor: `hsl(${(index * 45) % 360}, 45%, ${45 + (index * 5) % 30}%)`
                          }}
                        />
                        <span className="font-medium text-slate-700 capitalize">
                          {sector.sector.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-slate-900">
                          {formatCurrency(sector.value)}
                        </div>
                        <div className="text-sm text-slate-500">
                          {sector.percentage.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <p>No sector data available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Performance Summary and Recent Trades */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-white border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-slate-900">Performance Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="text-xs text-slate-500 mb-1">Total Invested</div>
                  <div className="text-lg font-semibold text-slate-900">
                    {formatCurrency(totalCostBasis)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Current Value</div>
                  <div className="text-lg font-semibold text-slate-900">
                    {formatCurrency(totalValue)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Realized Trades</div>
                  <div className="text-lg font-semibold text-slate-900">
                    {realizedPL.transactions?.length || 0}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Active Positions</div>
                  <div className="text-lg font-semibold text-slate-900">
                    {analyticsData?.currentMetrics?.activePositions || filteredData?.holdings?.length || 0}
                  </div>
                </div>
              </div>
              
              {/* Overall Performance */}
              <div className="p-4 bg-slate-50 rounded-lg">
                <div className="text-xs text-slate-500 mb-2">Overall Performance</div>
                <div className={`text-2xl font-bold ${getPercentageColor(allTimePLPercent)}`}>
                  {formatPercentage(allTimePLPercent)}
                </div>
                <div className="text-sm text-slate-600">
                  {formatCurrency(allTimePL)} total return
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Realized Trades */}
          <Card className="bg-white border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-slate-900">Recent Trades</CardTitle>
              <p className="text-sm text-slate-600">
                Last {Math.min(realizedPL.transactions.length, 10)} realized sales
                {selectedPortfolio !== 'all' && ` in ${getCurrentSelectionText()}`}
              </p>
            </CardHeader>
            <CardContent>
              {realizedPL?.transactions?.length > 0 ? (
                <div className="space-y-3">
                  {realizedPL.transactions.slice(0, 10).map((tx, index) => (
                    <div key={`${tx.id}-${index}`} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                      <div>
                        <Link
                          to={`${createPageUrl("AssetDetails")}?symbol=${tx.symbol}&portfolio=${tx.portfolio_id}`}
                          className="font-semibold text-slate-900 hover:text-blue-600 hover:underline cursor-pointer"
                        >
                          {tx.symbol}
                        </Link>
                        <div className="text-xs text-slate-500">
                          {new Date(tx.transaction_date).toLocaleDateString()} • {tx.quantity} shares @ ${tx.price}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-semibold ${getPercentageColor(tx.realizedPL)}`}>
                          {formatCurrency(tx.realizedPL)}
                        </div>
                        <div className="text-xs text-slate-500">
                          {tx.realizedPL >= 0 ? 'Profit' : 'Loss'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-slate-500">
                  <p>No realized trades{selectedPortfolio !== 'all' && ` in ${getCurrentSelectionText()}`}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Portfolio Value Chart - Moved Below Performance Summary */}
        <Card className="bg-white border-0 shadow-sm">
          <CardHeader>
            <div className="space-y-4">
              <CardTitle className="text-xl font-bold text-slate-900">Portfolio Value History</CardTitle>
              
              {/* Time Range Selector */}
              <div className="flex flex-wrap gap-2">
                {timeRanges.map((range) => (
                  <Button
                    key={range.key}
                    variant={selectedTimeRange === range.key ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleTimeRangeChange(range.key)}
                    className={`text-xs h-9 px-4 ${
                      selectedTimeRange === range.key 
                        ? "bg-slate-900 text-white hover:bg-slate-800" 
                        : "bg-white hover:bg-slate-50"
                    }`}
                    disabled={isLoading}
                  >
                    {range.label}
                  </Button>
                ))}
              </div>
              
              {/* Loading indicator for chart updates */}
              {isLoading && analyticsData && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Updating chart data...</span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-80 w-full">
              {analyticsData?.historicalData?.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analyticsData.historicalData}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1e293b" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#1e293b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="date"
                      stroke="#94a3b8"
                      fontSize={11}
                      tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      fontSize={11}
                      tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
                    />
                    <Tooltip
                      formatter={(value) => [formatCurrency(value), 'Portfolio Value']}
                      labelFormatter={(label) => new Date(label).toLocaleDateString()}
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        fontSize: '12px'
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#1e293b"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorValue)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500">
                  <div className="text-center">
                    <Calendar className="w-12 h-12 mx-auto mb-3 text-slate-400" />
                    <p>No historical data available for selected period</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
