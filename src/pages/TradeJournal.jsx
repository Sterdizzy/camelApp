
import React, { useState, useEffect } from "react";
import { Transaction, Portfolio } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, BookOpen, Loader2, Trash2, Edit } from "lucide-react"; // Added Edit icon

import AddTransactionDialog from "../components/journal/AddTransactionDialog";
import TransactionList from "../components/journal/TransactionList";
import JournalFilters from "../components/journal/JournalFilters";
import BulkEditDialog from "../components/journal/BulkEditDialog"; // Added BulkEditDialog import

export default function TradeJournal() {
  const [allTransactions, setAllTransactions] = useState([]);
  const [displayedTransactions, setDisplayedTransactions] = useState([]);
  const [portfolios, setPortfolios] = useState([]);
  const [uniqueAssets, setUniqueAssets] = useState([]);
  const [uniqueSectors, setUniqueSectors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [selectedTransactions, setSelectedTransactions] = useState([]);
  const [currentAppliedFilters, setCurrentAppliedFilters] = useState({});
  const [isLoadingFilters, setIsLoadingFilters] = useState(false);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false); // New state for bulk edit dialog

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    // Check for URL parameters to auto-apply filters
    const urlParams = new URLSearchParams(window.location.search);
    const sectorParam = urlParams.get('sector');
    const portfolioParam = urlParams.get('portfolio'); // This will be a single ID from URL
    const autoApply = urlParams.get('autoApply');
    
    if ((sectorParam || portfolioParam) && autoApply === 'true') {
      // Delay the filter application to avoid rate limiting
      const timer = setTimeout(() => {
        const filters = {
          symbol: '',
          type: 'all',
          sector: sectorParam || 'all',
          // Adjust for new multi-select portfolio handling:
          portfolios: portfolioParam ? [portfolioParam] : ['all'], 
          startDate: '',
          endDate: ''
        };
        
        if (!isLoading && allTransactions.length > 0) {
          handleApplyFilters(filters);
        }
      }, 1000); // Wait 1 second after data loads
      
      return () => clearTimeout(timer);
    }
  }, [isLoading, allTransactions]);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      // Add delay between API calls to avoid rate limiting
      const transactionData = await Transaction.list("-transaction_date");
      
      // Small delay before loading portfolios
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const portfolioData = await Portfolio.list();

      console.log('Loaded portfolios for trade journal:', portfolioData);

      // Don't deduplicate portfolios here - we want to pass all portfolios to the dialog
      // The dialog should show all available portfolios, not just unique names
      setPortfolios(portfolioData);

      const assetMap = new Map();
      const sectorSet = new Set();
      
      transactionData.forEach(tx => {
        if (tx.symbol) {
          const upperSymbol = tx.symbol.toUpperCase();
          if (!assetMap.has(upperSymbol)) {
            assetMap.set(upperSymbol, {
              symbol: upperSymbol,
              name: tx.name || "",
            });
          }
        }
        
        if (tx.sector) {
          sectorSet.add(tx.sector);
        }
      });

      setAllTransactions(transactionData);
      setUniqueAssets(Array.from(assetMap.values()));
      setUniqueSectors(Array.from(sectorSet).sort());
      setDisplayedTransactions(transactionData);

    } catch (error) {
      console.error("Failed to load data:", error);
      if (error.message && error.message.includes('429')) {
        alert("Too many requests. Please wait a moment and try refreshing the page.");
      }
    }
    setIsLoading(false);
  };

  const handleDialogClose = (isOpen) => {
    setIsDialogOpen(isOpen);
    if (!isOpen) {
      setEditingTransaction(null);
    }
  };

  const handleApplyFilters = async (filters) => {
    if (isLoadingFilters) return;
    
    setSelectedTransactions([]);
    setIsLoadingFilters(true);
    
    console.log('=== TRADE JOURNAL FILTERS ===');
    console.log('Applying filters:', JSON.stringify(filters, null, 2));
    console.log('Available portfolios:', portfolios.map(p => `${p.name} (${p.id}) - ${p.type}`));
    
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const filterObject = {};
      if (filters.symbol) {
        filterObject.symbol = filters.symbol.toUpperCase();
      }
      if (filters.type && filters.type !== "all") {
        filterObject.type = filters.type;
      }
      
      // Handle portfolio filtering - now supports multiple portfolios
      if (filters.portfolios && filters.portfolios.length > 0 && !filters.portfolios.includes("all")) {
        console.log('Filtering by portfolios:', filters.portfolios);
        
        // For API filtering, if multiple portfolios, use client-side filtering instead
        if (filters.portfolios.length === 1) {
          filterObject.portfolio_id = filters.portfolios[0];
        } else {
          // Multiple portfolios - use client-side filtering
          console.log('Multiple portfolios detected, using client-side filtering');
          handleClientSideFiltering(filters);
          return;
        }
      }
      
      if (filters.sector && filters.sector !== "all") {
        filterObject.sector = filters.sector;
      }
      if (filters.startDate) {
        filterObject.transaction_date = { $gte: new Date(filters.startDate).toISOString() };
      }
      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999);
        filterObject.transaction_date = {
          ...filterObject.transaction_date,
          $lte: endDate.toISOString()
        };
      }

      console.log('API filter object:', filterObject);
      const filteredData = await Transaction.filter(filterObject, "-transaction_date");
      console.log(`API returned ${filteredData.length} transactions`);
      
      // If API returns no results but we have filters, try client-side filtering as fallback
      if (filteredData.length === 0 && (filters.sector !== 'all' || (filters.portfolios && filters.portfolios.length > 0))) {
        console.log('API returned 0 results, trying client-side filtering as fallback');
        handleClientSideFiltering(filters);
        return;
      }
      
      setDisplayedTransactions(filteredData);
      setCurrentAppliedFilters(filters);
      
    } catch (error) {
      console.error("Failed to apply filters:", error);
      if (error.response && error.response.status === 429) {
        alert("Rate limit exceeded. Please wait a moment before applying filters again.");
        handleClientSideFiltering(filters);
      } else {
        alert("An error occurred while applying filters. Please try again.");
        handleClientSideFiltering(filters);
      }
    } finally {
      setIsLoadingFilters(false);
    }
  };

  const handleClientSideFiltering = (filters) => {
    console.log('=== CLIENT-SIDE FILTERING ===');
    console.log('Starting with', allTransactions.length, 'total transactions');
    
    let filtered = [...allTransactions];
    
    if (filters.symbol) {
      const beforeCount = filtered.length;
      filtered = filtered.filter(tx => 
        tx.symbol && tx.symbol.toUpperCase().includes(filters.symbol.toUpperCase())
      );
      console.log(`After symbol filter (${filters.symbol}): ${filtered.length} (removed ${beforeCount - filtered.length})`);
    }
    
    if (filters.type && filters.type !== "all") {
      const beforeCount = filtered.length;
      filtered = filtered.filter(tx => tx.type === filters.type);
      console.log(`After type filter (${filters.type}): ${filtered.length} (removed ${beforeCount - filtered.length})`);
    }
    
    // Handle multiple portfolio selection
    if (filters.portfolios && filters.portfolios.length > 0 && !filters.portfolios.includes("all")) {
      const beforeCount = filtered.length;
      filtered = filtered.filter(tx => filters.portfolios.includes(tx.portfolio_id));
      console.log(`After portfolio filter (${filters.portfolios.join(',')}}): ${filtered.length} (removed ${beforeCount - filtered.length})`);
      
      // Debug: show which portfolios the remaining transactions belong to
      const remainingPortfolios = new Set(filtered.map(tx => tx.portfolio_id));
      console.log('Remaining portfolio IDs:', Array.from(remainingPortfolios));
    }
    
    if (filters.sector && filters.sector !== "all") {
      const beforeCount = filtered.length;
      filtered = filtered.filter(tx => tx.sector === filters.sector);
      console.log(`After sector filter (${filters.sector}): ${filtered.length} (removed ${beforeCount - filtered.length})`);
    }
    
    if (filters.startDate) {
      const beforeCount = filtered.length;
      filtered = filtered.filter(tx => 
        new Date(tx.transaction_date) >= new Date(filters.startDate)
      );
      console.log(`After start date filter: ${filtered.length} (removed ${beforeCount - filtered.length})`);
    }
    
    if (filters.endDate) {
      const beforeCount = filtered.length;
      const endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(tx => 
        new Date(tx.transaction_date) <= endDate
      );
      console.log(`After end date filter: ${filtered.length} (removed ${beforeCount - filtered.length})`);
    }
    
    console.log(`Final filtered result: ${filtered.length} transactions`);
    console.log('===============================');
    
    setDisplayedTransactions(filtered);
    setCurrentAppliedFilters(filters);
  };

  const handleClearFilters = () => {
    setSelectedTransactions([]);
    setDisplayedTransactions(allTransactions);
    setCurrentAppliedFilters({});
  };

  const handleAdd = () => {
    setEditingTransaction(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (transaction) => {
    console.log("TradeJournal - handleEdit called with transaction:", JSON.stringify(transaction, null, 2));
    setEditingTransaction(transaction);
    setIsDialogOpen(true);
  };

  const handleDelete = async (transactionId) => {
    if (window.confirm("Are you sure you want to delete this transaction permanently?")) {
      try {
        await Transaction.delete(transactionId);
        loadInitialData();
      } catch (error) {
        console.error("Failed to delete transaction:", error);
        alert("An error occurred during deletion. Please try again.");
      }
    }
  };

  const handleSuccess = () => {
    setIsDialogOpen(false);
    setEditingTransaction(null);
    setTimeout(() => {
      loadInitialData();
    }, 500);
  };

  const handleToggleSelect = (transactionId) => {
    setSelectedTransactions(prev =>
      prev.includes(transactionId)
        ? prev.filter(id => id !== transactionId)
        : [...prev, transactionId]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedTransactions.length === displayedTransactions.length && displayedTransactions.length > 0) {
      setSelectedTransactions([]);
    } else {
      setSelectedTransactions(displayedTransactions.map(tx => tx.id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTransactions.length === 0) return;

    if (window.confirm(`Are you sure you want to permanently delete ${selectedTransactions.length} selected transactions?`)) {
      try {
        const deletePromises = selectedTransactions.map(id => Transaction.delete(id));
        await Promise.all(deletePromises);
        setSelectedTransactions([]);
        loadInitialData();
      } catch (error) {
        console.error("Failed to bulk delete transactions:", error);
        alert("An error occurred during bulk deletion. Please check the console for details.");
      }
    }
  };

  const handleBulkEdit = () => {
    if (selectedTransactions.length === 0) return;
    setIsBulkEditOpen(true);
  };

  const handleBulkEditSuccess = () => {
    setIsBulkEditOpen(false);
    setSelectedTransactions([]);
    setTimeout(() => {
      loadInitialData();
    }, 500);
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 pb-20">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Mobile-First Header */}
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-2">
                Trade Journal
              </h1>
              <p className="text-slate-600 text-sm sm:text-base lg:text-lg">
                The complete historical record of all your trading activity.
              </p>
            </div>
            <Button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto h-12 touch-manipulation">
              <Plus className="w-4 h-4 mr-2" />
              Record Transaction
            </Button>
          </div>

          <JournalFilters
            uniqueAssets={uniqueAssets}
            uniqueSectors={uniqueSectors}
            portfolios={portfolios}
            onApply={handleApplyFilters}
            onClear={handleClearFilters}
            isLoading={isLoadingFilters}
          />

          {selectedTransactions.length > 0 && (
            <div className="flex flex-col gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg animate-fade-in">
              <span className="font-semibold text-blue-800">
                {selectedTransactions.length} selected
              </span>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <Button
                  onClick={() => setSelectedTransactions([])}
                  variant="outline"
                  size="sm"
                  className="border-blue-300 text-blue-700 hover:bg-blue-100 h-10 touch-manipulation"
                >
                  Clear Selection
                </Button>
                <Button 
                  onClick={handleBulkEdit} 
                  variant="outline" 
                  size="sm" 
                  className="border-green-300 text-green-700 hover:bg-green-100 h-10 touch-manipulation"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Bulk Edit
                </Button>
                <Button onClick={handleBulkDelete} variant="destructive" size="sm" className="h-10 touch-manipulation">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Selected
                </Button>
              </div>
            </div>
          )}

          <Card className="bg-white/70 backdrop-blur-sm border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl font-bold text-slate-900">
                <BookOpen className="w-5 h-5 text-blue-600" />
                Transaction History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 lg:p-6">
              {isLoading ? (
                <div className="text-center p-12">
                  <Loader2 className="w-8 h-8 mx-auto animate-spin text-blue-600" />
                </div>
              ) : (
                <TransactionList
                  transactions={displayedTransactions}
                  portfolios={portfolios}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  selectedTransactions={selectedTransactions}
                  onToggleSelect={handleToggleSelect}
                  onToggleSelectAll={handleToggleSelectAll}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AddTransactionDialog
        key={isDialogOpen ? (editingTransaction?.id || `new-transaction-${Date.now()}`) : 'closed-dialog'}
        open={isDialogOpen}
        onOpenChange={handleDialogClose}
        portfolios={portfolios}
        onSuccess={handleSuccess}
        editingTransaction={editingTransaction}
      />

      <BulkEditDialog
        open={isBulkEditOpen}
        onOpenChange={setIsBulkEditOpen}
        selectedTransactions={selectedTransactions}
        transactions={displayedTransactions} // Pass displayedTransactions to find the selected objects
        portfolios={portfolios}
        onSuccess={handleBulkEditSuccess}
      />
    </>
  );
}
