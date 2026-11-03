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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      commodities: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          unit: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          unit?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          unit?: string
        }
        Relationships: []
      }
      deposits: {
        Row: {
          amount_kobo: number
          created_at: string
          currency: string
          id: string
          meta: Json | null
          provider: string
          provider_ref: string | null
          status: string
          tx_ref: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_kobo: number
          created_at?: string
          currency?: string
          id?: string
          meta?: Json | null
          provider?: string
          provider_ref?: string | null
          status?: string
          tx_ref: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_kobo?: number
          created_at?: string
          currency?: string
          id?: string
          meta?: Json | null
          provider?: string
          provider_ref?: string | null
          status?: string
          tx_ref?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      holdings: {
        Row: {
          avg_cost_kobo: number
          commodity_id: string
          created_at: string
          id: string
          quantity: number
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_cost_kobo?: number
          commodity_id: string
          created_at?: string
          id?: string
          quantity?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_cost_kobo?: number
          commodity_id?: string
          created_at?: string
          id?: string
          quantity?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "holdings_commodity_id_fkey"
            columns: ["commodity_id"]
            isOneToOne: false
            referencedRelation: "commodities"
            referencedColumns: ["id"]
          },
        ]
      }
      market_prices: {
        Row: {
          commodity_id: string
          created_at: string
          currency: string
          id: string
          market_location: string
          price: number
          recorded_at: string
          source: string
          source_kind: string
          unit: string
        }
        Insert: {
          commodity_id: string
          created_at?: string
          currency?: string
          id?: string
          market_location?: string
          price: number
          recorded_at?: string
          source: string
          source_kind?: string
          unit?: string
        }
        Update: {
          commodity_id?: string
          created_at?: string
          currency?: string
          id?: string
          market_location?: string
          price?: number
          recorded_at?: string
          source?: string
          source_kind?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_prices_commodity_id_fkey"
            columns: ["commodity_id"]
            isOneToOne: false
            referencedRelation: "commodities"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      physical_requests: {
        Row: {
          commodity_id: string
          created_at: string
          delivery_address: string
          delivery_city: string
          delivery_state: string
          id: string
          note: string | null
          phone: string
          quantity: number
          quoted_amount_kobo: number | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          commodity_id: string
          created_at?: string
          delivery_address: string
          delivery_city: string
          delivery_state: string
          id?: string
          note?: string | null
          phone: string
          quantity: number
          quoted_amount_kobo?: number | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          commodity_id?: string
          created_at?: string
          delivery_address?: string
          delivery_city?: string
          delivery_state?: string
          id?: string
          note?: string | null
          phone?: string
          quantity?: number
          quoted_amount_kobo?: number | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "physical_requests_commodity_id_fkey"
            columns: ["commodity_id"]
            isOneToOne: false
            referencedRelation: "commodities"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      price_alerts: {
        Row: {
          commodity_id: string
          created_at: string
          direction: string
          id: string
          status: string
          target_price_kobo: number
          triggered_at: string | null
          user_id: string
        }
        Insert: {
          commodity_id: string
          created_at?: string
          direction: string
          id?: string
          status?: string
          target_price_kobo: number
          triggered_at?: string | null
          user_id: string
        }
        Update: {
          commodity_id?: string
          created_at?: string
          direction?: string
          id?: string
          status?: string
          target_price_kobo?: number
          triggered_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_alerts_commodity_id_fkey"
            columns: ["commodity_id"]
            isOneToOne: false
            referencedRelation: "commodities"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_type: string
          avatar_url: string | null
          country: string
          created_at: string
          email: string | null
          email_notifications: boolean
          full_name: string | null
          id: string
          phone: string | null
          push_notifications: boolean
          two_factor_enabled: boolean
          updated_at: string
        }
        Insert: {
          account_type?: string
          avatar_url?: string | null
          country?: string
          created_at?: string
          email?: string | null
          email_notifications?: boolean
          full_name?: string | null
          id: string
          phone?: string | null
          push_notifications?: boolean
          two_factor_enabled?: boolean
          updated_at?: string
        }
        Update: {
          account_type?: string
          avatar_url?: string | null
          country?: string
          created_at?: string
          email?: string | null
          email_notifications?: boolean
          full_name?: string | null
          id?: string
          phone?: string | null
          push_notifications?: boolean
          two_factor_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      trades: {
        Row: {
          commodity_id: string
          created_at: string
          fee_kobo: number
          id: string
          price_per_unit_kobo: number
          quantity: number
          side: string
          status: string
          total_kobo: number
          user_id: string
        }
        Insert: {
          commodity_id: string
          created_at?: string
          fee_kobo?: number
          id?: string
          price_per_unit_kobo: number
          quantity: number
          side: string
          status?: string
          total_kobo: number
          user_id: string
        }
        Update: {
          commodity_id?: string
          created_at?: string
          fee_kobo?: number
          id?: string
          price_per_unit_kobo?: number
          quantity?: number
          side?: string
          status?: string
          total_kobo?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trades_commodity_id_fkey"
            columns: ["commodity_id"]
            isOneToOne: false
            referencedRelation: "commodities"
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
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_ledger: {
        Row: {
          amount_kobo: number
          balance_after_kobo: number
          created_at: string
          description: string | null
          direction: string
          entry_type: string
          id: string
          reference: string
          trade_id: string | null
          user_id: string
        }
        Insert: {
          amount_kobo: number
          balance_after_kobo: number
          created_at?: string
          description?: string | null
          direction: string
          entry_type: string
          id?: string
          reference: string
          trade_id?: string | null
          user_id: string
        }
        Update: {
          amount_kobo?: number
          balance_after_kobo?: number
          created_at?: string
          description?: string | null
          direction?: string
          entry_type?: string
          id?: string
          reference?: string
          trade_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance_kobo: number
          created_at: string
          currency: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance_kobo?: number
          created_at?: string
          currency?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance_kobo?: number
          created_at?: string
          currency?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      watchlist: {
        Row: {
          commodity_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          commodity_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          commodity_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watchlist_commodity_id_fkey"
            columns: ["commodity_id"]
            isOneToOne: false
            referencedRelation: "commodities"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawals: {
        Row: {
          amount_kobo: number
          created_at: string
          destination_account: string
          destination_bank: string
          destination_name: string
          fee_kobo: number
          id: string
          provider_ref: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_kobo: number
          created_at?: string
          destination_account: string
          destination_bank: string
          destination_name: string
          fee_kobo?: number
          id?: string
          provider_ref?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_kobo?: number
          created_at?: string
          destination_account?: string
          destination_bank?: string
          destination_name?: string
          fee_kobo?: number
          id?: string
          provider_ref?: string | null
          status?: string
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
      complete_deposit: {
        Args: {
          p_amount_kobo: number
          p_provider_ref: string
          p_tx_ref: string
        }
        Returns: Json
      }
      execute_trade: {
        Args: { p_commodity_id: string; p_quantity: number; p_side: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      platform_setting: { Args: { p_key: string }; Returns: string }
      refund_withdrawal: { Args: { p_withdrawal_id: string }; Returns: Json }
      request_withdrawal: {
        Args: {
          p_amount_kobo: number
          p_destination_account: string
          p_destination_bank: string
          p_destination_name: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "user"],
    },
  },
} as const
