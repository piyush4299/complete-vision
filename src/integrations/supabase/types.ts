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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      message_templates: {
        Row: {
          body: string
          channel: string
          id: string
          is_active: boolean
          subject: string | null
          type: string
          updated_at: string
        }
        Insert: {
          body: string
          channel: string
          id?: string
          is_active?: boolean
          subject?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          body?: string
          channel?: string
          id?: string
          is_active?: boolean
          subject?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      outreach_log: {
        Row: {
          action: string
          channel: string
          created_at: string
          id: string
          message_sent: string | null
          vendor_id: string | null
        }
        Insert: {
          action: string
          channel: string
          created_at?: string
          id?: string
          message_sent?: string | null
          vendor_id?: string | null
        }
        Update: {
          action?: string
          channel?: string
          created_at?: string
          id?: string
          message_sent?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outreach_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      paused_sessions: {
        Row: {
          batch_size: number
          channel: string
          created_at: string
          current_index: number
          filter_cat: string
          filter_city: string
          id: string
          is_follow_up: boolean
          sent_count: number
          skipped_count: number
          updated_at: string
          vendor_ids: Json
        }
        Insert: {
          batch_size?: number
          channel: string
          created_at?: string
          current_index?: number
          filter_cat?: string
          filter_city?: string
          id?: string
          is_follow_up?: boolean
          sent_count?: number
          skipped_count?: number
          updated_at?: string
          vendor_ids: Json
        }
        Update: {
          batch_size?: number
          channel?: string
          created_at?: string
          current_index?: number
          filter_cat?: string
          filter_city?: string
          id?: string
          is_follow_up?: boolean
          sent_count?: number
          skipped_count?: number
          updated_at?: string
          vendor_ids?: Json
        }
        Relationships: []
      }
      settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      uploads: {
        Row: {
          category: string
          city: string
          duplicates: number
          enriched: number
          filename: string
          id: string
          new_added: number
          total_in_file: number
          uploaded_at: string
        }
        Insert: {
          category: string
          city: string
          duplicates?: number
          enriched?: number
          filename: string
          id?: string
          new_added?: number
          total_in_file?: number
          uploaded_at?: string
        }
        Update: {
          category?: string
          city?: string
          duplicates?: number
          enriched?: number
          filename?: string
          id?: string
          new_added?: number
          total_in_file?: number
          uploaded_at?: string
        }
        Relationships: []
      }
      vendor_sequences: {
        Row: {
          completed_at: string | null
          current_step: number
          id: string
          is_active: boolean
          sequence_type: string
          started_at: string
          steps: Json
          vendor_id: string
        }
        Insert: {
          completed_at?: string | null
          current_step?: number
          id?: string
          is_active?: boolean
          sequence_type: string
          started_at?: string
          steps: Json
          vendor_id: string
        }
        Update: {
          completed_at?: string | null
          current_step?: number
          id?: string
          is_active?: boolean
          sequence_type?: string
          started_at?: string
          steps?: Json
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_sequences_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          category: string
          city: string
          claim_link: string
          created_at: string
          date_contacted: string | null
          email: string | null
          email_body: string | null
          email_contacted_at: string | null
          email_status: string
          email_subject: string | null
          full_name: string
          has_email: boolean
          has_instagram: boolean
          has_phone: boolean
          id: string
          insta_contacted_at: string | null
          insta_message: string | null
          insta_status: string
          message: string
          needs_review: boolean
          notes: string | null
          overall_status: string
          phone: string | null
          profile_url: string
          responded_at: string | null
          responded_channel: string | null
          status: string
          updated_at: string
          upload_id: string | null
          username: string | null
          website: string | null
          whatsapp_contacted_at: string | null
          whatsapp_message: string | null
          whatsapp_status: string
        }
        Insert: {
          category: string
          city: string
          claim_link?: string
          created_at?: string
          date_contacted?: string | null
          email?: string | null
          email_body?: string | null
          email_contacted_at?: string | null
          email_status?: string
          email_subject?: string | null
          full_name?: string
          has_email?: boolean
          has_instagram?: boolean
          has_phone?: boolean
          id?: string
          insta_contacted_at?: string | null
          insta_message?: string | null
          insta_status?: string
          message?: string
          needs_review?: boolean
          notes?: string | null
          overall_status?: string
          phone?: string | null
          profile_url?: string
          responded_at?: string | null
          responded_channel?: string | null
          status?: string
          updated_at?: string
          upload_id?: string | null
          username?: string | null
          website?: string | null
          whatsapp_contacted_at?: string | null
          whatsapp_message?: string | null
          whatsapp_status?: string
        }
        Update: {
          category?: string
          city?: string
          claim_link?: string
          created_at?: string
          date_contacted?: string | null
          email?: string | null
          email_body?: string | null
          email_contacted_at?: string | null
          email_status?: string
          email_subject?: string | null
          full_name?: string
          has_email?: boolean
          has_instagram?: boolean
          has_phone?: boolean
          id?: string
          insta_contacted_at?: string | null
          insta_message?: string | null
          insta_status?: string
          message?: string
          needs_review?: boolean
          notes?: string | null
          overall_status?: string
          phone?: string | null
          profile_url?: string
          responded_at?: string | null
          responded_channel?: string | null
          status?: string
          updated_at?: string
          upload_id?: string | null
          username?: string | null
          website?: string | null
          whatsapp_contacted_at?: string | null
          whatsapp_message?: string | null
          whatsapp_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendors_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "uploads"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
