import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';
import { LandingPage } from '@/pages/LandingPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { PortfolioPage } from '@/pages/PortfolioPage';
import { SignalsPage } from '@/pages/SignalsPage';
import { IposPage } from '@/pages/IposPage';
import { GroupsPage } from '@/pages/GroupsPage';
import { GroupDetailPage } from '@/pages/GroupDetailPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { StockDetailPage } from '@/pages/StockDetailPage';
import { useUiStore } from '@/store/ui';

function App() {
  const { sidebarCollapsed, theme } = useUiStore();

  useEffect(() => {
    // Ensure theme is applied on app load
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const currentTheme = savedTheme || 'light';
    
    if (currentTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    // Listen for theme changes
    const handleThemeChange = (event: CustomEvent) => {
      console.log('Theme changed event received:', event.detail);
    };
    
    window.addEventListener('themeChanged', handleThemeChange as EventListener);
    
    return () => {
      window.removeEventListener('themeChanged', handleThemeChange as EventListener);
    };
  }, []);

  // Force re-render when theme changes
  useEffect(() => {
    console.log('Theme state changed:', theme);
  }, [theme]);

  return (
    <Router>
      <Routes>
        {/* Landing page route */}
        <Route path="/" element={<LandingPage />} />
        
        {/* Main app routes */}
        <Route path="/*" element={
          <div className="min-h-screen">
            <Navbar />
            
            <div className="flex">
              {/* Sidebar for desktop */}
              <Sidebar />
              
              {/* Main content */}
              <main className={`flex-1 transition-all duration-300 ${
                sidebarCollapsed ? 'md:ml-16' : 'md:ml-64'
              } pb-16 md:pb-0`}>
                <div className="min-h-screen">
                  <Routes>
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/portfolio" element={<PortfolioPage />} />
                    <Route path="/signals" element={<SignalsPage />} />
                    <Route path="/ipos" element={<IposPage />} />
                    <Route path="/groups" element={<GroupsPage />} />
                    <Route path="/groups/:groupId" element={<GroupDetailPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/stock/:symbol" element={<StockDetailPage />} />
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                  </Routes>
                </div>
              </main>
            </div>
            
            {/* Mobile navigation */}
            <MobileNav />
          </div>
        } />
      </Routes>
    </Router>
  );
}

export default App;