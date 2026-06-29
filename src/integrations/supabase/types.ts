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
          discount_percent: number | null
          id: string
          treatment_id: string | null
        }
        Insert: {
          addon_id: string
          category_id?: string | null
          created_at?: string
          discount_percent?: number | null
          id?: string
          treatment_id?: string | null
        }
        Update: {
          addon_id?: string
          category_id?: string | null
          created_at?: string
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
          created_at: string
          delay_hours: number
          id: string
          name: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          body_html?: string
          created_at?: string
          delay_hours?: number
          id?: string
          name: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          body_html?: string
          created_at?: string
          delay_hours?: number
          id?: string
          name?: string
          profile_id?: string
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
          appointment_id: string
          consent_template_id: string
          created_at: string
          id: string
          profile_id: string
          signature_data: string | null
          signature_name: string | null
          signed_at: string | null
          signed_url: string | null
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          appointment_id: string
          consent_template_id: string
          created_at?: string
          id?: string
          profile_id: string
          signature_data?: string | null
          signature_name?: string | null
          signed_at?: string | null
          signed_url?: string | null
          status?: string
          token?: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          consent_template_id?: string
          created_at?: string
          id?: string
          profile_id?: string
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
      appointments: {
        Row: {
          addon_ids: string[] | null
          aftercare_html: string | null
          aftercare_sent_at: string | null
          allergies_text: string | null
          base_amount: number | null
          checkout_completed_at: string | null
          checkout_discount_cents: number | null
          checkout_method: string | null
          checkout_notes: string | null
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
          payment_method: string | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          practitioner_id: string | null
          practitioner_notes: string | null
          profile_id: string
          scheduled_date: string
          start_time: string
          status: Database["public"]["Enums"]["appointment_status"] | null
          stripe_payment_intent_id: string | null
          surcharge_amount: number | null
          total_amount: number | null
          treatment_id: string
          updated_at: string
        }
        Insert: {
          addon_ids?: string[] | null
          aftercare_html?: string | null
          aftercare_sent_at?: string | null
          allergies_text?: string | null
          base_amount?: number | null
          checkout_completed_at?: string | null
          checkout_discount_cents?: number | null
          checkout_method?: string | null
          checkout_notes?: string | null
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
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          practitioner_id?: string | null
          practitioner_notes?: string | null
          profile_id: string
          scheduled_date: string
          start_time: string
          status?: Database["public"]["Enums"]["appointment_status"] | null
          stripe_payment_intent_id?: string | null
          surcharge_amount?: number | null
          total_amount?: number | null
          treatment_id: string
          updated_at?: string
        }
        Update: {
          addon_ids?: string[] | null
          aftercare_html?: string | null
          aftercare_sent_at?: string | null
          allergies_text?: string | null
          base_amount?: number | null
          checkout_completed_at?: string | null
          checkout_discount_cents?: number | null
          checkout_method?: string | null
          checkout_notes?: string | null
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
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          practitioner_id?: string | null
          practitioner_notes?: string | null
          profile_id?: string
          scheduled_date?: string
          start_time?: string
          status?: Database["public"]["Enums"]["appointment_status"] | null
          stripe_payment_intent_id?: string | null
          surcharge_amount?: number | null
          total_amount?: number | null
          treatment_id?: string
          updated_at?: string
        }
        Relationships: [
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
          day_of_week: number
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
          day_of_week: number
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
          day_of_week?: number
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
            foreignKeyName: "availability_rules_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
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
      client_notes: {
        Row: {
          body: string
          client_id: string
          created_at: string
          id: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          body: string
          client_id: string
          created_at?: string
          id?: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          body?: string
          client_id?: string
          created_at?: string
          id?: string
          profile_id?: string
          updated_at?: string
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
          id: string
          notes: string | null
          prescribed_on: string | null
          product: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          directions?: string | null
          dose?: string | null
          id?: string
          notes?: string | null
          prescribed_on?: string | null
          product: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          directions?: string | null
          dose?: string | null
          id?: string
          notes?: string | null
          prescribed_on?: string | null
          product?: string
          profile_id?: string
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
          county: string | null
          created_at: string
          dob: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          full_name: string
          gender: string | null
          gp_address: string | null
          gp_name: string | null
          group_name: string | null
          has_allergies: boolean
          how_heard: string | null
          id: string
          marketing_opt_in: boolean
          medical_form_data: Json | null
          medical_form_updated_at: string | null
          notes: string | null
          phone: string | null
          postcode: string | null
          preferred_contact: string | null
          profile_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          address_line1?: string | null
          address_line2?: string | null
          allergies?: string | null
          archived?: boolean
          avatar_url?: string | null
          county?: string | null
          created_at?: string
          dob?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name: string
          gender?: string | null
          gp_address?: string | null
          gp_name?: string | null
          group_name?: string | null
          has_allergies?: boolean
          how_heard?: string | null
          id?: string
          marketing_opt_in?: boolean
          medical_form_data?: Json | null
          medical_form_updated_at?: string | null
          notes?: string | null
          phone?: string | null
          postcode?: string | null
          preferred_contact?: string | null
          profile_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          address_line1?: string | null
          address_line2?: string | null
          allergies?: string | null
          archived?: boolean
          avatar_url?: string | null
          county?: string | null
          created_at?: string
          dob?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name?: string
          gender?: string | null
          gp_address?: string | null
          gp_name?: string | null
          group_name?: string | null
          has_allergies?: boolean
          how_heard?: string | null
          id?: string
          marketing_opt_in?: boolean
          medical_form_data?: Json | null
          medical_form_updated_at?: string | null
          notes?: string | null
          phone?: string | null
          postcode?: string | null
          preferred_contact?: string | null
          profile_id?: string
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
          hero_heading: string | null
          hero_height: string
          hero_image_url: string | null
          hero_overlay_color: string
          hero_overlay_opacity: number
          hero_show_text: boolean
          hero_subheading: string | null
          hero_text_alignment: string
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
          hero_heading?: string | null
          hero_height?: string
          hero_image_url?: string | null
          hero_overlay_color?: string
          hero_overlay_opacity?: number
          hero_show_text?: boolean
          hero_subheading?: string | null
          hero_text_alignment?: string
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
          hero_heading?: string | null
          hero_height?: string
          hero_image_url?: string | null
          hero_overlay_color?: string
          hero_overlay_opacity?: number
          hero_show_text?: boolean
          hero_subheading?: string | null
          hero_text_alignment?: string
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
            referencedRelation: "patients"
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
          end_time: string
          id: string
          location_id: string | null
          notes: string | null
          price_mode: string
          price_value: number
          profile_id: string
          slot_date: string
          start_time: string
          treatment_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          booked_appointment_id?: string | null
          category?: string | null
          created_at?: string
          end_time: string
          id?: string
          location_id?: string | null
          notes?: string | null
          price_mode?: string
          price_value: number
          profile_id: string
          slot_date: string
          start_time: string
          treatment_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          booked_appointment_id?: string | null
          category?: string | null
          created_at?: string
          end_time?: string
          id?: string
          location_id?: string | null
          notes?: string | null
          price_mode?: string
          price_value?: number
          profile_id?: string
          slot_date?: string
          start_time?: string
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
      patient_reviews: {
        Row: {
          appointment_id: string | null
          approved: boolean
          body: string
          created_at: string
          id: string
          patient_id: string
          profile_id: string
          rating: number
          title: string | null
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          approved?: boolean
          body: string
          created_at?: string
          id?: string
          patient_id: string
          profile_id: string
          rating: number
          title?: string | null
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          approved?: boolean
          body?: string
          created_at?: string
          id?: string
          patient_id?: string
          profile_id?: string
          rating?: number
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
      patients: {
        Row: {
          created_at: string
          date_of_birth: string | null
          email: string | null
          full_name: string
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
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
      practitioner_subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          id: string
          notes: string | null
          plan_id: string | null
          profile_id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          notes?: string | null
          plan_id?: string | null
          profile_id: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          notes?: string | null
          plan_id?: string | null
          profile_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
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
          deposit_amount_cents: number | null
          deposit_policy_text: string | null
          discount_stack_mode: string
          email: string | null
          email_confirmations_enabled: boolean
          enforce_cancellation_fee: boolean
          favourite_treatment_ids: string[]
          favourites_custom_title: string | null
          favourites_enabled: boolean
          full_name: string | null
          hero_url: string | null
          id: string
          model_slots_position: string
          payment_card_full_enabled: boolean
          payment_clearpay_enabled: boolean
          payment_deposit_enabled: boolean
          payment_klarna_enabled: boolean
          payment_pass_fees_to_customer: boolean
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
          show_prices_on_booking: boolean
          slug: string | null
          sms_reminders_enabled: boolean
          social_links: Json | null
          specialties: string[]
          stripe_connect_account_id: string | null
          stripe_connect_onboarding_status: string | null
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
          deposit_amount_cents?: number | null
          deposit_policy_text?: string | null
          discount_stack_mode?: string
          email?: string | null
          email_confirmations_enabled?: boolean
          enforce_cancellation_fee?: boolean
          favourite_treatment_ids?: string[]
          favourites_custom_title?: string | null
          favourites_enabled?: boolean
          full_name?: string | null
          hero_url?: string | null
          id?: string
          model_slots_position?: string
          payment_card_full_enabled?: boolean
          payment_clearpay_enabled?: boolean
          payment_deposit_enabled?: boolean
          payment_klarna_enabled?: boolean
          payment_pass_fees_to_customer?: boolean
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
          show_prices_on_booking?: boolean
          slug?: string | null
          sms_reminders_enabled?: boolean
          social_links?: Json | null
          specialties?: string[]
          stripe_connect_account_id?: string | null
          stripe_connect_onboarding_status?: string | null
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
          deposit_amount_cents?: number | null
          deposit_policy_text?: string | null
          discount_stack_mode?: string
          email?: string | null
          email_confirmations_enabled?: boolean
          enforce_cancellation_fee?: boolean
          favourite_treatment_ids?: string[]
          favourites_custom_title?: string | null
          favourites_enabled?: boolean
          full_name?: string | null
          hero_url?: string | null
          id?: string
          model_slots_position?: string
          payment_card_full_enabled?: boolean
          payment_clearpay_enabled?: boolean
          payment_deposit_enabled?: boolean
          payment_klarna_enabled?: boolean
          payment_pass_fees_to_customer?: boolean
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
          show_prices_on_booking?: boolean
          slug?: string | null
          sms_reminders_enabled?: boolean
          social_links?: Json | null
          specialties?: string[]
          stripe_connect_account_id?: string | null
          stripe_connect_onboarding_status?: string | null
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
      subscription_plans: {
        Row: {
          active: boolean
          amount_cents: number
          created_at: string
          currency: string
          description: string | null
          id: string
          interval: string
          name: string
          stripe_price_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount_cents: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          interval?: string
          name: string
          stripe_price_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount_cents?: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          interval?: string
          name?: string
          stripe_price_id?: string | null
          updated_at?: string
        }
        Relationships: []
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
          name: string
          parent_id: string | null
          profile_id: string
          slug: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          coming_soon_at?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          parent_id?: string | null
          profile_id: string
          slug?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          coming_soon_at?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          profile_id?: string
          slug?: string | null
          sort_order?: number
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
      treatments: {
        Row: {
          active: boolean | null
          addon_mode: string
          aftercare_delay_hours: number
          aftercare_html: string | null
          allow_split_payment: boolean
          auto_send_aftercare: boolean
          auto_send_medical_forms: boolean
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
          price: number
          profile_id: string
          quiz_tags: Json
          rebook_reminder_days: number | null
          session_count: number
          session_interval_days: number | null
          sort_order: number
          timing_notes: string | null
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
          price: number
          profile_id: string
          quiz_tags?: Json
          rebook_reminder_days?: number | null
          session_count?: number
          session_interval_days?: number | null
          sort_order?: number
          timing_notes?: string | null
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
          price?: number
          profile_id?: string
          quiz_tags?: Json
          rebook_reminder_days?: number | null
          session_count?: number
          session_interval_days?: number | null
          sort_order?: number
          timing_notes?: string | null
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
      cancel_appointment_by_token: {
        Args: { p_token: string }
        Returns: boolean
      }
      create_appointment_consents: {
        Args: { p_appointment_id: string; p_template_ids: string[] }
        Returns: {
          consent_template_id: string
          token: string
        }[]
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
      get_consent_by_token: {
        Args: { p_token: string }
        Returns: {
          appointment_id: string
          clinic_name: string
          consent_id: string
          patient_name: string
          requires_signature: boolean
          scheduled_date: string
          start_time: string
          status: string
          template_body: string
          template_name: string
          treatment_name: string
        }[]
      }
      get_medical_form_by_token: {
        Args: { p_token: string }
        Returns: {
          brand_color: string
          clinic_name: string
          form_id: string
          patient_name: string
          response: Json
          scheduled_date: string
          start_time: string
          status: string
          template_name: string
          template_schema: Json
          treatment_name: string
        }[]
      }
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active_profile: { Args: { _profile_id: string }; Returns: boolean }
      is_active_profile_path: { Args: { path: string }; Returns: boolean }
      is_object_owner: { Args: { path: string }; Returns: boolean }
      is_practitioner_owner: {
        Args: { _practitioner_id: string }
        Returns: boolean
      }
      is_profile_owner: { Args: { _profile_id: string }; Returns: boolean }
      is_slug_available: {
        Args: { p_exclude_id?: string; p_slug: string }
        Returns: boolean
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
      app_role: "practitioner" | "admin"
      appointment_status:
        | "pending"
        | "confirmed"
        | "cancelled"
        | "completed"
        | "no_show"
      payment_mode: "full" | "deposit" | "pay_in_clinic"
      payment_status: "pending" | "paid" | "refunded" | "failed"
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
      app_role: ["practitioner", "admin"],
      appointment_status: [
        "pending",
        "confirmed",
        "cancelled",
        "completed",
        "no_show",
      ],
      payment_mode: ["full", "deposit", "pay_in_clinic"],
      payment_status: ["pending", "paid", "refunded", "failed"],
    },
  },
} as const
