import React, { useState, useEffect } from "react";
import { Portfolio } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, PieChart, Loader2, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function PortfolioManager() {
  const [portfolios, setPortfolios] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentPortfolio, setCurrentPortfolio] = useState(null);
  const [formData, setFormData] = useState({ 
    name: "", 
    type: "long_term",
    description: "",
    cash_balance: 0
  });
  const [deleteConfirm, setDeleteConfirm] = useState("");

  useEffect(() => {
    loadPortfolios();
  }, []);

  const loadPortfolios = async () => {
    setIsLoading(true);
    try {
      const portfolioData = await Portfolio.list("-created_date");
      setPortfolios(portfolioData);
    } catch (error) {
      console.error("Failed to load portfolios:", error);
    }
    setIsLoading(false);
  };

  const handleAddNew = () => {
    setCurrentPortfolio(null);
    setFormData({ 
      name: "", 
      type: "long_term",
      description: "",
      cash_balance: 0
    });
    setDeleteConfirm("");
    setIsDialogOpen(true);
  };

  const handleEdit = (portfolio) => {
    setCurrentPortfolio(portfolio);
    setFormData({ 
      name: portfolio.name,
      type: portfolio.type || "long_term",
      description: portfolio.description || "",
      cash_balance: portfolio.cash_balance || 0
    });
    setDeleteConfirm("");
    setIsDialogOpen(true);
  };

  const handleDelete = async (portfolioId) => {
    if (window.confirm("Are you sure you want to delete this portfolio? This will affect all associated transactions and cannot be undone.")) {
      try {
        await Portfolio.delete(portfolioId);
        loadPortfolios();
      } catch (error) {
        console.error("Failed to delete portfolio:", error);
        alert("Failed to delete portfolio. It may have associated transactions.");
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const dataToSave = {
        ...formData,
        cash_balance: parseFloat(formData.cash_balance) || 0
      };

      if (currentPortfolio) {
        // Update existing portfolio
        await Portfolio.update(currentPortfolio.id, dataToSave);
      } else {
        // Create new portfolio
        await Portfolio.create(dataToSave);
      }
      
      setIsDialogOpen(false);
      loadPortfolios();
    } catch (error) {
      console.error("Failed to save portfolio:", error);
      alert("Failed to save portfolio. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPortfolioTypeColor = (type) => {
    return type === 'trading' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  return (
    <>
      <Card className="bg-white/70 backdrop-blur-sm border-slate-200">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <PieChart className="w-5 h-5 text-blue-600" />
            Manage Portfolios
          </CardTitle>
          <Button onClick={handleAddNew} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Add Portfolio
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {isLoading ? (
              <div className="text-center p-8">
                <Loader2 className="w-8 h-8 mx-auto animate-spin text-blue-600" />
                <p className="mt-2 text-slate-500">Loading portfolios...</p>
              </div>
            ) : portfolios.length > 0 ? (
              portfolios.map((portfolio) => (
                <div key={portfolio.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-slate-800">{portfolio.name}</h3>
                      <Badge className={getPortfolioTypeColor(portfolio.type)}>
                        {portfolio.type === 'trading' ? 'Trading' : 'Long-term'}
                      </Badge>
                    </div>
                    <div className="text-sm text-slate-600 space-y-1">
                      {portfolio.description && (
                        <p>{portfolio.description}</p>
                      )}
                      <p className="font-medium">
                        Cash Balance: {formatCurrency(portfolio.cash_balance)}
                      </p>
                      <p className="text-xs text-slate-400">
                        Created: {new Date(portfolio.created_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(portfolio)}>
                      <Edit className="w-4 h-4 text-slate-600" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleDelete(portfolio.id)} 
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center p-8 border-2 border-dashed border-slate-300 rounded-lg">
                <h3 className="font-semibold text-slate-700">No Portfolios Found</h3>
                <p className="text-sm text-slate-500 mt-1">Click "Add Portfolio" to create your first one.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{currentPortfolio ? "Edit Portfolio" : "Add New Portfolio"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Portfolio Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Long-term Growth, Day Trading"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="type">Portfolio Type *</Label>
                <Select 
                  value={formData.type} 
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="long_term">Long-term</SelectItem>
                    <SelectItem value="trading">Trading</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">
                  Trading portfolios are subject to risk management rules
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cash_balance">Cash Balance</Label>
                <Input
                  id="cash_balance"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.cash_balance}
                  onChange={(e) => setFormData({ ...formData, cash_balance: e.target.value })}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g., Conservative dividend stocks, High-growth tech companies"
                  rows={3}
                />
              </div>

              {currentPortfolio && (
                <Alert className="bg-yellow-50 border-yellow-200">
                  <AlertTriangle className="w-4 h-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-800">
                    <strong>Warning:</strong> Editing this portfolio will affect all associated transactions. 
                    Changes to the portfolio type may impact risk calculations.
                  </AlertDescription>
                </Alert>
              )}
            </div>
            
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  `${currentPortfolio ? 'Update' : 'Create'} Portfolio`
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}