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
            foreignKeyName: "attendance_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          academic_year: string
          class_teacher_id: string | null
          created_at: string
          id: string
          name: string
          section: string | null
        }
        Insert: {
          academic_year: string
          class_teacher_id?: string | null
          created_at?: string
          id?: string
          name: string
          section?: string | null
        }
        Update: {
          academic_year?: string
          class_teacher_id?: string | null
          created_at?: string
          id?: string
          name?: string
          section?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_class_teacher_id_fkey"
            columns: ["class_teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
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
      students: {
        Row: {
          aadhaar_number: string | null
          academic_year: string | null
          address: string | null
          admission_number: string
          blood_group: string | null
          category: string | null
          city: string | null
          class_id: string | null
          created_at: string
          date_of_birth: string | null
          father_name: string | null
          full_name: string
          gender: string | null
          guardian_email: string | null
          guardian_phone: string | null
          id: string
          mother_name: string | null
          nationality: string | null
          photo_url: string | null
          pincode: string | null
          religion: string | null
          roll_number: string | null
          state: string | null
          status: string
          updated_at: string
        }
        Insert: {
          aadhaar_number?: string | null
          academic_year?: string | null
          address?: string | null
          admission_number: string
          blood_group?: string | null
          category?: string | null
          city?: string | null
          class_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          father_name?: string | null
          full_name: string
          gender?: string | null
          guardian_email?: string | null
          guardian_phone?: string | null
          id?: string
          mother_name?: string | null
          nationality?: string | null
          photo_url?: string | null
          pincode?: string | null
          religion?: string | null
          roll_number?: string | null
          state?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          aadhaar_number?: string | null
          academic_year?: string | null
          address?: string | null
          admission_number?: string
          blood_group?: string | null
          category?: string | null
          city?: string | null
          class_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          father_name?: string | null
          full_name?: string
          gender?: string | null
          guardian_email?: string | null
          guardian_phone?: string | null
          id?: string
          mother_name?: string | null
          nationality?: string | null
          photo_url?: string | null
          pincode?: string | null
          religion?: string | null
          roll_number?: string | null
          state?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Enums: {
      app_role: "admin" | "teacher" | "staff" | "super_admin"
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
      app_role: ["admin", "teacher", "staff", "super_admin"],
    },
  },
} as const
