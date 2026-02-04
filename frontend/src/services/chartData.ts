export interface ChartData {
  date: string;
  value: number;
  timestamp: string; // ISO string format
  volume?: number;
  open?: number;
  high?: number;
  low?: number;
}

// Generate realistic stock price data
export function generateStockData(
  symbol: string,
  days: number = 365,
  basePrice: number = 100
): ChartData[] {
  const data: ChartData[] = [];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  let currentPrice = basePrice;
  const volatility = 0.02; // 2% daily volatility
  
  // Generate more data points for shorter periods
  const dataPoints = days > 30 ? days : days * 24; // Hourly data for short periods
  
  for (let i = 0; i < dataPoints; i++) {
    const date = new Date(startDate);
    
    if (days > 30) {
      // Daily data for longer periods
      date.setDate(date.getDate() + i);
      // Skip weekends
      if (date.getDay() === 0 || date.getDay() === 6) continue;
    } else {
      // Hourly data for short periods
      date.setHours(date.getHours() + i);
    }
    
    // Generate random price movement
    const randomChange = (Math.random() - 0.5) * 2 * volatility;
    const trend = Math.sin(i / 50) * 0.001; // Long-term trend
    currentPrice = currentPrice * (1 + randomChange + trend);
    
    // Generate volume (higher on big moves)
    const volume = Math.floor(1000000 + Math.abs(randomChange) * 5000000 + Math.random() * 2000000);
    
    data.push({
      date: date.toISOString().split('T')[0] + (days <= 30 ? `T${date.getHours().toString().padStart(2, '0')}:00:00` : ''),
      value: Math.round(currentPrice * 100) / 100,
      timestamp: date.getTime(),
      volume
    });
  }
  
  return data;
}

// Mock data for different stocks
export const mockStockData = {
  AAPL: generateStockData('AAPL', 365, 150),
  GOOGL: generateStockData('GOOGL', 365, 2800),
  MSFT: generateStockData('MSFT', 365, 300),
  TSLA: generateStockData('TSLA', 365, 800),
  AMZN: generateStockData('AMZN', 365, 3200),
  NVDA: generateStockData('NVDA', 365, 450),
  META: generateStockData('META', 365, 350),
  NFLX: generateStockData('NFLX', 365, 500),
};

// Get data for specific time ranges
export function getDataForTimeRange(
  data: ChartData[],
  range: '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL'
): ChartData[] {
  const now = new Date();
  const cutoffDate = new Date();
  
  switch (range) {
    case '1D':
      cutoffDate.setDate(now.getDate() - 1);
      break;
    case '1W':
      cutoffDate.setDate(now.getDate() - 7);
      break;
    case '1M':
      cutoffDate.setMonth(now.getMonth() - 1);
      break;
    case '3M':
      cutoffDate.setMonth(now.getMonth() - 3);
      break;
    case '1Y':
      cutoffDate.setFullYear(now.getFullYear() - 1);
      break;
    case 'ALL':
    default:
      return data;
  }
  
  return data.filter(item => new Date(item.timestamp) >= cutoffDate);
}

