export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      chapter_pages: {
        Row: {
          chapter_id: string
          id: string
          image_url: string
          page_number: number
        }
        Insert: {
          chapter_id: string
          id?: string
          image_url: string
          page_number: number
        }
        Update: {
          chapter_id?: string
          id?: string
          image_url?: string
          page_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "chapter_pages_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      chapter_unlocks: {
        Row: {
          chapter_id: string
          coins_spent: number
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          chapter_id: string
          coins_spent?: number
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          chapter_id?: string
          coins_spent?: number
          id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapter_unlocks_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      chapters: {
        Row: {
          content: string | null
          created_at: string
          id: string
          number: number
          price: number
          series_id: string
          source_url: string | null
          title: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          number: number
          price?: number
          series_id: string
          source_url?: string | null
          title?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          number?: number
          price?: number
          series_id?: string
          source_url?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chapters_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      coin_adjustments: {
        Row: {
          actor_user_id: string
          created_at: string
          delta: number
          id: string
          reason: string | null
          target_user_id: string
        }
        Insert: {
          actor_user_id: string
          created_at?: string
          delta: number
          id?: string
          reason?: string | null
          target_user_id: string
        }
        Update: {
          actor_user_id?: string
          created_at?: string
          delta?: number
          id?: string
          reason?: string | null
          target_user_id?: string
        }
        Relationships: []
      }
      coin_purchase_sessions: {
        Row: {
          amount_total: number | null
          created_at: string
          credited_at: string | null
          credited_coins: number
          currency: string | null
          id: string
          package_id: string
          stripe_payment_status: string
          stripe_session_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_total?: number | null
          created_at?: string
          credited_at?: string | null
          credited_coins?: number
          currency?: string | null
          id?: string
          package_id: string
          stripe_payment_status?: string
          stripe_session_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_total?: number | null
          created_at?: string
          credited_at?: string | null
          credited_coins?: number
          currency?: string | null
          id?: string
          package_id?: string
          stripe_payment_status?: string
          stripe_session_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      import_jobs: {
        Row: {
          completed_chapters: number
          created_at: string
          created_by: string
          current_chapter: string | null
          error: string | null
          id: string
          logs: string[]
          series_id: string | null
          source_site: string
          source_url: string
          status: string
          total_chapters: number
          updated_at: string
        }
        Insert: {
          completed_chapters?: number
          created_at?: string
          created_by: string
          current_chapter?: string | null
          error?: string | null
          id?: string
          logs?: string[]
          series_id?: string | null
          source_site: string
          source_url: string
          status?: string
          total_chapters?: number
          updated_at?: string
        }
        Update: {
          completed_chapters?: number
          created_at?: string
          created_by?: string
          current_chapter?: string | null
          error?: string | null
          id?: string
          logs?: string[]
          series_id?: string | null
          source_site?: string
          source_url?: string
          status?: string
          total_chapters?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
        }
        Relationships: []
      }
      series: {
        Row: {
          author: string | null
          banner_url: string | null
          cover_url: string | null
          created_at: string
          description: string | null
          genres: string[]
          id: string
          is_popular: boolean
          is_trending: boolean
          slug: string
          source_url: string | null
          status: Database["public"]["Enums"]["series_status"]
          title: string
          type: Database["public"]["Enums"]["series_type"]
          updated_at: string
          views: number
        }
        Insert: {
          author?: string | null
          banner_url?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          genres?: string[]
          id?: string
          is_popular?: boolean
          is_trending?: boolean
          slug: string
          source_url?: string | null
          status?: Database["public"]["Enums"]["series_status"]
          title: string
          type?: Database["public"]["Enums"]["series_type"]
          updated_at?: string
          views?: number
        }
        Update: {
          author?: string | null
          banner_url?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          genres?: string[]
          id?: string
          is_popular?: boolean
          is_trending?: boolean
          slug?: string
          source_url?: string | null
          status?: Database["public"]["Enums"]["series_status"]
          title?: string
          type?: Database["public"]["Enums"]["series_type"]
          updated_at?: string
          views?: number
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          hero_series_id: string | null
          id: boolean
          seo_description: string
          site_name: string
          updated_at: string
        }
        Insert: {
          hero_series_id?: string | null
          id?: boolean
          seo_description?: string
          site_name?: string
          updated_at?: string
        }
        Update: {
          hero_series_id?: string | null
          id?: boolean
          seo_description?: string
          site_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_settings_hero_series_id_fkey"
            columns: ["hero_series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          coins: number
          updated_at: string
          user_id: string
        }
        Insert: {
          coins?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          coins?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adjust_user_coins: {
        Args: { _delta: number; _reason?: string; _target: string }
        Returns: Json
      }
      admin_bulk_update_series_flags: {
        Args: { _ids: string[]; _is_popular?: boolean; _is_trending?: boolean }
        Returns: Json
      }
      admin_finance_log: {
        Args: { _limit?: number }
        Returns: {
          amount: number
          kind: string
          note: string
          occurred_at: string
          user_email: string
          user_id: string
        }[]
      }
      admin_list_users: {
        Args: never
        Returns: {
          banned_until: string
          coins: number
          created_at: string
          display_name: string
          email: string
          id: string
          roles: string[]
        }[]
      }
      admin_mass_update_chapter_price: {
        Args: { _price: number; _series_id: string }
        Returns: Json
      }
      admin_revenue_daily: {
        Args: { _days?: number }
        Returns: {
          day: string
          revenue: number
          unlocks: number
        }[]
      }
      admin_set_user_role: {
        Args: {
          _grant: boolean
          _role: Database["public"]["Enums"]["app_role"]
          _target: string
        }
        Returns: Json
      }
      admin_top_series: {
        Args: { _limit?: number }
        Returns: {
          cover_url: string
          revenue: number
          series_id: string
          title: string
          unlocks: number
        }[]
      }
      admin_total_sales: { Args: never; Returns: number }
      admin_user_growth: {
        Args: { _days?: number }
        Returns: {
          day: string
          signups: number
        }[]
      }
      has_chapter_access: {
        Args: { _chapter_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      unlock_chapter: { Args: { _chapter_id: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "user" | "super_admin" | "manager"
      series_status: "ongoing" | "completed" | "hiatus"
      series_type: "manga" | "novel"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user", "super_admin", "manager"],
      series_status: ["ongoing", "completed", "hiatus"],
      series_type: ["manga", "novel"],
    },
  },
} as const
