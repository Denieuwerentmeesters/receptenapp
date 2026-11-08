-- Citroensap is gewoon citroenen (Reinoud, 8 nov 2026): in een recept gaat het
-- om het sap van een verse citroen, niet om het flesje. De mapping wijst nu
-- naar dezelfde citroenen als "citroen" (AH Citroen, Jumbo Citroenen 500 g,
-- met de biologische variant). Achterwaarts veilig: alleen andere nummers.
update ah_product_cache
set weergavenaam = 'ah citroen', standaard_product_id = 565851, bio_product_id = 577892,
    laatst_geverifieerd = now()
where ingredient_key = 'citroensap';

update jumbo_product_cache
set weergavenaam = 'Jumbo Citroenen 500 g', standaard_sku = '764387STK', bio_sku = '159388PAK',
    laatst_geverifieerd = now()
where ingredient_key = 'citroensap';
