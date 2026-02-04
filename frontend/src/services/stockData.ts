// Stock data service using multiple APIs
const ALPHA_VANTAGE_API_KEY = import.meta.env.VITE_ALPHA_VANTAGE_API_KEY || '3A2SWHH9LCAPMCY8';
const IEX_CLOUD_API_KEY = import.meta.env.VITE_IEX_CLOUD_API_KEY || 'pk_test_1234567890abcdef'; // Replace with your IEX Cloud key
const POLYGON_API_KEY = import.meta.env.VITE_POLYGON_API_KEY || 'byfsfLxd4oCRvypN_pEi7vrmpbDIeBmg';

// Multiple API keys for rotation (add more keys as needed)
const API_KEYS = [
  '3A2SWHH9LCAPMCY8',
  // Add more Alpha Vantage keys here if you have them
];

let currentApiKeyIndex = 0;

// Simple cache to reduce API calls
const quoteCache = new Map<string, { data: StockQuote; timestamp: number }>();
const searchCache = new Map<string, { data: StockSearchResult[]; timestamp: number }>();
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes (shorter for more real-time data)
const REAL_TIME_CACHE_DURATION = 1 * 1000; // 1 second for real-time polling scenarios

// Check if cache is valid
function isCacheValid(timestamp: number): boolean {
  return Date.now() - timestamp < CACHE_DURATION;
}

// Helper function to get fallback company data for any stock
function getFallbackCompanyData(symbol: string): Partial<StockQuote> {
  console.log(`🔄 [FALLBACK] Getting fallback data for ${symbol}`);
  
  // Comprehensive fallback data for major stocks
  const fallbackData: { [key: string]: Partial<StockQuote> } = {
    'TSLA': { 
      marketCap: '790B', 
      sector: 'Consumer Discretionary',
      name: 'Tesla, Inc.'
    },
    'NVDA': { 
      marketCap: '4.3T', 
      sector: 'Technology',
      name: 'NVIDIA Corporation'
    },
    'AAPL': { 
      marketCap: '2.8T', 
      sector: 'Technology',
      name: 'Apple Inc.'
    },
    'MSFT': { 
      marketCap: '2.8T', 
      sector: 'Technology',
      name: 'Microsoft Corporation'
    },
    'GOOGL': { 
      marketCap: '1.8T', 
      sector: 'Communication Services',
      name: 'Alphabet Inc.'
    },
    'AMZN': { 
      marketCap: '1.6T', 
      sector: 'Consumer Discretionary',
      name: 'Amazon.com, Inc.'
    },
    'META': { 
      marketCap: '1.2T', 
      sector: 'Communication Services',
      name: 'Meta Platforms, Inc.'
    },
    'NFLX': { 
      marketCap: '270B', 
      sector: 'Communication Services',
      name: 'Netflix, Inc.'
    },
    'AMD': { 
      marketCap: '200B', 
      sector: 'Technology',
      name: 'Advanced Micro Devices, Inc.'
    },
    'INTC': { 
      marketCap: '180B', 
      sector: 'Technology',
      name: 'Intel Corporation'
    },
    'CRCL': { 
      marketCap: '4.2B', 
      sector: 'Financial Services',
      industry: 'Financial Technology',
      name: 'Circle Internet Group'
    },
    'CRCE': { 
      marketCap: '50M', 
      sector: 'Energy',
      industry: 'Oil & Gas',
      name: 'Circle Energy, Inc.'
    },
    'CEXE': { 
      marketCap: '1M', 
      sector: 'Consumer Discretionary',
      industry: 'Entertainment',
      name: 'Circle Entertainment Inc.'
    },
    'COIN': { 
      marketCap: '60B', 
      sector: 'Financial Services',
      industry: 'Financial Technology',
      name: 'Coinbase Global, Inc.'
    },
    'SQ': { 
      marketCap: '40B', 
      sector: 'Financial Services',
      industry: 'Financial Technology',
      name: 'Block, Inc.'
    },
    'PYPL': { 
      marketCap: '60B', 
      sector: 'Financial Services',
      industry: 'Financial Technology',
      name: 'PayPal Holdings, Inc.'
    },
    'ROKU': { 
      marketCap: '5B', 
      sector: 'Communication Services',
      industry: 'Entertainment',
      name: 'Roku, Inc.'
    },
    'ZM': { 
      marketCap: '8B', 
      sector: 'Technology',
      industry: 'Software',
      name: 'Zoom Video Communications, Inc.'
    },
    'SNOW': { 
      marketCap: '50B', 
      sector: 'Technology',
      industry: 'Software',
      name: 'Snowflake Inc.'
    },
    'PLTR': { 
      marketCap: '40B', 
      sector: 'Technology',
      industry: 'Software',
      name: 'Palantir Technologies Inc.'
    },
    'UBER': { 
      marketCap: '120B', 
      sector: 'Consumer Discretionary',
      industry: 'Transportation',
      name: 'Uber Technologies, Inc.'
    },
    'LYFT': { 
      marketCap: '5B', 
      sector: 'Consumer Discretionary',
      industry: 'Transportation',
      name: 'Lyft, Inc.'
    },
    'SPOT': { 
      marketCap: '30B', 
      sector: 'Communication Services',
      industry: 'Entertainment',
      name: 'Spotify Technology S.A.'
    },
    'SHOP': { 
      marketCap: '80B', 
      sector: 'Technology',
      industry: 'Software',
      name: 'Shopify Inc.'
    },
    'TWLO': { 
      marketCap: '8B', 
      sector: 'Technology',
      industry: 'Software',
      name: 'Twilio Inc.'
    },
    'OKTA': { 
      marketCap: '6B', 
      sector: 'Technology',
      industry: 'Software',
      name: 'Okta, Inc.'
    },
    'CRWD': { 
      marketCap: '70B', 
      sector: 'Technology',
      industry: 'Software',
      name: 'CrowdStrike Holdings, Inc.'
    },
    'ZS': { 
      marketCap: '15B', 
      sector: 'Technology',
      industry: 'Software',
      name: 'Zscaler, Inc.'
    },
    'NET': { 
      marketCap: '30B', 
      sector: 'Technology',
      industry: 'Software',
      name: 'Cloudflare, Inc.'
    }
  };
  
  // Check if we have specific data for this symbol
  if (fallbackData[symbol]) {
    console.log(`🔄 [FALLBACK] Found specific data for ${symbol}:`, fallbackData[symbol]);
    return fallbackData[symbol];
  }
  
  // Intelligent fallback for unknown stocks
  console.log(`🧠 [INTELLIGENT FALLBACK] Generating data for unknown symbol: ${symbol}`);
  
  // Generate intelligent estimates based on symbol patterns and common sectors
  const intelligentFallback = generateIntelligentFallback(symbol);
  console.log(`🧠 [INTELLIGENT FALLBACK] Generated data for ${symbol}:`, intelligentFallback);
  
  return intelligentFallback;
}

