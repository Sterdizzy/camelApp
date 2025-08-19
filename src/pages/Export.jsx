
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileText, Calendar } from "lucide-react";
import { format } from "date-fns";

import { calculateTotalPortfolioValue } from "./portfolioCalculations";

export default function Export() {
  const [portfolioData, setPortfolioData] = useState(null);
  const [selectedPortfolio, setSelectedPortfolio] = useState("all");
  const [exportFormat, setExportFormat] = useState("csv");
  const [includeFields, setIncludeFields] = useState({
    symbol: true,
    name: true,
    sector: true,
    quantity: true,
    purchase_price: true,
    current_price: true,
    purchase_date: true,
    gain_loss: true,
    portfolio_name: true
  });
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const data = await calculateTotalPortfolioValue();
      setPortfolioData(data);
    } catch (error) {
      console.error("Error loading export data:", error);
    }
  };

  const getFilteredHoldings = () => {
    if (!portfolioData?.holdings) return [];
    if (selectedPortfolio === "all") return portfolioData.holdings;
    return portfolioData.holdings.filter(h => h.portfolio_id === selectedPortfolio);
  };

  const prepareExportData = () => {
    const filteredHoldings = getFilteredHoldings();
    
    return filteredHoldings.map(holding => {
      const portfolio = portfolioData.portfolios?.find(p => p.id === holding.portfolio_id);
      const purchasePrice = Number(holding.purchase_price) || 0;
      const currentPrice = Number(holding.current_price) || 0;
      const quantity = Number(holding.quantity) || 0;

      const currentValue = currentPrice * quantity;
      const purchaseValue = purchasePrice * quantity;
      const gainLoss = currentValue - purchaseValue;
      const gainLossPercent = purchaseValue > 0 ? (gainLoss / purchaseValue) * 100 : 0;

      const data = {};
      
      if (includeFields.symbol) data['Symbol'] = holding.symbol;
      if (includeFields.name) data['Company Name'] = holding.name;
      if (includeFields.sector) data['Sector'] = holding.sector?.replace(/_/g, ' ');
      if (includeFields.quantity) data['Quantity'] = holding.quantity;
      if (includeFields.purchase_price) data['Purchase Price'] = holding.purchase_price;
      if (includeFields.current_price) data['Current Price'] = holding.current_price;
      if (includeFields.purchase_date) data['Purchase Date'] = holding.purchase_date ? format(new Date(holding.purchase_date), 'yyyy-MM-dd') : '';
      if (includeFields.gain_loss) {
        data['Gain/Loss ($)'] = gainLoss.toFixed(2);
        data['Gain/Loss (%)'] = gainLossPercent.toFixed(2);
      }
      if (includeFields.portfolio_name) data['Portfolio'] = portfolio?.name;

      return data;
    });
  };

  const exportToCSV = () => {
    const data = prepareExportData();
    if (data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => {
        const value = row[header];
        return `"${String(value || '').replace(/"/g, '""')}"`;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `portfolio-export-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    const data = prepareExportData();
    if (data.length === 0) return;

    const htmlContent = `
      <html>
        <head>
          <title>Portfolio Export</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            h1 { color: #333; }
            .header { margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Investment Portfolio Export</h1>
            <p>Generated on: ${format(new Date(), 'PPP')}</p>
            <p>Portfolio: ${selectedPortfolio === 'all' ? 'All Portfolios' : portfolioData.portfolios?.find(p => p.id === selectedPortfolio)?.name || 'N/A'}</p>
          </div>
          <table>
            <thead>
              <tr>
                ${Object.keys(data[0]).map(header => `<th>${header}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${data.map(row => `
                <tr>
                  ${Object.values(row).map(value => `<td>${value === null || value === undefined ? '' : value}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `portfolio-export-${format(new Date(), 'yyyy-MM-dd')}.html`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      if (exportFormat === 'csv') {
        exportToCSV();
      } else {
        exportToPDF();
      }
    } catch (error) {
      console.error("Export error:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const filteredHoldings = getFilteredHoldings();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 pb-20">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Mobile-First Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-2">
            Export Portfolio Data
          </h1>
          <p className="text-slate-600 text-sm sm:text-base lg:text-lg">
            Generate comprehensive reports of your investment portfolio
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Mobile-First Export Configuration */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-white/70 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <FileText className="w-5 h-5" />
                  Export Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Portfolio Selection */}
                <div className="space-y-2">
                  <label htmlFor="portfolio-select" className="text-sm font-medium text-slate-700">
                    Portfolio
                  </label>
                  <Select value={selectedPortfolio} onValueChange={setSelectedPortfolio}>
                    <SelectTrigger id="portfolio-select" className="h-12">
                      <SelectValue placeholder="Select portfolio" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Portfolios</SelectItem>
                      {portfolioData?.portfolios?.map((portfolio) => (
                        <SelectItem key={portfolio.id} value={portfolio.id}>
                          {portfolio.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Format Selection */}
                <div className="space-y-2">
                  <label htmlFor="export-format-select" className="text-sm font-medium text-slate-700">
                    Export Format
                  </label>
                  <Select value={exportFormat} onValueChange={setExportFormat}>
                    <SelectTrigger id="export-format-select" className="h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">CSV (Excel Compatible)</SelectItem>
                      <SelectItem value="pdf">PDF Report</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Mobile-Optimized Field Selection */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-slate-700">
                    Include Fields
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Object.entries(includeFields).map(([field, checked]) => (
                      <div key={field} className="flex items-center space-x-3 p-2 rounded touch-manipulation">
                        <Checkbox
                          id={field}
                          checked={checked}
                          onCheckedChange={(value) => 
                            setIncludeFields({...includeFields, [field]: value})
                          }
                          className="h-5 w-5"
                        />
                        <label htmlFor={field} className="text-sm text-slate-700 capitalize cursor-pointer flex-1">
                          {field.replace(/_/g, ' ')}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Mobile-First Export Preview */}
          <div className="space-y-6">
            <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-blue-900 flex items-center gap-2 text-lg">
                  <Calendar className="w-5 h-5" />
                  Export Preview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600">Records:</span>
                    <span className="font-semibold text-slate-900">
                      {filteredHoldings.length}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600">Format:</span>
                    <span className="font-semibold text-slate-900 uppercase">
                      {exportFormat}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600">Fields:</span>
                    <span className="font-semibold text-slate-900">
                      {Object.values(includeFields).filter(Boolean).length}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600">Date:</span>
                    <span className="font-semibold text-slate-900">
                      {format(new Date(), 'MMM d, yyyy')}
                    </span>
                  </div>
                </div>

                <Button
                  onClick={handleExport}
                  disabled={isExporting || filteredHoldings.length === 0}
                  className="w-full bg-blue-600 hover:bg-blue-700 h-12 touch-manipulation"
                >
                  {isExporting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Export Data
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Mobile-Optimized Export Tips */}
            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
              <CardHeader>
                <CardTitle className="text-green-900 text-base">Export Tips</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xs sm:text-sm text-green-800 space-y-2">
                  <p>• CSV files can be opened in Excel or Google Sheets</p>
                  <p>• PDF reports are ideal for presentations</p>
                  <p>• Include gain/loss for performance analysis</p>
                  <p>• Export regularly for record keeping</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
