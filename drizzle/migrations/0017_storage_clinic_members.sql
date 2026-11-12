CREATE OR REPLACE FUNCTION public.is_object_owner(path text)
 RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare pid uuid;
begin
  pid := (split_part(path, '/', 1))::uuid;
  return public.is_profile_owner(pid) OR public.is_clinic_member(pid);
exception when others then
  return false;
end;
$function$;