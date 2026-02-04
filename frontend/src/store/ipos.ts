import { create } from 'zustand';

const API_BASE_URL = 'http://localhost:8000';

// Helper to get auth token
const getAuthToken = async (): Promise<string | null> => {
  try {
    const backendToken = localStorage.getItem('auth_token');
    if (backendToken) {
      return backendToken;
    }
    
    // Fallback to Firebase token if available
    const { auth } = await import('@/lib/firebase');
    if (auth && auth.currentUser) {
      return await auth.currentUser.getIdToken();
    }
    
    return null;
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
};

export interface Ipo {
  id: string;
  company: string;
  ticker: string;
  expectedDate: string;
  exchange?: string;
  priceRange: string;
  size: string;
  riskScore: number;
  sector: string;
  industry?: string;
  description: string;
  status: 'upcoming' | 'pricing' | 'trading' | 'completed';
  // AI-powered risk evaluation fields
  riskExplanation?: string;
  riskFactors?: string[];
  investmentConsiderations?: string[];
  // Legacy fields for backward compatibility
  name?: string;
  date?: string;
}

interface IposStore {
  ipos: Ipo[];
  isLoading: boolean;
  error: string | null;
  dataSource: 'finnhub' | 'mock' | null;
  fetchIpos: (daysAhead?: number) => Promise<void>;
}

export const useIposStore = create<IposStore>((set) => ({
  ipos: [],
  isLoading: false,
  error: null,
  dataSource: null,

  fetchIpos: async (daysAhead: number = 90) => {
    set({ isLoading: true, error: null });
    
    try {
      const token = await getAuthToken();
      if (!token) {
        console.warn('❌ No auth token found. Please log in to get real IPO data.');
        // Fallback to empty array if not logged in
        set({ ipos: [], isLoading: false, dataSource: null });
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/ipos/calendar?days_ahead=${daysAhead}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(errorData.detail || `Failed to fetch IPOs: ${response.statusText}`);
      }

      const data = await response.json();
      const source = data.source || 'unknown';
      console.log(`📅 Fetched ${data.ipos.length} IPOs from backend (source: ${source})`);
      
      if (source === 'mock') {
        console.warn('⚠️ Using mock IPO data. Please configure a valid Finnhub API key for real data.');
      }
      
      // Map backend format to frontend format (with backward compatibility)
      const mappedIpos: Ipo[] = data.ipos.map((ipo: any) => ({
        ...ipo,
        name: ipo.company, // For backward compatibility
        date: ipo.expectedDate, // For backward compatibility
      }));
      
      set({ ipos: mappedIpos, isLoading: false, error: null, dataSource: source });
    } catch (error: any) {
      console.error('Error fetching IPOs:', error);
      set({ 
        ipos: [], 
        isLoading: false, 
        error: error.message || 'Failed to fetch IPO data',
        dataSource: null
      });
    }
  },
}));