// Generate intelligent fallback data for any stock symbol
function generateIntelligentFallback(symbol: string): Partial<StockQuote> {
  const symbolUpper = symbol.toUpperCase();
  
  // Sector mapping based on common patterns
  const sectorPatterns = {
    // Technology
    'TECH': 'Technology',
    'SOFT': 'Technology', 
    'DATA': 'Technology',
    'AI': 'Technology',
    'CLOUD': 'Technology',
    'CYBER': 'Technology',
    'SECURITY': 'Technology',
    'BLOCKCHAIN': 'Technology',
    'CRYPTO': 'Technology',
    'BITCOIN': 'Technology',
    'ETHEREUM': 'Technology',
    
    // Financial Services
    'BANK': 'Financial Services',
    'FINANCE': 'Financial Services',
    'CREDIT': 'Financial Services',
    'CAPITAL': 'Financial Services',
    'INVEST': 'Financial Services',
    'TRUST': 'Financial Services',
    'INSURANCE': 'Financial Services',
    'PAYMENT': 'Financial Services',
    'PAY': 'Financial Services',
    
    // Healthcare
    'MED': 'Healthcare',
    'HEALTH': 'Healthcare',
    'BIO': 'Healthcare',
    'PHARMA': 'Healthcare',
    'DRUG': 'Healthcare',
    'THERAPY': 'Healthcare',
    'CARE': 'Healthcare',
    
    // Energy
    'ENERGY': 'Energy',
    'OIL': 'Energy',
    'GAS': 'Energy',
    'POWER': 'Energy',
    'SOLAR': 'Energy',
    'WIND': 'Energy',
    'RENEWABLE': 'Energy',
    
    // Consumer
    'RETAIL': 'Consumer Discretionary',
    'FOOD': 'Consumer Staples',
    'BEVERAGE': 'Consumer Staples',
    'RESTAURANT': 'Consumer Discretionary',
    'HOTEL': 'Consumer Discretionary',
    'TRAVEL': 'Consumer Discretionary',
    
    // Industrial
    'INDUSTRIAL': 'Industrials',
    'MANUFACTURING': 'Industrials',
    'AUTOMOTIVE': 'Consumer Discretionary',
    'AEROSPACE': 'Industrials',
    'DEFENSE': 'Industrials',
    
    // Communication
    'MEDIA': 'Communication Services',
    'ENTERTAINMENT': 'Communication Services',
    'STREAMING': 'Communication Services',
    'SOCIAL': 'Communication Services',
    
    // Real Estate
    'REIT': 'Real Estate',
    'REAL': 'Real Estate',
    'PROPERTY': 'Real Estate',
    
    // Materials
    'MATERIALS': 'Materials',
    'MINING': 'Materials',
    'CHEMICAL': 'Materials',
    'STEEL': 'Materials',
    
    // Utilities
    'UTILITY': 'Utilities',
    'UTILITIES': 'Utilities',
    'ELECTRIC': 'Utilities',
    'WATER': 'Utilities'
  };
  
  // Determine sector based on symbol patterns
  let sector = 'Technology'; // Default
  let industry = 'Software'; // Default
  
  for (const [pattern, sectorName] of Object.entries(sectorPatterns)) {
    if (symbolUpper.includes(pattern)) {
      sector = sectorName;
      industry = getIndustryForSector(sectorName);
      break;
    }
  }
  
  // Estimate market cap based on symbol length and patterns
  let marketCap = '1B'; // Default
  
  // Longer symbols often indicate smaller companies
  if (symbolUpper.length >= 5) {
    marketCap = '500M';
  } else if (symbolUpper.length === 4) {
    marketCap = '2B';
  } else if (symbolUpper.length <= 3) {
    marketCap = '5B';
  }
  
  // Adjust market cap based on sector
  if (sector === 'Technology' && symbolUpper.includes('AI')) {
    marketCap = '3B';
  } else if (sector === 'Financial Services' && symbolUpper.includes('BANK')) {
    marketCap = '10B';
  } else if (sector === 'Healthcare' && symbolUpper.includes('BIO')) {
    marketCap = '800M';
  }
  
  return {
    marketCap,
    sector,
    industry,
    name: `${symbolUpper} Corporation` // Generic name
  };
}

// Get industry based on sector
function getIndustryForSector(sector: string): string {
  const industryMap: { [key: string]: string } = {
    'Technology': 'Software',
    'Financial Services': 'Financial Technology',
    'Healthcare': 'Biotechnology',
    'Energy': 'Oil & Gas',
    'Consumer Discretionary': 'Retail',
    'Consumer Staples': 'Food & Beverage',
    'Industrials': 'Manufacturing',
    'Communication Services': 'Entertainment',
    'Real Estate': 'Real Estate Investment Trusts',
    'Materials': 'Chemicals',
    'Utilities': 'Electric Utilities'
  };
  
  return industryMap[sector] || 'Software';
}

// Get next API key for rotation
function getNextApiKey(): string {
  const key = API_KEYS[currentApiKeyIndex];
  currentApiKeyIndex = (currentApiKeyIndex + 1) % API_KEYS.length;
  return key;
}

// Enhanced function to enrich stock data from multiple sources
async function enrichStockData(symbol: string, baseData: Partial<StockQuote>): Promise<Partial<StockQuote>> {
  console.log(`🔍 [ENRICHMENT] Enriching data for ${symbol}`);
  
  // Start with base data
  let enrichedData = { ...baseData };
  
  // Try to get additional data from Yahoo Finance
  const yahooData = await getYahooFinanceData(symbol);
  if (yahooData) {
    enrichedData = { ...enrichedData, ...yahooData };
  }
  
  // If we still don't have complete data, use intelligent fallback
  if (!enrichedData.marketCap || !enrichedData.sector) {
    console.log(`🧠 [ENRICHMENT] Missing data for ${symbol}, using intelligent fallback`);
    const fallbackData = getFallbackCompanyData(symbol);
    enrichedData = { ...enrichedData, ...fallbackData };
  }
  
  console.log(`✅ [ENRICHMENT] Enriched data for ${symbol}:`, enrichedData);
  return enrichedData;
}

