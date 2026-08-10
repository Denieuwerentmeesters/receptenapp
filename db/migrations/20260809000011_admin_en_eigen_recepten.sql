-- Adminrol en de goedkeuringswachtrij uit plan §7.7.
--
-- Wat een admin wél mag: aangemelde recepten van anderen goedkeuren of
-- afwijzen, en zijn eigen creaties meteen in de gedeelde pool zetten.
--
-- Wat een admin níét mag: kookboekrecepten delen. Dat is geen permissiekwestie
-- maar een auteursrechtkwestie (plan §7.3, §7.6) — een recept uit een boek is
-- niet van jou om te herpubliceren, ook niet als je de app hebt gebouwd. De
-- check `kookboek_altijd_prive` op de tabel dwingt dat af, en die geldt voor
-- iedereen. Wil je een gerecht uit een boek tóch delen, voeg het dan toe als
-- 'eigen_input' met een bereiding in je eigen woorden: een ingrediëntenlijst is
-- niet beschermd, de geschreven tekst wel.

alter table gebruiker add column is_admin boolean not null default false;

comment on column gebruiker.is_admin is
  'Mag gedeelde recepten van anderen goedkeuren. Handmatig zetten, geen UI voor.';

-- Leesbaar in een policy, en zonder auth-schema in de body — die valkuil kennen
-- we inmiddels (zie 20260809000006).
create function public.is_admin(p_user_id text)
returns boolean
language sql
stable
as $$
  select coalesce((select is_admin from public.gebruiker where id = p_user_id), false);
$$;

grant execute on function public.is_admin(text) to authenticated;

-- ----------------------------------------------------- goedkeuringswachtrij

-- Een admin ziet alles wat aangemeld is, ook van anderen.
create policy "admin ziet aanmeldingen" on recepten
  for select to authenticated using (
    deel_status = 'aangevraagd' and public.is_admin(auth.user_id())
  );

-- En mag alleen de deel_status ervan omzetten.
create policy "admin keurt goed of af" on recepten
  for update to authenticated
  using (deel_status = 'aangevraagd' and public.is_admin(auth.user_id()))
  with check (public.is_admin(auth.user_id()));

-- --------------------------------------------------------------- gebruiker

-- De app moet kunnen zien of jij admin bent; je eigen rij lezen mocht al.
-- Niets extra's nodig, maar we maken expliciet dat is_admin niet zelf te zetten
-- is: de update-policy op gebruiker staat alleen je eigen rij toe, en een
-- trigger houdt de vlag tegen.
create function public.bewaak_is_admin()
returns trigger
language plpgsql
as $$
begin
  if new.is_admin is distinct from old.is_admin then
    raise exception 'is_admin kan niet vanuit de app gezet worden';
  end if;
  return new;
end;
$$;

create trigger gebruiker_is_admin_vast
  before update on gebruiker
  for each row execute function public.bewaak_is_admin();
