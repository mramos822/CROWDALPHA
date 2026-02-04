import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useUiStore } from "@/store/ui";
import { Moon, Sun, Menu, User } from "lucide-react";

export function Navbar() {
  const { theme, toggleTheme, toggleSidebar } = useUiStore();
  const navigate = useNavigate();
  const location = useLocation();

  const navigation = [
    { name: 'Dashboard', href: '/dashboard' },
    { name: 'Portfolio', href: '/portfolio' },
    { name: 'Signals', href: '/signals' },
    { name: 'IPOs', href: '/ipos' },
    { name: 'Groups', href: '/groups' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-6">
            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-gray-600 dark:text-gray-400"
              onClick={toggleSidebar}
            >
              <Menu className="h-5 w-5" />
            </Button>
            
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="h-8 w-8 rounded-lg overflow-hidden">
                <img 
                  src="/pics/3d-rendering-financial-neon-bull.jpg" 
                  alt="CrowdAlpha Logo" 
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="font-bold text-xl text-gray-900 dark:text-white">CrowdAlpha</span>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex md:space-x-1">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <button
                    key={item.name}
                    onClick={() => navigate(item.href)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    {item.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Theme toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              {theme === 'light' ? (
                <Moon className="h-4 w-4" />
              ) : (
                <Sun className="h-4 w-4" />
              )}
            </Button>

            {/* User menu */}
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate('/profile')}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-blue-600 dark:border-blue-400"
            >
              <User className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}