// Generate data with proper granularity for each time range
export function generateDataForTimeRange(
  initialValue: number,
  range: '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL'
): ChartData[] {
  const data: ChartData[] = [];
  const now = new Date();
  let startDate = new Date();
  let dataPoints: number;
  let intervalHours: number;
  
  switch (range) {
    case '1D':
      startDate.setDate(now.getDate() - 1);
      dataPoints = 24; // 24 hours
      intervalHours = 1; // 1 hour intervals
      break;
    case '1W':
      startDate.setDate(now.getDate() - 7);
      dataPoints = 168; // 7 days * 24 hours
      intervalHours = 1; // 1 hour intervals
      break;
    case '1M':
      startDate.setMonth(now.getMonth() - 1);
      dataPoints = 30; // 30 days
      intervalHours = 24; // 1 day intervals
      break;
    case '3M':
      startDate.setMonth(now.getMonth() - 3);
      dataPoints = 90; // 90 days
      intervalHours = 24; // 1 day intervals
      break;
    case '1Y':
      startDate.setFullYear(now.getFullYear() - 1);
      dataPoints = 365; // 365 days
      intervalHours = 24; // 1 day intervals
      break;
    case 'ALL':
    default:
      startDate.setFullYear(now.getFullYear() - 2);
      dataPoints = 730; // 2 years
      intervalHours = 24; // 1 day intervals
      break;
  }
  
  let currentValue = initialValue;
  const dailyReturn = 0.0008; // ~0.08% daily return (20% annual)
  const volatility = intervalHours === 1 ? 0.003 : 0.015; // Lower volatility for hourly data
  
  for (let i = 0; i < dataPoints; i++) {
    const date = new Date(startDate);
    date.setHours(date.getHours() + (i * intervalHours));
    
    // Skip weekends for daily data
    if (intervalHours >= 24 && (date.getDay() === 0 || date.getDay() === 6)) {
      continue;
    }
    
    // Generate portfolio value
    const randomChange = (Math.random() - 0.5) * 2 * volatility;
    const trend = Math.sin(i / (dataPoints / 10)) * 0.001; // Long-term trend
    currentValue = currentValue * (1 + dailyReturn * (intervalHours / 24) + randomChange + trend);
    
    data.push({
      date: date.toISOString(),
      value: Math.round(currentValue * 100) / 100,
      timestamp: date.getTime(),
    });
  }
  
  return data;
}

// Calculate technical indicators
export function calculateMovingAverage(data: ChartData[], period: number): number[] {
  const averages: number[] = [];
  
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      averages.push(0);
    } else {
      const sum = data.slice(i - period + 1, i + 1).reduce((acc, item) => acc + item.value, 0);
      averages.push(sum / period);
    }
  }
  
  return averages;
}

export function calculateRSI(data: ChartData[], period: number = 14): number[] {
  const rsi: number[] = [];
  const gains: number[] = [];
  const losses: number[] = [];
  
  // Calculate price changes
  for (let i = 1; i < data.length; i++) {
    const change = data[i].value - data[i - 1].value;
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }
  
  // Calculate RSI
  for (let i = period - 1; i < gains.length; i++) {
    const avgGain = gains.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
    const avgLoss = losses.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
    
    if (avgLoss === 0) {
      rsi.push(100);
    } else {
      const rs = avgGain / avgLoss;
      rsi.push(100 - (100 / (1 + rs)));
    }
  }
  
  return rsi;
}

// Portfolio performance data
export function generatePortfolioData(initialValue: number = 100000, days: number = 365): ChartData[] {
  const data: ChartData[] = [];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  let currentValue = initialValue;
  const dailyReturn = 0.0008; // ~0.08% daily return (20% annual)
  const volatility = 0.015; // 1.5% daily volatility
  
  // Generate more data points for shorter periods
  const dataPoints = days > 30 ? days : days * 24; // Hourly data for short periods
  
  for (let i = 0; i < dataPoints; i++) {
    const date = new Date(startDate);
    
    if (days > 30) {
      // Daily data for longer periods
      date.setDate(date.getDate() + i);
      // Skip weekends
      if (date.getDay() === 0 || date.getDay() === 6) continue;
    } else {
      // Hourly data for short periods
      date.setHours(date.getHours() + i);
    }
    
    // Generate portfolio value
    const randomChange = (Math.random() - 0.5) * 2 * volatility;
    currentValue = currentValue * (1 + dailyReturn + randomChange);
    
    data.push({
      date: date.toISOString().split('T')[0] + (days <= 30 ? `T${date.getHours().toString().padStart(2, '0')}:00:00` : ''),
      value: Math.round(currentValue * 100) / 100,
      timestamp: date.getTime(),
    });
  }
  
  return data;
}
