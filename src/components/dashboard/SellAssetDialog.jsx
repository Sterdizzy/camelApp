import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Transaction, Portfolio } from "@/api/entities";
import { Loader2, TrendingDown, AlertTriangle, DollarSign, Calculator } from "lucide-react";
import { format } from "date-fns";

export default function SellAssetDialog({ 
  open, 
  onOpenChange, 
  holding, 
  currentPrice, 
  onSuccess 
}) {
  const [sellQuantity, setSellQuantity] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [portfolio, setPortfolio] = useState(null);
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    if (open && holding) {
      // Reset form
      setSellQuantity(holding.quantity.toString());
      setSellPrice(currentPrice?.toFixed(2) || "");
      setValidationError("");
      loadPortfolio();
    }
  }, [open, holding, currentPrice]);

  const loadPortfolio = async () => {
    if (!holding?.portfolio_id) return;
    
    try {
      const portfolioData = await Portfolio.filter({ id: holding.portfolio_id });
      if (portfolioData.length > 0) {
        setPortfolio(portfolioData[0]);
      }
    } catch (error) {
      console.error("Failed to load portfolio:", error);
    }
  };

  const validateSale = () => {
    const quantity = parseFloat(sellQuantity);
    const price = parseFloat(sellPrice);

    if (!quantity || quantity <= 0) {
      return "Quantity must be greater than 0";
    }

    if (quantity > holding.quantity) {
      return `Cannot sell ${quantity} shares. You only own ${holding.quantity} shares.`;
    }

    if (!price || price <= 0) {
      return "Price must be greater than 0";
    }

    return "";
  };

  const handleSell = async () => {
    const error = validateSale();
    if (error) {
      setValidationError(error);
      return;
    }

    setIsSubmitting(true);
    setValidationError("");

    try {
      const quantity = parseFloat(sellQuantity);
      const price = parseFloat(sellPrice);
      const saleValue = quantity * price;

      // Create sell transaction
      await Transaction.create({
        portfolio_id: holding.portfolio_id,
        symbol: holding.symbol,
        name: holding.name,
        sector: holding.sector,
        type: "sell",
        quantity: quantity,
        price: price,
        transaction_date: new Date().toISOString(),
        notes: `Quick sell via dashboard - ${quantity} shares at $${price}`
      });

      // Update portfolio cash balance
      if (portfolio) {
        const newCashBalance = (portfolio.cash_balance || 0) + saleValue;
        await Portfolio.update(portfolio.id, {
          cash_balance: newCashBalance
        });
      }

      onSuccess?.();
      onOpenChange(false);

    } catch (error) {
      console.error("Sale failed:", error);
      setValidationError("Sale failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickSellAll = () => {
    setSellQuantity(holding.quantity.toString());
  };

  const handleQuickSellHalf = () => {
    setSellQuantity((holding.quantity / 2).toString());
  };

  const calculateProceeds = () => {
    const quantity = parseFloat(sellQuantity) || 0;
    const price = parseFloat(sellPrice) || 0;
    return quantity * price;
  };

  const calculateGainLoss = () => {
    const quantity = parseFloat(sellQuantity) || 0;
    const price = parseFloat(sellPrice) || 0;
    const proceeds = quantity * price;
    const costBasis = quantity * (holding.purchase_price || 0);
    return proceeds - costBasis;
  };

  if (!holding) return null;

  const proceeds = calculateProceeds();
  const gainLoss = calculateGainLoss();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" role="dialog" aria-labelledby="sell-dialog-title">
        <DialogHeader>
          <DialogTitle id="sell-dialog-title" className="flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-red-600" />
            Sell {holding.symbol}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Asset Summary */}
          <div className="p-4 bg-slate-50 rounded-lg">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-semibold text-slate-900">{holding.name}</h3>
                <p className="text-sm text-slate-600">{holding.symbol} • {holding.sector}</p>
              </div>
              <Badge variant="outline" className="capitalize">
                {portfolio?.name || 'Portfolio'}
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-500">Owned:</span>
                <span className="font-medium ml-2">{holding.quantity} shares</span>
              </div>
              <div>
                <span className="text-slate-500">Avg Cost:</span>
                <span className="font-medium ml-2">${(holding.purchase_price || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Quick Actions</Label>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleQuickSellHalf}
                className="flex-1"
                type="button"
              >
                Sell Half
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleQuickSellAll}
                className="flex-1"
                type="button"
              >
                Sell All
              </Button>
            </div>
          </div>

          {/* Sale Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sell-quantity">Quantity to Sell</Label>
              <Input
                id="sell-quantity"
                type="number"
                step="0.000001"
                min="0"
                max={holding.quantity}
                value={sellQuantity}
                onChange={(e) => setSellQuantity(e.target.value)}
                className="h-11"
                aria-describedby="quantity-help"
              />
              <p id="quantity-help" className="text-xs text-slate-500">
                Max: {holding.quantity} shares
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sell-price">Price per Share</Label>
              <Input
                id="sell-price"
                type="number"
                step="0.01"
                min="0"
                value={sellPrice}
                onChange={(e) => setSellPrice(e.target.value)}
                className="h-11"
                aria-describedby="price-help"
              />
              <p id="price-help" className="text-xs text-slate-500">
                Current: ${currentPrice?.toFixed(2) || 'N/A'}
              </p>
            </div>
          </div>

          {/* Sale Summary */}
          {proceeds > 0 && (
            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-3">
                <Calculator className="w-4 h-4 text-blue-600" />
                <span className="font-medium text-blue-900">Sale Summary</span>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Proceeds:</span>
                  <span className="font-semibold text-slate-900">
                    ${proceeds.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Gain/Loss:</span>
                  <span className={`font-semibold ${gainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {gainLoss >= 0 ? '+' : ''}${gainLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Validation Error */}
          {validationError && (
            <Alert variant="destructive" role="alert">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{validationError}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="pt-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => onOpenChange(false)} 
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSell}
            disabled={isSubmitting || !sellQuantity || !sellPrice}
            className="bg-red-600 hover:bg-red-700 min-w-[120px]"
            aria-describedby="sell-button-help"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Selling...
              </>
            ) : (
              <>
                <DollarSign className="mr-2 h-4 w-4" />
                Sell Now
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}