// Function to get detailed company data from Yahoo Finance quoteSummary endpoint
// Now uses backend proxy to bypass CORS issues
async function getYahooFinanceData(symbol: string): Promise<Partial<StockQuote> | null> {
  try {
    // Use backend endpoint to bypass CORS restrictions
    const API_BASE_URL = 'http://localhost:8000';
    const url = `${API_BASE_URL}/api/stocks/quote-summary/${symbol}`;
    
    console.log(`📊 [YAHOO DETAILED] Fetching detailed data for ${symbol} via backend`);
    console.log(`📊 [YAHOO DETAILED] Backend URL: ${url}`);
    
    const response = await fetch(url);
    console.log(`📊 [YAHOO DETAILED] Response status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`📦 [YAHOO DETAILED] Backend response data:`, data);
      
      // Backend already parses and formats the data
      const additionalData: Partial<StockQuote> = {
        name: data.name,
        marketCap: data.marketCap || 'N/A',
        sector: data.sector || 'N/A',
        industry: data.industry || 'N/A',
        peRatio: data.peRatio,
        employees: data.employees,
        headquarters: data.headquarters,
        website: data.website,
        description: data.description
      };
      
      console.log(`✅ [YAHOO DETAILED] Successfully fetched detailed data for ${symbol}:`, additionalData);
      console.log(`📋 [YAHOO DETAILED] Summary - Market Cap: ${additionalData.marketCap || 'NOT FOUND'}, Sector: ${additionalData.sector || 'NOT FOUND'}, Industry: ${additionalData.industry || 'NOT FOUND'}, P/E: ${additionalData.peRatio || 'NOT FOUND'}`);
      return additionalData;
    } else {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }));
      console.log(`❌ [YAHOO DETAILED] Backend HTTP error: ${response.status} - ${errorData.detail || response.statusText}`);
    }
  } catch (error) {
    console.log(`❌ [YAHOO DETAILED] Failed to fetch detailed data for ${symbol}:`, error);
  }
  
  // Fallback to chart endpoint if quoteSummary fails
  try {
    console.log(`🔄 [YAHOO] Trying fallback chart endpoint for ${symbol}`);
    const proxyUrl = 'https://corsproxy.io/?';
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
    const url = proxyUrl + encodeURIComponent(yahooUrl);
    
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      if (data.chart && data.chart.result && data.chart.result[0]) {
        const meta = data.chart.result[0].meta;
        const additionalData: Partial<StockQuote> = {};
        
        // Extract basic info from chart endpoint
        if (meta.marketCap) {
          const marketCap = meta.marketCap;
          if (marketCap >= 1e12) {
            additionalData.marketCap = `${(marketCap / 1e12).toFixed(1)}T`;
          } else if (marketCap >= 1e9) {
            additionalData.marketCap = `${(marketCap / 1e9).toFixed(1)}B`;
          } else if (marketCap >= 1e6) {
            additionalData.marketCap = `${(marketCap / 1e6).toFixed(1)}M`;
          }
        }
        
        if (meta.sector) additionalData.sector = meta.sector;
        if (meta.industry) additionalData.industry = meta.industry;
        if (meta.trailingPE) additionalData.peRatio = meta.trailingPE;
        if (meta.longName) additionalData.name = meta.longName;
        
        return Object.keys(additionalData).length > 0 ? additionalData : null;
      }
    }
  } catch (error) {
    console.log(`❌ [YAHOO] Fallback also failed:`, error);
  }
  
  return null;
}

// Test function to verify Polygon API integration
export async function testPolygonIntegration(symbol: string = 'AAPL') {
  console.log(`🧪 [TEST] Testing Polygon integration for ${symbol}`);
  
  try {
    const result = await tryPolygon(symbol);
    if (result) {
      console.log(`✅ [TEST] Polygon test successful for ${symbol}:`, {
        symbol: result.symbol,
        name: result.name,
        price: result.price,
        marketCap: result.marketCap,
        sector: result.sector
      });
    } else {
      console.log(`❌ [TEST] Polygon test failed for ${symbol}`);
    }
  } catch (error) {
    console.log(`💥 [TEST] Polygon test error for ${symbol}:`, error);
  }
}

// Test function to verify market cap parsing
export function testMarketCapParsing() {
  const testCases = [
    { input: '2.8T', expected: 2800000000000 },
    { input: '790B', expected: 790000000000 },
    { input: '270B', expected: 270000000000 },
    { input: 'N/A', expected: 0 },
    { input: undefined, expected: 0 }
  ];
  
  console.log('🧪 [TEST] Testing market cap parsing:');
  testCases.forEach(({ input, expected }) => {
    const result = input && input !== 'N/A' ? 
      parseFloat(input.replace(/[TBMK]/g, '')) * 
      (input.includes('T') ? 1000000000000 : 
       input.includes('B') ? 1000000000 : 
       input.includes('M') ? 1000000 : 
       input.includes('K') ? 1000 : 1) : 0;
    
    console.log(`🧪 [TEST] Input: "${input}" -> Expected: ${expected}, Got: ${result}, Match: ${result === expected ? '✅' : '❌'}`);
  });
}

// Clear cache function
export function clearCache(): void {
  quoteCache.clear();
  searchCache.clear();
  console.log('Stock data cache cleared');
}

// Logo cache to avoid repeated API calls
const logoCache = new Map<string, { logo: string; timestamp: number }>();
const LOGO_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Function to fetch company logo
export async function fetchCompanyLogo(symbol: string, companyName: string): Promise<string | null> {
  // Check cache first
  const cached = logoCache.get(symbol);
  if (cached && isCacheValid(cached.timestamp)) {
    console.log(`🖼️ [LOGO] Using cached logo for ${symbol}`);
    return cached.logo;
  }

  console.log(`🖼️ [LOGO] Fetching logo for ${symbol} (${companyName})`);

  try {
    // Logo.dev - Professional company logos with multiple formats and themes
    const LOGO_DEV_API_KEY = 'pk_H8Rx3779QFybwBciHTRsDw';
    
    // Get company domain for Logo.dev
    const companyDomain = getCompanyDomain(symbol, companyName);
    
    // Try multiple logo sources with Logo.dev as primary
    const logoUrls = [
      // Primary: Logo.dev with domain (supports WebP, PNG, JPG + light/dark themes)
      `https://img.logo.dev/${companyDomain}?token=${LOGO_DEV_API_KEY}&size=64&format=webp`,
      `https://img.logo.dev/${companyDomain}?token=${LOGO_DEV_API_KEY}&size=64&format=png`,
      // Secondary: Logo.dev with company name fallback
      `https://img.logo.dev/${companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com?token=${LOGO_DEV_API_KEY}&size=64&format=webp`,
      // Tertiary: Simple Icons fallback
      `https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/${symbol.toLowerCase()}.svg`,
      // Quaternary: Clearbit fallback
      `https://logo.clearbit.com/${companyDomain}`,
      // Quinary: Alternative services
      `https://financialmodelingprep.com/image-stock/${symbol}.png`,
    ].filter(Boolean); // Remove undefined values

    for (const url of logoUrls) {
      try {
        console.log(`🖼️ [LOGO] Trying URL: ${url}`);
        const response = await fetch(url, { 
          method: 'HEAD', // Just check if the image exists
          mode: 'no-cors' // Avoid CORS issues
        });
        
        if (response.ok || response.type === 'opaque') {
          console.log(`✅ [LOGO] Found logo for ${symbol} at ${url}`);
          logoCache.set(symbol, { logo: url, timestamp: Date.now() });
          return url;
        }
      } catch (error) {
        console.log(`❌ [LOGO] Failed to fetch from ${url}:`, error);
        continue;
      }
    }

    // Fallback: Use a generic company icon
    const fallbackLogo = `https://via.placeholder.com/64x64/374151/10b981?text=${symbol.charAt(0)}`;
    console.log(`🖼️ [LOGO] Using fallback logo for ${symbol}`);
    logoCache.set(symbol, { logo: fallbackLogo, timestamp: Date.now() });
    return fallbackLogo;

  } catch (error) {
    console.error(`💥 [LOGO] Error fetching logo for ${symbol}:`, error);
    return null;
  }
}

// Helper function to get company domain based on symbol
function getCompanyDomain(symbol: string, companyName: string): string {
  const domainMap: { [key: string]: string } = {
    'NVDA': 'nvidia.com',
    'AAPL': 'apple.com',
    'MSFT': 'microsoft.com',
    'GOOGL': 'google.com',
    'AMZN': 'amazon.com',
    'TSLA': 'tesla.com',
    'META': 'meta.com',
    'NFLX': 'netflix.com',
    'AMD': 'amd.com',
    'INTC': 'intel.com',
    'CRM': 'salesforce.com',
    'ADBE': 'adobe.com',
    'PYPL': 'paypal.com',
    'UBER': 'uber.com',
    'LYFT': 'lyft.com',
    'SPOT': 'spotify.com',
    'SQ': 'squareup.com',
    'ROKU': 'roku.com',
    'ZM': 'zoom.us',
    'DOCU': 'docusign.com',
  };

  return domainMap[symbol] || `${companyName.toLowerCase().replace(/\s+/g, '')}.com`;
}

export interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: string;
  sector: string;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  logo?: string;
  // Additional company data
  peRatio?: number;
  employees?: number;
  headquarters?: string;
  founded?: string;
  website?: string;
  description?: string;
  industry?: string;
}

export interface StockSearchResult {
  symbol: string;
  name: string;
  type: string;
  region: string;
  marketOpen: string;
  marketClose: string;
  timezone: string;
  currency: string;
  matchScore: number;
}

// Get real-time stock quote with multiple API sources
export async function getStockQuote(symbol: string, bypassCache: boolean = false): Promise<StockQuote | null> {
  console.log(`🔍 [STOCK DATA] Starting getStockQuote for symbol: ${symbol}${bypassCache ? ' (bypassing cache)' : ''}`);
  const symbolUpper = symbol.toUpperCase();
  
  // Check cache first (unless bypassing)
  if (!bypassCache) {
    const cached = quoteCache.get(symbolUpper);
    if (cached && isCacheValid(cached.timestamp)) {
      console.log(`📦 [STOCK DATA] Using cached quote for ${symbolUpper}`);
      return cached.data;
    }
  } else {
    // For real-time updates, check if cache is very fresh (within 1 second)
    // If so, use it to avoid excessive API calls while still keeping data fresh
    const cached = quoteCache.get(symbolUpper);
    if (cached && (Date.now() - cached.timestamp) < REAL_TIME_CACHE_DURATION) {
      console.log(`📦 [STOCK DATA] Using very fresh cached quote for ${symbolUpper} (real-time mode)`);
      return cached.data;
    }
    // Otherwise, clear cache entry to force fresh fetch
    console.log(`🔄 [STOCK DATA] Bypassing cache for ${symbolUpper} (real-time update) - fetching fresh data`);
    quoteCache.delete(symbolUpper);
  }
  
  console.log(`🌐 [STOCK DATA] No valid cache found, trying API sources for ${symbolUpper}`);
  
  // Try multiple sources in order of preference (Yahoo Finance first - more reliable)
  const sources = [
    { name: 'Yahoo Finance', fn: () => tryYahooFinance(symbolUpper) },
    { name: 'Polygon', fn: () => tryPolygon(symbolUpper) },
    { name: 'Alpha Vantage', fn: () => tryAlphaVantage(symbolUpper) },
    { name: 'IEX Cloud', fn: () => tryIEXCloud(symbolUpper) }
  ];
  
  for (const source of sources) {
    try {
      console.log(`🚀 [STOCK DATA] Trying ${source.name} for ${symbolUpper}`);
        const result = await source.fn();
        if (result) {
        // Check if Polygon already provided market cap and sector data
        const hasPolygonData = result.marketCap && result.marketCap !== 'N/A' && result.sector && result.sector !== 'N/A';
        
        if (hasPolygonData) {
          console.log(`✅ [STOCK DATA] Polygon provided complete data for ${symbolUpper}, skipping Yahoo Finance`);
          const mergedResult = {
            ...result,
            logo: result.logo || await fetchCompanyLogo(symbolUpper, result.name)
          };
          
          console.log(`📊 [STOCK DATA] Final merged result for ${symbolUpper}:`, mergedResult);
          
          // Cache the successful result
          quoteCache.set(symbolUpper, { data: mergedResult, timestamp: Date.now() });
          console.log(`✅ [STOCK DATA] Successfully fetched quote for ${symbolUpper} from ${source.name}:`, mergedResult);
          return mergedResult;
        } else {
          // For Yahoo Finance, result already has good data - return it immediately
          // Don't block on additional enrichment calls that might timeout
          console.log(`✅ [STOCK DATA] Yahoo Finance provided good data for ${symbolUpper}, returning immediately`);
          
          // Cache and return immediately - enrichment can happen async if needed later
          quoteCache.set(symbolUpper, { data: result, timestamp: Date.now() });
          console.log(`✅ [STOCK DATA] Successfully fetched quote for ${symbolUpper} from ${source.name}:`, result);
          return result;
        }
      } else {
        console.log(`❌ [STOCK DATA] ${source.name} returned null for ${symbolUpper}`);
      }
    } catch (error) {
      console.log(`💥 [STOCK DATA] ${source.name} failed for ${symbolUpper}:`, error);
      continue;
    }
  }
  
  // Only use mock data as absolute last resort
  console.log(`🎭 [STOCK DATA] All API sources failed for ${symbolUpper}, using mock data`);
  const mockQuote = getMockStockQuote(symbolUpper);
  quoteCache.set(symbolUpper, { data: mockQuote, timestamp: Date.now() });
  console.log(`🎭 [STOCK DATA] Mock quote created for ${symbolUpper}:`, mockQuote);
  return mockQuote;
}

