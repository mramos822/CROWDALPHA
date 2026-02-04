import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getStockQuote, clearCache } from "@/services/stockData";
import { 
  ArrowLeft, 
  TrendingUp, 
  TrendingDown, 
  Star,
  BarChart3,
  Bell,
  Share2,
  Plus,
  Minus,
  Activity,
  Users,
  DollarSign,
  Calendar,
  Target,
  Zap,
  Shield,
  AlertTriangle,
  Loader2,
  RefreshCw,
  X,
  RotateCw
} from "lucide-react";
import RobinhoodChart from '@/components/charts/RobinhoodChart';
import type { Candle } from '@/components/charts/RobinhoodChart';
import { generateDataForTimeRange } from '@/services/chartData';
import { getHistoricalDataFromYahoo } from '@/services/stockData';
import { useSignalsStore } from '@/store/signals';
import { formatDate, formatDateTime } from '@/lib/utils';

interface StockData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  pe: number;
  sector: string;
  industry: string;
  description: string;
  employees: number;
  headquarters: string;
  founded: string;
  website: string;
  logo?: string;
}

interface AISignal {
  id: string;
  signal_id?: string;
  type: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'SEC' | 'INSIDER' | 'NEWS';
  confidence: number;
  title: string;
  description: string;
  rationale?: string;
  source: 'TECHNICAL' | 'FUNDAMENTAL' | 'SENTIMENT' | 'INSIDER' | 'SEC' | 'NEWS';
  timestamp: string;
  created_timestamp?: string;
  ticker?: string;
  signal?: string; // BUY/SELL/HOLD
  keyPoints?: string[];
}

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  timestamp: string;
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  url?: string;
}

// Helper function to check if market is currently open (9:30 AM - 4:00 PM ET, Mon-Fri)
function isMarketOpen(): { isOpen: boolean; status: 'open' | 'closed' | 'pre-market' | 'after-hours' } {
  const now = new Date();
  const etDateParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'long'
  }).formatToParts(now);
  
  const dayOfWeek = etDateParts.find(p => p.type === 'weekday')?.value || '';
  const hour = parseInt(etDateParts.find(p => p.type === 'hour')?.value || '0');
  const minute = parseInt(etDateParts.find(p => p.type === 'minute')?.value || '0');
  const totalMinutes = hour * 60 + minute;
  
  // Market is closed on weekends
  if (dayOfWeek === 'Saturday' || dayOfWeek === 'Sunday') {
    return { isOpen: false, status: 'closed' };
  }
  
  // Market hours: 9:30 AM - 4:00 PM ET
  const marketOpen = 9 * 60 + 30; // 9:30 AM = 570 minutes
  const marketClose = 16 * 60; // 4:00 PM = 960 minutes
  
  if (totalMinutes >= marketOpen && totalMinutes < marketClose) {
    return { isOpen: true, status: 'open' };
  } else if (totalMinutes < marketOpen) {
    return { isOpen: false, status: 'pre-market' };
  } else {
    return { isOpen: false, status: 'after-hours' };
  }
}

