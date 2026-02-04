import { TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: number;
  change?: number;
  changePercent?: number;
  isCurrency?: boolean;
  isPercent?: boolean;
}

export function KpiCard({ 
  title, 
  value, 
  change, 
  changePercent, 
  isCurrency = false,
  isPercent = false 
}: KpiCardProps) {
  const isPositive = (changePercent ?? 0) >= 0;
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg card-hover">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-gray-600 dark:text-gray-300 text-sm font-medium">
          {title}
        </h3>
        {changePercent !== undefined && (
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            isPositive 
              ? 'bg-green-100 dark:bg-green-900/20' 
              : 'bg-red-100 dark:bg-red-900/20'
          }`}>
            <TrendIcon className={`h-4 w-4 ${
              isPositive 
                ? 'text-green-600 dark:text-green-400' 
                : 'text-red-600 dark:text-red-400'
            }`} />
          </div>
        )}
      </div>
      
      <div className="space-y-2">
        <div className="text-2xl font-bold text-gray-900 dark:text-white">
          {isCurrency && formatCurrency(value)}
          {isPercent && formatPercent(value)}
          {!isCurrency && !isPercent && value.toLocaleString()}
        </div>
        
        {change !== undefined && changePercent !== undefined && (
          <div className={`flex items-center text-sm font-medium ${
            isPositive ? 'robinhood-green' : 'robinhood-red'
          }`}>
            <span>
              {isPositive ? '+' : ''}{isCurrency ? formatCurrency(change) : formatPercent(changePercent)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}