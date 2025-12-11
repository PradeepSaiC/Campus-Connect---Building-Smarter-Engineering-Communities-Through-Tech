import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const STORAGE_KEY = 'campusconnect-auth';
const VERSION = '1.0';

const useAuthStore = create(
  persist(
    (set, get) => ({
      // State
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      _version: VERSION,
      _lastLogin: null,

      // Actions
      setUser: (user) => set({ 
        user, 
        isAuthenticated: !!user,
        _lastLogin: Date.now() 
      }),
      
      setToken: (token) => set({ token }),
      
      setLoading: (isLoading) => set({ isLoading }),
      
      setError: (error) => set({ error }),
      
      login: (userData, token) => {
        set({
          user: userData,
          token,
          isAuthenticated: true,
          error: null,
          _lastLogin: Date.now()
        });
      },
      
      logout: () => {
        // Clear all storage related to auth
        localStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem(STORAGE_KEY);
        
        // Reset state
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          error: null,
          _lastLogin: null
        });
      },
      
      clearStaleSession: () => {
        const state = get();
        // Clear if last login was more than 24 hours ago
        if (state._lastLogin && (Date.now() - state._lastLogin) > 24 * 60 * 60 * 1000) {
          get().logout();
        }
      },
      
      updateUser: (updates) => {
        const { user } = get();
        if (user) {
          set({ user: { ...user, ...updates } });
        }
      },
      
      clearError: () => set({ error: null })
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => sessionStorage), // Use sessionStorage instead of localStorage
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        _version: state._version,
        _lastLogin: state._lastLogin
      }),
      version: 1,
      migrate: (persistedState, version) => {
        // Handle state migrations if needed in the future
        return persistedState;
      },
      onRehydrateStorage: () => (state) => {
        // Clear any stale sessions on app load
        if (state) {
          state.clearStaleSession();
        }
      }
    }
  )
);

export default useAuthStore;