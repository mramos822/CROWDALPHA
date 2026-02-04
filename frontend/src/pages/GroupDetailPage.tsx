import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, Send, Hash, Users, Lock, Unlock, 
  Settings, Trash2, UserMinus, Loader2, DollarSign, AtSign, MessageCircle
} from "lucide-react";

// Helper function to format time
const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

interface Message {
  id: string;
  sender_uid: string;
  sender_username: string;
  sender_name: string;
  sender_avatar: string;
  content: string;
  mentions: string[];
  stock_symbols: string[];
  created_at: string;
}

interface Group {
  id: string;
  name: string;
  description: string;
  symbol: string;
  creator_uid: string;
  is_private: boolean;
  max_members: number;
  member_count: number;
  members: string[];
}

interface Member {
  firebase_uid: string;
  username: string;
  first_name: string;
  last_name: string;
  avatar: string;
}

export function GroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [currentUserUid, setCurrentUserUid] = useState<string | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Check if user is near bottom of messages
  const handleScroll = () => {
    const container = messagesEndRef.current?.parentElement?.parentElement;
    if (!container) return;
    
    const threshold = 200; // pixels from bottom
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    setShouldAutoScroll(isNearBottom);
  };

  useEffect(() => {
    if (shouldAutoScroll && messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, shouldAutoScroll]);

  useEffect(() => {
    const loadGroupData = async () => {
      if (!groupId) return;

      setIsLoading(true);
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) {
        navigate('/groups');
        return;
      }

      try {
        // Get current user UID from token (you might need to decode JWT or fetch from /api/auth/me)
        const userResponse = await fetch('http://localhost:8000/api/auth/me', {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (userResponse.ok) {
          const userData = await userResponse.json();
          setCurrentUserUid(userData.firebase_uid);
        }

        // Fetch group
        const groupResponse = await fetch(`http://localhost:8000/api/groups/${groupId}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (groupResponse.ok) {
          const groupData = await groupResponse.json();
          setGroup(groupData);

          // Fetch members
          const membersResponse = await fetch(`http://localhost:8000/api/groups/${groupId}/members`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
          });
          if (membersResponse.ok) {
            const membersData = await membersResponse.json();
            setMembers(membersData);
          }

          // Fetch messages
          await loadMessages();
        } else {
          navigate('/groups');
        }
      } catch (error) {
        console.error('Error loading group:', error);
        navigate('/groups');
      } finally {
        setIsLoading(false);
      }
    };

    loadGroupData();

    // Poll for new messages every 3 seconds
    const interval = setInterval(() => {
      if (groupId) loadMessages();
    }, 3000);

    return () => clearInterval(interval);
  }, [groupId, navigate]);

  const loadMessages = async () => {
    if (!groupId) return;

    const authToken = localStorage.getItem('auth_token');
    if (!authToken) return;

    try {
      const response = await fetch(`http://localhost:8000/api/groups/${groupId}/messages?limit=100`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (response.ok) {
        const messagesData = await response.json();
        setMessages(messagesData);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !groupId || isSending) return;

    setIsSending(true);
    const authToken = localStorage.getItem('auth_token');
    if (!authToken) return;

    try {
      const response = await fetch(`http://localhost:8000/api/groups/${groupId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: newMessage,
          mentions: [],
          stock_symbols: []
        })
      });

      if (response.ok) {
        const newMsg = await response.json();
        setMessages([...messages, newMsg]);
        setNewMessage("");
        messageInputRef.current?.focus();
        setTimeout(() => loadMessages(), 500); // Refresh to get updated data
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleRemoveMember = async (memberUid: string) => {
    if (!groupId || !confirm(`Remove this member from the group?`)) return;

    const authToken = localStorage.getItem('auth_token');
    if (!authToken) return;

    try {
      const response = await fetch(`http://localhost:8000/api/groups/${groupId}/members/${memberUid}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (response.ok) {
        // Reload group data
        const groupResponse = await fetch(`http://localhost:8000/api/groups/${groupId}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (groupResponse.ok) {
          const groupData = await groupResponse.json();
          setGroup(groupData);
        }

        const membersResponse = await fetch(`http://localhost:8000/api/groups/${groupId}/members`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (membersResponse.ok) {
          const membersData = await membersResponse.json();
          setMembers(membersData);
        }
      }
    } catch (error) {
      console.error('Error removing member:', error);
    }
  };

  const handleDeleteGroup = async () => {
    if (!groupId || !confirm('Are you sure you want to delete this group? This action cannot be undone.')) return;

    const authToken = localStorage.getItem('auth_token');
    if (!authToken) return;

    try {
      const response = await fetch(`http://localhost:8000/api/groups/${groupId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (response.ok) {
        navigate('/groups');
      }
    } catch (error) {
      console.error('Error deleting group:', error);
    }
  };

  const renderMessageContent = (content: string, mentions: string[] = [], stockSymbols: string[] = []) => {
    // Split by mentions and stock symbols
    const parts: Array<{ type: 'text' | 'mention' | 'stock'; content: string }> = [];
    let lastIndex = 0;
    
    // Find all mentions and stock symbols
    const patterns: Array<{ type: 'mention' | 'stock'; match: RegExpMatchArray; index: number }> = [];
    
    // Find mentions (@username)
    const mentionRegex = /@(\w+)/g;
    let match;
    while ((match = mentionRegex.exec(content)) !== null) {
      patterns.push({ type: 'mention', match, index: match.index });
    }
    
    // Find stock symbols ($SYMBOL)
    const stockRegex = /\$([A-Z]{1,5})\b/g;
    while ((match = stockRegex.exec(content)) !== null) {
      patterns.push({ type: 'stock', match, index: match.index });
    }
    
    // Sort by index
    patterns.sort((a, b) => a.index - b.index);
    
    patterns.forEach(pattern => {
      // Add text before pattern
      if (pattern.index > lastIndex) {
        parts.push({ type: 'text', content: content.substring(lastIndex, pattern.index) });
      }
      
      // Add the pattern
      parts.push({
        type: pattern.type,
        content: pattern.match[0]
      });
      
      lastIndex = pattern.index + pattern.match[0].length;
    });
    
    // Add remaining text
    if (lastIndex < content.length) {
      parts.push({ type: 'text', content: content.substring(lastIndex) });
    }
    
    if (parts.length === 0) {
      parts.push({ type: 'text', content });
    }
    
    return (
      <span>
        {parts.map((part, idx) => {
          if (part.type === 'mention') {
            return (
              <span key={idx} className="text-blue-500 dark:text-blue-400 font-medium">
                {part.content}
              </span>
            );
          } else if (part.type === 'stock') {
            return (
              <span 
                key={idx} 
                className="text-green-600 dark:text-green-400 font-semibold cursor-pointer hover:underline"
                onClick={() => navigate(`/stock/${part.content.substring(1)}`)}
              >
                {part.content}
              </span>
            );
          }
          return <span key={idx}>{part.content}</span>;
        })}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">Group not found</p>
          <Button onClick={() => navigate('/groups')}>Back to Groups</Button>
        </div>
      </div>
    );
  }

  const isCreator = currentUserUid === group.creator_uid;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/groups')}
                className="mr-2"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div className="flex items-center space-x-3">
                <Hash className="h-5 w-5 text-gray-400" />
                <div>
                  <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {group.name}
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {group.description}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="font-mono">
                {group.symbol}
              </Badge>
              {group.is_private ? (
                <Lock className="h-4 w-4 text-gray-400" />
              ) : (
                <Unlock className="h-4 w-4 text-gray-400" />
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMembers(!showMembers)}
              >
                <Users className="h-4 w-4 mr-2" />
                {group.member_count} members
              </Button>
              {isCreator && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSettings(!showSettings)}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDeleteGroup}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div 
          className="flex-1 overflow-y-auto px-6 py-4"
          onScroll={handleScroll}
        >
          <div className="max-w-4xl mx-auto space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <MessageCircle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  No messages yet. Start the conversation!
                </p>
              </div>
            ) : (
              messages.map((message, idx) => {
                const prevMessage = idx > 0 ? messages[idx - 1] : null;
                const showAvatar = !prevMessage || prevMessage.sender_uid !== message.sender_uid ||
                  new Date(message.created_at).getTime() - new Date(prevMessage.created_at).getTime() > 300000; // 5 minutes

                return (
                  <div key={message.id} className={`flex space-x-3 ${showAvatar ? 'mt-4' : 'mt-1'}`}>
                    {showAvatar ? (
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-medium">
                          {message.sender_avatar || message.sender_username[0]?.toUpperCase() || 'U'}
                        </div>
                      </div>
                    ) : (
                      <div className="w-10" />
                    )}
                    <div className="flex-1 min-w-0">
                      {showAvatar && (
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {message.sender_name || message.sender_username}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatTimeAgo(message.created_at)}
                          </span>
                          {message.mentions.length > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              <AtSign className="h-3 w-3 mr-1" />
                              {message.mentions.length}
                            </Badge>
                          )}
                          {message.stock_symbols.length > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              <DollarSign className="h-3 w-3 mr-1" />
                              {message.stock_symbols.length}
                            </Badge>
                          )}
                        </div>
                      )}
                      <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                        {renderMessageContent(message.content, message.mentions, message.stock_symbols)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Message Input */}
        <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="max-w-4xl mx-auto flex space-x-2">
            <Input
              ref={messageInputRef}
              placeholder={`Message #${group.name}...`}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              className="flex-1"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || isSending}
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="max-w-4xl mx-auto mt-2 text-xs text-gray-500 dark:text-gray-400">
            Tip: Use @username to mention users, $SYMBOL to mention stocks
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Group Settings</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSettings(false)}
                >
                  ×
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Group Name</label>
                <Input
                  defaultValue={group?.name}
                  className="mt-1"
                  readOnly
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Input
                  defaultValue={group?.description}
                  className="mt-1"
                  readOnly
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={group?.is_private || false}
                  readOnly
                  className="rounded"
                />
                <label className="text-sm">Private Group</label>
              </div>
              <div>
                <label className="text-sm font-medium">Members</label>
                <p className="text-sm text-muted-foreground mt-1">
                  {group?.member_count || 0} / {group?.max_members || 10} members
                </p>
              </div>
              <div className="flex space-x-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowMembers(true);
                    setShowSettings(false);
                  }}
                >
                  Manage Members
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteGroup}
                >
                  Delete Group
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Members Sidebar */}
      {showMembers && (
        <div className="w-64 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Members</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowMembers(false)}
            >
              ×
            </Button>
          </div>
          <div className="space-y-2">
            {members.map((member) => (
              <div
                key={member.firebase_uid}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <div className="flex items-center space-x-2">
                  <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-medium">
                    {member.avatar || member.username[0]?.toUpperCase() || 'U'}
                  </div>
                  <div>
                    <div className="font-medium text-sm text-gray-900 dark:text-white">
                      {member.first_name} {member.last_name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      @{member.username}
                    </div>
                  </div>
                </div>
                {isCreator && member.firebase_uid !== group.creator_uid && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveMember(member.firebase_uid)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <UserMinus className="h-4 w-4" />
                  </Button>
                )}
                {member.firebase_uid === group.creator_uid && (
                  <Badge variant="secondary" className="text-xs">Creator</Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

