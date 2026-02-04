// Cache bust: 2025-01-23-v4
import React, { useEffect, useMemo, useRef } from "react";
import { createChart, ColorType, CrosshairMode, LineStyle } from "lightweight-charts";

console.log('📦 [ROBINHOOD CHART] lightweight-charts imported:', { createChart, ColorType, CrosshairMode, LineStyle });

// Helper functions for Robinhood-style 1D chart
const NY_TZ = 'America/New_York';

function nycDayBounds(ref: Date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: NY_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(ref);

  const y = Number(parts.find(p => p.type === 'year')!.value);
  const m = Number(parts.find(p => p.type === 'month')!.value) - 1;
  const d = Number(parts.find(p => p.type === 'day')!.value);

  const startMs = new Date(`${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}T00:00:00-05:00`).getTime();
  const endMs = new Date(`${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}T23:59:59-05:00`).getTime();
  
  return { startSec: Math.floor(startMs / 1000), endSec: Math.floor(endMs / 1000) };
}

function toMinute(tsSec: number) {
  return Math.floor(tsSec / 60) * 60;
}

function buildDaySkeleton(startSec: number, endSec: number) {
  const arr: Array<{ time: number }> = [];
  for (let t = startSec; t <= endSec; t += 60) {
    arr.push({ time: t });
  }
  return arr;
}

function mergeIntoDayFrame(
  skeleton: Array<{ time: number }>,
  actual: { time: number; value: number }[]
) {
  const map = new Map<number, number>();
  for (const p of actual) {
    map.set(toMinute(p.time), p.value);
  }

  return skeleton.map(p => {
    const v = map.get(p.time);
    return v === undefined ? { time: p.time } : { time: p.time, value: v };
  });
}

export type Candle = {
  time: number | string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  session?: 'pre' | 'rth' | 'post';
};

type Props = {
  data: Candle[];
  height?: number;
  showVolume?: boolean;
  showLatestMarker?: boolean;
  className?: string;
  selectedPeriod?: string;
  currentPrice?: number; // Current price to sync marker with header
};

const cardClass =
  "relative w-full rounded-xl shadow-lg border border-neutral-700/50 bg-gradient-to-br from-neutral-900 to-neutral-950 text-neutral-100 backdrop-blur-sm";

