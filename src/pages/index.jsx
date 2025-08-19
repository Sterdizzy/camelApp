import Layout from "./Layout.jsx";
import Login from "./Login.jsx";

import Dashboard from "./Dashboard";
import Analytics from "./Analytics";
import Export from "./Export";
import Settings from "./Settings";
import TradeJournal from "./TradeJournal";
import RiskAnalysis from "./RiskAnalysis";
import Import from "./Import";
import TradeDetails from "./TradeDetails";
import AssetDetails from "./AssetDetails";

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

const PAGES = {
    Dashboard: Dashboard,
    Analytics: Analytics,
    Export: Export,
    Settings: Settings,
    TradeJournal: TradeJournal,
    RiskAnalysis: RiskAnalysis,
    Import: Import,
    TradeDetails: TradeDetails,
    AssetDetails: AssetDetails,
}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || Object.keys(PAGES)[0];
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    const { user, loading } = useAuth();
    
    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 mx-auto animate-spin text-blue-600 mb-4" />
                    <p className="text-slate-600">Loading...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return <Login />;
    }
    
    return (
        <Layout currentPageName={currentPage}>
            <Routes>            
                <Route path="/" element={<Dashboard />} />
                <Route path="/Dashboard" element={<Dashboard />} />
                <Route path="/Analytics" element={<Analytics />} />
                <Route path="/Export" element={<Export />} />
                <Route path="/Settings" element={<Settings />} />
                <Route path="/TradeJournal" element={<TradeJournal />} />
                <Route path="/RiskAnalysis" element={<RiskAnalysis />} />
                <Route path="/Import" element={<Import />} />
                <Route path="/TradeDetails" element={<TradeDetails />} />
                <Route path="/AssetDetails" element={<AssetDetails />} />
            </Routes>
        </Layout>
    );
}

export default function Pages() {
    return (
        <AuthProvider>
            <Router>
                <PagesContent />
            </Router>
        </AuthProvider>
    );
}