
-- ============ ENUMS ============
DO $$ BEGIN
  CREATE TYPE public.rx_request_status AS ENUM ('pending','awaiting_info','approved','declined','withdrawn');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.rx_event_kind AS ENUM (
    'created','viewed','commented','approved','declined',
    'info_requested','info_provided','message_sent',
    'attachment_added','prescription_issued','withdrawn','status_changed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.rx_chat_message_kind AS ENUM ('text','image','pdf','voice','system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ prescription_requests ============
CREATE TABLE IF NOT EXISTS public.prescription_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prescriber_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES public.clinic_clients(id) ON DELETE SET NULL,
  consultation_id UUID REFERENCES public.consultations(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  consent_id UUID REFERENCES public.appointment_consents(id) ON DELETE SET NULL,
  patient_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  medical_history JSONB NOT NULL DEFAULT '{}'::jsonb,
  treatment_name TEXT NOT NULL,
  product_name TEXT,
  dose TEXT,
  units TEXT,
  area TEXT,
  batch_number TEXT,
  clinical_notes TEXT,
  status public.rx_request_status NOT NULL DEFAULT 'pending',
  prescriber_comments TEXT,
  decline_reason TEXT,
  info_request_note TEXT,
  approved_prescription_id UUID REFERENCES public.prescriptions(id) ON DELETE SET NULL,
  first_response_at TIMESTAMPTZ,
  decided_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rxreq_prescriber ON public.prescription_requests(prescriber_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rxreq_practitioner ON public.prescription_requests(practitioner_id, status, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prescription_requests TO authenticated;
GRANT ALL ON public.prescription_requests TO service_role;
ALTER TABLE public.prescription_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rxreq participants read" ON public.prescription_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = practitioner_id OR auth.uid() = prescriber_id);

CREATE POLICY "rxreq practitioner insert" ON public.prescription_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = practitioner_id);

CREATE POLICY "rxreq participants update" ON public.prescription_requests
  FOR UPDATE TO authenticated
  USING (auth.uid() = practitioner_id OR auth.uid() = prescriber_id)
  WITH CHECK (auth.uid() = practitioner_id OR auth.uid() = prescriber_id);

CREATE POLICY "rxreq practitioner delete pending" ON public.prescription_requests
  FOR DELETE TO authenticated
  USING (auth.uid() = practitioner_id AND status IN ('pending','withdrawn'));

CREATE OR REPLACE FUNCTION public.rxreq_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_rxreq_updated_at ON public.prescription_requests;
CREATE TRIGGER trg_rxreq_updated_at BEFORE UPDATE ON public.prescription_requests
  FOR EACH ROW EXECUTE FUNCTION public.rxreq_touch_updated_at();

-- ============ prescription_request_events (append-only) ============
CREATE TABLE IF NOT EXISTS public.prescription_request_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.prescription_requests(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role TEXT,
  kind public.rx_event_kind NOT NULL,
  summary TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rxreq_events_req ON public.prescription_request_events(request_id, created_at);

GRANT SELECT, INSERT ON public.prescription_request_events TO authenticated;
GRANT ALL ON public.prescription_request_events TO service_role;
ALTER TABLE public.prescription_request_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rxreq_events participants read" ON public.prescription_request_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.prescription_requests r
    WHERE r.id = request_id AND (auth.uid() = r.practitioner_id OR auth.uid() = r.prescriber_id)
  ));

CREATE POLICY "rxreq_events participants insert" ON public.prescription_request_events
  FOR INSERT TO authenticated
  WITH CHECK (
    (actor_id IS NULL OR actor_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.prescription_requests r
      WHERE r.id = request_id AND (auth.uid() = r.practitioner_id OR auth.uid() = r.prescriber_id)
    )
  );

-- ============ prescription_request_attachments ============
CREATE TABLE IF NOT EXISTS public.prescription_request_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.prescription_requests(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('clinical_photo','before','after','consent_pdf','other')),
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rxreq_att_req ON public.prescription_request_attachments(request_id, created_at);

GRANT SELECT, INSERT, DELETE ON public.prescription_request_attachments TO authenticated;
GRANT ALL ON public.prescription_request_attachments TO service_role;
ALTER TABLE public.prescription_request_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rxreq_att participants read" ON public.prescription_request_attachments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.prescription_requests r
    WHERE r.id = request_id AND (auth.uid() = r.practitioner_id OR auth.uid() = r.prescriber_id)
  ));

CREATE POLICY "rxreq_att participants insert" ON public.prescription_request_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.prescription_requests r
      WHERE r.id = request_id AND (auth.uid() = r.practitioner_id OR auth.uid() = r.prescriber_id)
    )
  );

CREATE POLICY "rxreq_att uploader delete" ON public.prescription_request_attachments
  FOR DELETE TO authenticated USING (uploaded_by = auth.uid());

-- ============ rx_chat_threads ============
CREATE TABLE IF NOT EXISTS public.rx_chat_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL UNIQUE REFERENCES public.prescription_requests(id) ON DELETE CASCADE,
  practitioner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prescriber_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.rx_chat_threads TO authenticated;
GRANT ALL ON public.rx_chat_threads TO service_role;
ALTER TABLE public.rx_chat_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rx_threads participants read" ON public.rx_chat_threads
  FOR SELECT TO authenticated
  USING (auth.uid() = practitioner_id OR auth.uid() = prescriber_id);

CREATE POLICY "rx_threads participants insert" ON public.rx_chat_threads
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = practitioner_id OR auth.uid() = prescriber_id);

