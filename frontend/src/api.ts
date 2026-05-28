import axios from "axios";
import type {
  Article, ArticleCard, Cart, CartItem, Category, ChatMessage, ChatRoom, ChatThread,
  Comment, FeedItem, Friend, FriendRequest, Message, Order, Pet, PetIn, Post,
  Product, ProductCard, PublicUser, RecommendationBlock, Review, Thread, TokenResp, User,
} from "./types";

export const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "/api";

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
});

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem("token");
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// ---- Auth ----
export const authApi = {
  register: (data: { email: string; name: string; password: string }) =>
    api.post<TokenResp>("/auth/register", data).then((r) => r.data),
  login: (data: { email: string; password: string }) =>
    api.post<TokenResp>("/auth/login", data).then((r) => r.data),
  me: () => api.get<User>("/auth/me").then((r) => r.data),
  updateMe: (data: { name?: string; photo?: string | null }) =>
    api.patch<User>("/auth/me", data).then((r) => r.data),
};

// ---- Upload ----
export const uploadApi = {
  image: (file: File, kind: "user" | "pet" | "misc" = "misc") => {
    const fd = new FormData();
    fd.append("file", file);
    return api
      .post<{ url: string; key: string }>(`/upload/image?kind=${kind}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },
};

// ---- Catalog ----
export interface CatalogFilters {
  category?: string;
  q?: string;
  min_price?: number;
  max_price?: number;
  brand?: string;
  min_rating?: number;
  sort?: "popular" | "price_asc" | "price_desc" | "rating";
  limit?: number;
}
export const catalogApi = {
  categories: () => api.get<Category[]>("/categories").then((r) => r.data),
  products: (f: CatalogFilters = {}) =>
    api.get<ProductCard[]>("/products", { params: f }).then((r) => r.data),
  product: (id: string) => api.get<Product>(`/products/${id}`).then((r) => r.data),
  brands: () => api.get<string[]>("/products/brands").then((r) => r.data),
};

// ---- Reviews ----
export const reviewsApi = {
  list: (productId: string) =>
    api.get<Review[]>(`/products/${productId}/reviews`).then((r) => r.data),
  add: (productId: string, data: { rating: number; text: string }) =>
    api.post<Review>(`/products/${productId}/reviews`, data).then((r) => r.data),
};

// ---- Cart ----
export const cartApi = {
  get: () => api.get<Cart>("/cart").then((r) => r.data),
  add: (product_id: string, quantity: number) =>
    api.post<Cart>("/cart/items", { product_id, quantity }).then((r) => r.data),
  update: (product_id: string, quantity: number) =>
    api.put<Cart>(`/cart/items/${product_id}`, { product_id, quantity }).then((r) => r.data),
  remove: (product_id: string) =>
    api.delete<Cart>(`/cart/items/${product_id}`).then((r) => r.data),
  clear: () => api.delete<Cart>("/cart").then((r) => r.data),
};

// ---- Orders ----
export const ordersApi = {
  list: () => api.get<Order[]>("/orders").then((r) => r.data),
  checkout: (data: { address: string; delivery_time: string; payment_method: string }) =>
    api.post<Order>("/orders/checkout", data).then((r) => r.data),
};

// ---- Payments (mock) ----
export const paymentsApi = {
  pay: (order_id: string, amount: number) =>
    api.post("/payments", { order_id, amount }).then((r) => r.data),
};

// ---- Pets ----
export const petsApi = {
  list: () => api.get<Pet[]>("/pets").then((r) => r.data),
  create: (data: PetIn) => api.post<Pet>("/pets", data).then((r) => r.data),
  update: (id: string, data: PetIn) => api.put<Pet>(`/pets/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/pets/${id}`).then((r) => r.data),
};

// ---- Articles ----
export const articlesApi = {
  list: (q?: string, topic?: string) =>
    api.get<ArticleCard[]>("/articles", { params: { q, topic } }).then((r) => r.data),
  topics: () => api.get<string[]>("/articles/topics").then((r) => r.data),
  get: (id: string) => api.get<Article>(`/articles/${id}`).then((r) => r.data),
};

// ---- Recommendations ----
export const recsApi = {
  get: () => api.get<RecommendationBlock[]>("/recommendations").then((r) => r.data),
};

// ---- Social ----
export const usersApi = {
  search: (q?: string) =>
    api.get<PublicUser[]>("/users/search", { params: { q } }).then((r) => r.data),
  get: (id: string) => api.get<PublicUser>(`/users/${id}`).then((r) => r.data),
};

export const friendsApi = {
  list: () => api.get<Friend[]>("/friends").then((r) => r.data),
  incoming: () => api.get<FriendRequest[]>("/friends/requests/incoming").then((r) => r.data),
  outgoing: () => api.get<FriendRequest[]>("/friends/requests/outgoing").then((r) => r.data),
  request: (userId: string) =>
    api.post<{ status: string }>(`/friends/request/${userId}`).then((r) => r.data),
  accept: (userId: string) => api.post(`/friends/accept/${userId}`).then((r) => r.data),
  reject: (userId: string) => api.post(`/friends/reject/${userId}`).then((r) => r.data),
  remove: (userId: string) => api.delete(`/friends/${userId}`).then((r) => r.data),
};

export const postsApi = {
  create: (text: string, image?: string | null) =>
    api.post<Post>("/posts", { text, image }).then((r) => r.data),
  fromUrl: (url: string, text: string = "") =>
    api.post<Post>("/posts/from-url", { url, text }, { timeout: 120000 }).then((r) => r.data),
  remove: (postId: string) => api.delete(`/posts/${postId}`).then((r) => r.data),
  ofUser: (userId: string) => api.get<Post[]>(`/users/${userId}/posts`).then((r) => r.data),
};

export const messagesApi = {
  threads: () => api.get<Thread[]>("/messages/threads").then((r) => r.data),
  list: (peerId: string) => api.get<Message[]>(`/messages/${peerId}`).then((r) => r.data),
  send: (peerId: string, text: string) =>
    api.post<Message>(`/messages/${peerId}`, { text }).then((r) => r.data),
};

export const feedApi = {
  get: () => api.get<FeedItem[]>("/feed").then((r) => r.data),
};

export const commentsApi = {
  list: (postId: string) =>
    api.get<Comment[]>(`/posts/${postId}/comments`).then((r) => r.data),
  add: (postId: string, text: string) =>
    api.post<Comment>(`/posts/${postId}/comments`, { text }).then((r) => r.data),
  remove: (postId: string, commentId: string) =>
    api.delete(`/posts/${postId}/comments/${commentId}`).then((r) => r.data),
};

export const chatsApi = {
  list: () => api.get<ChatThread[]>("/chats").then((r) => r.data),
  create: (title: string, member_ids: string[], photo?: string | null) =>
    api.post<ChatRoom>("/chats", { title, member_ids, photo }).then((r) => r.data),
  get: (roomId: string) => api.get<ChatRoom>(`/chats/${roomId}`).then((r) => r.data),
  addMember: (roomId: string, userId: string) =>
    api.post<ChatRoom>(`/chats/${roomId}/members/${userId}`).then((r) => r.data),
  removeMember: (roomId: string, userId: string) =>
    api.delete(`/chats/${roomId}/members/${userId}`).then((r) => r.data),
  messages: (roomId: string) =>
    api.get<ChatMessage[]>(`/chats/${roomId}/messages`).then((r) => r.data),
  send: (roomId: string, text: string) =>
    api.post<ChatMessage>(`/chats/${roomId}/messages`, { text }).then((r) => r.data),
};

export type { CartItem };
