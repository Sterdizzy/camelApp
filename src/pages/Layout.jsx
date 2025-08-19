

import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { calculateTotalPortfolioValue } from "@/pages/portfolioCalculations";
import {
  TrendingUp,
  Shield,
  Settings,
  Download,
  PieChart,
  BarChart3,
  Menu,
  X,
  BookOpen,
  Upload } from
"lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const navigationItems = [
{
  title: "Portfolio Overview",
  url: createPageUrl("Dashboard"),
  icon: PieChart,
  description: "View all investments"
},
{
  title: "Analytics",
  url: createPageUrl("Analytics"),
  icon: BarChart3,
  description: "Performance insights"
},
{
  title: "Risk Analysis",
  url: createPageUrl("RiskAnalysis"),
  icon: Shield,
  description: "Risk management"
},
{
  title: "Trade Journal",
  url: createPageUrl("TradeJournal"),
  icon: BookOpen,
  description: "Transaction log"
},
{
  title: "Import Data",
  url: createPageUrl("Import"),
  icon: Upload,
  description: "CSV/Excel import"
},
{
  title: "Export Data",
  url: createPageUrl("Export"),
  icon: Download,
  description: "Download reports"
},
{
  title: "Settings",
  url: createPageUrl("Settings"),
  icon: Settings,
  description: "Configure sectors"
}];


export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [portfolioData, setPortfolioData] = useState({
    totalValue: 0,
    totalHoldingsValue: 0,
    totalCashBalance: 0,
    risk_metrics: null
  });
  const [isLoading, setIsLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    loadPortfolioData();
  }, []);

  useEffect(() => {
    // Close sidebar on route change on mobile
    setSidebarOpen(false);
  }, [location]);

  const loadPortfolioData = async () => {
    setIsLoading(true);
    const data = await calculateTotalPortfolioValue();
    setPortfolioData(data);
    setIsLoading(false);
  };

  // Calculate gain percentage (simplified for demo)
  const gainPercentage = portfolioData.totalHoldingsValue > 0 ?
  (portfolioData.totalHoldingsValue - portfolioData.totalHoldingsValue * 0.9) / (portfolioData.totalHoldingsValue * 0.9) * 100 :
  12.4; // Fallback demo value

  const riskCompliance = portfolioData.risk_metrics?.compliance_status?.overall_compliance;

  return (
    <div className="min-h-screen bg-slate-50">
      <style>
        {`
          :root {
            --primary: #0D6EFD;
            --primary-hover: #0B5ED7;
            --dark: #1B1F23;
            --success: #28A745;
            --danger: #DC3545;
            --light: #F8F9FA;
            --border: #E9ECEF;
          }
          
          * {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          }
        `}
      </style>

      {/* Mobile Header */}
      <header className="lg:hidden bg-white/95 backdrop-blur-sm border-b border-slate-200 px-4 py-3 sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <Link to={createPageUrl("Dashboard")} className="flex items-center gap-3">
            <img
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/ea4fd7549_GoogleChrome2025-08-10204200.png"
              alt="CamelTracker Logo"
              className="w-8 h-8 object-contain" />

            <h1 className="text-lg font-bold text-slate-900">CamelTracker</h1>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-slate-600">

            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`
          fixed lg:static inset-y-0 left-0 z-40 w-72 transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
          lg:translate-x-0 lg:shadow-none
        `}>
          <div className="h-full bg-[#1B1F23] border-r border-slate-700 flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-slate-700">
              <div className="flex items-center gap-4 mb-6">
                <img
                  src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/ea4fd7549_GoogleChrome2025-08-10204200.png"
                  alt="CamelTracker Logo" className="bg-slate-800 p-1.5 w-12 h-12 object-contain rounded-xl shadow-lg" />

                <div>
                  <h1 className="text-xl font-bold text-white">CamelTracker</h1>
                  <p className="text-sm text-slate-400">Investment Tracker</p>
                </div>
              </div>
              
              <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-300">Portfolio Value</span>
                  <Badge variant="secondary" className={`${gainPercentage >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {gainPercentage >= 0 ? '+' : ''}{gainPercentage.toFixed(1)}%
                  </Badge>
                </div>
                <p className="text-2xl font-bold text-white">
                  {isLoading ?
                  <span className="animate-pulse">Loading...</span> :

                  `$${portfolioData.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                  }
                </p>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-slate-400">Last updated: 2 min ago</p>
                  {riskCompliance !== undefined &&
                  <Badge variant={riskCompliance ? "secondary" : "destructive"} className="text-xs">
                      {riskCompliance ? "Risk OK" : "Risk Alert"}
                    </Badge>
                  }
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-2">
              {navigationItems.map((item) => {
                const isActive = location.pathname === item.url;
                return (
                  <Link
                    key={item.title}
                    to={item.url}
                    onClick={() => setSidebarOpen(false)}
                    className={`
                      flex items-center gap-3 p-3 rounded-lg transition-colors
                      ${isActive ?
                    'bg-blue-600 text-white font-semibold' :
                    'text-slate-300 hover:bg-slate-700/50 hover:text-white'}
                    `
                    }>

                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    <span>{item.title}</span>
                  </Link>);

              })}
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-slate-700">
              <div className="flex items-center gap-3 p-4 bg-slate-800 rounded-xl">
                <div className="w-10 h-10 bg-gradient-to-br from-slate-400 to-slate-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold text-sm">U</span>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-white text-sm">Investor</p>
                  <p className="text-xs text-slate-400">Premium Account</p>
                </div>
                <Button variant="ghost" size="icon" className="w-8 h-8 text-slate-400 hover:text-white">
                  <Settings className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </aside>

        {/* Overlay for mobile */}
        {sidebarOpen &&
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)} />

        }

        {/* Main Content */}
        <main className="flex-1">
          <div className="min-h-screen">
            {children}
          </div>
        </main>
      </div>
    </div>);

}

