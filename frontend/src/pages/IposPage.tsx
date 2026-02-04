import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { useIposStore } from "@/store/ipos";
import { useUiStore } from "@/store/ui";
import { formatDate } from "@/lib/utils";
import { 
  Calendar, Building2, TrendingUp, AlertTriangle, ChevronRight,
  Search, Filter, Star, DollarSign, Users, Clock, TrendingDown,
  ExternalLink, MessageCircle, Plus
} from "lucide-react";

export function IposPage() {
  const { ipos, fetchIpos, isLoading, error, dataSource } = useIposStore();
  const { setLoading } = useUiStore();
  const navigate = useNavigate();

  const [selectedIpo, setSelectedIpo] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSector, setFilterSector] = useState('all');
  const [filterRisk, setFilterRisk] = useState('all');

  useEffect(() => {
    const loadIpos = async () => {
      setLoading(true);
      try {
        await fetchIpos();
      } catch (error) {
        console.error('Failed to fetch IPOs:', error);
      } finally {
        setLoading(false);
      }
    };

    loadIpos();
  }, [fetchIpos, setLoading]);

  const filteredIpos = ipos.filter(ipo => {
    const matchesSearch = searchTerm === '' || 
      ipo.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ipo.ticker.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ipo.sector && ipo.sector.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesSector = filterSector === 'all' || ipo.sector === filterSector;
    const matchesRisk = filterRisk === 'all' || ipo.riskScore.toString() === filterRisk;

    return matchesSearch && matchesSector && matchesRisk;
  }).sort((a, b) => {
    // Sort by expected date (earliest first)
    const dateA = new Date(a.expectedDate).getTime();
    const dateB = new Date(b.expectedDate).getTime();
    return dateA - dateB;
  });

  const getRiskColor = (riskScore: number) => {
    switch (riskScore) {
      case 1: return 'default';
      case 2: return 'secondary';
      case 3: return 'destructive';
      default: return 'secondary';
    }
  };

  const getRiskLabel = (riskScore: number) => {
    switch (riskScore) {
      case 1: return 'Low Risk';
      case 2: return 'Medium Risk';
      case 3: return 'High Risk';
      default: return 'Unknown';
    }
  };

  const getRiskIcon = (riskScore: number) => {
    switch (riskScore) {
      case 1: return <TrendingUp className="h-3 w-3" />;
      case 2: return <AlertTriangle className="h-3 w-3" />;
      case 3: return <TrendingDown className="h-3 w-3" />;
      default: return <AlertTriangle className="h-3 w-3" />;
    }
  };

  const sectors = [...new Set(ipos.map(ipo => ipo.sector).filter(Boolean))];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          {dataSource === 'mock' && (
            <div className="mb-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <div className="flex items-start">
                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-3 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-1">
                    Using Mock Data
                  </h3>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    The IPO calendar is currently showing mock/sample data because the Finnhub API key is invalid or not configured. 
                    To see real IPO data, please configure a valid <code className="bg-yellow-100 dark:bg-yellow-900/40 px-1 rounded">FINNHUB_API_KEY</code> in your backend config.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">IPO Calendar</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Track upcoming initial public offerings and analyze investment opportunities.
              </p>
            </div>
            <div className="flex space-x-2">
              <Button
                variant={viewMode === 'table' ? 'default' : 'outline'}
                onClick={() => setViewMode('table')}
              >
                <Building2 className="h-4 w-4 mr-2" />
                Table
              </Button>
              <Button
                variant={viewMode === 'calendar' ? 'default' : 'outline'}
                onClick={() => setViewMode('calendar')}
              >
                <Calendar className="h-4 w-4 mr-2" />
                Calendar
              </Button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search companies, tickers, or sectors..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={filterSector}
              onChange={(e) => setFilterSector(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="all">All Sectors</option>
              {sectors.map(sector => (
                <option key={sector} value={sector}>{sector}</option>
              ))}
            </select>
            <select
              value={filterRisk}
              onChange={(e) => setFilterRisk(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="all">All Risk Levels</option>
              <option value="1">Low Risk</option>
              <option value="2">Medium Risk</option>
              <option value="3">High Risk</option>
            </select>
            <Button variant="outline">
              <Filter className="h-4 w-4 mr-2" />
              More Filters
            </Button>
          </div>
        </div>

        {/* IPO Cards */}
        <div className="space-y-4">
          {isLoading && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="mt-4 text-muted-foreground">Loading IPOs...</p>
            </div>
          )}
          
          {!isLoading && error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-red-800 dark:text-red-200">Error loading IPOs: {error}</p>
            </div>
          )}

          {!isLoading && !error && filteredIpos.length === 0 && (
            <div className="text-center py-12">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No IPOs found</p>
              <p className="text-muted-foreground">
                {ipos.length === 0 
                  ? "No upcoming IPOs available at this time."
                  : "No IPOs match your current filters."}
              </p>
            </div>
          )}

          {!isLoading && !error && filteredIpos.map((ipo) => (
            <Card key={ipo.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-0">
                <div 
                  className="p-6 cursor-pointer"
                  onClick={() => setSelectedIpo(selectedIpo === ipo.id ? null : ipo.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Building2 className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="text-xl font-semibold">{ipo.company}</h3>
                          <Badge variant="outline" className="font-mono">
                            {ipo.ticker}
                          </Badge>
                          {ipo.sector && ipo.sector !== "Unknown" && ipo.sector !== "General" && (
                            <Badge variant="secondary">
                              {ipo.sector}
                            </Badge>
                          )}
                        </div>
                        <p className="text-muted-foreground text-sm max-w-2xl">
                          {ipo.description}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-8">
                      <div className="text-right">
                        <div className="font-semibold text-lg">{ipo.size}</div>
                        <div className="text-sm text-muted-foreground">Size</div>
                      </div>
                      
                      <div className="text-right">
                        <div className="font-semibold">{ipo.priceRange}</div>
                        <div className="text-sm text-muted-foreground">Price Range</div>
                      </div>

                      <div className="text-right">
                        <div className="font-semibold">{formatDate(ipo.expectedDate)}</div>
                        <div className="text-sm text-muted-foreground">Expected Date</div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Badge variant={getRiskColor(ipo.riskScore)} className="flex items-center space-x-1">
                          {getRiskIcon(ipo.riskScore)}
                          <span>{getRiskLabel(ipo.riskScore)}</span>
                        </Badge>
                      </div>

                      <div className="flex items-center space-x-2">
                        <ChevronRight className={`h-5 w-5 transition-transform ${
                          selectedIpo === ipo.id ? 'rotate-90' : ''
                        }`} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {selectedIpo === ipo.id && (
                  <div className="border-t bg-muted/50 p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* IPO Details */}
                      <div className="space-y-6">
                        <div>
                          <h4 className="font-semibold mb-3 flex items-center">
                            <DollarSign className="h-4 w-4 mr-2" />
                            IPO Details
                          </h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Price Range:</span>
                              <span>{ipo.priceRange}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Size:</span>
                              <span>{ipo.size}</span>
                            </div>
                            {ipo.exchange && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Exchange:</span>
                                <span>{ipo.exchange}</span>
                              </div>
                            )}
                            {ipo.industry && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Industry:</span>
                                <span>{ipo.industry}</span>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Expected Date:</span>
                              <span>{formatDate(ipo.expectedDate)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Status:</span>
                              <Badge variant="outline" className="capitalize">
                                {ipo.status || 'upcoming'}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Risk Analysis & Description */}
                      <div className="space-y-6">
                        {ipo.riskExplanation && (
                          <div>
                            <h4 className="font-semibold mb-3 flex items-center">
                              <AlertTriangle className="h-4 w-4 mr-2" />
                              AI Risk Assessment
                            </h4>
                            <p className="text-sm text-muted-foreground mb-3">
                              {ipo.riskExplanation}
                            </p>
                            {ipo.riskFactors && ipo.riskFactors.length > 0 && (
                              <div className="mb-3">
                                <p className="text-xs font-medium text-muted-foreground mb-2">Key Risk Factors:</p>
                                <ul className="space-y-1">
                                  {ipo.riskFactors.map((factor, idx) => (
                                    <li key={idx} className="text-sm text-muted-foreground flex items-start">
                                      <span className="text-red-500 mr-2">•</span>
                                      {factor}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {ipo.investmentConsiderations && ipo.investmentConsiderations.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-2">Investment Considerations:</p>
                                <ul className="space-y-1">
                                  {ipo.investmentConsiderations.map((consideration, idx) => (
                                    <li key={idx} className="text-sm text-muted-foreground flex items-start">
                                      <span className="text-blue-500 mr-2">✓</span>
                                      {consideration}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                        <div>
                          <h4 className="font-semibold mb-3 flex items-center">
                            <Building2 className="h-4 w-4 mr-2" />
                            About
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {ipo.description || `${ipo.company} is preparing to go public.`}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}






