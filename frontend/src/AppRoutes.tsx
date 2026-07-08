import { BrowserRouter, Routes, Route } from "react-router-dom";

import Layout from "./components/layout/Layout";

import Dashboard from "./pages/Dashboard";
import MarketScanner from "./pages/MarketScanner";
import Crafting from "./pages/Crafting";
import Analytics from "./pages/Analytics";
import Watchlist from "./pages/Watchlist";
import Settings from "./pages/Settings";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/markets" element={<MarketScanner />} />
          <Route path="/crafting" element={<Crafting />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/watchlist" element={<Watchlist />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}