// Mock API service - easily swappable for real backend
let baseUrl = '';

export const setBaseUrl = (url: string) => {
  baseUrl = url;
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mock API responses
export const api = {
  // Auth endpoints
  auth: {
    login: async (email: string, password: string) => {
      await delay(1000);
      return {
        user: {
          id: '1',
          name: 'John Doe',
          email,
          avatar: 'https://github.com/shadcn.png'
        },
        token: 'mock-jwt-token'
      };
    },
    
    register: async (name: string, email: string, password: string) => {
      await delay(1000);
      return {
        user: {
          id: '1',
          name,
          email,
          avatar: 'https://github.com/shadcn.png'
        },
        token: 'mock-jwt-token'
      };
    }
  },

  // Portfolio endpoints
  portfolio: {
    getSummary: async () => {
      await delay(300);
      return {
        totalValue: 23400.50,
        dailyPl: 835.00,
        weeklyReturn: 4.8,
        monthlyReturn: 12.4,
        topMover: {
          symbol: 'NVDA',
          change: 125.80,
          changePercent: 8.14
        },
        activeAlerts: 3
      };
    },

    getHoldings: async () => {
      await delay(500);
      return [
        {
          symbol: 'AAPL',
          name: 'Apple Inc.',
          qty: 70,
          avgPrice: 175.50,
          lastPrice: 182.30,
          pl: 476,
          weight: 35.2
        },
        {
          symbol: 'NVDA',
          name: 'NVIDIA Corporation',
          qty: 40,
          avgPrice: 420.00,
          lastPrice: 455.80,
          pl: 1432,
          weight: 38.7
        },
        {
          symbol: 'AMD',
          name: 'Advanced Micro Devices',
          qty: 120,
          avgPrice: 125.40,
          lastPrice: 138.90,
          pl: 1620,
          weight: 26.1
        }
      ];
    }
  },

  // Signals endpoints - Now using real backend API
  signals: {
    getSignals: async (filters?: any) => {
      // This is now handled by the signals store directly
      // Keeping for backward compatibility
      const API_BASE_URL = 'http://localhost:8000';
      try {
        const { auth } = await import('@/lib/firebase');
        if (!auth || !auth.currentUser) {
          throw new Error('User not authenticated');
        }
        const token = await auth.currentUser.getIdToken();
        
        const response = await fetch(`${API_BASE_URL}/api/signals/history?limit=20`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch signals: ${response.statusText}`);
        }

        const data = await response.json();
        return data.signals || [];
      } catch (error) {
        console.error('Error fetching signals:', error);
        // Return empty array on error
        return [];
      }
    },

    generateSignal: async (ticker: string) => {
      const API_BASE_URL = 'http://localhost:8000';
      try {
        const { auth } = await import('@/lib/firebase');
        if (!auth || !auth.currentUser) {
          throw new Error('User not authenticated');
        }
        const token = await auth.currentUser.getIdToken();
        
        const response = await fetch(`${API_BASE_URL}/api/signals/generate`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ticker: ticker.toUpperCase(),
            news_limit: 10
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: response.statusText }));
          throw new Error(errorData.detail || `Failed to generate signal: ${response.statusText}`);
        }

        return await response.json();
      } catch (error) {
        console.error('Error generating signal:', error);
        throw error;
      }
    },

    createAlert: async (alertData: any) => {
      await delay(400);
      return {
        id: Date.now().toString(),
        ...alertData,
        createdAt: new Date().toISOString()
      };
    }
  },

  // IPOs endpoints
  ipos: {
    getIpos: async (month?: string) => {
      await delay(400);
      return [
        {
          id: '1',
          company: 'Reddit Inc.',
          ticker: 'RDDT',
          expectedDate: '2024-01-15',
          size: '$750M',
          underwriters: ['Goldman Sachs', 'Morgan Stanley', 'JPMorgan'],
          riskScore: 2
        },
        {
          id: '2',
          company: 'Astera Labs',
          ticker: 'ALAB',
          expectedDate: '2024-01-22',
          size: '$534M',
          underwriters: ['Goldman Sachs', 'Morgan Stanley', 'Barclays'],
          riskScore: 1
        },
        {
          id: '3',
          company: 'Rubrik Inc.',
          ticker: 'RBRK',
          expectedDate: '2024-01-29',
          size: '$1.2B',
          underwriters: ['Goldman Sachs', 'Morgan Stanley', 'Citigroup'],
          riskScore: 3
        }
      ];
    }
  },

  // Groups endpoints
  groups: {
    getGroups: async () => {
      await delay(500);
      return [
        {
          id: '1',
          name: 'Q3 Campus Cup',
          prize: '$1,000 Amazon Gift Card',
          start: '2024-01-01',
          end: '2024-03-31',
          members: [
            { id: '1', name: 'John Doe', email: 'john@example.com', joinedAt: '2024-01-01' },
            { id: '2', name: 'Jane Smith', email: 'jane@example.com', joinedAt: '2024-01-02' },
            { id: '3', name: 'Mike Johnson', email: 'mike@example.com', joinedAt: '2024-01-03' }
          ],
          leaderboard: [
            { userId: '1', name: 'John Doe', returnPct: 18.7 },
            { userId: '2', name: 'Jane Smith', returnPct: 12.3 },
            { userId: '3', name: 'Mike Johnson', returnPct: -2.3 }
          ]
        }
      ];
    },

    createGroup: async (groupData: any) => {
      await delay(600);
      return {
        id: Date.now().toString(),
        ...groupData
      };
    }
  }
};
