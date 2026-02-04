import { create } from 'zustand';

interface Group {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  totalValue: number;
  weeklyReturn: number;
  monthlyReturn: number;
  createdAt: string;
}

interface Member {
  id: string;
  name: string;
  avatar?: string;
  portfolioValue: number;
  weeklyReturn: number;
  monthlyReturn: number;
}

interface LeaderboardEntry {
  rank: number;
  member: Member;
  totalReturn: number;
}

interface GroupsStore {
  groups: Group[];
  currentGroup: Group | null;
  leaderboard: LeaderboardEntry[];
  isLoading: boolean;
  fetchGroups: () => Promise<void>;
  fetchLeaderboard: (groupId: string) => Promise<void>;
  createGroup: (groupData: Omit<Group, 'id' | 'createdAt'>) => Promise<void>;
}

export const useGroupsStore = create<GroupsStore>((set) => ({
  groups: [],
  currentGroup: null,
  leaderboard: [],
  isLoading: false,

  fetchGroups: async () => {
    set({ isLoading: true });
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const groups: Group[] = [
      {
        id: '1',
        name: 'Tech Titans',
        description: 'For tech-focused investors',
        memberCount: 156,
        totalValue: 2840000,
        weeklyReturn: 3.2,
        monthlyReturn: 12.8,
        createdAt: '2024-01-01T00:00:00Z'
      },
      {
        id: '2',
        name: 'Growth Seekers',
        description: 'High-growth stock enthusiasts',
        memberCount: 89,
        totalValue: 1890000,
        weeklyReturn: 2.8,
        monthlyReturn: 9.5,
        createdAt: '2024-01-02T00:00:00Z'
      }
    ];
    
    set({ groups, isLoading: false });
  },

  fetchLeaderboard: async (groupId: string) => {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const leaderboard: LeaderboardEntry[] = [
      {
        rank: 1,
        member: {
          id: '1',
          name: 'Alex Chen',
          portfolioValue: 125000,
          weeklyReturn: 8.5,
          monthlyReturn: 24.2
        },
        totalReturn: 24.2
      },
      {
        rank: 2,
        member: {
          id: '2',
          name: 'Sarah Johnson',
          portfolioValue: 98000,
          weeklyReturn: 6.8,
          monthlyReturn: 19.7
        },
        totalReturn: 19.7
      },
      {
        rank: 3,
        member: {
          id: '3',
          name: 'Mike Rodriguez',
          portfolioValue: 87000,
          weeklyReturn: 5.2,
          monthlyReturn: 16.4
        },
        totalReturn: 16.4
      }
    ];
    
    set({ leaderboard });
  },

  createGroup: async (groupData) => {
    const newGroup: Group = {
      ...groupData,
      id: Date.now().toString(),
      createdAt: new Date().toISOString()
    };
    
    set(state => ({
      groups: [...state.groups, newGroup]
    }));
  },
}));