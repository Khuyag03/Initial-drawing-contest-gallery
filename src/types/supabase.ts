import type { AgeCategory } from "@/types";

export type Database = {
  public: {
    Tables: {
      drawings: {
        Row: {
          id: string;
          title: string;
          child_name: string | null;
          age_category: AgeCategory;
          image_url: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          child_name?: string | null;
          age_category: AgeCategory;
          image_url: string;
          created_at?: string;
        };
        Update: {
          title?: string;
          child_name?: string | null;
          age_category?: AgeCategory;
          image_url?: string;
        };
        Relationships: [];
      };
      votes: {
        Row: {
          id: string;
          drawing_id: string;
          device_hash: string;
          ip_hash: string | null;
          user_agent_hash: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          drawing_id: string;
          device_hash: string;
          ip_hash?: string | null;
          user_agent_hash?: string | null;
          created_at?: string;
        };
        Update: {
          drawing_id?: string;
          device_hash?: string;
          ip_hash?: string | null;
          user_agent_hash?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "votes_drawing_id_fkey";
            columns: ["drawing_id"];
            isOneToOne: false;
            referencedRelation: "drawings";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
