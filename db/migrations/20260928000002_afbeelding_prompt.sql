-- Receptafbeeldingen (plan §6): bewaar de prompt waarmee een afbeelding is
-- gegenereerd. Zo is later te zien welke combinaties van hoek, vaatwerk en
-- ondergrond goed werkten, en kan een tegenvallend beeld gericht overgedaan
-- worden. Alleen gevuld bij afbeelding_bron = 'gegenereerd'.

alter table recepten add column afbeelding_prompt text;

comment on column recepten.afbeelding_prompt is
  'De prompt waarmee de afbeelding is gegenereerd (lib/afbeeldingen/prompt.ts). Null bij eigen foto''s.';
