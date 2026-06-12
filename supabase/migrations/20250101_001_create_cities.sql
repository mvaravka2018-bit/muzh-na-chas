-- Migration: cities table with multi-city support and RLS

CREATE TABLE IF NOT EXISTS cities (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text UNIQUE NOT NULL,
  name            text NOT NULL,
  bot_token       text NOT NULL,
  bot_username    text NOT NULL,
  timezone        text NOT NULL DEFAULT 'Europe/Moscow',
  commission_rate numeric(4,2) NOT NULL DEFAULT 0.05,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cities_slug ON cities(slug);
CREATE INDEX IF NOT EXISTS idx_cities_is_active ON cities(is_active);

ALTER TABLE cities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cities_select_active" ON cities;
CREATE POLICY "cities_select_active" ON cities FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "cities_all_superadmin" ON cities;
CREATE POLICY "cities_all_superadmin" ON cities FOR ALL
  USING (auth.jwt() ->> 'role' = 'superadmin')
  WITH CHECK (auth.jwt() ->> 'role' = 'superadmin');
