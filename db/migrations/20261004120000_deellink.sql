-- Een recept delen via een link naar de website (/r/<id>), ook met iemand die
-- geen account heeft. De pagina wordt gemaakt door api/recept.ts, die met
-- DATABASE_URL leest en dus zelf bepaalt wat openbaar is:
--
--   * recepten uit de gedeelde pool en goedgekeurd gedeelde recepten: altijd;
--   * een eigen recept (eigen_input, samengesteld): pas als de eigenaar er zelf
--     een link voor maakte. Dat moment staat in deellink_sinds.
--
-- Het id is een willekeurige uuid en dus niet te raden; de kolom zorgt dat een
-- privérecept pas leesbaar wordt als je er zelf voor kiest.
--
-- Dit staat los van deel_status: dat gaat over de gedeelde pool (Ontdekken,
-- weekmenu), dit alleen over wie de link heeft.

alter table recepten add column deellink_sinds timestamptz;

comment on column recepten.deellink_sinds is
  'Sinds wanneer dit recept via /r/<id> te lezen is voor wie de link heeft; null = geen link.';

-- Kookboekrecepten: ook niet via een link (plan §7.3, auteursrecht). Een
-- openbare webpagina is net zo goed publiceren.
alter table recepten add constraint kookboek_geen_deellink
  check (bron_type <> 'kookboek_foto' or deellink_sinds is null);
