import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import Logo from './Logo';

interface TopMover {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  chartData: Array<{
    time: string;
    value: number;
  }>;
}

interface TopMoversChartProps {
  mover: TopMover;
}

export function TopMoversChart({ mover }: TopMoversChartProps) {
  const isPositive = mover.changePercent > 0;
  const color = isPositive ? '#10b981' : '#ef4444';
  const gradientId = `gradient-${mover.symbol}`;
  
  // Ensure chartData exists and has data
  const chartData = mover.chartData || [];
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-200 cursor-pointer group">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2 min-w-0 flex-1">
          <Logo 
            symbol={mover.symbol}
            companyName={mover.name}
            size={24}
            className="rounded-md flex-shrink-0"
            fallbackText={mover.symbol.charAt(0)}
            lazy={true}
            theme="auto"
          />
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm truncate">{mover.symbol}</h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{mover.name}</p>
          </div>
        </div>
        <div className="text-right flex-shrink-0 ml-2">
          <p className="font-semibold text-gray-900 dark:text-white text-sm">${mover.price.toFixed(2)}</p>
          <div className={`flex items-center text-xs ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {isPositive ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
            {isPositive ? '+' : ''}{mover.changePercent.toFixed(2)}%
          </div>
        </div>
      </div>
      
      <div className="mb-2" style={{ width: '100%', height: '48px', minWidth: '150px' }}>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={48}>
            <AreaChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.4}/>
                  <stop offset="95%" stopColor={color} stopOpacity={0.05}/>
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="time" 
                axisLine={false}
                tickLine={false}
                tick={false}
              />
              <YAxis 
                domain={['dataMin - (dataMax - dataMin) * 0.05', 'dataMax + (dataMax - dataMin) * 0.05']}
                axisLine={false}
                tickLine={false}
                tick={false}
              />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-gray-800 text-white px-2 py-1 rounded text-xs shadow-lg">
                        <p>${payload[0].value?.toFixed(2)}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="linear"
                dataKey="value"
                stroke={color}
                strokeWidth={1.5}
                fill={`url(#${gradientId})`}
                dot={false}
                activeDot={{ r: 2, fill: color, stroke: '#fff', strokeWidth: 1 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded" style={{ width: '100%', height: '48px' }}>
            <div className="text-xs text-gray-500 dark:text-gray-400">Loading...</div>
          </div>
        )}
      </div>
      
      <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
        Vol: {(mover.volume / 1000000).toFixed(1)}M
      </div>
    </div>
  );
}