export default function RobinhoodChart({
  data,
  height = 360,
  showVolume = true,
  showLatestMarker = true,
  className,
  selectedPeriod = '1D',
  currentPrice,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const areaSeriesRef = useRef<any>(null);
  const candlestickSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const priceLineRef = useRef<any>(null);

  // For 1W and 1M, only show regular trading hours (9:30-16:00 ET) since they use hourly data
  const displayData = useMemo(() => {
    if (!["1W", "1M"].includes(selectedPeriod)) return data;

    const fmtHour = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    return data.filter((d) => {
      const ts = typeof d.time === "number" ? d.time * 1000 : Number(d.time) * 1000;
      const parts = fmtHour.formatToParts(new Date(ts));
      const hourPart = parts.find(p => p.type === "hour")!;
      const minutePart = parts.find(p => p.type === "minute")!;
      const hour = Number(hourPart.value);
      const minute = Number(minutePart.value);
      const totalMinutes = hour * 60 + minute;
      const open = 9 * 60 + 30; // 9:30 AM
      const close = 16 * 60; // 4:00 PM
      return totalMinutes >= open && totalMinutes <= close;
    });
  }, [data, selectedPeriod]);

  // Prepare candlestick data from Massive OHLC data
  const candlestickData = useMemo(() => {
    return displayData.map((d) => ({
      time: d.time as number,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));
  }, [displayData]);

  // Also prepare area/line data for fallback or overlay
  const areaData = useMemo(() => {
    return displayData.map((d) => ({ time: d.time as number, value: d.close }));
  }, [displayData]);

  const volData = useMemo(() => {
    if (!showVolume) return [] as any[];
    return displayData.map((d, i) => ({
      time: d.time as any,
      value: d.volume ?? 0,
      color:
        d.close >= (displayData[i - 1]?.close ?? d.open)
          ? "#16a34a" // green-ish
          : "#ef4444", // red-ish
    }));
  }, [displayData, showVolume]);

  useEffect(() => {
    if (!containerRef.current) {
      console.log('❌ [ROBINHOOD CHART] No container ref available');
      return;
    }

    // Creating chart

    // Ensure container has dimensions
    if (containerRef.current.clientWidth === 0 || containerRef.current.clientHeight === 0) {
      console.log('⚠️ [ROBINHOOD CHART] Container has no dimensions, waiting for next frame');
      requestAnimationFrame(() => {
        if (containerRef.current) {
          console.log('🎨 [ROBINHOOD CHART] Retrying chart creation after animation frame');
          // Retry the effect
          const event = new Event('resize');
          window.dispatchEvent(event);
        }
      });
      return;
    }

    try {
              // Create chart
            // Use container's actual height if available, otherwise use prop height
            const containerHeight = containerRef.current.clientHeight || height;
            const chart = createChart(containerRef.current, {
              width: containerRef.current.clientWidth,
              height: containerHeight,
              layout: {
                  background: { type: ColorType.Solid, color: "transparent" },
                  textColor: "#e5e7eb",
                  fontSize: 11,
                  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                },
                localization: {
                  locale: 'en-US',
                  timeFormatter: (time: any) => {
                    if (typeof time !== "number") return "";
                    // CRITICAL: time is in UTC seconds, convert to EST properly
                    const d = new Date(time * 1000);
                    // Always format in EST timezone with 12-hour format (like Google Finance)
                    return d.toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true, // Use 12-hour format with AM/PM
                      timeZone: "America/New_York", // Explicitly use EST/EDT
                    });
                  },
                },
                watermark: {
                  visible: false, // Hide TradingView watermark
                },
                grid: {
                  vertLines: { color: "#374151", style: LineStyle.Dotted, visible: true },
                  horzLines: { color: "#374151", style: LineStyle.Dotted, visible: true },
                },
                crosshair: {
                  mode: CrosshairMode.Magnet,
                  vertLine: { color: "#6b7280", width: 1, style: LineStyle.Dashed },
                  horzLine: { color: "#6b7280", width: 1, style: LineStyle.Dashed },
                },
                rightPriceScale: {
                  borderVisible: false,
                  scaleMargins: { top: 0.1, bottom: showVolume ? 0.25 : 0.05 },
                },
                // Disable scrolling and zooming - make chart fixed
                handleScroll: {
                  mouseWheel: false,
                  pressedMouseMove: false,
                  horzTouchDrag: false,
                  vertTouchDrag: false,
                },
                handleScale: {
                  axisPressedMouseMove: false,
                  axisDoubleClickReset: false,
                  mouseWheel: false,
                  pinch: false,
                },
                timeScale: {
                  borderVisible: false,
                  rightOffset: 0, // No right offset to use full width
                  barSpacing: 2.5, // Moderate spacing to make candles visible with breathing room
                  minBarSpacing: 1.5,
                  fixLeftEdge: true, // Fix all periods to prevent scrolling
                  fixRightEdge: true, // Fix all periods to prevent scrolling
                  lockVisibleTimeRangeOnResize: true, // Lock the visible range
                  secondsVisible: false,
                  timeVisible: true,
                  // Default timeFormatter for all periods - always use EST
                  timeFormatter: (time: any) => {
                    if (typeof time !== "number") return "";
                    // CRITICAL: time is in UTC seconds, convert to EST properly
                    const d = new Date(time * 1000);
                    // Default format: show date and time in EST (12-hour format)
                    return d.toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true, // Use 12-hour format
                      timeZone: "America/New_York", // Explicitly use EST/EDT
                    });
                  },
                  // Default tickMarkFormatter for all periods - always use EST
                  tickMarkFormatter: (time: any) => {
                    if (typeof time !== "number") return "";
                    const d = new Date(time * 1000);
                    // Default format: show date in EST
                    return d.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      timeZone: "America/New_York",
                    });
                  },
                  // For 1W period - clean daily labels
                  ...(selectedPeriod === '1W' && {
                    barSpacing: 0.3, // Very tight spacing to make candles appear much larger
                    minBarSpacing: 0.2,
                    rightOffset: 0,
                    tickMarkFormatter: (time: any) => {
                      if (typeof time !== "number") return "";
                      const d = new Date(time * 1000);
                      // e.g. "Mon 25"
                      return d.toLocaleDateString("en-US", {
                        weekday: "short",
                        day: "numeric",
                        timeZone: "America/New_York",
                      });
                    },
                    timeFormatter: (time: any) => {
                      if (typeof time !== "number") return "";
                      const d = new Date(time * 1000);
                      // e.g. "Mon 25 Nov 10:30"
                      return d.toLocaleString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                        timeZone: "America/New_York",
                      });
                    },
                  }),
                  // For 1M period - show dates
                  ...(selectedPeriod === '1M' && {
                    barSpacing: 0.3, // Very tight spacing to make candles appear much larger
                    minBarSpacing: 0.2,
                    rightOffset: 0,
                    tickMarkFormatter: (time: any) => {
                      if (typeof time !== "number") return "";
                      const d = new Date(time * 1000);
                      // e.g. "Nov 25"
                      return d.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        timeZone: "America/New_York",
                      });
                    },
                    timeFormatter: (time: any) => {
                      if (typeof time !== "number") return "";
                      const d = new Date(time * 1000);
                      // e.g. "Nov 25, 2025 10:30"
                      return d.toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                        timeZone: "America/New_York",
                      });
                    },
                  }),
                  // For 3M period - show month and day
                  ...(selectedPeriod === '3M' && {
                    barSpacing: 0.3, // Very tight spacing to make candles appear much larger
                    minBarSpacing: 0.2,
                    rightOffset: 0,
                    tickMarkFormatter: (time: any) => {
                      if (typeof time !== "number") return "";
                      const d = new Date(time * 1000);
                      // e.g. "Nov 25"
                      return d.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        timeZone: "America/New_York",
                      });
                    },
                    timeFormatter: (time: any) => {
                      if (typeof time !== "number") return "";
                      const d = new Date(time * 1000);
                      // e.g. "Nov 25, 2025"
                      return d.toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        timeZone: "America/New_York",
                      });
                    },
                  }),
                  // For 1Y period - show month and year
                  ...(selectedPeriod === '1Y' && {
                    barSpacing: 0.3, // Very tight spacing to make candles appear much larger
                    minBarSpacing: 0.2,
                    rightOffset: 0,
                    tickMarkFormatter: (time: any) => {
                      if (typeof time !== "number") return "";
                      const d = new Date(time * 1000);
                      // e.g. "Nov 2025"
                      return d.toLocaleDateString("en-US", {
                        month: "short",
                        year: "numeric",
                        timeZone: "America/New_York",
                      });
                    },
                    timeFormatter: (time: any) => {
                      if (typeof time !== "number") return "";
                      const d = new Date(time * 1000);
                      // e.g. "Nov 25, 2025"
                      return d.toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        timeZone: "America/New_York",
                      });
                    },
                  }),
                  // For ALL period - show year and month
                  ...(selectedPeriod === 'ALL' && {
                    barSpacing: 0.3, // Very tight spacing to make candles appear much larger
                    minBarSpacing: 0.2,
                    tickMarkFormatter: (time: any) => {
                      if (typeof time !== "number") return "";
                      const d = new Date(time * 1000);
                      // e.g. "2025"
                      return d.toLocaleDateString("en-US", {
                        year: "numeric",
                        timeZone: "America/New_York",
                      });
                    },
                    timeFormatter: (time: any) => {
                      if (typeof time !== "number") return "";
                      const d = new Date(time * 1000);
                      // e.g. "Nov 2025"
                      return d.toLocaleString("en-US", {
                        month: "short",
                        year: "numeric",
                        timeZone: "America/New_York",
                      });
                    },
                  }),
                  // Custom formatter to display times in Eastern Time for 1D period (like Google Finance)
                  ...(selectedPeriod === '1D' && {
                    barSpacing: 0.3, // Very tight spacing to make candles appear much larger
                    minBarSpacing: 0.2,
                    tickMarkFormatter: (time: any, tickMarkType: any, locale: string) => {
                      if (typeof time === 'number') {
                        // CRITICAL: time is in UTC seconds, convert to EST properly
                        // The timestamp from the chart is in UTC seconds since epoch
                        const date = new Date(time * 1000);
                        
                        // Get hour and minute in Eastern Time
                        const hourStr = date.toLocaleString('en-US', {
                          hour: '2-digit',
                          hour12: false,
                          timeZone: 'America/New_York',
                        });
                        const minuteStr = date.toLocaleString('en-US', {
                          minute: '2-digit',
                          timeZone: 'America/New_York',
                        });
                        
                        const hour = parseInt(hourStr);
                        const minute = parseInt(minuteStr);
                        
                        // Show labels every hour from 9:30 AM to 8:00 PM (trading hours + after-hours)
                        // Show at market open (9:30 AM)
                        if (hour === 9 && minute === 30) {
                          return '9:30 AM';
                        }
                        
                        // Show every hour on the hour (10 AM, 11 AM, 12 PM, 1 PM, 2 PM, 3 PM, 4 PM, 5 PM, 6 PM, 7 PM, 8 PM)
                        if (minute === 0 && hour >= 10 && hour <= 20) {
                          // Format in 12-hour format with AM/PM like Google
                          const timeStr = date.toLocaleString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                            timeZone: 'America/New_York',
                          });
                          return timeStr; // e.g., "10:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", etc.
                        }
                        
                        return '';
                      }
                      return '';
                    },
                    // Format the time displayed in the crosshair tooltip (like Google Finance)
                    timeFormatter: (time: any, type: any) => {
                      if (typeof time === 'number') {
                        // CRITICAL: time is in UTC seconds, convert to EST properly
                        const date = new Date(time * 1000);
                        
                        // Format like Google Finance: "Dec 2, 2025, 2:00 PM" (12-hour format with AM/PM)
                        // Make sure we're using EST timezone
                        const etDateStr = date.toLocaleString('en-US', {
                          timeZone: 'America/New_York', // Explicitly use EST/EDT
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true, // Use 12-hour format like Google
                        });
                        
                        return etDateStr; // e.g., "Dec 2, 2025, 2:00 PM"
                      }
                      return '';
                    },
                  }),
                },
              });

    // Chart created successfully

      if (!chart) {
        console.error('❌ [ROBINHOOD CHART] Failed to create chart - createChart returned null/undefined');
        return;
      }

      chartRef.current = chart;

      // Use candlestick series for better OHLC visualization (Massive provides OHLC data)
      let candlestickSeries = null;
      
      // Try v4 API first (addCandlestickSeries)
      if (typeof chart.addCandlestickSeries === 'function') {
        console.log('🕯️ [CHART] Using v4 API (addCandlestickSeries) for OHLC data');
        candlestickSeries = chart.addCandlestickSeries({
          upColor: '#10b981', // Green for up candles
          downColor: '#ef4444', // Red for down candles
          borderVisible: false,
          wickUpColor: '#10b981',
          wickDownColor: '#ef4444',
          priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
          lastPriceAnimation: 2,
        });
        // Always set the ref immediately, even if data is empty
        if (candlestickSeries) {
          candlestickSeriesRef.current = candlestickSeries;
          console.log('✅ [CHART] Candlestick series ref set');
        }
      } 
      // Try v5 API (addSeries with CandlestickSeries)
      else if (typeof chart.addSeries === 'function') {
        console.log('🕯️ [CHART] Using v5 API (addSeries with CandlestickSeries)');
        import('lightweight-charts').then(({ CandlestickSeries }) => {
          candlestickSeries = chart.addSeries(CandlestickSeries, {
            upColor: '#10b981',
            downColor: '#ef4444',
            borderVisible: false,
            wickUpColor: '#10b981',
            wickDownColor: '#ef4444',
            priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
            lastPriceAnimation: 2,
          });
          console.log('🕯️ [CHART] Candlestick series created with v5 API:', candlestickSeries);
          if (candlestickSeries && candlestickData.length > 0) {
            candlestickSeries.setData(candlestickData.map(d => ({
              time: d.time as any,
              open: d.open,
              high: d.high,
              low: d.low,
              close: d.close,
            })));
            candlestickSeriesRef.current = candlestickSeries;
          }
        });
      } else {
        console.error('❌ [CHART] No suitable method found for adding candlestick series');
        // Fallback to area series
        let areaSeries = null;
        if (typeof chart.addAreaSeries === 'function') {
          areaSeries = chart.addAreaSeries({
            lineWidth: 2,
            priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
            lastPriceAnimation: 2,
            lineColor: "#10b981",
            topColor: "rgba(16,185,129,0.2)",
            bottomColor: "rgba(16,185,129,0.02)",
          });
          if (areaSeries) {
            areaSeries.setData(areaData);
            areaSeriesRef.current = areaSeries;
          }
        }
      }

      // Set data if we have candlestick series and data
      if (candlestickSeries && candlestickData.length > 0) {
        console.log('🕯️ [CHART] Setting candlestick data:', candlestickData.length, 'candles');
        const formattedData = candlestickData.map(d => ({
          time: d.time as any,
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
        }));
        candlestickSeries.setData(formattedData);
        // Ensure ref is set
        candlestickSeriesRef.current = candlestickSeries;
        console.log('✅ [CHART] Candlestick data set, ref:', !!candlestickSeriesRef.current);

        // No marker dot - price line will be created in separate effect
        if (showLatestMarker && formattedData.length) {
          // Remove any markers
          candlestickSeries.setMarkers([]);
          console.log('✅ [CHART] Latest candle close:', formattedData[formattedData.length - 1].close, 'No marker dot');
        }
      } else if (candlestickSeries) {
        // Series created but no data yet - set empty array
        console.log('⏳ [CHART] Candlestick series created, waiting for data...');
        candlestickSeries.setData([]);
        candlestickSeriesRef.current = candlestickSeries;
      }

      // Volume histogram pinned to bottom
      if (showVolume) {
        let vol = null;
        
        // Try v4 API first
        if (typeof chart.addHistogramSeries === 'function') {
          console.log('🎨 [ROBINHOOD CHART] Using v4 API for volume (addHistogramSeries)');
          vol = chart.addHistogramSeries({
            priceScaleId: '', // overlay on separate autoscaled pane margin via scaleMargins above
            priceFormat: { type: 'volume' },
            base: 0,
            color: '#374151',
            priceLineVisible: false,
          });
        }
        // Try v5 API
        else if (typeof chart.addSeries === 'function') {
          console.log('🎨 [ROBINHOOD CHART] Using v5 API for volume (addSeries)');
          import('lightweight-charts').then(({ HistogramSeries }) => {
            vol = chart.addSeries(HistogramSeries, {
              priceScaleId: '', // overlay on separate autoscaled pane margin via scaleMargins above
              priceFormat: { type: 'volume' },
              base: 0,
              color: '#374151',
              priceLineVisible: false,
            });
            if (vol) {
              vol.setData(volData);
              volumeSeriesRef.current = vol;
              console.log('🎨 [ROBINHOOD CHART] Volume series created:', vol);
            }
          });
        }
        
        if (vol) {
          vol.setData(volData);
          volumeSeriesRef.current = vol;
          console.log('🎨 [ROBINHOOD CHART] Volume series created:', vol);
        }
      }

      // NOTE: Vertical NOW line not implemented - lightweight-charts doesn't support vertical lines this way

      console.log('🎨 [ROBINHOOD CHART] Chart setup completed successfully');

      const handleResize = () => {
        if (containerRef.current && chart) {
          const width = containerRef.current.clientWidth;
          const containerHeight = containerRef.current.clientHeight;
          // Only update if dimensions actually changed
          if (width > 0 && containerHeight > 0) {
            chart.applyOptions({ 
              width: width,
              height: containerHeight > 0 ? containerHeight : height
            });
            console.log(`🔄 [CHART] Resized to ${width}x${containerHeight}`);
          }
        }
      };
      
      // Use ResizeObserver for better container tracking (handles minimize/maximize)
      const resizeObserver = new ResizeObserver(() => {
        handleResize();
      });
      
      if (containerRef.current) {
        resizeObserver.observe(containerRef.current);
      }
      
      // Also listen to window resize as fallback
      window.addEventListener('resize', handleResize);
      // Initial resize
      handleResize();

      return () => {
        resizeObserver.disconnect();
        window.removeEventListener('resize', handleResize);
        if (chart) {
          chart.remove();
        }
        chartRef.current = null;
        areaSeriesRef.current = null;
        candlestickSeriesRef.current = null;
        volumeSeriesRef.current = null;
      };
    } catch (error) {
      console.error('❌ [CHART] Error creating chart:', error);
    }
    // Re-create chart only when we first get data, not when period changes
    // Period changes will update options via separate useEffect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candlestickData.length > 0 ? 'hasData' : 'noData']);
  
  // Update chart options when period changes (without recreating chart)
  useEffect(() => {
    if (!chartRef.current) return;
    
    const timeScale = chartRef.current.timeScale();
    
    // Update barSpacing and formatters based on period
    const periodOptions: any = {
      barSpacing: 2.5, // Moderate spacing to make candles visible with breathing room
      minBarSpacing: 1.5,
    };
    
    if (selectedPeriod === '1D') {
      // Update 1D options (hourly labels, etc.)
      periodOptions.tickMarkFormatter = (time: any, tickMarkType: any, locale: string) => {
        if (typeof time === 'number') {
          const date = new Date(time * 1000);
          const hourStr = date.toLocaleString('en-US', {
            hour: '2-digit',
            hour12: false,
            timeZone: 'America/New_York',
          });
          const minuteStr = date.toLocaleString('en-US', {
            minute: '2-digit',
            timeZone: 'America/New_York',
          });
          const hour = parseInt(hourStr);
          const minute = parseInt(minuteStr);
          
          if (hour === 9 && minute === 30) {
            return '9:30 AM';
          }
          
          if (minute === 0 && hour >= 10 && hour <= 20) {
            const timeStr = date.toLocaleString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
              timeZone: 'America/New_York',
            });
            return timeStr;
          }
          
          return '';
        }
        return '';
      };
      periodOptions.timeFormatter = (time: any, type: any) => {
        if (typeof time === 'number') {
          const date = new Date(time * 1000);
          const etDateStr = date.toLocaleString('en-US', {
            timeZone: 'America/New_York',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          });
          return etDateStr;
        }
        return '';
      };
    } else if (selectedPeriod === '1W') {
      periodOptions.tickMarkFormatter = (time: any) => {
        if (typeof time !== "number") return "";
        const d = new Date(time * 1000);
        return d.toLocaleDateString("en-US", {
          weekday: "short",
          day: "numeric",
          timeZone: "America/New_York",
        });
      };
      periodOptions.timeFormatter = (time: any) => {
        if (typeof time !== "number") return "";
        const d = new Date(time * 1000);
        return d.toLocaleString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: "America/New_York",
        });
      };
    } else if (selectedPeriod === '1M') {
      periodOptions.tickMarkFormatter = (time: any) => {
        if (typeof time !== "number") return "";
        const d = new Date(time * 1000);
        return d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          timeZone: "America/New_York",
        });
      };
      periodOptions.timeFormatter = (time: any) => {
        if (typeof time !== "number") return "";
        const d = new Date(time * 1000);
        return d.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: "America/New_York",
        });
      };
    } else if (selectedPeriod === '3M') {
      periodOptions.tickMarkFormatter = (time: any) => {
        if (typeof time !== "number") return "";
        const d = new Date(time * 1000);
        return d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          timeZone: "America/New_York",
        });
      };
      periodOptions.timeFormatter = (time: any) => {
        if (typeof time !== "number") return "";
        const d = new Date(time * 1000);
        return d.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone: "America/New_York",
        });
      };
    } else if (selectedPeriod === '1Y') {
      periodOptions.tickMarkFormatter = (time: any) => {
        if (typeof time !== "number") return "";
        const d = new Date(time * 1000);
        return d.toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
          timeZone: "America/New_York",
        });
      };
      periodOptions.timeFormatter = (time: any) => {
        if (typeof time !== "number") return "";
        const d = new Date(time * 1000);
        return d.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone: "America/New_York",
        });
      };
    } else if (selectedPeriod === 'ALL') {
      periodOptions.tickMarkFormatter = (time: any) => {
        if (typeof time !== "number") return "";
        const d = new Date(time * 1000);
        return d.toLocaleDateString("en-US", {
          year: "numeric",
          timeZone: "America/New_York",
        });
      };
      periodOptions.timeFormatter = (time: any) => {
        if (typeof time !== "number") return "";
        const d = new Date(time * 1000);
        return d.toLocaleString("en-US", {
          month: "short",
          year: "numeric",
          timeZone: "America/New_York",
        });
      };
    }
    
    // Apply options without recreating chart - use chart's applyOptions method
    try {
      chartRef.current.applyOptions({
        timeScale: periodOptions
      });
      // Force chart to resize/redraw with new barSpacing
      if (containerRef.current) {
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;
        if (width > 0 && height > 0) {
          chartRef.current.applyOptions({ width, height });
        }
      }
      console.log(`🔄 [CHART] Updated timeScale options for ${selectedPeriod} period (barSpacing: ${periodOptions.barSpacing})`);
    } catch (error) {
      console.error(`❌ [CHART] Failed to update timeScale options:`, error);
      // Fallback: try timeScale.applyOptions if it exists
      if (typeof timeScale.applyOptions === 'function') {
        timeScale.applyOptions(periodOptions);
        console.log(`🔄 [CHART] Updated timeScale options via timeScale.applyOptions`);
      }
    }
  }, [selectedPeriod]);

  // Update on data change or price change
  useEffect(() => {
    if (!chartRef.current) {
      console.log('⏸️ [CHART] No chart ref, skipping data update');
      return;
    }
    
    // Update candlestick series if available (preferred for OHLC data)
    if (candlestickSeriesRef.current) {
      if (candlestickData.length > 0) {
        const formattedData = candlestickData.map(d => ({
          time: d.time as any,
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
        }));
        candlestickSeriesRef.current.setData(formattedData);
        console.log('🔄 [CHART] Updated candlestick series with', formattedData.length, 'candles');
        
        // Re-apply barSpacing to ensure candles are visible with proper spacing
        const timeScale = chartRef.current.timeScale();
        if (typeof timeScale.applyOptions === 'function') {
          timeScale.applyOptions({
            barSpacing: 2.5,
            minBarSpacing: 1.5,
          });
        }
        
        // Set visible range to show all data points with consistent bar spacing
        // This ensures the chart displays correctly after data update
        if (formattedData.length > 1) {
          const firstTime = formattedData[0].time as number;
          const lastTime = formattedData[formattedData.length - 1].time as number;
          try {
            chartRef.current.timeScale().setVisibleRange({ from: firstTime, to: lastTime });
            console.log(`🔄 [CHART] Set visible range for ${selectedPeriod} period: ${new Date(firstTime * 1000).toLocaleString()} to ${new Date(lastTime * 1000).toLocaleString()}`);
          } catch (error) {
            console.warn(`⚠️ [CHART] Failed to set visible range:`, error);
          }
        }
        
        // No marker dot - price line will be created in separate effect
        if (showLatestMarker && formattedData.length) {
          // Remove any markers
          candlestickSeriesRef.current.setMarkers([]);
        }
      } else {
        console.log('⏳ [CHART] Candlestick series exists but no data yet');
      }
      return;
    }
    
    // Fallback to area series
    if (areaSeriesRef.current && areaData.length > 0) {
      areaSeriesRef.current.setData(areaData);
      console.log('🔄 [CHART] Updated area series with', areaData.length, 'points');
      return;
    }
    
    console.log('⏸️ [CHART] No series available for data update');
    // Updating chart data
    
    // Log data range for debugging
    if (areaData.length > 0) {
      const firstTime = areaData[0].time as any;
      const lastTime = areaData[areaData.length - 1].time as any;
      const firstDate = new Date(typeof firstTime === 'number' ? firstTime * 1000 : firstTime);
      const lastDate = new Date(typeof lastTime === 'number' ? lastTime * 1000 : lastTime);
      console.log(`📊 [CHART UPDATE] Data range: ${areaData.length} points, first=${firstDate.toUTCString()}, last=${lastDate.toUTCString()}`);
      console.log(`📊 [CHART UPDATE] Will display as: first=${firstDate.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit' })}, last=${lastDate.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit' })}`);
    }
    
    // Clear previous data to avoid gaps
    if (areaSeriesRef.current) {
      areaSeriesRef.current.setData([]);
      areaSeriesRef.current.setData(areaData);
    }
    if (showVolume && volumeSeriesRef.current) {
      volumeSeriesRef.current.setData(volData);
    }
    
    // For 1D period, set visible range BEFORE any auto-fitting happens
    // For other periods, fit content to show all data points
    if (areaData.length > 1) {
      setTimeout(() => {
        try {
          if (!chartRef.current || areaData.length === 0) {
            return;
          }
          
          const timeScale = chartRef.current.timeScale();
          
          // For 1D, set visible range FIRST to prevent auto-fitting
          if (selectedPeriod === '1D') {
            // Calculate and set visible range immediately
            const now = new Date();
            
            // Get the current date components in ET
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
            
            // Calculate UTC Unix timestamp for 9:30 AM ET (market open) - like Google Finance
            const marketOpenET_UTC_ms = Date.UTC(etYear, etMonth, etDay, etOffsetHours + 9, 30, 0);
            const fromUnix = Math.floor(marketOpenET_UTC_ms / 1000);
            
            // Calculate UTC Unix timestamp for 4:30 PM ET (30 minutes after market close for better spacing)
            const extendedEndET_UTC_ms = Date.UTC(etYear, etMonth, etDay, etOffsetHours + 16, 30, 0);
            const toUnix = Math.floor(extendedEndET_UTC_ms / 1000);
            
            // Apply time scale options directly to prevent auto-fitting
            // Use timeScale().applyOptions() instead of chart.applyOptions()
            if (typeof timeScale.applyOptions === 'function') {
              timeScale.applyOptions({
                fixLeftEdge: true,
                fixRightEdge: true,
                lockVisibleTimeRangeOnResize: true,
              });
            }
            
            // Set visible range immediately to prevent auto-fitting
            if (typeof timeScale.setVisibleRange === 'function') {
              timeScale.setVisibleRange({
                from: fromUnix as any,
                to: toUnix as any
              });
              
              // Re-apply multiple times with increasing delays to ensure it sticks
              // The chart library might try to auto-fit at different times
              [50, 100, 200, 500, 1000].forEach((delay) => {
                setTimeout(() => {
                  if (chartRef.current) {
                    const ts = chartRef.current.timeScale();
                    if (typeof ts.setVisibleRange === 'function') {
                      ts.setVisibleRange({
                        from: fromUnix as any,
                        to: toUnix as any
                      });
                    }
                    // Re-apply options as well
                    if (typeof ts.applyOptions === 'function') {
                      ts.applyOptions({
                        fixLeftEdge: true,
                        fixRightEdge: true,
                        lockVisibleTimeRangeOnResize: true,
                      });
                    }
                  }
                }, delay);
              });
              
              // Verify the calculation
              const verifyStart = new Date(fromUnix * 1000);
              const verifyEnd = new Date(toUnix * 1000);
              const startET = verifyStart.toLocaleString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false });
              const endET = verifyEnd.toLocaleString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false });
              console.log(`🕐 [1D CHART] Calculated visible range: ${fromUnix} to ${toUnix}`);
              console.log(`🕐 [1D CHART] Verified: Start=${startET} ET, End=${endET} ET`);
              console.log(`🕐 [1D CHART] Set visible range to trading hours: 9:30 AM to 4:30 PM ET (${fromUnix} to ${toUnix})`);
              console.log(`🕐 [1D CHART] Applied fixLeftEdge, fixRightEdge, and lockVisibleTimeRangeOnResize via timeScale().applyOptions()`);
            }
          } else {
            // For all periods except 1D, set visible range to show all data
            // But DON'T use fitContent() as it overrides barSpacing
            // Instead, calculate the range from the data and set it explicitly
            if (candlestickData.length > 0) {
              const firstTime = candlestickData[0].time as number;
              const lastTime = candlestickData[candlestickData.length - 1].time as number;
              
              // Set visible range to show all data, but keep barSpacing tight
              // Use as any to avoid TypeScript errors with Time type
              timeScale.setVisibleRange({
                from: firstTime as any,
                to: lastTime as any,
              });
              
              // Re-enforce barSpacing after setting visible range
              timeScale.applyOptions({
                barSpacing: 2.5,
                minBarSpacing: 1.5,
              });
              
              console.log(`🔄 [CHART] Set visible range for ${selectedPeriod} period: ${firstTime} to ${lastTime} (${candlestickData.length} candles, barSpacing: 2.5)`);
            }
          }
        } catch (error) {
          console.error('Error setting visible range:', error);
        }
      }, 0); // Use 0ms timeout to set visible range immediately after data is set
    }
    
    
    }, [candlestickData, areaData, volData, showVolume, selectedPeriod, currentPrice, showLatestMarker]);

  // Remove any markers and price lines (no visual indicators on chart)
  useEffect(() => {
    if (!candlestickSeriesRef.current || !showLatestMarker || candlestickData.length === 0) {
      return;
    }

    // Remove any markers (no green dot)
    candlestickSeriesRef.current.setMarkers([]);
    
    // Remove price line (no price line on chart)
    if (priceLineRef.current && typeof candlestickSeriesRef.current.removePriceLine === 'function') {
      candlestickSeriesRef.current.removePriceLine(priceLineRef.current);
      priceLineRef.current = null;
    }
  }, [showLatestMarker, candlestickData]);

  return (
    <div className={`${cardClass} ${className ?? ''} overflow-hidden`}>
      <div className="px-4 py-3 flex items-center justify-between border-b border-neutral-700/30">
        <div className="text-sm font-medium text-neutral-200">Price Chart</div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
          <span className="text-xs text-emerald-400 font-medium">LIVE</span>
        </div>
      </div>
      <div ref={containerRef} style={{ width: '100%', height, minWidth: selectedPeriod === '1W' ? '100%' : 'auto' }} className={selectedPeriod === '1W' ? "px-1 pt-1 pb-0" : "px-1 pt-1 pb-0"} />
    </div>
  );
}

// Helper function moved to separate file to avoid HMR issues