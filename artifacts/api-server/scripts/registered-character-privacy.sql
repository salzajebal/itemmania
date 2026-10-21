-- Preserve legacy descriptions and per-trade snapshots. Backfill only once,
-- when adding private storage; subsequent releases must not reinterpret
-- free-form text in newly registered listings as automatic metadata.
DO $$
DECLARE legacy_schema boolean;
BEGIN
  SELECT NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='products' AND column_name='registered_character_name'
  ) INTO legacy_schema;
  ALTER TABLE products ADD COLUMN IF NOT EXISTS registered_character_name text;
  ALTER TABLE products ADD COLUMN IF NOT EXISTS character_name_in_description boolean NOT NULL DEFAULT false;
  IF legacy_schema THEN
    WITH legacy AS (
      SELECT id, regexp_match(description, '(^|\n)(캐릭터명|인게임 닉네임)[[:blank:]]*:[[:blank:]]*([^\r\n]*)$') AS parts
      FROM products WHERE category='buy' AND itemmania_id LIKE 'user_%'
    )
    UPDATE products p SET registered_character_name=btrim(legacy.parts[3]),
      character_name_in_description=true
    FROM legacy WHERE p.id=legacy.id AND legacy.parts IS NOT NULL
      AND btrim(legacy.parts[3]) <> '';
  END IF;
END $$;
