
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Transaction, Sector, Portfolio } from "@/api/entities";
import { Plus, Loader2, AlertTriangle, CheckCircle, Info, Shield, Calculator } from "lucide-react";
import { format, parseISO } from "date-fns";
import { validateTransactionRisk, calculateTotalPortfolioValue } from "../../pages/portfolioCalculations";

// Simple debounce function (moved outside component for reusability/clarity)
function debounce(func, wait) {
  let timeout;
  let debounced = (...args) => {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
  debounced.cancel = () => { // Add a cancel method for cleanup
    clearTimeout(timeout);
  };
  return debounced;
}

const getInitialFormData = () => ({
  portfolio_id: "",
  type: "buy",
  symbol: "",
  name: "",
  sector: "",
  quantity: "",
  price: "",
  transaction_date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  stop_loss_at_trade: "",
  risk_percentage_at_trade: 1,
  notes: "",
});

export default function AddTransactionDialog({ 
  open, 
  onOpenChange, 
  portfolios, // This prop might still be used for initial formData setup if prefilledData uses it
  onSuccess, 
  editingTransaction,
  prefilledData = null 
}) {
  const [availableSectors, setAvailableSectors] = useState([]); // Renamed from 'sectors'
  const [availablePortfolios, setAvailablePortfolios] = useState([]); // New state for portfolios loaded internally
  const [formData, setFormData] = useState(() => {
    // Initialize form data immediately based on editingTransaction or prefilledData
    if (editingTransaction) {
      let transactionDate = format(new Date(), "yyyy-MM-dd'T'HH:mm");
      if (editingTransaction.transaction_date) {
        try {
          const parsedDate = new Date(editingTransaction.transaction_date);
          if (!isNaN(parsedDate.getTime())) {
            transactionDate = format(parsedDate, "yyyy-MM-dd'T'HH:mm");
          }
        } catch (error) {
          console.error("Date parsing error:", error);
        }
      }

      return {
        portfolio_id: editingTransaction.portfolio_id || "",
        type: editingTransaction.type || "buy",
        symbol: (editingTransaction.symbol || "").toUpperCase(),
        name: editingTransaction.name || "",
        sector: editingTransaction.sector || "",
        quantity: editingTransaction.quantity ? String(editingTransaction.quantity) : "",
        price: editingTransaction.price ? String(editingTransaction.price) : "",
        transaction_date: transactionDate,
        stop_loss_at_trade: editingTransaction.stop_loss_at_trade ? String(editingTransaction.stop_loss_at_trade) : "",
        risk_percentage_at_trade: editingTransaction.risk_percentage_at_trade || 1,
        notes: editingTransaction.notes || "",
      };
    } else if (prefilledData) {
      return {
        portfolio_id: prefilledData.portfolio_id || "",
        type: prefilledData.type || "buy",
        symbol: (prefilledData.symbol || "").toUpperCase(),
        name: prefilledData.name || "",
        sector: prefilledData.sector || "",
        quantity: prefilledData.quantity ? String(prefilledData.quantity) : "",
        price: prefilledData.price ? String(prefilledData.price) : "",
        transaction_date: prefilledData.transaction_date ? format(new Date(prefilledData.transaction_date), "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        stop_loss_at_trade: prefilledData.stop_loss_at_trade ? String(prefilledData.stop_loss_at_trade) : "",
        risk_percentage_at_trade: prefilledData.risk_percentage_at_trade || 1,
        notes: prefilledData.notes || "",
      };
    }
    return getInitialFormData();
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uniqueAssets, setUniqueAssets] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [riskValidation, setRiskValidation] = useState(null);
  const [portfolioData, setPortfolioData] = useState(null); // This is for risk calculations, not the dropdown list
  const [preCalculatedRiskMetrics, setPreCalculatedRiskMetrics] = useState(null);
  const [isLoadingRisk, setIsLoadingRisk] = useState(false);
  const [useRiskSlider, setUseRiskSlider] = useState(false);
  const [riskOverride, setRiskOverride] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false); // New state for overall data loading
  const [error, setError] = useState(null); // New state for errors

  // DEBUG: Log everything when props change
  useEffect(() => {
    console.log("=== AddTransactionDialog Props Debug ===");
    console.log("open:", open);
    console.log("editingTransaction:", editingTransaction);
    console.log("prefilledData:", prefilledData);
    console.log("current formData:", formData);
    console.log("==========================================");
  }, [open, editingTransaction, prefilledData, formData]);

  // Helper function to get stop loss error message - Defined before its use in useMemo
  const getStopLossErrorMessage = () => {
    if (formData.type === 'buy') {
      return "For long positions, stop loss must be below entry price";
    } else {
      return "For short positions, stop loss must be above entry price";
    }
  };

  // Function to load portfolio data for risk calculations
  const loadPortfolioData = async () => {
    setIsLoadingRisk(true);
    try {
      const data = await calculateTotalPortfolioValue();
      setPortfolioData(data);
      setPreCalculatedRiskMetrics(data.risk_metrics);
      console.log('Pre-calculated risk metrics loaded:', data.risk_metrics);
    } catch (error) {
      console.error("Error loading portfolio data:", error);
    }
    setIsLoadingRisk(false);
  };

  // Debounced function to prevent excessive calculations for risk validation
  const debouncedRiskValidation = useCallback(
    debounce((formData, portfolioData, preCalculatedRiskMetrics) => {
      if (portfolioData && preCalculatedRiskMetrics && formData.portfolio_id && formData.type && formData.symbol &&
          formData.quantity && formData.price && formData.sector) {

        const proposedTransaction = {
          portfolio_id: formData.portfolio_id,
          type: formData.type,
          symbol: formData.symbol,
          quantity: parseFloat(formData.quantity || 0),
          price: parseFloat(formData.price || 0),
          stop_loss_at_trade: formData.stop_loss_at_trade ? parseFloat(formData.stop_loss_at_trade) : null,
          sector: formData.sector
        };

        const validation = validateTransactionRisk(
          proposedTransaction,
          portfolioData.portfolios,
          portfolioData.holdings,
          portfolioData.totalValue,
          preCalculatedRiskMetrics
        );

        setRiskValidation(validation);
      } else {
        setRiskValidation(null);
      }
    }, 500),
    [setRiskValidation]
  );

  // Optimized suggested quantity calculation with proper memoization
  const suggestedQuantity = useMemo(() => {
    if (!portfolioData || !useRiskSlider || !formData.price || !formData.stop_loss_at_trade) {
      return null;
    }

    const totalValue = portfolioData.totalValue;
    const riskPercentage = formData.risk_percentage_at_trade;
    const entryPrice = parseFloat(formData.price);
    const stopLossPrice = parseFloat(formData.stop_loss_at_trade);

    if (isNaN(entryPrice) || isNaN(stopLossPrice) || totalValue <= 0 || entryPrice <= 0) {
      return null;
    }

    let riskPerShare;
    let validStopLoss = true;

    if (formData.type === 'buy') {
      riskPerShare = entryPrice - stopLossPrice;
      validStopLoss = stopLossPrice < entryPrice;
    } else {
      riskPerShare = stopLossPrice - entryPrice;
      validStopLoss = stopLossPrice > entryPrice;
    }

    if (!validStopLoss || riskPerShare <= 0) {
      return { error: true, message: getStopLossErrorMessage() };
    }

    const totalRiskAmount = totalValue * (riskPercentage / 100);
    const calculatedQuantity = totalRiskAmount / riskPerShare;

    return {
      error: false,
      quantity: Math.floor(calculatedQuantity * 100) / 100,
      riskAmount: totalRiskAmount,
      riskPerShare: riskPerShare
    };
  }, [
    portfolioData?.totalValue,
    formData.price,
    formData.stop_loss_at_trade,
    formData.risk_percentage_at_trade,
    formData.type,
    useRiskSlider
  ]);

  // Function to load all initial data for the dialog
  const loadInitialData = async () => {
    if (!open) return; // Ensure dialog is open before loading
    setIsLoadingData(true);
    setError(null); // Clear any previous errors

    try {
      const [portfoliosData, sectorData, transactionData] = await Promise.all([
        Portfolio.list(),
        Sector.list(),
        Transaction.list() // Added back for uniqueAssets
      ]);

      setAvailablePortfolios(portfoliosData);
      setAvailableSectors(sectorData); // Renamed from setSectors

      // Populate uniqueAssets for symbol suggestions
      const assetMap = new Map();
      transactionData.forEach(tx => {
        if (tx.symbol) {
          const upperSymbol = tx.symbol.toUpperCase();
          if (!assetMap.has(upperSymbol)) {
            assetMap.set(upperSymbol, {
              symbol: upperSymbol,
              name: tx.name || "",
              sector: tx.sector || "",
            });
          }
        }
      });
      setUniqueAssets(Array.from(assetMap.values()));

      // If no portfolio is selected, default to the first one available
      if (portfoliosData.length > 0 && !formData.portfolio_id) {
        setFormData(prev => ({
          ...prev,
          portfolio_id: portfoliosData[0].id
        }));
      }

    } catch (err) {
      console.error("Failed to load initial data:", err);
      setError("Failed to load portfolios, sectors, or existing transactions. Please try again.");
    } finally {
      setIsLoadingData(false);
    }
  };

  // Load initial data when dialog opens
  useEffect(() => {
    if (open) {
      loadInitialData(); // Load data for dropdowns and suggestions
      loadPortfolioData(); // Load data for risk calculations
      setRiskOverride(false); // Reset risk override
    }
  }, [open]); // Dependency: `open`

  // Update form data when editingTransaction or prefilledData changes, or dialog opens for a new transaction
  useEffect(() => {
    if (editingTransaction) {
      console.log("Updating form with transaction:", editingTransaction);

      let transactionDate = format(new Date(), "yyyy-MM-dd'T'HH:mm");
      if (editingTransaction.transaction_date) {
        try {
          const parsedDate = new Date(editingTransaction.transaction_date);
          if (!isNaN(parsedDate.getTime())) {
            transactionDate = format(parsedDate, "yyyy-MM-dd'T'HH:mm");
          }
        } catch (error) {
          console.error("Date parsing error:", error);
        }
      }

      setFormData({
        portfolio_id: editingTransaction.portfolio_id || "",
        type: editingTransaction.type || "buy",
        symbol: (editingTransaction.symbol || "").toUpperCase(),
        name: editingTransaction.name || "",
        sector: editingTransaction.sector || "",
        quantity: editingTransaction.quantity ? String(editingTransaction.quantity) : "",
        price: editingTransaction.price ? String(editingTransaction.price) : "",
        transaction_date: transactionDate,
        stop_loss_at_trade: editingTransaction.stop_loss_at_trade ? String(editingTransaction.stop_loss_at_trade) : "",
        risk_percentage_at_trade: editingTransaction.risk_percentage_at_trade || 1,
        notes: editingTransaction.notes || "",
      });
    } else if (prefilledData && open) { // Only apply prefilledData if dialog is open and not editing
      console.log("Applying prefilledData:", prefilledData);
      setFormData({
        portfolio_id: prefilledData.portfolio_id || "",
        symbol: (prefilledData.symbol || "").toUpperCase(),
        name: prefilledData.name || "",
        sector: prefilledData.sector || "",
        type: prefilledData.type || "buy",
        quantity: prefilledData.quantity ? String(prefilledData.quantity) : "",
        price: prefilledData.price ? String(prefilledData.price) : "",
        transaction_date: prefilledData.transaction_date ? format(new Date(prefilledData.transaction_date), "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        stop_loss_at_trade: prefilledData.stop_loss_at_trade ? String(prefilledData.stop_loss_at_trade) : "",
        risk_percentage_at_trade: prefilledData.risk_percentage_at_trade || 1,
        notes: prefilledData.notes || "",
      });
    } else if (open) {
      // Reset for new transaction if dialog opens without editingTransaction or prefilledData
      setFormData(getInitialFormData());
    }
  }, [editingTransaction, open, prefilledData]);

  // Optimized auto-fill quantity with proper dependency management
  useEffect(() => {
    if (useRiskSlider && suggestedQuantity && !suggestedQuantity.error) {
      const newQuantity = suggestedQuantity.quantity.toString();
      if (formData.quantity !== newQuantity) {
        setFormData(prev => ({
          ...prev,
          quantity: newQuantity
        }));
      }
    }
  }, [suggestedQuantity?.quantity, useRiskSlider]);

  // Updated useEffect for risk validation with debouncing
  useEffect(() => {
    debouncedRiskValidation(formData, portfolioData, preCalculatedRiskMetrics);

    return () => {
      debouncedRiskValidation.cancel && debouncedRiskValidation.cancel();
    };
  }, [formData, portfolioData, preCalculatedRiskMetrics, debouncedRiskValidation]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.stop_loss_at_trade) {
      const stopLoss = parseFloat(formData.stop_loss_at_trade);
      const entryPrice = parseFloat(formData.price);

      if (!isNaN(stopLoss) && !isNaN(entryPrice)) {
        if (formData.type === 'buy' && stopLoss >= entryPrice) {
          alert("For long positions (Buy), stop-loss must be below the entry price.");
          return;
        }
        if (formData.type === 'sell' && stopLoss <= entryPrice) {
          alert("For short positions (Sell), stop-loss must be above the entry price.");
          return;
        }
      }
    }

    if (riskValidation && !riskValidation.is_valid && riskValidation.validation_type !== 'no_stop_loss') {
      if (!riskOverride) {
        alert(`Risk validation failed: ${riskValidation.message}. Use the override checkbox to proceed anyway.`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const transactionValue = parseFloat(formData.quantity) * parseFloat(formData.price);
      
      const selectedPortfolio = availablePortfolios.find(p => p.id === formData.portfolio_id); // Use availablePortfolios
      if (!selectedPortfolio) {
        throw new Error("Portfolio not found. Please select a valid portfolio.");
      }

      const dataToSave = {
        ...formData,
        symbol: formData.symbol.toUpperCase(),
        quantity: parseFloat(formData.quantity),
        price: parseFloat(formData.price),
        transaction_date: new Date(formData.transaction_date).toISOString(),
        stop_loss_at_trade: formData.stop_loss_at_trade 
          ? parseFloat(formData.stop_loss_at_trade) 
          : null,
        risk_percentage_at_trade: useRiskSlider ? parseFloat(formData.risk_percentage_at_trade) : null,
        notes: riskOverride && riskValidation && !riskValidation.is_valid && riskValidation.validation_type !== 'no_stop_loss'
          ? `${formData.notes || ''}\n\n[RISK OVERRIDE: ${riskValidation.message}]`.trim()
          : formData.notes,
      };

      if (editingTransaction && editingTransaction.id) {
        const oldTransactionValue = editingTransaction.quantity * editingTransaction.price;
        let cashAdjustment = 0;
        
        if (editingTransaction.type === 'buy') {
          cashAdjustment += oldTransactionValue;
        } else {
          cashAdjustment -= oldTransactionValue;
        }
        
        if (formData.type === 'buy') {
          cashAdjustment -= transactionValue;
        } else {
          cashAdjustment += transactionValue;
        }

        const newCashBalance = (selectedPortfolio.cash_balance || 0) + cashAdjustment;
        
        if (formData.type === 'buy' && newCashBalance < 0) {
          alert(`Insufficient cash balance for this buy transaction. Available: ${formatCurrency(selectedPortfolio.cash_balance || 0)}, Required: ${formatCurrency(transactionValue)}. After reversing old transaction's cash impact, you would have ${formatCurrency(newCashBalance - cashAdjustment + transactionValue)} and need ${formatCurrency(transactionValue)}.`);
          setIsSubmitting(false);
          return;
        }

        await Transaction.update(editingTransaction.id, dataToSave);
        await Portfolio.update(selectedPortfolio.id, { cash_balance: newCashBalance });
      } else {
        let newCashBalance;
        
        if (formData.type === 'buy') {
          newCashBalance = (selectedPortfolio.cash_balance || 0) - transactionValue;
          
          if (newCashBalance < 0) {
            alert(`Insufficient cash balance for this buy transaction. Available: ${formatCurrency(selectedPortfolio.cash_balance || 0)}, Required: ${formatCurrency(transactionValue)}.`);
            setIsSubmitting(false);
            return;
          }
        } else {
          newCashBalance = (selectedPortfolio.cash_balance || 0) + transactionValue;
        }

        await Transaction.create(dataToSave);
        await Portfolio.update(selectedPortfolio.id, { cash_balance: newCashBalance });
      }

      onSuccess();
      onOpenChange(false);
      setRiskOverride(false);
    } catch (error) {
      console.error("Error saving transaction:", error);
      alert(`Error saving transaction: ${error.message || "Please try again."}`);
    }
    setIsSubmitting(false);
  };

  const handleSymbolChange = (value) => {
    const upperValue = value.toUpperCase();
    setFormData({ ...formData, symbol: upperValue });

    const matchingAsset = uniqueAssets.find(asset => asset.symbol === upperValue);
    if (matchingAsset) {
      setFormData(prev => ({
        ...prev,
        symbol: matchingAsset.symbol,
        name: matchingAsset.name,
        sector: matchingAsset.sector
      }));
    }
  };

  const filteredSuggestions = uniqueAssets.filter(asset =>
    asset.symbol.includes(formData.symbol.toUpperCase()) &&
    asset.symbol !== formData.symbol.toUpperCase()
  ).slice(0, 5);

  const selectedPortfolio = availablePortfolios.find(p => p.id === formData.portfolio_id); // Use availablePortfolios
  const isTrading = selectedPortfolio?.type === 'trading';

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatPercentage = (percent) => {
    return `${percent.toFixed(2)}%`;
  };

  const handleRiskPercentageChange = useCallback((value) => {
    setFormData(prev => ({
      ...prev,
      risk_percentage_at_trade: value[0]
    }));
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            {editingTransaction ? "Edit Transaction" : "Record New Transaction"}
          </DialogTitle>
        </DialogHeader>

        {isLoadingData && (
          <Alert className="bg-blue-50 border-blue-200">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            <AlertDescription className="text-blue-800">
              Loading required data...
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="portfolio" className="text-sm font-medium">
                Portfolio *
              </Label>
              <Select 
                value={formData.portfolio_id} 
                onValueChange={(value) => {
                  setFormData({...formData, portfolio_id: value});
                  setRiskValidation(null); // Clear risk validation when portfolio changes
                }}
                required
              >
                <SelectTrigger id="portfolio" className="h-11">
                  <SelectValue placeholder="Select portfolio" />
                </SelectTrigger>
                <SelectContent>
                  {availablePortfolios.map((portfolio) => (
                    <SelectItem key={portfolio.id} value={portfolio.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{portfolio.name}</span>
                        <Badge 
                          variant="secondary" 
                          className="ml-2 text-xs capitalize"
                        >
                          {portfolio.type === 'trading' ? 'Trading' : 'Long-term'}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Transaction Type</Label>
              <Select value={formData.type} onValueChange={(v) => setFormData({...formData, type: v})} required>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="buy">Buy (Long)</SelectItem>
                  <SelectItem value="sell">Sell (Short)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isTrading && (
            <Alert className="bg-blue-50 border-blue-200">
              <Shield className="w-4 h-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                <strong>Risk Rules Apply:</strong> Individual position risk cannot exceed 2% of total portfolio value.
                Sector risk cannot exceed 6% of total portfolio value.
              </AlertDescription>
            </Alert>
          )}

          {selectedPortfolio && !isTrading && (
            <Alert className="bg-gray-50 border-gray-200">
              <Info className="w-4 h-4 text-gray-600" />
              <AlertDescription className="text-gray-700">
                Risk management rules do not apply to long-term portfolios.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 relative">
              <Label>Symbol</Label>
              <Input
                value={formData.symbol}
                onChange={(e) => handleSymbolChange(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder="e.g., AAPL, BTC, NVDA"
                required
              />
              {showSuggestions && filteredSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-md shadow-lg z-10 max-h-40 overflow-y-auto">
                  {filteredSuggestions.map((asset) => (
                    <div
                      key={asset.symbol}
                      className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          symbol: asset.symbol,
                          name: asset.name,
                          sector: asset.sector
                        }));
                        setShowSuggestions(false);
                      }}
                    >
                      <div className="font-semibold">{asset.symbol}</div>
                      <div className="text-sm text-gray-500">{asset.name}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Asset Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="e.g., Apple Inc., Bitcoin"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Sector</Label>
            <Select value={formData.sector} onValueChange={(v) => setFormData({...formData, sector: v})} required>
              <SelectTrigger><SelectValue placeholder="Select sector..." /></SelectTrigger>
              <SelectContent>
                {availableSectors.map(s => ( // Renamed from 'sectors'
                  <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Price per Share</Label>
              <Input
                type="number"
                step="any"
                min="0"
                value={formData.price}
                onChange={(e) => setFormData({...formData, price: e.target.value})}
                placeholder="0.00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Stop-Loss Price</Label>
              <Input
                type="number"
                step="any"
                min="0"
                value={formData.stop_loss_at_trade}
                onChange={(e) => setFormData({...formData, stop_loss_at_trade: e.target.value})}
                placeholder="0.00"
              />
              <p className="text-xs text-slate-500">
                {formData.type === 'buy' ? 'Must be below entry price for long positions' : 'Must be above entry price for short positions'}
              </p>
            </div>
          </div>

          {portfolioData && (
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-900">
                  <Calculator className="w-5 h-5" />
                  Risk-Based Position Sizing
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Use Risk Calculator</Label>
                  <input
                    type="checkbox"
                    checked={useRiskSlider}
                    onChange={(e) => setUseRiskSlider(e.target.checked)}
                    className="w-4 h-4"
                  />
                </div>

                {useRiskSlider && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label>Risk Percentage</Label>
                        <Badge variant="outline">{formData.risk_percentage_at_trade}%</Badge>
                      </div>
                      <Slider
                        value={[formData.risk_percentage_at_trade]}
                        onValueChange={handleRiskPercentageChange}
                        min={0.25}
                        max={2}
                        step={0.05}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>0.25%</span>
                        <span>2%</span>
                      </div>
                    </div>

                    {suggestedQuantity && (
                      <div className="p-3 bg-white rounded-lg border border-blue-200">
                        {suggestedQuantity.error ? (
                          <div className="flex items-center gap-2 text-red-600">
                            <AlertTriangle className="w-4 h-4" />
                            <span className="text-sm">{suggestedQuantity.message}</span>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium">Suggested Quantity:</span>
                              <span className="font-bold text-blue-700">{suggestedQuantity.quantity}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-xs text-slate-600">
                              <div>Risk Amount: {formatCurrency(suggestedQuantity.riskAmount)}</div>
                              <div>Risk per Share: {formatCurrency(suggestedQuantity.riskPerShare)}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <div className="space-y-2">
            <Label>Quantity</Label>
            <Input
              type="number"
              step="any"
              min="0"
              value={formData.quantity}
              onChange={(e) => setFormData({...formData, quantity: e.target.value})}
              placeholder="0.00"
              required
              disabled={useRiskSlider && suggestedQuantity && !suggestedQuantity.error}
            />
            {useRiskSlider && (
              <p className="text-xs text-slate-500">
                Quantity is automatically calculated based on your risk settings
              </p>
            )}
          </div>

          {isTrading && riskValidation && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-600" />
                <span className="font-semibold text-slate-700">Risk Analysis</span>
                {isLoadingRisk && <Loader2 className="w-4 h-4 animate-spin" />}
              </div>

              {riskValidation.validation_type === 'not_applicable' && (
                <Alert className="bg-gray-50 border-gray-200">
                  <Info className="w-4 h-4 text-gray-600" />
                  <AlertDescription className="text-gray-700">
                    {riskValidation.message}
                  </AlertDescription>
                </Alert>
              )}

              {riskValidation.validation_type === 'no_stop_loss' && (
                <Alert className="bg-yellow-50 border-yellow-200">
                  <AlertTriangle className="w-4 h-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-800">
                    <div className="space-y-1">
                      <div>⚠️ No stop loss specified</div>
                      <div className="text-sm">
                        Without a stop loss, the entire investment ({formatCurrency(parseFloat(formData.quantity || 0) * parseFloat(formData.price || 0))}) is considered at risk.
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {riskValidation.validation_type === 'compliant' && (
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    <div className="space-y-1">
                      <div>✓ {riskValidation.message}</div>
                      <div className="text-sm">
                        Individual risk: {formatCurrency(riskValidation.risk_amount)} ({formatPercentage(riskValidation.risk_percentage)})
                      </div>
                      <div className="text-sm">
                        Sector risk: {formatCurrency(riskValidation.sector_risk_amount)} ({formatPercentage(riskValidation.sector_risk_percentage)})
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {(riskValidation.validation_type === 'individual_limit_exceeded' || riskValidation.validation_type === 'sector_limit_exceeded') && (
                <div className="space-y-3">
                  <Alert className="bg-red-50 border-red-200">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <AlertDescription className="text-red-800">
                      <div className="space-y-1">
                        <div className="font-semibold">
                          {riskValidation.validation_type === 'individual_limit_exceeded' ? 'Individual Risk Limit Exceeded' : 'Sector Risk Limit Exceeded'}
                        </div>
                        <div className="text-sm">
                          {riskValidation.message}
                        </div>
                        <div className="text-sm">
                          Risk: {formatCurrency(riskValidation.risk_amount)} ({formatPercentage(riskValidation.risk_percentage)})
                        </div>
                        {riskValidation.validation_type === 'sector_limit_exceeded' && (
                          <div className="text-sm">
                            Total sector risk: {formatCurrency(riskValidation.sector_risk_amount)} ({formatPercentage(riskValidation.sector_risk_percentage)})
                          </div>
                        )}
                        <div className="text-sm">
                          Limit: {riskValidation.validation_type === 'individual_limit_exceeded' ? '2.00%' : '6.00%'}
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>

                  {/* Risk Override Checkbox */}
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="risk-override"
                        checked={riskOverride}
                        onChange={(e) => setRiskOverride(e.target.checked)}
                        className="mt-1 w-4 h-4 text-orange-600 rounded border-orange-300 focus:ring-orange-500"
                      />
                      <label htmlFor="risk-override" className="flex-1 cursor-pointer">
                        <div className="font-semibold text-orange-800">Override Risk Limits</div>
                        <div className="text-sm text-orange-700 mt-1">
                          Check this box to proceed with the transaction despite exceeding risk limits.
                          A note will be added to the transaction documenting this override.
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Transaction Date & Time</Label>
            <Input
              type="datetime-local"
              value={formData.transaction_date}
              onChange={(e) => setFormData({...formData, transaction_date: e.target.value})}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Notes (Optional)</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              placeholder="e.g., Entry based on earnings report"
            />
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
            <Button
              type="submit"
              disabled={isSubmitting || isLoadingData || error}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : null}
              {isSubmitting ? "Saving..." : "Save Transaction"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
