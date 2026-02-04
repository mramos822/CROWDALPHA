import { useEffect, useMemo, useRef } from "react";
import { createChart, ColorType, CrosshairMode, LineStyle } from "lightweight-charts";

interface PortfolioDataPoint {
  date: string;
  value: number;
}

interface PortfolioChartProps {
  data: PortfolioDataPoint[];
  height?: number;
  isPositive?: boolean;
  className?: string;
  selectedPeriod?: string;
}

export default function PortfolioChart({
  data,
  height = 320,
  isPositive = true,
  className = "",
  selectedPeriod = '1W',
}: PortfolioChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const areaSeriesRef = useRef<any>(null);

  // Convert portfolio data to TradingView format
  const chartData = useMemo(() => {
    return data.map((point) => {
      // Convert date string to Unix timestamp
      const timestamp = Math.floor(new Date(point.date).getTime() / 1000);
      return {
        time: timestamp as any,
        value: point.value,
      };
    });
  }, [data]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Ensure container has dimensions
    if (containerRef.current.clientWidth === 0 || containerRef.current.clientHeight === 0) {
      requestAnimationFrame(() => {
        if (containerRef.current) {
          const event = new Event('resize');
          window.dispatchEvent(event);
        }
      });
      return;
    }

    try {
      // Create chart
      const chart = createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height,
        layout: {
          background: { type: ColorType.Solid, color: "transparent" },
          textColor: "#9ca3af",
          fontSize: 12,
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        },
        grid: {
          vertLines: { color: "#374151", style: LineStyle.Dotted, visible: true },
          horzLines: { color: "#374151", style: LineStyle.Dotted, visible: true },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: {
            color: "#6b7280",
            width: 1,
            style: LineStyle.Solid,
            labelBackgroundColor: "#1f2937",
          },
          horzLine: {
            color: "#6b7280",
            width: 1,
            style: LineStyle.Solid,
            labelBackgroundColor: "#1f2937",
          },
        },
        rightPriceScale: {
          borderColor: "#374151",
          scaleMargins: {
            top: 0.1,
            bottom: 0.1,
          },
        },
        timeScale: {
          borderColor: "#374151",
          timeVisible: true,
          secondsVisible: false,
          // Disable auto-fitting for 1D period - we'll manually set the visible range
          ...(selectedPeriod === '1D' ? {
            rightOffset: 0,
            barSpacing: 1,
          } : {}),
        },
      });

      chartRef.current = chart;

      // Add area series
      const areaSeries = chart.addAreaSeries({
        lineColor: isPositive ? "#10b981" : "#ef4444",
        topColor: isPositive ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)",
        bottomColor: isPositive ? "rgba(16, 185, 129, 0.02)" : "rgba(239, 68, 68, 0.02)",
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 5,
      });

      areaSeriesRef.current = areaSeries;

      // Set data
      if (chartData.length > 0) {
        areaSeries.setData(chartData);
      }

      // Handle resize
      const handleResize = () => {
        if (chartRef.current && containerRef.current) {
          chartRef.current.applyOptions({
            width: containerRef.current.clientWidth,
            height,
          });
        }
      };

      window.addEventListener('resize', handleResize);

      // Cleanup
      return () => {
        window.removeEventListener('resize', handleResize);
        if (chartRef.current) {
          chartRef.current.remove();
        }
        chartRef.current = null;
        areaSeriesRef.current = null;
      };
    } catch (error) {
      console.error('❌ [PORTFOLIO CHART] Error creating chart:', error);
    }
  }, [height, isPositive, selectedPeriod]);

  // Update chart data when it changes
  useEffect(() => {
    if (!areaSeriesRef.current || chartData.length === 0) return;

    // For 1D period, set visible range BEFORE setting data to prevent auto-fitting
    if (chartRef.current && selectedPeriod === '1D' && chartData.length > 1) {
      const now = new Date();
      const etDateParts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
      }).formatToParts(now);

      const etYear = parseInt(etDateParts.find(p => p.type === 'year')?.value || '0');
      const etMonth = parseInt(etDateParts.find(p => p.type === 'month')?.value || '1') - 1;
      const etDay = parseInt(etDateParts.find(p => p.type === 'day')?.value || '1');

      const tempETDate = new Date(etYear, etMonth, etDay, 12, 0, 0);
      const isEDT = tempETDate.toLocaleString('en-US', { timeZone: 'America/New_York', timeZoneName: 'short' }).includes('EDT');
      const etOffsetHours = isEDT ? 4 : 5;

      const midnightET_UTC_ms = Date.UTC(etYear, etMonth, etDay, etOffsetHours, 0, 0);
      const fromUnix = Math.floor(midnightET_UTC_ms / 1000);

      const nextDayET_UTC_ms = Date.UTC(etYear, etMonth, etDay + 1, etOffsetHours, 0, 0);
      const toUnix = Math.floor((nextDayET_UTC_ms - 1000) / 1000);

      const timeScale = chartRef.current.timeScale();
      
      // Set options to prevent auto-fitting
      if (typeof timeScale.applyOptions === 'function') {
        timeScale.applyOptions({
          fixLeftEdge: true,
          fixRightEdge: true,
          lockVisibleTimeRangeOnResize: true,
        });
      }

      // Set visible range BEFORE setting data
      if (typeof timeScale.setVisibleRange === 'function') {
        timeScale.setVisibleRange({
          from: fromUnix as any,
          to: toUnix as any,
        });
        console.log(`📊 [CHART] Set 1D visible range BEFORE data: ${fromUnix} (12:00 AM ET) to ${toUnix} (11:59 PM ET)`);
      }
    }

    // Now set the data
    areaSeriesRef.current.setData(chartData);

    // For 1D period, ensure visible range is maintained after data is set
    // For other periods, fit content to show all data
    if (chartRef.current && chartData.length > 1) {
      // Use requestAnimationFrame to ensure chart is fully rendered before setting visible range
      requestAnimationFrame(() => {
        setTimeout(() => {
          try {
            if (!chartRef.current) return;

            const timeScale = chartRef.current.timeScale();

            if (selectedPeriod === '1D') {
              // Calculate 12:00 AM to 11:59 PM ET for today
              const now = new Date();
              const etDateParts = new Intl.DateTimeFormat('en-US', {
                timeZone: 'America/New_York',
                year: 'numeric',
                month: 'numeric',
                day: 'numeric',
              }).formatToParts(now);

              const etYear = parseInt(etDateParts.find(p => p.type === 'year')?.value || '0');
              const etMonth = parseInt(etDateParts.find(p => p.type === 'month')?.value || '1') - 1;
              const etDay = parseInt(etDateParts.find(p => p.type === 'day')?.value || '1');

              // Determine if it's currently EDT (UTC-4) or EST (UTC-5)
              const tempETDate = new Date(etYear, etMonth, etDay, 12, 0, 0);
              const isEDT = tempETDate.toLocaleString('en-US', { timeZone: 'America/New_York', timeZoneName: 'short' }).includes('EDT');
              const etOffsetHours = isEDT ? 4 : 5;

              // Calculate UTC Unix timestamp for 12:00 AM ET
              const midnightET_UTC_ms = Date.UTC(etYear, etMonth, etDay, etOffsetHours, 0, 0);
              const fromUnix = Math.floor(midnightET_UTC_ms / 1000);

              // Calculate UTC Unix timestamp for 11:59:59 PM ET
              const nextDayET_UTC_ms = Date.UTC(etYear, etMonth, etDay + 1, etOffsetHours, 0, 0);
              const toUnix = Math.floor((nextDayET_UTC_ms - 1000) / 1000);

              console.log(`📊 [CHART] Setting 1D visible range: ${fromUnix} (12:00 AM ET) to ${toUnix} (11:59 PM ET)`);
              console.log(`📊 [CHART] Current time: ${Math.floor(now.getTime() / 1000)}, Data range: ${chartData[0]?.time} to ${chartData[chartData.length - 1]?.time}`);

              // Ensure the timeScale options are still set
              if (typeof timeScale.applyOptions === 'function') {
                timeScale.applyOptions({
                  fixLeftEdge: true,
                  fixRightEdge: true,
                  lockVisibleTimeRangeOnResize: true,
                });
              }

              // Force set the visible range again after data is set
              if (typeof timeScale.setVisibleRange === 'function') {
                timeScale.setVisibleRange({
                  from: fromUnix as any,
                  to: toUnix as any,
                });
                
                // Force a second update after a short delay to ensure it sticks
                setTimeout(() => {
                  if (chartRef.current) {
                    const timeScale2 = chartRef.current.timeScale();
                    if (typeof timeScale2.setVisibleRange === 'function') {
                      timeScale2.setVisibleRange({
                        from: fromUnix as any,
                        to: toUnix as any,
                      });
                    }
                  }
                }, 100);
              }
            } else {
            // For other periods, reset timeScale options and fit to actual data range
            if (typeof timeScale.applyOptions === 'function') {
              timeScale.applyOptions({
                fixLeftEdge: false,
                fixRightEdge: false,
                lockVisibleTimeRangeOnResize: false,
              });
            }

            const firstTime = chartData[0].time as number;
            const lastTime = chartData[chartData.length - 1].time as number;

            if (typeof timeScale.setVisibleRange === 'function') {
              timeScale.setVisibleRange({
                from: firstTime as any,
                to: lastTime as any,
              });
            }
          }
        } catch (error) {
          console.error('Error setting visible range:', error);
        }
        }, 50);
      });
    }
  }, [chartData, selectedPeriod]);

  return (
    <div className={`w-full ${className}`} style={{ height: `${height}px`, minHeight: `${height}px` }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}

