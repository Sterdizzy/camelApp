
import React, { useState, useEffect } from "react";
import { Transaction, Portfolio, Sector, ImportHistory } from "@/api/entities"; // Added ImportHistory
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Upload,
  FileText,
  CheckCircle,
  AlertTriangle,
  Info,
  Download,
  Loader2,
  X,
  ArrowRight,
  RotateCcw, // Import rollback icon
  BarChart3, // Import for mapping icon
  Settings // Import Settings icon for progress bar
} from "lucide-react";
import { ExtractDataFromUploadedFile, UploadFile } from "@/api/integrations";

export default function Import() {
  const [portfolios, setPortfolios] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedFileUrl, setUploadedFileUrl] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [mappingConfig, setMappingConfig] = useState({});
  const [validationResults, setValidationResults] = useState([]);
  const [importResults, setImportResults] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [lastImportBatchId, setLastImportBatchId] = useState(null);
  const [lastImportCount, setLastImportCount] = useState(0);
  const [isRollingBack, setIsRollingBack] = useState(false); // New state for rollback loading

  // New state for mapping
  const [mappingStep, setMappingStep] = useState(null); // true if mapping is needed
  const [columnMappings, setColumnMappings] = useState({}); // { 'expected_field': 'detected_column_header' }
  const [portfolioMappings, setPortfolioMappings] = useState({}); // { 'detected_portfolio_name': 'existing_portfolio_name' }
  const [detectedIssues, setDetectedIssues] = useState(null); // stores result from analyzeDataForMappingIssues

  useEffect(() => {
    loadInitialData();
    // On load, check if there's a recent import that can be rolled back
    const storedBatchId = localStorage.getItem('lastImportBatchId');
    const storedCount = localStorage.getItem('lastImportCount');
    if (storedBatchId) {
      setLastImportBatchId(storedBatchId);
      setLastImportCount(parseInt(storedCount, 10) || 0);
    }
  }, []);

  const loadInitialData = async () => {
    try {
      const [portfolioData, sectorData] = await Promise.all([
        Portfolio.list(),
        Sector.list()
      ]);

      // Fix: Deduplicate portfolios by name, keeping the most recent one
      // The logic `if (!uniquePortfoliosMap.has(p.name))` will keep the *first* encountered portfolio
      // for a given name if the `portfolioData` array is not sorted by recency.
      // If "most recent" strictly implies based on a timestamp, `portfolioData` should be sorted
      // by that timestamp in descending order before iteration, or the Map update logic should be `uniquePortfoliosMap.set(p.name, p);`
      // without the `if` check, assuming iterating from newest to oldest.
      // Adhering to the exact outline provided, which effectively means 'first seen wins' for a given name.
      const uniquePortfoliosMap = new Map();
      portfolioData.forEach(p => {
        if (!uniquePortfoliosMap.has(p.name)) {
          uniquePortfoliosMap.set(p.name, p);
        }
      });
      const dedupedPortfolios = Array.from(uniquePortfoliosMap.values());

      setPortfolios(dedupedPortfolios);
      setSectors(sectorData);
    } catch (error) {
      console.error("Failed to load initial data:", error);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      const validTypes = [
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ];

      if (validTypes.includes(file.type) || file.name.endsWith('.csv') || file.name.endsWith('.xls') || file.name.endsWith('.xlsx')) {
        setSelectedFile(file);
        setCurrentStep(1);
        setExtractedData(null);
        setImportResults(null);
        setMappingStep(null); // Reset mapping state
        setDetectedIssues(null); // Reset detected issues
        setColumnMappings({}); // Reset column mappings
        setPortfolioMappings({}); // Reset portfolio mappings
      } else {
        alert('Please select a valid CSV or Excel file (.csv, .xls, .xlsx)');
      }
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      const { file_url } = await UploadFile({ file: selectedFile });
      setUploadedFileUrl(file_url);
      setCurrentStep(2);
      await extractDataFromFile(file_url);
    } catch (error) {
      console.error("Failed to upload file:", error);
      alert("Failed to upload file. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const extractDataFromFile = async (fileUrl) => {
    setIsProcessing(true);
    try {
      // This schema is a hint for the extraction service to understand expected types
      // It is assumed that the result.output will contain original column headers as keys
      // and values parsed according to these types, but not necessarily renamed keys.
      const schema = {
        type: "object",
        properties: {
          date: { type: "string" },
          symbol: { type: "string" },
          name: { type: "string" },
          type: { type: "string" },
          quantity: { type: "number" },
          price: { type: "number" },
          sector: { type: "string" },
          portfolio: { type: "string" },
          notes: { type: "string" }
        }
      };

      const result = await ExtractDataFromUploadedFile({
        file_url: fileUrl,
        json_schema: schema
      });

      if (result.status === 'success' && result.output) {
        const rawData = Array.isArray(result.output) ? result.output : [result.output];
        setExtractedData(rawData);
        
        // Analyze the data for mapping issues
        const issues = analyzeDataForMappingIssues(rawData);
        if (issues.needsMapping) {
          setDetectedIssues(issues);
          setMappingStep(true);
          setCurrentStep(2.5); // New step between extraction and validation
        } else {
          setCurrentStep(3); // Go straight to preview if no mapping needed
        }
      } else {
        throw new Error(result.details || 'Failed to extract data from file');
      }
    } catch (error) {
      console.error("Failed to extract data:", error);
      alert("Failed to process file. Please check the format and try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const analyzeDataForMappingIssues = (data) => {
    if (!data || data.length === 0) return { needsMapping: false };

    const sampleRow = data[0];
    const detectedColumns = Object.keys(sampleRow);
    
    const expectedColumns = ['date', 'symbol', 'name', 'type', 'quantity', 'price', 'sector', 'portfolio', 'notes'];
    
    const columnIssues = []; // Expected fields for which no good source column was found
    const suggestedColumnMappings = {};
    
    expectedColumns.forEach(expected => {
      const exactMatch = detectedColumns.find(col => col.toLowerCase() === expected.toLowerCase());
      if (!exactMatch) {
        // Look for similar column names
        const similar = detectedColumns.find(col => {
          const colLower = col.toLowerCase();
          // Improved similarity checks
          if (expected === 'portfolio') return colLower.includes('portfolio') || colLower.includes('account');
          if (expected === 'quantity') return colLower.includes('quantity') || colLower.includes('qty') || colLower.includes('shares') || colLower.includes('amount');
          if (expected === 'price') return colLower.includes('price') || colLower.includes('cost') || colLower.includes('value');
          if (expected === 'type') return colLower.includes('type') || colLower.includes('action') || colLower.includes('side');
          if (expected === 'symbol') return colLower.includes('symbol') || colLower.includes('ticker') || colLower.includes('isin');
          if (expected === 'name') return colLower.includes('name') || colLower.includes('description') || colLower.includes('asset') || colLower.includes('security');
          if (expected === 'sector') return colLower.includes('sector') || colLower.includes('category') || colLower.includes('industry');
          if (expected === 'date') return colLower.includes('date') || colLower.includes('time') || colLower.includes('timestamp') || colLower.includes('trade_date');
          if (expected === 'notes') return colLower.includes('note') || colLower.includes('remark') || colLower.includes('comment');
          return false;
        });
        
        if (similar) {
          suggestedColumnMappings[expected] = similar;
        } else {
          // Add to columnIssues if no reasonable suggestion found
          columnIssues.push(expected);
          suggestedColumnMappings[expected] = ''; // Mark as unmapped
        }
      } else {
        suggestedColumnMappings[expected] = exactMatch;
      }
    });

    // Analyze portfolio names
    // Use the *suggested* column for portfolio names, defaulting to 'portfolio' if no suggestion
    const detectedPortfolioColumn = suggestedColumnMappings.portfolio || 'portfolio'; 
    const portfolioNames = [...new Set(data.map(row => row[detectedPortfolioColumn]).filter(Boolean))];
    const existingPortfolioNames = portfolios.map(p => p.name);
    
    const portfolioIssues = []; // Portfolio names from file for which no good existing portfolio was found
    const suggestedPortfolioMappings = {};
    
    portfolioNames.forEach(detectedPortfolio => {
      const exactMatch = existingPortfolioNames.find(existing => 
        existing.toLowerCase() === detectedPortfolio.toLowerCase()
      );
      
      if (!exactMatch) {
        // Look for similar portfolio names
        const similar = existingPortfolioNames.find(existing => {
          const existingLower = existing.toLowerCase();
          const detectedLower = detectedPortfolio.toLowerCase();
          
          // More robust partial matching
          return existingLower.includes(detectedLower) || 
                 detectedLower.includes(existingLower) ||
                 // Check for common keywords
                 (detectedLower.includes('long') && existingLower.includes('long')) ||
                 (detectedLower.includes('trading') && existingLower.includes('trading')) ||
                 (detectedLower.includes('short') && existingLower.includes('short')) ||
                 (detectedLower.includes('crypto') && existingLower.includes('crypto')) ||
                 (detectedLower.includes('stock') && existingLower.includes('stock')) ||
                 (detectedLower.includes('ira') && existingLower.includes('ira')) ||
                 (detectedLower.includes('tax') && existingLower.includes('tax'));
        });
        
        if (similar) {
          suggestedPortfolioMappings[detectedPortfolio] = similar;
        } else {
          portfolioIssues.push(detectedPortfolio);
          suggestedPortfolioMappings[detectedPortfolio] = ''; // Mark as unmapped
        }
      } else {
        suggestedPortfolioMappings[detectedPortfolio] = exactMatch;
      }
    });

    // Initialize mappings with suggestions
    setColumnMappings(suggestedColumnMappings);
    setPortfolioMappings(suggestedPortfolioMappings);

    // Determine if mapping is actually needed
    // Mapping is needed if any column isn't an identity map or is missing, or if any portfolio name from file doesn't map exactly
    const needsColumnMapping = Object.keys(suggestedColumnMappings).some(key => suggestedColumnMappings[key] === '' || suggestedColumnMappings[key] !== key);
    const needsPortfolioMapping = Object.keys(suggestedPortfolioMappings).some(key => suggestedPortfolioMappings[key] === '' || !existingPortfolioNames.includes(suggestedPortfolioMappings[key]));
    
    return {
      needsMapping: needsColumnMapping || needsPortfolioMapping, // Only true if there are actual discrepancies
      columnIssues, 
      portfolioIssues,
      detectedColumns,
      portfolioNames,
      suggestedColumnMappings,
      suggestedPortfolioMappings
    };
  };

  const applyMappings = () => {
    if (!extractedData) return;

    const mappedData = extractedData
      .map(row => {
        const mappedRow = {};
        
        // Apply column mappings
        // Iterate over the expected fields to ensure they are all present
        ['date', 'symbol', 'name', 'type', 'quantity', 'price', 'sector', 'portfolio', 'notes'].forEach(targetCol => {
          const sourceCol = columnMappings[targetCol]; // Get the source column name from the mapping
          if (sourceCol && row[sourceCol] !== undefined) {
            mappedRow[targetCol] = row[sourceCol]; // Copy value from source column to target column
          } else {
            // If a field is not mapped or source column is missing, initialize with a default value
            mappedRow[targetCol] = ''; 
            if (targetCol === 'quantity' || targetCol === 'price') mappedRow[targetCol] = 0;
          }
        });
        
        // Apply portfolio mappings
        const originalPortfolioName = mappedRow.portfolio || row.portfolio || row.Portfolio; // Try common variations
        
        // If portfolio mapping exists and is explicitly set to an empty string (''), it means it was explicitly skipped.
        if (originalPortfolioName && portfolioMappings.hasOwnProperty(originalPortfolioName) && portfolioMappings[originalPortfolioName] === '') {
          return null; // This row will be filtered out
        } else if (originalPortfolioName && portfolioMappings[originalPortfolioName]) {
          mappedRow.portfolio = portfolioMappings[originalPortfolioName]; // Use the mapped existing portfolio name
        } else {
          // No explicit mapping or not found, keep original or default to empty
          mappedRow.portfolio = originalPortfolioName || '';
        }
        
        // Final sanitization/defaulting and type conversion
        return {
          date: String(mappedRow.date || ''),
          symbol: String(mappedRow.symbol || '').toUpperCase(),
          name: String(mappedRow.name || mappedRow.symbol || ''), // Fallback to symbol if name is empty
          type: String(mappedRow.type || '').toLowerCase(),
          quantity: parseFloat(mappedRow.quantity) || 0, 
          price: parseFloat(mappedRow.price) || 0,     
          sector: String(mappedRow.sector || ''),
          portfolio: String(mappedRow.portfolio || ''), // This should now be an existing portfolio name or empty
          notes: String(mappedRow.notes || '')
        };
      })
      .filter(row => row !== null); // Remove skipped rows

    console.log('Applied mappings. Original rows:', extractedData.length, 'Mapped rows:', mappedData.length);
    
    setExtractedData(mappedData);
    setMappingStep(false);
    setCurrentStep(3); // Move to data preview with mapped data
  };

  const validateAndMapData = () => {
    if (!extractedData || extractedData.length === 0) return;

    const results = extractedData.map((row, index) => {
      const errors = [];
      const warnings = [];

      // Required field validation
      if (!row.symbol || !row.symbol.trim()) {
        errors.push("Symbol is required");
      }
      if (!row.type || !['buy', 'sell'].includes(row.type.toLowerCase())) {
        errors.push("Type must be 'buy' or 'sell'");
      }
      if (!row.quantity || isNaN(parseFloat(row.quantity)) || parseFloat(row.quantity) <= 0) {
        errors.push("Quantity must be a positive number");
      }
      if (!row.price || isNaN(parseFloat(row.price)) || parseFloat(row.price) <= 0) {
        errors.push("Price must be a positive number");
      }
      if (!row.date) {
        errors.push("Date is required");
      } else {
        // Basic date format validation (YYYY-MM-DD)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date) || isNaN(new Date(row.date).getTime())) {
          errors.push("Date must be in YYYY-MM-DD format");
        }
      }

      // Warnings for missing optional fields
      if (!row.name || !row.name.trim()) {
        warnings.push("Asset name is missing");
      }
      if (!row.sector || !row.sector.trim()) {
        warnings.push("Sector is missing");
      }
      if (!row.portfolio || !portfolios.some(p => p.name === row.portfolio)) {
        warnings.push("Portfolio is missing or not recognized. Will use default.");
      }

      return {
        index,
        row,
        errors,
        warnings,
        isValid: errors.length === 0
      };
    });

    setValidationResults(results);
    setCurrentStep(4);
  };

  const handleImport = async () => {
    const validRows = validationResults.filter(r => r.isValid);

    if (validRows.length === 0) {
      alert("No valid transactions to import");
      return;
    }

    // Ensure a default portfolio is selected if any transaction doesn't have one
    const anyRowMissingPortfolio = validRows.some(r => !r.row.portfolio || !portfolios.some(p => p.name === r.row.portfolio));
    if (anyRowMissingPortfolio && !mappingConfig.defaultPortfolio) {
      alert("Please select a Default Portfolio for transactions without a specified portfolio.");
      return;
    }

    setIsProcessing(true);
    try {
      const batchId = Date.now().toString();

      const transactions = validRows.map(({ row }) => {
        // Find the portfolio ID based on the mapped portfolio name (row.portfolio now contains the name of an existing portfolio or is empty)
        const targetPortfolio = portfolios.find(p => p.name === row.portfolio);
        const portfolioId = targetPortfolio ? targetPortfolio.id : mappingConfig.defaultPortfolio; // Fallback to default if not found or empty
        
        return {
          portfolio_id: portfolioId, 
          symbol: row.symbol.toUpperCase(),
          name: row.name || row.symbol,
          sector: row.sector || mappingConfig.defaultSector || 'Unknown',
          type: row.type.toLowerCase(),
          quantity: parseFloat(row.quantity),
          price: parseFloat(row.price),
          transaction_date: new Date(row.date).toISOString(),
          notes: row.notes || `Imported from ${selectedFile.name}`,
          import_batch_id: batchId
        };
      });

      await Transaction.bulkCreate(transactions);

      // Save import history with detailed error information
      const errorDetails = {
        skipped_rows: validationResults
          .filter(r => !r.isValid)
          .map(r => ({
            row_number: r.index + 1,
            data: r.row,
            errors: r.errors,
            warnings: r.warnings
          }))
      };

      await ImportHistory.create({
        batch_id: batchId,
        filename: selectedFile.name,
        total_rows: extractedData.length,
        imported_count: validRows.length,
        skipped_count: extractedData.length - validRows.length,
        error_details: JSON.stringify(errorDetails),
        import_date: new Date().toISOString(),
        status: 'completed'
      });

      setImportResults({
        total: extractedData.length,
        imported: validRows.length,
        skipped: extractedData.length - validRows.length
      });
      
      // Store batch ID for immediate rollback option (will be removed from layout after this import)
      localStorage.setItem('lastImportBatchId', batchId);
      localStorage.setItem('lastImportCount', validRows.length.toString());
      setLastImportBatchId(batchId);
      setLastImportCount(validRows.length);

      setCurrentStep(5);
    } catch (error) {
      console.error("Failed to import transactions:", error);
      alert("Failed to import transactions. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRollback = async () => {
    if (!lastImportBatchId) {
      alert("No recent import found to roll back.");
      return;
    }

    if (window.confirm(`Are you sure you want to roll back the last import of ${lastImportCount} transactions? This action cannot be undone.`)) {
      setIsRollingBack(true);
      try {
        const transactionsToDelete = await Transaction.filter({ import_batch_id: lastImportBatchId });
        
        if (transactionsToDelete.length > 0) {
          const deletePromises = transactionsToDelete.map(tx => Transaction.delete(tx.id));
          await Promise.all(deletePromises);
        }

        alert(`Successfully rolled back ${transactionsToDelete.length} transactions.`);

        // Clear rollback info
        localStorage.removeItem('lastImportBatchId');
        localStorage.removeItem('lastImportCount');
        setLastImportBatchId(null);
        setLastImportCount(0);
        
        resetImport();

      } catch (error) {
        console.error("Failed to roll back transactions:", error);
        alert("An error occurred during rollback. Please check the console for details.");
      } finally {
        setIsRollingBack(false);
      }
    }
  };

  const resetImport = () => {
    setSelectedFile(null);
    setUploadedFileUrl(null);
    setExtractedData(null);
    setMappingConfig({});
    setValidationResults([]);
    setImportResults(null);
    setCurrentStep(1);
    setMappingStep(null);
    setDetectedIssues(null);
    setColumnMappings({});
    setPortfolioMappings({});
  };

  const downloadTemplate = () => {
    const csvContent = [
      'date,symbol,name,type,quantity,price,sector,portfolio,notes',
      '2024-01-15,AAPL,Apple Inc.,buy,100,150.00,Technology,Trading Portfolio,Initial purchase',
      '2024-01-20,MSFT,Microsoft Corporation,buy,50,380.00,Technology,Long-term Portfolio,Tech allocation',
      '2024-02-01,AAPL,Apple Inc.,sell,25,155.00,Technology,Trading Portfolio,Partial profit taking'
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transaction_import_template.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 pb-20">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Mobile-First Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-2">
            Import Transaction Data
          </h1>
          <p className="text-slate-600 text-sm sm:text-base lg:text-lg">
            Upload CSV or Excel files to bulk import your transaction history
          </p>
        </div>

        {/* Rollback Alert - Now on Import page */}
        {lastImportBatchId && (
          <Alert className="bg-yellow-900/20 border-yellow-600/30 text-yellow-200">
            <RotateCcw className="w-4 h-4 text-yellow-400" />
            <AlertDescription className="text-yellow-200 text-sm">
              <div className="flex items-center justify-between">
                <span>Last import: {lastImportCount} transactions</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRollback}
                  disabled={isRollingBack}
                  className="text-yellow-200 hover:text-yellow-100 hover:bg-yellow-800/20 ml-2"
                >
                  {isRollingBack ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-yellow-200 mr-1"></div>
                      Rolling back...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3 h-3 mr-1" />
                      Rollback
                    </>
                  )}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Mobile-First Progress Steps */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className={`p-4 rounded-lg border text-center ${currentStep >= 1 ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
            <Upload className={`w-8 h-8 mx-auto mb-2 ${currentStep >= 1 ? 'text-blue-600' : 'text-gray-400'}`} />
            <h3 className="font-semibold text-sm sm:text-base">1. Upload File</h3>
            <p className="text-xs text-gray-600 mt-1">Select your CSV/Excel file</p>
          </div>
          <div className={`p-4 rounded-lg border text-center ${currentStep >= 2 ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
            <Settings className={`w-8 h-8 mx-auto mb-2 ${currentStep >= 2 ? 'text-blue-600' : 'text-gray-400'}`} />
            <h3 className="font-semibold text-sm sm:text-base">2. Map Columns</h3>
            <p className="text-xs text-gray-600 mt-1">Match your data fields</p>
          </div>
          <div className={`p-4 rounded-lg border text-center ${currentStep >= 3 ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
            <CheckCircle className={`w-8 h-8 mx-auto mb-2 ${currentStep >= 3 ? 'text-green-600' : 'text-gray-400'}`} />
            <h3 className="font-semibold text-sm sm:text-base">3. Import</h3>
            <p className="text-xs text-gray-600 mt-1">Process your data</p>
          </div>
        </div>

        {/* Step 1: File Selection */}
        {currentStep === 1 && (
          <Card className="bg-white/70 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-600" />
                Step 1: Select File
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <Label htmlFor="file-upload" className="text-base font-semibold">
                    Choose CSV or Excel File
                  </Label>
                  <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
                    <Upload className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                    <Input
                      id="file-upload"
                      type="file"
                      accept=".csv,.xls,.xlsx"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <Label htmlFor="file-upload" className="cursor-pointer">
                      <div className="space-y-2">
                        <p className="text-lg font-semibold text-slate-700">
                          Click to upload or drag and drop
                        </p>
                        <p className="text-sm text-slate-500">
                          Supports CSV, XLS, and XLSX files up to 10MB
                        </p>
                      </div>
                    </Label>
                  </div>

                  {selectedFile && (
                    <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                      <FileText className="w-5 h-5 text-blue-600" />
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900">{selectedFile.name}</p>
                        <p className="text-sm text-slate-600">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSelectedFile(null)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <h3 className="text-base font-semibold">Template & Guidelines</h3>
                  <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                    <p className="text-sm text-slate-700">
                      Your file should contain the following columns:
                    </p>
                    <ul className="text-sm text-slate-600 space-y-1">
                      <li>• <strong>date:</strong> Transaction date (YYYY-MM-DD)</li>
                      <li>• <strong>symbol:</strong> Asset symbol (e.g., AAPL, BTC)</li>
                      <li>• <strong>name:</strong> Asset name (optional)</li>
                      <li>• <strong>type:</strong> "buy" or "sell"</li>
                      <li>• <strong>quantity:</strong> Number of shares/units</li>
                      <li>• <strong>price:</strong> Price per share/unit</li>
                      <li>• <strong>sector:</strong> Investment sector (optional)</li>
                      <li>• <strong>portfolio:</strong> Portfolio name (optional)</li>
                      <li>• <strong>notes:</strong> Additional notes (optional)</li>
                    </ul>
                  </div>
                  <Button
                    variant="outline"
                    onClick={downloadTemplate}
                    className="w-full"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Template
                  </Button>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleFileUpload}
                  disabled={!selectedFile || isUploading}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload & Process
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Processing */}
        {currentStep === 2 && (
          <Card className="bg-white/70 backdrop-blur-sm">
            <CardContent className="text-center py-12">
              <Loader2 className="w-12 h-12 mx-auto animate-spin text-blue-600 mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">
                Processing Your File
              </h3>
              <p className="text-slate-600">
                Extracting transaction data from your uploaded file...
              </p>
            </CardContent>
          </Card>
        )}

        {/* NEW Step 2.5: Column and Data Mapping */}
        {mappingStep && detectedIssues && (
          <Card className="bg-white/70 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                Step 2.5: Data Mapping
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert className="bg-blue-50 border-blue-200">
                <Info className="w-4 h-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  We detected some column headers and/or data values that don't exactly match your Base44 setup. 
                  Please review and adjust the mappings below.
                </AlertDescription>
              </Alert>

              <div className="grid lg:grid-cols-2 gap-8">
                {/* Column Mappings */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-900">Column Mappings</h3>
                  <p className="text-sm text-slate-600">
                    Map your file's column headers to Base44 fields:
                  </p>
                  
                  <div className="space-y-3">
                    {['date', 'symbol', 'name', 'type', 'quantity', 'price', 'sector', 'portfolio', 'notes'].map(field => (
                      <div key={field} className="flex items-center gap-3">
                        <Label className="w-24 text-sm font-medium capitalize flex-shrink-0">{field}:</Label>
                        <Select 
                          value={columnMappings[field] || ''} 
                          onValueChange={(value) => setColumnMappings(prev => ({...prev, [field]: value}))}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder={`Select column for ${field}`} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={null}>-- Ignore this field --</SelectItem>
                            {detectedIssues.detectedColumns.map(col => (
                              <SelectItem key={col} value={col}>{col}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Portfolio Mappings */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-900">Portfolio Mappings</h3>
                  <p className="text-sm text-slate-600">
                    Map portfolio names from your file to existing portfolios:
                  </p>
                  
                  <div className="space-y-3">
                    {detectedIssues.portfolioNames.map(portfolioName => (
                      <div key={portfolioName} className="space-y-2">
                        <Label className="text-sm font-medium">"{portfolioName}" →</Label>
                        <Select 
                          value={portfolioMappings[portfolioName] || ''} 
                          onValueChange={(value) => {
                            console.log('Portfolio mapping changed:', portfolioName, '->', value);
                            setPortfolioMappings(prev => ({
                              ...prev, 
                              [portfolioName]: value === 'SKIP' ? '' : value
                            }));
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select target portfolio" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SKIP">-- Skip this portfolio --</SelectItem>
                            {portfolios.map(p => (
                              <SelectItem key={p.id} value={p.name}>
                                <div className="flex items-center justify-between w-full">
                                  <span>{p.name}</span>
                                  <Badge variant="secondary" className="ml-2 text-xs capitalize">
                                    {p.type === 'trading' ? 'Trading' : 'Long-term'}
                                  </Badge>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {portfolioMappings[portfolioName] === '' && (
                          <p className="text-xs text-yellow-600 mt-1">
                            ⚠️ Transactions from "{portfolioName}" will be skipped
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  {detectedIssues.portfolioIssues.length > 0 && (
                    <Alert className="bg-yellow-50 border-yellow-200">
                      <AlertTriangle className="w-4 h-4 text-yellow-600" />
                      <AlertDescription className="text-yellow-800">
                        <div className="space-y-1">
                          <div className="font-semibold">Unmapped portfolios found:</div>
                          {detectedIssues.portfolioIssues.map(portfolio => (
                            <div key={portfolio} className="text-sm">• {portfolio}</div>
                          ))}
                          <div className="text-sm mt-2">
                            These will be skipped unless mapped to existing portfolios above.
                          </div>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => {
                  setMappingStep(false);
                  setCurrentStep(2); // Go back to processing step
                }}>
                  Back to Upload
                </Button>
                <Button onClick={applyMappings} className="bg-blue-600 hover:bg-blue-700">
                  Apply Mappings & Continue
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Data Preview */}
        {currentStep === 3 && extractedData && (
          <Card className="bg-white/70 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                Step 3: Data Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert className="bg-blue-50 border-blue-200">
                <Info className="w-4 h-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  Found {extractedData.length} transactions in your file. Please review the data below before proceeding.
                </AlertDescription>
              </Alert>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-slate-300">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border border-slate-300 px-3 py-2 text-left">Date</th>
                      <th className="border border-slate-300 px-3 py-2 text-left">Symbol</th>
                      <th className="border border-slate-300 px-3 py-2 text-left">Name</th>
                      <th className="border border-slate-300 px-3 py-2 text-left">Type</th>
                      <th className="border border-slate-300 px-3 py-2 text-right">Quantity</th>
                      <th className="border border-slate-300 px-3 py-2 text-right">Price</th>
                      <th className="border border-slate-300 px-3 py-2 text-left">Sector</th>
                      <th className="border border-slate-300 px-3 py-2 text-left">Portfolio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extractedData.slice(0, 10).map((row, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="border border-slate-300 px-3 py-2 text-sm">{row.date}</td>
                        <td className="border border-slate-300 px-3 py-2 text-sm font-semibold">{row.symbol}</td>
                        <td className="border border-slate-300 px-3 py-2 text-sm">{row.name}</td>
                        <td className="border border-slate-300 px-3 py-2">
                          <Badge className={row.type?.toLowerCase() === 'buy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                            {row.type}
                          </Badge>
                        </td>
                        <td className="border border-slate-300 px-3 py-2 text-sm text-right">{row.quantity}</td>
                        <td className="border border-slate-300 px-3 py-2 text-sm text-right">${row.price}</td>
                        <td className="border border-slate-300 px-3 py-2 text-sm">{row.sector}</td>
                        <td className="border border-slate-300 px-3 py-2 text-sm">{row.portfolio || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {extractedData.length > 10 && (
                  <p className="text-sm text-slate-600 mt-2 text-center">
                    Showing first 10 of {extractedData.length} transactions
                  </p>
                )}
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={resetImport}>
                  Start Over
                </Button>
                <Button onClick={validateAndMapData} className="bg-blue-600 hover:bg-blue-700">
                  Continue to Validation
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Validation & Mapping */}
        {currentStep === 4 && validationResults.length > 0 && (
          <Card className="bg-white/70 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-blue-600" />
                Step 4: Validation & Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-semibold">Default Settings</h3>
                  <div className="space-y-3">
                    <div>
                      <Label>Default Portfolio (for unassigned transactions)</Label>
                      <Select
                        value={mappingConfig.defaultPortfolio}
                        onValueChange={(value) => setMappingConfig({...mappingConfig, defaultPortfolio: value})}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select portfolio..." />
                        </SelectTrigger>
                        <SelectContent>
                          {portfolios.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Default Sector (for missing sectors)</Label>
                      <Select
                        value={mappingConfig.defaultSector}
                        onValueChange={(value) => setMappingConfig({...mappingConfig, defaultSector: value})}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select sector..." />
                        </SelectTrigger>
                        <SelectContent>
                          {sectors.map(s => (
                            <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold">Validation Summary</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-green-50 rounded-lg p-3 text-center">
                      <p className="text-3xl font-bold text-green-700">
                        {validationResults.filter(r => r.isValid).length}
                      </p>
                      <p className="text-sm text-green-600">Valid</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-3 text-center">
                      <p className="text-3xl font-bold text-red-700">
                        {validationResults.filter(r => !r.isValid).length}
                      </p>
                      <p className="text-sm text-red-600">Errors</p>
                    </div>
                    <div className="bg-yellow-50 rounded-lg p-3 text-center">
                      <p className="text-3xl font-bold text-yellow-700">
                        {validationResults.filter(r => r.warnings.length > 0).length}
                      </p>
                      <p className="text-sm text-yellow-600">Warnings</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Detailed Error List - ENHANCED */}
              {validationResults.filter(r => !r.isValid || r.warnings.length > 0).length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">Issues Found:</h4>
                    <Badge variant="outline" className="text-xs">
                      Showing {Math.min(validationResults.filter(r => !r.isValid || r.warnings.length > 0).length, 20)} of {validationResults.filter(r => !r.isValid || r.warnings.length > 0).length} issues
                    </Badge>
                  </div>
                  <div className="max-h-80 overflow-y-auto border border-slate-200 rounded-lg">
                    <div className="divide-y divide-slate-200">
                      {validationResults
                        .map((result, index) => ({ ...result, originalIndex: index }))
                        .filter(r => !r.isValid || r.warnings.length > 0)
                        .slice(0, 20)
                        .map((result) => (
                          <div key={result.originalIndex} className="p-4 hover:bg-slate-50">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  Row {result.index + 1}
                                </Badge>
                                <span className="font-semibold text-slate-800">
                                  {result.row.symbol || 'N/A'}
                                </span>
                                <span className="text-sm text-slate-500">
                                  {result.row.type} {result.row.quantity} @ ${result.row.price}
                                </span>
                              </div>
                              <div className="text-right">
                                <div className="text-xs text-slate-500">{result.row.date}</div>
                              </div>
                            </div>
                            
                            {/* Show actual data preview */}
                            <div className="text-xs text-slate-600 mb-2 font-mono bg-slate-50 p-2 rounded">
                              {JSON.stringify(result.row, null, 2).slice(0, 200)}...
                            </div>

                            {/* Errors */}
                            {result.errors.map((error, i) => (
                              <div key={i} className="flex items-center gap-2 text-sm text-red-600 mb-1">
                                <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                                <span className="font-medium">Error:</span>
                                <span>{error}</span>
                              </div>
                            ))}
                            
                            {/* Warnings */}
                            {result.warnings.map((warning, i) => (
                              <div key={i} className="flex items-center gap-2 text-sm text-yellow-600">
                                <Info className="w-3 h-3 flex-shrink-0" />
                                <span className="font-medium">Warning:</span>
                                <span>{warning}</span>
                              </div>
                            ))}
                          </div>
                        ))}
                    </div>
                  </div>
                  {validationResults.filter(r => !r.isValid || r.warnings.length > 0).length > 20 && (
                    <p className="text-sm text-slate-500 text-center">
                      Only showing first 20 issues. Fix these and re-validate to see more.
                    </p>
                  )}
                </div>
              )}

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setCurrentStep(3)}>
                  Back to Preview
                </Button>
                <Button
                  onClick={handleImport}
                  // Disable if no valid transactions or if default portfolio is needed but not selected
                  disabled={validationResults.filter(r => r.isValid).length === 0 || 
                            (validationResults.filter(r => r.isValid && (!r.row.portfolio || !portfolios.some(p => p.name === r.row.portfolio))).length > 0 && !mappingConfig.defaultPortfolio)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Import Valid Transactions
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 5: Results - ENHANCED */}
        {currentStep === 5 && importResults && (
          <Card className="bg-white/70 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Import Complete
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  Successfully imported {importResults.imported} out of {importResults.total} transactions.
                  {importResults.skipped > 0 && (
                    <span>
                      {' '}{importResults.skipped} transactions were skipped due to validation errors.
                      <br />
                      <strong>Import ID:</strong> {lastImportBatchId?.slice(-8)} 
                      <span className="text-xs"> (saved for later review)</span>
                    </span>
                  )}
                </AlertDescription>
              </Alert>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-blue-700">{importResults.total}</p>
                  <p className="text-sm text-blue-600">Total Rows</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-green-700">{importResults.imported}</p>
                  <p className="text-sm text-green-600">Imported</p>
                </div>
                <div className="bg-red-50 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-red-700">{importResults.skipped}</p>
                  <p className="text-sm text-red-600">Skipped</p>
                </div>
              </div>

              {/* Import History Notice */}
              <Alert className="bg-blue-50 border-blue-200">
                <Info className="w-4 h-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  <div className="space-y-2">
                    <p className="font-semibold">Import saved to history</p>
                    <p className="text-sm">
                      You can review this import and all previous imports anytime by going to 
                      <strong> Settings &rarr; Import History</strong>. Each import can be rolled back 
                      individually if needed.
                    </p>
                  </div>
                </AlertDescription>
              </Alert>

              <div className="flex justify-center gap-4 flex-wrap">
                <Button variant="outline" onClick={resetImport}>
                  Import Another File
                </Button>
                <Button onClick={() => window.location.href = '/Settings'} variant="outline">
                  View Import History
                </Button>
                <Button onClick={() => window.location.href = '/Dashboard'} className="bg-blue-600 hover:bg-blue-700">
                  View Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
