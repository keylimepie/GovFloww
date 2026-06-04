import { create } from 'zustand';
import { api, type AuthUser, type LoginResponse } from '../lib/api';
import type { LoginInput } from '@govflow/shared';

interface AuthState {
  user: AuthUser | null;
  hydrated: boolean;
  login: (credentials: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  hydrated: false,

  hydrate: async () => {
    try {
      const response = await api.get<{ success: boolean; data: LoginResponse }>('/api/auth/me');
      set({ user: response.data.data.user, hydrated: true });
    } catch {
      set({ user: null, hydrated: true });
    }
  },

  login: async (credentials) => {
    const response = await api.post<{ success: boolean; data: LoginResponse }>(
      '/api/auth/login',
      credentials,
    );
    const { user } = response.data.data;
    set({ user, hydrated: true });
  },

  logout: async () => {
    try {
      if (get().user) {
        await api.post('/api/auth/logout');
      }
    } finally {
      set({ user: null, hydrated: true });
    }
  },
}));
