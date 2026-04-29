
UPDATE public.series
SET cover_url = 'https://rjwdxbnsnrahvogcyxld.supabase.co/storage/v1/object/public/chapter-images/seed/' || regexp_replace(cover_url, '^/src/assets/', '')
WHERE cover_url LIKE '/src/assets/%';

UPDATE public.series
SET banner_url = 'https://rjwdxbnsnrahvogcyxld.supabase.co/storage/v1/object/public/chapter-images/seed/' || regexp_replace(banner_url, '^/src/assets/', '')
WHERE banner_url LIKE '/src/assets/%';
