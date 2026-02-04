export interface Holding {
  symbol: string;
  name: string;
  qty: number;
  avgPrice: number;
  lastPrice: number;
  pl: number;
  weight: number;
}

export interface PortfolioSummary {
  totalValue: number;
  dailyPl: number;
  weeklyReturn: number;
  monthlyReturn: number;
  topMover: {
    symbol: string;
    change: number;
    changePercent: number;
  };
  activeAlerts: number;
}

export interface ChartData {
  date: string;
  value: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  totalValue: number;
  performance: number;
  isPrivate: boolean;
}

export interface Signal {
  id: string;
  symbol: string;
  name: string;
  action: 'buy' | 'sell' | 'hold';
  price: number;
  target: number;
  stopLoss: number;
  confidence: number;
  reasoning: string;
  timestamp: Date;
  author: string;
}

export interface IPO {
  id: string;
  company: string;
  symbol: string;
  expectedDate: Date;
  priceRange: {
    min: number;
    max: number;
  };
  sharesOffered: number;
  status: 'upcoming' | 'pricing' | 'trading' | 'completed';
  description: string;
}
