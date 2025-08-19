
import React from "react";
import SectorManager from "../components/settings/SectorManager";
import PortfolioManager from "../components/settings/PortfolioManager";
import ImportHistoryManager from "../components/settings/ImportHistoryManager";
import { Settings as SettingsIcon } from "lucide-react";

export default function Settings() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 pb-20">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Mobile-First Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-2">
            Configuration
          </h1>
          <p className="text-slate-600 text-sm sm:text-base lg:text-lg">
            Customize and manage your application settings
          </p>
        </div>
        
        <PortfolioManager />
        <SectorManager />
        <ImportHistoryManager />
      </div>
    </div>
  );
}
