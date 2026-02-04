import React, { useState, useRef, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ChartData {
  date: string;
  value: number;
  timestamp: number;
  volume?: number;
}

interface InteractiveChartProps {
  data: ChartData[];
  height?: number;
  showVolume?: boolean;
  showCrosshair?: boolean;
  showZoom?: boolean;
  timeRange?: '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL';
  onTimeRangeChange?: (range: string) => void;
  className?: string;
}

export function InteractiveChart({
  data,
  height = 400,
  showVolume = false,
  showCrosshair = true,
  showZoom = true,
  timeRange = '1Y',
  onTimeRangeChange,
  className
}: InteractiveChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<ChartData | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const selectedRange = timeRange;
  const [zoomLevel, setZoomLevel] = useState(1);
  const chartRef = useRef<HTMLDivElement>(null);

  const timeRanges = ['1D', '1W', '1M', '3M', '1Y', 'ALL'];

  // Calculate trend
  const firstPrice = data[0]?.value || 0;
  const lastPrice = data[data.length - 1]?.value || 0;
  const priceChange = lastPrice - firstPrice;
  const priceChangePercent = firstPrice > 0 ? (priceChange / firstPrice) * 100 : 0;
  const isPositive = priceChange >= 0;

  // Get trend icon
  const getTrendIcon = () => {
    if (priceChangePercent > 0.1) return <TrendingUp className="h-4 w-4" />;
    if (priceChangePercent < -0.1) return <TrendingDown className="h-4 w-4" />;
    return <Minus className="h-4 w-4" />;
  };

  const handleTimeRangeChange = useCallback((range: string) => {
    onTimeRangeChange?.(range);
  }, [onTimeRangeChange]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;
    
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-4 min-w-[200px]">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {new Date(data.timestamp).toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        </div>
        
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Price:</span>
            <span className="text-lg font-bold text-gray-900 dark:text-white">
              ${data.value.toFixed(2)}
            </span>
          </div>
          
          {data.volume && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Volume:</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {data.volume.toLocaleString()}
              </span>
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Change:</span>
            <span className={cn(
              "text-sm font-medium flex items-center space-x-1",
              isPositive ? "text-green-600" : "text-red-600"
            )}>
              {getTrendIcon()}
              <span>
                {isPositive ? '+' : ''}${priceChange.toFixed(2)} ({isPositive ? '+' : ''}{priceChangePercent.toFixed(2)}%)
              </span>
            </span>
          </div>
        </div>
      </div>
    );
  };

  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    const isCurrentPoint = payload === hoveredPoint;
    
    return (
      <circle
        cx={cx}
        cy={cy}
        r={isCurrentPoint ? 8 : 0}
        fill={isPositive ? '#10B981' : '#EF4444'}
        stroke="white"
        strokeWidth={3}
        className="transition-all duration-300 drop-shadow-lg"
      />
    );
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header with controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
              ${lastPrice.toFixed(2)}
            </h3>
            <div className={cn(
              "flex items-center space-x-2 text-sm font-medium",
              isPositive ? "text-green-600" : "text-red-600"
            )}>
              {getTrendIcon()}
              <span>
                {isPositive ? '+' : ''}${priceChange.toFixed(2)} ({isPositive ? '+' : ''}{priceChangePercent.toFixed(2)}%)
              </span>
            </div>
          </div>
        </div>

        {/* Time range selector */}
        <div className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {timeRanges.map((range) => (
            <button
              key={range}
              onClick={() => handleTimeRangeChange(range)}
              className={cn(
                "px-3 py-1 text-sm font-medium rounded-md transition-colors",
                selectedRange === range
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              )}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Chart container */}
      <div 
        ref={chartRef}
        className="relative bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          setHoveredPoint(null);
        }}
      >
        <ResponsiveContainer width="100%" height={height}>
          <LineChart
            data={data}
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
            onMouseMove={(data) => {
              if (showCrosshair && data.activePayload) {
                setHoveredPoint(data.activePayload[0].payload);
              }
            }}
          >
            
            <XAxis 
              dataKey="date" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6B7280' }}
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              }}
            />
            
            <YAxis 
              domain={['dataMin - (dataMax - dataMin) * 0.1', 'dataMax + (dataMax - dataMin) * 0.1']}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6B7280' }}
              tickFormatter={(value) => `$${value.toFixed(0)}`}
            />
            
            <Tooltip content={<CustomTooltip />} />
            
            <defs>
              <linearGradient id="interactiveGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={isPositive ? '#10B981' : '#EF4444'} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={isPositive ? '#10B981' : '#EF4444'} stopOpacity={0.05}/>
              </linearGradient>
            </defs>
            
            <Line
              type="monotone"
              dataKey="value"
              stroke={isPositive ? '#10B981' : '#EF4444'}
              strokeWidth={isHovered ? 3 : 2}
              dot={false}
              activeDot={<CustomDot />}
              fill="url(#interactiveGradient)"
              className="transition-all duration-300"
            />
            
            {/* Reference line for current price */}
            {hoveredPoint && (
              <ReferenceLine 
                y={hoveredPoint.value} 
                stroke="#9CA3AF" 
                strokeDasharray="2 2" 
                opacity={0.7}
              />
            )}
          </LineChart>
        </ResponsiveContainer>

        {/* Crosshair lines */}
        {showCrosshair && isHovered && hoveredPoint && (
          <>
            <div 
              className="absolute top-0 bottom-0 w-px bg-gray-400 opacity-50 pointer-events-none z-20"
              style={{
                left: `${((data.indexOf(hoveredPoint) / (data.length - 1)) * 100)}%`
              }}
            />
            <div 
              className="absolute left-0 right-0 h-px bg-gray-400 opacity-50 pointer-events-none z-20"
              style={{
                top: `${((hoveredPoint.value - Math.min(...data.map(d => d.value))) / (Math.max(...data.map(d => d.value)) - Math.min(...data.map(d => d.value)))) * 100}%`
              }}
            />
          </>
        )}
      </div>

      {/* Volume chart (if enabled) */}
      {showVolume && (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Volume</h4>
          <ResponsiveContainer width="100%" height={100}>
            <LineChart data={data}>
              <XAxis 
                dataKey="date" 
                axisLine={false}
                tickLine={false}
                tick={false}
              />
              <Line
                type="monotone"
                dataKey="volume"
                stroke="#6B7280"
                strokeWidth={1}
                dot={false}
                fill="#6B7280"
                fillOpacity={0.3}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}