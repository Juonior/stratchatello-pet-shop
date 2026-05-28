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
