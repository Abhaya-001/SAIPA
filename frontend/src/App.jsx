import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { RefreshCw } from 'lucide-react';

// Layout shell stays eager — it is always needed for authenticated routes
import ProtectedLayout from './components/layout/ProtectedLayout';
import GlassPanel from './components/ui/GlassPanel';
import MetricCard from './components/ui/MetricCard';
import { Wallet, TrendingUp, Layers, Activity } from 'lucide-react';

// ─── Lazy-loaded pages ────────────────────────────────────────────────────────
const Login          = lazy(() => import('./pages/Login'));
const Register       = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const Profile        = lazy(() => import('./pages/Profile'));
const ApiKeys        = lazy(() => import('./pages/ApiKeys'));
const Settings       = lazy(() => import('./pages/Settings'));
const ChangePassword = lazy(() => import('./pages/ChangePassword'));
const Markets        = lazy(() => import('./pages/Markets'));
const News           = lazy(() => import('./pages/News'));

// ─── Lazy-loaded dashboard sub-components ────────────────────────────────────
const AssetTable       = lazy(() => import('./components/portfolio/AssetTable'));
const TradeHistory     = lazy(() => import('./components/portfolio/TradeHistory'));
const AllocationChart  = lazy(() => import('./components/portfolio/AllocationChart'));
const PerformanceChart = lazy(() => import('./components/portfolio/PerformanceChart'));
const TopContributors  = lazy(() => import('./components/portfolio/TopContributors'));
const TopHoldings      = lazy(() => import('./components/portfolio/TopHoldings'));

// ─── Lazy-loaded advanced analytics ──────────────────────────────────────────
const HoldingsTreemap    = lazy(() => import('./components/portfolio/HoldingsTreemap'));
const PerformanceHeatmap = lazy(() => import('./components/portfolio/PerformanceHeatmap'));
const RiskReturnScatter  = lazy(() => import('./components/portfolio/RiskReturnScatter'));
const CorrelationMatrix  = lazy(() => import('./components/portfolio/CorrelationMatrix'));

// ─── Shared fallback spinners ─────────────────────────────────────────────────
function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-saipa-void">
      <div className="flex flex-col items-center gap-3 animate-fade-in">
        <div className="w-10 h-10 saipa-spinner" />
        <p className="text-sm text-gray-500 dark:text-slate-400 font-medium font-display">Initializing SAIPA…</p>
      </div>
    </div>
  );
}

function ComponentFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-8 h-8 border-3 border-primary-500 border-t-transparent rounded-full animate-spin opacity-70" />
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { token, loading, isCheckingAuth } = useAuth();

  if (loading || isCheckingAuth) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-saipa-void text-gray-900 dark:text-white transition-colors duration-300">
      <div className="flex flex-col items-center animate-fade-in">
        <div className="w-12 h-12 saipa-spinner mb-4"></div>
        <p className="font-medium mt-4 text-gray-500 dark:text-slate-400 font-display">Verifying session…</p>
      </div>
    </div>
  );

  if (!token) return <Navigate to="/login" replace />;

  return children;
}

function AuthRoute({ children }) {
  const { token, isCheckingAuth } = useAuth();

  if (isCheckingAuth) return null; // Wait for initial check to avoid flash
  if (token) return <Navigate to="/dashboard" replace />; // Already logged in

  return children;
}

