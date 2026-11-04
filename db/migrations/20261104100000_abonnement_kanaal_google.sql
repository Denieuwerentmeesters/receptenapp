-- Kookmaatje Plus kan nu ook via Google Play (Android-app, RevenueCat).
-- Alleen verruimen: de oude app en de bestaande rijen blijven gewoon werken.

alter table abonnement drop constraint if exists abonnement_kanaal_check;
alter table abonnement
  add constraint abonnement_kanaal_check
  check (kanaal in ('apple', 'google', 'stripe', 'handmatig'));
