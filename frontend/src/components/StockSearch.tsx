import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Plus, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { searchStocks, getStockQuote, type StockSearchResult, type StockQuote } from '@/services/stockData';

// Use StockQuote from the service instead of local interface
type Stock = StockQuote;

interface StockSearchProps {
  onStockSelect?: (stock: Stock) => void;
  onAddToWatchlist?: (stock: Stock) => void;
  className?: string;
}

export function StockSearch({ onStockSelect, onAddToWatchlist, className }: StockSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Stock[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Mock stock data - in a real app, this would come from an API
  const mockStocks: Stock[] = [
    {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      price: 175.43,
      change: 2.15,
      changePercent: 1.24,
      volume: 45000000,
      marketCap: '2.8T',
      sector: 'Technology'
    },
    {
      symbol: 'MSFT',
      name: 'Microsoft Corporation',
      price: 378.85,
      change: -1.23,
      changePercent: -0.32,
      volume: 25000000,
      marketCap: '2.8T',
      sector: 'Technology'
    },
    {
      symbol: 'GOOGL',
      name: 'Alphabet Inc.',
      price: 142.56,
      change: 3.45,
      changePercent: 2.48,
      volume: 18000000,
      marketCap: '1.8T',
      sector: 'Technology'
    },
    {
      symbol: 'AMZN',
      name: 'Amazon.com Inc.',
      price: 155.23,
      change: -0.87,
      changePercent: -0.56,
      volume: 32000000,
      marketCap: '1.6T',
      sector: 'Consumer Discretionary'
    },
    {
      symbol: 'TSLA',
      name: 'Tesla Inc.',
      price: 248.42,
      change: 8.95,
      changePercent: 3.74,
      volume: 75000000,
      marketCap: '790B',
      sector: 'Automotive'
    },
    {
      symbol: 'NVDA',
      name: 'NVIDIA Corporation',
      price: 875.28,
      change: 25.80,
      changePercent: 3.03,
      volume: 45000000,
      marketCap: '2.2T',
      sector: 'Technology'
    },
    {
      symbol: 'META',
      name: 'Meta Platforms Inc.',
      price: 485.12,
      change: 12.34,
      changePercent: 2.61,
      volume: 15000000,
      marketCap: '1.2T',
      sector: 'Technology'
    },
    {
      symbol: 'NFLX',
      name: 'Netflix Inc.',
      price: 612.45,
      change: -5.67,
      changePercent: -0.92,
      volume: 8000000,
      marketCap: '270B',
      sector: 'Communication Services'
    }
  ];

  // Search function using real API
  const searchStocksAPI = async (query: string) => {
    console.log(`🔍 [STOCK SEARCH] Starting searchStocksAPI for: "${query}"`);
    
    if (!query.trim()) {
      console.log(`🔍 [STOCK SEARCH] Empty query, clearing results`);
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    console.log(`🔍 [STOCK SEARCH] Setting isSearching to true`);
    setIsSearching(true);
    
    try {
      console.log(`🔍 [STOCK SEARCH] Calling searchStocks API for: "${query}"`);
      // Use Alpha Vantage search API
      const results = await searchStocks(query);
      console.log(`🔍 [STOCK SEARCH] Got ${results.length} search results:`, results);
      
      // Convert search results to our Stock format and get quotes
      const stockPromises = results.slice(0, 8).map(async (result) => {
        console.log(`🔍 [STOCK SEARCH] Getting quote for symbol: ${result.symbol}`);
        const quote = await getStockQuote(result.symbol);
        if (quote) {
          console.log(`🔍 [STOCK SEARCH] Got quote for ${result.symbol}:`, quote);
          return {
            symbol: quote.symbol,
            name: quote.name,
            price: quote.price,
            change: quote.change,
            changePercent: quote.changePercent,
            volume: quote.volume,
            marketCap: quote.marketCap,
            sector: quote.sector
          };
        }
        console.log(`🔍 [STOCK SEARCH] No quote found for ${result.symbol}`);
        return null;
      });
      
      const stocks = (await Promise.all(stockPromises)).filter(Boolean);
      console.log(`🔍 [STOCK SEARCH] Final stocks array:`, stocks);
      setSearchResults(stocks);
      setShowResults(true);
    } catch (error) {
      console.error('💥 [STOCK SEARCH] Search error:', error);
      setSearchResults([]);
      setShowResults(true);
    }
    
    console.log(`🔍 [STOCK SEARCH] Setting isSearching to false`);
    setIsSearching(false);
  };

  // Handle search input with debounce
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    console.log(`🔍 [STOCK SEARCH] handleSearchChange called with: "${query}"`);
    setSearchQuery(query);
    
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Only search if query is at least 3 characters
    if (query.length >= 3) {
      searchTimeoutRef.current = setTimeout(() => {
        searchStocksAPI(query);
      }, 500); // 500ms debounce
    } else if (query.length === 0) {
      setSearchResults([]);
      setShowResults(false);
    }
  };

  // Handle stock selection
  const handleStockSelect = (stock: Stock) => {
    if (onStockSelect) {
      onStockSelect(stock);
    }
    setSearchQuery('');
    setShowResults(false);
  };

  // Handle add to watchlist
  const handleAddToWatchlist = (stock: Stock, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onAddToWatchlist) {
      onAddToWatchlist(stock);
    }
  };

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.stock-search-container')) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`stock-search-container relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Search stocks by symbol, name, or sector..."
          value={searchQuery}
          onChange={handleSearchChange}
          className="pl-10 pr-10 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-blue-500"
        />
        {searchQuery && (
          <button
            onClick={() => {
              setSearchQuery('');
              setShowResults(false);
            }}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Search Results */}
      {showResults && (
        <Card className="absolute top-full left-0 right-0 mt-2 z-50 max-h-96 overflow-y-auto bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {isSearching ? 'Searching...' : `${searchResults.length} results found`}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {isSearching ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : searchResults.length > 0 ? (
              <div className="space-y-2">
                {searchResults.map((stock, index) => (
                  <div
                    key={`${stock.symbol}-${index}`}
                    onClick={() => handleStockSelect(stock)}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                        <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                          {stock.symbol.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-semibold text-gray-900 dark:text-white">
                            {stock.symbol}
                          </h4>
                          <Badge variant="secondary" className="text-xs">
                            {stock.sector}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 truncate max-w-48">
                          {stock.name}
                        </p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="font-semibold text-gray-900 dark:text-white">
                        ${stock.price.toFixed(2)}
                      </div>
                      <div className={`text-sm flex items-center ${
                        stock.change >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {stock.change >= 0 ? (
                          <TrendingUp className="h-3 w-3 mr-1" />
                        ) : (
                          <TrendingDown className="h-3 w-3 mr-1" />
                        )}
                        {stock.change >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                      </div>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleAddToWatchlist(stock, e)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity ml-2"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                No stocks found for "{searchQuery}"
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
