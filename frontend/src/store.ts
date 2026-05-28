import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Cart, User } from "./types";
import { authApi, cartApi } from "./api";

interface AuthState {
  user: User | null;
  token: string | null;
  isAuth: boolean;
  setSession: (token: string, user: User) => void;
  logout: () => void;
  hydrate: () => Promise<void>;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuth: false,
      setSession: (token, user) => {
        localStorage.setItem("token", token);
        set({ token, user, isAuth: true });
      },
      logout: () => {
        localStorage.removeItem("token");
        set({ token: null, user: null, isAuth: false });
      },
      hydrate: async () => {
        const t = localStorage.getItem("token");
        if (!t) return;
        try {
          const me = await authApi.me();
          set({ user: me, token: t, isAuth: true });
        } catch {
          localStorage.removeItem("token");
          set({ token: null, user: null, isAuth: false });
        }
      },
    }),
    { name: "zoomarket-auth", partialize: (s) => ({ user: s.user, token: s.token, isAuth: s.isAuth }) }
  )
);

interface CartState {
  cart: Cart;
  loading: boolean;
  refresh: () => Promise<void>;
  add: (productId: string, qty?: number) => Promise<void>;
  setQty: (productId: string, qty: number) => Promise<void>;
  remove: (productId: string) => Promise<void>;
  clear: () => Promise<void>;
}

export const useCart = create<CartState>((set, get) => ({
  cart: { items: [], total: 0, count: 0 },
  loading: false,
  refresh: async () => {
    if (!useAuth.getState().isAuth) {
      set({ cart: { items: [], total: 0, count: 0 } });
      return;
    }
    set({ loading: true });
    try {
      const c = await cartApi.get();
      set({ cart: c });
    } finally {
      set({ loading: false });
    }
  },
  add: async (productId, qty = 1) => {
    const c = await cartApi.add(productId, qty);
    set({ cart: c });
  },
  setQty: async (productId, qty) => {
    const c = await cartApi.update(productId, qty);
    set({ cart: c });
  },
  remove: async (productId) => {
    const c = await cartApi.remove(productId);
    set({ cart: c });
  },
  clear: async () => {
    const c = await cartApi.clear();
    set({ cart: c });
  },
}));
