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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          status: string
          target_resource: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          status: string
          target_resource?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          status?: string
          target_resource?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      comments: {
        Row: {
          content: string
          created_at: string
          deleted: boolean
          end_position: number
          highlighted_text: string
          id: string
          parent_comment_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          script_id: string
          start_position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          deleted?: boolean
          end_position: number
          highlighted_text?: string
          id?: string
          parent_comment_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          script_id: string
          start_position: number
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          deleted?: boolean
          end_position?: number
          highlighted_text?: string
          id?: string
          parent_comment_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          script_id?: string
          start_position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "scripts_with_eav"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hard_delete_audit_log: {
        Row: {
          created_at: string
          deleted_at: string
          descendant_count: number
          id: string
          operator_email: string | null
          operator_id: string
          reason: string | null
          root_comment_id: string
          script_id: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string
          descendant_count: number
          id?: string
          operator_email?: string | null
          operator_id: string
          reason?: string | null
          root_comment_id: string
          script_id?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string
          descendant_count?: number
          id?: string
          operator_email?: string | null
          operator_id?: string
          reason?: string | null
          root_comment_id?: string
          script_id?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          client_filter: string | null
          created_at: string | null
          due_date: string | null
          eav_code: string
          final_invoice_sent: string | null
          id: string
          project_phase: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          client_filter?: string | null
          created_at?: string | null
          due_date?: string | null
          eav_code: string
          final_invoice_sent?: string | null
          id: string
          project_phase?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          client_filter?: string | null
          created_at?: string | null
          due_date?: string | null
          eav_code?: string
          final_invoice_sent?: string | null
          id?: string
          project_phase?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      script_components: {
        Row: {
          component_number: number
          content: string
          created_at: string | null
          id: string
          script_id: string | null
          word_count: number | null
        }
        Insert: {
          component_number: number
          content: string
          created_at?: string | null
          id?: string
          script_id?: string | null
          word_count?: number | null
        }
        Update: {
          component_number?: number
          content?: string
          created_at?: string | null
          id?: string
          script_id?: string | null
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "script_components_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "script_components_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "scripts_with_eav"
            referencedColumns: ["id"]
          },
        ]
      }
      scripts: {
        Row: {
          component_count: number | null
          created_at: string | null
          id: string
          plain_text: string | null
          status: string
          updated_at: string | null
          video_id: string | null
          yjs_state: string | null
        }
        Insert: {
          component_count?: number | null
          created_at?: string | null
          id?: string
          plain_text?: string | null
          status?: string
          updated_at?: string | null
          video_id?: string | null
          yjs_state?: string | null
        }
        Update: {
          component_count?: number | null
          created_at?: string | null
          id?: string
          plain_text?: string | null
          status?: string
          updated_at?: string | null
          video_id?: string | null
          yjs_state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scripts_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: true
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      user_clients: {
        Row: {
          client_filter: string
          granted_at: string | null
          granted_by: string | null
          user_id: string
        }
        Insert: {
          client_filter: string
          granted_at?: string | null
          granted_by?: string | null
          user_id: string
        }
        Update: {
          client_filter?: string
          granted_at?: string | null
          granted_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          created_at: string | null
          display_name: string | null
          email: string
          id: string
          role: string | null
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          email: string
          id: string
          role?: string | null
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          email?: string
          id?: string
          role?: string | null
        }
        Relationships: []
      }
      videos: {
        Row: {
          created_at: string | null
          eav_code: string | null
          id: string
          main_stream_status: string | null
          production_type: string | null
          title: string
          updated_at: string | null
          vo_stream_status: string | null
        }
        Insert: {
          created_at?: string | null
          eav_code?: string | null
          id: string
          main_stream_status?: string | null
          production_type?: string | null
          title: string
          updated_at?: string | null
          vo_stream_status?: string | null
        }
        Update: {
          created_at?: string | null
          eav_code?: string | null
          id?: string
          main_stream_status?: string | null
          production_type?: string | null
          title?: string
          updated_at?: string | null
          vo_stream_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "videos_eav_code_fkey"
            columns: ["eav_code"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["eav_code"]
          },
        ]
      }
    }
    Views: {
      scripts_with_eav: {
        Row: {
          component_count: number | null
          created_at: string | null
          eav_code: string | null
          id: string | null
          main_stream_status: string | null
          plain_text: string | null
          production_type: string | null
          status: string | null
          updated_at: string | null
          video_id: string | null
          video_title: string | null
          vo_stream_status: string | null
          yjs_state: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scripts_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: true
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videos_eav_code_fkey"
            columns: ["eav_code"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["eav_code"]
          },
        ]
      }
      user_accessible_scripts: {
        Row: {
          access_type: string | null
          script_id: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      cascade_soft_delete_comments: {
        Args: { comment_ids: string[] }
        Returns: {
          deleted_count: number
        }[]
      }
      check_client_access: {
        Args: Record<PropertyKey, never>
        Returns: {
          can_see_projects: boolean
          can_see_user_clients: boolean
          client_filters: string[]
          current_user_id: string
          current_user_role: string
        }[]
      }
      citext: {
        Args: { "": boolean } | { "": string } | { "": unknown }
        Returns: string
      }
      citext_hash: {
        Args: { "": string }
        Returns: number
      }
      citextin: {
        Args: { "": unknown }
        Returns: string
      }
      citextout: {
        Args: { "": string }
        Returns: unknown
      }
      citextrecv: {
        Args: { "": unknown }
        Returns: string
      }
      citextsend: {
        Args: { "": string }
        Returns: string
      }
      get_comment_descendants: {
        Args: { parent_id: string }
        Returns: {
          id: string
        }[]
      }
      get_user_accessible_comment_ids: {
        Args: Record<PropertyKey, never>
        Returns: {
          comment_id: string
        }[]
      }
      get_user_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      hard_delete_comment_tree: {
        Args: { p_comment_id: string; p_reason?: string }
        Returns: Json
      }
      json_matches_schema: {
        Args: { instance: Json; schema: Json }
        Returns: boolean
      }
      jsonb_matches_schema: {
        Args: { instance: Json; schema: Json }
        Returns: boolean
      }
      jsonschema_is_valid: {
        Args: { schema: Json }
        Returns: boolean
      }
      jsonschema_validation_errors: {
        Args: { instance: Json; schema: Json }
        Returns: string[]
      }
      refresh_user_accessible_scripts: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      save_script_with_components: {
        Args: {
          p_components: Json
          p_plain_text: string
          p_script_id: string
          p_yjs_state: string
        }
        Returns: {
          component_count: number | null
          created_at: string | null
          id: string
          plain_text: string | null
          status: string
          updated_at: string | null
          video_id: string | null
          yjs_state: string | null
        }[]
      }
      update_script_status: {
        Args: { p_new_status: string; p_script_id: string }
        Returns: {
          component_count: number | null
          created_at: string | null
          id: string
          plain_text: string | null
          status: string
          updated_at: string | null
          video_id: string | null
          yjs_state: string | null
        }[]
      }
    }
    Enums: {
      script_workflow_status:
        | "draft"
        | "in_review"
        | "rework"
        | "approved"
        | "pend_start"
        | "reuse"
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
      script_workflow_status: [
        "draft",
        "in_review",
        "rework",
        "approved",
        "pend_start",
        "reuse",
      ],
    },
  },
} as const
