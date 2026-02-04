import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePortfolioStore } from "@/store/portfolio";
import { useUiStore } from "@/store/ui";
import { StockSearch } from "@/components/StockSearch";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { PlaidLink } from "@/components/PlaidLink";
import type { PlaidLinkHandle } from "@/components/PlaidLink";
import { plaidService } from "@/services/plaid";
import { 
  TrendingUp, 
  TrendingDown, 
  Shield, 
  Newspaper, 
  ChevronDown,
  LinkIcon,
  Loader2
} from "lucide-react";

export function PortfolioPage() {
  const { holdings, summary, isConnected, fetchHoldings, fetchSummary, checkConnection } = usePortfolioStore();
  const { setLoading } = useUiStore();
  const navigate = useNavigate();
  
  // Plaid connection state
  const [linkToken, setLinkToken] = useState('');
  const [isCreatingLinkToken, setIsCreatingLinkToken] = useState(false);
  const [plaidError, setPlaidError] = useState('');
  const plaidRef = useRef<PlaidLinkHandle>(null);

  // State for real metrics (weekly/monthly returns)
  const [realMetrics, setRealMetrics] = useState({
    weeklyReturn: 0,
    monthlyReturn: 0
  });

  // Handle stock selection
  const handleStockSelect = (stock: any) => {
    console.log('Selected stock:', stock);
    navigate(`/stock/${stock.symbol}`);
  };

  // Handle add to watchlist
  const handleAddToWatchlist = (stock: any) => {
    console.log('Added to watchlist:', stock);
    alert(`Added ${stock.symbol} to your watchlist!`);
  };

  // Fetch Plaid link token
  const fetchLinkToken = async () => {
    try {
      setIsCreatingLinkToken(true);
      setPlaidError('');
      
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) {
        setPlaidError('Please log in first');
        return;
      }

      const response = await plaidService.createLinkToken();
      setLinkToken(response.link_token);
    } catch (err) {
      console.error('Failed to get link token:', err);
      setPlaidError(err instanceof Error ? err.message : 'Failed to initialize brokerage connection');
    } finally {
      setIsCreatingLinkToken(false);
    }
  };

  // Handle successful Plaid connection
  const handlePlaidSuccess = async (publicToken: string) => {
    try {
      setIsCreatingLinkToken(true);
      setPlaidError('');
      
      const response = await plaidService.exchangePublicToken(publicToken);
      localStorage.setItem('plaid_access_token', response.access_token);
      
      // Re-check connection to refresh data
      await checkConnection();
      
      // Refresh the page or reload data
      window.location.reload();
    } catch (err) {
      console.error('Failed to connect Plaid:', err);
      setPlaidError(err instanceof Error ? err.message : 'Failed to connect brokerage account');
    } finally {
      setIsCreatingLinkToken(false);
    }
  };

  // Handle connect button click
  const handleConnectClick = async () => {
    if (!linkToken) {
      // Fetch token first
      await fetchLinkToken();
    } else if (plaidRef.current?.ready) {
      // If token exists and component is ready, open immediately
      console.log('🔓 [PLAID] Opening Plaid Link modal from button click...');
      plaidRef.current.open();
    } else {
      // Token exists but not ready yet, check again after a short delay
      console.log('⏳ [PLAID] Waiting for Plaid to be ready...');
      const checkReady = setInterval(() => {
        if (plaidRef.current?.ready) {
          console.log('🔓 [PLAID] Plaid is now ready, opening modal...');
          plaidRef.current.open();
          clearInterval(checkReady);
        }
      }, 100);
      
      // Stop checking after 5 seconds
      setTimeout(() => clearInterval(checkReady), 5000);
    }
  };
  

  // Calculate real portfolio metrics (weekly/monthly returns)
  const calculateRealPortfolioMetrics = async () => {
    if (!isConnected || !holdings || holdings.length === 0) {
      setRealMetrics({ weeklyReturn: 0, monthlyReturn: 0 });
      return;
    }

    try {
      const { getHistoricalDataFromYahoo } = await import('@/services/stockData');
      
      // Fetch historical prices for all holdings
      const holdingPromises = holdings
        .filter(h => h.symbol && !h.symbol.includes(':'))
        .map(async (holding) => {
          try {
            const [weeklyData, monthlyData] = await Promise.all([
              getHistoricalDataFromYahoo(holding.symbol, '1W'),
              getHistoricalDataFromYahoo(holding.symbol, '1M')
            ]);
            
            return {
              ...holding,
              price1WeekAgo: weeklyData && weeklyData.length >= 2 
                ? weeklyData[weeklyData.length - 2]?.value || holding.lastPrice
                : holding.lastPrice,
              price1MonthAgo: monthlyData && monthlyData.length >= 2
                ? monthlyData[monthlyData.length - 2]?.value || holding.lastPrice
                : holding.lastPrice
            };
          } catch (error) {
            console.error(`Error fetching historical data for ${holding.symbol}:`, error);
            return {
              ...holding,
              price1WeekAgo: holding.lastPrice,
              price1MonthAgo: holding.lastPrice
            };
          }
        });
      
      const holdingsWithHistory = await Promise.all(holdingPromises);
      
      // Calculate current portfolio value
      const currentValue = holdings.reduce((sum, h) => sum + (h.qty * h.lastPrice), 0);
      
      // Calculate portfolio value 1 week ago
      const value1WeekAgo = holdingsWithHistory.reduce((sum, h) => {
        return sum + (h.qty * h.price1WeekAgo);
      }, 0);
      
      // Calculate portfolio value 1 month ago
      const value1MonthAgo = holdingsWithHistory.reduce((sum, h) => {
        return sum + (h.qty * h.price1MonthAgo);
      }, 0);
      
      // Calculate returns
      const weeklyReturn = value1WeekAgo > 0 ? ((currentValue - value1WeekAgo) / value1WeekAgo) * 100 : 0;
      const monthlyReturn = value1MonthAgo > 0 ? ((currentValue - value1MonthAgo) / value1MonthAgo) * 100 : 0;
      
      setRealMetrics({ weeklyReturn, monthlyReturn });
    } catch (error) {
      console.error('Error calculating portfolio metrics:', error);
      setRealMetrics({ weeklyReturn: 0, monthlyReturn: 0 });
    }
  };

  useEffect(() => {
    const loadData = async () => {
      // First check connection status
      await checkConnection();
      
      // Get updated connection status after check
      const { isConnected: currentIsConnected } = usePortfolioStore.getState();
      
      // Only fetch data if connected
      if (currentIsConnected) {
        try {
          setLoading(true);
          await Promise.all([
            fetchHoldings(),
            fetchSummary()
          ]);
        } catch (error) {
          console.error('Failed to load portfolio data:', error);
          // Error handling is done in checkConnection
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    loadData();
  }, [checkConnection, fetchHoldings, fetchSummary, setLoading]);

  // Calculate real metrics when holdings change
  useEffect(() => {
    if (isConnected && holdings && holdings.length > 0) {
      calculateRealPortfolioMetrics();
    } else {
      setRealMetrics({ weeklyReturn: 0, monthlyReturn: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, holdings]);
  
  // Auto-open Plaid modal when link token is ready
  useEffect(() => {
    if (linkToken && plaidRef.current?.ready) {
      // Small delay to ensure the modal can render
      const timer = setTimeout(() => {
        if (plaidRef.current?.ready) {
          console.log('🔓 [PLAID] Opening Plaid Link modal...');
          plaidRef.current.open();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [linkToken, plaidRef.current?.ready]);

  // Show connect prompt if not connected
  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl mb-2">Connect Your Brokerage Account</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                <LinkIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <p className="text-muted-foreground">
              Link your brokerage account to view your portfolio holdings, track performance, and get real-time insights.
            </p>
            <p className="text-sm text-muted-foreground">
              We support 11,000+ financial institutions including Robinhood, TD Ameritrade, E*TRADE, and more.
            </p>
            <div className="space-y-2">
              <Button
                onClick={handleConnectClick}
                disabled={isCreatingLinkToken || !!(linkToken && !plaidRef.current?.ready)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isCreatingLinkToken ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <LinkIcon className="h-4 w-4 mr-2" />
                    Connect Account
                  </>
                )}
              </Button>
              {plaidError && (
                <p className="text-sm text-red-600 dark:text-red-400">{plaidError}</p>
              )}
            </div>
            {linkToken && (
              <PlaidLink
                ref={plaidRef}
                linkToken={linkToken}
                onSuccess={handlePlaidSuccess}
                onError={(error) => setPlaidError(error)}
                onReady={() => {
                  console.log('🎯 [PLAID] onReady callback triggered! ready:', plaidRef.current?.ready);
                  // Auto-open when ready - use a longer timeout to ensure everything is initialized
                  setTimeout(() => {
                    if (plaidRef.current) {
                      console.log('🔓 [PLAID] Attempting to open Plaid modal, ready:', plaidRef.current.ready);
                      if (plaidRef.current.ready) {
                        try {
                          plaidRef.current.open();
                          console.log('✅ [PLAID] Successfully called open()');
                        } catch (error) {
                          console.error('❌ [PLAID] Error calling open():', error);
                        }
                      } else {
                        console.warn('⚠️ [PLAID] Plaid is not ready yet, will retry...');
                        // Retry after another short delay
                        setTimeout(() => {
                          if (plaidRef.current?.ready) {
                            console.log('🔓 [PLAID] Retry: Opening Plaid modal');
                            plaidRef.current.open();
                          }
                        }, 500);
                      }
                    }
                  }, 300);
                }}
              />
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show loading only if we're connected but data is still loading
  if (isConnected && (!holdings.length || !summary)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading portfolio...</p>
        </div>
      </div>
    );
  }

  // Type guard: Ensure summary exists before rendering portfolio
  if (!summary) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading portfolio...</p>
        </div>
      </div>
    );
  }

  // Use daily P&L from summary (calculated from yesterday's prices)
  // Fallback to total P&L if daily P&L is not available
  const dailyPl = summary?.dailyPl ?? holdings.reduce((sum, holding) => sum + holding.pl, 0);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Portfolio</h1>
              <p className="text-lg text-gray-600 dark:text-gray-300">
                Track your investments and performance.
              </p>
            </div>
            
            {/* Stock Search */}
            <div className="w-full lg:w-96">
              <StockSearch 
                onStockSelect={handleStockSelect}
                onAddToWatchlist={handleAddToWatchlist}
              />
            </div>
          </div>
        </div>

        {/* Portfolio Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white dark:bg-gray-800 border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                  Total Value
                </h3>
              </div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(summary.totalValue)}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                  Total P/L
                </h3>
                <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <div className={`text-3xl font-bold mb-1 ${dailyPl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(dailyPl)}
              </div>
              <div className={`text-sm font-medium ${dailyPl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {dailyPl >= 0 ? '+' : ''}{formatCurrency(dailyPl)}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                  1W Performance
                </h3>
              </div>
              <div className={`text-3xl font-bold ${realMetrics.weeklyReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {realMetrics.weeklyReturn >= 0 ? '+' : ''}{formatPercent(realMetrics.weeklyReturn)}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                  1M Performance
                </h3>
              </div>
              <div className={`text-3xl font-bold ${realMetrics.monthlyReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {realMetrics.monthlyReturn >= 0 ? '+' : ''}{formatPercent(realMetrics.monthlyReturn)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Holdings Section */}
          <div className="lg:col-span-3">
            <Card className="bg-white dark:bg-gray-800 border-0 shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white">
                  Holdings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {holdings.map((holding) => {
                  const plPercent = ((holding.lastPrice - holding.avgPrice) / holding.avgPrice) * 100;
                  const isPositive = holding.pl >= 0;
                  
                  return (
                    <div key={holding.symbol} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                      <div className="flex items-center space-x-4">
                        <div>
                          <div className="font-semibold text-gray-900 dark:text-white">{holding.symbol}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">{holding.name}</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-8">
                        <div className="text-right">
                          <div className="font-semibold text-gray-900 dark:text-white">{formatCurrency(holding.lastPrice)}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {holding.qty} shares
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className={`font-semibold ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {formatCurrency(holding.pl)}
                          </div>
                          <div className={`text-sm flex items-center justify-end ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {isPositive ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                            {formatPercent(plPercent)}
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <Badge variant="secondary" className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200">
                            {formatPercent(holding.weight)}
                          </Badge>
                        </div>
                        
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Position Risk */}
            <Card className="bg-white dark:bg-gray-800 border-0 shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center space-x-2 text-lg font-semibold text-gray-900 dark:text-white">
                  <Shield className="h-5 w-5" />
                  <span>Position Risk</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Low Risk</span>
                    <span className="font-medium text-gray-900 dark:text-white">35%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full transition-all duration-300" style={{ width: '35%' }}></div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Medium Risk</span>
                    <span className="font-medium text-gray-900 dark:text-white">45%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div className="bg-yellow-500 h-2 rounded-full transition-all duration-300" style={{ width: '45%' }}></div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">High Risk</span>
                    <span className="font-medium text-gray-900 dark:text-white">20%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div className="bg-red-500 h-2 rounded-full transition-all duration-300" style={{ width: '20%' }}></div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* News Highlights */}
            <Card className="bg-white dark:bg-gray-800 border-0 shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center space-x-2 text-lg font-semibold text-gray-900 dark:text-white">
                  <Newspaper className="h-5 w-5" />
                  <span>News Highlights</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-l-4 border-green-500 pl-3 py-2">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">AAPL beats earnings</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">2 hours ago</div>
                </div>
                
                <div className="border-l-4 border-blue-500 pl-3 py-2">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">NVDA partnership news</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">4 hours ago</div>
                </div>
                
                <div className="border-l-4 border-red-500 pl-3 py-2">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">AMD guidance update</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">6 hours ago</div>
                </div>
              </CardContent>
            </Card>

            {/* Performance */}
            <Card className="bg-white dark:bg-gray-800 border-0 shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Today</span>
                  <div className="flex items-center space-x-1">
                    <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <span className="text-sm font-medium text-green-600 dark:text-green-400">
                      {formatCurrency(summary.dailyPl)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
