ALTER TABLE public.clinic_clients REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.clinic_clients;