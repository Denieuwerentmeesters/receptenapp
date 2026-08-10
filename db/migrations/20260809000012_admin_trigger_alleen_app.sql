-- De trigger uit migratie 11 blokkeerde élke wijziging van is_admin, ook die van
-- de eigenaar via psql. Daardoor kon je jezelf geen admin maken — precies het
-- enige wat er met die kolom moet gebeuren.
--
-- De bedoeling was: de app mag 'm niet zetten. De app praat als rol
-- `authenticated`; onderhoud via de connectiestring praat als de eigenaar. Dus
-- kijken we naar wie het vraagt in plaats van naar of er iets verandert.

create or replace function public.bewaak_is_admin()
returns trigger
language plpgsql
as $$
begin
  if new.is_admin is distinct from old.is_admin and current_user = 'authenticated' then
    raise exception 'is_admin kan niet vanuit de app gezet worden';
  end if;
  return new;
end;
$$;

comment on function public.bewaak_is_admin() is
  'Houdt tegen dat de app zichzelf adminrechten geeft. Via psql mag het wel.';
