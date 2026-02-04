import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SignalCard } from "@/components/SignalCard";
import { useSignalsStore } from "@/store/signals";
import { useUiStore } from "@/store/ui";
import { auth } from "@/lib/firebase";
import { 
  Plus, 
  Filter, 
  Star, 
  TrendingUp, 
  Bell, 
  Shield, 
  Users, 
  Zap,
  Search,
  SlidersHorizontal,
  Activity,
  Target,
  AlertTriangle,
  CheckCircle,
  Info,
  X,
  BarChart3,
  RefreshCw
} from "lucide-react";
import { formatDateTime, formatDate } from "@/lib/utils";

interface Signal {
  id: string;
  symbol: string;
  type: 'SEC' | 'INSIDER' | 'NEWS' | 'TECH';
  confidence: number;
  title: string;
  rationale: string;
  createdAt: string;
  logo?: string;
  // Additional fields from backend
  keyPoints?: string[];
  sentimentAnalysis?: string;
  riskLevel?: string;
  signal?: string; // BUY/SELL/HOLD
  articlesAnalyzed?: number;
  insiderData?: any;
  institutionalData?: any;
}

const signalTypes = ['All', 'SEC', 'INSIDER', 'NEWS', 'TECH'] as const;

export function SignalsPage() {
  const { signals, alerts, fetchSignals, createAlert, dismissSignal, regenerateSignals, isRegenerating } = useSignalsStore();
  const { setLoading } = useUiStore();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [confidenceFilter, setConfidenceFilter] = useState(0);
  const [watchedSignals, setWatchedSignals] = useState<Set<string>>(new Set());
  const [showCreateAlert, setShowCreateAlert] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null);
  const [customTicker, setCustomTicker] = useState('');
  const [isGeneratingCustom, setIsGeneratingCustom] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Show toast notification
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000); // Auto-hide after 3 seconds
  };
  
  // Auto-sync signal type with active tab
  const getSignalTypeFromTab = (tab: string): 'NEWS' | 'SEC' | 'INSIDER' => {
    if (tab === 'INSIDER') return 'INSIDER';
    if (tab === 'SEC') return 'SEC';
    return 'NEWS'; // Default to NEWS for 'All', 'NEWS', or 'TECH'
  };
  
  const customSignalType = getSignalTypeFromTab(activeTab);

  useEffect(() => {
    // Check if user is logged in (check for JWT token in localStorage)
    const checkAuth = () => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        setIsLoggedIn(true);
      } else {
        // Fallback to Firebase auth check
        if (auth && auth.currentUser) {
          setIsLoggedIn(true);
        } else {
          setIsLoggedIn(false);
        }
      }
    };
    
    checkAuth();
    
    // Listen for storage changes (when token is set/removed)
    const handleStorageChange = () => {
      checkAuth();
    };
    window.addEventListener('storage', handleStorageChange);
    
    // Also check periodically (in case token was set in same window)
    const interval = setInterval(checkAuth, 1000);
    
    // Fallback: Listen for auth state changes
    const unsubscribe = auth?.onAuthStateChanged(() => {
      checkAuth();
    });

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
      if (unsubscribe) unsubscribe();
    };
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchSignals();
      setLoading(false);
    };

    loadData();
  }, [fetchSignals, setLoading]);

  const filteredSignals = signals.filter(signal => {
    const matchesTab = activeTab === 'All' || signal.type === activeTab;
    const matchesSearch = signal.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         signal.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesConfidence = signal.confidence >= confidenceFilter;
    
    return matchesTab && matchesSearch && matchesConfidence;
  });

  const handleWatch = (signalId: string) => {
    setWatchedSignals(prev => {
      const newSet = new Set(prev);
      if (newSet.has(signalId)) {
        newSet.delete(signalId);
      } else {
        newSet.add(signalId);
      }
      return newSet;
    });
  };

  const handleBacktest = (signalId: string) => {
    // Mock backtest - in real app would open modal with chart
    showToast(`Backtesting signal ${signalId}...`, 'success');
  };

  const handleCreateAlert = async () => {
    // Mock alert creation
    await createAlert({
      tickers: ['AAPL', 'NVDA'],
      type: 'TECH',
      threshold: 75,
      channel: 'push',
      quietHours: false
    });
    setShowCreateAlert(false);
    showToast('Alert created successfully!', 'success');
  };

  const handleGenerateCustomSignal = async () => {
    if (!customTicker.trim()) return;
    
    const tickerToGenerate = customTicker.trim();
    setIsGeneratingCustom(true);
    try {
      const token = await (async () => {
        const backendToken = localStorage.getItem('auth_token');
        if (backendToken) return backendToken;
        if (auth && auth.currentUser) {
          return await auth.currentUser.getIdToken();
        }
        return null;
      })();
      
      if (!token) {
        throw new Error('No auth token available');
      }
      
      const API_BASE_URL = 'http://localhost:8000';
      let endpoint = '';
      let method = 'POST';
      
      // Choose endpoint based on signal type
      if (customSignalType === 'INSIDER') {
        endpoint = `${API_BASE_URL}/api/signals/generate-insider/${tickerToGenerate}?days_back=7`;
      } else if (customSignalType === 'SEC') {
        endpoint = `${API_BASE_URL}/api/signals/generate-sec/${tickerToGenerate}?quarters_back=1`;
      } else {
        // NEWS - use the regular generate endpoint
        endpoint = `${API_BASE_URL}/api/signals/generate`;
        method = 'POST';
      }
      
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: customSignalType === 'NEWS' ? JSON.stringify({
          ticker: tickerToGenerate,
          news_limit: 10
        }) : undefined
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(errorData.detail || `Failed to generate ${customSignalType} signal: ${response.statusText}`);
      }
      
      const signalData = await response.json();
      
      // Refresh signals to show the new one
      await fetchSignals();
      setCustomTicker('');
      showToast(`✅ ${customSignalType} signal generated for ${tickerToGenerate}!`, 'success');
    } catch (error: any) {
      console.error(`Error generating ${customSignalType} signal:`, error);
      showToast(`Error: ${error.message || `Failed to generate ${customSignalType} signal`}`, 'error');
    } finally {
      setIsGeneratingCustom(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">AI Signals</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Discover high-confidence investment opportunities powered by advanced AI analysis.
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <Button 
                onClick={async () => {
                  // Popular tickers to regenerate
                  const popularTickers = ['NVDA', 'TSLA', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NFLX'];
                  await regenerateSignals(popularTickers);
                }}
                disabled={isRegenerating}
                className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRegenerating ? 'animate-spin' : ''}`} />
                {isRegenerating ? 'Regenerating...' : 'Regenerate Signals'}
              </Button>
              <Button 
                onClick={() => setShowCreateAlert(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Alert
              </Button>
            </div>
          </div>
        </div>

        {/* Login Notice - Only show if no signals and not logged in */}
        {!isLoggedIn && signals.length === 0 && (
          <div className="mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                Authentication Required for Real AI Signals
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                You need to <button onClick={() => navigate('/')} className="underline font-medium hover:text-amber-900 dark:hover:text-amber-100">sign up</button> or <button onClick={() => navigate('/')} className="underline font-medium hover:text-amber-900 dark:hover:text-amber-100">log in</button> to get real-time AI-generated signals powered by Gemini AI, Finlight news, and SEC data.
              </p>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Total Signals</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{signals.length}</p>
              </div>
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">High Confidence</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {signals.filter(s => s.confidence >= 80).length}
                </p>
              </div>
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Active Alerts</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{alerts.length}</p>
              </div>
              <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/20 rounded-lg flex items-center justify-center">
                <Bell className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Avg Confidence</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {signals.length > 0 ? Math.round(signals.reduce((acc, s) => acc + s.confidence, 0) / signals.length) : 0}%
                </p>
              </div>
              <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                <Target className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Advanced Filters */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                <SlidersHorizontal className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Advanced Filters</h2>
            </div>
          </div>

          <div className="space-y-6">
            {/* Signal Type Tabs */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Signal Type</h3>
              <div className="flex flex-wrap gap-3">
                {signalTypes.map((type) => {
                  const getTypeIcon = (type: string) => {
                    switch (type) {
                      case 'SEC': return <Shield className="h-4 w-4" />;
                      case 'INSIDER': return <Users className="h-4 w-4" />;
                      case 'NEWS': return <Activity className="h-4 w-4" />;
                      case 'TECH': return <TrendingUp className="h-4 w-4" />;
                      default: return <Zap className="h-4 w-4" />;
                    }
                  };

                  return (
                    <Button
                      key={type}
                      variant={activeTab === type ? "default" : "outline"}
                      size="sm"
                      onClick={() => setActiveTab(type)}
                      className={`px-4 py-2 text-sm font-medium transition-all ${
                        activeTab === type
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-300'
                      }`}
                    >
                      {getTypeIcon(type)}
                      <span className="ml-2">{type}</span>
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Search and Confidence Filter */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Search Signals
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search symbols or titles..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Minimum Confidence: {confidenceFilter}%
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={confidenceFilter}
                    onChange={(e) => setConfidenceFilter(Number(e.target.value))}
                    className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${
                      confidenceFilter >= 80 ? 'bg-green-500' : 
                      confidenceFilter >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}></div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {confidenceFilter >= 80 ? 'High' : 
                       confidenceFilter >= 60 ? 'Medium' : 'Low'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Generate Custom Signal */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mt-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Generate Signal for Specific Ticker
                <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                  (Will generate {customSignalType} signal based on current tab)
                </span>
              </label>
              <div className="flex items-center space-x-3">
                <div className="px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300">
                  {customSignalType === 'NEWS' ? '📰 NEWS (AI Analysis)' : customSignalType === 'SEC' ? '🏛️ SEC (Institutional)' : '👔 INSIDER (Trading)'}
                </div>
                <Input
                  placeholder="Enter ticker (e.g., AAPL, TSLA)"
                  value={customTicker}
                  onChange={(e) => setCustomTicker(e.target.value.toUpperCase())}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && customTicker.trim()) {
                      handleGenerateCustomSignal();
                    }
                  }}
                  className="flex-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                  maxLength={10}
                />
                <Button
                  onClick={handleGenerateCustomSignal}
                  disabled={!customTicker.trim() || isGeneratingCustom || activeTab === 'All' || activeTab === 'TECH'}
                  className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
                >
                  {isGeneratingCustom ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      Generate
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                💡 {customSignalType === 'NEWS' ? 'AI-evaluated news analysis' : customSignalType === 'SEC' ? 'Institutional holdings data (no AI)' : 'Insider trading data (no AI)'}. Signal type matches your current tab filter. Checks for existing signals first to save API calls.
              </p>
            </div>
          </div>
        </div>

        {/* Active Alerts */}
        {alerts.length > 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/20 rounded-lg flex items-center justify-center">
                  <Bell className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Active Alerts</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{alerts.length} monitoring your portfolio</p>
                </div>
              </div>
              <Badge variant="secondary" className="bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400">
                {alerts.length} Active
              </Badge>
            </div>
            
            <div className="grid gap-4">
              {alerts.map((alert) => (
                <div key={alert.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                      <Target className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {alert.tickers.join(', ')}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {alert.type} signals • {alert.threshold}% confidence threshold
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        {alert.channel} notifications • {alert.quietHours ? 'Quiet hours enabled' : '24/7 monitoring'}
                      </div>
                    </div>
                  </div>
                  <Badge 
                    variant="secondary" 
                    className={`${
                      alert.type === 'TECH' ? 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400' :
                      alert.type === 'SEC' ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' :
                      alert.type === 'INSIDER' ? 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400' :
                      'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                    }`}
                  >
                    {alert.type}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Signals List */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                <Zap className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  AI Signals ({filteredSignals.length})
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Showing {activeTab === 'All' ? 'all' : activeTab.toLowerCase()} signals
                </p>
              </div>
            </div>
            
            {filteredSignals.length > 0 && (
              <div className="flex items-center space-x-2">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {filteredSignals.filter(s => s.confidence >= 80).length} high confidence
                </div>
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              </div>
            )}
          </div>

          {filteredSignals.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-12">
              <div className="text-center">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {signals.length === 0 ? 'No Signals Available' : 'No Signals Match Filters'}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  {signals.length === 0 
                    ? 'Click "Regenerate Signals" to fetch real-time AI signals with full analysis, news, and SEC data.'
                    : 'No signals match your current filter criteria. Try adjusting your search or confidence threshold.'}
                </p>
                <div className="flex items-center justify-center space-x-3">
                  {signals.length === 0 && (
                    <Button 
                      onClick={async () => {
                        const popularTickers = ['NVDA', 'TSLA', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NFLX'];
                        await regenerateSignals(popularTickers);
                      }}
                      disabled={isRegenerating}
                      className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${isRegenerating ? 'animate-spin' : ''}`} />
                      {isRegenerating ? 'Regenerating...' : 'Regenerate Signals'}
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setActiveTab('All');
                      setSearchQuery('');
                      setConfidenceFilter(0);
                    }}
                    className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Clear All Filters
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredSignals.map((signal) => (
                <div 
                  key={signal.id}
                  onClick={() => setSelectedSignal(signal)}
                >
                  <SignalCard
                    signal={signal}
                    isWatched={watchedSignals.has(signal.id)}
                    onWatch={(signalId, e) => {
                      e?.stopPropagation();
                      handleWatch(signalId);
                    }}
                    onBacktest={(signalId, e) => {
                      e?.stopPropagation();
                      handleBacktest(signalId);
                    }}
                    onDismiss={(signalId, e) => {
                      e?.stopPropagation();
                      dismissSignal(signalId);
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Signal Detail Modal */}
        {selectedSignal && (
          <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            onClick={() => setSelectedSignal(null)}
          >
            <div 
              className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center overflow-hidden">
                      {selectedSignal.logo ? (
                        <img 
                          src={selectedSignal.logo} 
                          alt={selectedSignal.symbol}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                              parent.innerHTML = `<span class="text-2xl font-bold text-gray-700 dark:text-gray-300">${selectedSignal.symbol.charAt(0)}</span>`;
                            }
                          }}
                        />
                      ) : (
                        <span className="text-2xl font-bold text-gray-700 dark:text-gray-300">
                          {selectedSignal.symbol.charAt(0)}
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{selectedSignal.symbol}</h2>
                        <div className={`w-3 h-3 rounded-full ${
                          selectedSignal.type === 'SEC' ? 'bg-blue-500' :
                          selectedSignal.type === 'INSIDER' ? 'bg-purple-500' :
                          selectedSignal.type === 'NEWS' ? 'bg-green-500' :
                          'bg-orange-500'
                        }`} />
                      </div>
                      <p className="text-lg font-medium text-gray-600 dark:text-gray-400">{selectedSignal.title}</p>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => setSelectedSignal(null)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                <div className="space-y-6">
                  {/* Confidence Badge */}
                  <div className="flex items-center space-x-4">
                    <Badge 
                      className={`px-4 py-2 text-base font-semibold ${
                        selectedSignal.confidence >= 80 ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400' :
                        selectedSignal.confidence >= 60 ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400' :
                        'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                      }`}
                    >
                      {selectedSignal.confidence}% Confidence
                    </Badge>
                    <Badge className="px-4 py-2 text-base font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 uppercase">
                      {selectedSignal.type}
                    </Badge>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {formatDateTime(selectedSignal.createdAt)}
                    </div>
                  </div>

                  {/* Signal Recommendation - Only show for NEWS signals */}
                  {selectedSignal.signal && selectedSignal.type === 'NEWS' && (
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Recommendation</p>
                          <p className={`text-3xl font-bold ${
                            selectedSignal.signal === 'BUY' ? 'text-green-600 dark:text-green-400' :
                            selectedSignal.signal === 'SELL' ? 'text-red-600 dark:text-red-400' :
                            'text-yellow-600 dark:text-yellow-400'
                          }`}>
                            {selectedSignal.signal}
                          </p>
                        </div>
                        {selectedSignal.articlesAnalyzed && selectedSignal.articlesAnalyzed > 0 && (
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Articles Analyzed</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{selectedSignal.articlesAnalyzed}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Insider Transactions - Show detailed transaction info */}
                  {selectedSignal.type === 'INSIDER' && selectedSignal.insiderData && selectedSignal.insiderData.transactions && (
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Insider Transactions</h3>
                      <div className="space-y-4">
                        {selectedSignal.insiderData.transactions
                          .filter((t: any) => t.transaction_type === 'sell')
                          .map((transaction: any, index: number) => (
                            <div key={index} className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2 mb-2">
                                    <p className="font-semibold text-gray-900 dark:text-white">
                                      {transaction.insider_name || 'Unknown Insider'}
                                    </p>
                                    {transaction.insider_title && (
                                      <Badge variant="outline" className="text-xs">
                                        {transaction.insider_title}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-3 gap-4 text-sm">
                                    <div>
                                      <p className="text-gray-500 dark:text-gray-400 mb-1">Shares Sold</p>
                                      <p className="font-semibold text-gray-900 dark:text-white">
                                        {transaction.shares?.toLocaleString() || 'N/A'}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-gray-500 dark:text-gray-400 mb-1">Price per Share</p>
                                      <p className="font-semibold text-gray-900 dark:text-white">
                                        ${transaction.price?.toFixed(2) || 'N/A'}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-gray-500 dark:text-gray-400 mb-1">Total Value</p>
                                      <p className="font-semibold text-red-600 dark:text-red-400">
                                        ${transaction.value?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 'N/A'}
                                      </p>
                                    </div>
                                  </div>
                                  {transaction.transaction_date && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                      Transaction Date: {new Date(transaction.transaction_date).toLocaleDateString()}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        {selectedSignal.insiderData.transactions.filter((t: any) => t.transaction_type === 'sell').length === 0 && (
                          <p className="text-gray-500 dark:text-gray-400 text-center py-4">No sell transactions found</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Institutional Holdings - Show detailed fund information */}
                  {selectedSignal.type === 'SEC' && selectedSignal.institutionalData && selectedSignal.institutionalData.holdings && (
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Institutional Holdings</h3>
                      <div className="space-y-4">
                        {selectedSignal.institutionalData.holdings
                          .slice(0, 10) // Show top 10 institutions
                          .map((holding: any, index: number) => (
                            <div key={index} className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2 mb-2">
                                    <p className="font-semibold text-gray-900 dark:text-white">
                                      {holding.fund_name || 'Unknown Institution'}
                                    </p>
                                    {holding.investment_discretion && (
                                      <Badge variant="outline" className="text-xs">
                                        {holding.investment_discretion}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-3 gap-4 text-sm">
                                    <div>
                                      <p className="text-gray-500 dark:text-gray-400 mb-1">Shares Held</p>
                                      <p className="font-semibold text-gray-900 dark:text-white">
                                        {holding.shares?.toLocaleString() || 'N/A'}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-gray-500 dark:text-gray-400 mb-1">Total Value</p>
                                      <p className="font-semibold text-green-600 dark:text-green-400">
                                        ${holding.value ? (holding.value / 1000).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + 'K' : 'N/A'}
                                        {holding.value && holding.value >= 1000000 && ` ($${(holding.value / 1000000).toFixed(2)}M)`}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-gray-500 dark:text-gray-400 mb-1">Report Period</p>
                                      <p className="font-semibold text-gray-900 dark:text-white text-xs">
                                        {holding.period_of_report ? (() => {
                                          try {
                                            const date = new Date(holding.period_of_report);
                                            if (isNaN(date.getTime())) {
                                              return holding.period_of_report;
                                            }
                                            // Format as MM/DD/YYYY to match SEC.gov format
                                            return date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
                                          } catch {
                                            return holding.period_of_report;
                                          }
                                        })() : 'N/A'}
                                      </p>
                                    </div>
                                  </div>
                                  {holding.filing_date && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                      Filed: {(() => {
                                        try {
                                          const date = new Date(holding.filing_date);
                                          if (isNaN(date.getTime())) {
                                            return holding.filing_date;
                                          }
                                          // Format as MM/DD/YYYY to match SEC.gov format
                                          return date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
                                        } catch {
                                          return holding.filing_date;
                                        }
                                      })()}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        {selectedSignal.institutionalData.holdings.length === 0 && (
                          <p className="text-gray-500 dark:text-gray-400 text-center py-4">No institutional holdings found</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Key Points */}
                  {selectedSignal.keyPoints && selectedSignal.keyPoints.length > 0 && (
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Key Points</h3>
                      <ul className="space-y-2">
                        {selectedSignal.keyPoints.map((point, index) => (
                          <li key={index} className="flex items-start space-x-3">
                            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{point}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Detailed Rationale */}
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Detailed Analysis</h3>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                      {selectedSignal.rationale}
                    </p>
                  </div>

                  {/* Sentiment Analysis */}
                  {selectedSignal.sentimentAnalysis && (
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Sentiment Analysis</h3>
                      <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                        {selectedSignal.sentimentAnalysis}
                      </p>
                    </div>
                  )}

                  {/* Additional Details */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Signal Type</p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white capitalize">{selectedSignal.type.toLowerCase()}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Risk Level</p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        {selectedSignal.riskLevel || (selectedSignal.confidence >= 80 ? 'Low' : selectedSignal.confidence >= 60 ? 'Medium' : 'High')}
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <Button
                      variant={watchedSignals.has(selectedSignal.id) ? "default" : "outline"}
                      onClick={() => {
                        handleWatch(selectedSignal.id);
                      }}
                      className={watchedSignals.has(selectedSignal.id) 
                        ? 'bg-blue-600 text-white hover:bg-blue-700' 
                        : ''}
                    >
                      <Star className={`h-4 w-4 mr-2 ${watchedSignals.has(selectedSignal.id) ? 'fill-current' : ''}`} />
                      {watchedSignals.has(selectedSignal.id) ? 'Watching' : 'Watch'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        handleBacktest(selectedSignal.id);
                        setSelectedSignal(null);
                      }}
                    >
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Backtest
                    </Button>
                    <Button
                      variant="default"
                      onClick={() => {
                        navigate(`/stock/${selectedSignal.symbol}`);
                        setSelectedSignal(null);
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      View Stock Details
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create Alert Modal */}
        {showCreateAlert && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-md">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                      <Bell className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create Alert</h2>
                  </div>
                </div>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Stock Symbols
                    </label>
                    <Input 
                      placeholder="AAPL, NVDA, TSLA" 
                      className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Separate multiple symbols with commas
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Signal Type
                    </label>
                    <select className="w-full h-10 px-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white">
                      <option value="TECH">Technical Analysis</option>
                      <option value="SEC">SEC Filings</option>
                      <option value="INSIDER">Insider Trading</option>
                      <option value="NEWS">News Events</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Confidence Threshold: 75%
                    </label>
                    <input
                      type="range"
                      min="50"
                      max="95"
                      defaultValue="75"
                      className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                    />
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                      <span>50%</span>
                      <span>95%</span>
                    </div>
                  </div>
                  
                  <div className="flex justify-end space-x-3 pt-4">
                    <Button 
                      variant="outline" 
                      onClick={() => setShowCreateAlert(false)}
                      className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleCreateAlert}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      Create Alert
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Floating Toast Notification */}
      {toast && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
          <div
            className={`px-6 py-4 rounded-lg shadow-2xl backdrop-blur-sm pointer-events-auto transform transition-all duration-300 ${
              toast.type === 'success'
                ? 'bg-green-500/90 text-white border-2 border-green-400'
                : 'bg-red-500/90 text-white border-2 border-red-400'
            }`}
          >
            <div className="flex items-center gap-3">
              {toast.type === 'success' ? (
                <CheckCircle className="w-6 h-6" />
              ) : (
                <AlertTriangle className="w-6 h-6" />
              )}
              <span className="font-semibold text-lg">{toast.message}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
