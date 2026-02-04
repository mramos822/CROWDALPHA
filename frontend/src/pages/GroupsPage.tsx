import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

import { useGroupsStore } from "@/store/groups";
import { useUiStore } from "@/store/ui";
import { formatDate, formatPercent } from "@/lib/utils";
import { 
  Plus, Trophy, Users, TrendingUp, Calendar, DollarSign, 
  MessageCircle, Search, Filter, Star, ArrowUp, ArrowDown,
  Clock, Eye, Reply, Heart, Share2, MoreHorizontal,
  Lock, Unlock, UserPlus, Settings, Hash, Loader2
} from "lucide-react";

// Mock data for discussion groups and forum posts
const discussionGroups = [
  {
    id: '1',
    name: 'AAPL Discussion',
    symbol: 'AAPL',
    memberCount: 8,
    maxMembers: 10,
    isPrivate: false,
    lastActivity: '2 hours ago',
    description: 'Discuss Apple stock trends and analysis',
    members: [
      { id: '1', name: 'Alex Chen', avatar: 'AC', isOnline: true },
      { id: '2', name: 'Sarah Johnson', avatar: 'SJ', isOnline: false },
      { id: '3', name: 'Mike Rodriguez', avatar: 'MR', isOnline: true },
      { id: '4', name: 'Emma Wilson', avatar: 'EW', isOnline: false },
      { id: '5', name: 'David Kim', avatar: 'DK', isOnline: true },
      { id: '6', name: 'Lisa Brown', avatar: 'LB', isOnline: false },
      { id: '7', name: 'Tom Davis', avatar: 'TD', isOnline: true },
      { id: '8', name: 'Anna Lee', avatar: 'AL', isOnline: false }
    ]
  },
  {
    id: '2',
    name: 'TSLA Bulls',
    symbol: 'TSLA',
    memberCount: 10,
    maxMembers: 10,
    isPrivate: false,
    lastActivity: '5 hours ago',
    description: 'Tesla long-term investors group',
    members: [
      { id: '1', name: 'John Smith', avatar: 'JS', isOnline: true },
      { id: '2', name: 'Maria Garcia', avatar: 'MG', isOnline: true },
      { id: '3', name: 'Chris Taylor', avatar: 'CT', isOnline: false },
      { id: '4', name: 'Rachel Green', avatar: 'RG', isOnline: true },
      { id: '5', name: 'Kevin Park', avatar: 'KP', isOnline: false },
      { id: '6', name: 'Sophie Miller', avatar: 'SM', isOnline: true },
      { id: '7', name: 'Ryan Clark', avatar: 'RC', isOnline: true },
      { id: '8', name: 'Zoe Anderson', avatar: 'ZA', isOnline: false },
      { id: '9', name: 'James White', avatar: 'JW', isOnline: true },
      { id: '10', name: 'Maya Patel', avatar: 'MP', isOnline: false }
    ]
  },
  {
    id: '3',
    name: 'NVDA Analysis',
    symbol: 'NVDA',
    memberCount: 6,
    maxMembers: 10,
    isPrivate: true,
    lastActivity: '1 day ago',
    description: 'NVIDIA technical analysis and earnings discussion',
    members: [
      { id: '1', name: 'Daniel Kim', avatar: 'DK', isOnline: false },
      { id: '2', name: 'Laura Chen', avatar: 'LC', isOnline: true },
      { id: '3', name: 'Mark Thompson', avatar: 'MT', isOnline: false },
      { id: '4', name: 'Jennifer Liu', avatar: 'JL', isOnline: true },
      { id: '5', name: 'Robert Wang', avatar: 'RW', isOnline: false },
      { id: '6', name: 'Amanda Foster', avatar: 'AF', isOnline: true }
    ]
  }
];

