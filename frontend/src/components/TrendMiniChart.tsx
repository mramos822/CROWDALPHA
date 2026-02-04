import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface ChartData {
  date: string;
  value: number;
}

interface TrendMiniChartProps {
  title: string;
  data: ChartData[];
  currentValue: number;
  change?: number;
  changePercent?: number;
}

export function TrendMiniChart({ 
  title, 
  data, 
  currentValue, 
  change, 
  changePercent 
}: TrendMiniChartProps) {
  const isPositive = (changePercent ?? 0) >= 0;
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;
  const color = isPositive ? "#22c55e" : "#ef4444";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {changePercent !== undefined && (
          <div className="flex items-center space-x-1">
            <TrendIcon className={`h-4 w-4 ${isPositive ? 'text-green-500' : 'text-red-500'}`} />
            <span className={`text-xs ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
              {isPositive ? "+" : ""}{changePercent.toFixed(1)}%
            </span>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold mb-2">
          {formatCurrency(currentValue)}
        </div>
        <div className="h-20 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke={color}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
