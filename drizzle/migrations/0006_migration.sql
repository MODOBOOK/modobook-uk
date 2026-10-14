create or replace function public.inherit_course_option_practitioners()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.course_group,'') = '' and coalesce(cardinality(new.course_groups),0) = 0 then
    return new;
  end if;
  -- Only fill in when this option has no practitioners of its own yet.
  if exists (select 1 from practitioner_treatments where treatment_id = new.id) then
    return new;
  end if;
  insert into practitioner_treatments (profile_id, practitioner_id, treatment_id)
  select distinct new.profile_id, pt.practitioner_id, new.id
  from treatments s
  join practitioner_treatments pt on pt.treatment_id = s.id
  where s.profile_id = new.profile_id and s.id <> new.id
    and ((coalesce(new.course_group,'') <> '' and s.course_group = new.course_group)
      or (coalesce(cardinality(new.course_groups),0) > 0 and s.course_groups && new.course_groups));
  return new;
end $$;

drop trigger if exists trg_inherit_course_option_practitioners on public.treatments;
create trigger trg_inherit_course_option_practitioners
after insert or update of course_group, course_groups on public.treatments
for each row execute function public.inherit_course_option_practitioners();

-- Backfill: options with no practitioners inherit from the rest of their group.
insert into public.practitioner_treatments (profile_id, practitioner_id, treatment_id)
select distinct t.profile_id, pt.practitioner_id, t.id
from public.treatments t
join public.treatments s on s.profile_id = t.profile_id and s.id <> t.id
  and ((coalesce(t.course_group,'') <> '' and s.course_group = t.course_group)
    or (coalesce(cardinality(t.course_groups),0) > 0 and s.course_groups && t.course_groups))
join public.practitioner_treatments pt on pt.treatment_id = s.id
where not exists (select 1 from public.practitioner_treatments x where x.treatment_id = t.id);