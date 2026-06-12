export type OrderStatus =
  | 'pending'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'confirmed'
  | 'cancelled'
  | 'disputed'

export interface Category {
  id: string
  city_id: string
  slug: string
  name: string
  description: string | null
  icon_emoji: string
  base_price: number
  price_label: string
  sort_order: number
  is_active: boolean
}

export interface Master {
  id: string
  user_id: string
  city_id: string
  bio: string | null
  experience_years: number
  is_verified: boolean
  is_available: boolean
  rating: number
  reviews_count: number
  balance: number
  total_earned: number
  user: { first_name: string; avatar_url: string | null; phone?: string | null }
  master_categories?: { custom_price: number | null; category: { name: string; base_price?: number; price_label?: string } }[]
  master_portfolio?: { image_url: string; caption: string | null }[]
}

export interface Order {
  id: string
  city_id: string
  client_id: string
  master_id: string | null
  category_id: string
  description: string
  address: string
  scheduled_at: string
  status: OrderStatus
  total_amount: number | null
  commission_amount: number | null
  payment_type: 'cash' | 'online'
  created_at: string
}

export interface Review {
  id: string
  order_id: string
  client_id: string
  master_id: string
  rating: number
  comment: string | null
  master_reply: string | null
  is_visible: boolean
  created_at: string
}
