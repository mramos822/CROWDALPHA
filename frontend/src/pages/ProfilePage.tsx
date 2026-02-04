import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { usePortfolioStore } from "@/store/portfolio";
import { useSignalsStore } from "@/store/signals";
import { PlaidLink } from "@/components/PlaidLink";
import type { PlaidLinkHandle } from "@/components/PlaidLink";
import { plaidService } from "@/services/plaid";
import { 
  ArrowLeft, 
  User, 
  Settings, 
  Bell, 
  Shield, 
  CreditCard, 
  LogOut,
  Edit3,
  Save,
  X,
  Link2,
  TrendingUp,
  DollarSign,
  Activity,
  Loader2,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

interface UserProfile {
  firebase_uid: string;
  email: string;
  first_name: string;
  last_name: string;
  username: string;
  plan_tier: string;
  joined_at: string;
  last_login: string;
  plaid_access_token?: string | null;
  plaid_item_id?: string | null;
}

export function ProfilePage() {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [userInfo, setUserInfo] = useState<UserProfile | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [linkToken, setLinkToken] = useState('');
  const [isCreatingLinkToken, setIsCreatingLinkToken] = useState(false);
  const [plaidError, setPlaidError] = useState('');
  const plaidRef = useRef<PlaidLinkHandle>(null);

  const { 
    isConnected, 
    holdings, 
    summary, 
    checkConnection 
  } = usePortfolioStore();

  // Determine actual Plaid connection status from user data
  const hasPlaidConnection = userInfo?.plaid_access_token != null && userInfo?.plaid_access_token !== '';
  
  const { signals, fetchSignals } = useSignalsStore();

  // Fetch user profile from Firebase
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const authToken = localStorage.getItem('auth_token');
        if (!authToken) {
          console.log('No auth token found');
          setIsLoadingUser(false);
          return;
        }

        const response = await fetch('http://localhost:8000/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const userData = await response.json();
          console.log('📋 [PROFILE] Received user data:', userData);
          console.log('📋 [PROFILE] Full user data structure:', JSON.stringify(userData, null, 2));
          setUserInfo(userData);
        } else {
          const errorText = await response.text();
          console.error('❌ [PROFILE] Failed to fetch user profile:', response.status, errorText);
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      } finally {
        setIsLoadingUser(false);
      }
    };

    fetchUserProfile();
    checkConnection();
    fetchSignals();
  }, []); // Only run once on mount

  // Fetch Plaid link token
  const fetchLinkToken = async () => {
    try {
      setIsCreatingLinkToken(true);
      setPlaidError('');
      
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) {
        setPlaidError('Please log in first');
        return;
      }

      const response = await plaidService.createLinkToken();
      setLinkToken(response.link_token);
    } catch (err) {
      console.error('Failed to get link token:', err);
      setPlaidError(err instanceof Error ? err.message : 'Failed to initialize brokerage connection');
    } finally {
      setIsCreatingLinkToken(false);
    }
  };

  // Handle successful Plaid connection
  const handlePlaidSuccess = async (publicToken: string) => {
    try {
      setIsCreatingLinkToken(true);
      setPlaidError('');
      
      const response = await plaidService.exchangePublicToken(publicToken);
      localStorage.setItem('plaid_access_token', response.access_token);
      
      // Re-check connection to refresh data
      await checkConnection();
    } catch (err) {
      console.error('Failed to connect Plaid:', err);
      setPlaidError(err instanceof Error ? err.message : 'Failed to connect brokerage account');
    } finally {
      setIsCreatingLinkToken(false);
    }
  };

  const handleSave = async () => {
    if (!userInfo) return;
    
    try {
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) return;

      const response = await fetch('http://localhost:8000/api/auth/me', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          first_name: userInfo.first_name,
          last_name: userInfo.last_name,
          username: userInfo.username,
        }),
      });

      if (response.ok) {
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    // Reset form if needed
  };

  // Calculate days active
  const getDaysActive = () => {
    if (!userInfo?.joined_at) return 0;
    const joinDate = new Date(userInfo.joined_at);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - joinDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Format date
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Unknown';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Unknown';
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long' 
      });
    } catch {
      return 'Unknown';
    }
  };

  // Get portfolio value - only if Plaid is connected
  const portfolioValue = hasPlaidConnection && isConnected 
    ? (summary?.totalValue || (holdings.length > 0 ? holdings.reduce((sum, h) => sum + (h.lastPrice * h.qty), 0) : 0))
    : 0;

  // Get active signals count
  const activeSignalsCount = signals.length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="mb-4 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Profile</h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Manage your account settings and preferences.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Information */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Information */}
            <Card className="bg-white dark:bg-gray-800 border-0 shadow-lg">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center space-x-2 text-xl font-semibold text-gray-900 dark:text-white">
                    <User className="h-5 w-5" />
                    <span>Basic Information</span>
                  </CardTitle>
                  {!isEditing && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditing(true)}
                      className="text-gray-600 dark:text-gray-400"
                    >
                      <Edit3 className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {isLoadingUser ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  </div>
                ) : userInfo ? (
                  <>
                    <div className="flex items-center space-x-4">
                      <div className="h-20 w-20 bg-blue-600 rounded-full flex items-center justify-center">
                        <User className="h-10 w-10 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                          {userInfo.first_name || ''} {userInfo.last_name || ''}
                        </h3>
                        <Badge variant="secondary" className="mt-1 capitalize">
                          {(userInfo.plan_tier || 'free')} Plan
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          First Name
                        </label>
                        {isEditing ? (
                          <Input
                            value={userInfo.first_name || ''}
                            onChange={(e) => setUserInfo({...userInfo, first_name: e.target.value})}
                            className="bg-white dark:bg-gray-700"
                          />
                        ) : (
                          <p className="text-gray-900 dark:text-white">{userInfo.first_name || 'N/A'}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Last Name
                        </label>
                        {isEditing ? (
                          <Input
                            value={userInfo.last_name || ''}
                            onChange={(e) => setUserInfo({...userInfo, last_name: e.target.value})}
                            className="bg-white dark:bg-gray-700"
                          />
                        ) : (
                          <p className="text-gray-900 dark:text-white">{userInfo.last_name || 'N/A'}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Email Address
                        </label>
                        <p className="text-gray-900 dark:text-white">{userInfo.email || 'N/A'}</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Username
                        </label>
                        {isEditing ? (
                          <Input
                            value={userInfo.username || ''}
                            onChange={(e) => setUserInfo({...userInfo, username: e.target.value})}
                            className="bg-white dark:bg-gray-700"
                          />
                        ) : (
                          <p className="text-gray-900 dark:text-white">@{userInfo.username || 'N/A'}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Member Since
                        </label>
                        <p className="text-gray-900 dark:text-white">{formatDate(userInfo.joined_at)}</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Subscription Plan
                        </label>
                        <Badge variant="secondary" className="capitalize">{userInfo.plan_tier}</Badge>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">Failed to load user profile</p>
                  </div>
                )}

                {isEditing && (
                  <div className="flex space-x-3 pt-4">
                    <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </Button>
                    <Button variant="outline" onClick={handleCancel}>
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Plaid Connection Card */}
            <Card className={`bg-white dark:bg-gray-800 border-0 shadow-lg ${!hasPlaidConnection ? 'border-2 border-dashed border-blue-300 dark:border-blue-700' : ''}`}>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center space-x-2 text-xl font-semibold text-gray-900 dark:text-white">
                  <Link2 className="h-5 w-5" />
                  <span>Brokerage Connection</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {hasPlaidConnection ? (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                      <div>
                        <p className="font-medium text-green-900 dark:text-green-100">Connected</p>
                        <p className="text-sm text-green-700 dark:text-green-300">
                          Your brokerage account is synced and up to date
                        </p>
                      </div>
                    </div>
                    {holdings.length > 0 && (
                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                          <p className="text-sm text-gray-600 dark:text-gray-400">Holdings</p>
                          <p className="text-xl font-bold text-gray-900 dark:text-white">{holdings.length}</p>
                        </div>
                        <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                          <p className="text-sm text-gray-600 dark:text-gray-400">Last Synced</p>
                          <p className="text-xl font-bold text-gray-900 dark:text-white">Now</p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="flex items-start space-x-4">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                          <Link2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                            Connect Your Brokerage Account
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                            Sync your portfolio from Robinhood, TD Ameritrade, E*TRADE, and 11,000+ other financial institutions to get real-time insights and AI-powered recommendations.
                          </p>
                          <Button 
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                            onClick={() => {
                              if (linkToken && plaidRef.current?.ready) {
                                plaidRef.current.open();
                              } else if (!linkToken) {
                                fetchLinkToken();
                              }
                            }}
                            disabled={isCreatingLinkToken || !!(linkToken && !plaidRef.current?.ready)}
                          >
                            {isCreatingLinkToken ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Connecting...
                              </>
                            ) : (
                              <>
                                <Link2 className="h-4 w-4 mr-2" />
                                Connect Account
                              </>
                            )}
                          </Button>
                          {plaidError && (
                            <p className="text-sm text-red-600 dark:text-red-400 mt-2">{plaidError}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    {linkToken && (
                      <PlaidLink
                        ref={plaidRef}
                        linkToken={linkToken}
                        onSuccess={handlePlaidSuccess}
                        onError={(error) => setPlaidError(error)}
                      />
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Security Settings */}
            <Card className="bg-white dark:bg-gray-800 border-0 shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center space-x-2 text-xl font-semibold text-gray-900 dark:text-white">
                  <Shield className="h-5 w-5" />
                  <span>Security</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">Password</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Last changed 3 months ago</p>
                  </div>
                  <Button variant="outline" size="sm">
                    Change Password
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">Two-Factor Authentication</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Add an extra layer of security</p>
                  </div>
                  <Button variant="outline" size="sm">
                    Enable 2FA
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card className="bg-white dark:bg-gray-800 border-0 shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="ghost"
                  className="w-full justify-start text-gray-700 dark:text-gray-300"
                  onClick={() => navigate('/settings')}
                >
                  <Settings className="h-4 w-4 mr-3" />
                  App Settings
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-gray-700 dark:text-gray-300"
                >
                  <Bell className="h-4 w-4 mr-3" />
                  Notifications
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-gray-700 dark:text-gray-300"
                >
                  <CreditCard className="h-4 w-4 mr-3" />
                  Billing
                </Button>
              </CardContent>
            </Card>

            {/* Account Stats */}
            <Card className="bg-white dark:bg-gray-800 border-0 shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">
                  Account Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex items-center justify-center mb-2">
                    <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {getDaysActive()}
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Days Active</div>
                </div>
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex items-center justify-center mb-2">
                    <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {portfolioValue > 0 ? `$${portfolioValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Portfolio Value
                  </div>
                </div>
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex items-center justify-center mb-2">
                    <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400 mr-2" />
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {activeSignalsCount}
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Active Signals</div>
                </div>
                {isConnected && holdings.length > 0 && (
                  <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="flex items-center justify-center mb-2">
                      <Link2 className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">
                        {holdings.length}
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Holdings</div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sign Out */}
            <Card className="bg-white dark:bg-gray-800 border-0 shadow-lg">
              <CardContent className="pt-6">
                <Button
                  variant="outline"
                  className="w-full text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20"
                  onClick={() => {
                    if (confirm('Are you sure you want to sign out?')) {
                      // Navigate back to landing page
                      navigate('/');
                    }
                  }}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
