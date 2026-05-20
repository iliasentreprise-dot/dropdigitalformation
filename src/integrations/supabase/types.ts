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
      chapter_reactions: {
        Row: {
          chapter_id: string
          created_at: string
          id: string
          reaction: string
          user_id: string
        }
        Insert: {
          chapter_id: string
          created_at?: string
          id?: string
          reaction: string
          user_id: string
        }
        Update: {
          chapter_id?: string
          created_at?: string
          id?: string
          reaction?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapter_reactions_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      chapter_resources: {
        Row: {
          chapter_id: string
          created_at: string
          file_type: string
          file_url: string
          id: string
          position: number
          title: string
        }
        Insert: {
          chapter_id: string
          created_at?: string
          file_type?: string
          file_url: string
          id?: string
          position?: number
          title: string
        }
        Update: {
          chapter_id?: string
          created_at?: string
          file_type?: string
          file_url?: string
          id?: string
          position?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapter_resources_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      chapters: {
        Row: {
          created_at: string
          description: string
          duration_seconds: number
          id: string
          module_id: string
          position: number
          title: string
          updated_at: string
          video_url: string
        }
        Insert: {
          created_at?: string
          description?: string
          duration_seconds?: number
          id?: string
          module_id: string
          position?: number
          title: string
          updated_at?: string
          video_url?: string
        }
        Update: {
          created_at?: string
          description?: string
          duration_seconds?: number
          id?: string
          module_id?: string
          position?: number
          title?: string
          updated_at?: string
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapters_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          body: string
          created_at: string
          id: string
          image_url: string | null
          post_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          image_url?: string | null
          post_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          image_url?: string | null
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_acceptances: {
        Row: {
          accepted_at: string
          recipient_id: string
          sender_id: string
        }
        Insert: {
          accepted_at?: string
          recipient_id: string
          sender_id: string
        }
        Update: {
          accepted_at?: string
          recipient_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: []
      }
      group_messages: {
        Row: {
          content: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          reply_to_id: string | null
          user_id: string
          visible: boolean
        }
        Insert: {
          content: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          reply_to_id?: string | null
          user_id: string
          visible?: boolean
        }
        Update: {
          content?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          reply_to_id?: string | null
          user_id?: string
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "group_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "group_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "group_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      module_completions: {
        Row: {
          completed_at: string
          id: string
          module_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          module_id: string
          user_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          module_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_completions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          badge: string | null
          badge_color: string | null
          created_at: string
          description: string
          id: string
          position: number
          section: string
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          badge?: string | null
          badge_color?: string | null
          created_at?: string
          description?: string
          id?: string
          position?: number
          section?: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          badge?: string | null
          badge_color?: string | null
          created_at?: string
          description?: string
          id?: string
          position?: number
          section?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      muted_users: {
        Row: {
          muted_at: string
          muted_by: string
          reason: string | null
          user_id: string
        }
        Insert: {
          muted_at?: string
          muted_by: string
          reason?: string | null
          user_id: string
        }
        Update: {
          muted_at?: string
          muted_by?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      posts: {
        Row: {
          body: string
          created_at: string
          id: string
          image_url: string | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          image_url?: string | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          image_url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      private_messages: {
        Row: {
          content: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          recipient_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          recipient_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          recipient_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          admin_notes: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          followers_count: number
          following_count: number
          full_name: string | null
          has_software_access: boolean
          id: string
          show_progression: boolean
          temp_password: string | null
          updated_at: string
          username: string | null
          username_changed: boolean
        }
        Insert: {
          admin_notes?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          followers_count?: number
          following_count?: number
          full_name?: string | null
          has_software_access?: boolean
          id: string
          show_progression?: boolean
          temp_password?: string | null
          updated_at?: string
          username?: string | null
          username_changed?: boolean
        }
        Update: {
          admin_notes?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          followers_count?: number
          following_count?: number
          full_name?: string | null
          has_software_access?: boolean
          id?: string
          show_progression?: boolean
          temp_password?: string | null
          updated_at?: string
          username?: string | null
          username_changed?: boolean
        }
        Relationships: []
      }
      result_comments: {
        Row: {
          body: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          result_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          result_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          result_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "result_comments_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "results"
            referencedColumns: ["id"]
          },
        ]
      }
      result_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          result_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          result_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          result_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "result_reactions_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "results"
            referencedColumns: ["id"]
          },
        ]
      }
      results: {
        Row: {
          amount: number | null
          content: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          photo_url: string | null
          user_id: string
          visible: boolean
        }
        Insert: {
          amount?: number | null
          content: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          photo_url?: string | null
          user_id: string
          visible?: boolean
        }
        Update: {
          amount?: number | null
          content?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          photo_url?: string | null
          user_id?: string
          visible?: boolean
        }
        Relationships: []
      }
      user_chapter_progress: {
        Row: {
          chapter_id: string
          completed_at: string
          user_id: string
        }
        Insert: {
          chapter_id: string
          completed_at?: string
          user_id: string
        }
        Update: {
          chapter_id?: string
          completed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_chapter_progress_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      username_history: {
        Row: {
          changed_at: string
          id: string
          new_username: string | null
          old_username: string | null
          user_id: string
        }
        Insert: {
          changed_at?: string
          id?: string
          new_username?: string | null
          old_username?: string | null
          user_id: string
        }
        Update: {
          changed_at?: string
          id?: string
          new_username?: string | null
          old_username?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "moderator"
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
      app_role: ["admin", "user", "moderator"],
    },
  },
} as const
