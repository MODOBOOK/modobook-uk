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
      addon_links: {
        Row: {
          addon_id: string
          category_id: string | null
          created_at: string
          discount_amount: number | null
          discount_percent: number | null
          id: string
          treatment_id: string | null
        }
        Insert: {
          addon_id: string
          category_id?: string | null
          created_at?: string
          discount_amount?: number | null
          discount_percent?: number | null
          id?: string
          treatment_id?: string | null
        }
        Update: {
          addon_id?: string
          category_id?: string | null
          created_at?: string
          discount_amount?: number | null
          discount_percent?: number | null
          id?: string
          treatment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "addon_links_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "addons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "addon_links_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "treatment_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "addon_links_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      addons: {
        Row: {
          active: boolean
          created_at: string
          discount_amount: number | null
          discount_percent: number | null
          duration_min: number
          id: string
          name: string
          price_cents: number
          profile_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          discount_amount?: number | null
          discount_percent?: number | null
          duration_min?: number
          id?: string
          name: string
          price_cents?: number
          profile_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          discount_amount?: number | null
          discount_percent?: number | null
          duration_min?: number
          id?: string
          name?: string
          price_cents?: number
          profile_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "addons_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_log: {
        Row: {
          action: string
          actor_user_id: string
          created_at: string
          diff: Json | null
          id: string
          ip_hash: string | null
          reason: string | null
          target_profile_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_user_id: string
          created_at?: string
          diff?: Json | null
          id?: string
          ip_hash?: string | null
          reason?: string | null
          target_profile_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string
          created_at?: string
          diff?: Json | null
          id?: string
          ip_hash?: string | null
          reason?: string | null
          target_profile_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_target_profile_id_fkey"
            columns: ["target_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_broadcasts: {
        Row: {
          audience: string
          blocks: Json | null
          created_at: string
          cta_text: string | null
          cta_url: string | null
          id: string
          message: string
          recipient_count: number
          recipient_email: string | null
          sent_by: string | null
          subject: string
        }
        Insert: {
          audience: string
          blocks?: Json | null
          created_at?: string
          cta_text?: string | null
          cta_url?: string | null
          id?: string
          message: string
          recipient_count?: number
          recipient_email?: string | null
          sent_by?: string | null
          subject: string
        }
        Update: {
          audience?: string
          blocks?: Json | null
          created_at?: string
          cta_text?: string | null
          cta_url?: string | null
          id?: string
          message?: string
          recipient_count?: number
          recipient_email?: string | null
          sent_by?: string | null
          subject?: string
        }
        Relationships: []
      }
      admin_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          id: string
          invited_by: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
        }
        Relationships: []
      }
      aftercare_templates: {
        Row: {
          body_html: string
          category: string | null
          created_at: string
          delay_hours: number
          id: string
          is_system: boolean
          name: string
          profile_id: string | null
          show_on_public: boolean
          summary: string | null
          updated_at: string
        }
        Insert: {
          body_html?: string
          category?: string | null
          created_at?: string
          delay_hours?: number
          id?: string
          is_system?: boolean
          name: string
          profile_id?: string | null
          show_on_public?: boolean
          summary?: string | null
          updated_at?: string
        }
        Update: {
          body_html?: string
          category?: string | null
          created_at?: string
          delay_hours?: number
          id?: string
          is_system?: boolean
          name?: string
          profile_id?: string | null
          show_on_public?: boolean
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aftercare_templates_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_aftercare: {
        Row: {
          appointment_id: string
          body_html: string | null
          created_at: string
          id: string
          profile_id: string
          recipient_email: string | null
          recipient_phone: string | null
          send_at: string
          sent_at: string | null
          sent_via: Json
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          appointment_id: string
          body_html?: string | null
          created_at?: string
          id?: string
          profile_id: string
          recipient_email?: string | null
          recipient_phone?: string | null
          send_at: string
          sent_at?: string | null
          sent_via?: Json
          status?: string
          token?: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          body_html?: string | null
          created_at?: string
          id?: string
          profile_id?: string
          recipient_email?: string | null
          recipient_phone?: string | null
          send_at?: string
          sent_at?: string | null
          sent_via?: Json
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_aftercare_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_aftercare_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_consents: {
        Row: {
          appointment_id: string | null
          client_id: string | null
          consent_template_id: string
          created_at: string
          id: string
          profile_id: string
          referral_id: string | null
          signature_data: string | null
          signature_name: string | null
          signed_at: string | null
          signed_url: string | null
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          client_id?: string | null
          consent_template_id: string
          created_at?: string
          id?: string
          profile_id: string
          referral_id?: string | null
          signature_data?: string | null
          signature_name?: string | null
          signed_at?: string | null
          signed_url?: string | null
          status?: string
          token?: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          client_id?: string | null
          consent_template_id?: string
          created_at?: string
          id?: string
          profile_id?: string
          referral_id?: string | null
          signature_data?: string | null
          signature_name?: string | null
          signed_at?: string | null
          signed_url?: string | null
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_consents_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_consents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clinic_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_consents_consent_template_id_fkey"
            columns: ["consent_template_id"]
            isOneToOne: false
            referencedRelation: "consent_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_consents_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_consents_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "prescriber_referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_medical_forms: {
        Row: {
          appointment_id: string | null
          client_id: string | null
          created_at: string
          id: string
          last_reminder_at: string | null
          profile_id: string
          recipient_email: string | null
          recipient_phone: string | null
          reminder_count: number
          response: Json | null
          sent_via: Json
          status: string
          submitted_at: string | null
          template_id: string
          token: string
        }
        Insert: {
          appointment_id?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          last_reminder_at?: string | null
          profile_id: string
          recipient_email?: string | null
          recipient_phone?: string | null
          reminder_count?: number
          response?: Json | null
          sent_via?: Json
          status?: string
          submitted_at?: string | null
          template_id: string
          token?: string
        }
        Update: {
          appointment_id?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          last_reminder_at?: string | null
          profile_id?: string
          recipient_email?: string | null
          recipient_phone?: string | null
          reminder_count?: number
          response?: Json | null
          sent_via?: Json
          status?: string
          submitted_at?: string | null
          template_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_medical_forms_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_medical_forms_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clinic_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_medical_forms_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_medical_forms_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "medical_form_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_rebook_reminders_sent: {
        Row: {
          appointment_id: string
          kind: string
          sent_at: string
        }
        Insert: {
          appointment_id: string
          kind: string
          sent_at?: string
        }
        Update: {
          appointment_id?: string
          kind?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_rebook_reminders_sent_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_reminder_rules: {
        Row: {
          closing: string | null
          created_at: string
          enabled: boolean
          hours_before: number
          id: string
          intro: string | null
          profile_id: string
          subject: string | null
        }
        Insert: {
          closing?: string | null
          created_at?: string
          enabled?: boolean
          hours_before: number
          id?: string
          intro?: string | null
          profile_id: string
          subject?: string | null
        }
        Update: {
          closing?: string | null
          created_at?: string
          enabled?: boolean
          hours_before?: number
          id?: string
          intro?: string | null
          profile_id?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_reminder_rules_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_reminders_sent: {
        Row: {
          appointment_id: string
          rule_id: string
          sent_at: string
        }
        Insert: {
          appointment_id: string
          rule_id: string
          sent_at?: string
        }
        Update: {
          appointment_id?: string
          rule_id?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_reminders_sent_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_reminders_sent_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "appointment_reminder_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          addon_ids: string[] | null
          aftercare_html: string | null
          aftercare_sent_at: string | null
          allergies_text: string | null
          amount_paid_cents: number
          amount_refunded_cents: number
          base_amount: number | null
          checkout_completed_at: string | null
          checkout_discount_cents: number | null
          checkout_method: string | null
          checkout_notes: string | null
          clinic_visit_id: string | null
          consent_signed_url: string | null
          created_at: string
          created_by_practitioner: boolean | null
          deposit_due_at: string | null
          deposit_paid_at: string | null
          deposit_payment_link_id: string | null
          deposit_required_cents: number | null
          discount_amount: number | null
          discount_code_id: string | null
          end_time: string
          has_allergies: boolean
          id: string
          is_demo: boolean
          location_id: string | null
          manage_token: string | null
          model_slot_id: string | null
          notes: string | null
          package_purchase_id: string | null
          patient_address: Json | null
          patient_dob: string | null
          patient_email: string
          patient_name: string
          patient_phone: string | null
          patient_user_id: string | null
          payment_hold_expires_at: string | null
          payment_method: string | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          practitioner_id: string | null
          practitioner_notes: string | null
          profile_id: string
          reschedule_count: number
          scheduled_date: string
          start_time: string
          status: Database["public"]["Enums"]["appointment_status"] | null
          stripe_payment_intent_id: string | null
          surcharge_amount: number | null
          total_amount: number | null
          treatment_id: string | null
          treatment_name_snapshot: string | null
          treatment_price_snapshot: number | null
          updated_at: string
        }
        Insert: {
          addon_ids?: string[] | null
          aftercare_html?: string | null
          aftercare_sent_at?: string | null
          allergies_text?: string | null
          amount_paid_cents?: number
          amount_refunded_cents?: number
          base_amount?: number | null
          checkout_completed_at?: string | null
          checkout_discount_cents?: number | null
          checkout_method?: string | null
          checkout_notes?: string | null
          clinic_visit_id?: string | null
          consent_signed_url?: string | null
          created_at?: string
          created_by_practitioner?: boolean | null
          deposit_due_at?: string | null
          deposit_paid_at?: string | null
          deposit_payment_link_id?: string | null
          deposit_required_cents?: number | null
          discount_amount?: number | null
          discount_code_id?: string | null
          end_time: string
          has_allergies?: boolean
          id?: string
          is_demo?: boolean
          location_id?: string | null
          manage_token?: string | null
          model_slot_id?: string | null
          notes?: string | null
          package_purchase_id?: string | null
          patient_address?: Json | null
          patient_dob?: string | null
          patient_email: string
          patient_name: string
          patient_phone?: string | null
          patient_user_id?: string | null
          payment_hold_expires_at?: string | null
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          practitioner_id?: string | null
          practitioner_notes?: string | null
          profile_id: string
          reschedule_count?: number
          scheduled_date: string
          start_time: string
          status?: Database["public"]["Enums"]["appointment_status"] | null
          stripe_payment_intent_id?: string | null
          surcharge_amount?: number | null
          total_amount?: number | null
          treatment_id?: string | null
          treatment_name_snapshot?: string | null
          treatment_price_snapshot?: number | null
          updated_at?: string
        }
        Update: {
          addon_ids?: string[] | null
          aftercare_html?: string | null
          aftercare_sent_at?: string | null
          allergies_text?: string | null
          amount_paid_cents?: number
          amount_refunded_cents?: number
          base_amount?: number | null
          checkout_completed_at?: string | null
          checkout_discount_cents?: number | null
          checkout_method?: string | null
          checkout_notes?: string | null
          clinic_visit_id?: string | null
          consent_signed_url?: string | null
          created_at?: string
          created_by_practitioner?: boolean | null
          deposit_due_at?: string | null
          deposit_paid_at?: string | null
          deposit_payment_link_id?: string | null
          deposit_required_cents?: number | null
          discount_amount?: number | null
          discount_code_id?: string | null
          end_time?: string
          has_allergies?: boolean
          id?: string
          is_demo?: boolean
          location_id?: string | null
          manage_token?: string | null
          model_slot_id?: string | null
          notes?: string | null
          package_purchase_id?: string | null
          patient_address?: Json | null
          patient_dob?: string | null
          patient_email?: string
          patient_name?: string
          patient_phone?: string | null
          patient_user_id?: string | null
          payment_hold_expires_at?: string | null
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          practitioner_id?: string | null
          practitioner_notes?: string | null
          profile_id?: string
          reschedule_count?: number
          scheduled_date?: string
          start_time?: string
          status?: Database["public"]["Enums"]["appointment_status"] | null
          stripe_payment_intent_id?: string | null
          surcharge_amount?: number | null
          total_amount?: number | null
          treatment_id?: string | null
          treatment_name_snapshot?: string | null
          treatment_price_snapshot?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_clinic_visit_id_fkey"
            columns: ["clinic_visit_id"]
            isOneToOne: false
            referencedRelation: "prescriber_clinic_visits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_deposit_payment_link_id_fkey"
            columns: ["deposit_payment_link_id"]
            isOneToOne: false
            referencedRelation: "payment_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_discount_code_id_fkey"
            columns: ["discount_code_id"]
            isOneToOne: false
            referencedRelation: "discount_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_model_slot_id_fkey"
            columns: ["model_slot_id"]
            isOneToOne: false
            referencedRelation: "model_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_package_purchase_id_fkey"
            columns: ["package_purchase_id"]
            isOneToOne: false
            referencedRelation: "package_purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_practitioner_id_fkey"
            columns: ["practitioner_id"]
            isOneToOne: false
            referencedRelation: "practitioners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_overrides: {
        Row: {
          created_at: string
          date: string
          end_time: string
          id: string
          location_id: string | null
          profile_id: string
          slot_interval: number
          start_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          end_time: string
          id?: string
          location_id?: string | null
          profile_id: string
          slot_interval?: number
          start_time: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          end_time?: string
          id?: string
          location_id?: string | null
          profile_id?: string
          slot_interval?: number
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_overrides_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_overrides_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_rules: {
        Row: {
          created_at: string
          cycle_length: number
          day_of_week: number
          end_time: string
          id: string
          location_id: string | null
          practitioner_id: string | null
          profile_id: string
          slot_interval: number
          start_time: string
          updated_at: string
          weeks_mask: number
        }
        Insert: {
          created_at?: string
          cycle_length?: number
          day_of_week: number
          end_time: string
          id?: string
          location_id?: string | null
          practitioner_id?: string | null
          profile_id: string
          slot_interval?: number
          start_time: string
          updated_at?: string
          weeks_mask?: number
        }
        Update: {
          created_at?: string
          cycle_length?: number
          day_of_week?: number
          end_time?: string
          id?: string
          location_id?: string | null
          practitioner_id?: string | null
          profile_id?: string
          slot_interval?: number
          start_time?: string
          updated_at?: string
          weeks_mask?: number
        }
        Relationships: [
          {
            foreignKeyName: "availability_rules_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_rules_practitioner_id_fkey"
            columns: ["practitioner_id"]
            isOneToOne: false
            referencedRelation: "practitioners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_rules_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_dates: {
        Row: {
          created_at: string
          date: string
          id: string
          location_id: string | null
          profile_id: string
          reason: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          location_id?: string | null
          profile_id: string
          reason?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          location_id?: string | null
          profile_id?: string
          reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocked_dates_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_dates_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_times: {
        Row: {
          created_at: string
          date: string
          end_time: string
          id: string
          location_id: string | null
          profile_id: string
          reason: string | null
          start_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          end_time: string
          id?: string
          location_id?: string | null
          profile_id: string
          reason?: string | null
          start_time: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          end_time?: string
          id?: string
          location_id?: string | null
          profile_id?: string
          reason?: string | null
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocked_times_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_times_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      care_plans: {
        Row: {
          appointment_id: string | null
          assessment: string | null
          created_at: string
          follow_up: string | null
          id: string
          notes: string | null
          plan: string | null
          practitioner_profile_id: string
          prescriber_user_id: string
          referral_id: string
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          assessment?: string | null
          created_at?: string
          follow_up?: string | null
          id?: string
          notes?: string | null
          plan?: string | null
          practitioner_profile_id: string
          prescriber_user_id: string
          referral_id: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          assessment?: string | null
          created_at?: string
          follow_up?: string | null
          id?: string
          notes?: string | null
          plan?: string | null
          practitioner_profile_id?: string
          prescriber_user_id?: string
          referral_id?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_plans_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_plans_practitioner_profile_id_fkey"
            columns: ["practitioner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_plans_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "prescriber_referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      client_communications: {
        Row: {
          body: string | null
          channel: string
          client_id: string
          created_at: string
          direction: string
          id: string
          meta: Json
          profile_id: string
          status: string
          subject: string | null
        }
        Insert: {
          body?: string | null
          channel: string
          client_id: string
          created_at?: string
          direction?: string
          id?: string
          meta?: Json
          profile_id: string
          status?: string
          subject?: string | null
        }
        Update: {
          body?: string | null
          channel?: string
          client_id?: string
          created_at?: string
          direction?: string
          id?: string
          meta?: Json
          profile_id?: string
          status?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_communications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clinic_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_communications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_concerns: {
        Row: {
          client_id: string
          created_at: string
          id: string
          label: string
          notes: string | null
          profile_id: string
          resolved: boolean
          severity: string
          source: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          label: string
          notes?: string | null
          profile_id: string
          resolved?: boolean
          severity?: string
          source?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          label?: string
          notes?: string | null
          profile_id?: string
          resolved?: boolean
          severity?: string
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_concerns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clinic_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_concerns_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_files: {
        Row: {
          client_id: string
          created_at: string
          filename: string | null
          id: string
          kind: string
          profile_id: string
          url: string
        }
        Insert: {
          client_id: string
          created_at?: string
          filename?: string | null
          id?: string
          kind: string
          profile_id: string
          url: string
        }
        Update: {
          client_id?: string
          created_at?: string
          filename?: string | null
          id?: string
          kind?: string
          profile_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_files_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clinic_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_files_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_medications: {
        Row: {
          client_id: string
          created_at: string
          dose: string | null
          drug: string
          frequency: string | null
          id: string
          is_current: boolean
          notes: string | null
          prescriber: string | null
          profile_id: string
          route: string | null
          started_on: string | null
          stopped_on: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          dose?: string | null
          drug: string
          frequency?: string | null
          id?: string
          is_current?: boolean
          notes?: string | null
          prescriber?: string | null
          profile_id: string
          route?: string | null
          started_on?: string | null
          stopped_on?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          dose?: string | null
          drug?: string
          frequency?: string | null
          id?: string
          is_current?: boolean
          notes?: string | null
          prescriber?: string | null
          profile_id?: string
          route?: string | null
          started_on?: string | null
          stopped_on?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_medications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clinic_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_notes: {
        Row: {
          body: string
          client_id: string
          created_at: string
          face_map: Json | null
          id: string
          profile_id: string
          shared_at: string | null
          updated_at: string
          visible_to_patient: boolean
        }
        Insert: {
          body: string
          client_id: string
          created_at?: string
          face_map?: Json | null
          id?: string
          profile_id: string
          shared_at?: string | null
          updated_at?: string
          visible_to_patient?: boolean
        }
        Update: {
          body?: string
          client_id?: string
          created_at?: string
          face_map?: Json | null
          id?: string
          profile_id?: string
          shared_at?: string | null
          updated_at?: string
          visible_to_patient?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "client_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clinic_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_notes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_prescriptions: {
        Row: {
          client_id: string
          created_at: string
          directions: string | null
          dose: string | null
          form: string | null
          id: string
          notes: string | null
          patient_address_snapshot: string | null
          patient_dob: string | null
          pdf_url: string | null
          prescribed_on: string | null
          prescriber_address: string | null
          prescriber_name: string | null
          prescriber_reg_number: string | null
          product: string
          profile_id: string
          quantity: string | null
          route: string | null
          signature_url: string | null
          signed_at: string | null
          strength: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          directions?: string | null
          dose?: string | null
          form?: string | null
          id?: string
          notes?: string | null
          patient_address_snapshot?: string | null
          patient_dob?: string | null
          pdf_url?: string | null
          prescribed_on?: string | null
          prescriber_address?: string | null
          prescriber_name?: string | null
          prescriber_reg_number?: string | null
          product: string
          profile_id: string
          quantity?: string | null
          route?: string | null
          signature_url?: string | null
          signed_at?: string | null
          strength?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          directions?: string | null
          dose?: string | null
          form?: string | null
          id?: string
          notes?: string | null
          patient_address_snapshot?: string | null
          patient_dob?: string | null
          pdf_url?: string | null
          prescribed_on?: string | null
          prescriber_address?: string | null
          prescriber_name?: string | null
          prescriber_reg_number?: string | null
          product?: string
          profile_id?: string
          quantity?: string | null
          route?: string | null
          signature_url?: string | null
          signed_at?: string | null
          strength?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_prescriptions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clinic_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_prescriptions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_clients: {
        Row: {
          address: string | null
          address_line1: string | null
          address_line2: string | null
          allergies: string | null
          archived: boolean
          avatar_url: string | null
          block_reason: string | null
          blocked_at: string | null
          card_brand: string | null
          card_exp_month: number | null
          card_exp_year: number | null
          card_last4: string | null
          card_save_consent_at: string | null
          card_saved_at: string | null
          city: string | null
          country: string | null
          county: string | null
          created_at: string
          dob: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          erasure_reason: string | null
          erasure_requested_at: string | null
          full_name: string
          gender: string | null
          gp_address: string | null
          gp_details: Json | null
          gp_name: string | null
          group_name: string | null
          has_allergies: boolean
          how_heard: string | null
          id: string
          is_blocked: boolean
          is_demo: boolean
          marketing_opt_in: boolean
          marketing_opt_in_at: string | null
          marketing_opt_in_source: string | null
          medical_form_data: Json | null
          medical_form_updated_at: string | null
          no_show_count: number
          notes: string | null
          phone: string | null
          postcode: string | null
          preferred_contact: string | null
          profile_id: string
          safeguarding_flag: boolean
          safeguarding_note: string | null
          stripe_customer_id: string | null
          stripe_payment_method_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          address_line1?: string | null
          address_line2?: string | null
          allergies?: string | null
          archived?: boolean
          avatar_url?: string | null
          block_reason?: string | null
          blocked_at?: string | null
          card_brand?: string | null
          card_exp_month?: number | null
          card_exp_year?: number | null
          card_last4?: string | null
          card_save_consent_at?: string | null
          card_saved_at?: string | null
          city?: string | null
          country?: string | null
          county?: string | null
          created_at?: string
          dob?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          erasure_reason?: string | null
          erasure_requested_at?: string | null
          full_name: string
          gender?: string | null
          gp_address?: string | null
          gp_details?: Json | null
          gp_name?: string | null
          group_name?: string | null
          has_allergies?: boolean
          how_heard?: string | null
          id?: string
          is_blocked?: boolean
          is_demo?: boolean
          marketing_opt_in?: boolean
          marketing_opt_in_at?: string | null
          marketing_opt_in_source?: string | null
          medical_form_data?: Json | null
          medical_form_updated_at?: string | null
          no_show_count?: number
          notes?: string | null
          phone?: string | null
          postcode?: string | null
          preferred_contact?: string | null
          profile_id: string
          safeguarding_flag?: boolean
          safeguarding_note?: string | null
          stripe_customer_id?: string | null
          stripe_payment_method_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          address_line1?: string | null
          address_line2?: string | null
          allergies?: string | null
          archived?: boolean
          avatar_url?: string | null
          block_reason?: string | null
          blocked_at?: string | null
          card_brand?: string | null
          card_exp_month?: number | null
          card_exp_year?: number | null
          card_last4?: string | null
          card_save_consent_at?: string | null
          card_saved_at?: string | null
          city?: string | null
          country?: string | null
          county?: string | null
          created_at?: string
          dob?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          erasure_reason?: string | null
          erasure_requested_at?: string | null
          full_name?: string
          gender?: string | null
          gp_address?: string | null
          gp_details?: Json | null
          gp_name?: string | null
          group_name?: string | null
          has_allergies?: boolean
          how_heard?: string | null
          id?: string
          is_blocked?: boolean
          is_demo?: boolean
          marketing_opt_in?: boolean
          marketing_opt_in_at?: string | null
          marketing_opt_in_source?: string | null
          medical_form_data?: Json | null
          medical_form_updated_at?: string | null
          no_show_count?: number
          notes?: string | null
          phone?: string | null
          postcode?: string | null
          preferred_contact?: string | null
          profile_id?: string
          safeguarding_flag?: boolean
          safeguarding_note?: string | null
          stripe_customer_id?: string | null
          stripe_payment_method_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_clients_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_gallery: {
        Row: {
          caption: string | null
          created_at: string
          display_order: number | null
          id: string
          image_url: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          display_order?: number | null
          id?: string
          image_url: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          display_order?: number | null
          id?: string
          image_url?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_gallery_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_referral_settings: {
        Row: {
          clinic_profile_id: string
          created_at: string
          description: string | null
          earn_on_spend_enabled: boolean
          enabled: boolean
          friend_credit_kind: string
          friend_credit_pennies: number
          friend_credit_percent: number
          headline: string | null
          max_rewarded_per_year: number | null
          points_per_pound_earn: number
          points_per_pound_redeem: number
          points_redemption_enabled: boolean
          referrer_credit_kind: string
          referrer_credit_pennies: number
          referrer_credit_percent: number
          referrer_points: number
          show_on_public_page: boolean
          tiers_enabled: boolean
          trigger_event: string
          updated_at: string
        }
        Insert: {
          clinic_profile_id: string
          created_at?: string
          description?: string | null
          earn_on_spend_enabled?: boolean
          enabled?: boolean
          friend_credit_kind?: string
          friend_credit_pennies?: number
          friend_credit_percent?: number
          headline?: string | null
          max_rewarded_per_year?: number | null
          points_per_pound_earn?: number
          points_per_pound_redeem?: number
          points_redemption_enabled?: boolean
          referrer_credit_kind?: string
          referrer_credit_pennies?: number
          referrer_credit_percent?: number
          referrer_points?: number
          show_on_public_page?: boolean
          tiers_enabled?: boolean
          trigger_event?: string
          updated_at?: string
        }
        Update: {
          clinic_profile_id?: string
          created_at?: string
          description?: string | null
          earn_on_spend_enabled?: boolean
          enabled?: boolean
          friend_credit_kind?: string
          friend_credit_pennies?: number
          friend_credit_percent?: number
          headline?: string | null
          max_rewarded_per_year?: number | null
          points_per_pound_earn?: number
          points_per_pound_redeem?: number
          points_redemption_enabled?: boolean
          referrer_credit_kind?: string
          referrer_credit_pennies?: number
          referrer_credit_percent?: number
          referrer_points?: number
          show_on_public_page?: boolean
          tiers_enabled?: boolean
          trigger_event?: string
          updated_at?: string
        }
        Relationships: []
      }
      clinic_reward_tiers: {
        Row: {
          clinic_profile_id: string
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          label: string
          points_cost: number
          reward_kind: string
          reward_value: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          clinic_profile_id: string
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          label: string
          points_cost: number
          reward_kind?: string
          reward_value?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          clinic_profile_id?: string
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          label?: string
          points_cost?: number
          reward_kind?: string
          reward_value?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      clinic_testimonials: {
        Row: {
          author_name: string
          created_at: string
          display_order: number | null
          id: string
          profile_id: string
          quote: string
          rating: number | null
          updated_at: string
        }
        Insert: {
          author_name: string
          created_at?: string
          display_order?: number | null
          id?: string
          profile_id: string
          quote: string
          rating?: number | null
          updated_at?: string
        }
        Update: {
          author_name?: string
          created_at?: string
          display_order?: number | null
          id?: string
          profile_id?: string
          quote?: string
          rating?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_testimonials_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_theme: {
        Row: {
          accent_color: string
          background_color: string
          body_font: string
          button_color: string | null
          button_radius: string
          button_size: string
          button_text_color: string
          button_uppercase: boolean
          contact_tile_bg_color: string | null
          contact_tile_border_color: string | null
          contact_tile_icon_size: string
          contact_tile_layout: string
          created_at: string
          custom_css: string | null
          favicon_url: string | null
          footer_bg_color: string
          footer_text_color: string
          header_bg_color: string
          header_button_label: string
          header_logo_size: string
          header_show_name: boolean
          header_show_tagline: boolean
          header_sticky: boolean
          header_text_color: string
          heading_font: string
          hero_carousel_enabled: boolean | null
          hero_carousel_urls: Json | null
          hero_fit: string
          hero_heading: string | null
          hero_height: string
          hero_image_url: string | null
          hero_overlay_color: string
          hero_overlay_opacity: number
          hero_show_text: boolean
          hero_subheading: string | null
          hero_text_alignment: string
          hero_text_color: string | null
          hero_use_logo: boolean
          id: string
          layout_key: string | null
          logo_url: string | null
          menu_card_bg: string | null
          menu_card_border_color: string | null
          menu_category_bg: string | null
          menu_category_bold: boolean | null
          menu_category_text: string | null
          menu_price_color: string | null
          menu_treatment_bold: boolean | null
          menu_treatment_name_color: string | null
          menu_treatment_size: string | null
          page_density: string
          preset_key: string | null
          primary_color: string
          profile_id: string
          section_gap: string
          text_color: string
          updated_at: string
          welcome_card_background_type: string
          welcome_card_bg_color: string | null
          welcome_card_blur: number
          welcome_card_border_color: string | null
          welcome_card_border_radius: string | null
          welcome_card_border_width: string | null
          welcome_card_gradient_from: string | null
          welcome_card_gradient_to: string | null
          welcome_card_mobile_size: string
          welcome_card_opacity: number
          welcome_card_padding: string | null
          welcome_card_position: string
          welcome_card_shadow: string | null
          welcome_card_show_actions: boolean
          welcome_card_show_contact: boolean
          welcome_card_show_facebook: boolean
          welcome_card_show_instagram: boolean
          welcome_card_show_logo: boolean
          welcome_card_show_name: boolean
          welcome_card_show_rating: boolean
          welcome_card_show_sms: boolean
          welcome_card_show_tagline: boolean
          welcome_card_show_whatsapp: boolean
          welcome_card_size: string
        }
        Insert: {
          accent_color?: string
          background_color?: string
          body_font?: string
          button_color?: string | null
          button_radius?: string
          button_size?: string
          button_text_color?: string
          button_uppercase?: boolean
          contact_tile_bg_color?: string | null
          contact_tile_border_color?: string | null
          contact_tile_icon_size?: string
          contact_tile_layout?: string
          created_at?: string
          custom_css?: string | null
          favicon_url?: string | null
          footer_bg_color?: string
          footer_text_color?: string
          header_bg_color?: string
          header_button_label?: string
          header_logo_size?: string
          header_show_name?: boolean
          header_show_tagline?: boolean
          header_sticky?: boolean
          header_text_color?: string
          heading_font?: string
          hero_carousel_enabled?: boolean | null
          hero_carousel_urls?: Json | null
          hero_fit?: string
          hero_heading?: string | null
          hero_height?: string
          hero_image_url?: string | null
          hero_overlay_color?: string
          hero_overlay_opacity?: number
          hero_show_text?: boolean
          hero_subheading?: string | null
          hero_text_alignment?: string
          hero_text_color?: string | null
          hero_use_logo?: boolean
          id?: string
          layout_key?: string | null
          logo_url?: string | null
          menu_card_bg?: string | null
          menu_card_border_color?: string | null
          menu_category_bg?: string | null
          menu_category_bold?: boolean | null
          menu_category_text?: string | null
          menu_price_color?: string | null
          menu_treatment_bold?: boolean | null
          menu_treatment_name_color?: string | null
          menu_treatment_size?: string | null
          page_density?: string
          preset_key?: string | null
          primary_color?: string
          profile_id: string
          section_gap?: string
          text_color?: string
          updated_at?: string
          welcome_card_background_type?: string
          welcome_card_bg_color?: string | null
          welcome_card_blur?: number
          welcome_card_border_color?: string | null
          welcome_card_border_radius?: string | null
          welcome_card_border_width?: string | null
          welcome_card_gradient_from?: string | null
          welcome_card_gradient_to?: string | null
          welcome_card_mobile_size?: string
          welcome_card_opacity?: number
          welcome_card_padding?: string | null
          welcome_card_position?: string
          welcome_card_shadow?: string | null
          welcome_card_show_actions?: boolean
          welcome_card_show_contact?: boolean
          welcome_card_show_facebook?: boolean
          welcome_card_show_instagram?: boolean
          welcome_card_show_logo?: boolean
          welcome_card_show_name?: boolean
          welcome_card_show_rating?: boolean
          welcome_card_show_sms?: boolean
          welcome_card_show_tagline?: boolean
          welcome_card_show_whatsapp?: boolean
          welcome_card_size?: string
        }
        Update: {
          accent_color?: string
          background_color?: string
          body_font?: string
          button_color?: string | null
          button_radius?: string
          button_size?: string
          button_text_color?: string
          button_uppercase?: boolean
          contact_tile_bg_color?: string | null
          contact_tile_border_color?: string | null
          contact_tile_icon_size?: string
          contact_tile_layout?: string
          created_at?: string
          custom_css?: string | null
          favicon_url?: string | null
          footer_bg_color?: string
          footer_text_color?: string
          header_bg_color?: string
          header_button_label?: string
          header_logo_size?: string
          header_show_name?: boolean
          header_show_tagline?: boolean
          header_sticky?: boolean
          header_text_color?: string
          heading_font?: string
          hero_carousel_enabled?: boolean | null
          hero_carousel_urls?: Json | null
          hero_fit?: string
          hero_heading?: string | null
          hero_height?: string
          hero_image_url?: string | null
          hero_overlay_color?: string
          hero_overlay_opacity?: number
          hero_show_text?: boolean
          hero_subheading?: string | null
          hero_text_alignment?: string
          hero_text_color?: string | null
          hero_use_logo?: boolean
          id?: string
          layout_key?: string | null
          logo_url?: string | null
          menu_card_bg?: string | null
          menu_card_border_color?: string | null
          menu_category_bg?: string | null
          menu_category_bold?: boolean | null
          menu_category_text?: string | null
          menu_price_color?: string | null
          menu_treatment_bold?: boolean | null
          menu_treatment_name_color?: string | null
          menu_treatment_size?: string | null
          page_density?: string
          preset_key?: string | null
          primary_color?: string
          profile_id?: string
          section_gap?: string
          text_color?: string
          updated_at?: string
          welcome_card_background_type?: string
          welcome_card_bg_color?: string | null
          welcome_card_blur?: number
          welcome_card_border_color?: string | null
          welcome_card_border_radius?: string | null
          welcome_card_border_width?: string | null
          welcome_card_gradient_from?: string | null
          welcome_card_gradient_to?: string | null
          welcome_card_mobile_size?: string
          welcome_card_opacity?: number
          welcome_card_padding?: string | null
          welcome_card_position?: string
          welcome_card_shadow?: string | null
          welcome_card_show_actions?: boolean
          welcome_card_show_contact?: boolean
          welcome_card_show_facebook?: boolean
          welcome_card_show_instagram?: boolean
          welcome_card_show_logo?: boolean
          welcome_card_show_name?: boolean
          welcome_card_show_rating?: boolean
          welcome_card_show_sms?: boolean
          welcome_card_show_tagline?: boolean
          welcome_card_show_whatsapp?: boolean
          welcome_card_size?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_theme_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_entries: {
        Row: {
          campaign: string
          clinic_name: string
          consent_at: string
          consent_text: string
          created_at: string
          email: string
          full_name: string
          id: string
          instagram: string | null
          marketing_opt_in: boolean
          notes: string | null
          phone: string | null
          status: string
        }
        Insert: {
          campaign?: string
          clinic_name: string
          consent_at?: string
          consent_text: string
          created_at?: string
          email: string
          full_name: string
          id?: string
          instagram?: string | null
          marketing_opt_in?: boolean
          notes?: string | null
          phone?: string | null
          status?: string
        }
        Update: {
          campaign?: string
          clinic_name?: string
          consent_at?: string
          consent_text?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          instagram?: string | null
          marketing_opt_in?: boolean
          notes?: string | null
          phone?: string | null
          status?: string
        }
        Relationships: []
      }
      concern_areas: {
        Row: {
          created_at: string
          id: string
          name: string
          profile_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          profile_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          profile_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "concern_areas_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      concern_treatments: {
        Row: {
          concern_id: string
          profile_id: string
          sort_order: number
          treatment_id: string
        }
        Insert: {
          concern_id: string
          profile_id: string
          sort_order?: number
          treatment_id: string
        }
        Update: {
          concern_id?: string
          profile_id?: string
          sort_order?: number
          treatment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "concern_treatments_concern_id_fkey"
            columns: ["concern_id"]
            isOneToOne: false
            referencedRelation: "concerns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concern_treatments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concern_treatments_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      concerns: {
        Row: {
          area_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          profile_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          area_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          profile_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          area_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          profile_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "concerns_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "concern_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concerns_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_templates: {
        Row: {
          body_markdown: string
          created_at: string
          id: string
          is_system: boolean
          name: string
          profile_id: string | null
          requires_signature: boolean
          sections: Json | null
          summary: string | null
          treatment_type: string | null
          updated_at: string
        }
        Insert: {
          body_markdown?: string
          created_at?: string
          id?: string
          is_system?: boolean
          name: string
          profile_id?: string | null
          requires_signature?: boolean
          sections?: Json | null
          summary?: string | null
          treatment_type?: string | null
          updated_at?: string
        }
        Update: {
          body_markdown?: string
          created_at?: string
          id?: string
          is_system?: boolean
          name?: string
          profile_id?: string | null
          requires_signature?: boolean
          sections?: Json | null
          summary?: string | null
          treatment_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_templates_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      consultations: {
        Row: {
          after_photos: Json
          appointment_id: string | null
          assessment: Json
          before_photos: Json
          completed_at: string | null
          concerns: Json
          consent: Json
          created_at: string
          current_step: number
          has_allergies: boolean
          id: string
          invoice: Json
          medical: Json
          notes: string | null
          patient_email: string | null
          patient_id: string | null
          patient_name: string
          patient_phone: string | null
          profile_id: string
          status: string
          treatment_log: Json
          treatment_plan: Json
          updated_at: string
        }
        Insert: {
          after_photos?: Json
          appointment_id?: string | null
          assessment?: Json
          before_photos?: Json
          completed_at?: string | null
          concerns?: Json
          consent?: Json
          created_at?: string
          current_step?: number
          has_allergies?: boolean
          id?: string
          invoice?: Json
          medical?: Json
          notes?: string | null
          patient_email?: string | null
          patient_id?: string | null
          patient_name: string
          patient_phone?: string | null
          profile_id: string
          status?: string
          treatment_log?: Json
          treatment_plan?: Json
          updated_at?: string
        }
        Update: {
          after_photos?: Json
          appointment_id?: string | null
          assessment?: Json
          before_photos?: Json
          completed_at?: string | null
          concerns?: Json
          consent?: Json
          created_at?: string
          current_step?: number
          has_allergies?: boolean
          id?: string
          invoice?: Json
          medical?: Json
          notes?: string | null
          patient_email?: string | null
          patient_id?: string | null
          patient_name?: string
          patient_phone?: string | null
          profile_id?: string
          status?: string
          treatment_log?: Json
          treatment_plan?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultations_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "clinic_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      device_push_tokens: {
        Row: {
          created_at: string
          id: string
          last_seen_at: string
          platform: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_seen_at?: string
          platform: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_seen_at?: string
          platform?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      discount_codes: {
        Row: {
          active: boolean
          amount: number
          code: string
          created_at: string
          days_of_week: number[] | null
          ends_at: string | null
          id: string
          kind: string
          label: string | null
          max_uses: number | null
          profile_id: string
          starts_at: string | null
          treatment_ids: string[]
          updated_at: string
          uses_count: number
        }
        Insert: {
          active?: boolean
          amount: number
          code: string
          created_at?: string
          days_of_week?: number[] | null
          ends_at?: string | null
          id?: string
          kind?: string
          label?: string | null
          max_uses?: number | null
          profile_id: string
          starts_at?: string | null
          treatment_ids?: string[]
          updated_at?: string
          uses_count?: number
        }
        Update: {
          active?: boolean
          amount?: number
          code?: string
          created_at?: string
          days_of_week?: number[] | null
          ends_at?: string | null
          id?: string
          kind?: string
          label?: string | null
          max_uses?: number | null
          profile_id?: string
          starts_at?: string | null
          treatment_ids?: string[]
          updated_at?: string
          uses_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "discount_codes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_customizations: {
        Row: {
          body_override: string | null
          closing_override: string | null
          intro_override: string | null
          profile_id: string
          subject_override: string | null
          template_key: string
          updated_at: string
        }
        Insert: {
          body_override?: string | null
          closing_override?: string | null
          intro_override?: string | null
          profile_id: string
          subject_override?: string | null
          template_key: string
          updated_at?: string
        }
        Update: {
          body_override?: string | null
          closing_override?: string | null
          intro_override?: string | null
          profile_id?: string
          subject_override?: string | null
          template_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_customizations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body_html: string
          created_at: string
          id: string
          name: string
          profile_id: string
          sort_order: number
          subject: string
          updated_at: string
        }
        Insert: {
          body_html: string
          created_at?: string
          id?: string
          name: string
          profile_id: string
          sort_order?: number
          subject: string
          updated_at?: string
        }
        Update: {
          body_html?: string
          created_at?: string
          id?: string
          name?: string
          profile_id?: string
          sort_order?: number
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      gift_card_purchases: {
        Row: {
          buyer_email: string | null
          buyer_name: string | null
          code: string
          created_at: string
          delivered_at: string | null
          delivery: string
          expires_at: string | null
          gift_card_id: string | null
          id: string
          initial_amount: number
          kind: string
          message: string | null
          package_id: string | null
          package_ids: string[]
          profile_id: string
          recipient_email: string | null
          recipient_name: string | null
          remaining_amount: number
          status: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          treatment_id: string | null
          treatment_ids: string[]
          updated_at: string
        }
        Insert: {
          buyer_email?: string | null
          buyer_name?: string | null
          code: string
          created_at?: string
          delivered_at?: string | null
          delivery?: string
          expires_at?: string | null
          gift_card_id?: string | null
          id?: string
          initial_amount: number
          kind: string
          message?: string | null
          package_id?: string | null
          package_ids?: string[]
          profile_id: string
          recipient_email?: string | null
          recipient_name?: string | null
          remaining_amount: number
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          treatment_id?: string | null
          treatment_ids?: string[]
          updated_at?: string
        }
        Update: {
          buyer_email?: string | null
          buyer_name?: string | null
          code?: string
          created_at?: string
          delivered_at?: string | null
          delivery?: string
          expires_at?: string | null
          gift_card_id?: string | null
          id?: string
          initial_amount?: number
          kind?: string
          message?: string | null
          package_id?: string | null
          package_ids?: string[]
          profile_id?: string
          recipient_email?: string | null
          recipient_name?: string | null
          remaining_amount?: number
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          treatment_id?: string | null
          treatment_ids?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_card_purchases_gift_card_id_fkey"
            columns: ["gift_card_id"]
            isOneToOne: false
            referencedRelation: "gift_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_card_redemptions: {
        Row: {
          amount: number
          appointment_id: string | null
          created_at: string
          id: string
          profile_id: string
          purchase_id: string
        }
        Insert: {
          amount: number
          appointment_id?: string | null
          created_at?: string
          id?: string
          profile_id: string
          purchase_id: string
        }
        Update: {
          amount?: number
          appointment_id?: string | null
          created_at?: string
          id?: string
          profile_id?: string
          purchase_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_card_redemptions_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "gift_card_purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_cards: {
        Row: {
          active: boolean
          amount: number | null
          created_at: string
          description: string | null
          expires_months: number | null
          id: string
          image_url: string | null
          kind: string
          name: string
          package_id: string | null
          package_ids: string[]
          profile_id: string
          sort_order: number
          treatment_id: string | null
          treatment_ids: string[]
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount?: number | null
          created_at?: string
          description?: string | null
          expires_months?: number | null
          id?: string
          image_url?: string | null
          kind: string
          name: string
          package_id?: string | null
          package_ids?: string[]
          profile_id: string
          sort_order?: number
          treatment_id?: string | null
          treatment_ids?: string[]
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount?: number | null
          created_at?: string
          description?: string | null
          expires_months?: number | null
          id?: string
          image_url?: string | null
          kind?: string
          name?: string
          package_id?: string | null
          package_ids?: string[]
          profile_id?: string
          sort_order?: number
          treatment_id?: string | null
          treatment_ids?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_cards_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_cards_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_codes: {
        Row: {
          code: string
          created_at: string
          display_name: string | null
          owner_kind: Database["public"]["Enums"]["hub_owner_kind"]
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          display_name?: string | null
          owner_kind: Database["public"]["Enums"]["hub_owner_kind"]
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          display_name?: string | null
          owner_kind?: Database["public"]["Enums"]["hub_owner_kind"]
          user_id?: string
        }
        Relationships: []
      }
      hub_links: {
        Row: {
          created_at: string
          id: string
          recipient_user_id: string
          requester_note: string | null
          requester_user_id: string
          responded_at: string | null
          status: Database["public"]["Enums"]["hub_link_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          recipient_user_id: string
          requester_note?: string | null
          requester_user_id: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["hub_link_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          recipient_user_id?: string
          requester_note?: string | null
          requester_user_id?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["hub_link_status"]
          updated_at?: string
        }
        Relationships: []
      }
      location_practitioners: {
        Row: {
          created_at: string
          display_order: number
          location_id: string
          practitioner_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          location_id: string
          practitioner_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          location_id?: string
          practitioner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_practitioners_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_practitioners_practitioner_id_fkey"
            columns: ["practitioner_id"]
            isOneToOne: false
            referencedRelation: "practitioners"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          active: boolean
          address_line1: string | null
          address_line2: string | null
          city: string | null
          country: string | null
          created_at: string
          display_order: number
          id: string
          image_url: string | null
          is_primary: boolean
          is_public: boolean
          name: string
          notes: string | null
          phone: string | null
          postcode: string | null
          profile_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string | null
          is_primary?: boolean
          is_public?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          postcode?: string | null
          profile_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string | null
          is_primary?: boolean
          is_public?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          postcode?: string | null
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_automation_sends: {
        Row: {
          automation_id: string
          client_id: string
          created_at: string
          dedup_key: string
          error_message: string | null
          id: string
          message_id: string
          practitioner_id: string
          status: string
        }
        Insert: {
          automation_id: string
          client_id: string
          created_at?: string
          dedup_key: string
          error_message?: string | null
          id?: string
          message_id: string
          practitioner_id: string
          status?: string
        }
        Update: {
          automation_id?: string
          client_id?: string
          created_at?: string
          dedup_key?: string
          error_message?: string | null
          id?: string
          message_id?: string
          practitioner_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_automation_sends_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "marketing_automations"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_automations: {
        Row: {
          config: Json
          created_at: string
          enabled: boolean
          id: string
          last_run_at: string | null
          name: string
          practitioner_id: string
          segment_id: string | null
          template_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          name: string
          practitioner_id: string
          segment_id?: string | null
          template_id?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          name?: string
          practitioner_id?: string
          segment_id?: string | null
          template_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_automations_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "marketing_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_automations_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "marketing_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_campaign_recipients: {
        Row: {
          campaign_id: string
          client_id: string | null
          created_at: string
          email: string
          error_message: string | null
          id: string
          message_id: string
          practitioner_id: string
          status: string
        }
        Insert: {
          campaign_id: string
          client_id?: string | null
          created_at?: string
          email: string
          error_message?: string | null
          id?: string
          message_id: string
          practitioner_id: string
          status?: string
        }
        Update: {
          campaign_id?: string
          client_id?: string | null
          created_at?: string
          email?: string
          error_message?: string | null
          id?: string
          message_id?: string
          practitioner_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_campaign_recipients_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clinic_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_campaign_recipients_practitioner_id_fkey"
            columns: ["practitioner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_campaigns: {
        Row: {
          body_json: Json
          created_at: string
          failed_count: number
          id: string
          name: string
          practitioner_id: string
          preheader: string | null
          recipient_count: number
          scheduled_for: string | null
          segment_id: string | null
          sent_at: string | null
          sent_count: number
          status: string
          subject: string
          suppressed_count: number
          unsubscribed_count: number
          updated_at: string
        }
        Insert: {
          body_json?: Json
          created_at?: string
          failed_count?: number
          id?: string
          name: string
          practitioner_id: string
          preheader?: string | null
          recipient_count?: number
          scheduled_for?: string | null
          segment_id?: string | null
          sent_at?: string | null
          sent_count?: number
          status?: string
          subject?: string
          suppressed_count?: number
          unsubscribed_count?: number
          updated_at?: string
        }
        Update: {
          body_json?: Json
          created_at?: string
          failed_count?: number
          id?: string
          name?: string
          practitioner_id?: string
          preheader?: string | null
          recipient_count?: number
          scheduled_for?: string | null
          segment_id?: string | null
          sent_at?: string | null
          sent_count?: number
          status?: string
          subject?: string
          suppressed_count?: number
          unsubscribed_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_campaigns_practitioner_id_fkey"
            columns: ["practitioner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_campaigns_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "marketing_segments"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_segments: {
        Row: {
          created_at: string
          description: string | null
          id: string
          kind: string
          name: string
          practitioner_id: string
          rules: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          name: string
          practitioner_id: string
          rules?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          name?: string
          practitioner_id?: string
          rules?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_segments_practitioner_id_fkey"
            columns: ["practitioner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_templates: {
        Row: {
          body_json: Json
          created_at: string
          id: string
          name: string
          practitioner_id: string
          preheader: string | null
          subject: string
          updated_at: string
        }
        Insert: {
          body_json?: Json
          created_at?: string
          id?: string
          name: string
          practitioner_id: string
          preheader?: string | null
          subject?: string
          updated_at?: string
        }
        Update: {
          body_json?: Json
          created_at?: string
          id?: string
          name?: string
          practitioner_id?: string
          preheader?: string | null
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_templates_practitioner_id_fkey"
            columns: ["practitioner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_form_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          profile_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          profile_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          profile_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "medical_form_categories_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_form_templates: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          is_published: boolean
          is_system: boolean
          name: string
          profile_id: string | null
          schema: Json
          updated_at: string
          validity: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          is_system?: boolean
          name: string
          profile_id?: string | null
          schema?: Json
          updated_at?: string
          validity?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          is_system?: boolean
          name?: string
          profile_id?: string | null
          schema?: Json
          updated_at?: string
          validity?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_form_templates_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "medical_form_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_form_templates_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      model_slots: {
        Row: {
          active: boolean
          booked_appointment_id: string | null
          category: string | null
          created_at: string
          end_time: string | null
          id: string
          is_flexible: boolean
          location_id: string | null
          notes: string | null
          price_mode: string
          price_value: number
          profile_id: string
          slot_date: string | null
          start_time: string | null
          treatment_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          booked_appointment_id?: string | null
          category?: string | null
          created_at?: string
          end_time?: string | null
          id?: string
          is_flexible?: boolean
          location_id?: string | null
          notes?: string | null
          price_mode?: string
          price_value: number
          profile_id: string
          slot_date?: string | null
          start_time?: string | null
          treatment_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          booked_appointment_id?: string | null
          category?: string | null
          created_at?: string
          end_time?: string | null
          id?: string
          is_flexible?: boolean
          location_id?: string | null
          notes?: string | null
          price_mode?: string
          price_value?: number
          profile_id?: string
          slot_date?: string | null
          start_time?: string | null
          treatment_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "model_slots_booked_appointment_id_fkey"
            columns: ["booked_appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_slots_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_slots_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_slots_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          cleared_at: string | null
          created_at: string
          emoji: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          link: string | null
          profile_id: string
          read_at: string | null
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          cleared_at?: string | null
          created_at?: string
          emoji?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          link?: string | null
          profile_id: string
          read_at?: string | null
          title: string
          type: string
        }
        Update: {
          body?: string | null
          cleared_at?: string | null
          created_at?: string
          emoji?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          link?: string | null
          profile_id?: string
          read_at?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      package_purchases: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          package_id: string
          patient_email: string
          sessions_remaining: number
          status: string | null
          stripe_payment_intent_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          package_id: string
          patient_email: string
          sessions_remaining: number
          status?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          package_id?: string
          patient_email?: string
          sessions_remaining?: number
          status?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_purchases_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          active: boolean | null
          allow_split_payment: boolean
          category_id: string | null
          created_at: string
          description: string | null
          duration_minutes: number | null
          expiry_days: number | null
          id: string
          image_url: string | null
          name: string
          price: number
          profile_id: string
          session_count: number
          treatment_id: string | null
          treatment_ids: string[]
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          allow_split_payment?: boolean
          category_id?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          expiry_days?: number | null
          id?: string
          image_url?: string | null
          name: string
          price: number
          profile_id: string
          session_count: number
          treatment_id?: string | null
          treatment_ids?: string[]
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          allow_split_payment?: boolean
          category_id?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          expiry_days?: number | null
          id?: string
          image_url?: string | null
          name?: string
          price?: number
          profile_id?: string
          session_count?: number
          treatment_id?: string | null
          treatment_ids?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "packages_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "treatment_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packages_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packages_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_accounts: {
        Row: {
          client_id: string | null
          created_at: string
          email: string
          id: string
          profile_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          email: string
          id?: string
          profile_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          email?: string
          id?: string
          profile_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_accounts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clinic_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_accounts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_ai_briefs: {
        Row: {
          appointment_id: string | null
          brief: Json
          client_id: string
          created_at: string
          generated_at: string
          id: string
          profile_id: string
        }
        Insert: {
          appointment_id?: string | null
          brief: Json
          client_id: string
          created_at?: string
          generated_at?: string
          id?: string
          profile_id: string
        }
        Update: {
          appointment_id?: string | null
          brief?: Json
          client_id?: string
          created_at?: string
          generated_at?: string
          id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_ai_briefs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clinic_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_credit_ledger: {
        Row: {
          clinic_profile_id: string
          created_at: string
          delta_pennies: number
          id: string
          note: string | null
          patient_user_id: string
          reason: string
          ref_id: string | null
          ref_type: string | null
        }
        Insert: {
          clinic_profile_id: string
          created_at?: string
          delta_pennies: number
          id?: string
          note?: string | null
          patient_user_id: string
          reason: string
          ref_id?: string | null
          ref_type?: string | null
        }
        Update: {
          clinic_profile_id?: string
          created_at?: string
          delta_pennies?: number
          id?: string
          note?: string | null
          patient_user_id?: string
          reason?: string
          ref_id?: string | null
          ref_type?: string | null
        }
        Relationships: []
      }
      patient_points_ledger: {
        Row: {
          clinic_profile_id: string
          created_at: string
          delta: number
          id: string
          note: string | null
          patient_user_id: string
          reason: string
          ref_id: string | null
          ref_type: string | null
        }
        Insert: {
          clinic_profile_id: string
          created_at?: string
          delta: number
          id?: string
          note?: string | null
          patient_user_id: string
          reason: string
          ref_id?: string | null
          ref_type?: string | null
        }
        Update: {
          clinic_profile_id?: string
          created_at?: string
          delta?: number
          id?: string
          note?: string | null
          patient_user_id?: string
          reason?: string
          ref_id?: string | null
          ref_type?: string | null
        }
        Relationships: []
      }
      patient_practitioner_links: {
        Row: {
          created_at: string
          id: string
          patient_id: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          patient_id: string
          profile_id: string
        }
        Update: {
          created_at?: string
          id?: string
          patient_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_practitioner_links_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_practitioner_links_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_referral_codes: {
        Row: {
          clinic_profile_id: string
          code: string
          created_at: string
          id: string
          patient_user_id: string
        }
        Insert: {
          clinic_profile_id: string
          code: string
          created_at?: string
          id?: string
          patient_user_id: string
        }
        Update: {
          clinic_profile_id?: string
          code?: string
          created_at?: string
          id?: string
          patient_user_id?: string
        }
        Relationships: []
      }
      patient_referrals: {
        Row: {
          clinic_profile_id: string
          code: string
          created_at: string
          friend_credit_pennies: number
          id: string
          referred_appointment_id: string | null
          referred_client_id: string | null
          referred_email: string | null
          referred_phone: string | null
          referrer_user_id: string
          rejected_reason: string | null
          reward_credit_pennies: number
          reward_points: number
          rewarded_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          clinic_profile_id: string
          code: string
          created_at?: string
          friend_credit_pennies?: number
          id?: string
          referred_appointment_id?: string | null
          referred_client_id?: string | null
          referred_email?: string | null
          referred_phone?: string | null
          referrer_user_id: string
          rejected_reason?: string | null
          reward_credit_pennies?: number
          reward_points?: number
          rewarded_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          clinic_profile_id?: string
          code?: string
          created_at?: string
          friend_credit_pennies?: number
          id?: string
          referred_appointment_id?: string | null
          referred_client_id?: string | null
          referred_email?: string | null
          referred_phone?: string | null
          referrer_user_id?: string
          rejected_reason?: string | null
          reward_credit_pennies?: number
          reward_points?: number
          rewarded_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      patient_reviews: {
        Row: {
          appointment_id: string | null
          approved: boolean
          body: string
          created_at: string
          id: string
          patient_id: string | null
          profile_id: string
          rating: number
          reviewer_email: string | null
          reviewer_name: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          approved?: boolean
          body: string
          created_at?: string
          id?: string
          patient_id?: string | null
          profile_id: string
          rating: number
          reviewer_email?: string | null
          reviewer_name?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          approved?: boolean
          body?: string
          created_at?: string
          id?: string
          patient_id?: string | null
          profile_id?: string
          rating?: number
          reviewer_email?: string | null
          reviewer_name?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_reviews_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_reviews_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_reviews_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_timeline_manual_events: {
        Row: {
          body: string | null
          client_id: string
          created_at: string
          id: string
          kind: string
          occurred_at: string
          profile_id: string
          shared_with_patient: boolean
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          client_id: string
          created_at?: string
          id?: string
          kind?: string
          occurred_at?: string
          profile_id: string
          shared_with_patient?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          client_id?: string
          created_at?: string
          id?: string
          kind?: string
          occurred_at?: string
          profile_id?: string
          shared_with_patient?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_timeline_manual_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clinic_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          country: string | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          full_name: string
          id: string
          phone: string | null
          postcode: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          postcode?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          postcode?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_links: {
        Row: {
          amount_cents: number
          appointment_id: string | null
          created_at: string
          currency: string
          description: string | null
          expires_at: string | null
          id: string
          kind: string
          paid_at: string | null
          profile_id: string
          recipient_email: string | null
          recipient_name: string | null
          status: string
          stripe_payment_intent_id: string | null
          stripe_payment_link_id: string | null
          stripe_url: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          appointment_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          kind?: string
          paid_at?: string | null
          profile_id: string
          recipient_email?: string | null
          recipient_name?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_payment_link_id?: string | null
          stripe_url?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          appointment_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          kind?: string
          paid_at?: string | null
          profile_id?: string
          recipient_email?: string | null
          recipient_name?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_payment_link_id?: string | null
          stripe_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_links_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          appointment_id: string | null
          created_at: string
          id: string
          package_purchase_id: string | null
          profile_id: string
          status: string | null
          stripe_payment_intent_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          appointment_id?: string | null
          created_at?: string
          id?: string
          package_purchase_id?: string | null
          profile_id: string
          status?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          appointment_id?: string | null
          created_at?: string
          id?: string
          package_purchase_id?: string | null
          profile_id?: string
          status?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_package_purchase_id_fkey"
            columns: ["package_purchase_id"]
            isOneToOne: false
            referencedRelation: "package_purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      phi_access_log: {
        Row: {
          action: string
          actor_role: string | null
          actor_user_id: string | null
          client_id: string | null
          created_at: string
          id: string
          profile_id: string
          row_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          actor_role?: string | null
          actor_user_id?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          profile_id: string
          row_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor_role?: string | null
          actor_user_id?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          profile_id?: string
          row_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      platform_discount_codes: {
        Row: {
          active: boolean
          amount_off_cents: number | null
          code: string
          created_at: string
          currency: string
          description: string | null
          duration: string
          duration_in_months: number | null
          expires_at: string | null
          id: string
          max_redemptions: number | null
          percent_off: number | null
          redemptions: number
          stripe_coupon_id: string | null
          stripe_promo_code_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount_off_cents?: number | null
          code: string
          created_at?: string
          currency?: string
          description?: string | null
          duration?: string
          duration_in_months?: number | null
          expires_at?: string | null
          id?: string
          max_redemptions?: number | null
          percent_off?: number | null
          redemptions?: number
          stripe_coupon_id?: string | null
          stripe_promo_code_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount_off_cents?: number | null
          code?: string
          created_at?: string
          currency?: string
          description?: string | null
          duration?: string
          duration_in_months?: number | null
          expires_at?: string | null
          id?: string
          max_redemptions?: number | null
          percent_off?: number | null
          redemptions?: number
          stripe_coupon_id?: string | null
          stripe_promo_code_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      platform_email_customizations: {
        Row: {
          closing_override: string | null
          created_at: string
          id: string
          intro_override: string | null
          subject_override: string | null
          template_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          closing_override?: string | null
          created_at?: string
          id?: string
          intro_override?: string | null
          subject_override?: string | null
          template_key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          closing_override?: string | null
          created_at?: string
          id?: string
          intro_override?: string | null
          subject_override?: string | null
          template_key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      platform_invoices: {
        Row: {
          amount_due_cents: number
          amount_paid_cents: number
          amount_remaining_cents: number
          attempt_count: number
          created_at: string
          currency: string
          due_date: string | null
          hosted_invoice_url: string | null
          id: string
          invoice_pdf: string | null
          last_payment_error: string | null
          number: string | null
          paid_at: string | null
          period_end: string | null
          period_start: string | null
          profile_id: string
          status: string
          stripe_customer_id: string | null
          stripe_invoice_id: string
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          amount_due_cents?: number
          amount_paid_cents?: number
          amount_remaining_cents?: number
          attempt_count?: number
          created_at?: string
          currency?: string
          due_date?: string | null
          hosted_invoice_url?: string | null
          id?: string
          invoice_pdf?: string | null
          last_payment_error?: string | null
          number?: string | null
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          profile_id: string
          status: string
          stripe_customer_id?: string | null
          stripe_invoice_id: string
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_due_cents?: number
          amount_paid_cents?: number
          amount_remaining_cents?: number
          attempt_count?: number
          created_at?: string
          currency?: string
          due_date?: string | null
          hosted_invoice_url?: string | null
          id?: string
          invoice_pdf?: string | null
          last_payment_error?: string | null
          number?: string | null
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          profile_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_invoice_id?: string
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_invoices_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_terms: {
        Row: {
          body_markdown: string
          created_at: string
          effective_at: string
          id: string
          is_active: boolean
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          body_markdown: string
          created_at?: string
          effective_at?: string
          id?: string
          is_active?: boolean
          title: string
          updated_at?: string
          version: number
        }
        Update: {
          body_markdown?: string
          created_at?: string
          effective_at?: string
          id?: string
          is_active?: boolean
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      platform_terms_acceptances: {
        Row: {
          accepted_at: string
          context: string | null
          created_at: string
          id: string
          ip_hash: string | null
          terms_id: string
          terms_version: number
          user_agent: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string
          context?: string | null
          created_at?: string
          id?: string
          ip_hash?: string | null
          terms_id: string
          terms_version: number
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string
          context?: string | null
          created_at?: string
          id?: string
          ip_hash?: string | null
          terms_id?: string
          terms_version?: number
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_terms_acceptances_terms_id_fkey"
            columns: ["terms_id"]
            isOneToOne: false
            referencedRelation: "platform_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      practitioner_subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          comped: boolean
          created_at: string
          current_period_end: string | null
          custom_price_cents: number | null
          discount_code_id: string | null
          extra_locations: number
          extra_practitioners: number
          id: string
          notes: string | null
          plan_id: string | null
          profile_id: string
          status: string
          stripe_addon_items: Json
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          suspended_at: string | null
          trial_end: string | null
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          comped?: boolean
          created_at?: string
          current_period_end?: string | null
          custom_price_cents?: number | null
          discount_code_id?: string | null
          extra_locations?: number
          extra_practitioners?: number
          id?: string
          notes?: string | null
          plan_id?: string | null
          profile_id: string
          status?: string
          stripe_addon_items?: Json
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          suspended_at?: string | null
          trial_end?: string | null
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          comped?: boolean
          created_at?: string
          current_period_end?: string | null
          custom_price_cents?: number | null
          discount_code_id?: string | null
          extra_locations?: number
          extra_practitioners?: number
          id?: string
          notes?: string | null
          plan_id?: string | null
          profile_id?: string
          status?: string
          stripe_addon_items?: Json
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          suspended_at?: string | null
          trial_end?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "practitioner_subscriptions_discount_code_id_fkey"
            columns: ["discount_code_id"]
            isOneToOne: false
            referencedRelation: "platform_discount_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practitioner_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practitioner_subscriptions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      practitioner_waitlist: {
        Row: {
          clinic_name: string | null
          consent_at: string | null
          consent_text: string | null
          created_at: string
          email: string
          id: string
          name: string | null
          role: string | null
          source: string | null
        }
        Insert: {
          clinic_name?: string | null
          consent_at?: string | null
          consent_text?: string | null
          created_at?: string
          email: string
          id?: string
          name?: string | null
          role?: string | null
          source?: string | null
        }
        Update: {
          clinic_name?: string | null
          consent_at?: string | null
          consent_text?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          role?: string | null
          source?: string | null
        }
        Relationships: []
      }
      practitioners: {
        Row: {
          active: boolean
          bio: string | null
          created_at: string
          display_order: number
          id: string
          name: string
          photo_url: string | null
          professional_title: string | null
          profile_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          bio?: string | null
          created_at?: string
          display_order?: number
          id?: string
          name: string
          photo_url?: string | null
          professional_title?: string | null
          profile_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          bio?: string | null
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          photo_url?: string | null
          professional_title?: string | null
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "practitioners_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      prescriber_billing_practitioners: {
        Row: {
          address_lines: string[]
          clinic_name: string | null
          created_at: string
          default_rate_cents: number
          email: string
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          prescriber_user_id: string
          updated_at: string
        }
        Insert: {
          address_lines?: string[]
          clinic_name?: string | null
          created_at?: string
          default_rate_cents?: number
          email: string
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          prescriber_user_id: string
          updated_at?: string
        }
        Update: {
          address_lines?: string[]
          clinic_name?: string | null
          created_at?: string
          default_rate_cents?: number
          email?: string
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          prescriber_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      prescriber_clinic_visits: {
        Row: {
          capacity: number
          confirmed_by_prescriber: boolean
          created_at: string
          created_by: string
          end_time: string
          id: string
          location_id: string | null
          notes: string | null
          practitioner_profile_id: string
          prescriber_label: string | null
          prescriber_user_id: string | null
          price: number | null
          recurrence_group: string | null
          start_time: string
          status: string
          treatment_id: string | null
          updated_at: string
          visit_date: string
        }
        Insert: {
          capacity?: number
          confirmed_by_prescriber?: boolean
          created_at?: string
          created_by?: string
          end_time: string
          id?: string
          location_id?: string | null
          notes?: string | null
          practitioner_profile_id: string
          prescriber_label?: string | null
          prescriber_user_id?: string | null
          price?: number | null
          recurrence_group?: string | null
          start_time: string
          status?: string
          treatment_id?: string | null
          updated_at?: string
          visit_date: string
        }
        Update: {
          capacity?: number
          confirmed_by_prescriber?: boolean
          created_at?: string
          created_by?: string
          end_time?: string
          id?: string
          location_id?: string | null
          notes?: string | null
          practitioner_profile_id?: string
          prescriber_label?: string | null
          prescriber_user_id?: string | null
          price?: number | null
          recurrence_group?: string | null
          start_time?: string
          status?: string
          treatment_id?: string | null
          updated_at?: string
          visit_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescriber_clinic_visits_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriber_clinic_visits_practitioner_profile_id_fkey"
            columns: ["practitioner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriber_clinic_visits_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      prescriber_invoices: {
        Row: {
          created_at: string
          currency: string
          due_date: string | null
          id: string
          invoice_number: string
          items: Json
          notes: string | null
          paid_at: string | null
          practitioner_id: string
          prescriber_user_id: string
          sent_at: string | null
          status: string
          stripe_payment_link_id: string | null
          stripe_url: string | null
          subtotal_cents: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          due_date?: string | null
          id?: string
          invoice_number: string
          items?: Json
          notes?: string | null
          paid_at?: string | null
          practitioner_id: string
          prescriber_user_id: string
          sent_at?: string | null
          status?: string
          stripe_payment_link_id?: string | null
          stripe_url?: string | null
          subtotal_cents?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          due_date?: string | null
          id?: string
          invoice_number?: string
          items?: Json
          notes?: string | null
          paid_at?: string | null
          practitioner_id?: string
          prescriber_user_id?: string
          sent_at?: string | null
          status?: string
          stripe_payment_link_id?: string | null
          stripe_url?: string | null
          subtotal_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescriber_invoices_practitioner_id_fkey"
            columns: ["practitioner_id"]
            isOneToOne: false
            referencedRelation: "prescriber_billing_practitioners"
            referencedColumns: ["id"]
          },
        ]
      }
      prescriber_profiles: {
        Row: {
          admin_note: string | null
          created_at: string
          full_name: string
          id: string
          id_document_path: string | null
          registration_number: string
          regulatory_body: string
          regulatory_body_other: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["prescriber_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          full_name: string
          id?: string
          id_document_path?: string | null
          registration_number: string
          regulatory_body: string
          regulatory_body_other?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["prescriber_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          full_name?: string
          id?: string
          id_document_path?: string | null
          registration_number?: string
          regulatory_body?: string
          regulatory_body_other?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["prescriber_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      prescriber_referrals: {
        Row: {
          accepted_at: string | null
          appointment_id: string | null
          awaiting_practitioner_close: boolean
          client_id: string | null
          clinic_visit_id: string | null
          closed_by_practitioner_at: string | null
          consent_given_at: string | null
          created_at: string
          declined_at: string | null
          id: string
          is_walk_in: boolean
          notes: string | null
          patient_dob: string | null
          patient_email: string | null
          patient_name: string | null
          patient_phone: string | null
          practitioner_profile_id: string
          prescriber_user_id: string
          routing: string
          status: string
          treatment_id: string | null
          updated_at: string
          walk_in_note: string | null
        }
        Insert: {
          accepted_at?: string | null
          appointment_id?: string | null
          awaiting_practitioner_close?: boolean
          client_id?: string | null
          clinic_visit_id?: string | null
          closed_by_practitioner_at?: string | null
          consent_given_at?: string | null
          created_at?: string
          declined_at?: string | null
          id?: string
          is_walk_in?: boolean
          notes?: string | null
          patient_dob?: string | null
          patient_email?: string | null
          patient_name?: string | null
          patient_phone?: string | null
          practitioner_profile_id: string
          prescriber_user_id: string
          routing?: string
          status?: string
          treatment_id?: string | null
          updated_at?: string
          walk_in_note?: string | null
        }
        Update: {
          accepted_at?: string | null
          appointment_id?: string | null
          awaiting_practitioner_close?: boolean
          client_id?: string | null
          clinic_visit_id?: string | null
          closed_by_practitioner_at?: string | null
          consent_given_at?: string | null
          created_at?: string
          declined_at?: string | null
          id?: string
          is_walk_in?: boolean
          notes?: string | null
          patient_dob?: string | null
          patient_email?: string | null
          patient_name?: string | null
          patient_phone?: string | null
          practitioner_profile_id?: string
          prescriber_user_id?: string
          routing?: string
          status?: string
          treatment_id?: string | null
          updated_at?: string
          walk_in_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prescriber_referrals_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriber_referrals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clinic_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriber_referrals_clinic_visit_id_fkey"
            columns: ["clinic_visit_id"]
            isOneToOne: false
            referencedRelation: "prescriber_clinic_visits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriber_referrals_practitioner_profile_id_fkey"
            columns: ["practitioner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriber_referrals_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      prescribing_rx_templates: {
        Row: {
          created_at: string
          directions: string | null
          dose: string | null
          drug_form: string | null
          drug_name: string
          drug_strength: string | null
          id: string
          label: string
          notes: string | null
          prescriber_user_id: string
          quantity: string | null
          repeats_allowed: number
          sort_order: number
          updated_at: string
          validity_days: number | null
        }
        Insert: {
          created_at?: string
          directions?: string | null
          dose?: string | null
          drug_form?: string | null
          drug_name: string
          drug_strength?: string | null
          id?: string
          label: string
          notes?: string | null
          prescriber_user_id: string
          quantity?: string | null
          repeats_allowed?: number
          sort_order?: number
          updated_at?: string
          validity_days?: number | null
        }
        Update: {
          created_at?: string
          directions?: string | null
          dose?: string | null
          drug_form?: string | null
          drug_name?: string
          drug_strength?: string | null
          id?: string
          label?: string
          notes?: string | null
          prescriber_user_id?: string
          quantity?: string | null
          repeats_allowed?: number
          sort_order?: number
          updated_at?: string
          validity_days?: number | null
        }
        Relationships: []
      }
      prescribing_snippets: {
        Row: {
          body: string
          category: string | null
          created_at: string
          id: string
          label: string
          prescriber_user_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          body: string
          category?: string | null
          created_at?: string
          id?: string
          label: string
          prescriber_user_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          body?: string
          category?: string | null
          created_at?: string
          id?: string
          label?: string
          prescriber_user_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      prescription_request_attachments: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          kind: string
          mime_type: string | null
          request_id: string
          size_bytes: number | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          kind: string
          mime_type?: string | null
          request_id: string
          size_bytes?: number | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          kind?: string
          mime_type?: string | null
          request_id?: string
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prescription_request_attachments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "prescription_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      prescription_request_events: {
        Row: {
          actor_id: string | null
          actor_role: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["rx_event_kind"]
          meta: Json
          request_id: string
          summary: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["rx_event_kind"]
          meta?: Json
          request_id: string
          summary?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["rx_event_kind"]
          meta?: Json
          request_id?: string
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prescription_request_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "prescription_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      prescription_requests: {
        Row: {
          appointment_id: string | null
          approved_prescription_id: string | null
          area: string | null
          batch_number: string | null
          clinical_notes: string | null
          consent_id: string | null
          consultation_id: string | null
          created_at: string
          decided_at: string | null
          decline_reason: string | null
          dose: string | null
          expires_at: string | null
          first_response_at: string | null
          id: string
          info_request_note: string | null
          medical_history: Json
          patient_id: string | null
          patient_snapshot: Json
          practitioner_id: string
          prescriber_comments: string | null
          prescriber_id: string
          product_name: string | null
          status: Database["public"]["Enums"]["rx_request_status"]
          treatment_name: string
          units: string | null
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          approved_prescription_id?: string | null
          area?: string | null
          batch_number?: string | null
          clinical_notes?: string | null
          consent_id?: string | null
          consultation_id?: string | null
          created_at?: string
          decided_at?: string | null
          decline_reason?: string | null
          dose?: string | null
          expires_at?: string | null
          first_response_at?: string | null
          id?: string
          info_request_note?: string | null
          medical_history?: Json
          patient_id?: string | null
          patient_snapshot?: Json
          practitioner_id: string
          prescriber_comments?: string | null
          prescriber_id: string
          product_name?: string | null
          status?: Database["public"]["Enums"]["rx_request_status"]
          treatment_name: string
          units?: string | null
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          approved_prescription_id?: string | null
          area?: string | null
          batch_number?: string | null
          clinical_notes?: string | null
          consent_id?: string | null
          consultation_id?: string | null
          created_at?: string
          decided_at?: string | null
          decline_reason?: string | null
          dose?: string | null
          expires_at?: string | null
          first_response_at?: string | null
          id?: string
          info_request_note?: string | null
          medical_history?: Json
          patient_id?: string | null
          patient_snapshot?: Json
          practitioner_id?: string
          prescriber_comments?: string | null
          prescriber_id?: string
          product_name?: string | null
          status?: Database["public"]["Enums"]["rx_request_status"]
          treatment_name?: string
          units?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescription_requests_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescription_requests_approved_prescription_id_fkey"
            columns: ["approved_prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescription_requests_consent_id_fkey"
            columns: ["consent_id"]
            isOneToOne: false
            referencedRelation: "appointment_consents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescription_requests_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescription_requests_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "clinic_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      prescriptions: {
        Row: {
          appointment_id: string | null
          clinic_address: string | null
          clinic_logo_url: string | null
          clinic_name: string | null
          created_at: string
          directions: string
          dose: string
          drug_form: string | null
          drug_name: string
          drug_strength: string | null
          id: string
          notes: string | null
          patient_address: string | null
          patient_dob: string | null
          patient_name: string
          pdf_path: string | null
          pdf_url: string | null
          practitioner_profile_id: string
          prescriber_address: string | null
          prescriber_name: string
          prescriber_reg_body: string | null
          prescriber_reg_number: string | null
          prescriber_user_id: string
          quantity: string
          referral_id: string
          repeats_allowed: number
          rx_type: string
          signature_data: string | null
          signature_name: string | null
          signed_at: string | null
          status: string
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          appointment_id?: string | null
          clinic_address?: string | null
          clinic_logo_url?: string | null
          clinic_name?: string | null
          created_at?: string
          directions: string
          dose: string
          drug_form?: string | null
          drug_name: string
          drug_strength?: string | null
          id?: string
          notes?: string | null
          patient_address?: string | null
          patient_dob?: string | null
          patient_name: string
          pdf_path?: string | null
          pdf_url?: string | null
          practitioner_profile_id: string
          prescriber_address?: string | null
          prescriber_name: string
          prescriber_reg_body?: string | null
          prescriber_reg_number?: string | null
          prescriber_user_id: string
          quantity: string
          referral_id: string
          repeats_allowed?: number
          rx_type?: string
          signature_data?: string | null
          signature_name?: string | null
          signed_at?: string | null
          status?: string
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          appointment_id?: string | null
          clinic_address?: string | null
          clinic_logo_url?: string | null
          clinic_name?: string | null
          created_at?: string
          directions?: string
          dose?: string
          drug_form?: string | null
          drug_name?: string
          drug_strength?: string | null
          id?: string
          notes?: string | null
          patient_address?: string | null
          patient_dob?: string | null
          patient_name?: string
          pdf_path?: string | null
          pdf_url?: string | null
          practitioner_profile_id?: string
          prescriber_address?: string | null
          prescriber_name?: string
          prescriber_reg_body?: string | null
          prescriber_reg_number?: string | null
          prescriber_user_id?: string
          quantity?: string
          referral_id?: string
          repeats_allowed?: number
          rx_type?: string
          signature_data?: string | null
          signature_name?: string | null
          signed_at?: string | null
          status?: string
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_practitioner_profile_id_fkey"
            columns: ["practitioner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "prescriber_referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      pretreatment_templates: {
        Row: {
          active: boolean
          body_html: string
          bullets: Json
          category: string
          created_at: string
          id: string
          name: string
          profile_id: string
          show_on_public: boolean
          sort_order: number
          summary: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          body_html?: string
          bullets?: Json
          category?: string
          created_at?: string
          id?: string
          name: string
          profile_id: string
          show_on_public?: boolean
          sort_order?: number
          summary?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          body_html?: string
          bullets?: Json
          category?: string
          created_at?: string
          id?: string
          name?: string
          profile_id?: string
          show_on_public?: boolean
          sort_order?: number
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pretreatment_templates_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          about: string | null
          about_page: Json
          active: boolean | null
          address: Json | null
          allow_patient_cancel: boolean
          allow_patient_reschedule: boolean
          allow_pay_in_clinic: boolean
          auto_confirm_bookings: boolean
          avatar_url: string | null
          bio: string | null
          booking_buffer_after_minutes: number
          booking_buffer_before_minutes: number
          booking_daily_cap: number | null
          booking_max_lead_days: number
          booking_min_notice_hours: number
          booking_smart_times_enabled: boolean
          brand_color: string | null
          cancellation_rules: Json | null
          cash_only_balance: boolean
          chooser_consultation_treatment_id: string | null
          chooser_consultation_treatment_ids: string[]
          chooser_enabled: boolean
          chooser_extra_body: string | null
          chooser_extra_enabled: boolean
          chooser_extra_title: string | null
          chooser_extra_treatment_ids: string[]
          chooser_intro_text: string | null
          chooser_show_consultation: boolean
          chooser_show_know: boolean
          chooser_show_unsure: boolean
          clinic_name: string | null
          contact_sms_number: string | null
          contact_whatsapp_number: string | null
          created_at: string
          deletion_requested_at: string | null
          deposit_amount_cents: number | null
          deposit_percent: number
          deposit_policy_text: string | null
          deposit_type: string
          discount_stack_mode: string
          display_name_mode: string
          email: string | null
          email_confirmations_enabled: boolean
          enforce_cancellation_fee: boolean
          favourite_treatment_ids: string[]
          favourites_custom_title: string | null
          favourites_enabled: boolean
          full_name: string | null
          hero_url: string | null
          id: string
          invoice_account_name: string | null
          invoice_account_number: string | null
          invoice_bank_name: string | null
          invoice_company_number: string | null
          invoice_footer_notes: string | null
          invoice_iban: string | null
          invoice_payment_reference: string | null
          invoice_show_bank_details: boolean
          invoice_show_logo: boolean
          invoice_sort_code: string | null
          invoice_swift: string | null
          invoice_vat_number: string | null
          is_demo: boolean
          late_cancel_mode: string
          model_slots_position: string
          patient_cancel_cutoff_hours: number | null
          patient_reschedule_cutoff_hours: number | null
          patient_reschedule_max: number | null
          payment_card_full_enabled: boolean
          payment_clearpay_enabled: boolean
          payment_deposit_enabled: boolean
          payment_klarna_enabled: boolean
          payment_pass_fees_to_customer: boolean
          payment_surcharge_bnpl_enabled: boolean
          payment_surcharge_bnpl_percent: number
          payment_surcharge_card_enabled: boolean
          payment_surcharge_card_percent: number
          payment_surcharge_deposit_enabled: boolean
          payment_surcharge_deposit_percent: number
          phone: string | null
          practitioner_selection_mode: string
          qualifications: Json
          quiz_enabled: boolean
          quiz_intro: string | null
          quiz_outro: string | null
          reminder_hours_before: number[]
          require_account_to_book: boolean
          require_address: boolean
          require_deposit_to_confirm: boolean
          require_dob: boolean
          require_medical_forms_before_appt: boolean
          require_phone: boolean
          role: Database["public"]["Enums"]["app_role"]
          rota_anchor_date: string | null
          save_card_on_file: boolean
          show_prices_on_booking: boolean
          slug: string | null
          sms_reminders_enabled: boolean
          social_links: Json | null
          specialties: string[]
          stripe_connect_account_id: string | null
          stripe_connect_onboarding_status: string | null
          stripe_connect_type: string | null
          stripe_fee_bnpl_fixed_cents: number
          stripe_fee_bnpl_pass_to_patient: boolean
          stripe_fee_bnpl_percent: number
          stripe_fee_card_fixed_cents: number
          stripe_fee_card_percent: number
          stripe_fee_pass_to_patient: boolean
          stripe_oauth_state: string | null
          stripe_oauth_state_expires_at: string | null
          tagline: string | null
          terms_html: string | null
          terms_required: boolean
          timeline: Json
          updated_at: string
          user_id: string
          welcome_intro_html: string | null
          whatsapp_reminders_enabled: boolean
        }
        Insert: {
          about?: string | null
          about_page?: Json
          active?: boolean | null
          address?: Json | null
          allow_patient_cancel?: boolean
          allow_patient_reschedule?: boolean
          allow_pay_in_clinic?: boolean
          auto_confirm_bookings?: boolean
          avatar_url?: string | null
          bio?: string | null
          booking_buffer_after_minutes?: number
          booking_buffer_before_minutes?: number
          booking_daily_cap?: number | null
          booking_max_lead_days?: number
          booking_min_notice_hours?: number
          booking_smart_times_enabled?: boolean
          brand_color?: string | null
          cancellation_rules?: Json | null
          cash_only_balance?: boolean
          chooser_consultation_treatment_id?: string | null
          chooser_consultation_treatment_ids?: string[]
          chooser_enabled?: boolean
          chooser_extra_body?: string | null
          chooser_extra_enabled?: boolean
          chooser_extra_title?: string | null
          chooser_extra_treatment_ids?: string[]
          chooser_intro_text?: string | null
          chooser_show_consultation?: boolean
          chooser_show_know?: boolean
          chooser_show_unsure?: boolean
          clinic_name?: string | null
          contact_sms_number?: string | null
          contact_whatsapp_number?: string | null
          created_at?: string
          deletion_requested_at?: string | null
          deposit_amount_cents?: number | null
          deposit_percent?: number
          deposit_policy_text?: string | null
          deposit_type?: string
          discount_stack_mode?: string
          display_name_mode?: string
          email?: string | null
          email_confirmations_enabled?: boolean
          enforce_cancellation_fee?: boolean
          favourite_treatment_ids?: string[]
          favourites_custom_title?: string | null
          favourites_enabled?: boolean
          full_name?: string | null
          hero_url?: string | null
          id?: string
          invoice_account_name?: string | null
          invoice_account_number?: string | null
          invoice_bank_name?: string | null
          invoice_company_number?: string | null
          invoice_footer_notes?: string | null
          invoice_iban?: string | null
          invoice_payment_reference?: string | null
          invoice_show_bank_details?: boolean
          invoice_show_logo?: boolean
          invoice_sort_code?: string | null
          invoice_swift?: string | null
          invoice_vat_number?: string | null
          is_demo?: boolean
          late_cancel_mode?: string
          model_slots_position?: string
          patient_cancel_cutoff_hours?: number | null
          patient_reschedule_cutoff_hours?: number | null
          patient_reschedule_max?: number | null
          payment_card_full_enabled?: boolean
          payment_clearpay_enabled?: boolean
          payment_deposit_enabled?: boolean
          payment_klarna_enabled?: boolean
          payment_pass_fees_to_customer?: boolean
          payment_surcharge_bnpl_enabled?: boolean
          payment_surcharge_bnpl_percent?: number
          payment_surcharge_card_enabled?: boolean
          payment_surcharge_card_percent?: number
          payment_surcharge_deposit_enabled?: boolean
          payment_surcharge_deposit_percent?: number
          phone?: string | null
          practitioner_selection_mode?: string
          qualifications?: Json
          quiz_enabled?: boolean
          quiz_intro?: string | null
          quiz_outro?: string | null
          reminder_hours_before?: number[]
          require_account_to_book?: boolean
          require_address?: boolean
          require_deposit_to_confirm?: boolean
          require_dob?: boolean
          require_medical_forms_before_appt?: boolean
          require_phone?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          rota_anchor_date?: string | null
          save_card_on_file?: boolean
          show_prices_on_booking?: boolean
          slug?: string | null
          sms_reminders_enabled?: boolean
          social_links?: Json | null
          specialties?: string[]
          stripe_connect_account_id?: string | null
          stripe_connect_onboarding_status?: string | null
          stripe_connect_type?: string | null
          stripe_fee_bnpl_fixed_cents?: number
          stripe_fee_bnpl_pass_to_patient?: boolean
          stripe_fee_bnpl_percent?: number
          stripe_fee_card_fixed_cents?: number
          stripe_fee_card_percent?: number
          stripe_fee_pass_to_patient?: boolean
          stripe_oauth_state?: string | null
          stripe_oauth_state_expires_at?: string | null
          tagline?: string | null
          terms_html?: string | null
          terms_required?: boolean
          timeline?: Json
          updated_at?: string
          user_id: string
          welcome_intro_html?: string | null
          whatsapp_reminders_enabled?: boolean
        }
        Update: {
          about?: string | null
          about_page?: Json
          active?: boolean | null
          address?: Json | null
          allow_patient_cancel?: boolean
          allow_patient_reschedule?: boolean
          allow_pay_in_clinic?: boolean
          auto_confirm_bookings?: boolean
          avatar_url?: string | null
          bio?: string | null
          booking_buffer_after_minutes?: number
          booking_buffer_before_minutes?: number
          booking_daily_cap?: number | null
          booking_max_lead_days?: number
          booking_min_notice_hours?: number
          booking_smart_times_enabled?: boolean
          brand_color?: string | null
          cancellation_rules?: Json | null
          cash_only_balance?: boolean
          chooser_consultation_treatment_id?: string | null
          chooser_consultation_treatment_ids?: string[]
          chooser_enabled?: boolean
          chooser_extra_body?: string | null
          chooser_extra_enabled?: boolean
          chooser_extra_title?: string | null
          chooser_extra_treatment_ids?: string[]
          chooser_intro_text?: string | null
          chooser_show_consultation?: boolean
          chooser_show_know?: boolean
          chooser_show_unsure?: boolean
          clinic_name?: string | null
          contact_sms_number?: string | null
          contact_whatsapp_number?: string | null
          created_at?: string
          deletion_requested_at?: string | null
          deposit_amount_cents?: number | null
          deposit_percent?: number
          deposit_policy_text?: string | null
          deposit_type?: string
          discount_stack_mode?: string
          display_name_mode?: string
          email?: string | null
          email_confirmations_enabled?: boolean
          enforce_cancellation_fee?: boolean
          favourite_treatment_ids?: string[]
          favourites_custom_title?: string | null
          favourites_enabled?: boolean
          full_name?: string | null
          hero_url?: string | null
          id?: string
          invoice_account_name?: string | null
          invoice_account_number?: string | null
          invoice_bank_name?: string | null
          invoice_company_number?: string | null
          invoice_footer_notes?: string | null
          invoice_iban?: string | null
          invoice_payment_reference?: string | null
          invoice_show_bank_details?: boolean
          invoice_show_logo?: boolean
          invoice_sort_code?: string | null
          invoice_swift?: string | null
          invoice_vat_number?: string | null
          is_demo?: boolean
          late_cancel_mode?: string
          model_slots_position?: string
          patient_cancel_cutoff_hours?: number | null
          patient_reschedule_cutoff_hours?: number | null
          patient_reschedule_max?: number | null
          payment_card_full_enabled?: boolean
          payment_clearpay_enabled?: boolean
          payment_deposit_enabled?: boolean
          payment_klarna_enabled?: boolean
          payment_pass_fees_to_customer?: boolean
          payment_surcharge_bnpl_enabled?: boolean
          payment_surcharge_bnpl_percent?: number
          payment_surcharge_card_enabled?: boolean
          payment_surcharge_card_percent?: number
          payment_surcharge_deposit_enabled?: boolean
          payment_surcharge_deposit_percent?: number
          phone?: string | null
          practitioner_selection_mode?: string
          qualifications?: Json
          quiz_enabled?: boolean
          quiz_intro?: string | null
          quiz_outro?: string | null
          reminder_hours_before?: number[]
          require_account_to_book?: boolean
          require_address?: boolean
          require_deposit_to_confirm?: boolean
          require_dob?: boolean
          require_medical_forms_before_appt?: boolean
          require_phone?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          rota_anchor_date?: string | null
          save_card_on_file?: boolean
          show_prices_on_booking?: boolean
          slug?: string | null
          sms_reminders_enabled?: boolean
          social_links?: Json | null
          specialties?: string[]
          stripe_connect_account_id?: string | null
          stripe_connect_onboarding_status?: string | null
          stripe_connect_type?: string | null
          stripe_fee_bnpl_fixed_cents?: number
          stripe_fee_bnpl_pass_to_patient?: boolean
          stripe_fee_bnpl_percent?: number
          stripe_fee_card_fixed_cents?: number
          stripe_fee_card_percent?: number
          stripe_fee_pass_to_patient?: boolean
          stripe_oauth_state?: string | null
          stripe_oauth_state_expires_at?: string | null
          tagline?: string | null
          terms_html?: string | null
          terms_required?: boolean
          timeline?: Json
          updated_at?: string
          user_id?: string
          welcome_intro_html?: string | null
          whatsapp_reminders_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "profiles_chooser_consultation_treatment_id_fkey"
            columns: ["chooser_consultation_treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      push_dispatch_config: {
        Row: {
          id: boolean
          secret: string
          updated_at: string
          url: string
        }
        Insert: {
          id?: boolean
          secret: string
          updated_at?: string
          url: string
        }
        Update: {
          id?: boolean
          secret?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_seen_at: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_seen_at?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_seen_at?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      quiz_responses: {
        Row: {
          answers: Json
          client_id: string | null
          created_at: string
          id: string
          patient_email: string | null
          patient_name: string | null
          profile_id: string
          recommended_treatment_ids: string[]
        }
        Insert: {
          answers?: Json
          client_id?: string | null
          created_at?: string
          id?: string
          patient_email?: string | null
          patient_name?: string | null
          profile_id: string
          recommended_treatment_ids?: string[]
        }
        Update: {
          answers?: Json
          client_id?: string | null
          created_at?: string
          id?: string
          patient_email?: string | null
          patient_name?: string | null
          profile_id?: string
          recommended_treatment_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "quiz_responses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clinic_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_responses_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rx_chat_messages: {
        Row: {
          attachment_mime: string | null
          attachment_path: string | null
          attachment_size: number | null
          body: string | null
          created_at: string
          duration_ms: number | null
          id: string
          kind: Database["public"]["Enums"]["rx_chat_message_kind"]
          read_by: Json
          request_id: string
          sender_id: string | null
          thread_id: string
        }
        Insert: {
          attachment_mime?: string | null
          attachment_path?: string | null
          attachment_size?: number | null
          body?: string | null
          created_at?: string
          duration_ms?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["rx_chat_message_kind"]
          read_by?: Json
          request_id: string
          sender_id?: string | null
          thread_id: string
        }
        Update: {
          attachment_mime?: string | null
          attachment_path?: string | null
          attachment_size?: number | null
          body?: string | null
          created_at?: string
          duration_ms?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["rx_chat_message_kind"]
          read_by?: Json
          request_id?: string
          sender_id?: string | null
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rx_chat_messages_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "prescription_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rx_chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "rx_chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      rx_chat_threads: {
        Row: {
          created_at: string
          id: string
          last_message_at: string | null
          practitioner_id: string
          prescriber_id: string
          request_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          practitioner_id: string
          prescriber_id: string
          request_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          practitioner_id?: string
          prescriber_id?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rx_chat_threads_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "prescription_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_members: {
        Row: {
          accepted_at: string | null
          created_at: string
          data_scope: Database["public"]["Enums"]["staff_scope"]
          id: string
          invite_expires_at: string | null
          invite_token: string | null
          invited_at: string
          invited_email: string
          last_active_at: string | null
          name: string
          practitioner_id: string | null
          profile_id: string
          role: Database["public"]["Enums"]["staff_role"]
          status: Database["public"]["Enums"]["staff_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          data_scope?: Database["public"]["Enums"]["staff_scope"]
          id?: string
          invite_expires_at?: string | null
          invite_token?: string | null
          invited_at?: string
          invited_email: string
          last_active_at?: string | null
          name: string
          practitioner_id?: string | null
          profile_id: string
          role: Database["public"]["Enums"]["staff_role"]
          status?: Database["public"]["Enums"]["staff_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          data_scope?: Database["public"]["Enums"]["staff_scope"]
          id?: string
          invite_expires_at?: string | null
          invite_token?: string | null
          invited_at?: string
          invited_email?: string
          last_active_at?: string | null
          name?: string
          practitioner_id?: string | null
          profile_id?: string
          role?: Database["public"]["Enums"]["staff_role"]
          status?: Database["public"]["Enums"]["staff_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_members_practitioner_id_fkey"
            columns: ["practitioner_id"]
            isOneToOne: false
            referencedRelation: "practitioners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          active: boolean
          amount_cents: number
          created_at: string
          currency: string
          default_trial_days: number
          description: string | null
          id: string
          interval: string
          is_default: boolean
          kind: string
          name: string
          stripe_price_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount_cents: number
          created_at?: string
          currency?: string
          default_trial_days?: number
          description?: string | null
          id?: string
          interval?: string
          is_default?: boolean
          kind?: string
          name: string
          stripe_price_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount_cents?: number
          created_at?: string
          currency?: string
          default_trial_days?: number
          description?: string | null
          id?: string
          interval?: string
          is_default?: boolean
          kind?: string
          name?: string
          stripe_price_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      training_bookings: {
        Row: {
          amount_paid: number | null
          appointment_date: string | null
          appointment_end: string | null
          appointment_id: string | null
          appointment_start: string | null
          course_id: string
          created_at: string
          id: string
          location_id: string | null
          notes: string | null
          payment_status: string
          prereq_confirmed: boolean
          profile_id: string
          session_id: string | null
          status: Database["public"]["Enums"]["training_booking_status"]
          stripe_payment_intent_id: string | null
          trainee_email: string
          trainee_name: string
          trainee_phone: string | null
          updated_at: string
        }
        Insert: {
          amount_paid?: number | null
          appointment_date?: string | null
          appointment_end?: string | null
          appointment_id?: string | null
          appointment_start?: string | null
          course_id: string
          created_at?: string
          id?: string
          location_id?: string | null
          notes?: string | null
          payment_status?: string
          prereq_confirmed?: boolean
          profile_id: string
          session_id?: string | null
          status?: Database["public"]["Enums"]["training_booking_status"]
          stripe_payment_intent_id?: string | null
          trainee_email: string
          trainee_name: string
          trainee_phone?: string | null
          updated_at?: string
        }
        Update: {
          amount_paid?: number | null
          appointment_date?: string | null
          appointment_end?: string | null
          appointment_id?: string | null
          appointment_start?: string | null
          course_id?: string
          created_at?: string
          id?: string
          location_id?: string | null
          notes?: string | null
          payment_status?: string
          prereq_confirmed?: boolean
          profile_id?: string
          session_id?: string | null
          status?: Database["public"]["Enums"]["training_booking_status"]
          stripe_payment_intent_id?: string | null
          trainee_email?: string
          trainee_name?: string
          trainee_phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_bookings_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_bookings_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "training_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_bookings_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_bookings_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_bookings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "training_course_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      training_course_locations: {
        Row: {
          course_id: string
          created_at: string
          location_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          location_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          location_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_course_locations_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "training_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_course_locations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      training_course_sessions: {
        Row: {
          course_id: string
          created_at: string
          end_time: string
          id: string
          location_id: string | null
          session_date: string
          sort_order: number
          start_time: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          end_time: string
          id?: string
          location_id?: string | null
          session_date: string
          sort_order?: number
          start_time: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          end_time?: string
          id?: string
          location_id?: string | null
          session_date?: string
          sort_order?: number
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_course_sessions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "training_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_course_sessions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      training_courses: {
        Row: {
          active: boolean
          allow_split_payment: boolean
          capacity: number | null
          certificate_template_url: string | null
          cover_image_url: string | null
          cpd_hours: number | null
          created_at: string
          deposit_amount: number | null
          description: string | null
          duration_min: number
          id: string
          kit_list: string | null
          materials_html: string | null
          mode: Database["public"]["Enums"]["training_mode"]
          name: string
          payment_mode: Database["public"]["Enums"]["payment_mode"]
          prerequisites: string | null
          preview_token: string | null
          price: number
          profile_id: string
          require_prereq_confirm: boolean
          scheduling_mode: Database["public"]["Enums"]["training_scheduling_mode"]
          sort_order: number
          updated_at: string
          visibility: Database["public"]["Enums"]["training_visibility"]
        }
        Insert: {
          active?: boolean
          allow_split_payment?: boolean
          capacity?: number | null
          certificate_template_url?: string | null
          cover_image_url?: string | null
          cpd_hours?: number | null
          created_at?: string
          deposit_amount?: number | null
          description?: string | null
          duration_min?: number
          id?: string
          kit_list?: string | null
          materials_html?: string | null
          mode?: Database["public"]["Enums"]["training_mode"]
          name: string
          payment_mode?: Database["public"]["Enums"]["payment_mode"]
          prerequisites?: string | null
          preview_token?: string | null
          price?: number
          profile_id: string
          require_prereq_confirm?: boolean
          scheduling_mode?: Database["public"]["Enums"]["training_scheduling_mode"]
          sort_order?: number
          updated_at?: string
          visibility?: Database["public"]["Enums"]["training_visibility"]
        }
        Update: {
          active?: boolean
          allow_split_payment?: boolean
          capacity?: number | null
          certificate_template_url?: string | null
          cover_image_url?: string | null
          cpd_hours?: number | null
          created_at?: string
          deposit_amount?: number | null
          description?: string | null
          duration_min?: number
          id?: string
          kit_list?: string | null
          materials_html?: string | null
          mode?: Database["public"]["Enums"]["training_mode"]
          name?: string
          payment_mode?: Database["public"]["Enums"]["payment_mode"]
          prerequisites?: string | null
          preview_token?: string | null
          price?: number
          profile_id?: string
          require_prereq_confirm?: boolean
          scheduling_mode?: Database["public"]["Enums"]["training_scheduling_mode"]
          sort_order?: number
          updated_at?: string
          visibility?: Database["public"]["Enums"]["training_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "training_courses_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_addons: {
        Row: {
          addon_id: string
          created_at: string
          discount_amount: number | null
          discount_percent: number | null
          id: string
          treatment_id: string
        }
        Insert: {
          addon_id: string
          created_at?: string
          discount_amount?: number | null
          discount_percent?: number | null
          id?: string
          treatment_id: string
        }
        Update: {
          addon_id?: string
          created_at?: string
          discount_amount?: number | null
          discount_percent?: number | null
          id?: string
          treatment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_addons_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_addons_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_aftercare_templates: {
        Row: {
          created_at: string
          template_id: string
          treatment_id: string
        }
        Insert: {
          created_at?: string
          template_id: string
          treatment_id: string
        }
        Update: {
          created_at?: string
          template_id?: string
          treatment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_aftercare_templates_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "aftercare_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_aftercare_templates_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_categories: {
        Row: {
          coming_soon_at: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          kind: string
          name: string
          parent_id: string | null
          profile_id: string
          rebook_reminder_days: number | null
          slug: string | null
          sort_order: number
          topup_reminder_days: number | null
          updated_at: string
        }
        Insert: {
          coming_soon_at?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          kind?: string
          name: string
          parent_id?: string | null
          profile_id: string
          rebook_reminder_days?: number | null
          slug?: string | null
          sort_order?: number
          topup_reminder_days?: number | null
          updated_at?: string
        }
        Update: {
          coming_soon_at?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          kind?: string
          name?: string
          parent_id?: string | null
          profile_id?: string
          rebook_reminder_days?: number | null
          slug?: string | null
          sort_order?: number
          topup_reminder_days?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "treatment_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_categories_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_consents: {
        Row: {
          consent_template_id: string
          created_at: string
          profile_id: string
          treatment_id: string
        }
        Insert: {
          consent_template_id: string
          created_at?: string
          profile_id: string
          treatment_id: string
        }
        Update: {
          consent_template_id?: string
          created_at?: string
          profile_id?: string
          treatment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_consents_consent_template_id_fkey"
            columns: ["consent_template_id"]
            isOneToOne: false
            referencedRelation: "consent_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_consents_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_consents_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_location_pricing: {
        Row: {
          available: boolean
          created_at: string
          duration_minutes: number | null
          id: string
          location_id: string
          price_cents: number | null
          treatment_id: string
          updated_at: string
        }
        Insert: {
          available?: boolean
          created_at?: string
          duration_minutes?: number | null
          id?: string
          location_id: string
          price_cents?: number | null
          treatment_id: string
          updated_at?: string
        }
        Update: {
          available?: boolean
          created_at?: string
          duration_minutes?: number | null
          id?: string
          location_id?: string
          price_cents?: number | null
          treatment_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_location_pricing_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_location_pricing_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_medical_forms: {
        Row: {
          created_at: string
          template_id: string
          treatment_id: string
        }
        Insert: {
          created_at?: string
          template_id: string
          treatment_id: string
        }
        Update: {
          created_at?: string
          template_id?: string
          treatment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_medical_forms_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "medical_form_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_medical_forms_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_plan_sessions: {
        Row: {
          appointment_id: string | null
          created_at: string
          downtime: string | null
          expected_results: string | null
          id: string
          interval_weeks_from_previous: number | null
          notes: string | null
          plan_id: string
          price_cents_override: number | null
          session_number: number
          session_purpose: string | null
          status: string
          suggested_date: string | null
          treatment_id: string | null
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          downtime?: string | null
          expected_results?: string | null
          id?: string
          interval_weeks_from_previous?: number | null
          notes?: string | null
          plan_id: string
          price_cents_override?: number | null
          session_number: number
          session_purpose?: string | null
          status?: string
          suggested_date?: string | null
          treatment_id?: string | null
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          downtime?: string | null
          expected_results?: string | null
          id?: string
          interval_weeks_from_previous?: number | null
          notes?: string | null
          plan_id?: string
          price_cents_override?: number | null
          session_number?: number
          session_purpose?: string | null
          status?: string
          suggested_date?: string | null
          treatment_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_plan_sessions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plan_sessions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "treatment_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plan_sessions_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_plan_template_items: {
        Row: {
          created_at: string
          id: string
          interval_weeks_from_previous: number | null
          notes: string | null
          session_number: number
          template_id: string
          treatment_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          interval_weeks_from_previous?: number | null
          notes?: string | null
          session_number: number
          template_id: string
          treatment_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          interval_weeks_from_previous?: number | null
          notes?: string | null
          session_number?: number
          template_id?: string
          treatment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treatment_plan_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "treatment_plan_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plan_template_items_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_plan_templates: {
        Row: {
          booking_mode: string
          course_price_cents: number | null
          created_at: string
          default_interval_weeks: number
          deposit_cents: number | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          payment_mode: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          booking_mode?: string
          course_price_cents?: number | null
          created_at?: string
          default_interval_weeks?: number
          deposit_cents?: number | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          payment_mode?: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          booking_mode?: string
          course_price_cents?: number | null
          created_at?: string
          default_interval_weeks?: number
          deposit_cents?: number | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          payment_mode?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_plan_templates_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_plans: {
        Row: {
          accepted_at: string | null
          booking_mode: string
          client_id: string
          completed_at: string | null
          consultation_id: string | null
          course_paid: boolean
          course_price_cents: number | null
          created_at: string
          decline_reason: string | null
          decline_tags: string[] | null
          declined_at: string | null
          deposit_cents: number | null
          deposit_paid: boolean
          description: string | null
          discount_cents: number | null
          discount_percent: number | null
          id: string
          name: string
          patient_token: string | null
          payment_mode: string
          profile_id: string
          sent_at: string | null
          status: string
          template_id: string | null
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          booking_mode?: string
          client_id: string
          completed_at?: string | null
          consultation_id?: string | null
          course_paid?: boolean
          course_price_cents?: number | null
          created_at?: string
          decline_reason?: string | null
          decline_tags?: string[] | null
          declined_at?: string | null
          deposit_cents?: number | null
          deposit_paid?: boolean
          description?: string | null
          discount_cents?: number | null
          discount_percent?: number | null
          id?: string
          name: string
          patient_token?: string | null
          payment_mode?: string
          profile_id: string
          sent_at?: string | null
          status?: string
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          booking_mode?: string
          client_id?: string
          completed_at?: string | null
          consultation_id?: string | null
          course_paid?: boolean
          course_price_cents?: number | null
          created_at?: string
          decline_reason?: string | null
          decline_tags?: string[] | null
          declined_at?: string | null
          deposit_cents?: number | null
          deposit_paid?: boolean
          description?: string | null
          discount_cents?: number | null
          discount_percent?: number | null
          id?: string
          name?: string
          patient_token?: string | null
          payment_mode?: string
          profile_id?: string
          sent_at?: string | null
          status?: string
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_plans_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clinic_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plans_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plans_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plans_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "treatment_plan_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      treatments: {
        Row: {
          active: boolean | null
          addon_mode: string
          aftercare_delay_hours: number
          aftercare_html: string | null
          allow_split_payment: boolean
          auto_send_aftercare: boolean
          auto_send_medical_forms: boolean
          badge: string | null
          booking_cap: number | null
          category_id: string | null
          color: string | null
          consent_form_url: string | null
          created_at: string
          deductible_against: string[] | null
          deductible_window_days: number | null
          deposit_amount: number | null
          description: string | null
          discount_days_of_week: number[] | null
          discount_ends_at: string | null
          discount_label: string | null
          discount_percent: number | null
          discount_show_was_now: boolean
          discount_starts_at: string | null
          duration: number
          id: string
          is_consultation: boolean | null
          name: string
          payment_mode: Database["public"]["Enums"]["payment_mode"]
          picture_url: string | null
          prescriber_note: string | null
          prescriber_routing: string
          prescriber_user_id: string | null
          price: number
          price_mode: string
          profile_id: string
          quiz_tags: Json
          rebook_reminder_days: number | null
          requires_prescriber: boolean
          session_count: number
          session_interval_days: number | null
          sort_order: number
          timing_notes: string | null
          topup_reminder_days: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          addon_mode?: string
          aftercare_delay_hours?: number
          aftercare_html?: string | null
          allow_split_payment?: boolean
          auto_send_aftercare?: boolean
          auto_send_medical_forms?: boolean
          badge?: string | null
          booking_cap?: number | null
          category_id?: string | null
          color?: string | null
          consent_form_url?: string | null
          created_at?: string
          deductible_against?: string[] | null
          deductible_window_days?: number | null
          deposit_amount?: number | null
          description?: string | null
          discount_days_of_week?: number[] | null
          discount_ends_at?: string | null
          discount_label?: string | null
          discount_percent?: number | null
          discount_show_was_now?: boolean
          discount_starts_at?: string | null
          duration: number
          id?: string
          is_consultation?: boolean | null
          name: string
          payment_mode?: Database["public"]["Enums"]["payment_mode"]
          picture_url?: string | null
          prescriber_note?: string | null
          prescriber_routing?: string
          prescriber_user_id?: string | null
          price: number
          price_mode?: string
          profile_id: string
          quiz_tags?: Json
          rebook_reminder_days?: number | null
          requires_prescriber?: boolean
          session_count?: number
          session_interval_days?: number | null
          sort_order?: number
          timing_notes?: string | null
          topup_reminder_days?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          addon_mode?: string
          aftercare_delay_hours?: number
          aftercare_html?: string | null
          allow_split_payment?: boolean
          auto_send_aftercare?: boolean
          auto_send_medical_forms?: boolean
          badge?: string | null
          booking_cap?: number | null
          category_id?: string | null
          color?: string | null
          consent_form_url?: string | null
          created_at?: string
          deductible_against?: string[] | null
          deductible_window_days?: number | null
          deposit_amount?: number | null
          description?: string | null
          discount_days_of_week?: number[] | null
          discount_ends_at?: string | null
          discount_label?: string | null
          discount_percent?: number | null
          discount_show_was_now?: boolean
          discount_starts_at?: string | null
          duration?: number
          id?: string
          is_consultation?: boolean | null
          name?: string
          payment_mode?: Database["public"]["Enums"]["payment_mode"]
          picture_url?: string | null
          prescriber_note?: string | null
          prescriber_routing?: string
          prescriber_user_id?: string | null
          price?: number
          price_mode?: string
          profile_id?: string
          quiz_tags?: Json
          rebook_reminder_days?: number | null
          requires_prescriber?: boolean
          session_count?: number
          session_interval_days?: number | null
          sort_order?: number
          timing_notes?: string | null
          topup_reminder_days?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatments_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "treatment_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _profile_id_for_user: { Args: { p_user_id: string }; Returns: string }
      _user_id_for_profile: { Args: { p_profile_id: string }; Returns: string }
      add_walk_in_consent_forms: {
        Args: { p_referral_id: string; p_template_ids: string[] }
        Returns: number
      }
      add_walk_in_medical_forms: {
        Args: { p_referral_id: string; p_template_ids: string[] }
        Returns: number
      }
      admin_grant_admin_by_email: { Args: { _email: string }; Returns: string }
      admin_list_admins: {
        Args: never
        Returns: {
          created_at: string
          email: string
          user_id: string
        }[]
      }
      admin_list_invites: {
        Args: never
        Returns: {
          accepted_at: string
          created_at: string
          email: string
          id: string
        }[]
      }
      admin_list_practitioners: {
        Args: never
        Returns: {
          active: boolean
          appointments_count: number
          clinic_name: string
          created_at: string
          email: string
          full_name: string
          profile_id: string
          slug: string
          treatments_count: number
          user_id: string
        }[]
      }
      admin_revoke_admin: { Args: { _user_id: string }; Returns: boolean }
      approve_prescriber_clinic_visit: {
        Args: { p_id: string }
        Returns: boolean
      }
      can_patient_view_photo: { Args: { path: string }; Returns: boolean }
      cancel_appointment_by_token: {
        Args: { p_token: string }
        Returns: boolean
      }
      claim_appointments_by_email: {
        Args: { p_email: string; p_slug: string }
        Returns: number
      }
      close_walk_in_as_practitioner: {
        Args: { p_id: string; p_note?: string }
        Returns: boolean
      }
      create_appointment_consents: {
        Args: { p_appointment_id: string; p_template_ids: string[] }
        Returns: {
          consent_template_id: string
          token: string
        }[]
      }
      create_notification: {
        Args: {
          p_body: string
          p_emoji: string
          p_entity_id: string
          p_entity_type: string
          p_link: string
          p_profile_id: string
          p_title: string
          p_type: string
        }
        Returns: undefined
      }
      create_walk_in_referral:
        | {
            Args: {
              p_client_id?: string
              p_medical_form_template_ids?: string[]
              p_note?: string
              p_patient_dob?: string
              p_patient_email?: string
              p_patient_name: string
              p_patient_phone?: string
              p_practitioner_profile_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_client_id?: string
              p_consent_template_ids?: string[]
              p_medical_form_template_ids?: string[]
              p_note?: string
              p_patient_dob?: string
              p_patient_email?: string
              p_patient_name: string
              p_patient_phone?: string
              p_practitioner_profile_id: string
            }
            Returns: string
          }
      current_patient_client_id: {
        Args: { _profile_id: string }
        Returns: string
      }
      current_patient_email: { Args: { _profile_id: string }; Returns: string }
      decline_prescriber_clinic_visit: {
        Args: { p_id: string }
        Returns: boolean
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      ensure_hub_code: {
        Args: { p_display_name: string; p_kind: string }
        Returns: string
      }
      get_about_page_by_slug: { Args: { p_slug: string }; Returns: Json }
      get_appointment_by_manage_token: {
        Args: { p_token: string }
        Returns: {
          aftercare_html: string
          cancellation_rules: Json
          clinic_name: string
          deposit_policy_text: string
          end_time: string
          has_allergies: boolean
          id: string
          location_name: string
          patient_email: string
          patient_name: string
          patient_phone: string
          scheduled_date: string
          slug: string
          start_time: string
          status: string
          treatment_name: string
        }[]
      }
      get_clinic_slug_for_consent_token: {
        Args: { p_token: string }
        Returns: string
      }
      get_clinic_slug_for_form_token: {
        Args: { p_token: string }
        Returns: string
      }
      get_consent_by_token: {
        Args: { p_token: string }
        Returns: {
          appointment_id: string
          clinic_name: string
          consent_id: string
          patient_name: string
          requires_signature: boolean
          scheduled_date: string
          signature_data: string
          signature_name: string
          signed_at: string
          signed_url: string
          slug: string
          start_time: string
          status: string
          template_body: string
          template_name: string
          template_sections: Json
          template_summary: string
          treatment_name: string
        }[]
      }
      get_linked_hub_codes: {
        Args: { p_user_ids: string[] }
        Returns: {
          code: string
          display_name: string
          owner_kind: Database["public"]["Enums"]["hub_owner_kind"]
          user_id: string
        }[]
      }
      get_medical_form_by_token: {
        Args: { p_token: string }
        Returns: {
          brand_color: string
          client_contact: Json
          clinic_name: string
          form_id: string
          patient_name: string
          response: Json
          scheduled_date: string
          slug: string
          start_time: string
          status: string
          template_name: string
          template_schema: Json
          treatment_name: string
        }[]
      }
      get_patient_account_profile_by_slug: {
        Args: { p_slug: string }
        Returns: {
          allow_patient_cancel: boolean
          allow_patient_reschedule: boolean
          avatar_url: string
          brand_color: string
          cancellation_rules: Json
          clinic_name: string
          contact_sms_number: string
          contact_whatsapp_number: string
          email: string
          full_name: string
          id: string
          late_cancel_mode: string
          patient_cancel_cutoff_hours: number
          patient_reschedule_cutoff_hours: number
          patient_reschedule_max: number
          phone: string
        }[]
      }
      get_plan_by_token: { Args: { _token: string }; Returns: Json }
      get_public_profile_by_slug: {
        Args: { p_slug: string }
        Returns: {
          about: string
          active: boolean
          address: Json
          allow_patient_cancel: boolean
          allow_patient_reschedule: boolean
          allow_pay_in_clinic: boolean
          auto_confirm_bookings: boolean
          avatar_url: string
          bio: string
          booking_buffer_after_minutes: number
          booking_buffer_before_minutes: number
          booking_daily_cap: number
          booking_max_lead_days: number
          booking_min_notice_hours: number
          booking_smart_times_enabled: boolean
          brand_color: string
          cancellation_rules: Json
          chooser_consultation_treatment_id: string
          chooser_consultation_treatment_ids: string[]
          chooser_enabled: boolean
          chooser_extra_body: string
          chooser_extra_enabled: boolean
          chooser_extra_title: string
          chooser_extra_treatment_ids: string[]
          chooser_intro_text: string
          chooser_show_consultation: boolean
          chooser_show_know: boolean
          chooser_show_unsure: boolean
          clinic_name: string
          contact_sms_number: string
          contact_whatsapp_number: string
          created_at: string
          deposit_amount_cents: number
          deposit_policy_text: string
          discount_stack_mode: string
          display_name_mode: string
          email_confirmations_enabled: boolean
          enforce_cancellation_fee: boolean
          favourite_treatment_ids: string[]
          favourites_custom_title: string
          favourites_enabled: boolean
          full_name: string
          hero_url: string
          id: string
          model_slots_position: string
          payment_card_full_enabled: boolean
          payment_clearpay_enabled: boolean
          payment_deposit_enabled: boolean
          payment_klarna_enabled: boolean
          payment_pass_fees_to_customer: boolean
          practitioner_selection_mode: string
          qualifications: Json
          reminder_hours_before: number[]
          require_account_to_book: boolean
          require_address: boolean
          require_deposit_to_confirm: boolean
          require_dob: boolean
          require_medical_forms_before_appt: boolean
          require_phone: boolean
          show_prices_on_booking: boolean
          slug: string
          sms_reminders_enabled: boolean
          social_links: Json
          specialties: string[]
          tagline: string
          terms_html: string
          terms_required: boolean
          timeline: Json
          updated_at: string
          welcome_intro_html: string
          whatsapp_reminders_enabled: boolean
        }[]
      }
      get_public_rewards_by_slug: {
        Args: { p_slug: string }
        Returns: {
          clinic_name: string
          clinic_profile_id: string
          settings: Json
          slug: string
          tiers: Json
        }[]
      }
      get_public_treatment_booking_counts: {
        Args: { p_profile_id: string }
        Returns: {
          booked_count: number
          treatment_id: string
        }[]
      }
      get_quiz_config_by_slug: {
        Args: { p_slug: string }
        Returns: {
          chooser_consultation_treatment_id: string
          profile_id: string
          quiz_enabled: boolean
          quiz_intro: string
          quiz_outro: string
        }[]
      }
      get_rota_anchor: { Args: { p_profile_id: string }; Returns: string }
      has_accepted_current_terms: { Args: never; Returns: boolean }
      has_clinic_role: {
        Args: {
          _profile_id: string
          _role: Database["public"]["Enums"]["staff_role"]
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active_profile: { Args: { _profile_id: string }; Returns: boolean }
      is_active_profile_path: { Args: { path: string }; Returns: boolean }
      is_clinic_client_for_user: {
        Args: { _client_id: string }
        Returns: boolean
      }
      is_clinic_member: { Args: { _profile_id: string }; Returns: boolean }
      is_clinic_owner: { Args: { _profile_id: string }; Returns: boolean }
      is_clinic_staff: { Args: { _profile_id: string }; Returns: boolean }
      is_demo_user: { Args: never; Returns: boolean }
      is_linked_to_practitioner_profile: {
        Args: { _profile_id: string }
        Returns: boolean
      }
      is_object_owner: { Args: { path: string }; Returns: boolean }
      is_patient_of_profile: { Args: { _profile_id: string }; Returns: boolean }
      is_practitioner_owner: {
        Args: { _practitioner_id: string }
        Returns: boolean
      }
      is_prescriber_approved: { Args: { _user_id: string }; Returns: boolean }
      is_profile_owner: { Args: { _profile_id: string }; Returns: boolean }
      is_slug_available: {
        Args: { p_exclude_id?: string; p_slug: string }
        Returns: boolean
      }
      link_patient_account: { Args: { p_slug: string }; Returns: string }
      list_clinic_visits_for_slug: {
        Args: { p_slug: string; p_treatment_ids: string[] }
        Returns: {
          end_time: string
          location_id: string
          location_name: string
          notes: string
          prescriber_name: string
          prescriber_user_id: string
          remaining_capacity: number
          start_time: string
          treatment_id: string
          visit_date: string
          visit_id: string
        }[]
      }
      list_consents_for_client: {
        Args: { p_client_id: string }
        Returns: {
          appointment_id: string
          created_at: string
          id: string
          signature_name: string
          signed_at: string
          status: string
          template_id: string
          template_name: string
          token: string
        }[]
      }
      list_linked_practitioner_consent_forms: {
        Args: { p_practitioner_profile_id: string }
        Returns: {
          id: string
          is_system: boolean
          name: string
          summary: string
          treatment_type: string
        }[]
      }
      list_linked_practitioner_medical_forms: {
        Args: { p_practitioner_profile_id: string }
        Returns: {
          description: string
          id: string
          is_system: boolean
          name: string
        }[]
      }
      list_my_prescriber_visits: { Args: never; Returns: Json }
      lookup_active_discount_code: {
        Args: { _code: string }
        Returns: {
          amount_off_cents: number
          code: string
          currency: string
          description: string
          duration: string
          duration_in_months: number
          id: string
          percent_off: number
        }[]
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      my_clinic_profile_id: { Args: never; Returns: string }
      patient_cancel_appointment:
        | { Args: { p_appointment_id: string }; Returns: Json }
        | {
            Args: { p_appointment_id: string; p_confirm_late?: boolean }
            Returns: Json
          }
      patient_request_erasure: { Args: { p_slug: string }; Returns: Json }
      patient_reschedule_appointment: {
        Args: {
          p_appointment_id: string
          p_date: string
          p_end: string
          p_start: string
        }
        Returns: Json
      }
      patient_update_own_client: {
        Args: {
          p_address_line1?: string
          p_address_line2?: string
          p_county?: string
          p_dob?: string
          p_email?: string
          p_emergency_contact_name?: string
          p_emergency_contact_phone?: string
          p_full_name?: string
          p_gender?: string
          p_gp_address?: string
          p_gp_name?: string
          p_phone?: string
          p_postcode?: string
          p_preferred_contact?: string
          p_slug: string
        }
        Returns: string
      }
      practitioner_billing_status: {
        Args: { _profile_id: string }
        Returns: {
          days_left: number
          deadline: string
          has_access: boolean
          state: string
        }[]
      }
      practitioner_has_platform_access: {
        Args: { _profile_id: string }
        Returns: boolean
      }
      prescriber_get_referral_full: {
        Args: { p_referral_id: string }
        Returns: Json
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      record_platform_terms_acceptance: {
        Args: {
          p_context?: string
          p_ip_hash?: string
          p_terms_id: string
          p_user_agent?: string
        }
        Returns: string
      }
      resolve_hub_code: {
        Args: { p_code: string }
        Returns: {
          display_name: string
          owner_kind: string
          user_id: string
        }[]
      }
      resolve_referral_code: {
        Args: { _code: string }
        Returns: {
          clinic_name: string
          enabled: boolean
          friend_credit_pennies: number
          full_name: string
          headline: string
          slug: string
        }[]
      }
      respond_to_plan_by_token: {
        Args: {
          _accept: boolean
          _reason?: string
          _tags?: string[]
          _token: string
        }
        Returns: Json
      }
      save_walk_in_medical_form_response: {
        Args: { p_form_id: string; p_referral_id: string; p_response: Json }
        Returns: boolean
      }
      send_consent_to_client: {
        Args: { p_client_id: string; p_template_id: string }
        Returns: {
          id: string
          token: string
        }[]
      }
      send_medical_form_to_client: {
        Args: {
          p_client_id: string
          p_email: string
          p_phone: string
          p_template_id: string
        }
        Returns: {
          id: string
          token: string
        }[]
      }
      send_walk_in_to_practitioner: { Args: { p_id: string }; Returns: boolean }
      submit_consent: {
        Args: {
          p_signature_data: string
          p_signature_name: string
          p_token: string
        }
        Returns: boolean
      }
      submit_medical_form: {
        Args: { p_response: Json; p_token: string }
        Returns: boolean
      }
      validate_discount_code: {
        Args: { p_code: string; p_slug: string; p_treatment_ids: string[] }
        Returns: {
          amount: number
          applies_to_treatment_ids: string[]
          code: string
          id: string
          kind: string
          label: string
        }[]
      }
    }
    Enums: {
      app_role: "practitioner" | "admin" | "prescriber"
      appointment_status:
        | "pending"
        | "confirmed"
        | "cancelled"
        | "completed"
        | "no_show"
      hub_link_status: "pending" | "accepted" | "declined" | "cancelled"
      hub_owner_kind: "practitioner" | "prescriber"
      payment_mode: "full" | "deposit" | "pay_in_clinic"
      payment_status: "pending" | "paid" | "refunded" | "failed"
      prescriber_status: "pending" | "approved" | "rejected" | "more_info"
      rx_chat_message_kind: "text" | "image" | "pdf" | "voice" | "system"
      rx_event_kind:
        | "created"
        | "viewed"
        | "commented"
        | "approved"
        | "declined"
        | "info_requested"
        | "info_provided"
        | "message_sent"
        | "attachment_added"
        | "prescription_issued"
        | "withdrawn"
        | "status_changed"
      rx_request_status:
        | "pending"
        | "awaiting_info"
        | "approved"
        | "declined"
        | "withdrawn"
      staff_role: "admin" | "practitioner" | "receptionist" | "viewer"
      staff_scope: "clinic" | "own"
      staff_status: "invited" | "active" | "disabled"
      training_booking_status:
        | "pending"
        | "confirmed"
        | "cancelled"
        | "completed"
      training_mode: "one_to_one" | "group" | "multi_day"
      training_scheduling_mode: "fixed" | "availability"
      training_visibility: "live" | "hidden" | "preview_link" | "coming_soon"
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
      app_role: ["practitioner", "admin", "prescriber"],
      appointment_status: [
        "pending",
        "confirmed",
        "cancelled",
        "completed",
        "no_show",
      ],
      hub_link_status: ["pending", "accepted", "declined", "cancelled"],
      hub_owner_kind: ["practitioner", "prescriber"],
      payment_mode: ["full", "deposit", "pay_in_clinic"],
      payment_status: ["pending", "paid", "refunded", "failed"],
      prescriber_status: ["pending", "approved", "rejected", "more_info"],
      rx_chat_message_kind: ["text", "image", "pdf", "voice", "system"],
      rx_event_kind: [
        "created",
        "viewed",
        "commented",
        "approved",
        "declined",
        "info_requested",
        "info_provided",
        "message_sent",
        "attachment_added",
        "prescription_issued",
        "withdrawn",
        "status_changed",
      ],
      rx_request_status: [
        "pending",
        "awaiting_info",
        "approved",
        "declined",
        "withdrawn",
      ],
      staff_role: ["admin", "practitioner", "receptionist", "viewer"],
      staff_scope: ["clinic", "own"],
      staff_status: ["invited", "active", "disabled"],
      training_booking_status: [
        "pending",
        "confirmed",
        "cancelled",
        "completed",
      ],
      training_mode: ["one_to_one", "group", "multi_day"],
      training_scheduling_mode: ["fixed", "availability"],
      training_visibility: ["live", "hidden", "preview_link", "coming_soon"],
    },
  },
} as const
