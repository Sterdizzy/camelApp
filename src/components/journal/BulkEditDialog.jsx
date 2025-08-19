import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Transaction, Sector } from "@/api/entities";
import { Loader2, Edit3, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function BulkEditDialog({ 
  open, 
  onOpenChange, 
  selectedTransactions, 
  transactions,
  portfolios,
  onSuccess 
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sectors, setSectors] = useState([]);
  const [updateData, setUpdateData] = useState({
    portfolio_id: "",
    type: "",
    sector: ""
  });

  // Load sectors when dialog opens
  useEffect(() => {
    const loadSectors = async () => {
      if (open) {
        try {
          const sectorData = await Sector.list();
          setSectors(sectorData);
        } catch (error) {
          console.error("Failed to load sectors:", error);
        }
      }
    };
    
    loadSectors();
  }, [open]);

  const selectedTransactionObjects = transactions.filter(tx => 
    selectedTransactions.includes(tx.id)
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!updateData.portfolio_id && !updateData.type && !updateData.sector) {
      alert("Please select at least one field to update.");
      return;
    }

    setIsSubmitting(true);

    try {
      const updatePromises = selectedTransactions.map(async (transactionId) => {
        const fieldsToUpdate = {};
        
        if (updateData.portfolio_id) {
          fieldsToUpdate.portfolio_id = updateData.portfolio_id;
        }
        if (updateData.type) {
          fieldsToUpdate.type = updateData.type;
        }
        if (updateData.sector) {
          fieldsToUpdate.sector = updateData.sector;
        }

        return Transaction.update(transactionId, fieldsToUpdate);
      });

      await Promise.all(updatePromises);
      
      onSuccess();
      onOpenChange(false);
      
      // Reset form
      setUpdateData({
        portfolio_id: "",
        type: "",
        sector: ""
      });

    } catch (error) {
      console.error("Bulk edit failed:", error);
      alert("An error occurred during bulk edit. Please check the console for details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getUniquePortfolios = () => {
    const portfolioIds = new Set(selectedTransactionObjects.map(tx => tx.portfolio_id));
    return Array.from(portfolioIds).map(id => 
      portfolios.find(p => p.id === id)
    ).filter(Boolean);
  };

  const getUniqueTypes = () => {
    const types = new Set(selectedTransactionObjects.map(tx => tx.type));
    return Array.from(types);
  };

  const getUniqueSectors = () => {
    const sectors = new Set(selectedTransactionObjects.map(tx => tx.sector));
    return Array.from(sectors).filter(Boolean);
  };

  const uniquePortfolios = getUniquePortfolios();
  const uniqueTypes = getUniqueTypes();
  const uniqueSectors = getUniqueSectors();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit3 className="w-5 h-5" />
            Bulk Edit Transactions ({selectedTransactions.length} selected)
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Current Selection Summary */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-semibold text-blue-900 mb-2">Selected Transactions Summary</h4>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">Count:</span> {selectedTransactions.length} transactions
              </div>
              <div>
                <span className="font-medium">Current Portfolios:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {uniquePortfolios.map(portfolio => (
                    <Badge key={portfolio.id} variant="outline" className="text-xs">
                      {portfolio.name}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <span className="font-medium">Current Types:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {uniqueTypes.map(type => (
                    <Badge key={type} variant="outline" className="text-xs capitalize">
                      {type}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <span className="font-medium">Current Sectors:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {uniqueSectors.map(sector => (
                    <Badge key={sector} variant="outline" className="text-xs">
                      {sector}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <Alert className="bg-yellow-50 border-yellow-200">
            <AlertTriangle className="w-4 h-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              <strong>Note:</strong> Only fields you select below will be updated. 
              Leave fields empty to keep their current values unchanged.
            </AlertDescription>
          </Alert>

          {/* Update Fields */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Update Portfolio (Optional)</Label>
              <Select 
                value={updateData.portfolio_id} 
                onValueChange={(value) => setUpdateData({...updateData, portfolio_id: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose new portfolio (or leave unchanged)" />
                </SelectTrigger>
                <SelectContent>
                  {portfolios.map(portfolio => (
                    <SelectItem key={portfolio.id} value={portfolio.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{portfolio.name}</span>
                        <Badge variant="secondary" className="ml-2 text-xs capitalize">
                          {portfolio.type === 'trading' ? 'Trading' : 'Long-term'}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Update Transaction Type (Optional)</Label>
              <Select 
                value={updateData.type} 
                onValueChange={(value) => setUpdateData({...updateData, type: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose new type (or leave unchanged)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="buy">Buy (Long)</SelectItem>
                  <SelectItem value="sell">Sell (Short)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Update Sector (Optional)</Label>
              <Select 
                value={updateData.sector} 
                onValueChange={(value) => setUpdateData({...updateData, sector: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose new sector (or leave unchanged)" />
                </SelectTrigger>
                <SelectContent>
                  {/* Show all available sectors from Sector entity */}
                  {sectors.map(sector => (
                    <SelectItem key={sector.id} value={sector.name}>
                      {sector.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || (!updateData.portfolio_id && !updateData.type && !updateData.sector)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating {selectedTransactions.length} transactions...
                </>
              ) : (
                `Update ${selectedTransactions.length} Transactions`
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}