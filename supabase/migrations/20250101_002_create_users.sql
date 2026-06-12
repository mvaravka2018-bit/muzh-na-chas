-- Migration: users table with RLS

CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id   bigint UNIQUE NOT NULL,
  city_id       uuid NOT NULL REFERENCES cities(id),
  role          text NOT NULL DEFAULT 'client'
                CHECK (role IN ('client','master','city_admin','superadmin')),
  first_name    text NOT NULL,
  last_name     text,
  username      text,
  phone         text,
  avatar_url    text,
  is_blocked    boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_users_city_id ON users(city_id);
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own" ON users;
CREATE POLICY "users_select_own" ON users FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "users_update_own" ON users;
CREATE POLICY "users_update_own" ON users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "users_all_admin" ON users;
CREATE POLICY "users_all_admin" ON users FOR ALL
  USING (
    auth.jwt() ->> 'role' = 'superadmin' OR
    (auth.jwt() ->> 'role' = 'city_admin' AND city_id::text = auth.jwt() ->> 'city_id')
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'superadmin' OR
    (auth.jwt() ->> 'role' = 'city_admin' AND city_id::text = auth.jwt() ->> 'city_id')
  );
