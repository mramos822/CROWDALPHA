import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

import { useUiStore } from "@/store/ui";
import { 
  User, 
  Bell, 
  Link2, 
  Trash2, 
  Moon, 
  Sun, 
  Check,
  AlertTriangle 
} from "lucide-react";

export function SettingsPage() {
  const { theme, toggleTheme } = useUiStore();
  const navigate = useNavigate();

  useEffect(() => {
    // Component mounted
  }, []);

  const notificationSettings = [
    { id: 'SEC', label: 'SEC Filings', enabled: true },
    { id: 'INSIDER', label: 'Insider Trading', enabled: true },
    { id: 'NEWS', label: 'News Alerts', enabled: false },
    { id: 'TECH', label: 'Technical Signals', enabled: true },
  ];

  const connectionStatus = [
    { name: 'Plaid', status: 'connected', description: 'Bank account connection' },
    { name: 'Robinhood', status: 'disconnected', description: 'Trading account' },
    { name: 'TD Ameritrade', status: 'disconnected', description: 'Brokerage account' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account preferences and connections.
        </p>
      </div>

      <div className="grid gap-6">
        {/* Profile Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="h-5 w-5" />
              <span>Profile</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <User className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="font-medium">{user?.name}</h3>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Full Name</label>
                <Input defaultValue={user?.name || ''} />
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input defaultValue={user?.email || ''} type="email" />
              </div>
            </div>
            
            <Button>Save Changes</Button>
          </CardContent>
        </Card>

        {/* Theme Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              {theme === 'light' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              <span>Appearance</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Theme</h3>
                <p className="text-sm text-muted-foreground">
                  Choose your preferred theme
                </p>
              </div>
              <Button variant="outline" onClick={toggleTheme}>
                {theme === 'light' ? <Moon className="h-4 w-4 mr-2" /> : <Sun className="h-4 w-4 mr-2" />}
                {theme === 'light' ? 'Dark' : 'Light'} Mode
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Bell className="h-5 w-5" />
              <span>Notifications</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {notificationSettings.map((setting) => (
                <div key={setting.id} className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{setting.label}</h3>
                    <p className="text-sm text-muted-foreground">
                      Receive alerts for {setting.label.toLowerCase()}
                    </p>
                  </div>
                  <Button
                    variant={setting.enabled ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      // Toggle notification setting
                      console.log(`Toggle ${setting.id}`);
                    }}
                  >
                    {setting.enabled && <Check className="h-4 w-4" />}
                    {setting.enabled ? 'Enabled' : 'Disabled'}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Account Connections */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Link2 className="h-5 w-5" />
              <span>Account Connections</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {connectionStatus.map((connection) => (
                <div key={connection.name} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h3 className="font-medium">{connection.name}</h3>
                    <p className="text-sm text-muted-foreground">{connection.description}</p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Badge variant={connection.status === 'connected' ? 'success' : 'secondary'}>
                      {connection.status === 'connected' ? 'Connected' : 'Disconnected'}
                    </Badge>
                    <Button variant="outline" size="sm">
                      {connection.status === 'connected' ? 'Disconnect' : 'Connect (Mock)'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              <span>Danger Zone</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <h3 className="font-medium text-red-800 mb-2">Delete Account</h3>
                <p className="text-sm text-red-600 mb-4">
                  Permanently delete your account and all associated data. This action cannot be undone.
                </p>
                <Button variant="destructive" disabled>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Account (Disabled in Mock)
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
