-- De Data API (PostgREST) kende de tabel beoordeling nog niet: "Could not find
-- the table 'public.beoordeling' in the schema cache". Laat 'm de schemacache
-- opnieuw lezen. Ongevaarlijk als dat al gebeurd was.
notify pgrst, 'reload schema';
