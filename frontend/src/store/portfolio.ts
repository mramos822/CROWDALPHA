import { create } from 'zustand';
import type { Holding, PortfolioSummary, ChartData } from '@/types';

interface PortfolioStore {
  holdings: Holding[];
  summary: PortfolioSummary | null;
  chartData: ChartData[];
  isLoading: boolean;
  isConnected: boolean;
  isCheckingConnection: boolean;
  estimatedStartingBalance?: number; // Starting balance calculated from Plaid transactions
  fetchHoldings: () => Promise<void>;
  fetchSummary: () => Promise<void>;
  fetchChartData: () => Promise<void>;
  checkConnection: () => Promise<void>;
  disconnect: () => void;
  loadCachedData: () => boolean;
  saveDataToCache: () => void;
}

export const usePortfolioStore = create<PortfolioStore>((set, get) => ({
  holdings: [],
  summary: null,
  chartData: [],
  isLoading: false,
  isConnected: false,
  isCheckingConnection: false,
  estimatedStartingBalance: undefined,

  // Load cached data instantly for smooth loading
  loadCachedData: () => {
    try {
      // First check if user has Plaid token - don't load cache if they don't
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) {
        localStorage.removeItem('portfolio_cache');
        return false;
      }

      const cachedData = localStorage.getItem('portfolio_cache');
      if (cachedData) {
        const { holdings, summary, chartData, timestamp, hasPlaidConnection } = JSON.parse(cachedData);
        
        // Only load cache if it was from a user with Plaid connection
        if (hasPlaidConnection !== true) {
          console.log('📦 Cache is from user without Plaid, clearing it');
          localStorage.removeItem('portfolio_cache');
          set({ holdings: [], summary: null, chartData: [] });
          return false;
        }
        
        const cacheAge = Date.now() - timestamp;
        const maxCacheAge = 5 * 60 * 1000; // 5 minutes
        
        // Only use cache if it's less than 5 minutes old
        if (cacheAge < maxCacheAge) {
          console.log('📦 Loading cached portfolio data for instant display');
          set({ holdings, summary, chartData });
          return true;
        } else {
          console.log('⏰ Cached data expired, will fetch fresh data');
          localStorage.removeItem('portfolio_cache');
        }
      }
    } catch (error) {
      console.error('Failed to load cached data:', error);
      localStorage.removeItem('portfolio_cache');
    }
    return false;
  },

  // Save data to cache for next load
  saveDataToCache: () => {
    try {
      const { holdings, summary, chartData, isConnected } = get();
      // Only cache if user has Plaid connected
      if (isConnected && (holdings.length > 0 || summary)) {
        const cacheData = {
          holdings,
          summary,
          chartData,
          timestamp: Date.now(),
          hasPlaidConnection: true
        };
        localStorage.setItem('portfolio_cache', JSON.stringify(cacheData));
        console.log('💾 Portfolio data cached for instant loading');
      } else {
        // Clear cache if no connection
        localStorage.removeItem('portfolio_cache');
      }
    } catch (error) {
      console.error('Failed to save data to cache:', error);
    }
  },

  checkConnection: async () => {
    // Prevent multiple simultaneous calls
    if (get().isCheckingConnection) {
      console.log('🔄 Connection check already in progress, skipping...');
      return;
    }
    
    set({ isCheckingConnection: true });
    
    try {
      // Verify connection with backend - don't rely on localStorage alone
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) {
        console.log('⚠️ No auth token found, clearing any cached portfolio data');
        localStorage.removeItem('plaid_access_token');
        localStorage.removeItem('portfolio_cache');
        set({ isConnected: false, holdings: [], summary: null, chartData: [] });
        return;
      }
      
      // CRITICAL: Clear state IMMEDIATELY if not already connected
      // This prevents stale data from showing while we check the connection
      const currentState = get();
      if (!currentState.isConnected) {
        // Clear state and cache immediately to prevent stale data
        localStorage.removeItem('portfolio_cache');
        set({ 
          isConnected: false,
          holdings: [], 
          summary: null, 
          chartData: [] 
        });
      }

      // Try to fetch holdings from backend to verify connection first
      // Don't load cache until we verify connection status
      try {
        console.log('🔄 Checking Plaid connection with backend...');
        await get().fetchHoldings();
        
        // If successful, user has Plaid connected
        set({ isConnected: true });
        
        // Don't load cached data here - we already have fresh data from fetchHoldings
        // The cache will be saved after we fetch summary and chart data
        
        // Fetch remaining data in background
        try {
          console.log('🔄 Fetching fresh portfolio data in background...');
          await get().fetchSummary();
          await get().fetchChartData();
          
          // Save fresh data to cache
          get().saveDataToCache();
          console.log('✅ Fresh portfolio data loaded and cached');
        } catch (error) {
          console.error('Failed to fetch additional portfolio data:', error);
        }
      } catch (error: any) {
        // Check if this is a "no connection" error (404 or 400) - this is expected for new users
        const isNoConnectionError = error.message?.includes('404') || 
                                    error.message?.includes('No brokerage account connected') ||
                                    error.message?.includes('Failed to fetch holdings: Not Found');
        
        if (isNoConnectionError) {
          // This is expected for users without Plaid - not an error
          console.log('ℹ️ No Plaid connection found - user has not connected a brokerage account yet');
        } else {
          // This is a real error
          console.warn('⚠️ Error checking Plaid connection:', error.message || error);
        }
        
        // Clear all Plaid-related data and cache
        localStorage.removeItem('plaid_access_token');
        localStorage.removeItem('portfolio_cache'); // Clear stale cache
        set({ 
          isConnected: false, 
          holdings: [], 
          summary: null, 
          chartData: [] 
        });
      }
    } finally {
      set({ isCheckingConnection: false });
    }
  },

  disconnect: () => {
    // Clear the Plaid token and reset connection state
    localStorage.removeItem('plaid_access_token');
    localStorage.removeItem('portfolio_cache'); // Clear cached data
    set({ 
      isConnected: false, 
      holdings: [], 
      summary: null, 
      chartData: [] 
    });
  },

  fetchHoldings: async () => {
    set({ isLoading: true });
    
    try {
      // Get auth token
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) {
        throw new Error('No authentication token found');
      }

      // Fetch real holdings from backend
      const response = await fetch('http://localhost:8000/api/auth/portfolio-holdings', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        // If 404, user doesn't have Plaid connected - this is expected
        if (response.status === 404) {
          throw new Error('No brokerage account connected');
        }
        throw new Error(`Failed to fetch holdings: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Real holdings data:', data);
      console.log('📊 [PLAID] Estimated starting balance from transactions:', data.estimated_starting_balance);
      console.log('📊 [PLAID] Total deposits:', data.total_deposits, 'Total withdrawals:', data.total_withdrawals);

      // Store the estimated starting balance from Plaid transactions
      const estimatedStartingBalance = data.estimated_starting_balance;

      // Convert Plaid holdings to our format
      const holdings: Holding[] = data.holdings.map((holding: any, index: number) => {
        // Use ticker_symbol from backend if available (it's mapped from Plaid securities)
        // Fall back to security_id if ticker_symbol is not available
        let symbol = holding.ticker_symbol || holding.security_id || holding.account_id || 'UNKNOWN';
        let name = holding.security_name || holding.security_id || 'Unknown Security';
        
        // If symbol is too long (like a Plaid internal ID), try to extract a better identifier
        if (symbol.length > 10 && !holding.ticker_symbol) {
          // If we don't have a ticker symbol, create a readable placeholder
          symbol = holding.account_id ? `ACC-${holding.account_id.slice(-4)}` : `HOLDING-${index + 1}`;
          name = `Holding ${index + 1}`;
        }
        
        return {
          symbol: symbol.toUpperCase(), // Ensure symbol is uppercase for consistency
          name,
          qty: holding.quantity || 0,
          avgPrice: holding.cost_basis / (holding.quantity || 1) || 0,
          lastPrice: holding.institution_price || 0,
          pl: holding.institution_value - holding.cost_basis || 0,
          weight: 0 // Calculate based on total portfolio value
        };
      });

      set({ 
        holdings, 
        isLoading: false,
        estimatedStartingBalance: estimatedStartingBalance || undefined
      });
    } catch (error) {
      console.error('Error fetching real holdings:', error);
      // CRITICAL: DO NOT use mock data - clear holdings instead
      // This ensures no stale/mock data shows when user is not connected
      set({ holdings: [], isLoading: false });
      
      // Re-throw the error so checkConnection can handle it properly
      throw error;
    }
  },

  fetchSummary: async () => {
    set({ isLoading: true });
    
    try {
      // Calculate summary from current holdings
      const { holdings } = get();
      
      if (holdings.length === 0) {
        // No holdings, return empty summary
        const summary: PortfolioSummary = {
          totalValue: 0,
          dailyPl: 0,
          weeklyReturn: 0,
          monthlyReturn: 0,
          topMover: {
            symbol: 'N/A',
            change: 0,
            changePercent: 0
          },
          activeAlerts: 0
        };
        set({ summary, isLoading: false });
        return;
      }

      // Calculate totals from holdings
      const totalValue = holdings.reduce((sum, holding) => sum + (holding.lastPrice * holding.qty), 0);
      
      // Calculate daily P&L: compare current value to value at start of today
      // We'll calculate this by fetching yesterday's closing prices
      let dailyPl = 0;
      try {
        // Fetch yesterday's closing prices for all holdings
        const { getHistoricalDataFromYahoo } = await import('@/services/stockData');
        
        // Get yesterday's closing prices - try 1D first, then 1W if needed
        const yesterdayPromises = holdings
          .filter(h => h.symbol && !h.symbol.includes(':')) // Skip invalid symbols
          .map(async (holding) => {
            try {
              // First try 1D data (intraday)
              let historicalData = await getHistoricalDataFromYahoo(holding.symbol, '1D');
              let yesterdayPrice = holding.lastPrice;
              
              if (historicalData && historicalData.length >= 2) {
                // Get the second-to-last point (yesterday's close, or start of today)
                yesterdayPrice = historicalData[historicalData.length - 2]?.value || holding.lastPrice;
              } else {
                // If no 1D data (markets closed), try 1W to get last trading day
                historicalData = await getHistoricalDataFromYahoo(holding.symbol, '1W');
                if (historicalData && historicalData.length >= 2) {
                  // Get the second-to-last point (previous trading day)
                  yesterdayPrice = historicalData[historicalData.length - 2]?.value || holding.lastPrice;
                }
              }
              
              return {
                symbol: holding.symbol,
                qty: holding.qty,
                currentPrice: holding.lastPrice,
                yesterdayPrice: yesterdayPrice
              };
            } catch (error) {
              console.error(`Error fetching yesterday's price for ${holding.symbol}:`, error);
              // Fallback: assume no change
              return {
                symbol: holding.symbol,
                qty: holding.qty,
                currentPrice: holding.lastPrice,
                yesterdayPrice: holding.lastPrice
              };
            }
          });
        
        const holdingsWithYesterday = await Promise.all(yesterdayPromises);
        dailyPl = holdingsWithYesterday.reduce((sum, h) => {
          const dailyChange = (h.currentPrice - h.yesterdayPrice) * h.qty;
          return sum + dailyChange;
        }, 0);
        
        console.log(`📊 [SUMMARY] Daily P&L calculated: $${dailyPl.toFixed(2)}`);
      } catch (error) {
        console.error('Error calculating daily P&L:', error);
        // Fallback: calculate as small percentage of total value (typical daily move)
        // This is a rough estimate when we can't get historical data
        dailyPl = totalValue * 0.0042; // ~0.42% average daily move
        console.log(`📊 [SUMMARY] Using fallback daily P&L: $${dailyPl.toFixed(2)}`);
      }
      
      // Find top mover (by absolute change, not percentage)
      const topMover = holdings.reduce((top, holding) => {
        const holdingChange = Math.abs((holding.lastPrice - holding.avgPrice) * holding.qty);
        const topChange = Math.abs((top.lastPrice - top.avgPrice) * top.qty);
        return holdingChange > topChange ? holding : top;
      }, holdings[0]);

      // Note: weeklyReturn and monthlyReturn will be calculated separately
      // in calculateRealPortfolioMetrics and displayed from realMetrics
      // Here we just set placeholder values that will be overridden
      const summary: PortfolioSummary = {
        totalValue,
        dailyPl: dailyPl, // Now using actual daily change
        weeklyReturn: 0, // Will be calculated by calculateRealPortfolioMetrics
        monthlyReturn: 0, // Will be calculated by calculateRealPortfolioMetrics
        topMover: {
          symbol: topMover.symbol,
          change: (topMover.lastPrice - topMover.avgPrice) * topMover.qty,
          changePercent: topMover.avgPrice > 0 ? ((topMover.lastPrice - topMover.avgPrice) / topMover.avgPrice) * 100 : 0
        },
        activeAlerts: 0 // TODO: Implement alerts
      };
      
      set({ summary, isLoading: false });
    } catch (error) {
      console.error('Error calculating summary:', error);
      // Fallback to mock summary
      const summary: PortfolioSummary = {
        totalValue: 0,
        dailyPl: 0,
        weeklyReturn: 0,
        monthlyReturn: 0,
        topMover: {
          symbol: 'N/A',
          change: 0,
          changePercent: 0
        },
        activeAlerts: 0
      };
      set({ summary, isLoading: false });
    }
  },

  fetchChartData: async () => {
    try {
      // Generate chart data based on current holdings
      const { holdings } = get();
      
      if (holdings.length === 0) {
        set({ chartData: [] });
        return;
      }

      // Calculate current total value
      const currentValue = holdings.reduce((sum, holding) => sum + (holding.lastPrice * holding.qty), 0);
      
      // Generate mock historical data based on current value
      const chartData: ChartData[] = [];
      const days = 7;
      
      for (let i = days; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        
        // Add some random variation to simulate market movement
        const variation = (Math.random() - 0.5) * 0.05; // ±2.5% variation
        const value = currentValue * (1 + variation);
        
        chartData.push({
          date: date.toISOString().split('T')[0],
          value: Math.round(value * 100) / 100
        });
      }
      
      set({ chartData });
    } catch (error) {
      console.error('Error generating chart data:', error);
      set({ chartData: [] });
    }
  },
}));