// Try Alpha Vantage API with key rotation
async function tryAlphaVantage(symbol: string): Promise<StockQuote | null> {
  const apiKey = getNextApiKey();
  const response = await fetch(
    `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`
  );
  
  const data = await response.json();
  
  // Check for API limit message
  if (data['Note']) {
    throw new Error('Alpha Vantage API limit reached');
  }
  
  // Check for error message
  if (data['Error Message']) {
    throw new Error(`Alpha Vantage error: ${data['Error Message']}`);
  }
  
  if (data['Global Quote']) {
    const quote = data['Global Quote'];
    return {
      symbol: quote['01. symbol'],
      name: quote['01. symbol'],
      price: parseFloat(quote['05. price']),
      change: parseFloat(quote['09. change']),
      changePercent: parseFloat(quote['10. change percent'].replace('%', '')),
      volume: parseInt(quote['06. volume']),
      marketCap: 'N/A',
      sector: 'N/A',
      high: parseFloat(quote['03. high']),
      low: parseFloat(quote['04. low']),
      open: parseFloat(quote['02. open']),
      previousClose: parseFloat(quote['08. previous close'])
    };
  }
  
  return null;
}

// Try Yahoo Finance API with CORS proxy
async function tryYahooFinance(symbol: string): Promise<StockQuote | null> {
  console.log(`📡 [YAHOO] Starting Yahoo Finance request for ${symbol}`);
  try {
    // Use a CORS proxy to bypass browser restrictions
    const proxyUrl = 'https://corsproxy.io/?';
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
    const fullUrl = proxyUrl + encodeURIComponent(yahooUrl);
    
    console.log(`📡 [YAHOO] Making request to: ${fullUrl}`);
    
    const response = await fetch(fullUrl);
    
    console.log(`📡 [YAHOO] Response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      throw new Error(`Yahoo Finance API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`📡 [YAHOO] Raw response data:`, data);
    
    if (data.chart && data.chart.result && data.chart.result[0]) {
      const result = data.chart.result[0];
      const meta = result.meta;
      
      console.log(`📡 [YAHOO] Meta data:`, meta);
      
      if (!meta) {
        throw new Error('Invalid data from Yahoo Finance - missing meta');
      }
      
      // Try different price fields
      const currentPrice = meta.regularMarketPrice || meta.previousClose || meta.close || 0;
      if (!currentPrice || currentPrice === 0) {
        console.log(`❌ [YAHOO] No valid price found for ${symbol}, trying alternative fields`);
        console.log(`📡 [YAHOO] Available price fields:`, {
          regularMarketPrice: meta.regularMarketPrice,
          previousClose: meta.previousClose,
          close: meta.close,
          open: meta.open,
          high: meta.high,
          low: meta.low
        });
        throw new Error('Invalid data from Yahoo Finance - no valid price found');
      }
      
      const previousClose = meta.previousClose || meta.close || currentPrice;
      const change = currentPrice - previousClose;
      const changePercent = previousClose ? (change / previousClose) * 100 : 0;
      
      // Extract all available data from chart endpoint's meta first
      console.log(`📦 [YAHOO] Available meta fields:`, Object.keys(meta));
      console.log(`📦 [YAHOO] Full meta object:`, meta);
      
      // Extract market cap from meta (available in chart endpoint)
      let marketCapFormatted = 'N/A';
      if (meta.marketCap) {
        const marketCapValue = typeof meta.marketCap === 'number' ? meta.marketCap : 
                              (typeof meta.marketCap === 'object' && meta.marketCap.raw) ? meta.marketCap.raw :
                              parseFloat(meta.marketCap);
        if (marketCapValue && !isNaN(marketCapValue)) {
          marketCapFormatted = marketCapValue >= 1e12 ? `${(marketCapValue / 1e12).toFixed(1)}T` :
                              marketCapValue >= 1e9 ? `${(marketCapValue / 1e9).toFixed(1)}B` :
                              marketCapValue >= 1e6 ? `${(marketCapValue / 1e6).toFixed(1)}M` :
                              marketCapValue >= 1e3 ? `${(marketCapValue / 1e3).toFixed(1)}K` :
                              marketCapValue.toFixed(0);
          console.log(`📊 [YAHOO] Market cap from meta: ${marketCapValue} -> ${marketCapFormatted}`);
        }
      }
      
      // Extract sector and industry from meta
      const sector = meta.sector || undefined;
      const industry = meta.industry || undefined;
      console.log(`📊 [YAHOO] Sector from meta: ${sector}, Industry: ${industry}`);
      
      // Extract P/E ratio from meta
      let peRatio: number | undefined;
      if (meta.trailingPE !== undefined && meta.trailingPE !== null) {
        peRatio = typeof meta.trailingPE === 'number' ? meta.trailingPE : parseFloat(meta.trailingPE);
        if (isNaN(peRatio)) peRatio = undefined;
      } else if (meta.forwardPE !== undefined && meta.forwardPE !== null) {
        peRatio = typeof meta.forwardPE === 'number' ? meta.forwardPE : parseFloat(meta.forwardPE);
        if (isNaN(peRatio)) peRatio = undefined;
      }
      console.log(`📊 [YAHOO] P/E ratio from meta: ${peRatio}`);
      
      // Extract employees from meta
      const employees = meta.fullTimeEmployees || (meta.employees ? parseInt(meta.employees) : undefined);
      console.log(`📊 [YAHOO] Employees from meta: ${employees}`);
      
      // Extract headquarters from meta
      let headquarters: string | undefined;
      if (meta.city || meta.state || meta.country) {
        const parts = [meta.city, meta.state].filter(Boolean);
        if (meta.country && meta.country !== 'United States' && meta.country !== 'US') {
          parts.push(meta.country);
        }
        headquarters = parts.length > 0 ? parts.join(', ') : undefined;
      }
      console.log(`📊 [YAHOO] Headquarters from meta: ${headquarters}`);
      
      // Extract website from meta
      const website = meta.website || undefined;
      console.log(`📊 [YAHOO] Website from meta: ${website}`);
      
      // Try to get additional data from quoteSummary endpoint (may fail with 401 or be slow)
      // Add timeout to prevent hanging - Top Movers doesn't need all the detailed data
      // Use Promise.race with timeout to avoid blocking
      let detailedData: Partial<StockQuote> | null = null;
      try {
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout after 2 seconds')), 2000) // 2 second timeout for faster response
        );
        const dataPromise = getYahooFinanceData(symbol);
        detailedData = await Promise.race([
          dataPromise,
          timeoutPromise
        ]) as Partial<StockQuote> | null;
        console.log(`📊 [YAHOO] Detailed data from quoteSummary:`, detailedData);
      } catch (error: any) {
        // Timeout or error - continue with basic data from chart endpoint (good enough for Top Movers)
        if (error?.message?.includes('Timeout')) {
          console.log(`⏱️ [YAHOO] quoteSummary timeout (2s), using chart endpoint data only`);
        } else {
          console.log(`⚠️ [YAHOO] quoteSummary endpoint failed, using chart endpoint data only`);
        }
      }
      
      // Build stock quote with meta data as primary source, detailed data as enhancement
      const stockQuote: StockQuote = {
        symbol: meta.symbol,
        name: detailedData?.name || meta.longName || meta.shortName || meta.symbol,
        price: currentPrice,
        change: change,
        changePercent: changePercent,
        volume: meta.regularMarketVolume || 0,
        marketCap: detailedData?.marketCap || marketCapFormatted,
        sector: detailedData?.sector || sector || 'N/A',
        industry: detailedData?.industry || industry || 'N/A',
        high: meta.regularMarketDayHigh || currentPrice,
        low: meta.regularMarketDayLow || currentPrice,
        open: meta.regularMarketOpen || currentPrice,
        previousClose: previousClose,
        logo: '', // Logo will be fetched separately to avoid blocking (TODO: fetch asynchronously)
        // Additional company data - use detailed data if available, otherwise meta
        peRatio: detailedData?.peRatio || peRatio,
        employees: detailedData?.employees || employees,
        headquarters: detailedData?.headquarters || headquarters,
        website: detailedData?.website || website,
        description: detailedData?.description || meta.longBusinessSummary || undefined
      };
      
      console.log(`✅ [YAHOO] Successfully parsed quote for ${symbol}:`, stockQuote);
      return stockQuote;
    }
    
    console.log(`❌ [YAHOO] No chart data found for ${symbol}`);
    return null;
  } catch (error) {
    console.log(`💥 [YAHOO] Yahoo Finance API failed for ${symbol}:`, error);
    return null;
  }
}