const forumPosts = [
  {
    id: '1',
    title: 'Apple Q4 Earnings Analysis - What to Expect',
    content: 'With Apple reporting Q4 earnings next week, here are my thoughts on what to expect based on recent iPhone sales data and services growth...',
    author: 'TechAnalyst_2024',
    symbol: 'AAPL',
    upvotes: 1247,
    downvotes: 89,
    comments: 156,
    timestamp: '2 hours ago',
    flair: 'Earnings',
    isStickied: false
  },
  {
    id: '2',
    title: 'Tesla Stock Split Discussion - Should You Buy Before or After?',
    content: 'Tesla announced another stock split for next month. Historical data shows mixed results for stock split performance. What are your thoughts?',
    author: 'EVInvestor',
    symbol: 'TSLA',
    upvotes: 892,
    downvotes: 234,
    comments: 203,
    timestamp: '4 hours ago',
    flair: 'Stock Split',
    isStickied: false
  },
  {
    id: '3',
    title: 'NVIDIA AI Chip Demand Surge - Long Term Outlook',
    content: 'The AI revolution is driving unprecedented demand for NVIDIA chips. Here\'s my analysis of the long-term growth potential and valuation concerns...',
    author: 'AI_Trader',
    symbol: 'NVDA',
    upvotes: 2156,
    downvotes: 167,
    comments: 389,
    timestamp: '6 hours ago',
    flair: 'Analysis',
    isStickied: true
  },
  {
    id: '4',
    title: 'Market Crash Prediction - Bear Case for Tech Stocks',
    content: 'With rising interest rates and inflation concerns, I believe we\'re heading for a significant tech stock correction. Here\'s my bear case...',
    author: 'BearMarketGuru',
    symbol: 'SPY',
    upvotes: 567,
    downvotes: 1234,
    comments: 445,
    timestamp: '8 hours ago',
    flair: 'Bear Case',
    isStickied: false
  }
];

