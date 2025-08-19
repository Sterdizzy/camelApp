
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp, 
  Loader2, 
  RefreshCw,
  BarChart3,
  Target,
  AlertCircle,
  Info
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

import { calculateTotalPortfolioValue } from "./portfolioCalculations";

export default function RiskAnalysis() {
  const [portfolioData, setPortfolioData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    loadRiskData();
  }, []);

  const loadRiskData = async () => {
    setIsLoading(true);
    try {
      const data = await calculateTotalPortfolioValue();
      setPortfolioData(data);
      setLastUpdate(new Date());
    } catch (error) {
      console.error("Error loading risk data:", error);
    }
    setIsLoading(false);
  };

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

  const getRiskBadgeColor = (status) => {
    switch (status) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };

  // This function is correctly defined and used for the progress bar color
  const getRiskProgressColor = (percentage, limit) => {
    // The desired color logic is: > limit (6%) is red, > limit * 0.75 (4.5%) is yellow, else green.
    // These correspond to Tailwind's bg-red-500, bg-yellow-500, bg-green-500 respectively.
    if (percentage > limit) return 'bg-red-500';
    if (percentage > limit * 0.75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 mx-auto animate-spin text-blue-600 mb-4" />
          <p className="text-slate-600">Loading risk analysis...</p>
        </div>
      </div>
    );
  }

  const riskMetrics = portfolioData?.risk_metrics;
  const complianceStatus = riskMetrics?.compliance_status;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 pb-20">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Mobile-First Header */}
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-2">
              Risk Analysis
            </h1>
            <p className="text-slate-600 text-sm sm:text-base lg:text-lg">
              Trading Portfolio Risk Management Dashboard
            </p>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Risk rules apply only to trading portfolios • Last updated: {lastUpdate?.toLocaleTimeString()}
            </p>
          </div>
          <Button 
            onClick={loadRiskData} 
            variant="outline" 
            className="gap-2 h-12 touch-manipulation w-full sm:w-auto"
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Data
          </Button>
        </div>

        {/* Mobile-Optimized Compliance Status Alert */}
        <Alert className={`${complianceStatus?.overall_compliance ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
          <div className="flex items-start gap-2">
            {complianceStatus?.overall_compliance ? (
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            )}
            <AlertDescription className={`${complianceStatus?.overall_compliance ? 'text-green-800' : 'text-red-800'} text-sm break-words`}>
              {complianceStatus?.overall_compliance 
                ? 'All trading positions comply with risk management rules'
                : `Risk violations detected: ${riskMetrics?.holdings_with_violations?.length || 0} individual positions and ${riskMetrics?.sectors_with_violations?.length || 0} sectors exceed limits`
              }
            </AlertDescription>
          </div>
        </Alert>

        {/* Mobile-First Risk Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="bg-white/70 backdrop-blur-sm border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Portfolio Value
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900 mb-1 break-all">
                {formatCurrency(portfolioData?.totalValue || 0)}
              </div>
              <div className="text-sm text-slate-600">
                Risk calculation basis
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/70 backdrop-blur-sm border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Total Portfolio Risk
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900 mb-1 break-all">
                {formatCurrency(riskMetrics?.total_risk_amount || 0)}
              </div>
              <div className="text-sm text-slate-600">
                {formatPercentage(riskMetrics?.total_risk_percentage || 0)} of total portfolio
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/70 backdrop-blur-sm border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Sector Compliance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-2">
                {complianceStatus?.sector_compliance ? (
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                )}
                <span className={`font-semibold ${complianceStatus?.sector_compliance ? 'text-green-700' : 'text-red-700'}`}>
                  {complianceStatus?.sector_compliance ? 'Compliant' : 'Violations'}
                </span>
              </div>
              <div className="text-sm text-slate-600">
                {riskMetrics?.sectors_with_violations?.length || 0} sectors exceed 6% limit
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/70 backdrop-blur-sm border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Target className="w-4 h-4" />
                Individual Compliance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-2">
                {complianceStatus?.individual_compliance ? (
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                )}
                <span className={`font-semibold ${complianceStatus?.individual_compliance ? 'text-green-700' : 'text-red-700'}`}>
                  {complianceStatus?.individual_compliance ? 'Compliant' : 'Violations'}
                </span>
              </div>
              <div className="text-sm text-slate-600">
                {riskMetrics?.holdings_with_violations?.length || 0} positions exceed 2% limit
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Mobile-First Sector Risk Analysis */}
        <Card className="bg-white/70 backdrop-blur-sm border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg lg:text-xl">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              Sector Risk Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            {riskMetrics?.sector_risks?.length === 0 ? (
              <div className="text-center py-8">
                <Info className="w-12 h-12 mx-auto text-slate-400 mb-3" />
                <p className="text-slate-600">No trading positions with stop losses found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {riskMetrics?.sector_risks?.map((sector) => (
                  <div key={sector.sector_name} className="p-4 bg-slate-50 rounded-lg">
                    <div className="flex flex-col gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-slate-900 capitalize break-words flex-1">
                          {sector.sector_name}
                        </h3>
                        <Badge variant={getRiskBadgeColor(sector.risk_status)}>
                          {sector.risk_status}
                        </Badge>
                      </div>
                      <div className="text-right sm:text-left">
                        <div className="font-bold text-slate-900">
                          {formatCurrency(sector.total_risk_amount)}
                        </div>
                        <div className="text-sm text-slate-600">
                          {formatPercentage(sector.total_risk_percentage)}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Risk vs 6% limit</span>
                        <span>{formatPercentage(sector.total_risk_percentage)} / 6.00%</span>
                      </div>
                      <div className="relative w-full bg-gray-200 rounded-full h-3">
                        <div 
                          className={`h-3 rounded-full transition-all duration-300 ${getRiskProgressColor(sector.total_risk_percentage, 6)}`}
                          style={{ 
                            width: `${Math.min((sector.total_risk_percentage / 6) * 100, 100)}%` 
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-slate-500">
                        <Link 
                          to={`${createPageUrl("TradeJournal")}?sector=${encodeURIComponent(sector.sector_name)}&portfolios=${sector.portfolio_ids.join(',')}&autoApply=true`}
                          className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer touch-manipulation"
                        >
                          {sector.holdings_count} positions
                        </Link>
                        <span>{sector.exceeds_sector_limit ? 'EXCEEDS LIMIT' : 'Within limit'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Mobile-First Individual Position Risk */}
        <Card className="bg-white/70 backdrop-blur-sm border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg lg:text-xl">
              <Target className="w-5 h-5 text-blue-600" />
              Individual Position Risk
            </CardTitle>
          </CardHeader>
          <CardContent>
            {riskMetrics?.individual_risks?.length === 0 ? (
              <div className="text-center py-8">
                <Info className="w-12 h-12 mx-auto text-slate-400 mb-3" />
                <p className="text-slate-600">No trading positions with stop losses found</p>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden lg:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Position</TableHead>
                        <TableHead>Sector</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead className="text-right">Purchase Price</TableHead>
                        <TableHead className="text-right">Stop Loss</TableHead>
                        <TableHead className="text-right">Risk Amount</TableHead>
                        <TableHead className="text-right">Risk %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {riskMetrics?.individual_risks?.map((position) => (
                        <TableRow key={position.id} className={position.exceeds_individual_limit ? 'bg-red-50' : ''}>
                          <TableCell>
                            <div>
                              <Link
                                to={`${createPageUrl("AssetDetails")}?symbol=${position.symbol}&portfolio=${position.portfolio_id}`}
                                className="font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                              >
                                {position.symbol}
                              </Link>
                              <div className="text-sm text-slate-500 hidden sm:block">{position.name}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize text-xs">
                              {position.sector}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {position.quantity.toLocaleString(undefined, { maximumFractionDigits: 8 })}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(position.purchase_price)}
                          </TableCell>
                          <TableCell className="text-right">
                            {position.has_stop_loss ? formatCurrency(position.stop_loss) : 'N/A'}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(position.risk_amount)}
                          </TableCell>
                          <TableCell className={`text-right font-semibold ${position.exceeds_individual_limit ? 'text-red-600' : 'text-slate-900'}`}>
                            {formatPercentage(position.risk_percentage)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Card View */}
                <div className="lg:hidden space-y-4">
                  {riskMetrics?.individual_risks?.map((position) => (
                    <Card key={position.id} className={`${position.exceeds_individual_limit ? 'bg-red-50 border-red-200' : 'bg-slate-50'}`}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1 min-w-0">
                            <Link
                              to={`${createPageUrl("AssetDetails")}?symbol=${position.symbol}&portfolio=${position.portfolio_id}`}
                              className="font-semibold text-slate-900 truncate hover:text-blue-600 hover:underline cursor-pointer touch-manipulation block"
                            >
                              {position.symbol}
                            </Link>
                            <div className="text-sm text-slate-500 truncate">{position.name}</div>
                            <Badge variant="outline" className="capitalize text-xs mt-1">
                              {position.sector}
                            </Badge>
                          </div>
                          <div className="text-right">
                            <div className={`font-semibold ${position.exceeds_individual_limit ? 'text-red-600' : 'text-slate-900'}`}>
                              {formatPercentage(position.risk_percentage)}
                            </div>
                            <div className="text-sm text-slate-600">Risk %</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-3">
                          <div>
                            <div className="text-xs text-slate-500">Quantity</div>
                            <div className="text-sm font-medium break-all">
                              {position.quantity.toLocaleString(undefined, { maximumFractionDigits: 8 })}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500">Purchase Price</div>
                            <div className="text-sm font-medium">
                              {formatCurrency(position.purchase_price)}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="text-xs text-slate-500">Stop Loss</div>
                            <div className="text-sm font-medium">
                              {position.has_stop_loss ? formatCurrency(position.stop_loss) : 'N/A'}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500">Risk Amount</div>
                            <div className="text-sm font-semibold">
                              {formatCurrency(position.risk_amount)}
                            </div>
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

        {/* Mobile-First Risk Rules Information */}
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg lg:text-xl">
              <Info className="w-5 h-5" />
              Risk Management Rules
            </CardTitle>
          </CardHeader>
          <CardContent className="text-blue-800">
            <div className="grid grid-cols-1 md::grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-semibold">Individual Position Risk</h4>
                <p className="text-sm">
                  No single investment can risk more than 2% of total portfolio value.
                  Risk = (Purchase Price - Stop Loss) × Quantity
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold">Sector Risk</h4>
                <p className="text-sm">
                  Combined risk across all positions in a sector cannot exceed 6% of total portfolio value.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
