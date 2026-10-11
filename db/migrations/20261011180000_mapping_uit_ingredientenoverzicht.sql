-- Mapping-correcties uit het ingrediëntenoverzicht (ingredienten.xlsx, tabblad
-- Dubbele lijstregels), door Reinoud nagekeken op ah.nl op 11 oktober 2026.
-- Jumbo: het vergelijkbare product, opgezocht op jumbo.com.
--
-- Fouten die eruit zijn: "tomaat uit blik" en "tomaatjes uit blik" gaven verse
-- tomaten, "mais" gaf doperwten, "stokbrood" kruidenboterstokbrood, "penne" en
-- "tagliatelle" de volkorenversie, "spek" ontbijtspek, "gyoza" kip.
-- Nieuwe sleutels: jong belegen kaas in plakken, zalmfilet met vel, gepelde
-- tomaten uit blik, gyoza velletje. Alle nummers staan bij AH op IN_ASSORTMENT.
-- Achterwaarts veilig: alleen andere nummers en nieuwe rijen.

insert into ah_product_cache (ingredient_key, weergavenaam, standaard_product_id, bio_product_id, laatst_geverifieerd)
values
  ('tomaat uit blik', 'ah biologisch tomaten gepeld 400 g', 207510, 207510, now()),
  ('tomaatjes uit blik', 'mutti tomates cerises 400 g', 234870, null, now()),
  ('zoete cherrytomaatjes aan tak', 'ah sweet cherry cherrytomaten 250 g', 165583, null, now()),
  ('jong belegen kaas in plakken', 'de zaanse hoeve jong belegen 48+ plakken voordeelpak 400 g', 197227, null, now()),
  ('zalmfilet met vel', 'ah zalmfilet op huid', 132045, null, now()),
  ('penne', 'ah penne 500 g', 543590, null, now()),
  ('gepelde tomaten', 'ah biologisch tomaten gepeld 400 g', 207510, 207510, now()),
  ('gepelde tomaten uit blik', 'ah biologisch tomaten gepeld 400 g', 207510, 207510, now()),
  ('mais', 'ah biologisch maiskorrels 0% zout toegevoegd 150 g', 583799, 583799, now()),
  ('tagliatelle', 'ah tagliatelle 500 g', 62024, null, now()),
  ('stokbrood', 'ah biologisch frans stokbrood wit', 600958, 600958, now()),
  ('toast', 'ah borreltoast zeezout 125 g', 480505, null, now()),
  ('toast om te serveren', 'ah borreltoast zeezout 125 g', 480505, null, now()),
  ('pandanrijst', 'ah biologisch pandan rijst 400 g', 525395, 525395, now()),
  ('oude kaas', 'ah goudse oud 48+ geraspt', 3853, null, now()),
  ('diepvriesspinazie', 'ah biologisch bladspinazie deelblokjes 450 g (diepvries)', 409997, 409997, now()),
  ('blokjes diepvriesspinazie', 'ah biologisch bladspinazie deelblokjes 450 g (diepvries)', 409997, 409997, now()),
  ('spek', 'ah biologisch spekreepjes gerookt 200 g', 130257, 130257, now()),
  ('gyoza', 'bibigo gyoza vegan korean style bbq 300 g', 565212, null, now()),
  ('gyoza velletje', 'happy belly gyoza vellen 300 g', 234565, null, now())
on conflict (ingredient_key) do update set
  weergavenaam = excluded.weergavenaam,
  standaard_product_id = excluded.standaard_product_id,
  bio_product_id = excluded.bio_product_id,
  laatst_geverifieerd = excluded.laatst_geverifieerd;

insert into ah_verpakking (product_id, inhoud, eenheid)
values
  (207510, 400, 'g'),
  (234870, 400, 'g'),
  (165583, 250, 'g'),
  (197227, 400, 'g'),
  (132045, 300, 'g'),
  (543590, 500, 'g'),
  (583799, 150, 'g'),
  (62024, 500, 'g'),
  (600958, 1, 'stuks'),
  (480505, 125, 'g'),
  (525395, 400, 'g'),
  (3853, 175, 'g'),
  (409997, 450, 'g'),
  (130257, 200, 'g'),
  (565212, 300, 'g'),
  (234565, 300, 'g')
on conflict (product_id) do update set inhoud = excluded.inhoud, eenheid = excluded.eenheid;

insert into jumbo_product_cache (ingredient_key, weergavenaam, standaard_sku, bio_sku)
values
  ('tomaat uit blik', 'Jumbo Biologisch Tomaten Gepeld 400 g', '164091BLK', '164091BLK'),
  ('tomaatjes uit blik', 'Mutti Cherry Tomaten 400g', '648083BLK', null),
  ('jong belegen kaas in plakken', 'Jumbo Jong Belegen Kaas 48+ Plakken Voordeelverpakking 400 g', '203773STK', null),
  ('zalmfilet met vel', 'Jumbo Zalmfilet met Huid Naturel ca. 270 g', '715172STK', null),
  ('gepelde tomaten', 'Jumbo Biologisch Tomaten Gepeld 400 g', '164091BLK', '164091BLK'),
  ('gepelde tomaten uit blik', 'Jumbo Biologisch Tomaten Gepeld 400 g', '164091BLK', '164091BLK'),
  ('mais', 'Jumbo Biologische Maïskorrels 200 g', '692596PAK', '692596PAK'),
  ('stokbrood', 'Jumbo Frans Stokbrood Wit 220 g', '660528STK', null),
  ('toast', 'Jumbo Knapperige Toast 100 g', '478040ZK', null),
  ('toast om te serveren', 'Jumbo Knapperige Toast 100 g', '478040ZK', null),
  ('pandanrijst', 'Jumbo Geurige Pandanrijst 400 g', '391687STK', '491953DS'),
  ('oude kaas', 'Jumbo Geraspt Kaas Oud 48+ 175 g', '395039ZK', null),
  ('spek', 'Jumbo Gerookte Spek Reepjes 250 g', '679081TRA', null),
  ('gyoza', 'Bibigo Gyoza Vegan Korean Style BBQ 300 g', '595073ZK', null),
  ('gyoza velletje', 'Happy Belly Gyoza Vellen 300g', '697735ZK', null)
on conflict (ingredient_key) do update set
  weergavenaam = excluded.weergavenaam,
  standaard_sku = excluded.standaard_sku,
  bio_sku = excluded.bio_sku,
  laatst_geverifieerd = now();

insert into jumbo_verpakking (sku, inhoud, eenheid)
values
  ('164091BLK', 400, 'g'),
  ('648083BLK', 400, 'g'),
  ('203773STK', 400, 'g'),
  ('715172STK', 270, 'g'),
  ('692596PAK', 200, 'g'),
  ('660528STK', 220, 'g'),
  ('478040ZK', 100, 'g'),
  ('391687STK', 400, 'g'),
  ('491953DS', 400, 'g'),
  ('395039ZK', 175, 'g'),
  ('679081TRA', 250, 'g'),
  ('595073ZK', 300, 'g'),
  ('697735ZK', 300, 'g')
on conflict (sku) do update set inhoud = excluded.inhoud, eenheid = excluded.eenheid;