export function GroupsPage() {
  const { groups, fetchGroups, createGroup } = useGroupsStore();
  const { setLoading } = useUiStore();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'discussion' | 'my-groups' | 'forum'>('discussion');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupData, setNewGroupData] = useState({
    name: '',
    description: '',
    isPrivate: false
  });
  const [inviteUsernames, setInviteUsernames] = useState<string[]>([]);
  const [currentInviteUsername, setCurrentInviteUsername] = useState('');
  const [usernameSearchQuery, setUsernameSearchQuery] = useState('');
  const [usernameSearchResults, setUsernameSearchResults] = useState<Array<{username: string, first_name: string, last_name: string, avatar: string}>>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [realGroups, setRealGroups] = useState<any[]>([]);
  const [myGroups, setMyGroups] = useState<any[]>([]);
  const [groupMembers, setGroupMembers] = useState<Record<string, any[]>>({});
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [currentUserUid, setCurrentUserUid] = useState<string | null>(null);

  // Search users by username
  const searchUsers = useCallback(async (query: string) => {
    if (query.length < 1) {
      setUsernameSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setIsSearchingUsers(true);
    try {
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) return;

      const response = await fetch(`http://localhost:8000/api/groups/users/search?q=${encodeURIComponent(query)}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const users = await response.json();
        setUsernameSearchResults(users);
        setShowSearchResults(true);
      }
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setIsSearchingUsers(false);
    }
  }, []);

  // Debounced username search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (usernameSearchQuery) {
        searchUsers(usernameSearchQuery);
      } else {
        setUsernameSearchResults([]);
        setShowSearchResults(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [usernameSearchQuery, searchUsers]);

  // Fetch current user UID
  useEffect(() => {
    const fetchUser = async () => {
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) return;

      try {
        const response = await fetch('http://localhost:8000/api/auth/me', {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (response.ok) {
          const userData = await response.json();
          setCurrentUserUid(userData.firebase_uid);
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      }
    };
    fetchUser();
  }, []);

  // Fetch my groups (groups I created)
  const fetchMyGroups = useCallback(async () => {
    const authToken = localStorage.getItem('auth_token');
    if (!authToken) return;

    try {
      const response = await fetch('http://localhost:8000/api/groups/my-groups?as_creator=true', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const groups = await response.json();
        setMyGroups(groups);

        // Fetch members for my groups
        const membersMap: Record<string, any[]> = {};
        for (const group of groups) {
          try {
            const membersResponse = await fetch(`http://localhost:8000/api/groups/${group.id}/members`, {
              headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
              },
            });
            if (membersResponse.ok) {
              const members = await membersResponse.json();
              membersMap[group.id] = members;
            }
          } catch (error) {
            console.error(`Error fetching members for group ${group.id}:`, error);
          }
        }
        setGroupMembers(prev => ({ ...prev, ...membersMap }));
      }
    } catch (error) {
      console.error('Error fetching my groups:', error);
    }
  }, []);

  // Fetch real groups from API
  const fetchRealGroups = useCallback(async () => {
    setIsLoadingGroups(true);
    try {
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) {
        setIsLoadingGroups(false);
        return;
      }

      const response = await fetch('http://localhost:8000/api/groups/', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const groups = await response.json();
        setRealGroups(groups);

        // Fetch members for each group
        const membersMap: Record<string, any[]> = {};
        for (const group of groups) {
          try {
            const membersResponse = await fetch(`http://localhost:8000/api/groups/${group.id}/members`, {
              headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
              },
            });
            if (membersResponse.ok) {
              const members = await membersResponse.json();
              membersMap[group.id] = members;
            }
          } catch (error) {
            console.error(`Error fetching members for group ${group.id}:`, error);
          }
        }
        setGroupMembers(prev => ({ ...prev, ...membersMap }));
      }
    } catch (error) {
      console.error('Error fetching groups:', error);
    } finally {
      setIsLoadingGroups(false);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchGroups();
      await fetchRealGroups();
      await fetchMyGroups();
      setLoading(false);
    };

    loadData();
  }, [fetchGroups, fetchRealGroups, fetchMyGroups, setLoading]);

  // Use ONLY real groups from database - no mock data fallback
  const displayGroups = realGroups.map(g => ({
    id: g.id,
    name: g.name,
    symbol: g.symbol || g.name.split(' ')[0].toUpperCase(),
    memberCount: g.member_count || g.members?.length || 0,
    maxMembers: g.max_members || 10,
    isPrivate: g.is_private || false,
    lastActivity: g.last_activity ? new Date(g.last_activity).toLocaleString() : 'Unknown',
    description: g.description || '',
    members: groupMembers[g.id] || []
  }));

  const filteredDiscussionGroups = displayGroups.filter(group =>
    group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    group.symbol.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredForumPosts = forumPosts.filter(post =>
    post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    post.symbol.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateGroup = async () => {
    if (!newGroupData.name) return;

    try {
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) {
        console.error('No auth token found');
        return;
      }

      // Extract symbol from name if possible
      const symbolMatch = newGroupData.name.match(/\b[A-Z]{2,5}\b/);
      const symbol = symbolMatch ? symbolMatch[0] : newGroupData.name.split(' ')[0].toUpperCase();

      const response = await fetch('http://localhost:8000/api/groups/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newGroupData.name,
          description: newGroupData.description,
          symbol: symbol,
          is_private: newGroupData.isPrivate,
          max_members: 10,
          invite_usernames: inviteUsernames
        }),
      });

      if (response.ok) {
        const newGroup = await response.json();
        console.log('✅ Group created:', newGroup);
        
        // Refresh groups list
        await fetchMyGroups();
        await fetchRealGroups();
        
        // Switch to My Groups tab to show the newly created group
        setActiveTab('my-groups');
        
        // Show success message
        if (inviteUsernames.length > 0) {
          console.log(`✅ Group created and invitations sent to: ${inviteUsernames.join(', ')}`);
        }
        
        setShowCreateGroup(false);
        setNewGroupData({ name: '', description: '', isPrivate: false });
        setInviteUsernames([]);
        setCurrentInviteUsername('');
        setUsernameSearchQuery('');
        setShowSearchResults(false);
      } else {
        const error = await response.json();
        console.error('Failed to create group:', error);
        alert(`Failed to create group: ${error.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error creating group:', error);
      alert('Failed to create group. Please try again.');
    }
  };

  const handleUsernameSelect = useCallback((username: string) => {
    if (!inviteUsernames.includes(username)) {
      setInviteUsernames([...inviteUsernames, username]);
      setCurrentInviteUsername('');
      setUsernameSearchQuery('');
      setShowSearchResults(false);
    }
  }, [inviteUsernames]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Groups & Discussions</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Join stock discussion groups or participate in community forums.
              </p>
            </div>
            <Button onClick={() => setShowCreateGroup(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Group
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="flex space-x-1 bg-muted p-1 rounded-lg w-fit">
            <Button
              variant={activeTab === 'discussion' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('discussion')}
              className="flex items-center space-x-2"
            >
              <Users className="h-4 w-4" />
              <span>Discussion Groups</span>
              <Badge variant="secondary" className="ml-2">
                {displayGroups.length}
              </Badge>
            </Button>
            <Button
              variant={activeTab === 'my-groups' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('my-groups')}
              className="flex items-center space-x-2"
            >
              <Settings className="h-4 w-4" />
              <span>My Groups</span>
              <Badge variant="secondary" className="ml-2">
                {myGroups.length}
              </Badge>
            </Button>
            <Button
              variant={activeTab === 'forum' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('forum')}
              className="flex items-center space-x-2"
            >
              <MessageCircle className="h-4 w-4" />
              <span>Community Forum</span>
              <Badge variant="secondary" className="ml-2">
                {forumPosts.length}
              </Badge>
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`Search ${activeTab === 'discussion' ? 'groups' : 'posts'}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
          </div>
        </div>

      {/* Create Group Modal - Floating */}
      {showCreateGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full bg-white dark:bg-gray-800 shadow-2xl">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">Create Discussion Group</CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowCreateGroup(false)}
                  className="h-8 w-8 p-0"
                >
                  ×
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Group Name</label>
                <Input
                  placeholder="e.g., AAPL Discussion"
                  value={newGroupData.name}
                  onChange={(e) => setNewGroupData({ ...newGroupData, name: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                <Input
                  placeholder="Brief description of the group"
                  value={newGroupData.description}
                  onChange={(e) => setNewGroupData({ ...newGroupData, description: e.target.value })}
                  className="mt-1"
                />
              </div>
              
              {/* Username Invitations */}
              <div className="relative">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Invite Users</label>
                <div className="flex space-x-2 mt-1">
                  <div className="relative flex-1">
                    <Input
                      placeholder="Search username to invite"
                      value={usernameSearchQuery}
                      onChange={(e) => {
                        setUsernameSearchQuery(e.target.value);
                        setCurrentInviteUsername(e.target.value);
                      }}
                      onFocus={() => {
                        if (usernameSearchQuery.length > 0) {
                          setShowSearchResults(true);
                        }
                      }}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && currentInviteUsername.trim()) {
                          // Add exact username if not in search results
                          if (!usernameSearchResults.find(u => u.username === currentInviteUsername.trim())) {
                            handleUsernameSelect(currentInviteUsername.trim());
                          }
                        }
                      }}
                      className="mt-1"
                    />
                    
                    {/* Search Results Dropdown */}
                    {showSearchResults && usernameSearchResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-48 overflow-y-auto">
                        {usernameSearchResults.map((user) => (
                          <button
                            key={user.username}
                            type="button"
                            onClick={() => handleUsernameSelect(user.username)}
                            className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
                            disabled={inviteUsernames.includes(user.username)}
                          >
                            <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-medium">
                              {user.avatar || (user.first_name?.[0] || '') + (user.last_name?.[0] || '')}
                            </div>
                            <div className="flex-1">
                              <div className="font-medium text-gray-900 dark:text-white">
                                @{user.username}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {user.first_name} {user.last_name}
                              </div>
                            </div>
                            {inviteUsernames.includes(user.username) && (
                              <Badge variant="secondary" className="text-xs">Added</Badge>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                    
                    {isSearchingUsers && (
                      <div className="absolute right-2 top-2">
                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                      </div>
                    )}
                  </div>
                  <Button 
                    type="button"
                    size="sm"
                    onClick={() => {
                      if (currentInviteUsername.trim() && !inviteUsernames.includes(currentInviteUsername.trim())) {
                        handleUsernameSelect(currentInviteUsername.trim());
                      }
                    }}
                    disabled={!currentInviteUsername.trim() || inviteUsernames.includes(currentInviteUsername.trim())}
                  >
                    Add
                  </Button>
                </div>
                
                {/* Invited Users List */}
                {inviteUsernames.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Invited users:</p>
                    <div className="flex flex-wrap gap-1">
                      {inviteUsernames.map((username, index) => (
                        <Badge 
                          key={index} 
                          variant="secondary" 
                          className="flex items-center space-x-1"
                        >
                          <span>@{username}</span>
                          <button
                            onClick={() => setInviteUsernames(inviteUsernames.filter((_, i) => i !== index))}
                            className="ml-1 hover:text-red-500"
                          >
                            ×
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isPrivate"
                  checked={newGroupData.isPrivate}
                  onChange={(e) => setNewGroupData({ ...newGroupData, isPrivate: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="isPrivate" className="text-sm text-gray-700 dark:text-gray-300">
                  Private group (invite only)
                </label>
              </div>
              
              <div className="flex space-x-2 pt-2">
                <Button 
                  onClick={handleCreateGroup} 
                  className="flex-1"
                  disabled={!newGroupData.name}
                >
                  Create Group
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowCreateGroup(false);
                    setInviteUsernames([]);
                    setCurrentInviteUsername('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Discussion Groups Tab */}
      {activeTab === 'discussion' && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredDiscussionGroups.map((group) => (
            <Card key={group.id} className="cursor-pointer hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="font-mono">
                      {group.symbol}
                    </Badge>
                    {group.isPrivate ? (
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Unlock className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <Badge variant={group.memberCount === group.maxMembers ? 'destructive' : 'secondary'}>
                    {group.memberCount}/{group.maxMembers}
                  </Badge>
                </div>
                <CardTitle className="text-lg">{group.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{group.description}</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Members */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Members</span>
                      <span className="text-xs text-muted-foreground">{group.lastActivity}</span>
                    </div>
                    <div className="flex -space-x-2">
                      {group.members && group.members.length > 0 ? (
                        <>
                          {group.members.slice(0, 5).map((member: any, idx: number) => (
                            <div
                              key={member.firebase_uid || member.id || idx}
                              className="relative"
                            >
                              <div className="w-8 h-8 rounded-full bg-primary/10 border-2 border-background flex items-center justify-center text-xs font-medium">
                                {member.avatar || (member.first_name?.[0] || '') + (member.last_name?.[0] || '') || 'U'}
                              </div>
                            </div>
                          ))}
                          {group.members.length > 5 && (
                            <div className="w-8 h-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs">
                              +{group.members.length - 5}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-xs text-muted-foreground">No members yet</div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex space-x-2">
                    <Button 
                      size="sm" 
                      className="flex-1"
                      disabled={group.memberCount === group.maxMembers}
                      onClick={async () => {
                        if (group.memberCount < group.maxMembers) {
                          const authToken = localStorage.getItem('auth_token');
                          if (!authToken) return;
                          
                          try {
                            const response = await fetch(`http://localhost:8000/api/groups/${group.id}/join`, {
                              method: 'POST',
                              headers: {
                                'Authorization': `Bearer ${authToken}`,
                                'Content-Type': 'application/json',
                              },
                            });
                            
                            if (response.ok) {
                              await fetchRealGroups();
                              await fetchMyGroups();
                            }
                          } catch (error) {
                            console.error('Error joining group:', error);
                          }
                        }
                      }}
                    >
                      {group.memberCount === group.maxMembers ? (
                        <>
                          <Lock className="h-3 w-3 mr-1" />
                          Full
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-3 w-3 mr-1" />
                          Join
                        </>
                      )}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => navigate(`/groups/${group.id}`)}
                    >
                      <MessageCircle className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* My Groups Tab */}
      {activeTab === 'my-groups' && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {myGroups.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500 dark:text-gray-400 mb-4">You haven't created any groups yet.</p>
              <Button onClick={() => setShowCreateGroup(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Group
              </Button>
            </div>
          ) : (
            myGroups.map((group) => {
              const displayGroup = {
                id: group.id,
                name: group.name,
                symbol: group.symbol || group.name.split(' ')[0].toUpperCase(),
                memberCount: group.member_count || group.members?.length || 0,
                maxMembers: group.max_members || 10,
                isPrivate: group.is_private || false,
                lastActivity: group.last_activity ? new Date(group.last_activity).toLocaleString() : 'Unknown',
                description: group.description || '',
                members: groupMembers[group.id] || []
              };
              
              return (
                <Card key={displayGroup.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="font-mono">
                          {displayGroup.symbol}
                        </Badge>
                        {displayGroup.isPrivate ? (
                          <Lock className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Unlock className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <Badge variant={displayGroup.memberCount === displayGroup.maxMembers ? 'destructive' : 'secondary'}>
                        {displayGroup.memberCount}/{displayGroup.maxMembers}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg">{displayGroup.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{displayGroup.description}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Members</span>
                          <span className="text-xs text-muted-foreground">{displayGroup.lastActivity}</span>
                        </div>
                        <div className="flex -space-x-2">
                          {displayGroup.members && displayGroup.members.length > 0 ? (
                            <>
                              {displayGroup.members.slice(0, 5).map((member: any, idx: number) => (
                                <div
                                  key={member.firebase_uid || member.id || idx}
                                  className="relative"
                                >
                                  <div className="w-8 h-8 rounded-full bg-primary/10 border-2 border-background flex items-center justify-center text-xs font-medium">
                                    {member.avatar || (member.first_name?.[0] || '') + (member.last_name?.[0] || '') || 'U'}
                                  </div>
                                </div>
                              ))}
                              {displayGroup.members.length > 5 && (
                                <div className="w-8 h-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs">
                                  +{displayGroup.members.length - 5}
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="text-xs text-muted-foreground">No members yet</div>
                          )}
                        </div>
                      </div>

                      <div className="flex space-x-2">
                        <Button 
                          size="sm" 
                          className="flex-1"
                          onClick={() => navigate(`/groups/${displayGroup.id}`)}
                        >
                          <MessageCircle className="h-3 w-3 mr-1" />
                          Open Chat
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => navigate(`/groups/${displayGroup.id}`)}
                        >
                          <Settings className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Forum Tab */}
      {activeTab === 'forum' && (
        <div className="space-y-4">
          {filteredForumPosts.map((post) => (
            <Card key={post.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex space-x-4">
                  {/* Voting */}
                  <div className="flex flex-col items-center space-y-1">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium">{post.upvotes - post.downvotes}</span>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-2">
                      <Badge variant="outline" className="font-mono text-xs">
                        {post.symbol}
                      </Badge>
                      {post.flair && (
                        <Badge variant="secondary" className="text-xs">
                          {post.flair}
                        </Badge>
                      )}
                      {post.isStickied && (
                        <Badge variant="default" className="text-xs">
                          <Star className="h-3 w-3 mr-1" />
                          Sticky
                        </Badge>
                      )}
                    </div>

                    <h3 className="text-lg font-semibold mb-2 hover:text-primary cursor-pointer">
                      {post.title}
                    </h3>

                    <p className="text-muted-foreground text-sm mb-3 line-clamp-2">
                      {post.content}
                    </p>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center space-x-4">
                        <span>u/{post.author}</span>
                        <span className="flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          {post.timestamp}
                        </span>
                      </div>
                      <div className="flex items-center space-x-4">
                        <span className="flex items-center">
                          <MessageCircle className="h-3 w-3 mr-1" />
                          {post.comments} comments
                        </span>
                        <Button variant="ghost" size="sm" className="h-6 px-2">
                          <Share2 className="h-3 w-3 mr-1" />
                          Share
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}