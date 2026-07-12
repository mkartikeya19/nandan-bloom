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
      academic_sessions: {
        Row: {
          created_at: string
          end_date: string
          id: string
          is_active: boolean
          name: string
          start_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          is_active?: boolean
          name: string
          start_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          is_active?: boolean
          name?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      admissions: {
        Row: {
          academic_year: string
          address: string | null
          applicant_name: string
          application_number: string
          applied_on: string
          applying_for_class: string
          created_at: string
          date_of_birth: string | null
          father_name: string | null
          gender: string | null
          guardian_email: string | null
          guardian_phone: string
          id: string
          mother_name: string | null
          previous_school: string | null
          remarks: string | null
          status: string
          updated_at: string
        }
        Insert: {
          academic_year: string
          address?: string | null
          applicant_name: string
          application_number: string
          applied_on?: string
          applying_for_class: string
          created_at?: string
          date_of_birth?: string | null
          father_name?: string | null
          gender?: string | null
          guardian_email?: string | null
          guardian_phone: string
          id?: string
          mother_name?: string | null
          previous_school?: string | null
          remarks?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          academic_year?: string
          address?: string | null
          applicant_name?: string
          application_number?: string
          applied_on?: string
          applying_for_class?: string
          created_at?: string
          date_of_birth?: string | null
          father_name?: string | null
          gender?: string | null
          guardian_email?: string | null
          guardian_phone?: string
          id?: string
          mother_name?: string | null
          previous_school?: string | null
          remarks?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      attendance: {
        Row: {
          class_id: string | null
          created_at: string
          date: string
          id: string
          marked_by: string | null
          remarks: string | null
          status: string
          student_id: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          date: string
          id?: string
          marked_by?: string | null
          remarks?: string | null
          status: string
          student_id: string
        }
        Update: {
          class_id?: string | null
          created_at?: string
          date?: string
          id?: string
          marked_by?: string | null
          remarks?: string | null
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_results: {
        Row: {
          created_at: string
          exam_id: string
          grade: string | null
          id: string
          marks_obtained: number
          max_marks: number
          remarks: string | null
          student_id: string
          subject: string
        }
        Insert: {
          created_at?: string
          exam_id: string
          grade?: string | null
          id?: string
          marks_obtained: number
          max_marks: number
          remarks?: string | null
          student_id: string
          subject: string
        }
        Update: {
          created_at?: string
          exam_id?: string
          grade?: string | null
          id?: string
          marks_obtained?: number
          max_marks?: number
          remarks?: string | null
          student_id?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_results_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_results_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          academic_year: string
          class_name: string | null
          created_at: string
          end_date: string | null
          exam_type: string
          id: string
          max_marks: number | null
          name: string
          start_date: string | null
        }
        Insert: {
          academic_year: string
          class_name?: string | null
          created_at?: string
          end_date?: string | null
          exam_type: string
          id?: string
          max_marks?: number | null
          name: string
          start_date?: string | null
        }
        Update: {
          academic_year?: string
          class_name?: string | null
          created_at?: string
          end_date?: string | null
          exam_type?: string
          id?: string
          max_marks?: number | null
          name?: string
          start_date?: string | null
        }
        Relationships: []
      }
      fee_heads: {
        Row: {
          created_at: string
          default_amount: number
          description: string | null
          id: string
          is_mandatory: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_amount?: number
          description?: string | null
          id?: string
          is_mandatory?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_amount?: number
          description?: string | null
          id?: string
          is_mandatory?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      fee_payments: {
        Row: {
          academic_year: string
          amount: number
          created_at: string
          id: string
          payment_date: string
          payment_mode: string
          receipt_number: string
          remarks: string | null
          status: string
          student_id: string
          term: string | null
        }
        Insert: {
          academic_year: string
          amount: number
          created_at?: string
          id?: string
          payment_date?: string
          payment_mode: string
          receipt_number: string
          remarks?: string | null
          status?: string
          student_id: string
          term?: string | null
        }
        Update: {
          academic_year?: string
          amount?: number
          created_at?: string
          id?: string
          payment_date?: string
          payment_mode?: string
          receipt_number?: string
          remarks?: string | null
          status?: string
          student_id?: string
          term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fee_payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_structures: {
        Row: {
          academic_year: string
          admission_fee: number
          class_name: string
          created_at: string
          exam_fee: number
          id: string
          name: string
          other_fee: number
          total_fee: number
          transport_fee: number
          tuition_fee: number
        }
        Insert: {
          academic_year: string
          admission_fee?: number
          class_name: string
          created_at?: string
          exam_fee?: number
          id?: string
          name: string
          other_fee?: number
          total_fee?: number
          transport_fee?: number
          tuition_fee?: number
        }
        Update: {
          academic_year?: string
          admission_fee?: number
          class_name?: string
          created_at?: string
          exam_fee?: number
          id?: string
          name?: string
          other_fee?: number
          total_fee?: number
          transport_fee?: number
          tuition_fee?: number
        }
        Relationships: []
      }
      houses: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      school_classes: {
        Row: {
          created_at: string
          id: string
          name: string
          order_index: number
          session_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          order_index?: number
          session_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          order_index?: number
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_classes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "academic_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      school_profile: {
        Row: {
          address: string | null
          affiliation_board: string | null
          affiliation_number: string | null
          city: string | null
          created_at: string
          email: string | null
          established_year: number | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          pincode: string | null
          principal_name: string | null
          state: string | null
          udise_code: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          affiliation_board?: string | null
          affiliation_number?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          established_year?: number | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          pincode?: string | null
          principal_name?: string | null
          state?: string | null
          udise_code?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          affiliation_board?: string | null
          affiliation_number?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          established_year?: number | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          pincode?: string | null
          principal_name?: string | null
          state?: string | null
          udise_code?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      school_sections: {
        Row: {
          class_id: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_sections_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "school_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      student_academic_records: {
        Row: {
          academic_session_id: string
          class_id: string
          created_at: string
          fee_structure_id: string | null
          house_id: string | null
          id: string
          joined_on: string
          opening_balance: number | null
          promoted_from_record_id: string | null
          roll_number: string | null
          section_id: string
          status: Database["public"]["Enums"]["student_academic_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          academic_session_id: string
          class_id: string
          created_at?: string
          fee_structure_id?: string | null
          house_id?: string | null
          id?: string
          joined_on?: string
          opening_balance?: number | null
          promoted_from_record_id?: string | null
          roll_number?: string | null
          section_id: string
          status?: Database["public"]["Enums"]["student_academic_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          academic_session_id?: string
          class_id?: string
          created_at?: string
          fee_structure_id?: string | null
          house_id?: string | null
          id?: string
          joined_on?: string
          opening_balance?: number | null
          promoted_from_record_id?: string | null
          roll_number?: string | null
          section_id?: string
          status?: Database["public"]["Enums"]["student_academic_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_academic_records_academic_session_id_fkey"
            columns: ["academic_session_id"]
            isOneToOne: false
            referencedRelation: "academic_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_academic_records_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "school_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_academic_records_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_academic_records_promoted_from_record_id_fkey"
            columns: ["promoted_from_record_id"]
            isOneToOne: false
            referencedRelation: "student_academic_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_academic_records_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "school_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_academic_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          aadhaar_copy_url: string | null
          aadhaar_number: string | null
          address: string | null
          admission_number: string
          admission_type:
            | Database["public"]["Enums"]["student_admission_type"]
            | null
          apaar_id: string | null
          birth_certificate_url: string | null
          blood_group: string | null
          caste: string | null
          category: string | null
          city: string | null
          created_at: string
          date_of_admission: string | null
          date_of_birth: string | null
          emergency_contact_name: string | null
          emergency_contact_number: string | null
          father_email: string | null
          father_mobile: string | null
          father_name: string | null
          father_occupation: string | null
          full_name: string
          gender: string | null
          guardian_email: string | null
          guardian_phone: string | null
          id: string
          mother_email: string | null
          mother_mobile: string | null
          mother_name: string | null
          mother_occupation: string | null
          mother_tongue: string | null
          nationality: string | null
          other_documents: Json | null
          pen_id: string | null
          photo_url: string | null
          pincode: string | null
          religion: string | null
          roll_number: string | null
          samagra_id: string | null
          scholar_number: string
          state: string | null
          status: string
          transfer_certificate_url: string | null
          updated_at: string
        }
        Insert: {
          aadhaar_copy_url?: string | null
          aadhaar_number?: string | null
          address?: string | null
          admission_number: string
          admission_type?:
            | Database["public"]["Enums"]["student_admission_type"]
            | null
          apaar_id?: string | null
          birth_certificate_url?: string | null
          blood_group?: string | null
          caste?: string | null
          category?: string | null
          city?: string | null
          created_at?: string
          date_of_admission?: string | null
          date_of_birth?: string | null
          emergency_contact_name?: string | null
          emergency_contact_number?: string | null
          father_email?: string | null
          father_mobile?: string | null
          father_name?: string | null
          father_occupation?: string | null
          full_name: string
          gender?: string | null
          guardian_email?: string | null
          guardian_phone?: string | null
          id?: string
          mother_email?: string | null
          mother_mobile?: string | null
          mother_name?: string | null
          mother_occupation?: string | null
          mother_tongue?: string | null
          nationality?: string | null
          other_documents?: Json | null
          pen_id?: string | null
          photo_url?: string | null
          pincode?: string | null
          religion?: string | null
          roll_number?: string | null
          samagra_id?: string | null
          scholar_number: string
          state?: string | null
          status?: string
          transfer_certificate_url?: string | null
          updated_at?: string
        }
        Update: {
          aadhaar_copy_url?: string | null
          aadhaar_number?: string | null
          address?: string | null
          admission_number?: string
          admission_type?:
            | Database["public"]["Enums"]["student_admission_type"]
            | null
          apaar_id?: string | null
          birth_certificate_url?: string | null
          blood_group?: string | null
          caste?: string | null
          category?: string | null
          city?: string | null
          created_at?: string
          date_of_admission?: string | null
          date_of_birth?: string | null
          emergency_contact_name?: string | null
          emergency_contact_number?: string | null
          father_email?: string | null
          father_mobile?: string | null
          father_name?: string | null
          father_occupation?: string | null
          full_name?: string
          gender?: string | null
          guardian_email?: string | null
          guardian_phone?: string | null
          id?: string
          mother_email?: string | null
          mother_mobile?: string | null
          mother_name?: string | null
          mother_occupation?: string | null
          mother_tongue?: string | null
          nationality?: string | null
          other_documents?: Json | null
          pen_id?: string | null
          photo_url?: string | null
          pincode?: string | null
          religion?: string | null
          roll_number?: string | null
          samagra_id?: string | null
          scholar_number?: string
          state?: string | null
          status?: string
          transfer_certificate_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      teachers: {
        Row: {
          aadhaar_number: string | null
          address: string | null
          created_at: string
          date_of_birth: string | null
          date_of_joining: string | null
          designation: string | null
          email: string | null
          employee_code: string
          full_name: string
          gender: string | null
          id: string
          pan_number: string | null
          phone: string | null
          qualification: string | null
          status: string
          subject_specialization: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          aadhaar_number?: string | null
          address?: string | null
          created_at?: string
          date_of_birth?: string | null
          date_of_joining?: string | null
          designation?: string | null
          email?: string | null
          employee_code: string
          full_name: string
          gender?: string | null
          id?: string
          pan_number?: string | null
          phone?: string | null
          qualification?: string | null
          status?: string
          subject_specialization?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          aadhaar_number?: string | null
          address?: string | null
          created_at?: string
          date_of_birth?: string | null
          date_of_joining?: string | null
          designation?: string | null
          email?: string | null
          employee_code?: string
          full_name?: string
          gender?: string | null
          id?: string
          pan_number?: string | null
          phone?: string | null
          qualification?: string | null
          status?: string
          subject_specialization?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_first_admin: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      next_scholar_number: { Args: never; Returns: string }
    }
    Enums: {
      app_role:
        | "admin"
        | "teacher"
        | "staff"
        | "super_admin"
        | "reception"
        | "principal"
      student_academic_status:
        | "Active"
        | "Promoted"
        | "Left"
        | "Passed Out"
        | "Transferred"
        | "Inactive"
      student_admission_type:
        | "New Admission"
        | "Existing Student Migration"
        | "Re-admission"
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
      app_role: [
        "admin",
        "teacher",
        "staff",
        "super_admin",
        "reception",
        "principal",
      ],
      student_academic_status: [
        "Active",
        "Promoted",
        "Left",
        "Passed Out",
        "Transferred",
        "Inactive",
      ],
      student_admission_type: [
        "New Admission",
        "Existing Student Migration",
        "Re-admission",
      ],
    },
  },
} as const
