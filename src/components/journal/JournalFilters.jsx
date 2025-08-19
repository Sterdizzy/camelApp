
import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Filter, ChevronDown, X } from "lucide-react";

export default function JournalFilters({ uniqueAssets, uniqueSectors, portfolios, onApply, onClear, isLoading }) {
  const [symbolFilter, setSymbolFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sectorFilter, setSectorFilter] = useState("all");
  // portfolioFilters can contain 'all' string or specific portfolio IDs
  const [portfolioFilters, setPortfolioFilters] = useState(['all']); // Initial state: 'all' portfolios selected
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [portfolioPopoverOpen, setPortfolioPopoverOpen] = useState(false);

  useEffect(() => {
    // Check for URL parameters to pre-populate filters
    const urlParams = new URLSearchParams(window.location.search);
    const sectorParam = urlParams.get('sector');
    const portfoliosParam = urlParams.get('portfolios'); // Can be comma-separated list of IDs, or empty string, or null
    const typeParam = urlParams.get('type'); // This parameter is still read, but its value is no longer used for transaction 'typeFilter'
    const autoApply = urlParams.get('autoApply');
    
    console.log('=== URL PARAMS DETECTED ===');
    console.log('Sector:', sectorParam);
    console.log('Portfolios:', portfoliosParam);
    console.log('Type:', typeParam);
    console.log('Auto apply:', autoApply);

    // If autoApply is true and any relevant param is present
    if (autoApply === 'true' && (sectorParam || portfoliosParam !== null || typeParam)) {
      // Clear URL parameters immediately to prevent infinite loop
      window.history.replaceState({}, document.title, window.location.pathname);
      
      let portfolioListToSet;
      if (portfoliosParam === null) { // 'portfolios' param not in URL, default to all
        portfolioListToSet = ['all'];
      } else { // 'portfolios' param is in URL (can be empty string, or comma-separated IDs)
        const parsedIds = portfoliosParam.split(',').filter(id => id.trim());
        portfolioListToSet = parsedIds.length > 0 ? parsedIds : []; // If empty string or only commas, result is []; otherwise, actual IDs
      }
      console.log('Parsed portfolio IDs for state:', portfolioListToSet);
      
      // Set the filters based on URL params
      if (sectorParam) setSectorFilter(sectorParam);
      // typeFilter remains 'all' as per change outline's implied logic for URL params
      setPortfolioFilters(portfolioListToSet); 

      // Auto-apply the filters after a short delay to ensure data is loaded
      setTimeout(() => {
        const autoFilters = {
          symbol: '',
          type: 'all', // Transaction type filter from URL params is explicitly ignored and set to 'all'
          sector: sectorParam || 'all',
          portfolios: portfolioListToSet, // Use the parsed list
          startDate: '',
          endDate: ''
        };
        
        console.log('Auto-applying filters:', autoFilters);
        onApply(autoFilters);
      }, 500);
    }
  }, [portfolios, onApply]);

  useEffect(() => {
    if (symbolFilter) {
      const filtered = uniqueAssets
        .filter(asset => asset.symbol.toLowerCase().startsWith(symbolFilter.toLowerCase()))
        .slice(0, 5);
      setSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [symbolFilter, uniqueAssets]);

  const handleApplyFilters = () => {
    if (isLoading) return;

    const filters = {
      symbol: symbolFilter.trim(),
      type: typeFilter,
      sector: sectorFilter,
      portfolios: portfolioFilters, // This is now an array, can contain 'all' string or specific IDs
      startDate: startDateFilter,
      endDate: endDateFilter
    };

    console.log('=== JOURNAL FILTERS APPLIED ===');
    console.log('Filters being applied:', JSON.stringify(filters, null, 2));
    console.log('Available portfolios:', portfolios.map(p => `${p.name} (${p.id}) - ${p.type}`));
    
    // If type is specified and portfolios is 'all', filter portfolios by type
    if (filters.type !== 'all' && filters.portfolios.includes('all')) {
      const portfoliosOfType = portfolios.filter(p => p.type === filters.type);
      filters.portfolios = portfoliosOfType.map(p => p.id);
      console.log(`Filtered portfolios for type '${filters.type}':`, filters.portfolios);
    }
    
    onApply(filters);
    
    // Clear URL parameters after applying filters
    if (window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  const handleClear = () => {
    setSymbolFilter("");
    setTypeFilter("all");
    setSectorFilter("all");
    setPortfolioFilters(['all']); // Reset to 'all' selected
    setStartDateFilter("");
    setEndDateFilter("");
    setSuggestions([]);
    setShowSuggestions(false);
    onClear();
  };

  const handleSuggestionClick = (selectedSymbol) => {
    setSymbolFilter(selectedSymbol);
    setShowSuggestions(false);
  };

  const handlePortfolioToggle = (portfolioId) => {
    setPortfolioFilters(prev => {
      if (prev.includes('all')) { // If currently 'all' is selected, start selecting specific
        return [portfolioId];
      } else if (prev.includes(portfolioId)) { // If already selected, deselect it
        const next = prev.filter(id => id !== portfolioId);
        // If all specific portfolios are deselected, revert to 'all' mode
        return next.length === 0 && portfolios?.length > 0 ? ['all'] : next;
      } else { // Add specific portfolio
        return [...prev, portfolioId];
      }
    });
  };

  const handleSelectAllPortfolios = () => {
    if (portfolioFilters.includes('all')) { // If 'all' is selected, deselect all specific
      setPortfolioFilters([]); // Now represents no specific portfolios selected
    } else { // If specific portfolios are selected, or none are selected, select 'all'
      setPortfolioFilters(['all']);
    }
  };

  const removePortfolio = (portfolioId) => {
    setPortfolioFilters(prev => {
      const next = prev.filter(id => id !== portfolioId);
      // If all specific portfolios are deselected, revert to 'all' mode
      return next.length === 0 && portfolios?.length > 0 ? ['all'] : next;
    });
  };

  const getPortfolioDisplayText = () => {
    if (portfolioFilters.includes('all')) {
      return "All Portfolios";
    }
    if (portfolioFilters.length === 0) {
      return "No Portfolios Selected";
    }
    if (portfolioFilters.length === 1) {
      const portfolio = portfolios?.find(p => p.id === portfolioFilters[0]);
      return portfolio?.name || "Unknown";
    }
    return `${portfolioFilters.length} portfolios selected`;
  };

  const displaySelectedBadges = portfolioFilters.filter(id => id !== 'all');

  return (
    <Card className="bg-white/70 backdrop-blur-sm border-slate-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg lg:text-xl font-bold text-slate-900">
          <Filter className="w-5 h-5 text-blue-600" />
          Filter Transactions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 items-end">
          <div className="space-y-2 relative">
            <label className="text-sm font-medium">Asset Symbol</label>
            <Input
              placeholder="e.g., AAPL, BTC"
              value={symbolFilter}
              onChange={(e) => setSymbolFilter(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              disabled={isLoading}
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-md shadow-lg z-20 max-h-48 overflow-y-auto">
                {suggestions.map((asset) => (
                  <div
                    key={asset.symbol}
                    className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                    onMouseDown={(e) => e.preventDefault()} // Prevent blur from closing before click
                    onClick={() => handleSuggestionClick(asset.symbol)}
                  >
                    <div className="font-semibold">{asset.symbol}</div>
                    <div className="text-sm text-gray-500">{asset.name}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Type</label>
            <Select value={typeFilter} onValueChange={setTypeFilter} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="buy">Buy</SelectItem>
                <SelectItem value="sell">Sell</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Portfolio</label>
            <Popover open={portfolioPopoverOpen} onOpenChange={setPortfolioPopoverOpen}>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  className="w-full justify-between text-left font-normal"
                  disabled={isLoading}
                >
                  <span className="truncate">{getPortfolioDisplayText()}</span>
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start">
                <div className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Select Portfolios</h4>
                      {portfolios?.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleSelectAllPortfolios}
                          className="text-xs"
                        >
                          {portfolioFilters.includes('all') ? 'Deselect All' : 'Select All'}
                        </Button>
                      )}
                    </div>
                    
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {portfolios?.length === 0 ? (
                        <p className="text-sm text-gray-500">No portfolios available.</p>
                      ) : (
                        portfolios?.map((portfolio) => (
                          <div key={portfolio.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={portfolio.id}
                              checked={portfolioFilters.includes('all') || portfolioFilters.includes(portfolio.id)}
                              onCheckedChange={() => handlePortfolioToggle(portfolio.id)}
                              disabled={isLoading}
                            />
                            <label htmlFor={portfolio.id} className="flex-1 cursor-pointer">
                              <div className="flex items-center justify-between">
                                <span className="text-sm">{portfolio.name}</span>
                                <Badge variant="outline" className="text-xs ml-2 capitalize">
                                  {portfolio.type === 'trading' ? 'Trading' : 'Long-term'}
                                </Badge>
                              </div>
                            </label>
                          </div>
                        ))
                      )}
                    </div>
                    
                    {displaySelectedBadges.length > 0 && (
                      <div className="pt-2 border-t">
                        <div className="flex flex-wrap gap-1">
                          {displaySelectedBadges.map((portfolioId) => {
                            const portfolio = portfolios?.find(p => p.id === portfolioId);
                            return portfolio ? (
                              <Badge
                                key={portfolioId}
                                variant="secondary"
                                className="text-xs flex items-center gap-1"
                              >
                                {portfolio.name}
                                <X
                                  className="h-3 w-3 cursor-pointer"
                                  onClick={() => removePortfolio(portfolioId)}
                                />
                              </Badge>
                            ) : null;
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Sector</label>
            <Select value={sectorFilter} onValueChange={setSectorFilter} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue placeholder="All Sectors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sectors</SelectItem>
                {uniqueSectors?.map((sectorName) => (
                  <SelectItem key={sectorName} value={sectorName}>
                    {sectorName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="xl:col-span-1">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">From</label>
                <Input type="date" value={startDateFilter} onChange={(e) => setStartDateFilter(e.target.value)} disabled={isLoading} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">To</label>
                <Input type="date" value={endDateFilter} onChange={(e) => setEndDateFilter(e.target.value)} disabled={isLoading} />
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2 xl:col-span-1">
            <Button 
              onClick={handleApplyFilters} 
              className="bg-blue-600 hover:bg-blue-700 flex-1"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Filtering...
                </>
              ) : (
                'Apply'
              )}
            </Button>
            <Button onClick={handleClear} variant="outline" className="flex-1" disabled={isLoading}>
              Clear
            </Button>
          </div>
        </div>

        {/* Show selected portfolios as badges below the filter row */}
        {displaySelectedBadges.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-slate-700">Selected portfolios:</span>
              {displaySelectedBadges.map((portfolioId) => {
                const portfolio = portfolios?.find(p => p.id === portfolioId);
                return portfolio ? (
                  <Badge
                    key={portfolioId}
                    variant="secondary"
                    className="flex items-center gap-1"
                  >
                    {portfolio.name}
                    <X
                      className="h-3 w-3 cursor-pointer hover:text-red-500"
                      onClick={() => removePortfolio(portfolioId)}
                    />
                  </Badge>
                ) : null;
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
