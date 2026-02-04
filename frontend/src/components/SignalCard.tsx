import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import { Star, BarChart3, X, TrendingUp } from "lucide-react";

interface Signal {
  id: string;
  symbol: string;
  type: 'SEC' | 'INSIDER' | 'NEWS' | 'TECH';
  confidence: number;
  title: string;
  rationale: string;
  createdAt: string;
  logo?: string;
}

interface SignalCardProps {
  signal: Signal;
  onWatch?: (signalId: string, e?: React.MouseEvent) => void;
  onBacktest?: (signalId: string, e?: React.MouseEvent) => void;
  onDismiss?: (signalId: string, e?: React.MouseEvent) => void;
  isWatched?: boolean;
}

export function SignalCard({ 
  signal, 
  onWatch, 
  onBacktest, 
  onDismiss, 
  isWatched = false 
}: SignalCardProps) {
  const getSignalTypeColor = (type: Signal['type']) => {
    switch (type) {
      case 'SEC': return 'bg-blue-500';
      case 'INSIDER': return 'bg-purple-500';
      case 'NEWS': return 'bg-green-500';
      case 'TECH': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'success';
    if (confidence >= 60) return 'warning';
    return 'destructive';
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-600 cursor-pointer">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center overflow-hidden">
            {signal.logo ? (
              <img 
                src={signal.logo} 
                alt={signal.symbol}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback to initial if logo fails to load
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    parent.innerHTML = `<span class="text-lg font-bold text-gray-700 dark:text-gray-300">${signal.symbol.charAt(0)}</span>`;
                  }
                }}
              />
            ) : (
              <span className="text-lg font-bold text-gray-700 dark:text-gray-300">
                {signal.symbol.charAt(0)}
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white">{signal.symbol}</h3>
              <div className={`w-2 h-2 rounded-full ${getSignalTypeColor(signal.type)}`} />
            </div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{signal.title}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <Badge 
            variant={getConfidenceColor(signal.confidence)}
            className={`px-3 py-1 text-sm font-semibold ${
              signal.confidence >= 80 ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400' :
              signal.confidence >= 60 ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400' :
              'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
            }`}
          >
            {signal.confidence}%
          </Badge>
          {onDismiss && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={(e) => {
                e.stopPropagation();
                onDismiss(signal.id, e);
              }}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      
      <div className="mb-6">
        <p className="text-gray-700 dark:text-gray-300 leading-relaxed line-clamp-3">
          {signal.rationale && signal.rationale !== 'AI analysis completed.' 
            ? signal.rationale.length > 200 
              ? `${signal.rationale.substring(0, 200)}...` 
              : signal.rationale
            : 'Click to view detailed AI analysis and key insights.'}
        </p>
      </div>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {formatDateTime(signal.createdAt)}
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              signal.type === 'SEC' ? 'bg-blue-500' :
              signal.type === 'INSIDER' ? 'bg-purple-500' :
              signal.type === 'NEWS' ? 'bg-green-500' :
              'bg-orange-500'
            }`} />
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
              {signal.type}
            </span>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant={isWatched ? "default" : "outline"}
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onWatch?.(signal.id, e);
            }}
            className={`px-4 py-2 text-sm font-medium transition-all ${
              isWatched 
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-300'
            }`}
          >
            <Star className={`h-4 w-4 mr-2 ${isWatched ? 'fill-current' : ''}`} />
            {isWatched ? 'Watching' : 'Watch'}
          </Button>
          
          {onBacktest && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onBacktest(signal.id, e);
              }}
              className="px-4 py-2 text-sm font-medium bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-300"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Backtest
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
