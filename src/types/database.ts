// Типы сгенерированы вручную по supabase/migrations/.
// После подключения проекта к Supabase обновить через:
// supabase gen types typescript --project-id <id> > src/types/database.ts

export type OrderStatus =
  | 'pending'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'confirmed'
  | 'cancelled'
  | 'disputed'

export type UserRole = 'client' | 'master' | 'city_admin' | 'superadmin'

export interface Database {
  public: {
    Tables: {
      cities: {
        Row: {
          id: string
          slug: string
          name: string
          bot_token: string
          bot_username: string
          timezone: string
          commission_rate: number
          is_active: boolean
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['cities']['Row']> & {
          slug: string
          name: string
          bot_token: string
          bot_username: string
        }
        Update: Partial<Database['public']['Tables']['cities']['Row']>
      }
      users: {
        Row: {
          id: string
          telegram_id: number
          city_id: string
          role: UserRole
          first_name: string
          last_name: string | null
          username: string | null
          phone: string | null
          avatar_url: string | null
          is_blocked: boolean
          created_at: string
          last_seen_at: string | null
        }
        Insert: Partial<Database['public']['Tables']['users']['Row']> & {
          telegram_id: number
          city_id: string
          first_name: string
        }
        Update: Partial<Database['public']['Tables']['users']['Row']>
      }
      categories: {
        Row: {
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
        Insert: Partial<Database['public']['Tables']['categories']['Row']> & {
          city_id: string
          slug: string
          name: string
          base_price: number
        }
        Update: Partial<Database['public']['Tables']['categories']['Row']>
      }
      category_templates: {
        Row: {
          id: string
          slug: string
          name: string
          description: string | null
          icon_emoji: string
          base_price: number
          sort_order: number
        }
        Insert: Partial<Database['public']['Tables']['category_templates']['Row']> & {
          slug: string
          name: string
          base_price: number
        }
        Update: Partial<Database['public']['Tables']['category_templates']['Row']>
      }
      masters: {
        Row: {
          id: string
          user_id: string
          city_id: string
          bio: string | null
          experience_years: number
          is_verified: boolean
          verified_at: string | null
          verified_by: string | null
          is_available: boolean
          rating: number
          reviews_count: number
          balance: number
          total_earned: number
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['masters']['Row']> & {
          user_id: string
          city_id: string
        }
        Update: Partial<Database['public']['Tables']['masters']['Row']>
      }
      master_categories: {
        Row: {
          master_id: string
          category_id: string
          custom_price: number | null
        }
        Insert: Database['public']['Tables']['master_categories']['Row']
        Update: Partial<Database['public']['Tables']['master_categories']['Row']>
      }
      master_portfolio: {
        Row: {
          id: string
          master_id: string
          image_url: string
          caption: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['master_portfolio']['Row']> & {
          master_id: string
          image_url: string
        }
        Update: Partial<Database['public']['Tables']['master_portfolio']['Row']>
      }
      master_applications: {
        Row: {
          id: string
          user_id: string
          city_id: string
          full_name: string
          phone: string
          experience: string
          category_ids: string[]
          status: 'pending' | 'approved' | 'rejected'
          reviewed_by: string | null
          reviewed_at: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['master_applications']['Row']> & {
          user_id: string
          city_id: string
          full_name: string
          phone: string
          experience: string
          category_ids: string[]
        }
        Update: Partial<Database['public']['Tables']['master_applications']['Row']>
      }
      orders: {
        Row: {
          id: string
          city_id: string
          client_id: string
          master_id: string | null
          category_id: string
          description: string
          address: string
          lat: number | null
          lng: number | null
          scheduled_at: string
          status: OrderStatus
          total_amount: number | null
          commission_amount: number | null
          payment_type: 'cash' | 'online'
          client_note: string | null
          master_note: string | null
          cancelled_by: string | null
          cancel_reason: string | null
          created_at: string
          accepted_at: string | null
          completed_at: string | null
          confirmed_at: string | null
        }
        Insert: Partial<Database['public']['Tables']['orders']['Row']> & {
          city_id: string
          client_id: string
          category_id: string
          description: string
          address: string
          scheduled_at: string
        }
        Update: Partial<Database['public']['Tables']['orders']['Row']>
      }
      order_photos: {
        Row: {
          id: string
          order_id: string
          image_url: string
          uploaded_by: string
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['order_photos']['Row']> & {
          order_id: string
          image_url: string
          uploaded_by: string
        }
        Update: Partial<Database['public']['Tables']['order_photos']['Row']>
      }
      order_status_history: {
        Row: {
          id: string
          order_id: string
          status: OrderStatus
          changed_by: string | null
          note: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['order_status_history']['Row']> & {
          order_id: string
          status: OrderStatus
        }
        Update: Partial<Database['public']['Tables']['order_status_history']['Row']>
      }
      payments: {
        Row: {
          id: string
          order_id: string
          provider: 'yookassa' | 'cash'
          amount: number
          status: 'pending' | 'succeeded' | 'cancelled' | 'refunded'
          provider_payment_id: string | null
          provider_data: Record<string, unknown> | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['payments']['Row']> & {
          order_id: string
          provider: 'yookassa' | 'cash'
          amount: number
        }
        Update: Partial<Database['public']['Tables']['payments']['Row']>
      }
      commission_transactions: {
        Row: {
          id: string
          order_id: string
          master_id: string
          amount: number
          rate: number
          status: 'pending' | 'charged' | 'failed'
          charged_at: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['commission_transactions']['Row']> & {
          order_id: string
          master_id: string
          amount: number
          rate: number
        }
        Update: Partial<Database['public']['Tables']['commission_transactions']['Row']>
      }
      withdrawal_requests: {
        Row: {
          id: string
          master_id: string
          amount: number
          status: 'pending' | 'processing' | 'completed' | 'rejected'
          bank_details: { bank: string; account: string; bik: string; name: string }
          admin_note: string | null
          processed_by: string | null
          created_at: string
          processed_at: string | null
        }
        Insert: Partial<Database['public']['Tables']['withdrawal_requests']['Row']> & {
          master_id: string
          amount: number
          bank_details: { bank: string; account: string; bik: string; name: string }
        }
        Update: Partial<Database['public']['Tables']['withdrawal_requests']['Row']>
      }
      reviews: {
        Row: {
          id: string
          order_id: string
          client_id: string
          master_id: string
          rating: number
          comment: string | null
          master_reply: string | null
          is_visible: boolean
          created_at: string
          replied_at: string | null
        }
        Insert: Partial<Database['public']['Tables']['reviews']['Row']> & {
          order_id: string
          client_id: string
          master_id: string
          rating: number
        }
        Update: Partial<Database['public']['Tables']['reviews']['Row']>
      }
      notification_log: {
        Row: {
          id: string
          user_id: string
          type: string
          payload: Record<string, unknown>
          telegram_ok: boolean | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['notification_log']['Row']> & {
          user_id: string
          type: string
          payload: Record<string, unknown>
        }
        Update: Partial<Database['public']['Tables']['notification_log']['Row']>
      }
    }
  }
}
