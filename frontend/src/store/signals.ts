import { create } from 'zustand';
import { auth } from '@/lib/firebase';

const API_BASE_URL = 'http://localhost:8000';

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

interface Alert {
  id: string;
  tickers: string[];
  keywords?: string[];
  type: 'SEC' | 'INSIDER' | 'NEWS' | 'TECH';
  threshold: number;
  channel: 'push' | 'email';
  quietHours: boolean;
  createdAt: string;
}

interface SignalsStore {
  signals: Signal[];
  alerts: Alert[];
  isLoading: boolean;
  isRegenerating: boolean;
  fetchSignals: (filters?: any) => Promise<void>;
  generateSignal: (ticker: string) => Promise<Signal | null>;
  regenerateSignals: (tickers: string[]) => Promise<void>;
  createAlert: (alert: Omit<Alert, 'id' | 'createdAt'>) => Promise<void>;
  dismissSignal: (signalId: string) => void;
}

// Helper to get auth token - use backend JWT token from localStorage
const getAuthToken = async (): Promise<string | null> => {
  try {
    // First try to get backend JWT token from localStorage
    const backendToken = localStorage.getItem('auth_token');
    if (backendToken) {
      return backendToken;
    }
    
    // Fallback to Firebase token if available
    if (auth) {
      const user = auth.currentUser;
      if (user) {
        return await user.getIdToken();
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
};

// Helper to map backend signal to frontend format
const mapBackendSignalToFrontend = (backendSignal: any): Signal => {
  // Determine signal type - first check if signal_type is explicitly set
  let type: 'SEC' | 'INSIDER' | 'NEWS' | 'TECH' = 'NEWS';
  let title = '';
  
  // If signal_type is explicitly set, use it (from weekly top signals generation)
  if (backendSignal.signal_type) {
    type = backendSignal.signal_type as 'SEC' | 'INSIDER' | 'NEWS' | 'TECH';
  }
  // Otherwise, determine type based on available data
  else if (backendSignal.insider_data && 
      backendSignal.insider_data.transactions && 
      Array.isArray(backendSignal.insider_data.transactions) && 
      backendSignal.insider_data.transactions.length > 0) {
    type = 'INSIDER';
  } 
  else if (backendSignal.institutional_data) {
    const holdings = backendSignal.institutional_data.holdings;
    if (holdings && Array.isArray(holdings) && holdings.length > 0) {
      type = 'SEC';
    }
  }
  
  // Set title based on type
  if (type === 'INSIDER') {
    title = 'Insider Trading Activity Detected';
  } else if (type === 'SEC') {
    title = 'Institutional Holdings Change';
  } else if (type === 'NEWS') {
    title = 'AI News Analysis';
  } else {
    title = 'Trading Signal';
  }
  
  // Get the full reasoning - this is the detailed analysis
  // Try multiple possible field names
  const reasoning = backendSignal.reasoning || backendSignal.rationale || '';
  
  // No console warnings - incomplete signals are filtered out automatically 
  // Fall back to NEWS if articles were analyzed or if no type was determined
  if (type === 'NEWS' && !title) {
    title = 'AI News Analysis';
  }
  
  // Build title from signal type if available
  const signalType = backendSignal.signal || '';
  if (signalType && !title) {
    title = `${signalType} Signal for ${backendSignal.ticker}`;
  }

  // Build rationale based on signal type
  let finalRationale = reasoning;
  
  // For INSIDER signals: use insider data summary
  if (type === 'INSIDER' && backendSignal.insider_data) {
    const insiderData = backendSignal.insider_data;
    const sentiment = insiderData.sentiment || {};
    const transactions = insiderData.transactions || [];
    
    if (sentiment.summary) {
      finalRationale = sentiment.summary;
    } else if (transactions.length > 0) {
      const buys = transactions.filter((t: any) => t.transaction_type?.toLowerCase().includes('buy') || t.transaction_type?.toLowerCase().includes('purchase')).length;
      const sells = transactions.filter((t: any) => t.transaction_type?.toLowerCase().includes('sell') || t.transaction_type?.toLowerCase().includes('sale')).length;
      finalRationale = `Recent insider activity: ${transactions.length} transaction(s) detected (${buys} buys, ${sells} sells). ${sentiment.sentiment || 'Neutral'} sentiment.`;
    } else {
      finalRationale = 'Insider trading activity detected. Click to view detailed transaction data.';
    }
  }
  // For SEC signals: use institutional data summary
  else if (type === 'SEC' && backendSignal.institutional_data) {
    const instData = backendSignal.institutional_data;
    const sentiment = instData.sentiment || {};
    const holdings = instData.holdings || [];
    
    if (sentiment.summary) {
      finalRationale = sentiment.summary;
    } else if (holdings.length > 0) {
      const totalValue = holdings.reduce((sum: number, h: any) => sum + (h.value || 0), 0);
      finalRationale = `Institutional holdings: ${holdings.length} fund(s) holding this stock with total value of $${(totalValue / 1000000).toFixed(1)}M. ${sentiment.sentiment || 'Neutral'} sentiment.`;
    } else {
      finalRationale = 'Institutional holdings data available. Click to view detailed holdings information.';
    }
  }
  // For NEWS signals: use AI-generated content or fallback
  else if (!finalRationale || finalRationale.trim() === '') {
    const keyPoints = backendSignal.key_points || [];
    if (keyPoints.length > 0) {
      finalRationale = keyPoints[0]; // Use first key point as preview
    } else if (backendSignal.sentiment_analysis) {
      finalRationale = backendSignal.sentiment_analysis;
    } else {
      finalRationale = 'Click to view detailed AI analysis and key insights.';
    }
  }

  return {
    id: backendSignal.signal_id || backendSignal.id || Date.now().toString(),
    symbol: backendSignal.ticker,
    type,
    confidence: Math.round((backendSignal.confidence || 0) * 100),
    title: title || `${signalType} Signal for ${backendSignal.ticker}`,
    rationale: finalRationale,
    createdAt: backendSignal.generated_at || backendSignal.created_at || backendSignal.created_timestamp || new Date().toISOString(),
    // Include all additional fields
    keyPoints: backendSignal.key_points || [],
    sentimentAnalysis: backendSignal.sentiment_analysis || '',
    riskLevel: backendSignal.risk_level || '',
    signal: backendSignal.signal || '',
    articlesAnalyzed: backendSignal.articles_analyzed || 0,
    insiderData: backendSignal.insider_data,
    institutionalData: backendSignal.institutional_data
  };
};

// Helper to check if a signal is complete (has all required data)
const isSignalComplete = (signal: Signal): boolean => {
  // SEC and INSIDER signals don't need AI - they just need raw API data
  // NEWS signals need AI-generated content
  
  // Check for insider data (Form 4) - if it has transactions, it's complete
  if (signal.type === 'INSIDER' && signal.insiderData) {
    const transactions = signal.insiderData.transactions;
    if (transactions && Array.isArray(transactions) && transactions.length > 0) {
      return true; // Insider signal with transactions is complete
    }
  }
  
  // Check for institutional data (Form 13F) - if it has holdings, it's complete
  if (signal.type === 'SEC' && signal.institutionalData) {
    const holdings = signal.institutionalData.holdings;
    if (holdings && Array.isArray(holdings) && holdings.length > 0) {
      return true; // SEC signal with holdings is complete
    }
  }
  
  // For NEWS signals, check for AI-generated content
  // A signal is complete if it has:
  // 1. A non-empty rationale (not placeholder text) OR at least key points
  // 2. Key points OR sentiment analysis OR articles analyzed
  
  // Check for rationale - must be non-empty and not placeholder
  const hasRationale = signal.rationale && 
    signal.rationale.trim() !== '' && 
    signal.rationale !== 'Click to view detailed AI analysis and key insights.';
  
  // Check for key points
  const hasKeyPoints = signal.keyPoints && signal.keyPoints.length > 0;
  
  // Check for other data sources
  const hasKeyData = hasKeyPoints ||
    (signal.sentimentAnalysis && signal.sentimentAnalysis.trim() !== '') ||
    (signal.articlesAnalyzed && signal.articlesAnalyzed > 0);
  
  // NEWS signal is complete if it has either:
  // - Rationale AND some key data, OR
  // - Key points AND some other data (even without full rationale)
  const isComplete = (hasRationale && hasKeyData) || (hasKeyPoints && hasKeyData);
  
  return isComplete;
};

export const useSignalsStore = create<SignalsStore>((set, get) => ({
  signals: [],
  alerts: [],
  isLoading: false,
  isRegenerating: false,

  fetchSignals: async (filters = {}) => {
    set({ isLoading: true });
    
    try {
      const token = await getAuthToken();
      if (!token) {
        console.warn('❌ No auth token found. Please log in to get real AI-generated signals.');
        console.warn('💡 Go to the landing page (/) to sign up or log in');
        // Return empty array - NO DEMO DATA
        set({ signals: [], isLoading: false });
        return;
      }

      // Fetch signals from the last 7 days (1 week) - shows signals from ALL users
      // If you want only yesterday's signals, change to: setDate(oneWeekAgo.getDate() - 1)
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const fromDate = oneWeekAgo.toISOString().split('T')[0]; // YYYY-MM-DD
      
      // Limit to 50 most recent signals from the past week
      const response = await fetch(`${API_BASE_URL}/api/signals/history?limit=50&from_date=${fromDate}&include_all=true`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch signals: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`📥 Fetched ${data.signals.length} signals from backend`);
      
      const mappedSignals = data.signals.map(mapBackendSignalToFrontend);
      
      // Debug: Check why signals might be incomplete
      if (mappedSignals.length > 0) {
        const incompleteReasons = mappedSignals.map(s => {
          const hasRationale = s.rationale && s.rationale.trim() !== '' && s.rationale !== 'Click to view detailed AI analysis and key insights.';
          const hasKeyData = (s.keyPoints && s.keyPoints.length > 0) || (s.sentimentAnalysis && s.sentimentAnalysis.trim() !== '') || s.insiderData || s.institutionalData || (s.articlesAnalyzed && s.articlesAnalyzed > 0);
          return {
            ticker: s.symbol,
            hasRationale,
            rationaleLength: s.rationale?.length || 0,
            rationalePreview: s.rationale?.substring(0, 50) || 'N/A',
            hasKeyData,
            keyPointsCount: s.keyPoints?.length || 0,
            keyPointsPreview: s.keyPoints?.slice(0, 2) || [],
            hasInsiderData: !!s.insiderData,
            hasInstitutionalData: !!s.institutionalData,
            articlesAnalyzed: s.articlesAnalyzed || 0,
            isComplete: isSignalComplete(s)
          };
        });
        // Expand the objects so we can see the actual data
        console.log('🔍 Signal completeness check (first 5):', JSON.stringify(incompleteReasons.slice(0, 5), null, 2));
        
        // Also log the raw backend signal for the first few to see what we're getting
        const recentSignals = data.signals.slice(0, 3);
        const rawSignalInfo = recentSignals.map(s => ({
          ticker: s.ticker,
          signalType: s.signal_type || 'MISSING',
          hasReasoning: !!s.reasoning,
          reasoningLength: s.reasoning?.length || 0,
          reasoningPreview: s.reasoning?.substring(0, 100) || 'EMPTY',
          hasKeyPoints: !!s.key_points,
          keyPointsCount: s.key_points?.length || 0,
          keyPoints: s.key_points || [],
          hasSentimentAnalysis: !!s.sentiment_analysis,
          sentimentAnalysisPreview: s.sentiment_analysis?.substring(0, 50) || 'EMPTY',
          articlesAnalyzed: s.articles_analyzed || 0,
          hasInsiderData: !!s.insider_data,
          hasInstitutionalData: !!s.institutional_data,
          createdTimestamp: s.created_timestamp || s.generated_at,
          allFields: Object.keys(s),
          // Show actual values for critical fields
          reasoningValue: s.reasoning || 'MISSING',
          keyPointsValue: s.key_points || 'MISSING'
        }));
        console.log('📋 Raw backend signals (first 3):', JSON.stringify(rawSignalInfo, null, 2));
      }
      
      // Filter signals - ONLY show signals from the API (SEC, INSIDER, NEWS with proper data)
      // Reject any signal that doesn't have a valid signal_type or is incomplete
      const completeSignals = mappedSignals.filter(s => {
        // MUST have a valid signal_type (SEC, INSIDER, or NEWS) - this ensures we only show API-generated signals
        if (!s.type || (s.type !== 'SEC' && s.type !== 'INSIDER' && s.type !== 'NEWS')) {
          return false; // Reject signals without valid type
        }
        
        // For NEWS signals: must have REAL AI-generated reasoning (>100 chars) AND key_points AND articles
        if (s.type === 'NEWS') {
          const hasRealRationale = s.rationale && 
            s.rationale.trim() !== '' && 
            s.rationale !== 'Click to view detailed AI analysis and key insights.' &&
            s.rationale !== 'Click to view detailed AI analysis and key insight' &&
            s.rationale.length > 100; // Must be AI-generated, not placeholder
          const hasKeyPoints = s.keyPoints && Array.isArray(s.keyPoints) && s.keyPoints.length > 0;
          const hasArticles = s.articlesAnalyzed && s.articlesAnalyzed > 0;
          
          // NEWS signals MUST have AI-generated content from Gemini
          return hasRealRationale && hasKeyPoints && hasArticles;
        }
        
        // For SEC signals: must have institutional data with holdings (from SEC API)
        if (s.type === 'SEC') {
          const hasHoldings = s.institutionalData && 
                 s.institutionalData.holdings && 
                 Array.isArray(s.institutionalData.holdings) && 
                 s.institutionalData.holdings.length > 0;
          return hasHoldings; // Only show if it has SEC API data
        }
        
        // For INSIDER signals: must have insider data with transactions (from SEC API)
        if (s.type === 'INSIDER') {
          const hasTransactions = s.insiderData && 
                 s.insiderData.transactions && 
                 Array.isArray(s.insiderData.transactions) && 
                 s.insiderData.transactions.length > 0;
          return hasTransactions; // Only show if it has SEC API data
        }
        
        return false; // Reject any other types
      });
      
      // Debug: Log signal types for filtering (only if we have signals)
      if (completeSignals.length > 0) {
        const signalTypeCounts = completeSignals.reduce((acc, s) => {
          acc[s.type] = (acc[s.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        console.log('📊 Complete signals by type:', signalTypeCounts);
      }
      
      // Keep ALL signals (old + new) - don't deduplicate
      // Users want to see historical signals, not just the latest
      // Only deduplicate if same ticker AND same timestamp (true duplicates)
      const signalMap = new Map<string, Signal[]>();
      for (const signal of completeSignals) {
        const key = signal.symbol;
        if (!signalMap.has(key)) {
          signalMap.set(key, []);
        }
        signalMap.get(key)!.push(signal);
      }
      
      // Sort each ticker's signals by date (newest first) and keep all
      const allSignals: Signal[] = [];
      signalMap.forEach((signals) => {
        // Sort by date, newest first
        signals.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        // Keep all signals for this ticker (don't deduplicate)
        allSignals.push(...signals);
      });
      
      // Sort all signals by confidence (highest to lowest)
      // Within same confidence, sort by date (newest first)
      allSignals.sort((a, b) => {
        // First sort by confidence (highest first)
        if (b.confidence !== a.confidence) {
          return b.confidence - a.confidence;
        }
        
        // If same confidence, sort by date (newest first)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      
      set({ signals: allSignals, isLoading: false });
      
      // Fetch logos for all signals asynchronously (non-blocking)
      // Do this after setting signals so UI renders immediately
      import('@/services/stockData').then(({ fetchCompanyLogo }) => {
        allSignals.forEach((signal) => {
          if (!signal.logo) {
            // Fetch logo in background - it will update when loaded
            fetchCompanyLogo(signal.symbol, signal.symbol).then((logo) => {
              if (logo) {
                // Update the signal in the store with the logo
                set((state) => ({
                  signals: state.signals.map((s) => 
                    s.id === signal.id ? { ...s, logo } : s
                  )
                }));
              }
            }).catch(() => {
              // Silently fail - will use fallback initial
            });
          }
        });
      });
      
      if (mappedSignals.length > 0) {
        console.log(`✅ Loaded ${completeSignals.length} API-generated signals out of ${mappedSignals.length} total (filtered out ${mappedSignals.length - completeSignals.length} incomplete/old)`);
        console.log(`📊 Storing ${allSignals.length} signals from API (SEC/INSIDER/NEWS only)`);
      } else {
        console.log(`✅ No signals found in the last week`);
      }
      
      // Skip auto-regeneration - user wants fresh API data only
      // Signals will be generated manually or on demand
    } catch (error) {
      console.error('Error fetching signals:', error);
      // Fallback to empty array on error
      set({ signals: [], isLoading: false });
    }
  },

  generateSignal: async (ticker: string): Promise<Signal | null> => {
    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('No auth token available');
      }

      const response = await fetch(`${API_BASE_URL}/api/signals/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ticker: ticker.toUpperCase(),
          news_limit: 10
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(errorData.detail || `Failed to generate signal: ${response.statusText}`);
      }

      const signalData = await response.json();
      const mappedSignal = mapBackendSignalToFrontend(signalData);
      
      // Only add if signal is complete
      if (isSignalComplete(mappedSignal)) {
        // Add to current signals list, replacing any existing signal for this ticker
        set(state => ({
          signals: [mappedSignal, ...state.signals.filter(s => s.symbol !== ticker.toUpperCase())]
        }));
        return mappedSignal;
      } else {
        console.warn(`⚠️ Generated signal for ${ticker} is incomplete, not adding to list`);
        return null;
      }
    } catch (error) {
      console.error(`Error generating signal for ${ticker}:`, error);
      throw error;
    }
  },

  regenerateSignals: async (tickers: string[]) => {
    set({ isRegenerating: true });
    
    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('No auth token available');
      }

      console.log(`🔄 Starting weekly top signals generation in background...`);
      
      // Call the weekly top signals endpoint (non-blocking - runs in background)
      fetch(`${API_BASE_URL}/api/signals/generate-weekly-top-signals`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }).then(async (weeklyResponse) => {
        if (weeklyResponse.ok) {
          const weeklyData = await weeklyResponse.json();
          console.log(`✅ Weekly top signals generation started:`, weeklyData);
          
          // Poll for new signals every 5 seconds (non-blocking)
          let pollCount = 0;
          const maxPolls = 12; // Poll for up to 60 seconds
          const pollInterval = setInterval(async () => {
            pollCount++;
            console.log(`🔄 Polling for new signals (${pollCount}/${maxPolls})...`);
            await get().fetchSignals();
            
            if (pollCount >= maxPolls) {
              clearInterval(pollInterval);
              console.log(`✅ Finished polling for new signals`);
              set({ isRegenerating: false });
            }
          }, 5000);
        } else {
          console.warn(`⚠️ Weekly signals endpoint returned ${weeklyResponse.status}`);
          set({ isRegenerating: false });
        }
      }).catch((error) => {
        console.error(`❌ Error calling weekly signals endpoint:`, error);
        set({ isRegenerating: false });
      });
      
      // Immediately fetch signals to show any that are already available
      console.log('🔄 Fetching current signals...');
      await get().fetchSignals();
      
      // Set a timeout to stop regeneration status after 60 seconds
      setTimeout(() => {
        if (get().isRegenerating) {
          console.log('⏱️ Regeneration timeout - stopping status');
          set({ isRegenerating: false });
        }
      }, 60000);
      
    } catch (error) {
      console.error('Error starting signal regeneration:', error);
      set({ isRegenerating: false });
    }
  },

  createAlert: async (alertData) => {
    const newAlert: Alert = {
      ...alertData,
      id: Date.now().toString(),
      createdAt: new Date().toISOString()
    };
    
    set(state => ({
      alerts: [...state.alerts, newAlert]
    }));
  },

  dismissSignal: (signalId: string) => {
    set(state => ({
      signals: state.signals.filter(s => s.id !== signalId)
    }));
  },
}));