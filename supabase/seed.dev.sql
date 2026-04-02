-- Local/dev/demo seed data.
-- Loaded automatically by `supabase db reset` because `config.toml`
-- points the local CLI seed config at this file.

insert into public.admin_emails (email)
values ('admin@kochbuch.local')
on conflict (email) do update
  set updated_at = now();

insert into public.recipes (
  title,
  base_servings,
  prep_time,
  cook_time,
  tags,
  description,
  raw_ingredients,
  parsed_ingredients,
  instructions,
  plating,
  tips,
  external_image_url
)
values (
  'Familien-Pasta',
  4,
  15,
  20,
  array['Pasta', 'Familie', 'Schnell'],
  'Ein einfaches Startrezept fuer das gemeinsame Kochbuch.',
  '400 g Pasta
200 g Speck
3 Eier
80 g Parmesan',
  '[{"quantity":400,"unit":"g","name":"Pasta"},{"quantity":200,"unit":"g","name":"Speck"},{"quantity":3,"unit":"stück","name":"Eier"},{"quantity":80,"unit":"g","name":"Parmesan"}]'::jsonb,
  'Pasta kochen. Speck anbraten. Eier und Parmesan verruehren. Alles zusammenziehen und servieren.',
  'Mit etwas Parmesan und Pfeffer anrichten.',
  'Bei Bedarf etwas Pastawasser zugeben.',
  null
),
(
  'Gemuesesuppe',
  4,
  20,
  35,
  array['Suppe', 'Vegetarisch'],
  'Eine zweite Beispielkarte fuer die Basissammlung.',
  '2 Karotten
1 Lauch
1 Zwiebel
1 l Bruhe',
  '[{"quantity":2,"unit":"stück","name":"Karotten"},{"quantity":1,"unit":"stück","name":"Lauch"},{"quantity":1,"unit":"stück","name":"Zwiebel"},{"quantity":1,"unit":"l","name":"Bruhe"}]'::jsonb,
  'Gemuse schneiden. Kurz anschwitzen. Mit Bruhe aufgiessen. Kochen lassen und abschmecken.',
  'Mit frischen Kraeutern servieren.',
  'Funktioniert gut als Vorratsrezept.',
  null
)
on conflict do nothing;
