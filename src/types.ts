export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  avatar?: string | null;
  created_at?: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
}

export interface Product {
  id: number;
  name: string;
  slug: string;
  description: string;
  price: number;
  stock: number;
  image_url: string;
  category_id: number;
  category_name?: string;
}

export interface Order {
  id: number;
  customer_name: string;
  customer_email: string;
  customer_phone?: string | null;
  shipping_address?: string | null;
  total_amount: number;
  status: string;
  tracking_code: string | null;
  shipping_provider: string | null;
  shipped_at: string | null;
  created_at: string;
  updated_at?: string;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  product_name?: string;
  quantity: number;
  price: number;
}

export interface CartItem extends Product {
  quantity: number;
}
