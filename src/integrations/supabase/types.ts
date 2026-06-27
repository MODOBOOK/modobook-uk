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
      appointments: {
        Row: {
          addon_ids: string[] | null
          base_amount: number | null
          consent_signed_url: string | null
          created_at: string
          end_time: string
          id: string
          location_id: string | null
          notes: string | null
          package_purchase_id: string | null
          patient_address: Json | null
          patient_dob: string | null
          patient_email: string
          patient_name: string
          patient_phone: string | null
          payment_method: string | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
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
          base_amount?: number | null
          consent_signed_url?: string | null
          created_at?: string
          end_time: string
          id?: string
          location_id?: string | null
          notes?: string | null
          package_purchase_id?: string | null
          patient_address?: Json | null
          patient_dob?: string | null
          patient_email: string
          patient_name: string
          patient_phone?: string | null
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
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
          base_amount?: number | null
          consent_signed_url?: string | null
          created_at?: string
          end_time?: string
          id?: string
          location_id?: string | null
          notes?: string | null
          package_purchase_id?: string | null
          patient_address?: Json | null
          patient_dob?: string | null
          patient_email?: string
          patient_name?: string
          patient_phone?: string | null
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
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
            foreignKeyName: "appointments_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
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
          created_at: string
          custom_css: string | null
          favicon_url: string | null
          footer_bg_color: string
          footer_text_color: string
          header_bg_color: string
          header_text_color: string
          heading_font: string
          hero_heading: string | null
          hero_image_url: string | null
          hero_subheading: string | null
          id: string
          logo_url: string | null
          primary_color: string
          profile_id: string
          text_color: string
          updated_at: string
        }
        Insert: {
          accent_color?: string
          background_color?: string
          body_font?: string
          created_at?: string
          custom_css?: string | null
          favicon_url?: string | null
          footer_bg_color?: string
          footer_text_color?: string
          header_bg_color?: string
          header_text_color?: string
          heading_font?: string
          hero_heading?: string | null
          hero_image_url?: string | null
          hero_subheading?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string
          profile_id: string
          text_color?: string
          updated_at?: string
        }
        Update: {
          accent_color?: string
          background_color?: string
          body_font?: string
          created_at?: string
          custom_css?: string | null
          favicon_url?: string | null
          footer_bg_color?: string
          footer_text_color?: string
          header_bg_color?: string
          header_text_color?: string
          heading_font?: string
          hero_heading?: string | null
          hero_image_url?: string | null
          hero_subheading?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string
          profile_id?: string
          text_color?: string
          updated_at?: string
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
      consent_templates: {
        Row: {
          body_markdown: string
          created_at: string
          id: string
          is_system: boolean
          name: string
          profile_id: string | null
          requires_signature: boolean
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
      medical_form_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          name: string
          profile_id: string | null
          schema: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          profile_id?: string | null
          schema?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          profile_id?: string | null
          schema?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_form_templates_profile_id_fkey"
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
          created_at: string
          expiry_days: number | null
          id: string
          name: string
          price: number
          profile_id: string
          session_count: number
          treatment_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          expiry_days?: number | null
          id?: string
          name: string
          price: number
          profile_id: string
          session_count: number
          treatment_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          created_at?: string
          expiry_days?: number | null
          id?: string
          name?: string
          price?: number
          profile_id?: string
          session_count?: number
          treatment_id?: string | null
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
      profiles: {
        Row: {
          about: string | null
          active: boolean | null
          address: Json | null
          avatar_url: string | null
          bio: string | null
          brand_color: string | null
          clinic_name: string | null
          created_at: string
          email: string | null
          full_name: string | null
          hero_url: string | null
          id: string
          phone: string | null
          qualifications: Json
          role: Database["public"]["Enums"]["app_role"]
          slug: string | null
          social_links: Json | null
          specialties: string[]
          stripe_connect_account_id: string | null
          stripe_connect_onboarding_status: string | null
          tagline: string | null
          timeline: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          about?: string | null
          active?: boolean | null
          address?: Json | null
          avatar_url?: string | null
          bio?: string | null
          brand_color?: string | null
          clinic_name?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          hero_url?: string | null
          id?: string
          phone?: string | null
          qualifications?: Json
          role?: Database["public"]["Enums"]["app_role"]
          slug?: string | null
          social_links?: Json | null
          specialties?: string[]
          stripe_connect_account_id?: string | null
          stripe_connect_onboarding_status?: string | null
          tagline?: string | null
          timeline?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          about?: string | null
          active?: boolean | null
          address?: Json | null
          avatar_url?: string | null
          bio?: string | null
          brand_color?: string | null
          clinic_name?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          hero_url?: string | null
          id?: string
          phone?: string | null
          qualifications?: Json
          role?: Database["public"]["Enums"]["app_role"]
          slug?: string | null
          social_links?: Json | null
          specialties?: string[]
          stripe_connect_account_id?: string | null
          stripe_connect_onboarding_status?: string | null
          tagline?: string | null
          timeline?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      treatment_addons: {
        Row: {
          addon_id: string
          created_at: string
          id: string
          treatment_id: string
        }
        Insert: {
          addon_id: string
          created_at?: string
          id?: string
          treatment_id: string
        }
        Update: {
          addon_id?: string
          created_at?: string
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
      treatment_categories: {
        Row: {
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
      treatments: {
        Row: {
          active: boolean | null
          category_id: string | null
          consent_form_url: string | null
          created_at: string
          deductible_against: string[] | null
          deductible_window_days: number | null
          deposit_amount: number | null
          description: string | null
          duration: number
          id: string
          is_consultation: boolean | null
          name: string
          payment_mode: Database["public"]["Enums"]["payment_mode"]
          picture_url: string | null
          price: number
          profile_id: string
          timing_notes: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          category_id?: string | null
          consent_form_url?: string | null
          created_at?: string
          deductible_against?: string[] | null
          deductible_window_days?: number | null
          deposit_amount?: number | null
          description?: string | null
          duration: number
          id?: string
          is_consultation?: boolean | null
          name: string
          payment_mode?: Database["public"]["Enums"]["payment_mode"]
          picture_url?: string | null
          price: number
          profile_id: string
          timing_notes?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          category_id?: string | null
          consent_form_url?: string | null
          created_at?: string
          deductible_against?: string[] | null
          deductible_window_days?: number | null
          deposit_amount?: number | null
          description?: string | null
          duration?: number
          id?: string
          is_consultation?: boolean | null
          name?: string
          payment_mode?: Database["public"]["Enums"]["payment_mode"]
          picture_url?: string | null
          price?: number
          profile_id?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
      get_public_profile_by_slug: {
        Args: { p_slug: string }
        Returns: {
          about: string
          active: boolean
          address: Json
          avatar_url: string
          bio: string
          brand_color: string
          clinic_name: string
          created_at: string
          full_name: string
          hero_url: string
          id: string
          qualifications: Json
          slug: string
          social_links: Json
          specialties: string[]
          tagline: string
          timeline: Json
          updated_at: string
        }[]
      }
      is_active_profile: { Args: { _profile_id: string }; Returns: boolean }
      is_active_profile_path: { Args: { path: string }; Returns: boolean }
      is_object_owner: { Args: { path: string }; Returns: boolean }
      is_profile_owner: { Args: { _profile_id: string }; Returns: boolean }
      is_slug_available: {
        Args: { p_exclude_id?: string; p_slug: string }
        Returns: boolean
      }
      submit_consent: {
        Args: {
          p_signature_data: string
          p_signature_name: string
          p_token: string
        }
        Returns: boolean
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
