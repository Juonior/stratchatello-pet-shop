export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  photo?: string | null;
}

export interface Category {
  id: string;
  slug: string;
  title: string;
  description?: string;
  icon?: string;
  sort_order: number;
  cover_image?: string | null;
}

export interface ProductCard {
  id: string;
  category_id: string;
  title: string;
  brand?: string;
  price: number;
  old_price?: number | null;
  rating: number;
  rating_count: number;
  image?: string;
  in_stock: boolean;
  size_for?: string;
  tags: string[];
}

export interface Product extends ProductCard {
  description?: string;
  composition?: string;
  instruction?: string;
}

export interface Review {
  id: string;
  user_id: string;
  user_name: string;
  rating: number;
  text: string;
  created_at: string;
}

export interface CartItem {
  product_id: string;
  title: string;
  image?: string | null;
  price: number;
  quantity: number;
  subtotal: number;
}

export interface Cart {
  items: CartItem[];
  total: number;
  count: number;
}

export interface OrderItemSnap {
  product_id: string;
  title: string;
  price: number;
  quantity: number;
  image?: string | null;
}

export interface Order {
  id: string;
  total: number;
  status: string;
  address: string;
  delivery_time: string;
  payment_method: string;
  items: OrderItemSnap[];
  created_at: string;
}

export interface Pet {
  id: string;
  name: string;
  breed: string;
  age: number;
  weight?: number | null;
  size?: string;
  gender?: string | null;
  allergies?: string;
  favorite_treat?: string;
  photo?: string | null;
  created_at: string;
}

export interface PetIn {
  name: string;
  breed: string;
  age: number;
  weight?: number | null;
  size?: string;
  gender?: string | null;
  allergies?: string;
  favorite_treat?: string;
  photo?: string | null;
}

export interface ArticleCard {
  id: string;
  slug: string;
  title: string;
  annotation: string;
  topic: string;
  image?: string;
  author?: string;
  published_at: string;
}

export interface Article extends ArticleCard {
  body: string;
}

export interface RecommendationBlock {
  title: string;
  reason: string;
  products: ProductCard[];
}

export interface TokenResp {
  access_token: string;
  token_type: string;
  user: User;
}

// ===== Social =====
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  photo?: string | null;
  relation: "self" | "friend" | "request_sent" | "request_received" | "stranger";
}

export interface Post {
  id: string;
  user_id: string;
  user_name: string;
  user_photo?: string | null;
  text: string;
  image?: string | null;
  video?: string | null;
  created_at: string;
}

export interface Friend {
  id: string;
  name: string;
  email?: string;
  photo?: string | null;
  since?: string;
}

export interface FriendRequest {
  user_id: string;
  name: string;
  photo?: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  from_user_id: string;
  text: string;
  created_at: string;
  mine: boolean;
}

export interface Thread {
  peer_id: string;
  peer_name: string;
  peer_photo?: string | null;
  last_message_text?: string | null;
  last_message_at?: string | null;
  last_from_me: boolean;
}

export interface FeedItem {
  post: Post;
  section: "friends" | "discover";
}

export interface Comment {
  id: string;
  user_id: string;
  user_name: string;
  user_photo?: string | null;
  text: string;
  created_at: string;
}

// Group chats
export interface ChatMember {
  id: string;
  name: string;
  photo?: string | null;
}

export interface ChatRoom {
  id: string;
  title: string;
  photo?: string | null;
  created_by: string;
  created_at: string;
  members: ChatMember[];
}

export interface ChatThread {
  room_id: string;
  title: string;
  photo?: string | null;
  last_message_text?: string | null;
  last_message_at?: string | null;
  last_from_name?: string | null;
}

export interface ChatMessage {
  id: string;
  from_user_id: string;
  from_name: string;
  from_photo?: string | null;
  text: string;
  created_at: string;
  mine: boolean;
}
