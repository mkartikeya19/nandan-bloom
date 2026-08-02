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
          closed_at: string | null
          closed_by: string | null
          created_at: string
          end_date: string
          id: string
          is_active: boolean
          name: string
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          end_date: string
          id?: string
          is_active?: boolean
          name: string
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          end_date?: string
          id?: string
          is_active?: boolean
          name?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      activity_log: {
        Row: {
          action: string
          created_at: string
          details: Json
          entity_id: string | null
          entity_type: string | null
          id: string
          module: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          module: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          module?: string
          user_id?: string | null
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
      exam_class_subject_components: {
        Row: {
          class_subject_id: string
          created_at: string
          id: string
          is_practical: boolean
          max_marks: number
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          class_subject_id: string
          created_at?: string
          id?: string
          is_practical?: boolean
          max_marks: number
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          class_subject_id?: string
          created_at?: string
          id?: string
          is_practical?: boolean
          max_marks?: number
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_class_subject_components_class_subject_id_fkey"
            columns: ["class_subject_id"]
            isOneToOne: false
            referencedRelation: "exam_class_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_class_subjects: {
        Row: {
          class_id: string
          created_at: string
          id: string
          is_active: boolean
          sort_order: number
          subject_id: string
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          sort_order?: number
          subject_id: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          sort_order?: number
          subject_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_class_subjects_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "school_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_class_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "exam_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_grade_bands: {
        Row: {
          created_at: string
          grade: string
          id: string
          max_percent: number
          min_percent: number
          remark: string | null
          scale_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          grade: string
          id?: string
          max_percent: number
          min_percent: number
          remark?: string | null
          scale_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          grade?: string
          id?: string
          max_percent?: number
          min_percent?: number
          remark?: string | null
          scale_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_grade_bands_scale_id_fkey"
            columns: ["scale_id"]
            isOneToOne: false
            referencedRelation: "exam_grade_scales"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_grade_scales: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      exam_pattern_classes: {
        Row: {
          class_id: string
          created_at: string
          id: string
          pattern_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          pattern_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          pattern_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_pattern_classes_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "school_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_pattern_classes_pattern_id_fkey"
            columns: ["pattern_id"]
            isOneToOne: false
            referencedRelation: "exam_patterns"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_pattern_terms: {
        Row: {
          created_at: string
          id: string
          include_in_final: boolean
          name: string
          pattern_id: string
          sort_order: number
          updated_at: string
          weightage_percent: number
        }
        Insert: {
          created_at?: string
          id?: string
          include_in_final?: boolean
          name: string
          pattern_id: string
          sort_order?: number
          updated_at?: string
          weightage_percent?: number
        }
        Update: {
          created_at?: string
          id?: string
          include_in_final?: boolean
          name?: string
          pattern_id?: string
          sort_order?: number
          updated_at?: string
          weightage_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "exam_pattern_terms_pattern_id_fkey"
            columns: ["pattern_id"]
            isOneToOne: false
            referencedRelation: "exam_patterns"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_patterns: {
        Row: {
          academic_session_id: string
          created_at: string
          created_by: string | null
          grade_scale_id: string | null
          id: string
          is_active: boolean
          is_locked: boolean
          locked_at: string | null
          name: string
          parent_pattern_id: string | null
          updated_at: string
          version: number
        }
        Insert: {
          academic_session_id: string
          created_at?: string
          created_by?: string | null
          grade_scale_id?: string | null
          id?: string
          is_active?: boolean
          is_locked?: boolean
          locked_at?: string | null
          name: string
          parent_pattern_id?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          academic_session_id?: string
          created_at?: string
          created_by?: string | null
          grade_scale_id?: string | null
          id?: string
          is_active?: boolean
          is_locked?: boolean
          locked_at?: string | null
          name?: string
          parent_pattern_id?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "exam_patterns_academic_session_id_fkey"
            columns: ["academic_session_id"]
            isOneToOne: false
            referencedRelation: "academic_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_patterns_grade_scale_id_fkey"
            columns: ["grade_scale_id"]
            isOneToOne: false
            referencedRelation: "exam_grade_scales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_patterns_parent_pattern_id_fkey"
            columns: ["parent_pattern_id"]
            isOneToOne: false
            referencedRelation: "exam_patterns"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_subjects: {
        Row: {
          code: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      fee_concessions: {
        Row: {
          academic_session_id: string
          amount: number | null
          approved_by: string | null
          approved_on: string
          concession_type: string
          created_at: string
          fee_head_id: string | null
          id: string
          percentage: number | null
          reason: string | null
          student_id: string
        }
        Insert: {
          academic_session_id: string
          amount?: number | null
          approved_by?: string | null
          approved_on?: string
          concession_type: string
          created_at?: string
          fee_head_id?: string | null
          id?: string
          percentage?: number | null
          reason?: string | null
          student_id: string
        }
        Update: {
          academic_session_id?: string
          amount?: number | null
          approved_by?: string | null
          approved_on?: string
          concession_type?: string
          created_at?: string
          fee_head_id?: string | null
          id?: string
          percentage?: number | null
          reason?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_concessions_academic_session_id_fkey"
            columns: ["academic_session_id"]
            isOneToOne: false
            referencedRelation: "academic_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_concessions_fee_head_id_fkey"
            columns: ["fee_head_id"]
            isOneToOne: false
            referencedRelation: "fee_heads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_concessions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_heads: {
        Row: {
          auto_generate: boolean
          charge_trigger: string
          code: string | null
          created_at: string
          default_amount: number
          default_applicability: Database["public"]["Enums"]["fee_applicability"]
          default_applicable_months: number[] | null
          default_frequency: Database["public"]["Enums"]["fee_frequency"]
          description: string | null
          id: string
          is_active: boolean
          is_mandatory: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          auto_generate?: boolean
          charge_trigger?: string
          code?: string | null
          created_at?: string
          default_amount?: number
          default_applicability?: Database["public"]["Enums"]["fee_applicability"]
          default_applicable_months?: number[] | null
          default_frequency?: Database["public"]["Enums"]["fee_frequency"]
          description?: string | null
          id?: string
          is_active?: boolean
          is_mandatory?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          auto_generate?: boolean
          charge_trigger?: string
          code?: string | null
          created_at?: string
          default_amount?: number
          default_applicability?: Database["public"]["Enums"]["fee_applicability"]
          default_applicable_months?: number[] | null
          default_frequency?: Database["public"]["Enums"]["fee_frequency"]
          description?: string | null
          id?: string
          is_active?: boolean
          is_mandatory?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      fee_payment_allocations: {
        Row: {
          amount: number
          created_at: string
          fee_payment_id: string
          id: string
          student_fee_schedule_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          fee_payment_id: string
          id?: string
          student_fee_schedule_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          fee_payment_id?: string
          id?: string
          student_fee_schedule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_payment_allocations_fee_payment_id_fkey"
            columns: ["fee_payment_id"]
            isOneToOne: false
            referencedRelation: "fee_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_payment_allocations_student_fee_schedule_id_fkey"
            columns: ["student_fee_schedule_id"]
            isOneToOne: false
            referencedRelation: "student_fee_schedule"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_payments: {
        Row: {
          academic_record_id: string | null
          academic_session_id: string | null
          academic_year: string
          amount: number
          collected_by: string | null
          concession_total: number
          created_at: string
          id: string
          is_void: boolean
          last_printed_at: string | null
          notes: string | null
          payment_date: string
          payment_mode: Database["public"]["Enums"]["fee_payment_mode"]
          receipt_number: string
          receipt_print_count: number
          remarks: string | null
          status: string
          student_id: string
          sub_total: number | null
          term: string | null
          transaction_reference: string | null
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          academic_record_id?: string | null
          academic_session_id?: string | null
          academic_year: string
          amount: number
          collected_by?: string | null
          concession_total?: number
          created_at?: string
          id?: string
          is_void?: boolean
          last_printed_at?: string | null
          notes?: string | null
          payment_date?: string
          payment_mode: Database["public"]["Enums"]["fee_payment_mode"]
          receipt_number: string
          receipt_print_count?: number
          remarks?: string | null
          status?: string
          student_id: string
          sub_total?: number | null
          term?: string | null
          transaction_reference?: string | null
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          academic_record_id?: string | null
          academic_session_id?: string | null
          academic_year?: string
          amount?: number
          collected_by?: string | null
          concession_total?: number
          created_at?: string
          id?: string
          is_void?: boolean
          last_printed_at?: string | null
          notes?: string | null
          payment_date?: string
          payment_mode?: Database["public"]["Enums"]["fee_payment_mode"]
          receipt_number?: string
          receipt_print_count?: number
          remarks?: string | null
          status?: string
          student_id?: string
          sub_total?: number | null
          term?: string | null
          transaction_reference?: string | null
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fee_payments_academic_record_id_fkey"
            columns: ["academic_record_id"]
            isOneToOne: false
            referencedRelation: "student_academic_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_payments_academic_session_id_fkey"
            columns: ["academic_session_id"]
            isOneToOne: false
            referencedRelation: "academic_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_settings: {
        Row: {
          default_collection_mode: string
          id: string
          late_fee_amount: number
          late_fee_enabled: boolean
          late_fee_grace_days: number
          updated_at: string
        }
        Insert: {
          default_collection_mode?: string
          id?: string
          late_fee_amount?: number
          late_fee_enabled?: boolean
          late_fee_grace_days?: number
          updated_at?: string
        }
        Update: {
          default_collection_mode?: string
          id?: string
          late_fee_amount?: number
          late_fee_enabled?: boolean
          late_fee_grace_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      fee_structure_items: {
        Row: {
          amount: number
          applicability: Database["public"]["Enums"]["fee_applicability"]
          applicable_months: number[] | null
          created_at: string
          fee_head_id: string
          fee_structure_id: string
          frequency: Database["public"]["Enums"]["fee_frequency"]
          id: string
          is_optional: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          amount?: number
          applicability?: Database["public"]["Enums"]["fee_applicability"]
          applicable_months?: number[] | null
          created_at?: string
          fee_head_id: string
          fee_structure_id: string
          frequency?: Database["public"]["Enums"]["fee_frequency"]
          id?: string
          is_optional?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          applicability?: Database["public"]["Enums"]["fee_applicability"]
          applicable_months?: number[] | null
          created_at?: string
          fee_head_id?: string
          fee_structure_id?: string
          frequency?: Database["public"]["Enums"]["fee_frequency"]
          id?: string
          is_optional?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_structure_items_fee_head_id_fkey"
            columns: ["fee_head_id"]
            isOneToOne: false
            referencedRelation: "fee_heads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_structure_items_fee_structure_id_fkey"
            columns: ["fee_structure_id"]
            isOneToOne: false
            referencedRelation: "fee_structures"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_structures: {
        Row: {
          academic_session_id: string | null
          academic_year: string | null
          admission_fee: number
          class_id: string | null
          class_name: string | null
          created_at: string
          exam_fee: number
          id: string
          is_active: boolean
          name: string
          other_fee: number
          total_fee: number
          transport_fee: number
          tuition_fee: number
          updated_at: string
        }
        Insert: {
          academic_session_id?: string | null
          academic_year?: string | null
          admission_fee?: number
          class_id?: string | null
          class_name?: string | null
          created_at?: string
          exam_fee?: number
          id?: string
          is_active?: boolean
          name: string
          other_fee?: number
          total_fee?: number
          transport_fee?: number
          tuition_fee?: number
          updated_at?: string
        }
        Update: {
          academic_session_id?: string | null
          academic_year?: string | null
          admission_fee?: number
          class_id?: string | null
          class_name?: string | null
          created_at?: string
          exam_fee?: number
          id?: string
          is_active?: boolean
          name?: string
          other_fee?: number
          total_fee?: number
          transport_fee?: number
          tuition_fee?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_structures_academic_session_id_fkey"
            columns: ["academic_session_id"]
            isOneToOne: false
            referencedRelation: "academic_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_structures_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "school_classes"
            referencedColumns: ["id"]
          },
        ]
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
      opening_balance_details: {
        Row: {
          academic_record_id: string | null
          academic_session_id: string | null
          amount: number
          created_at: string
          created_by: string | null
          fee_head_id: string | null
          fee_head_label: string | null
          id: string
          remarks: string | null
          session_label: string | null
          source: string
          student_id: string
          updated_at: string
        }
        Insert: {
          academic_record_id?: string | null
          academic_session_id?: string | null
          amount?: number
          created_at?: string
          created_by?: string | null
          fee_head_id?: string | null
          fee_head_label?: string | null
          id?: string
          remarks?: string | null
          session_label?: string | null
          source?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          academic_record_id?: string | null
          academic_session_id?: string | null
          amount?: number
          created_at?: string
          created_by?: string | null
          fee_head_id?: string | null
          fee_head_label?: string | null
          id?: string
          remarks?: string | null
          session_label?: string | null
          source?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opening_balance_details_academic_record_id_fkey"
            columns: ["academic_record_id"]
            isOneToOne: false
            referencedRelation: "student_academic_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opening_balance_details_academic_session_id_fkey"
            columns: ["academic_session_id"]
            isOneToOne: false
            referencedRelation: "academic_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opening_balance_details_fee_head_id_fkey"
            columns: ["fee_head_id"]
            isOneToOne: false
            referencedRelation: "fee_heads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opening_balance_details_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "student_academic_records_fee_structure_fk"
            columns: ["fee_structure_id"]
            isOneToOne: false
            referencedRelation: "fee_structures"
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
      student_fee_schedule: {
        Row: {
          academic_record_id: string
          academic_session_id: string
          concession_amount: number
          created_at: string
          display_order: number
          due_amount: number
          due_date: string | null
          fee_head_id: string
          fee_structure_item_id: string | null
          id: string
          is_opening_balance: boolean
          paid_amount: number
          period_label: string
          period_month: number | null
          period_year: number | null
          sort_key: string | null
          status: Database["public"]["Enums"]["fee_schedule_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          academic_record_id: string
          academic_session_id: string
          concession_amount?: number
          created_at?: string
          display_order?: number
          due_amount?: number
          due_date?: string | null
          fee_head_id: string
          fee_structure_item_id?: string | null
          id?: string
          is_opening_balance?: boolean
          paid_amount?: number
          period_label: string
          period_month?: number | null
          period_year?: number | null
          sort_key?: string | null
          status?: Database["public"]["Enums"]["fee_schedule_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          academic_record_id?: string
          academic_session_id?: string
          concession_amount?: number
          created_at?: string
          display_order?: number
          due_amount?: number
          due_date?: string | null
          fee_head_id?: string
          fee_structure_item_id?: string | null
          id?: string
          is_opening_balance?: boolean
          paid_amount?: number
          period_label?: string
          period_month?: number | null
          period_year?: number | null
          sort_key?: string | null
          status?: Database["public"]["Enums"]["fee_schedule_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_fee_schedule_academic_record_id_fkey"
            columns: ["academic_record_id"]
            isOneToOne: false
            referencedRelation: "student_academic_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_fee_schedule_academic_session_id_fkey"
            columns: ["academic_session_id"]
            isOneToOne: false
            referencedRelation: "academic_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_fee_schedule_fee_head_id_fkey"
            columns: ["fee_head_id"]
            isOneToOne: false
            referencedRelation: "fee_heads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_fee_schedule_fee_structure_item_id_fkey"
            columns: ["fee_structure_item_id"]
            isOneToOne: false
            referencedRelation: "fee_structure_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_fee_schedule_student_id_fkey"
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
          admission_number: string | null
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
          date_of_leaving: string | null
          emergency_contact_name: string | null
          emergency_contact_number: string | null
          father_email: string | null
          father_mobile: string | null
          father_name: string | null
          father_occupation: string | null
          full_name: string
          gender: string | null
          guardian_email: string | null
          guardian_name: string | null
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
          reason_for_leaving: string | null
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
          admission_number?: string | null
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
          date_of_leaving?: string | null
          emergency_contact_name?: string | null
          emergency_contact_number?: string | null
          father_email?: string | null
          father_mobile?: string | null
          father_name?: string | null
          father_occupation?: string | null
          full_name: string
          gender?: string | null
          guardian_email?: string | null
          guardian_name?: string | null
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
          reason_for_leaving?: string | null
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
          admission_number?: string | null
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
          date_of_leaving?: string | null
          emergency_contact_name?: string | null
          emergency_contact_number?: string | null
          father_email?: string | null
          father_mobile?: string | null
          father_name?: string | null
          father_occupation?: string | null
          full_name?: string
          gender?: string | null
          guardian_email?: string | null
          guardian_name?: string | null
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
          reason_for_leaving?: string | null
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
      teacher_documents: {
        Row: {
          created_at: string
          doc_type: string
          file_path: string
          id: string
          label: string | null
          teacher_id: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          doc_type: string
          file_path: string
          id?: string
          label?: string | null
          teacher_id: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          doc_type?: string
          file_path?: string
          id?: string
          label?: string | null
          teacher_id?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_documents_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          aadhaar_number: string | null
          account_holder_name: string | null
          account_number: string | null
          address: string | null
          bank_name: string | null
          created_at: string
          date_of_birth: string | null
          date_of_joining: string | null
          designation: string | null
          email: string | null
          employee_code: string
          full_name: string
          gender: string | null
          id: string
          ifsc_code: string | null
          is_archived: boolean
          monthly_salary: number | null
          pan_number: string | null
          phone: string | null
          previous_school: string | null
          qualification: string | null
          salary_effective_from: string | null
          status: string
          subject_specialization: string | null
          total_experience_years: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          aadhaar_number?: string | null
          account_holder_name?: string | null
          account_number?: string | null
          address?: string | null
          bank_name?: string | null
          created_at?: string
          date_of_birth?: string | null
          date_of_joining?: string | null
          designation?: string | null
          email?: string | null
          employee_code: string
          full_name: string
          gender?: string | null
          id?: string
          ifsc_code?: string | null
          is_archived?: boolean
          monthly_salary?: number | null
          pan_number?: string | null
          phone?: string | null
          previous_school?: string | null
          qualification?: string | null
          salary_effective_from?: string | null
          status?: string
          subject_specialization?: string | null
          total_experience_years?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          aadhaar_number?: string | null
          account_holder_name?: string | null
          account_number?: string | null
          address?: string | null
          bank_name?: string | null
          created_at?: string
          date_of_birth?: string | null
          date_of_joining?: string | null
          designation?: string | null
          email?: string | null
          employee_code?: string
          full_name?: string
          gender?: string | null
          id?: string
          ifsc_code?: string | null
          is_archived?: boolean
          monthly_salary?: number | null
          pan_number?: string | null
          phone?: string | null
          previous_school?: string | null
          qualification?: string | null
          salary_effective_from?: string | null
          status?: string
          subject_specialization?: string | null
          total_experience_years?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_invitations: {
        Row: {
          accepted_at: string | null
          accepted_user_id: string | null
          created_at: string
          email: string
          expires_at: string
          full_name: string | null
          id: string
          invited_by: string | null
          revoked_at: string | null
          roles: Database["public"]["Enums"]["app_role"][]
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_user_id?: string | null
          created_at?: string
          email: string
          expires_at?: string
          full_name?: string | null
          id?: string
          invited_by?: string | null
          revoked_at?: string | null
          roles?: Database["public"]["Enums"]["app_role"][]
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_user_id?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          full_name?: string | null
          id?: string
          invited_by?: string | null
          revoked_at?: string | null
          roles?: Database["public"]["Enums"]["app_role"][]
          updated_at?: string
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
      admit_student_with_fee_structure: {
        Args: { _academic_payload: Json; _student_payload: Json }
        Returns: Json
      }
      bulk_promote_students: { Args: { _payload: Json }; Returns: Json }
      can_manage_exam_masters: { Args: { _uid: string }; Returns: boolean }
      claim_first_admin: { Args: never; Returns: boolean }
      clone_exam_pattern: {
        Args: { _new_name: string; _new_session_id: string; _source_id: string }
        Returns: string
      }
      find_complete_fee_structure: {
        Args: { _academic_session_id: string; _class_id: string }
        Returns: {
          match_count: number
          structure_id: string
        }[]
      }
      generate_student_fee_schedule: {
        Args: { _record_id: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      invite_user: {
        Args: {
          _email: string
          _full_name?: string
          _roles: Database["public"]["Enums"]["app_role"][]
        }
        Returns: string
      }
      is_fee_structure_complete: {
        Args: { _structure_id: string }
        Returns: boolean
      }
      link_academic_record_fee_structure: {
        Args: { _record_id: string }
        Returns: Json
      }
      next_employee_code: { Args: never; Returns: string }
      next_receipt_number: { Args: never; Returns: string }
      next_scholar_number: { Args: never; Returns: string }
      regenerate_class_roll_numbers: {
        Args: { _academic_session_id: string; _class_id: string }
        Returns: number
      }
      regenerate_roll_numbers_after_promotion: {
        Args: { _payload: Json }
        Returns: number
      }
      version_exam_pattern: { Args: { _source_id: string }; Returns: string }
    }
    Enums: {
      app_role:
        | "admin"
        | "teacher"
        | "staff"
        | "super_admin"
        | "reception"
        | "principal"
      fee_applicability: "All" | "NewAdmission" | "Existing" | "Optional"
      fee_frequency:
        | "Monthly"
        | "Quarterly"
        | "Annual"
        | "One Time"
        | "Optional"
      fee_payment_mode:
        | "Cash"
        | "Cheque"
        | "UPI"
        | "NEFT"
        | "RTGS"
        | "IMPS"
        | "Bank Transfer"
        | "Debit Card"
        | "Credit Card"
        | "QR Code"
      fee_schedule_status: "Pending" | "Partial" | "Paid" | "Waived"
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
      fee_applicability: ["All", "NewAdmission", "Existing", "Optional"],
      fee_frequency: ["Monthly", "Quarterly", "Annual", "One Time", "Optional"],
      fee_payment_mode: [
        "Cash",
        "Cheque",
        "UPI",
        "NEFT",
        "RTGS",
        "IMPS",
        "Bank Transfer",
        "Debit Card",
        "Credit Card",
        "QR Code",
      ],
      fee_schedule_status: ["Pending", "Partial", "Paid", "Waived"],
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
