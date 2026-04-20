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
  payment_status?: 'paid' | 'unpaid';
  status: string;
  tracking_code: string | null;
  shipping_provider: string | null;
  shipped_at: string | null;
  created_at: string;
  updated_at?: string;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface Conversation {
  id: number;
  user_id: number;
  subject: string;
  status: 'open' | 'closed';
  user_name?: string;
  user_email?: string;
  user_avatar?: string | null;
  unread_count?: number;
  last_message?: string | null;
  last_message_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  content: string;
  is_read: boolean;
  sender_name: string;
  sender_role: string;
  sender_avatar?: string | null;
  created_at: string;
}
