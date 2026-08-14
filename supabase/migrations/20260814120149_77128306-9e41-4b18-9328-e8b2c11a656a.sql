CREATE TABLE public.associate_documents (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.clinic_associates(id) on delete cascade,
  clinic_profile_id uuid not null references public.profiles(id) on delete cascade,
  associate_profile_id uuid references public.profiles(id) on delete set null,
  kind text not null default 'other',
  title text not null,
  reference_number text,
  outcome text,
  issued_on date,
  expires_on date,
  file_path text,
  file_name text,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.associate_documents TO authenticated;
GRANT ALL ON public.associate_documents TO service_role;
ALTER TABLE public.associate_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic and associate can view associate documents"
ON public.associate_documents FOR SELECT TO authenticated
USING (
  clinic_profile_id = public._profile_id_for_user(auth.uid())
  OR associate_profile_id = public._profile_id_for_user(auth.uid())
);

CREATE POLICY "Clinic can manage associate documents"
ON public.associate_documents FOR ALL TO authenticated
USING (clinic_profile_id = public._profile_id_for_user(auth.uid()))
WITH CHECK (clinic_profile_id = public._profile_id_for_user(auth.uid()));

CREATE TABLE public.associate_meetings (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.clinic_associates(id) on delete cascade,
  clinic_profile_id uuid not null references public.profiles(id) on delete cascade,
  associate_profile_id uuid references public.profiles(id) on delete set null,
  met_at timestamptz not null default now(),
  title text not null,
  attendees text,
  notes text,
  actions text,
  next_meeting_on date,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.associate_meetings TO authenticated;
GRANT ALL ON public.associate_meetings TO service_role;
ALTER TABLE public.associate_meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic and associate can view associate meetings"
ON public.associate_meetings FOR SELECT TO authenticated
USING (
  clinic_profile_id = public._profile_id_for_user(auth.uid())
  OR associate_profile_id = public._profile_id_for_user(auth.uid())
);

CREATE POLICY "Clinic can manage associate meetings"
ON public.associate_meetings FOR ALL TO authenticated
USING (clinic_profile_id = public._profile_id_for_user(auth.uid()))
WITH CHECK (clinic_profile_id = public._profile_id_for_user(auth.uid()));

CREATE INDEX idx_associate_documents_link ON public.associate_documents(link_id);
CREATE INDEX idx_associate_meetings_link ON public.associate_meetings(link_id);

CREATE TRIGGER update_associate_documents_updated_at BEFORE UPDATE ON public.associate_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_associate_meetings_updated_at BEFORE UPDATE ON public.associate_meetings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();