// Try IEX Cloud API (free tier available)
async function tryIEXCloud(symbol: string): Promise<StockQuote | null> {
  if (IEX_CLOUD_API_KEY === 'pk_test_1234567890abcdef') {
    // Skip if no real API key provided
    return null;
  }
  
  try {
    const response = await fetch(
      `https://cloud.iexapis.com/stable/stock/${symbol}/quote?token=${IEX_CLOUD_API_KEY}`
    );
    
    if (!response.ok) {
      throw new Error(`IEX Cloud API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    return {
      symbol: data.symbol,
      name: data.companyName,
      price: data.latestPrice,
      change: data.change,
      changePercent: data.changePercent * 100, // Convert to percentage
      volume: data.volume,
      marketCap: data.marketCap ? `${(data.marketCap / 1e9).toFixed(1)}B` : 'N/A',
      sector: data.sector || 'N/A',
      high: data.high,
      low: data.low,
      open: data.open,
      previousClose: data.previousClose
    };
  } catch (error) {
    console.log(`IEX Cloud API failed for ${symbol}:`, error);
    return null;
  }
}

// Try Polygon API via backend (free tier available)
async function tryPolygon(symbol: string): Promise<StockQuote | null> {
  try {
    console.log(`🚀 [POLYGON] Fetching quote for ${symbol} via backend`);
    
    // Call backend endpoint which uses Polygon API (API key is on backend)
    const API_BASE_URL = 'http://localhost:8000';
    const response = await fetch(`${API_BASE_URL}/api/stocks/quote-summary/${symbol}`);
    
    if (!response.ok) {
      console.log(`❌ [POLYGON] Backend returned ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (!data || !data.price) {
      console.log(`❌ [POLYGON] Invalid data from backend`);
      return null;
    }
    
    console.log(`✅ [POLYGON] Got quote from backend: $${data.price}`);
    
    // Format as StockQuote
    return {
      symbol: data.symbol || symbol,
      name: data.name || 'N/A',
      price: data.price || 0,
      change: data.change || 0,
      changePercent: data.changePercent || 0,
      marketCap: data.marketCap || 'N/A',
      marketCapRaw: data.marketCapRaw || 0,
      peRatio: data.peRatio || null,
      sector: data.sector || 'N/A',
      industry: data.industry || 'N/A',
      volume: data.volume || 0,
      employees: data.employees || 0,
      headquarters: data.headquarters || 'N/A',
      website: data.website || '',
      description: data.description || '',
      logo: data.logo || '',
      previousClose: data.previousClose || 0,
      high: data.high || 0,
      low: data.low || 0,
      open: data.open || 0,
      founded: data.founded || 'N/A',
    };
  } catch (error) {
    console.error(`❌ [POLYGON] Error fetching from backend:`, error);
    return null;
  }
}

// Mock stock quote for fallback - Updated with more realistic prices
function getMockStockQuote(symbol: string): StockQuote {
  const mockPrices: { [key: string]: { price: number, change: number, changePercent: number, marketCap: string, sector: string } } = {
    'AAPL': { price: 175.43, change: 2.15, changePercent: 1.24, marketCap: '2.8T', sector: 'Technology' },
    'MSFT': { price: 378.85, change: -1.25, changePercent: -0.33, marketCap: '2.8T', sector: 'Technology' },
    'GOOGL': { price: 142.56, change: 0.89, changePercent: 0.63, marketCap: '1.8T', sector: 'Communication Services' },
    'AMZN': { price: 155.12, change: -0.45, changePercent: -0.29, marketCap: '1.6T', sector: 'Consumer Discretionary' },
    'TSLA': { price: 248.50, change: 5.20, changePercent: 2.14, marketCap: '790B', sector: 'Consumer Discretionary' },
    'NVDA': { price: 179.41, change: -1.75, changePercent: -0.97, marketCap: '4.3T', sector: 'Technology' },
    'META': { price: 485.20, change: 8.15, changePercent: 1.71, marketCap: '1.2T', sector: 'Communication Services' },
    'NFLX': { price: 612.45, change: -2.30, changePercent: -0.37, marketCap: '270B', sector: 'Communication Services' },
    'AMD': { price: 128.90, change: 1.85, changePercent: 1.46, marketCap: '200B', sector: 'Technology' },
    'INTC': { price: 43.25, change: -0.55, changePercent: -1.26, marketCap: '180B', sector: 'Technology' }
  };
  
  const mockData = mockPrices[symbol.toUpperCase()] || { 
    price: 100.00, 
    change: 0.00, 
    changePercent: 0.00, 
    marketCap: '100B', 
    sector: 'Technology' 
  };
  
  return {
    symbol: symbol.toUpperCase(),
    name: symbol.toUpperCase(),
    price: mockData.price,
    change: mockData.change,
    changePercent: mockData.changePercent,
    volume: 45000000,
    marketCap: mockData.marketCap,
    sector: mockData.sector,
    high: mockData.price + Math.random() * 5,
    low: mockData.price - Math.random() * 5,
    open: mockData.price + (Math.random() - 0.5) * 2,
    previousClose: mockData.price - mockData.change
  };
}

// Search for stocks with multiple sources
export async function searchStocks(query: string): Promise<StockSearchResult[]> {
  console.log(`🔍 [SEARCH] Starting search for: "${query}"`);
  const queryLower = query.toLowerCase().trim();
  
  // Check cache first
  const cached = searchCache.get(queryLower);
  if (cached && isCacheValid(cached.timestamp)) {
    console.log(`📦 [SEARCH] Using cached search results for "${query}"`);
    return cached.data;
  }
  
  console.log(`🌐 [SEARCH] No valid cache found, trying search sources for "${query}"`);
  
  // Try multiple search sources
  const searchSources = [
    { name: 'Yahoo Finance Search', fn: () => tryYahooFinanceSearch(query) },
    { name: 'IEX Cloud Search', fn: () => tryIEXCloudSearch(query) },
    { name: 'Alpha Vantage Search', fn: () => tryAlphaVantageSearch(query) },
    { name: 'Fallback Search', fn: () => getFallbackSearchResults(query) }
  ];
  
  for (const source of searchSources) {
    try {
      console.log(`🚀 [SEARCH] Trying ${source.name} for "${query}"`);
      const results = await source.fn();
      if (results && results.length > 0) {
        // Cache the successful results
        searchCache.set(queryLower, { data: results, timestamp: Date.now() });
        console.log(`✅ [SEARCH] Successfully fetched ${results.length} results for "${query}" from ${source.name}:`, results);
        return results;
      } else {
        console.log(`❌ [SEARCH] ${source.name} returned no results for "${query}"`);
      }
    } catch (error) {
      console.log(`💥 [SEARCH] ${source.name} failed for "${query}":`, error);
      continue;
    }
  }
  
  // Fallback to mock data
  console.log(`🎭 [SEARCH] All search sources failed for "${query}", using fallback`);
  const fallbackResults = getFallbackSearchResults(query);
  searchCache.set(queryLower, { data: fallbackResults, timestamp: Date.now() });
  console.log(`🎭 [SEARCH] Fallback results for "${query}":`, fallbackResults);
  return fallbackResults;
}

// Try IEX Cloud search
async function tryIEXCloudSearch(query: string): Promise<StockSearchResult[]> {
  if (IEX_CLOUD_API_KEY === 'pk_test_1234567890abcdef') {
    // Skip if no real API key provided
    return [];
  }
  
  try {
    const response = await fetch(
      `https://cloud.iexapis.com/stable/search/${query}?token=${IEX_CLOUD_API_KEY}`
    );
    
    if (!response.ok) {
      throw new Error(`IEX Cloud search error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (Array.isArray(data)) {
      return data.slice(0, 10).map((item: any) => ({
        symbol: item.symbol,
        name: item.name,
        type: 'Equity',
        region: 'United States',
        marketOpen: '09:30',
        marketClose: '16:00',
        timezone: 'UTC-05:00',
        currency: 'USD',
        matchScore: 1.0
      }));
    }
    
    return [];
  } catch (error) {
    console.log(`IEX Cloud search failed for "${query}":`, error);
    return [];
  }
}

// Try Alpha Vantage search with key rotation
async function tryAlphaVantageSearch(query: string): Promise<StockSearchResult[]> {
  const apiKey = getNextApiKey();
  const response = await fetch(
    `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${query}&apikey=${apiKey}`
  );
  
  const data = await response.json();
  
  // Check for API limit message
  if (data['Note']) {
    throw new Error('Alpha Vantage API limit reached');
  }
  
  // Check for error message
  if (data['Error Message']) {
    throw new Error(`Alpha Vantage error: ${data['Error Message']}`);
  }
  
  if (data['bestMatches']) {
    return data['bestMatches'].map((match: any) => ({
      symbol: match['1. symbol'],
      name: match['2. name'],
      type: match['3. type'],
      region: match['4. region'],
      marketOpen: match['5. marketOpen'],
      marketClose: match['6. marketClose'],
      timezone: match['7. timezone'],
      currency: match['8. currency'],
      matchScore: parseFloat(match['9. matchScore'])
    }));
  }
  
  return [];
}

// Try Yahoo Finance search (enhanced functionality)
async function tryYahooFinanceSearch(query: string): Promise<StockSearchResult[]> {
  console.log(`🔍 [YAHOO SEARCH] Starting search for: "${query}"`);
  
  // First, try common symbol mappings for company names
  const symbolMappings: { [key: string]: string } = {
    'nvidia': 'NVDA',
    'nvd': 'NVDA',
    'nvdi': 'NVDA',
    'nvdia': 'NVDA',
    'apple': 'AAPL',
    'microsoft': 'MSFT',
    'ms': 'MSFT',
    'google': 'GOOGL',
    'goog': 'GOOGL',
    'amazon': 'AMZN',
    'amz': 'AMZN',
    'tesla': 'TSLA',
    'meta': 'META',
    'facebook': 'META',
    'fb': 'META',
    'netflix': 'NFLX',
    'nflx': 'NFLX',
    'amd': 'AMD',
    'intel': 'INTC',
    'intc': 'INTC',
    'jpmorgan': 'JPM',
    'jpm': 'JPM',
    'johnson': 'JNJ',
    'jnj': 'JNJ',
    'visa': 'V',
    'procter': 'PG',
    'pg': 'PG',
    'unitedhealth': 'UNH',
    'unh': 'UNH',
    'homedepot': 'HD',
    'hd': 'HD',
    'mastercard': 'MA',
    'disney': 'DIS',
    'paypal': 'PYPL',
    'pypl': 'PYPL',
    'adobe': 'ADBE',
    'adbe': 'ADBE',
    'salesforce': 'CRM',
    'crm': 'CRM',
    'comcast': 'CMCSA',
    'cmcsa': 'CMCSA',
    'pfizer': 'PFE',
    'pfe': 'PFE',
    'abbott': 'ABT',
    'abt': 'ABT',
    'thermo': 'TMO',
    'tmo': 'TMO',
    'costco': 'COST',
    'cost': 'COST',
    'accenture': 'ACN',
    'acn': 'ACN',
    'broadcom': 'AVGO',
    'avgo': 'AVGO',
    'texas': 'TXN',
    'txn': 'TXN',
    'qualcomm': 'QCOM',
    'qcom': 'QCOM',
    'charter': 'CHTR',
    'chtr': 'CHTR'
  };
  
  const queryLower = query.toLowerCase().trim();
  
  // Check if it's a company name we know
  if (symbolMappings[queryLower]) {
    const symbol = symbolMappings[queryLower];
    console.log(`🔍 [YAHOO SEARCH] Found mapping: "${query}" -> "${symbol}"`);
    
    try {
      const quote = await tryYahooFinance(symbol);
      if (quote) {
        console.log(`✅ [YAHOO SEARCH] Successfully got quote for ${symbol}`);
        return [{
          symbol: quote.symbol,
          name: quote.name,
          type: 'Equity',
          region: 'United States',
          marketOpen: '09:30',
          marketClose: '16:00',
          timezone: 'UTC-05:00',
          currency: 'USD',
          matchScore: 1.0
        }];
      }
    } catch (error) {
      console.log(`💥 [YAHOO SEARCH] Failed to get quote for mapped symbol ${symbol}:`, error);
    }
  }
  
  // Try the query as a direct symbol
  try {
    console.log(`🔍 [YAHOO SEARCH] Trying "${query}" as direct symbol`);
    const exactQuote = await tryYahooFinance(query.toUpperCase());
    if (exactQuote) {
      console.log(`✅ [YAHOO SEARCH] Successfully got quote for direct symbol ${query.toUpperCase()}`);
      return [{
        symbol: exactQuote.symbol,
        name: exactQuote.name,
        type: 'Equity',
        region: 'United States',
        marketOpen: '09:30',
        marketClose: '16:00',
        timezone: 'UTC-05:00',
        currency: 'USD',
        matchScore: 1.0
      }];
    }
  } catch (error) {
    console.log(`💥 [YAHOO SEARCH] Failed to get quote for direct symbol ${query}:`, error);
  }
  
  // Fallback: search common symbols that match the query
  const commonSymbols = [
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'NFLX', 'AMD', 'INTC',
    'JPM', 'JNJ', 'V', 'PG', 'UNH', 'HD', 'MA', 'DIS', 'PYPL', 'ADBE', 'CRM',
    'CMCSA', 'PFE', 'ABT', 'TMO', 'COST', 'ACN', 'AVGO', 'TXN', 'QCOM', 'CHTR'
  ];
  
  // Only search for partial matches if query is at least 3 characters
  if (queryLower.length < 3) {
    console.log(`❌ [YAHOO SEARCH] Query too short (${queryLower.length} chars), skipping partial match search`);
    return [];
  }
  
  const matchingSymbols = commonSymbols.filter(symbol => 
    symbol.toLowerCase().includes(queryLower) ||
    queryLower.includes(symbol.toLowerCase())
  );
  
  console.log(`🔍 [YAHOO SEARCH] Found ${matchingSymbols.length} matching symbols:`, matchingSymbols);
  
  if (matchingSymbols.length > 0) {
    // Try to get quotes for matching symbols
    const results: StockSearchResult[] = [];
    for (const symbol of matchingSymbols.slice(0, 5)) { // Limit to 5 to avoid too many requests
      try {
        console.log(`🔍 [YAHOO SEARCH] Getting quote for matching symbol: ${symbol}`);
        const quote = await tryYahooFinance(symbol);
        if (quote) {
          console.log(`✅ [YAHOO SEARCH] Got quote for ${symbol}:`, quote);
          results.push({
            symbol: quote.symbol,
            name: quote.name,
            type: 'Equity',
            region: 'United States',
            marketOpen: '09:30',
            marketClose: '16:00',
            timezone: 'UTC-05:00',
            currency: 'USD',
            matchScore: 1.0
          });
        }
      } catch (error) {
        console.log(`💥 [YAHOO SEARCH] Failed to get quote for ${symbol}:`, error);
        continue;
      }
    }
    console.log(`🔍 [YAHOO SEARCH] Returning ${results.length} results`);
    return results;
  }
  
  console.log(`❌ [YAHOO SEARCH] No matching symbols found for "${query}"`);
  return [];
}

// Fallback search results for common stocks
function getFallbackSearchResults(query: string): StockSearchResult[] {
  const commonStocks = [
    { symbol: 'AAPL', name: 'Apple Inc.', type: 'Equity', region: 'United States' },
    { symbol: 'MSFT', name: 'Microsoft Corporation', type: 'Equity', region: 'United States' },
    { symbol: 'GOOGL', name: 'Alphabet Inc. Class A', type: 'Equity', region: 'United States' },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', type: 'Equity', region: 'United States' },
    { symbol: 'TSLA', name: 'Tesla Inc.', type: 'Equity', region: 'United States' },
    { symbol: 'NVDA', name: 'NVIDIA Corporation', type: 'Equity', region: 'United States' },
    { symbol: 'META', name: 'Meta Platforms Inc.', type: 'Equity', region: 'United States' },
    { symbol: 'NFLX', name: 'Netflix Inc.', type: 'Equity', region: 'United States' },
    { symbol: 'AMD', name: 'Advanced Micro Devices Inc.', type: 'Equity', region: 'United States' },
    { symbol: 'INTC', name: 'Intel Corporation', type: 'Equity', region: 'United States' }
  ];
  
  const queryLower = query.toLowerCase();
  return commonStocks
    .filter(stock => 
      stock.symbol.toLowerCase().includes(queryLower) ||
      stock.name.toLowerCase().includes(queryLower)
    )
    .map(stock => ({
      symbol: stock.symbol,
      name: stock.name,
      type: stock.type,
      region: stock.region,
      marketOpen: '09:30',
      marketClose: '16:00',
      timezone: 'UTC-05:00',
      currency: 'USD',
      matchScore: 1.0
    }));
}

// Fetch real historical data from Yahoo Finance
export async function getHistoricalDataFromYahoo(symbol: string, period: string): Promise<ChartData[] | null> {
  try {
    console.log(`📊 [YAHOO HISTORICAL] ========== Fetching historical data for ${symbol}, period: ${period} ==========`);
    
    // Calculate date range based on period
    // Use a consistent end date (end of most recent trading day) to prevent shape changes
    const now = new Date();
    const etDateParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now);
    
    const etYear = parseInt(etDateParts.find(p => p.type === 'year')?.value || '0');
    const etMonth = parseInt(etDateParts.find(p => p.type === 'month')?.value || '1') - 1;
    const etDay = parseInt(etDateParts.find(p => p.type === 'day')?.value || '1');
    const etHour = parseInt(etDateParts.find(p => p.type === 'hour')?.value || '0');
    const etMinute = parseInt(etDateParts.find(p => p.type === 'minute')?.value || '0');
    
    // Determine if it's EDT (UTC-4) or EST (UTC-5)
    const tempETDate = new Date(etYear, etMonth, etDay, 12, 0, 0);
    const isEDT = tempETDate.toLocaleString('en-US', { timeZone: 'America/New_York', timeZoneName: 'short' }).includes('EDT');
    const etOffsetHours = isEDT ? 4 : 5;
    
    // For consistency, use end of most recent trading day (4:00 PM ET) as endDate
    // This ensures the same data range is fetched each time
    const currentETTime = etHour * 60 + etMinute;
    const marketCloseTime = 16 * 60; // 4:00 PM = 960 minutes
    
    let targetYear = etYear;
    let targetMonth = etMonth;
    let targetDay = etDay;
    
    // If before market close today, use yesterday's close as end date for consistency
    if (currentETTime < marketCloseTime) {
      const yesterday = new Date(etYear, etMonth, etDay);
      yesterday.setDate(yesterday.getDate() - 1);
      targetYear = yesterday.getFullYear();
      targetMonth = yesterday.getMonth();
      targetDay = yesterday.getDate();
    }
    
    // End of trading day: 4:00 PM ET
    const endOfTradingDay_UTC_ms = Date.UTC(targetYear, targetMonth, targetDay, etOffsetHours + 16, 0, 0);
    let endDate = Math.floor(endOfTradingDay_UTC_ms / 1000);
    let startDate = endDate;
    let range = '1d'; // Default to daily data
    
    switch (period) {
      case '1D':
        // For 1D, get the most recent trading day's data (today if market is open, yesterday if closed)
        const now = new Date();
        
        // Get current time in ET
        const etDateParts = new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/New_York',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).formatToParts(now);
        
        const etYear = parseInt(etDateParts.find(p => p.type === 'year')?.value || '0');
        const etMonth = parseInt(etDateParts.find(p => p.type === 'month')?.value || '1') - 1;
        const etDay = parseInt(etDateParts.find(p => p.type === 'day')?.value || '1');
        const etHour = parseInt(etDateParts.find(p => p.type === 'hour')?.value || '0');
        const etMinute = parseInt(etDateParts.find(p => p.type === 'minute')?.value || '0');
        
        // Determine if it's EDT (UTC-4) or EST (UTC-5)
        const tempETDate = new Date(etYear, etMonth, etDay, 12, 0, 0);
        const isEDT = tempETDate.toLocaleString('en-US', { timeZone: 'America/New_York', timeZoneName: 'short' }).includes('EDT');
        const etOffsetHours = isEDT ? 4 : 5;
        
        // Determine which day to fetch:
        // - If before 9:30 AM ET, use yesterday
        // - If after 4:00 PM ET, use today (market closed)
        // - If between 9:30 AM and 4:00 PM ET, use today (market open)
        let targetYear = etYear;
        let targetMonth = etMonth;
        let targetDay = etDay;
        
        const currentETTime = etHour * 60 + etMinute; // minutes since midnight
        const marketOpenTime = 9 * 60 + 30; // 9:30 AM = 570 minutes
        const marketCloseTime = 16 * 60; // 4:00 PM = 960 minutes
        
        if (currentETTime < marketOpenTime) {
          // Before market open, use yesterday
          const yesterday = new Date(etYear, etMonth, etDay);
          yesterday.setDate(yesterday.getDate() - 1);
          targetYear = yesterday.getFullYear();
          targetMonth = yesterday.getMonth();
          targetDay = yesterday.getDate();
        }
        
        // Market open: 9:30 AM ET
        // Market close: 4:00 PM ET (or current time if market is still open)
        const marketOpenET_UTC_ms = Date.UTC(targetYear, targetMonth, targetDay, etOffsetHours + 9, 30, 0);
        const marketCloseET_UTC_ms = Date.UTC(targetYear, targetMonth, targetDay, etOffsetHours + 16, 0, 0);
        
        // Use market close time, or current time if market is still open and it's today
        const isToday = targetYear === etYear && targetMonth === etMonth && targetDay === etDay;
        const useCurrentTime = isToday && currentETTime >= marketOpenTime && currentETTime < marketCloseTime;
        
        startDate = Math.floor(marketOpenET_UTC_ms / 1000);
        endDate = useCurrentTime 
          ? Math.floor(now.getTime() / 1000)
          : Math.floor(marketCloseET_UTC_ms / 1000);
        
        // Ensure startDate < endDate
        if (startDate >= endDate) {
          console.warn(`⚠️ [YAHOO HISTORICAL] Start date >= end date, adjusting...`);
          endDate = startDate + (6 * 60 * 60); // Add 6.5 hours (market hours)
        }
        
        range = '1m'; // 1-minute intervals (minimum from Yahoo, we'll convert to 5-second)
        break;
      case '1W':
        startDate = endDate - (7 * 24 * 60 * 60);
        range = '15m'; // 15-minute intervals for 1W to get more data points and tighter candles
        break;
      case '1M':
        startDate = endDate - (30 * 24 * 60 * 60);
        range = '1h'; // Hourly data for 1M for better granularity (Yahoo supports up to 60 days of hourly data)
        break;
      case '3M':
        startDate = endDate - (90 * 24 * 60 * 60);
        range = '1d';
        break;
      case '1Y':
        startDate = endDate - (365 * 24 * 60 * 60);
        range = '1wk';
        break;
      case 'ALL':
        // Go back 10 years to show more historical data
        startDate = endDate - (10 * 365 * 24 * 60 * 60); // 10 years
        range = '1mo';
        break;
      default:
        console.log(`❌ [YAHOO HISTORICAL] Invalid period: ${period}`);
        return null;
    }
    
    console.log(`📊 [YAHOO HISTORICAL] Date range: ${new Date(startDate * 1000).toISOString()} to ${new Date(endDate * 1000).toISOString()}`);
    console.log(`📊 [YAHOO HISTORICAL] Interval: ${range}`);
    
    // Use CORS proxy to bypass browser restrictions
    const proxyUrl = 'https://corsproxy.io/?';
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${range}&period1=${startDate}&period2=${endDate}`;
    const url = proxyUrl + encodeURIComponent(yahooUrl);
    
    console.log(`📊 [YAHOO HISTORICAL] Fetching from: ${url}`);
    
    const response = await fetch(url);
    
    console.log(`📊 [YAHOO HISTORICAL] Response status: ${response.status}`);
    
    if (!response.ok) {
      console.log(`❌ [YAHOO HISTORICAL] HTTP error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.log(`❌ [YAHOO HISTORICAL] Error response:`, errorText);
      return null;
    }
    
    const data = await response.json();
    console.log(`📦 [YAHOO HISTORICAL] Received data structure:`, {
      hasChart: !!data.chart,
      hasResult: !!(data.chart && data.chart.result),
      hasData: !!(data.chart && data.chart.result && data.chart.result[0])
    });
    
    if (data.chart && data.chart.result && data.chart.result[0]) {
      const result = data.chart.result[0];
      const timestamps = result.timestamp || [];
      const quotes = result.indicators.quote[0] || {};
      const opens = quotes.open || [];
      const highs = quotes.high || [];
      const lows = quotes.low || [];
      const closes = quotes.close || [];
      const volumes = quotes.volume || [];
      
      console.log(`📊 [YAHOO HISTORICAL] Data counts: ${timestamps.length} timestamps, ${closes.length} close prices`);
      
      // Debug: Log first and last raw timestamps from Yahoo
      if (timestamps.length > 0) {
        const firstRaw = timestamps[0];
        const lastRaw = timestamps[timestamps.length - 1];
        const firstDate = new Date(firstRaw * 1000);
        const lastDate = new Date(lastRaw * 1000);
        console.log(`🕐 [YAHOO RAW] First timestamp: ${firstRaw} (Unix) = UTC: ${firstDate.toUTCString()} = ET: ${firstDate.toLocaleString('en-US', { timeZone: 'America/New_York' })}`);
        console.log(`🕐 [YAHOO RAW] Last timestamp: ${lastRaw} (Unix) = UTC: ${lastDate.toUTCString()} = ET: ${lastDate.toLocaleString('en-US', { timeZone: 'America/New_York' })}`);
        
        // Check what timezone Yahoo thinks these are in
        const now = new Date();
        const nowET = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
        console.log(`🕐 [YAHOO RAW] Current time: UTC: ${now.toUTCString()} = ET: ${nowET}`);
      }
      
      const chartData: ChartData[] = [];
      
      for (let i = 0; i < timestamps.length; i++) {
        if (closes[i] && !isNaN(closes[i])) {
          const dateObj = new Date(timestamps[i] * 1000);
          chartData.push({
            date: dateObj.toLocaleDateString(),
            timestamp: dateObj.toISOString(),
            value: closes[i],
            open: opens[i] || closes[i],
            high: highs[i] || closes[i],
            low: lows[i] || closes[i],
            volume: volumes[i] || 0
          });
        }
      }
      
      console.log(`✅ [YAHOO HISTORICAL] Successfully parsed ${chartData.length} data points for ${symbol}`);
      console.log(`📊 [YAHOO HISTORICAL] Price range: $${Math.min(...chartData.map(d => d.value)).toFixed(2)} to $${Math.max(...chartData.map(d => d.value)).toFixed(2)}`);
      return chartData;
    }
    
    console.log(`❌ [YAHOO HISTORICAL] No chart data found for ${symbol}`);
    return null;
  } catch (error) {
    console.error(`💥 [YAHOO HISTORICAL] Error fetching historical data for ${symbol}:`, error);
    return null;
  }
}

// Get company overview (for additional details)
export async function getCompanyOverview(symbol: string) {
  try {
    const response = await fetch(
      `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`
    );
    
    const data = await response.json();
    
    if (data['Symbol']) {
      return {
        symbol: data['Symbol'],
        name: data['Name'],
        description: data['Description'],
        sector: data['Sector'],
        industry: data['Industry'],
        marketCap: data['MarketCapitalization'],
        peRatio: data['PERatio'],
        dividendYield: data['DividendYield'],
        beta: data['Beta'],
        high52Week: data['52WeekHigh'],
        low52Week: data['52WeekLow'],
        employees: data['FullTimeEmployees'],
        founded: data['Founded'],
        address: data['Address']
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching company overview:', error);
    return null;
  }
}

// Get historical data for charts
export async function getHistoricalData(symbol: string, period: string = '1M') {
  try {
    let function_name = 'TIME_SERIES_DAILY';
    let outputsize = 'compact';
    
    // Adjust function based on period
    switch (period) {
      case '1D':
        function_name = 'TIME_SERIES_INTRADAY';
        outputsize = 'compact';
        break;
      case '1W':
        function_name = 'TIME_SERIES_INTRADAY';
        outputsize = 'compact';
        break;
      case '1M':
        function_name = 'TIME_SERIES_DAILY';
        outputsize = 'compact';
        break;
      case '3M':
        function_name = 'TIME_SERIES_DAILY';
        outputsize = 'full';
        break;
      case '1Y':
        function_name = 'TIME_SERIES_DAILY';
        outputsize = 'full';
        break;
      case 'ALL':
        function_name = 'TIME_SERIES_DAILY';
        outputsize = 'full';
        break;
    }
    
    const response = await fetch(
      `https://www.alphavantage.co/query?function=${function_name}&symbol=${symbol}&outputsize=${outputsize}&apikey=${ALPHA_VANTAGE_API_KEY}`
    );
    
    const data = await response.json();
    
    // Parse the data based on function type
    let timeSeries = null;
    if (function_name === 'TIME_SERIES_INTRADAY') {
      timeSeries = data['Time Series (5min)'] || data['Time Series (15min)'] || data['Time Series (30min)'] || data['Time Series (60min)'];
    } else {
      timeSeries = data['Time Series (Daily)'];
    }
    
    if (timeSeries) {
      const chartData = Object.entries(timeSeries)
        .map(([date, values]: [string, any]) => ({
          date,
          value: parseFloat(values['4. close']),
          open: parseFloat(values['1. open']),
          high: parseFloat(values['2. high']),
          low: parseFloat(values['3. low']),
          volume: parseInt(values['5. volume'])
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      return chartData;
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching historical data:', error);
    return [];
  }
}

// Fallback to Yahoo Finance API (unofficial but free)
export async function getYahooFinanceQuote(symbol: string): Promise<StockQuote | null> {
  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`
    );
    
    const data = await response.json();
    
    if (data.chart && data.chart.result && data.chart.result[0]) {
      const result = data.chart.result[0];
      const meta = result.meta;
      const quote = result.indicators.quote[0];
      
      const price = meta.regularMarketPrice;
      const previousClose = meta.previousClose;
      const change = price - previousClose;
      const changePercent = (change / previousClose) * 100;
      
      return {
        symbol: meta.symbol,
        name: meta.longName || meta.shortName || meta.symbol,
        price: price,
        change: change,
        changePercent: changePercent,
        volume: meta.regularMarketVolume,
        marketCap: meta.marketCap ? `${(meta.marketCap / 1e9).toFixed(1)}B` : 'N/A',
        sector: meta.sector || 'N/A',
        high: meta.regularMarketDayHigh,
        low: meta.regularMarketDayLow,
        open: meta.regularMarketOpen,
        previousClose: previousClose
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching Yahoo Finance quote:', error);
    return null;
  }
}
