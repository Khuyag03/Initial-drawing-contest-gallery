import type { AgeCategory, EmployeeStatus } from "@/types";

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
          employee_id: string;
          sap_code: string;
          employee_first_name: string | null;
          employee_last_name: string | null;
          age_category: AgeCategory;
          device_hash: string | null;
          ip_hash: string | null;
          user_agent_hash: string | null;
          browser_summary: string | null;
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
          delete_reason: string | null;
        };
        Insert: {
          id?: string;
          drawing_id: string;
          employee_id: string;
          sap_code: string;
          employee_first_name?: string | null;
          employee_last_name?: string | null;
          age_category: AgeCategory;
          device_hash?: string | null;
          ip_hash?: string | null;
          user_agent_hash?: string | null;
          browser_summary?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          delete_reason?: string | null;
        };
        Update: {
          drawing_id?: string;
          employee_id?: string;
          sap_code?: string;
          employee_first_name?: string | null;
          employee_last_name?: string | null;
          age_category?: AgeCategory;
          device_hash?: string | null;
          ip_hash?: string | null;
          user_agent_hash?: string | null;
          browser_summary?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          delete_reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "votes_drawing_id_fkey";
            columns: ["drawing_id"];
            isOneToOne: false;
            referencedRelation: "drawings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "votes_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          }
        ];
      };
      employees: {
        Row: {
          id: string;
          sap_code: string;
          first_name: string;
          last_name: string;
          status: EmployeeStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sap_code: string;
          first_name: string;
          last_name: string;
          status?: EmployeeStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          sap_code?: string;
          first_name?: string;
          last_name?: string;
          status?: EmployeeStatus;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      public_drawings_with_votes: {
        Row: {
          id: string;
          title: string;
          child_name: string | null;
          age_category: AgeCategory;
          image_url: string;
          created_at: string;
          vote_count: number;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