CREATE POLICY "rx_threads participants update" ON public.rx_chat_threads
  FOR UPDATE TO authenticated
  USING (auth.uid() = practitioner_id OR auth.uid() = prescriber_id)
  WITH CHECK (auth.uid() = practitioner_id OR auth.uid() = prescriber_id);

-- ============ rx_chat_messages ============
CREATE TABLE IF NOT EXISTS public.rx_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.rx_chat_threads(id) ON DELETE CASCADE,
  request_id UUID NOT NULL REFERENCES public.prescription_requests(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  kind public.rx_chat_message_kind NOT NULL DEFAULT 'text',
  body TEXT,
  attachment_path TEXT,
  attachment_mime TEXT,
  attachment_size BIGINT,
  duration_ms INTEGER,
  read_by JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rx_chat_thread ON public.rx_chat_messages(thread_id, created_at);

GRANT SELECT, INSERT, UPDATE ON public.rx_chat_messages TO authenticated;
GRANT ALL ON public.rx_chat_messages TO service_role;
ALTER TABLE public.rx_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rx_messages participants read" ON public.rx_chat_messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.rx_chat_threads t
    WHERE t.id = thread_id AND (auth.uid() = t.practitioner_id OR auth.uid() = t.prescriber_id)
  ));

CREATE POLICY "rx_messages sender insert" ON public.rx_chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.rx_chat_threads t
      WHERE t.id = thread_id AND (auth.uid() = t.practitioner_id OR auth.uid() = t.prescriber_id)
    )
  );

CREATE POLICY "rx_messages read receipts update" ON public.rx_chat_messages
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.rx_chat_threads t
    WHERE t.id = thread_id AND (auth.uid() = t.practitioner_id OR auth.uid() = t.prescriber_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.rx_chat_threads t
    WHERE t.id = thread_id AND (auth.uid() = t.practitioner_id OR auth.uid() = t.prescriber_id)
  ));

ALTER PUBLICATION supabase_realtime ADD TABLE public.rx_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.prescription_request_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.prescription_requests;

CREATE OR REPLACE FUNCTION public.rx_chat_bump_thread()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.rx_chat_threads SET last_message_at = NEW.created_at WHERE id = NEW.thread_id;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_rx_chat_bump ON public.rx_chat_messages;
CREATE TRIGGER trg_rx_chat_bump AFTER INSERT ON public.rx_chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.rx_chat_bump_thread();

-- ============ Role guard on hub_links ============
CREATE OR REPLACE FUNCTION public.hub_links_role_guard()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  req_kind public.hub_owner_kind;
  rec_kind public.hub_owner_kind;
BEGIN
  SELECT owner_kind INTO req_kind FROM public.hub_codes WHERE user_id = NEW.requester_user_id;
  SELECT owner_kind INTO rec_kind FROM public.hub_codes WHERE user_id = NEW.recipient_user_id;
  IF req_kind IS NOT NULL AND rec_kind IS NOT NULL AND req_kind = rec_kind THEN
    RAISE EXCEPTION 'Cannot link two % accounts to each other', req_kind
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_hub_links_role_guard ON public.hub_links;
CREATE TRIGGER trg_hub_links_role_guard BEFORE INSERT ON public.hub_links
  FOR EACH ROW EXECUTE FUNCTION public.hub_links_role_guard();

-- ============ Auto-create chat thread + event on request insert ============
CREATE OR REPLACE FUNCTION public.rxreq_after_insert()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  INSERT INTO public.rx_chat_threads (request_id, practitioner_id, prescriber_id)
  VALUES (NEW.id, NEW.practitioner_id, NEW.prescriber_id)
  ON CONFLICT (request_id) DO NOTHING;

  INSERT INTO public.prescription_request_events (request_id, actor_id, actor_role, kind, summary)
  VALUES (NEW.id, NEW.practitioner_id, 'practitioner', 'created',
          'Prescription request created for ' || NEW.treatment_name);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_rxreq_after_insert ON public.prescription_requests;
CREATE TRIGGER trg_rxreq_after_insert AFTER INSERT ON public.prescription_requests
  FOR EACH ROW EXECUTE FUNCTION public.rxreq_after_insert();

-- ============ Storage RLS for the two new private buckets ============
CREATE POLICY "rx-request-media participants read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'rx-request-media' AND EXISTS (
      SELECT 1 FROM public.prescription_requests r
      WHERE r.id::text = split_part(name, '/', 1)
        AND (auth.uid() = r.practitioner_id OR auth.uid() = r.prescriber_id)
    )
  );

CREATE POLICY "rx-request-media participants write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'rx-request-media' AND EXISTS (
      SELECT 1 FROM public.prescription_requests r
      WHERE r.id::text = split_part(name, '/', 1)
        AND (auth.uid() = r.practitioner_id OR auth.uid() = r.prescriber_id)
    )
  );

CREATE POLICY "rx-request-media owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'rx-request-media' AND owner = auth.uid());

CREATE POLICY "rx-chat-media participants read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'rx-chat-media' AND EXISTS (
      SELECT 1 FROM public.rx_chat_threads t
      WHERE t.id::text = split_part(name, '/', 1)
        AND (auth.uid() = t.practitioner_id OR auth.uid() = t.prescriber_id)
    )
  );

CREATE POLICY "rx-chat-media participants write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'rx-chat-media' AND EXISTS (
      SELECT 1 FROM public.rx_chat_threads t
      WHERE t.id::text = split_part(name, '/', 1)
        AND (auth.uid() = t.practitioner_id OR auth.uid() = t.prescriber_id)
    )
  );

CREATE POLICY "rx-chat-media owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'rx-chat-media' AND owner = auth.uid());
