import { create } from 'zustand';

interface UiStore {
  theme: 'light' | 'dark';
  sidebarCollapsed: boolean;
  loading: boolean;
  toggleTheme: () => void;
  toggleSidebar: () => void;
  setLoading: (loading: boolean) => void;
}

export const useUiStore = create<UiStore>((set, get) => {
  // Initialize theme from localStorage or default to light
  const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
  const initialTheme = savedTheme || 'light';
  
  // Apply theme to document on initialization
  if (typeof window !== 'undefined') {
    if (initialTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  return {
    theme: initialTheme,
    sidebarCollapsed: false,
    loading: false,

  toggleTheme: () => {
    const currentTheme = get().theme;
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    // Update state first
    set({ theme: newTheme });
    
    // Apply theme to document with a slight delay to ensure state is updated
    setTimeout(() => {
      if (newTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      
      // Save to localStorage
      localStorage.setItem('theme', newTheme);
      
      // Force a re-render by dispatching a custom event
      window.dispatchEvent(new CustomEvent('themeChanged', { detail: newTheme }));
    }, 0);
  },

  toggleSidebar: () => {
    set(state => ({ sidebarCollapsed: !state.sidebarCollapsed }));
  },

  setLoading: (loading: boolean) => {
    set({ loading });
  },
  };
});