function Dashboard() {
  const { token } = useAuth();

  const [summary, setSummary] = useState({
    total_capital: 0.0,
    total_value: 0.0,
    active_positions: 0,
    day_return_perc: 0.0,
    day_return_abs: 0.0
  });
  const [assets, setAssets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyticsVersion, setAnalyticsVersion] = useState(0);
  const [syncIssues, setSyncIssues] = useState([]);
  const [credentials, setCredentials] = useState([]);
  const [selectedBrokers, setSelectedBrokers] = useState(['ALL']);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  
  const [prefs, setPrefs] = useState(() => {
    try {
      const cached = localStorage.getItem('portfolio_prefs');
      if (cached) return JSON.parse(cached);
    } catch {
      // Invalid local preferences are safely replaced with defaults.
    }
    return { sync_interval: 15, default_view: 'dashboard' };
  });

  const fetchDashboardData = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);

      // Auto-negotiate live stream sync with API keys FIRST natively!
      try {
        const syncRes = await axios.post('http://localhost:8000/portfolio/sync', {}, { headers: { Authorization: `Bearer ${token}` } });
        setSyncIssues((syncRes.data.details || []).filter(item => item.status !== 'success'));
      } catch (syncErr) {
        console.error("Auto-sync background pipeline failed: ", syncErr);
        setSyncIssues([{ message: 'Could not reach the broker sync service. Your last synced portfolio data is still shown.' }]);
      }

      const [summaryRes, assetsRes, txRes, prefsRes] = await Promise.all([
        axios.get('http://localhost:8000/portfolio/summary', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('http://localhost:8000/portfolio/assets', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('http://localhost:8000/portfolio/transactions', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('http://localhost:8000/users/me/preferences', { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: {} }))
      ]);

      setSummary(summaryRes.data);
      setAssets(assetsRes.data);
      setTransactions(txRes.data);
      // Analytics panels fetch their own data.  A monotonic version, rather
      // than the loading boolean, refreshes them after every successful sync
      // (including background polling).
      setAnalyticsVersion(version => version + 1);
      if (prefsRes.data && prefsRes.data.default_view) {
          setPrefs(prefsRes.data);
          localStorage.setItem('portfolio_prefs', JSON.stringify(prefsRes.data));
      }

      // Fetch credentials to build the broker filter options
      try {
        const credsRes = await axios.get('http://localhost:8000/brokers/credentials', { headers: { Authorization: `Bearer ${token}` } });
        setCredentials(credsRes.data);
      } catch {
        // Broker names are optional dashboard metadata.
      }
    } catch (err) {
      console.error("Failed to load dashboard data", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Initial load
  // Initial load
  useEffect(() => {
    if (token) fetchDashboardData();
  }, [token, fetchDashboardData]);

  // Dynamic Polling Interval based on preferences
  useEffect(() => {
    if (!token) return;
    
    // Convert prefs.sync_interval (seconds) to milliseconds
    const intervalMs = (prefs.sync_interval || 15) * 1000;
    const pollingInterval = setInterval(() => {
      fetchDashboardData(true);
    }, intervalMs);

    return () => clearInterval(pollingInterval);
  }, [token, fetchDashboardData, prefs.sync_interval]);

  const handleDeleteAsset = async (assetId) => {
    if (!window.confirm("Are you sure you want to remove this position?")) return;

    try {
      await axios.delete(`http://localhost:8000/portfolio/assets/${assetId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchDashboardData();
    } catch (err) {
      console.error("Failed to delete asset", err);
    }
  };

  // Derive unique broker names from credentials for the filter
  const brokerOptions = [...new Set(credentials.map(c => c.broker_name))];

  // Use credential IDs for filtering instead of broker names
  const toggleBroker = (id) => {
    if (id === 'ALL') {
      setSelectedBrokers(['ALL']);
      return;
    }
    setSelectedBrokers(prev => {
      const withoutAll = prev.filter(b => b !== 'ALL');
      const already = withoutAll.includes(id);
      const next = already ? withoutAll.filter(b => b !== id) : [...withoutAll, id];
      return next.length === 0 ? ['ALL'] : next;
    });
  };

  // Filter transactions the same as assets
  const filteredTransactions = selectedBrokers.includes('ALL')
    ? transactions
    : transactions.filter(t => selectedBrokers.includes(t.credential_id));

  const filteredAssets = selectedBrokers.includes('ALL')
    ? assets
    : assets.filter(a => selectedBrokers.includes(a.credential_id));

  // Label for the dropdown trigger button
  const filterLabel = selectedBrokers.includes('ALL') ? 'All Accounts' : `${selectedBrokers.length} Account${selectedBrokers.length > 1 ? 's' : ''}`;

  // Compute summary metrics from filteredAssets so filter affects ALL tiles
  const filteredSummary = (() => {
    if (selectedBrokers.includes('ALL')) return summary;

    // Total Capital: sum total_capital from only the matching credentials
    const filteredCapital = credentials
      .filter(c => selectedBrokers.includes(c.id))
      .reduce((sum, c) => sum + parseFloat(c.total_capital || 0), 0);

    // Assets Value: sum (qty * current_price) for filtered assets
    const filteredValue = filteredAssets.reduce((sum, a) => {
      const qty = parseFloat(a.quantity || 0);
      const price = parseFloat(a.current_price || a.average_buy_price || 0);
      return sum + qty * price;
    }, 0);

    // P&L: sum of pnl
    const totalPnl = filteredAssets.reduce((sum, a) => sum + parseFloat(a.pnl || 0), 0);
    const costBasis = filteredAssets.reduce((sum, a) => {
      return sum + parseFloat(a.quantity || 0) * parseFloat(a.average_buy_price || 0);
    }, 0);
    const dayReturnPerc = costBasis > 0 ? (totalPnl / costBasis) * 100 : 0;

    return {
      total_capital: filteredCapital,
      total_value: filteredValue,
      active_positions: filteredAssets.length,
      day_return_perc: dayReturnPerc,
      day_return_abs: totalPnl,
    };
  })();

  return (
    <div className="w-full animate-fade-in relative">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
        <div>
          <h1 className="saipa-page-title">Portfolio command center</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">Live positions, allocation, and risk across every connected account.</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Broker Account Dropdown */}
          {brokerOptions.length >= 1 && (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(o => !o)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 transition-colors"
              >
                <span>{filterLabel}</span>
                <svg className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>

              {dropdownOpen && (
                <>
                  {/* Backdrop to close on outside click */}
                  <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
                  <div className="absolute right-0 mt-2 w-52 z-20 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl overflow-hidden">
                    <div className="px-3 py-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-gray-800">
                      Filter by Account
                    </div>
                    {/* All option */}
                    <label className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/60 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedBrokers.includes('ALL')}
                        onChange={() => toggleBroker('ALL')}
                        className="accent-primary-600 w-4 h-4"
                      />
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">All Accounts</span>
                    </label>
                    <div className="border-t border-gray-100 dark:border-gray-800" />
                    {credentials.map(cred => (
                      <label key={cred.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/60 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedBrokers.includes(cred.id)}
                          onChange={() => toggleBroker(cred.id)}
                          className="accent-primary-600 w-4 h-4"
                        />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                            {cred.nickname || cred.broker_name}
                          </span>
                          {cred.nickname && (
                            <span className="text-[10px] text-gray-500 uppercase tracking-tighter">
                              {cred.broker_name}
                            </span>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <button
            onClick={() => fetchDashboardData(false)}
            disabled={loading}
            className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            title="Manual Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin text-primary-500' : ''}`} />
          </button>
        </div>
      </div>

      {syncIssues.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-300/70 bg-amber-50/80 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <span className="font-semibold">Some accounts could not sync.</span>{' '}
          {syncIssues.map(issue => issue.message).filter(Boolean).join(' ')}
          <span className="ml-1">Use the sync button in API Integrations to retry and see the broker response.</span>
        </div>
      )}


      {/* Decorative background elements matching the login page theme */}
      <div className="absolute top-20 right-0 w-72 h-72 bg-primary-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob pointer-events-none dark:hidden"></div>
      <div className="absolute bottom-20 left-0 w-72 h-72 bg-indigo-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000 dark:hidden pointer-events-none"></div>

      {prefs.default_view !== 'holdings' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <MetricCard label="Account equity" icon={Wallet} loading={loading}
            value={`$${(filteredSummary.total_capital || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} valueClassName="text-emerald-600 dark:text-emerald-400" />
          <MetricCard label="Invested value" icon={TrendingUp} loading={loading}
            value={`$${(filteredSummary.total_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
          <MetricCard label="Active positions" icon={Layers} loading={loading}
            value={filteredSummary.active_positions} valueClassName="text-violet-600 dark:text-violet-400" />
          <MetricCard label="Unrealized return" icon={Activity} loading={loading}
            value={`${filteredSummary.day_return_perc > 0 ? '+' : ''}${filteredSummary.day_return_perc.toFixed(2)}%`}
            valueClassName={filteredSummary.day_return_perc >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'} />
        </div>
      )}

      {prefs.default_view !== 'holdings' && (
        <div className="mt-8 flex flex-col gap-6 relative z-0">
          <Suspense fallback={<ComponentFallback />}>
            <PerformanceChart refreshTrigger={analyticsVersion} />
          </Suspense>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            <Suspense fallback={<ComponentFallback />}>
              <AllocationChart refreshTrigger={analyticsVersion} />
            </Suspense>
            <Suspense fallback={<ComponentFallback />}>
              <TopContributors assets={filteredAssets} loading={loading} />
            </Suspense>
            <Suspense fallback={<ComponentFallback />}>
              <TopHoldings assets={filteredAssets} loading={loading} />
            </Suspense>
          </div>
        </div>
      )}

      {/* ── Advanced Analytics ── */}
      {prefs.default_view !== 'holdings' && (
        <div className="mt-8 flex flex-col gap-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Advanced Analytics</h2>
          
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Full width */}
            <div className="xl:col-span-3">
              <Suspense fallback={<ComponentFallback />}>
                <PerformanceHeatmap refreshTrigger={analyticsVersion} />
              </Suspense>
            </div>
            
            {/* Full width */}
            <div className="xl:col-span-3">
              <Suspense fallback={<ComponentFallback />}>
                <HoldingsTreemap assets={filteredAssets} loading={loading} />
              </Suspense>
            </div>
            
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6">
            <div className="h-full">
              <Suspense fallback={<ComponentFallback />}>
                <RiskReturnScatter refreshTrigger={analyticsVersion} />
              </Suspense>
            </div>
            
            <div className="h-full">
              <Suspense fallback={<ComponentFallback />}>
                <CorrelationMatrix refreshTrigger={analyticsVersion} />
              </Suspense>
            </div>
          </div>
        </div>
      )}

      <div className={`mt-8 ${prefs.default_view === 'holdings' ? 'pt-4' : ''}`}>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Current Holdings</h2>
        <GlassPanel className="overflow-hidden">
          <Suspense fallback={<ComponentFallback />}>
            <AssetTable
              assets={filteredAssets}
              onDelete={handleDeleteAsset}
              loading={loading}
            />
          </Suspense>
        </GlassPanel>
      </div>

      {prefs.default_view !== 'holdings' && (
        <div className="mt-8 relative z-0">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Trade History</h2>
          <GlassPanel className="overflow-hidden relative z-0">
            <Suspense fallback={<ComponentFallback />}>
              <TradeHistory
                transactions={filteredTransactions}
                loading={loading}
              />
            </Suspense>
          </GlassPanel>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="/login" element={<AuthRoute><Suspense fallback={<PageFallback />}><Login /></Suspense></AuthRoute>} />
          <Route path="/register" element={<AuthRoute><Suspense fallback={<PageFallback />}><Register /></Suspense></AuthRoute>} />
          <Route path="/forgot-password" element={<AuthRoute><Suspense fallback={<PageFallback />}><ForgotPassword /></Suspense></AuthRoute>} />

          {/* Protected Routes Wrapper */}
          <Route element={
            <ProtectedRoute>
              <ProtectedLayout />
            </ProtectedRoute>
          }>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/markets" element={<Suspense fallback={<PageFallback />}><Markets /></Suspense>} />
            <Route path="/news" element={<Suspense fallback={<PageFallback />}><News /></Suspense>} />
            <Route path="/profile" element={<Suspense fallback={<PageFallback />}><Profile /></Suspense>} />
            <Route path="/api-keys" element={<Suspense fallback={<PageFallback />}><ApiKeys /></Suspense>} />
            <Route path="/settings" element={<Suspense fallback={<PageFallback />}><Settings /></Suspense>} />
            <Route path="/change-password" element={<Suspense fallback={<PageFallback />}><ChangePassword /></Suspense>} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