export function StockDetailPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const { generateSignal } = useSignalsStore();
  const [stockData, setStockData] = useState<StockData | null>(null);
  const [aiSignals, setAiSignals] = useState<AISignal[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoadingSignals, setIsLoadingSignals] = useState(false);
  const [isGeneratingSignal, setIsGeneratingSignal] = useState(false);
  const [isLoadingNews, setIsLoadingNews] = useState(false);
  const [selectedSignal, setSelectedSignal] = useState<AISignal | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    // Get saved period from localStorage or default to 1D
    const saved = localStorage.getItem(`chart-period-${symbol}`);
    return saved || '1D';
  });
  const [isLoading, setIsLoading] = useState(true);
  const [chartData, setChartData] = useState<Candle[]>([]);
  const [animatedPrice, setAnimatedPrice] = useState<number>(0);
  // Get last candle's close price for header
  const lastCandlePrice = chartData.length > 0 ? (chartData[chartData.length - 1]?.close || 0) : (stockData?.price || 0);
  // Get first candle's open price (or previous day's close) for change calculation
  const firstCandlePrice = chartData.length > 0 ? (chartData[0]?.open || chartData[0]?.close || lastCandlePrice) : (stockData?.price || 0);
  const [isPriceAnimating, setIsPriceAnimating] = useState(false);
  const [isRefreshingChart, setIsRefreshingChart] = useState(false);
  const [marketStatus, setMarketStatus] = useState<{ isOpen: boolean; status: 'open' | 'closed' | 'pre-market' | 'after-hours' }>(() => isMarketOpen());
  
  // Read global auto-polling setting (controlled from Dashboard)
  const getAutoPolling = () => {
    const saved = localStorage.getItem('auto-polling-enabled');
    return saved !== null ? saved === 'true' : true; // Default to enabled
  };

  // Animate price changes
  useEffect(() => {
    if (stockData) {
      const targetPrice = stockData.price;
      if (animatedPrice === 0) {
        // Initial load
        setAnimatedPrice(targetPrice);
      } else if (Math.abs(animatedPrice - targetPrice) > 0.01) {
        // Price changed significantly, animate to new value
        setIsPriceAnimating(true);
        const startPrice = animatedPrice;
        const duration = 800; // Animation duration in ms
        const startTime = Date.now();
        
        const animate = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          
          // Easing function for smooth animation
          const easeOutCubic = 1 - Math.pow(1 - progress, 3);
          const currentPrice = startPrice + (targetPrice - startPrice) * easeOutCubic;
          
          setAnimatedPrice(currentPrice);
          
          if (progress < 1) {
            requestAnimationFrame(animate);
          } else {
            setAnimatedPrice(targetPrice);
            setIsPriceAnimating(false);
          }
        };
        
        requestAnimationFrame(animate);
      }
    }
  }, [stockData?.price]);

  // Live price updates for main display - DISABLED to prevent simulation drift
  useEffect(() => {
    if (selectedPeriod === '1D' && stockData) {
      // DISABLED: Don't update main price with simulated chart data
      // This was causing the main price to drift away from real API data
      console.log(`💰 [PRICE UPDATE] Live price updates disabled to prevent simulation drift`);
      
      // Only update if we get fresh real API data
      // The main price should stay at the real API price ($181.27)
    }
  }, [selectedPeriod, stockData]);

  // Save selected period to localStorage
  useEffect(() => {
    if (symbol) {
      localStorage.setItem(`chart-period-${symbol}`, selectedPeriod);
    }
  }, [selectedPeriod, symbol]);

  // Helper function to convert UTC timestamp to EST-aligned 30-second boundary
  const alignTo30SecondBoundaryEST = (utcTimestamp: number): number => {
    // Convert UTC timestamp to EST
    const date = new Date(utcTimestamp * 1000);
    const etParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).formatToParts(date);
    
    const year = parseInt(etParts.find(p => p.type === 'year')?.value || '0');
    const month = parseInt(etParts.find(p => p.type === 'month')?.value || '1') - 1;
    const day = parseInt(etParts.find(p => p.type === 'day')?.value || '1');
    const hour = parseInt(etParts.find(p => p.type === 'hour')?.value || '0');
    const minute = parseInt(etParts.find(p => p.type === 'minute')?.value || '0');
    const second = parseInt(etParts.find(p => p.type === 'second')?.value || '0');
    
    // Round to 30-second boundary
    const roundedSeconds = Math.floor(second / 30) * 30;
    
    // Create EST date string in ISO format
    const estDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(roundedSeconds).padStart(2, '0')}`;
    
    // Get UTC equivalent: create a date assuming EST, then get what UTC time that represents
    // Use a known UTC date and compare
    const testUtc = new Date(`${estDateStr}Z`); // Treat as UTC first
    const testEst = new Date(testUtc.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const testUtc2 = new Date(testUtc.toLocaleString('en-US', { timeZone: 'UTC' }));
    const offset = testEst.getTime() - testUtc2.getTime();
    
    // The actual UTC time for this EST time is: testUtc - offset
    const actualUtc = testUtc.getTime() - offset;
    
    return Math.floor(actualUtc / 1000);
  };

  // Function to load chart data (can be called from refresh button)
  const loadChartData = async (isRefresh = false) => {
      if (!stockData) return;
      
    if (isRefresh) {
      setIsRefreshingChart(true);
    }
    
    // Check cache first to prevent shape changes on period switch
    const cacheKey = `chart-data-${stockData.symbol}-${selectedPeriod}`;
    const cachedChartData = localStorage.getItem(cacheKey);
    
        // Only use cache if not refreshing and cache is fresh
        // For all periods, use shorter cache duration to ensure fresh data
        // IMPORTANT: When switching periods, always fetch fresh data to avoid wrong cached data
        if (cachedChartData && !isRefresh) {
          try {
            const parsed = JSON.parse(cachedChartData);
            const cacheAge = Date.now() - (parsed.timestamp || 0);
            // Cache duration: 10 seconds for 1D (for frequent real-time updates), 2 minutes for other periods
            const cacheDuration = selectedPeriod === '1D' ? 10 * 1000 : 2 * 60 * 1000;
            
            // Strict validation: cached data must match current period and symbol exactly
            const isValidCache = parsed.data && 
                                 parsed.data.length > 0 && 
                                 parsed.period === selectedPeriod && 
                                 parsed.symbol === stockData.symbol &&
                                 cacheAge < cacheDuration;
            
            if (isValidCache) {
              console.log(`📦 [CHART] Using cached chart data for ${stockData.symbol} ${selectedPeriod} (age: ${Math.round(cacheAge / 1000 / 60)} minutes, ${parsed.data.length} candles)`);
              setChartData(parsed.data);
              if (isRefresh) {
                setIsRefreshingChart(false);
              }
              return;
            } else {
              if (parsed.period !== selectedPeriod) {
                console.log(`🔄 [CHART] Cache period mismatch (${parsed.period} vs ${selectedPeriod}), fetching fresh REAL data from Yahoo Finance...`);
              } else if (parsed.symbol !== stockData.symbol) {
                console.log(`🔄 [CHART] Cache symbol mismatch (${parsed.symbol} vs ${stockData.symbol}), fetching fresh REAL data from Yahoo Finance...`);
              } else if (cacheAge >= cacheDuration) {
                console.log(`🔄 [CHART] Cache expired (age: ${Math.round(cacheAge / 1000 / 60)} minutes), fetching fresh REAL data from Yahoo Finance...`);
              } else {
                console.log(`🔄 [CHART] Cache invalid (no data or wrong format), fetching fresh REAL data from Yahoo Finance...`);
              }
            }
          } catch (e) {
            console.warn(`⚠️ [CHART] Failed to parse cached chart data:`, e);
            console.log(`🔄 [CHART] Fetching fresh REAL data from Yahoo Finance due to cache parse error...`);
          }
        } else if (!cachedChartData) {
          console.log(`🔄 [CHART] No cache found for ${stockData.symbol} ${selectedPeriod}, fetching fresh REAL data from Yahoo Finance...`);
        }
    
    // For ALL periods, fetch REAL historical data from Yahoo Finance
    // All periods (1D, 1W, 1M, 3M, 1Y, ALL) use REAL Yahoo Finance data - no mock data
        if (['1D', '1W', '1M', '3M', '1Y', 'ALL'].includes(selectedPeriod)) {
      console.log(`📈 [CHART] Fetching REAL CHART data for ${selectedPeriod} period from Yahoo Finance (NOT mock data)`);
          
          try {
        // ✅ CHART DATA: Use Yahoo Finance REAL data for ALL periods (not Polygon/Massive, not mock)
            const historicalData = await getHistoricalDataFromYahoo(stockData.symbol, selectedPeriod);
        
        if (!historicalData || historicalData.length === 0) {
          console.error(`❌ [CHART] Yahoo Finance returned NO data for ${stockData.symbol} ${selectedPeriod} period`);
        } else {
          console.log(`✅ [CHART] Yahoo Finance returned ${historicalData.length} REAL data points for ${stockData.symbol} ${selectedPeriod} period`);
        }
            
            if (historicalData && historicalData.length > 0) {
              // Sync displayed price with latest candle (for initial load)
              // Use the latest candle's close price to ensure header and chart match
              const latestCandle = historicalData[historicalData.length - 1];
              if (latestCandle && latestCandle.value && stockData) {
                const chartPrice = latestCandle.value;
                const headerPrice = stockData.price;
                console.log(`📊 [CHART] Latest candle close: $${chartPrice}, current header price: $${headerPrice}`);
                // Only sync if prices differ significantly (more than 0.1% difference)
                const priceDiff = Math.abs(chartPrice - headerPrice);
                const priceDiffPercent = headerPrice > 0 ? (priceDiff / headerPrice) * 100 : 0;
                if (priceDiffPercent > 0.1) {
                  console.log(`🔄 [CHART] Syncing header price to match chart: $${headerPrice} → $${chartPrice} (diff: ${priceDiffPercent.toFixed(2)}%)`);
                  setStockData(prev => {
                    if (!prev) return null;
                    const updated = {
                      ...prev,
                      price: chartPrice,
                      // Recalculate change based on previous close if available
                      change: prev.previousClose ? chartPrice - prev.previousClose : prev.change,
                      changePercent: prev.previousClose ? ((chartPrice - prev.previousClose) / prev.previousClose) * 100 : prev.changePercent
                    };
                    // Also update animated price to match
                    setAnimatedPrice(chartPrice);
                    return updated;
                  });
                } else {
                  console.log(`✅ [CHART] Prices match (diff: ${priceDiffPercent.toFixed(2)}%)`);
                }
              } else {
                // If no stockData yet, update animatedPrice directly from chart
                if (latestCandle && latestCandle.value) {
                  setAnimatedPrice(latestCandle.value);
                }
              }
              
              console.log(`✅ [YAHOO] Got ${historicalData.length} OHLC candles from Yahoo Finance`);
              console.log(`✅ [REAL DATA] Got ${historicalData.length} real data points from Yahoo Finance`);
              console.log(`📊 [REAL DATA] First data point:`, historicalData[0]);
              console.log(`📊 [REAL DATA] Last data point:`, historicalData[historicalData.length - 1]);
              
              // Convert ChartData to Candle format
          let candleData: Candle[] = [];
          
          if (selectedPeriod === '1D') {
            // For 1D period, use 1-minute candles from Yahoo (they don't provide 30-second data)
            // Real-time WebSocket updates will create 30-second candles
            console.log(`⏱️ [1D CHART] Using ${historicalData.length} 1-minute candles from Yahoo (WebSocket will add 30-second candles in real-time)`);
            
            candleData = historicalData.map((point) => {
              const pointDate = new Date(point.timestamp);
              
              // Get EST time components to ensure proper timezone
              const etParts = new Intl.DateTimeFormat('en-US', {
                timeZone: 'America/New_York',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
              }).formatToParts(pointDate);
              
              const year = parseInt(etParts.find(p => p.type === 'year')?.value || '0');
              const month = parseInt(etParts.find(p => p.type === 'month')?.value || '1') - 1;
              const day = parseInt(etParts.find(p => p.type === 'day')?.value || '1');
              const hour = parseInt(etParts.find(p => p.type === 'hour')?.value || '0');
              const minute = parseInt(etParts.find(p => p.type === 'minute')?.value || '0');
              
              // Convert EST time to UTC timestamp properly
              // Create a date object representing the EST time, then get its UTC timestamp
              // Use Intl.DateTimeFormat to properly handle EST/EDT conversion
              const estDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
              
              // Create a date in EST by parsing as if it were in America/New_York timezone
              // We'll create a date string and use a workaround to convert EST to UTC
              // First, create a date assuming EST (UTC-5)
              const estAsUtc = new Date(`${estDateStr}Z`); // Parse as UTC first
              
              // Get the actual UTC time by calculating the offset
              // Create a test date to determine if DST is in effect
              const testDate = new Date(year, month, day, 12, 0, 0);
              const testDateStr = testDate.toLocaleString('en-US', { 
                timeZone: 'America/New_York', 
                timeZoneName: 'short' 
              });
              const isEDT = testDateStr.includes('EDT');
              const offsetHours = isEDT ? 4 : 5; // EDT is UTC-4, EST is UTC-5
              
              // Adjust: if EST is UTC-5, we need to subtract 5 hours from UTC to get EST
              // So to convert EST to UTC, we add 5 hours
              const utcTimestamp = Math.floor((estAsUtc.getTime() + (offsetHours * 60 * 60 * 1000)) / 1000);
                
                return {
                time: utcTimestamp,
                  open: point.open || point.value,
                  high: point.high || point.value,
                  low: point.low || point.value,
                  close: point.value,
                  volume: point.volume || 0,
                  session: 'rth' as const
                };
              });
              
            console.log(`✅ [1D CHART] Created ${candleData.length} 1-minute candles (EST timezone)`);
          } else if (selectedPeriod === '1W') {
            // For 1W period, use 15-minute candles with EST timezone conversion
            console.log(`⏱️ [1W CHART] Converting ${historicalData.length} 15-minute candles to EST timezone`);
            
            candleData = historicalData.map((point) => {
              const pointDate = new Date(point.timestamp);
              
              // Get EST time components to ensure proper timezone
              const etParts = new Intl.DateTimeFormat('en-US', {
                timeZone: 'America/New_York',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
              }).formatToParts(pointDate);
              
              const year = parseInt(etParts.find(p => p.type === 'year')?.value || '0');
              const month = parseInt(etParts.find(p => p.type === 'month')?.value || '1') - 1;
              const day = parseInt(etParts.find(p => p.type === 'day')?.value || '1');
              const hour = parseInt(etParts.find(p => p.type === 'hour')?.value || '0');
              const minute = parseInt(etParts.find(p => p.type === 'minute')?.value || '0');
              
              // Convert EST time to UTC timestamp properly (same method as 1D)
              const estDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
              
              // Create a date in EST by parsing as if it were in America/New_York timezone
              const estAsUtc = new Date(`${estDateStr}Z`); // Parse as UTC first
              
              // Get the actual UTC time by calculating the offset
              const testDate = new Date(year, month, day, 12, 0, 0);
              const testDateStr = testDate.toLocaleString('en-US', { 
                timeZone: 'America/New_York', 
                timeZoneName: 'short' 
              });
              const isEDT = testDateStr.includes('EDT');
              const offsetHours = isEDT ? 4 : 5; // EDT is UTC-4, EST is UTC-5
              
              // Adjust: if EST is UTC-5, we need to subtract 5 hours from UTC to get EST
              // So to convert EST to UTC, we add 5 hours
              const utcTimestamp = Math.floor((estAsUtc.getTime() + (offsetHours * 60 * 60 * 1000)) / 1000);
              
              return {
                time: utcTimestamp,
                open: point.open || point.value,
                high: point.high || point.value,
                low: point.low || point.value,
                close: point.value,
                volume: point.volume || 0,
                session: 'rth' as const
              };
            });
            
            console.log(`✅ [1W CHART] Created ${candleData.length} 15-minute candles (EST timezone)`);
          } else {
            // For other periods (1M, 3M, 1Y, ALL), use EST timezone conversion like 1W
            console.log(`⏱️ [${selectedPeriod} CHART] Converting ${historicalData.length} candles to EST timezone`);
            
            candleData = historicalData.map((point) => {
              const pointDate = new Date(point.timestamp);
              
              // Get EST time components to ensure proper timezone
              const etParts = new Intl.DateTimeFormat('en-US', {
                timeZone: 'America/New_York',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
              }).formatToParts(pointDate);
              
              const year = parseInt(etParts.find(p => p.type === 'year')?.value || '0');
              const month = parseInt(etParts.find(p => p.type === 'month')?.value || '1') - 1;
              const day = parseInt(etParts.find(p => p.type === 'day')?.value || '1');
              const hour = parseInt(etParts.find(p => p.type === 'hour')?.value || '0');
              const minute = parseInt(etParts.find(p => p.type === 'minute')?.value || '0');
              
              // Convert EST time to UTC timestamp properly (same method as 1D and 1W)
              const estDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
              
              // Create a date in EST by parsing as if it were in America/New_York timezone
              const estAsUtc = new Date(`${estDateStr}Z`); // Parse as UTC first
              
              // Get the actual UTC time by calculating the offset
              const testDate = new Date(year, month, day, 12, 0, 0);
              const testDateStr = testDate.toLocaleString('en-US', { 
                timeZone: 'America/New_York', 
                timeZoneName: 'short' 
              });
              const isEDT = testDateStr.includes('EDT');
              const offsetHours = isEDT ? 4 : 5; // EDT is UTC-4, EST is UTC-5
              
              // Adjust: if EST is UTC-5, we need to subtract 5 hours from UTC to get EST
              // So to convert EST to UTC, we add 5 hours
              const utcTimestamp = Math.floor((estAsUtc.getTime() + (offsetHours * 60 * 60 * 1000)) / 1000);
              
              return {
                time: utcTimestamp,
                open: point.open || point.value,
                high: point.high || point.value,
                low: point.low || point.value,
                close: point.value,
                volume: point.volume || 0,
                session: 'rth' as const
              };
            });
            
            console.log(`✅ [${selectedPeriod} CHART] Created ${candleData.length} candles (EST timezone)`);
          }
          
          // For 1D period, handle live vs closed market states
          if (selectedPeriod === '1D' && candleData.length > 0) {
              const now = new Date();
              const etDateParts = new Intl.DateTimeFormat('en-US', {
                timeZone: 'America/New_York',
                year: 'numeric',
                month: 'numeric',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              }).formatToParts(now);
              
              const etYear = parseInt(etDateParts.find(p => p.type === 'year')?.value || '0');
              const etMonth = parseInt(etDateParts.find(p => p.type === 'month')?.value || '1') - 1;
              const etDay = parseInt(etDateParts.find(p => p.type === 'day')?.value || '1');
              const etHour = parseInt(etDateParts.find(p => p.type === 'hour')?.value || '0');
              const etMinute = parseInt(etDateParts.find(p => p.type === 'minute')?.value || '0');
              const currentETMinutes = etHour * 60 + etMinute;
              
              // Determine if it's EDT (UTC-4) or EST (UTC-5)
              const tempETDate = new Date(etYear, etMonth, etDay, 12, 0, 0);
              const isEDT = tempETDate.toLocaleString('en-US', { timeZone: 'America/New_York', timeZoneName: 'short' }).includes('EDT');
              const etOffsetHours = isEDT ? 4 : 5;
              
            const firstCandle = candleData[0];
            const lastCandle = candleData[candleData.length - 1];
            const firstPrice = firstCandle.close;
            const lastPrice = lastCandle.close;
            
            // Market open: 9:30 AM ET
            const marketOpenET_UTC_ms = Date.UTC(etYear, etMonth, etDay, etOffsetHours + 9, 30, 0);
            const marketOpenUnix = Math.floor(marketOpenET_UTC_ms / 1000);
            
            // Market close: 4:00 PM ET (end of regular trading hours)
            const marketCloseET_UTC_ms = Date.UTC(etYear, etMonth, etDay, etOffsetHours + 16, 0, 0);
            const marketCloseUnix = Math.floor(marketCloseET_UTC_ms / 1000);
            
            // Extended end time: 4:30 PM ET (30 minutes after market close for better spacing)
            const extendedEndET_UTC_ms = Date.UTC(etYear, etMonth, etDay, etOffsetHours + 16, 30, 0);
            const extendedEndUnix = Math.floor(extendedEndET_UTC_ms / 1000);
            
            const firstTime = firstCandle.time as number;
            const lastTime = lastCandle.time as number;
            
            // Check if market is currently open (9:30 AM - 4:00 PM ET)
            const marketOpenMinutes = 9 * 60 + 30; // 9:30 AM
            const marketCloseMinutes = 16 * 60; // 4:00 PM
            const isMarketCurrentlyOpen = currentETMinutes >= marketOpenMinutes && currentETMinutes < marketCloseMinutes;
            
            // Add market open placeholder if before first candle
            if (marketOpenUnix < firstTime) {
              candleData.unshift({
                time: marketOpenUnix,
                    open: firstPrice,
                    high: firstPrice,
                    low: firstPrice,
                    close: firstPrice,
                    volume: 0,
                    session: 'rth' as const
                  });
              }
              
            // If market is currently open, add placeholder candles to extended end (4:30 PM) for better spacing
            // If market is closed, fill with complete data up to extended end (4:30 PM)
            if (isMarketCurrentlyOpen) {
              // Market is open: add placeholder candles from current time to extended end (4:30 PM)
              // These will appear as blank/flat candles on the right side, giving more room
              
              // Add placeholder candles every 30 seconds from last candle to extended end (4:30 PM)
              let placeholderTime = lastTime + 30; // Start 30 seconds after last real candle
              while (placeholderTime <= extendedEndUnix) {
                candleData.push({
                  time: placeholderTime,
                    open: lastPrice,
                    high: lastPrice,
                    low: lastPrice,
                    close: lastPrice,
                    volume: 0,
                  session: placeholderTime > marketCloseUnix ? 'post' as const : 'rth' as const
                });
                placeholderTime += 30; // 30-second intervals
              }
              
              console.log(`📊 [1D LIVE] Market is open - showing ${candleData.length} candles (real data on left, placeholders on right until 4:30 PM for better spacing)`);
            } else {
              // Market is closed: fill entire chart with complete data up to extended end (4:30 PM)
              if (extendedEndUnix > lastTime) {
                // Add placeholder candles from last candle to extended end
                let placeholderTime = lastTime + 5;
                while (placeholderTime <= extendedEndUnix) {
                  candleData.push({
                    time: placeholderTime,
                    open: lastPrice,
                    high: lastPrice,
                    low: lastPrice,
                    close: lastPrice,
                    volume: 0,
                    session: placeholderTime > marketCloseUnix ? 'post' as const : 'rth' as const
                  });
                  placeholderTime += 5;
                }
              }
              
              console.log(`📊 [1D CLOSED] Market is closed - showing complete day (9:30 AM - 4:30 PM) with ${candleData.length} candles for better spacing`);
            }
              
            // Sort by time
              candleData.sort((a, b) => (a.time as number) - (b.time as number));
              
            // CRITICAL: Filter out any candles beyond 4:30 PM to ensure chart only shows until 4:30 PM
            const filteredCandleData = candleData.filter(candle => {
              const candleTime = candle.time as number;
              return candleTime <= extendedEndUnix;
            });
            
            // Use filtered data
            candleData.length = 0;
            candleData.push(...filteredCandleData);
              
            const firstTimeFinal = candleData[0].time as number;
            const lastTimeFinal = candleData[candleData.length - 1].time as number;
            const firstDate = new Date(firstTimeFinal * 1000);
            const lastDate = new Date(lastTimeFinal * 1000);
            
            const firstET = firstDate.toLocaleString('en-US', { 
              timeZone: 'America/New_York', 
              month: 'short',
              day: 'numeric',
              hour: 'numeric', 
              minute: '2-digit',
              hour12: true
            });
            const lastET = lastDate.toLocaleString('en-US', { 
              timeZone: 'America/New_York', 
              month: 'short',
              day: 'numeric',
              hour: 'numeric', 
              minute: '2-digit',
              hour12: true
            });
            
            console.log(`🕐 [1D CHART] Trading hours range: ${firstET} to ${lastET} ET (${candleData.length} candles, showing 9:30 AM - 4:30 PM EST)`);
          } else if (selectedPeriod === '1W' && candleData.length > 0) {
              const firstTime = candleData[0].time as number;
              const lastTime = candleData[candleData.length - 1].time as number;
              const firstDate = new Date(firstTime * 1000);
              const lastDate = new Date(lastTime * 1000);
            
            const firstET = firstDate.toLocaleString('en-US', { 
              timeZone: 'America/New_York', 
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit', 
              minute: '2-digit'
            });
            const lastET = lastDate.toLocaleString('en-US', { 
              timeZone: 'America/New_York', 
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit', 
              minute: '2-digit'
            });
            
            console.log(`🕐 [1W CHART] Data range: ${firstET} to ${lastET} ET (${candleData.length} 15-minute candles)`);
            }
              
              console.log(`📊 [REAL DATA] Converted to ${candleData.length} candles`);
              console.log(`📊 [REAL DATA] First candle:`, candleData[0]);
              console.log(`📊 [REAL DATA] Last candle:`, candleData[candleData.length - 1]);
        
        // Cache the chart data to prevent shape changes on period switch
        try {
          localStorage.setItem(cacheKey, JSON.stringify({
            timestamp: Date.now(),
            data: candleData,
            period: selectedPeriod,
            symbol: stockData.symbol
          }));
          console.log(`💾 [CHART] Cached chart data for ${stockData.symbol} ${selectedPeriod}`);
        } catch (e) {
          console.warn(`⚠️ [CHART] Failed to cache chart data:`, e);
        }
              
              setChartData(candleData);
            } else {
          console.log(`⚠️ [YAHOO] No data returned from Yahoo Finance`);
          // Don't generate random data - show empty or use cached data if available
          if (cachedChartData) {
            try {
              const parsed = JSON.parse(cachedChartData);
              if (parsed.data && parsed.data.length > 0) {
                console.log(`📦 [CHART] Using cached data as fallback`);
                setChartData(parsed.data);
                if (isRefresh) {
                  setIsRefreshingChart(false);
                }
                return;
              }
            } catch (e) {
              // Fall through to empty state
            }
          }
          // Only generate data as last resort, and make it deterministic
          console.log(`⚠️ [CHART] No data available, showing empty chart`);
          setChartData([]);
            }
          } catch (error) {
            console.error(`❌ [YAHOO] Error fetching historical data from Yahoo Finance:`, error);
        // Try to use cached data on error
        if (cachedChartData) {
          try {
            const parsed = JSON.parse(cachedChartData);
            if (parsed.data && parsed.data.length > 0) {
              console.log(`📦 [CHART] Using cached data after error`);
              setChartData(parsed.data);
              if (isRefresh) {
                setIsRefreshingChart(false);
              }
              return;
            }
          } catch (e) {
            // Fall through to empty state
          }
        }
        console.log(`⚠️ [CHART] No cached data available, showing empty chart`);
        setChartData([]);
      } finally {
        if (isRefresh) {
          setIsRefreshingChart(false);
        }
      }
    }
  };

  // Real-time chart updates for 1D period
  useEffect(() => {
    loadChartData();
  }, [selectedPeriod, stockData]);

  // Update market status periodically
  useEffect(() => {
    const updateMarketStatus = () => {
      setMarketStatus(isMarketOpen());
    };
    
    updateMarketStatus();
    const interval = setInterval(updateMarketStatus, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, []);

  // Poll stock data every 5 seconds (only if global auto-polling is enabled)
  useEffect(() => {
    if (!symbol || selectedPeriod !== '1D') {
      return;
    }

    const autoPolling = getAutoPolling();
    if (!autoPolling) {
      console.log(`⏸️ [POLLING] Auto-polling disabled (global setting), skipping for ${symbol}`);
      return;
    }

    console.log(`🔄 [POLLING] Starting 5-second polling for ${symbol} (auto-polling: enabled)`);
    
    const fetchAndUpdate = async () => {
      try {
        console.log(`📡 [POLLING] Fetching fresh stock data for ${symbol}...`);
        const freshData = await getStockQuote(symbol, true); // Bypass cache for real-time updates
        
        if (freshData) {
          setStockData(prev => {
            if (!prev) return prev;
            const newPrice = freshData.price;
            console.log(`✅ [POLLING] Updating price: $${prev.price} → $${newPrice}`);
            return {
              ...prev,
              price: newPrice,
              change: freshData.change,
              changePercent: freshData.changePercent,
              volume: freshData.volume || prev.volume,
            };
          });
          console.log(`✅ [POLLING] Updated stock data: $${freshData.price} (change: ${freshData.changePercent.toFixed(2)}%)`);
          
          // Also update the chart's last candle with the new price (chart is source of truth)
          setChartData(prev => {
            if (prev.length === 0) return prev;
            const updated = [...prev];
            const lastCandle = updated[updated.length - 1];
            if (lastCandle) {
              const newPrice = freshData.price;
              updated[updated.length - 1] = {
                ...lastCandle,
                close: newPrice,
                high: Math.max(lastCandle.high || newPrice, newPrice),
                low: Math.min(lastCandle.low || newPrice, newPrice),
              };
              console.log(`📊 [CHART UPDATE] Updated last candle: $${lastCandle.close} → $${newPrice}`);
            }
            return updated;
          });
        }
      } catch (error) {
        console.error(`❌ [POLLING] Error fetching stock data:`, error);
      }
    };
    
    // Fetch immediately on mount
    fetchAndUpdate();
    
    // Then poll every 5 seconds, but check autoPolling on each interval
    const pollInterval = setInterval(() => {
      if (getAutoPolling()) {
        fetchAndUpdate();
      } else {
        console.log(`⏸️ [POLLING] Auto-polling disabled, skipping update for ${symbol}`);
      }
    }, 5000);

    return () => {
      console.log(`🛑 [POLLING] Stopping polling for ${symbol}`);
      clearInterval(pollInterval);
    };
  }, [symbol, selectedPeriod]);

  // Real-time WebSocket updates ONLY for 1D chart (true live streaming)
  // Historical periods (1W, 1M, 3M, 1Y, ALL) use cached/saved data - no live updates
  useEffect(() => {
    if (!symbol || selectedPeriod !== '1D' || !stockData) {
      return;
    }

    // Only connect WebSocket if market is open or after-hours (for live updates)
    const status = isMarketOpen();
    if (status.status === 'closed') {
      console.log(`⏸️ [WEBSOCKET] Market is closed, skipping WebSocket connection for ${symbol}`);
      return;
    }

    console.log(`🔌 [WEBSOCKET] Connecting to real-time stream for ${symbol} (1D only, market: ${status.status})`);
    
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let previousPrice = stockData.price;
    
    const connectWebSocket = () => {
      try {
        const API_BASE_URL = 'http://localhost:8000';
        // Connect to backend WebSocket endpoint
        ws = new WebSocket(`ws://localhost:8000/api/stocks/ws/${symbol}`);
        
        ws.onopen = () => {
          console.log(`✅ [WEBSOCKET] Connected to real-time stream for ${symbol}`);
          // Send ping to keep connection alive
          if (ws) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        };
        
        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            
            if (message.type === 'pong') {
              // Respond to ping - connection is alive
              return;
            }
            
            if (message.type === 'price_update') {
              const { price, timestamp, volume, open, high, low } = message;
              
              if (price && price !== previousPrice) {
                console.log(`⚡ [WEBSOCKET] Live update: $${previousPrice.toFixed(2)} → $${price.toFixed(2)}`);
                previousPrice = price;
                
                const previousClose = stockData.previousClose || previousPrice;
                const priceChange = price - previousClose;
                const priceChangePercent = previousClose ? (priceChange / previousClose) * 100 : 0;
                
                // Update stock data
                setStockData(prev => prev ? {
                  ...prev,
                  price: price,
                  change: priceChange,
                  changePercent: priceChangePercent,
                  volume: volume || prev.volume,
                  high: Math.max(prev.high || price, high || price),
                  low: Math.min(prev.low || price, low || price)
                } : null);
                
                // Also update animated price immediately to match
                setAnimatedPrice(price);
                
                // Update chart with new candle data (30-second candles for 1D)
                // Use requestAnimationFrame for smoother updates during market hours
                requestAnimationFrame(() => {
                setChartData(prev => {
                  if (prev.length === 0) return prev;
                  
                    const timestampMs = timestamp; // timestamp is already in milliseconds
                  
                  // Convert to EST and round to 30-second boundary
                  const date = new Date(timestampMs);
                  const etParts = new Intl.DateTimeFormat('en-US', {
                    timeZone: 'America/New_York',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                  }).formatToParts(date);
                  
                  const year = parseInt(etParts.find(p => p.type === 'year')?.value || '0');
                  const month = parseInt(etParts.find(p => p.type === 'month')?.value || '1') - 1;
                  const day = parseInt(etParts.find(p => p.type === 'day')?.value || '1');
                  const hour = parseInt(etParts.find(p => p.type === 'hour')?.value || '0');
                  const minute = parseInt(etParts.find(p => p.type === 'minute')?.value || '0');
                  const second = parseInt(etParts.find(p => p.type === 'second')?.value || '0');
                  
                  // Round to nearest 30-second boundary in EST
                  const roundedSeconds = Math.floor(second / 30) * 30;
                  
                  // Determine if it's EDT (UTC-4) or EST (UTC-5)
                  const tempETDate = new Date(year, month, day, 12, 0, 0);
                  const isEDT = tempETDate.toLocaleString('en-US', { timeZone: 'America/New_York', timeZoneName: 'short' }).includes('EDT');
                  const etOffsetHours = isEDT ? 4 : 5;
                  
                  // Convert EST to UTC timestamp
                  const utcHour = hour + etOffsetHours;
                  const alignedTimestamp = Math.floor(Date.UTC(year, month, day, utcHour, minute, roundedSeconds) / 1000);
                  
                  const updated = [...prev];
                  const lastCandle = updated[updated.length - 1];
                  const lastTime = typeof lastCandle.time === 'number' ? lastCandle.time : parseInt(lastCandle.time as string);
                  
                  // For 1D period, create new candle every 30 seconds (aligned to 30-second boundary)
                  if (selectedPeriod === '1D') {
                    // If timestamp is within the same 30-second period, update the last candle
                    if (alignedTimestamp === lastTime) {
                      updated[updated.length - 1] = {
                        ...lastCandle,
                        close: price,
                        high: Math.max(lastCandle.high, high || price),
                        low: Math.min(lastCandle.low, low || price),
                        volume: (lastCandle.volume || 0) + (volume || 0)
                      };
                    } else {
                      // Create new 30-second candle
                      updated.push({
                        time: alignedTimestamp,
                        open: open || (lastCandle.close || price),
                        high: high || price,
                        low: low || price,
                        close: price,
                        volume: volume || 0,
                        session: 'rth'
                      });
                    }
                  } else {
                    // For other periods, use original logic (5-minute windows)
                    const timestampSeconds = Math.floor(timestampMs / 1000);
                  if (timestampSeconds - lastTime < 300) {
                    updated[updated.length - 1] = {
                      ...lastCandle,
                      close: price,
                      high: Math.max(lastCandle.high, high || price),
                      low: Math.min(lastCandle.low, low || price),
                      volume: volume || lastCandle.volume
                    };
                  } else {
                    updated.push({
                      time: timestampSeconds,
                      open: open || price,
                      high: high || price,
                      low: low || price,
                      close: price,
                      volume: volume || 0,
                      session: 'rth'
                    });
                    }
                  }
                  
                  return updated;
                  });
                });
              }
            }
          } catch (error) {
            console.error(`❌ [WEBSOCKET] Error parsing message:`, error);
          }
        };
        
        ws.onerror = (error) => {
          console.error(`❌ [WEBSOCKET] Connection error:`, error);
        };
        
        ws.onclose = () => {
          console.log(`🛑 [WEBSOCKET] Connection closed, will reconnect in 3 seconds...`);
          ws = null;
          // Reconnect after 3 seconds
          reconnectTimeout = setTimeout(connectWebSocket, 3000);
        };
        
      } catch (error) {
        console.error(`❌ [WEBSOCKET] Failed to connect:`, error);
        // Fallback to polling if WebSocket fails
        reconnectTimeout = setTimeout(connectWebSocket, 5000);
      }
    };
    
    // Connect immediately
    connectWebSocket();
    
    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (ws) {
        ws.close();
      }
      console.log(`🛑 [WEBSOCKET] Disconnected from real-time stream for ${symbol}`);
    };
  }, [symbol, selectedPeriod, stockData?.symbol]);

  // Keep chart in sync with stockData price (chart is source of truth)
  useEffect(() => {
    if (!stockData?.price || selectedPeriod !== '1D' || chartData.length === 0) {
      return;
    }

    const currentLastCandlePrice = chartData[chartData.length - 1]?.close || 0;
    const priceDiff = Math.abs(stockData.price - currentLastCandlePrice);
    
    // Only update if price difference is significant (more than 0.01 to avoid unnecessary updates)
    if (priceDiff > 0.01) {
      setChartData(prev => {
        if (prev.length === 0) return prev;
        const updated = [...prev];
        const lastCandle = updated[updated.length - 1];
        if (lastCandle) {
          updated[updated.length - 1] = {
            ...lastCandle,
            close: stockData.price,
            high: Math.max(lastCandle.high || stockData.price, stockData.price),
            low: Math.min(lastCandle.low || stockData.price, stockData.price),
          };
          console.log(`🔄 [CHART SYNC] Synced chart price: $${currentLastCandlePrice} → $${stockData.price}`);
        }
        return updated;
      });
    }
  }, [stockData?.price, selectedPeriod, chartData.length]);

  // Generate live trading-style chart data in Candle format
  const generateStockChartData = (period: string): Candle[] => {
    const basePrice = stockData?.price || 180;
    console.log(`📊 [CHART DATA] Using base price: $${basePrice.toFixed(2)} for ${period} period`);
    
    // For live trading mode, show full day from 12:00 AM to 11:59 PM ET
    if (period === '1D') {
      const now = new Date();
      
      // Get today's midnight (12:00 AM ET) 
      const todayMidnight = new Date();
      todayMidnight.setUTCHours(4, 0, 0, 0); // 12:00 AM ET = 4:00 AM UTC (EDT)
      todayMidnight.setUTCMinutes(0);
      todayMidnight.setUTCSeconds(0);
      todayMidnight.setUTCMilliseconds(0);
      
      // Check if we're before midnight today (in ET timezone)
      const nowET = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
      const midnightET = new Date(todayMidnight.toLocaleString('en-US', { timeZone: 'America/New_York' }));
      if (nowET.getTime() < midnightET.getTime()) {
        todayMidnight.setUTCDate(todayMidnight.getUTCDate() - 1);
      }
      
      // End of day: 11:59:59 PM ET = 3:59:59 AM UTC next day (EDT)
      const endOfDay = new Date(todayMidnight);
      endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);
      endOfDay.setUTCHours(3, 59, 59, 999);
      
      const nowUnix = Math.floor(now.getTime() / 1000);
      const midnightUnix = Math.floor(todayMidnight.getTime() / 1000);
      const endOfDayUnix = Math.floor(endOfDay.getTime() / 1000);
      
      // Generate data every 5 minutes for full day (288 intervals = 24 hours * 60 min / 5 min)
      const totalIntervals = 288;
      const intervalSeconds = 300; // 5 minutes
      
      console.log(`📊 [LIVE CHART] Creating full day chart from 12:00 AM to 11:59 PM ET, current time: ${nowET.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} ET`);
      
      // Track previous price as we build the array
      let previousPrice = basePrice;
      const liveData: Candle[] = Array.from({ length: totalIntervals }, (_, i) => {
        // Calculate timestamp for this interval (starting from midnight)
        const intervalTime = midnightUnix + (i * intervalSeconds);
        const isPastData = intervalTime <= nowUnix;
        const isFutureData = intervalTime > endOfDayUnix;
        
        // Skip if beyond end of day OR if it's future data (after current time)
        // Only show actual data up to current time - don't create flat line for future
        if (isFutureData || !isPastData) {
          return null as any;
        }
        
        // Get hour in Eastern Time for market patterns
        const dateET = new Date(intervalTime * 1000);
        const hourET = parseInt(dateET.toLocaleString('en-US', {
          hour: '2-digit',
          hour12: false,
          timeZone: 'America/New_York'
        }));
        const minuteET = parseInt(dateET.toLocaleString('en-US', {
          minute: '2-digit',
          timeZone: 'America/New_York'
        }));
        
        // Use REALISTIC but VISIBLE price movement for NVIDIA intraday trading
        // NVIDIA typically moves ±1% to ±3% per day with visible intraday swings
        const dailyVolatility = 0.025; // 2.5% daily volatility to show more movement
        const intradayVolatility = dailyVolatility / 2; // Scale down less aggressively for visibility
        
        // Add realistic market patterns throughout the day (ET timezone)
        let marketEffect = 0;
        
        // Pre-market (4:00 AM - 9:30 AM ET) - Lower volatility
        if (hourET >= 4 && hourET < 9) marketEffect = 0.002;
        if (hourET === 9 && minuteET < 30) marketEffect = 0.002;
        
        // Market open (9:30 AM - 10:30 AM ET) - Higher volatility with swings
        if (hourET === 9 && minuteET >= 30) marketEffect = Math.sin(i / 10) * 0.005; // Add oscillation
        if (hourET === 10 && minuteET <= 30) marketEffect = Math.sin(i / 10) * 0.005;
        
        // Regular trading (10:30 AM - 12:00 PM ET) - Normal volatility with small swings
        if (hourET >= 10 && hourET < 12) marketEffect = Math.sin(i / 15) * 0.003;
        
        // Lunch dip (12:00 PM - 1:00 PM ET) - Slight downward pressure
        if (hourET === 12) marketEffect = -0.002;
        
        // Afternoon trading (1:00 PM - 3:00 PM ET) - Normal volatility
        if (hourET >= 13 && hourET < 15) marketEffect = Math.sin(i / 20) * 0.003;
        
        // Power hour (3:00 PM - 4:00 PM ET) - Increased activity with bigger swings
        if (hourET === 15) marketEffect = Math.sin(i / 8) * 0.008;
        
        // After hours (4:00 PM - 8:00 PM ET) - Lower volatility
        if (hourET >= 16 && hourET <= 20) marketEffect = 0.001;
        
        // Evening (8:00 PM - 12:00 AM ET) - Very low volatility
        if (hourET >= 20 || hourET < 4) marketEffect = 0.0005;
        
        // Generate realistic price movement with visible variations
        const randomChange = (Math.random() - 0.5) * 2 * intradayVolatility;
        
        // Add some momentum/spike effects to create visible chart breaks
        const spikeEffect = Math.random() < 0.1 ? (Math.random() - 0.5) * 0.01 : 0; // 10% chance of spikes
        const momentumEffect = Math.sin(i * 0.1) * 0.005; // Add sinusoidal momentum
        
        const priceChange = randomChange + marketEffect + spikeEffect + momentumEffect;
        
        // Calculate price but add strong mean reversion to keep it very close to base
        const drift = (previousPrice - basePrice) / basePrice; // How far we've drifted
        const meanReversion = drift * -0.3; // Pull back 30% of drift (strong reversion)
        const adjustedChange = priceChange + meanReversion;
        
        const price = previousPrice * (1 + adjustedChange);
        
        // Also add additional constraint to keep within ±2% of base price
        const priceDeviation = (price - basePrice) / basePrice;
        const clampedPrice = basePrice * (1 + Math.max(-0.02, Math.min(0.02, priceDeviation)));
        
        const finalPrice = Math.max(clampedPrice, basePrice * 0.98); // Prevent extreme drops
        
        const candle = {
          time: intervalTime,
          open: previousPrice,
          high: Math.max(previousPrice, finalPrice),
          low: Math.min(previousPrice, finalPrice),
          close: finalPrice,
          volume: Math.floor(Math.random() * 1000000),
          session: 'rth' as const
        };
        
        // Update previous price for next iteration
        previousPrice = finalPrice;
        
        return candle;
      }).filter(c => c !== null); // Remove null entries
      
      // Log the generated data
      const lastData = liveData[liveData.length - 1];
      const firstData = liveData[0];
      if (firstData && lastData) {
        const firstTime = new Date((firstData.time as number) * 1000).toLocaleString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit' });
        const lastTime = new Date((lastData.time as number) * 1000).toLocaleString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit' });
        console.log(`📊 [LIVE CHART] Generated ${liveData.length} data points from ${firstTime} to ${lastTime} ET, latest price: $${lastData.close?.toFixed(2) || 'N/A'}`);
      }
      return liveData;
    }
    
    // For other periods (1W, 1M, 3M, 1Y, ALL), this should not be called
    // because they use real Yahoo Finance data in the useEffect
    // But as a fallback, generate mock data
    console.log(`⚠️ [CHART] Generating fallback mock data for ${period} period`);
    const chartData = generateDataForTimeRange(basePrice, period as '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL');
    console.log(`📊 [CHART] Generated ${chartData.length} data points for ${period} period, base price: ${basePrice}`);
    
    // Convert to Candle format
    const candleData: Candle[] = chartData.map((point, index) => {
      const prevPrice = index > 0 ? chartData[index - 1].value : basePrice;
      const currentPrice = point.value;
      const volatility = Math.abs(currentPrice - prevPrice) / prevPrice;
      
      return {
        time: Math.floor(new Date(point.date).getTime() / 1000),
        open: prevPrice,
        high: Math.max(prevPrice, currentPrice) * (1 + volatility * 0.5),
        low: Math.min(prevPrice, currentPrice) * (1 - volatility * 0.5),
        close: currentPrice,
        volume: Math.floor(Math.random() * 2000000),
        session: 'rth' as const
      };
    });
    
    // Fallback: if no data, create simple mock data
    if (!candleData || candleData.length === 0) {
      console.log(`📊 [CHART] No data generated, creating fallback data`);
      return Array.from({ length: 30 }, (_, i) => ({
        time: Math.floor((Date.now() - (29 - i) * 24 * 60 * 60 * 1000) / 1000),
        open: basePrice,
        high: basePrice + 5,
        low: basePrice - 5,
        close: basePrice + (Math.random() - 0.5) * 10,
        volume: Math.floor(Math.random() * 1000000),
        session: 'rth' as const
      }));
    }
    
    console.log(`📊 [CHART] Returning ${candleData.length} valid data points for ${period}`);
    return candleData;
  };

  useEffect(() => {
    const loadStockData = async () => {
      setIsLoading(true);
      
      try {
        console.log(`🔍 [STOCK DETAIL] Loading real data for symbol: ${symbol}`);
        
        // Check localStorage cache first for stock detail data (cache for 1 hour)
        const cacheKey = `stock-detail-${symbol}`;
        const cachedData = localStorage.getItem(cacheKey);
        if (cachedData) {
          try {
            const parsed = JSON.parse(cachedData);
            const cacheAge = Date.now() - (parsed.timestamp || 0);
            const oneHour = 60 * 60 * 1000; // 1 hour in milliseconds
            
            if (cacheAge < oneHour && parsed.data) {
              console.log(`📦 [STOCK DETAIL] Using cached data for ${symbol} (age: ${Math.round(cacheAge / 1000 / 60)} minutes)`);
              setStockData(parsed.data);
              setIsLoading(false);
              
              // Always fetch fresh metrics from Polygon and price from Yahoo in background (non-blocking)
              Promise.all([
                // Fetch fresh price from Yahoo Finance
                getStockQuote(symbol || 'NVDA'),
                // Fetch fresh metrics from Polygon/Massive
                fetch(`http://localhost:8000/api/stocks/quote-summary/${symbol}`)
                  .then(res => res.ok ? res.json() : null)
                  .catch(() => null)
              ]).then(([freshPriceData, polygonMetrics]) => {
                if (freshPriceData || polygonMetrics) {
                  setStockData(prev => {
                    if (!prev) return prev;
                    const updated = { ...prev };
                    
                    // Update price if available
                    if (freshPriceData) {
                      updated.price = freshPriceData.price;
                      updated.change = freshPriceData.change;
                      updated.changePercent = freshPriceData.changePercent;
                      updated.volume = freshPriceData.volume || prev.volume;
                    }
                    
                    // Update metrics from Polygon if available
                    if (polygonMetrics) {
                      console.log(`🔄 [METRICS UPDATE] Updating cached data with fresh Polygon metrics:`, polygonMetrics);
                      if (polygonMetrics.marketCapRaw) {
                        updated.marketCap = polygonMetrics.marketCapRaw;
                      }
                      if (polygonMetrics.sector && polygonMetrics.sector !== 'N/A') {
                        updated.sector = polygonMetrics.sector;
                      }
                      if (polygonMetrics.industry && polygonMetrics.industry !== 'N/A') {
                        updated.industry = polygonMetrics.industry;
                      }
                      if (polygonMetrics.employees) {
                        updated.employees = polygonMetrics.employees;
                      }
                      if (polygonMetrics.headquarters && polygonMetrics.headquarters !== 'N/A') {
                        updated.headquarters = polygonMetrics.headquarters;
                      }
                      if (polygonMetrics.description) {
                        updated.description = polygonMetrics.description;
                      }
                      if (polygonMetrics.name) {
                        updated.name = polygonMetrics.name;
                      }
                    }
                    
                    // Also fetch logo if not available
                    if (!updated.logo && updated.name) {
                      import('@/services/stockData').then(({ fetchCompanyLogo }) => {
                        fetchCompanyLogo(symbol, updated.name).then((logo) => {
                          if (logo) {
                            console.log(`✅ [LOGO] Got logo for ${symbol}: ${logo}`);
                            setStockData(current => current ? { ...current, logo } : null);
                          }
                        });
                      });
                    }
                    
                    return updated;
                  });
                }
              });
              return;
            }
          } catch (e) {
            console.log(`⚠️ [STOCK DETAIL] Invalid cache, fetching fresh data`);
          }
        }
        
        // Get basic price data from Yahoo Finance (fast and reliable)
        const realStockData = await getStockQuote(symbol || 'NVDA');
        
        if (!realStockData) {
          console.log(`❌ [STOCK DETAIL] No real data found, using fallback`);
          setIsLoading(false);
          return;
        }
        
        console.log(`✅ [STOCK DETAIL] Got Yahoo Finance data:`, realStockData);
        console.log(`💰 [STOCK DETAIL] Price: $${realStockData.price}`);
        
        // Fetch METRICS (market cap, P/E, sector, industry) from Massive/Polygon API
        // NOTE: Chart uses Yahoo Finance, Metrics use Massive/Polygon
        let polygonData = null;
        try {
          const API_BASE_URL = 'http://localhost:8000';
          console.log(`📊 [METRICS] Fetching METRICS from Massive/Polygon API...`);
          
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout after 5 seconds')), 5000) // 5 second timeout
          );
          
          const polygonResponse = await Promise.race([
            fetch(`${API_BASE_URL}/api/stocks/quote-summary/${symbol}`),
            timeoutPromise
          ]) as Response;
          
          if (polygonResponse.ok) {
            polygonData = await polygonResponse.json();
            console.log(`✅ [METRICS] Got Massive/Polygon METRICS:`, polygonData);
            console.log(`📊 [METRICS] Market Cap: ${polygonData.marketCap}, P/E: ${polygonData.peRatio}, Sector: ${polygonData.sector}, Industry: ${polygonData.industry}`);
          } else {
            console.log(`⚠️ [METRICS] Massive/Polygon API returned ${polygonResponse.status}, using Yahoo Finance for metrics`);
          }
        } catch (error: any) {
          if (error?.message?.includes('Timeout')) {
            console.log(`⏱️ [METRICS] Massive/Polygon timeout (5s), using Yahoo Finance for metrics`);
          } else {
            console.log(`⚠️ [METRICS] Failed to fetch from Massive/Polygon, using Yahoo Finance for metrics:`, error);
          }
        }
          
          // Parse market cap from Polygon (preferred) or Yahoo Finance
          let marketCapValue = 0;
          if (polygonData?.marketCapRaw) {
            marketCapValue = polygonData.marketCapRaw;
          } else {
            const marketCapStr = realStockData.marketCap || '';
            if (marketCapStr && marketCapStr !== 'N/A' && marketCapStr !== '') {
              const numValue = parseFloat(marketCapStr.replace(/[TBMK]/g, ''));
              if (!isNaN(numValue)) {
                if (marketCapStr.includes('T')) {
                  marketCapValue = numValue * 1000000000000;
                } else if (marketCapStr.includes('B')) {
                  marketCapValue = numValue * 1000000000;
                } else if (marketCapStr.includes('M')) {
                  marketCapValue = numValue * 1000000;
                } else if (marketCapStr.includes('K')) {
                  marketCapValue = numValue * 1000;
                } else {
                  marketCapValue = numValue;
                }
              }
            }
          }
          
          // Use Massive/Polygon data for METRICS (market cap, P/E, sector, industry) - preferred source
          // Use Yahoo Finance for price (more real-time)
          const finalStockData = {
            symbol: realStockData.symbol,
            name: polygonData?.name || realStockData.name || symbol || 'Unknown',
            price: realStockData.price, // ✅ Yahoo Finance for price (real-time)
            change: realStockData.change,
            changePercent: realStockData.changePercent,
            volume: realStockData.volume || polygonData?.volume || 0,
            marketCap: marketCapValue, // ✅ Massive/Polygon for market cap
            pe: (realStockData.peRatio && realStockData.peRatio > 0 ? realStockData.peRatio : 0) || (polygonData?.peRatio || 0), // ✅ Yahoo Finance for P/E (Polygon doesn't provide it)
            sector: polygonData?.sector || realStockData.sector || 'N/A', // ✅ Massive/Polygon for sector
            industry: polygonData?.industry || realStockData.industry || 'N/A', // ✅ Massive/Polygon for industry
            description: polygonData?.description || realStockData.description || `${realStockData.name || symbol} is a publicly traded company.`,
            employees: polygonData?.employees || realStockData.employees || 0,
            headquarters: polygonData?.headquarters || realStockData.headquarters || 'N/A',
            founded: polygonData?.founded || realStockData.founded || 'N/A',
            website: polygonData?.website || realStockData.website || '',
            logo: realStockData.logo || polygonData?.logo || undefined
          };
          
          console.log(`✅ [DATA SOURCES] Price from Yahoo Finance: $${finalStockData.price}`);
          console.log(`✅ [DATA SOURCES] Metrics from Massive/Polygon: Market Cap=${finalStockData.marketCap}, P/E=${finalStockData.pe}, Sector=${finalStockData.sector}, Industry=${finalStockData.industry}`);
          console.log(`✅ [DATA SOURCES] Logo: ${finalStockData.logo || 'Not available'}`);
          
          setStockData(finalStockData);
          
          // Fetch logo asynchronously if not available
          if (!finalStockData.logo && finalStockData.name) {
            console.log(`🖼️ [LOGO] Fetching logo for ${symbol} (${finalStockData.name})`);
            import('@/services/stockData').then(({ fetchCompanyLogo }) => {
              fetchCompanyLogo(symbol, finalStockData.name).then((logo) => {
                if (logo) {
                  console.log(`✅ [LOGO] Got logo for ${symbol}: ${logo}`);
                  setStockData(prev => prev ? { ...prev, logo } : null);
                }
              });
            });
          }
          
          // Cache the detailed stock data (metrics from Polygon) for 1 hour
          // Price will be refreshed from Yahoo Finance, but metrics stay cached
          try {
            localStorage.setItem(cacheKey, JSON.stringify({
              data: finalStockData,
              timestamp: Date.now()
            }));
            console.log(`💾 [STOCK DETAIL] Cached stock detail data for ${symbol}`);
          } catch (e) {
            console.log(`⚠️ [STOCK DETAIL] Failed to cache data:`, e);
          }
      } catch (error) {
        console.error(`💥 [STOCK DETAIL] Error loading stock data:`, error);
        // Fallback to mock data on error
        setStockData({
          symbol: symbol || 'NVDA',
          name: 'NVIDIA Corporation',
          price: 180.0,
          change: 2.5,
          changePercent: 1.4,
          volume: 45234567,
          marketCap: 2150000000000,
          pe: 65.4,
          sector: 'Technology',
          industry: 'Semiconductors',
          description: 'NVIDIA Corporation operates as a computing company. It operates through Graphics and Compute & Networking segments.',
          employees: 29000,
          headquarters: 'Santa Clara, CA',
          founded: '1993',
          website: 'nvidia.com'
        });
      }

      setIsLoading(false);
    };

    // Fetch signals and news for the stock
    const fetchSignalsAndNews = async () => {
      if (!symbol) return;

      const API_BASE_URL = 'http://localhost:8000';
      const token = localStorage.getItem('auth_token');

      // Fetch signals for this ticker (use main history endpoint with include_all=true to get global signals)
      setIsLoadingSignals(true);
      try {
        if (token) {
          // Use the main history endpoint with include_all=true to get signals from all users
          const signalsResponse = await fetch(`${API_BASE_URL}/api/signals/history?limit=100&include_all=true`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          if (signalsResponse.ok) {
            const signalsData = await signalsResponse.json();
            const allSignals = signalsData.signals || [];
            
            // Filter signals by ticker (case-insensitive)
            const tickerSignals = allSignals.filter((s: any) => 
              s.ticker && s.ticker.toUpperCase() === symbol.toUpperCase()
            );
            
            // Map backend signals to frontend format and take last 2
            const mappedSignals: AISignal[] = tickerSignals
              .slice(0, 2) // Take only last 2
              .map((s: any) => {
                // Handle confidence: backend should return 0-1 (decimal), but handle both cases
                let confidence = s.confidence || 0.75;
                // If confidence is less than 1, it's a decimal (0-1), multiply by 100
                // If confidence is already 1-100, use it as-is
                if (confidence < 1) {
                  confidence = Math.round(confidence * 100);
                } else {
                  confidence = Math.round(confidence);
                }
                // Ensure confidence is between 0 and 100
                confidence = Math.max(0, Math.min(100, confidence));
                
                return {
                id: s.signal_id || s.id || `signal-${Date.now()}`,
                signal_id: s.signal_id,
                type: s.signal_type === 'NEWS' ? 'NEWS' : s.signal_type === 'SEC' ? 'SEC' : s.signal_type === 'INSIDER' ? 'INSIDER' : 'BULLISH',
                confidence: confidence,
                title: s.signal_type === 'NEWS' ? 'AI News Analysis' : 
                       s.signal_type === 'SEC' ? 'Institutional Holdings Change' :
                       s.signal_type === 'INSIDER' ? 'Insider Trading Activity' : 'Trading Signal',
                description: s.reasoning || s.rationale || s.key_points?.[0] || 'No description available',
                rationale: s.reasoning || s.rationale,
                source: s.signal_type === 'NEWS' ? 'NEWS' : 
                        s.signal_type === 'SEC' ? 'SEC' : 
                        s.signal_type === 'INSIDER' ? 'INSIDER' : 'FUNDAMENTAL',
                timestamp: s.created_timestamp || s.generated_at || new Date().toISOString(),
                created_timestamp: s.created_timestamp || s.generated_at,
                ticker: s.ticker,
                signal: s.signal, // BUY/SELL/HOLD
                keyPoints: s.key_points
              };
              });
            
            setAiSignals(mappedSignals);
            console.log(`✅ Fetched ${mappedSignals.length} signals for ${symbol} (from ${tickerSignals.length} total signals for this ticker)`);
          } else {
            console.warn(`⚠️ Failed to fetch signals: ${signalsResponse.status} ${signalsResponse.statusText}`);
            setAiSignals([]);
          }
        } else {
          console.warn('⚠️ No auth token found, skipping signals fetch');
          setAiSignals([]);
        }
      } catch (error) {
        console.error('Error fetching signals:', error);
        setAiSignals([]);
      } finally {
        setIsLoadingSignals(false);
      }

      // Fetch news for this ticker (POST endpoint)
      setIsLoadingNews(true);
      try {
        if (token) {
          const newsResponse = await fetch(`${API_BASE_URL}/api/signals/news/${symbol}?limit=10`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          if (newsResponse.ok) {
            const newsData = await newsResponse.json();
            const articles = newsData.articles || [];
            
            // Map backend news to frontend format and take last 2
            const mappedNews: NewsItem[] = articles
              .slice(0, 2) // Take only last 2
              .map((article: any, index: number) => ({
                id: article.id || `news-${index}`,
                title: article.title || article.headline || 'No title',
                summary: article.summary || article.description || article.snippet || 'No summary available',
                source: article.source || article.publisher || 'Unknown',
                timestamp: article.published_at || article.timestamp || new Date().toISOString(),
                sentiment: article.sentiment || (article.title?.toLowerCase().includes('positive') || article.title?.toLowerCase().includes('up') ? 'POSITIVE' : 
                          article.title?.toLowerCase().includes('negative') || article.title?.toLowerCase().includes('down') ? 'NEGATIVE' : 'NEUTRAL'),
                url: article.url || article.link
              }));
            
            setNews(mappedNews);
            console.log(`✅ Fetched ${mappedNews.length} news articles for ${symbol}`);
          } else {
            console.warn(`⚠️ Failed to fetch news: ${newsResponse.status} ${newsResponse.statusText}`);
            setNews([]);
          }
        } else {
          console.warn('⚠️ No auth token found, skipping news fetch');
          setNews([]);
        }
      } catch (error) {
        console.error('Error fetching news:', error);
        setNews([]);
      } finally {
        setIsLoadingNews(false);
      }
    };

    // Scroll to top when symbol changes
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    loadStockData();
    fetchSignalsAndNews();
  }, [symbol]);

  // Function to generate a new signal
  const handleGenerateSignal = async () => {
    if (!symbol || isGeneratingSignal) return;
    
    setIsGeneratingSignal(true);
    try {
      const signal = await generateSignal(symbol);
      if (signal) {
        // Refresh signals after generation (use main history endpoint with include_all=true)
        const API_BASE_URL = 'http://localhost:8000';
        const token = localStorage.getItem('auth_token');
        if (token) {
          const signalsResponse = await fetch(`${API_BASE_URL}/api/signals/history?limit=100&include_all=true`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          if (signalsResponse.ok) {
            const signalsData = await signalsResponse.json();
            const allSignals = signalsData.signals || [];
            
            // Filter signals by ticker (case-insensitive)
            const tickerSignals = allSignals.filter((s: any) => 
              s.ticker && s.ticker.toUpperCase() === symbol.toUpperCase()
            );
            
            const mappedSignals: AISignal[] = tickerSignals.slice(0, 2).map((s: any) => {
              // Handle confidence: backend should return 0-1 (decimal), but handle both cases
              let confidence = s.confidence || 0.75;
              // If confidence is less than 1, it's a decimal (0-1), multiply by 100
              // If confidence is already 1-100, use it as-is
              if (confidence < 1) {
                confidence = Math.round(confidence * 100);
              } else {
                confidence = Math.round(confidence);
              }
              // Ensure confidence is between 0 and 100
              confidence = Math.max(0, Math.min(100, confidence));
              
              return {
              id: s.signal_id || s.id || `signal-${Date.now()}`,
              signal_id: s.signal_id,
              type: s.signal_type === 'NEWS' ? 'NEWS' : s.signal_type === 'SEC' ? 'SEC' : s.signal_type === 'INSIDER' ? 'INSIDER' : 'BULLISH',
              confidence: confidence,
              title: s.signal_type === 'NEWS' ? 'AI News Analysis' : 
                     s.signal_type === 'SEC' ? 'Institutional Holdings Change' :
                     s.signal_type === 'INSIDER' ? 'Insider Trading Activity' : 'Trading Signal',
              description: s.reasoning || s.rationale || s.key_points?.[0] || 'No description available',
              rationale: s.reasoning || s.rationale,
              source: s.signal_type === 'NEWS' ? 'NEWS' : 
                      s.signal_type === 'SEC' ? 'SEC' : 
                      s.signal_type === 'INSIDER' ? 'INSIDER' : 'FUNDAMENTAL',
              timestamp: s.created_timestamp || s.generated_at || new Date().toISOString(),
              created_timestamp: s.created_timestamp || s.generated_at,
              ticker: s.ticker,
              signal: s.signal,
              keyPoints: s.key_points
            };
            });
            setAiSignals(mappedSignals);
          }
        }
      }
    } catch (error) {
      console.error('Error generating signal:', error);
    } finally {
      setIsGeneratingSignal(false);
    }
  };

  // Function to fetch news
  const handleGenerateNews = async () => {
    if (!symbol || isLoadingNews) return;
    
    setIsLoadingNews(true);
    try {
      const API_BASE_URL = 'http://localhost:8000';
      const token = localStorage.getItem('auth_token');
      if (token) {
        const newsResponse = await fetch(`${API_BASE_URL}/api/signals/news/${symbol}?limit=10`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        if (newsResponse.ok) {
          const newsData = await newsResponse.json();
          const articles = newsData.articles || [];
          const mappedNews: NewsItem[] = articles.slice(0, 2).map((article: any, index: number) => ({
            id: article.id || `news-${index}`,
            title: article.title || article.headline || 'No title',
            summary: article.summary || article.description || article.snippet || 'No summary available',
            source: article.source || article.publisher || 'Unknown',
            timestamp: article.published_at || article.timestamp || new Date().toISOString(),
            sentiment: article.sentiment || (article.title?.toLowerCase().includes('positive') || article.title?.toLowerCase().includes('up') ? 'POSITIVE' : 
                      article.title?.toLowerCase().includes('negative') || article.title?.toLowerCase().includes('down') ? 'NEGATIVE' : 'NEUTRAL'),
            url: article.url || article.link
          }));
          setNews(mappedNews);
        }
      }
    } catch (error) {
      console.error('Error fetching news:', error);
    } finally {
      setIsLoadingNews(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading stock data...</p>
        </div>
      </div>
    );
  }

  if (!stockData) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Stock Not Found</h1>
          <Button onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => navigate('/dashboard')}
              className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                {stockData.logo ? (
                  <img 
                    src={stockData.logo} 
                    alt={`${stockData.name} logo`}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      // Fallback to company initial if logo fails to load
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        parent.innerHTML = `<div class="w-full h-full flex items-center justify-center text-2xl font-bold text-emerald-500">${stockData.symbol.charAt(0)}</div>`;
                      }
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-emerald-500">
                    {stockData.symbol.charAt(0)}
                  </div>
                )}
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{stockData.symbol}</h1>
                <p className="text-gray-600 dark:text-gray-400">{stockData.name}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Button variant="outline" size="sm">
              <Bell className="h-4 w-4 mr-2" />
              Set Alert
            </Button>
            <Button variant="outline" size="sm">
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
            <Button variant="outline" size="sm">
              <Star className="h-4 w-4 mr-2" />
              Watchlist
            </Button>
          </div>
        </div>

        {/* Stock Price & Key Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 items-stretch">
          <div className="lg:col-span-2 flex flex-col">
            <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 flex-1 flex flex-col">
              <CardContent className="p-6 flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className={`text-3xl font-bold text-gray-900 dark:text-white transition-all duration-300 ${
                      isPriceAnimating ? 'scale-105' : 'scale-100'
                    }`}>
                      ${lastCandlePrice > 0 ? lastCandlePrice.toFixed(2) : (animatedPrice > 0 ? animatedPrice.toFixed(2) : (stockData?.price || 0).toFixed(2))}
                    </h2>
                    {(() => {
                      // Always use API's changePercent (from previous day's close) to exactly match Top Movers
                      // Both Top Movers and Stock Detail Page use getStockQuote() which returns the same changePercent
                      const changePercent = stockData?.changePercent ?? 0;
                      const change = stockData?.change ?? 0;
                      
                      const isPositive = changePercent >= 0;
                      
                      return (
                        <div className={`flex items-center text-lg font-semibold transition-all duration-300 ${
                          isPositive ? 'text-green-600' : 'text-red-600'
                        } ${isPriceAnimating ? 'scale-105' : 'scale-100'}`}>
                          {isPositive ? (
                            <TrendingUp className="h-5 w-5 mr-1" />
                          ) : (
                            <TrendingDown className="h-5 w-5 mr-1" />
                          )}
                          {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
                          <span className="ml-2 text-sm font-normal text-gray-600 dark:text-gray-400">
                            (${isPositive ? '+' : ''}{change.toFixed(2)})
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                  
                  <div className="text-right">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Market Cap</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {stockData.marketCap > 0 ? (
                        `$${stockData.marketCap >= 1e12 ? `${(stockData.marketCap / 1e12).toFixed(1)}T` :
                          stockData.marketCap >= 1e9 ? `${(stockData.marketCap / 1e9).toFixed(1)}B` :
                          stockData.marketCap >= 1e6 ? `${(stockData.marketCap / 1e6).toFixed(1)}M` :
                          stockData.marketCap >= 1e3 ? `${(stockData.marketCap / 1e3).toFixed(1)}K` :
                          stockData.marketCap.toFixed(0)}`
                      ) : 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Chart */}
                <div className="mb-0">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Price Chart</h3>
                      {selectedPeriod === '1D' && (
                        <div className="flex items-center space-x-2">
                          {marketStatus.isOpen ? (
                            <>
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                              <span className="text-xs text-green-500 font-medium animate-pulse">LIVE</span>
                            </>
                          ) : marketStatus.status === 'after-hours' ? (
                            <>
                              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                              <span className="text-xs text-yellow-500 font-medium">AFTER HOURS</span>
                            </>
                          ) : marketStatus.status === 'pre-market' ? (
                            <>
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              <span className="text-xs text-blue-500 font-medium">PRE-MARKET</span>
                            </>
                          ) : (
                            <>
                              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                              <span className="text-xs text-gray-400 font-medium">CLOSED</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                
                    <div className="flex items-center space-x-2">
                    <div className="flex space-x-2">
                      {['1D', '1W', '1M', '3M', '1Y', 'ALL'].map((period) => (
                        <Button
                          key={period}
                          variant={selectedPeriod === period ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSelectedPeriod(period)}
                          className={`px-3 py-1 text-sm ${
                            selectedPeriod === period
                              ? 'bg-blue-600 text-white'
                              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600'
                          }`}
                        >
                          {period}
                        </Button>
                      ))}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadChartData(true)}
                        disabled={isRefreshingChart}
                        className="px-3 py-1 text-sm bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                        title="Refresh chart data"
                      >
                        <RotateCw className={`h-4 w-4 ${isRefreshingChart ? 'animate-spin' : ''}`} />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="w-full -mx-2">
                    {chartData.length > 0 ? (
                      <RobinhoodChart 
                        data={chartData}
                        height={320}
                        showVolume={false}
                        showLatestMarker={selectedPeriod === '1D'}
                        className="w-full"
                        currentPrice={lastCandlePrice > 0 ? lastCandlePrice : undefined}
                        selectedPeriod={selectedPeriod}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-80 text-gray-500 dark:text-gray-400">
                        <div className="text-center">
                          <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p>Loading chart data...</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col space-y-6 h-full">
            {/* Key Metrics */}
            <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 flex-1 flex flex-col">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white">Key Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 flex-1">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Volume</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {stockData.volume > 0 ? `${(stockData.volume / 1000000).toFixed(1)}M` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Sector</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {stockData.sector && stockData.sector !== 'N/A' ? stockData.sector : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-gray-600 dark:text-gray-400">Industry</span>
                  <span className="font-semibold text-gray-900 dark:text-white text-xs text-right max-w-[60%] leading-tight">
                    {stockData.industry && stockData.industry !== 'N/A' ? stockData.industry : 'N/A'}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Company Info */}
            <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 flex-1 flex flex-col">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white">Company Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 flex-1">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{stockData.description}</p>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Employees</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {stockData.employees > 0 ? stockData.employees.toLocaleString() : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Headquarters</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {stockData.headquarters && stockData.headquarters !== 'N/A' ? stockData.headquarters : 'N/A'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* AI Signals & News */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* AI Signals */}
          <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-gray-900 dark:text-white">
                <div className="flex items-center space-x-2">
                <Zap className="h-5 w-5 text-blue-600" />
                <span>AI Signals</span>
                  {aiSignals.length > 0 && (
                <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400">
                  {aiSignals.length}
                </Badge>
                  )}
                </div>
                {aiSignals.length === 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleGenerateSignal}
                    disabled={isGeneratingSignal}
                    className="text-xs"
                  >
                    {isGeneratingSignal ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Generate Signal
                      </>
                    )}
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 flex-1 flex flex-col">
              {isLoadingSignals ? (
                <div className="text-center py-8 flex-1 flex items-center justify-center">
                  <div>
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-gray-400" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">Loading signals...</p>
                  </div>
                </div>
              ) : aiSignals.length > 0 ? (
                <div className="flex-1 flex flex-col space-y-4">
              {aiSignals.map((signal) => (
                    <div 
                      key={signal.id} 
                      className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-1"
                      onClick={() => setSelectedSignal(signal)}
                    >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <Badge 
                            variant={signal.type === 'BULLISH' || signal.type === 'NEWS' || signal.signal === 'BUY' ? 'default' : 'destructive'}
                            className={signal.type === 'BULLISH' || signal.type === 'NEWS' || signal.signal === 'BUY' ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400' : ''}
                      >
                            {signal.signal || signal.type}
                      </Badge>
                          {signal.confidence && (
                      <span className="text-sm text-gray-600 dark:text-gray-400">{signal.confidence}% confidence</span>
                          )}
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-500">
                          {formatDate(signal.timestamp)}
                    </span>
                  </div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-1">{signal.title}</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{signal.description}</p>
                      {signal.keyPoints && signal.keyPoints.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs text-gray-500 dark:text-gray-500 mb-1">Key Points:</p>
                          <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                            {signal.keyPoints.slice(0, 2).map((point, idx) => (
                              <li key={idx}>• {point}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                  <div className="flex items-center mt-2">
                    <Badge variant="outline" className="text-xs">
                      {signal.source}
                    </Badge>
                  </div>
                </div>
              ))}
                </div>
              ) : (
                <div className="text-center py-8 flex-1 flex items-center justify-center">
                  <div>
                    <Zap className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">No AI signals available for {symbol}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleGenerateSignal}
                      disabled={isGeneratingSignal}
                    >
                      {isGeneratingSignal ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Generate Signal
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Latest News */}
          <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-gray-900 dark:text-white">
                <div className="flex items-center space-x-2">
                <Activity className="h-5 w-5 text-green-600" />
                <span>Latest News</span>
                </div>
                {news.length === 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleGenerateNews}
                    disabled={isLoadingNews}
                    className="text-xs"
                  >
                    {isLoadingNews ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Fetch News
                      </>
                    )}
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 flex-1 flex flex-col">
              {isLoadingNews ? (
                <div className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">Loading news...</p>
                </div>
              ) : news.length > 0 ? (
                <div className="flex-1 flex flex-col space-y-4">
              {news.map((item) => (
                    <div key={item.id} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <Badge 
                        variant={item.sentiment === 'POSITIVE' ? 'default' : item.sentiment === 'NEGATIVE' ? 'destructive' : 'secondary'}
                        className={item.sentiment === 'POSITIVE' ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 
                                  item.sentiment === 'NEGATIVE' ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400' : ''}
                    >
                      {item.sentiment}
                    </Badge>
                    <span className="text-xs text-gray-500 dark:text-gray-500">
                        {formatDate(item.timestamp)}
                    </span>
                  </div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">{item.title}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">{item.summary}</p>
                    <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500 dark:text-gray-500">Source: {item.source}</p>
                      {item.url && (
                        <a 
                          href={item.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Read more →
                        </a>
                      )}
                    </div>
                </div>
              ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Activity className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">No news available for {symbol}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleGenerateNews}
                    disabled={isLoadingNews}
                  >
                    {isLoadingNews ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Fetch News
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
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
                      {stockData?.logo ? (
                        <img 
                          src={stockData.logo} 
                          alt={stockData.symbol}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                              parent.innerHTML = `<span class="text-2xl font-bold text-gray-700 dark:text-gray-300">${stockData.symbol.charAt(0)}</span>`;
                            }
                          }}
                        />
                      ) : (
                        <span className="text-2xl font-bold text-gray-700 dark:text-gray-300">
                          {stockData?.symbol?.charAt(0) || 'S'}
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{stockData?.symbol || selectedSignal.ticker}</h2>
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
                      {formatDateTime(selectedSignal.timestamp)}
                    </div>
                  </div>

                  {/* Signal Recommendation */}
                  {selectedSignal.signal && (
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
                  {selectedSignal.rationale && (
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Detailed Analysis</h3>
                      <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                        {selectedSignal.rationale}
                      </p>
                    </div>
                  )}

                  {/* Description (if rationale is not available) */}
                  {!selectedSignal.rationale && selectedSignal.description && (
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Analysis</h3>
                      <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                        {selectedSignal.description}
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
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Source</p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">{selectedSignal.source}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
