-- Migration: masters, master_categories, master_portfolio, master_applications with RLS

CREATE TABLE IF NOT EXISTS masters (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid UNIQUE NOT NULL REFERENCES users(id),
  city_id         uuid NOT NULL REFERENCES cities(id),
  bio             text,
  experience_years int NOT NULL DEFAULT 0,
  is_verified     boolean NOT NULL DEFAULT false,
  verified_at     timestamptz,
  verified_by     uuid REFERENCES users(id),
  is_available    boolean NOT NULL DEFAULT true,
  rating          numeric(3,2) NOT NULL DEFAULT 0.00,
  reviews_count   int NOT NULL DEFAULT 0,
  balance         numeric(10,2) NOT NULL DEFAULT 0.00,
  total_earned    numeric(10,2) NOT NULL DEFAULT 0.00,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_masters_city_id ON masters(city_id);
CREATE INDEX IF NOT EXISTS idx_masters_user_id ON masters(user_id);
CREATE INDEX IF NOT EXISTS idx_masters_is_verified ON masters(is_verified);
CREATE INDEX IF NOT EXISTS idx_masters_is_available ON masters(is_available);

CREATE TABLE IF NOT EXISTS master_categories (
  master_id   uuid NOT NULL REFERENCES masters(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  custom_price numeric(10,2),
  PRIMARY KEY (master_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_master_categories_category_id ON master_categories(category_id);

CREATE TABLE IF NOT EXISTS master_portfolio (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id   uuid NOT NULL REFERENCES masters(id) ON DELETE CASCADE,
  image_url   text NOT NULL,
  caption     text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_master_portfolio_master_id ON master_portfolio(master_id);

CREATE TABLE IF NOT EXISTS master_applications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id),
  city_id     uuid NOT NULL REFERENCES cities(id),
  full_name   text NOT NULL,
  phone       text NOT NULL,
  experience  text NOT NULL,
  category_ids uuid[] NOT NULL,
  status      text NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','approved','rejected')),
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_master_applications_city_id ON master_applications(city_id);
CREATE INDEX IF NOT EXISTS idx_master_applications_status ON master_applications(status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_master_applications_pending_user
  ON master_applications(user_id) WHERE status = 'pending';

-- RLS: masters
ALTER TABLE masters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "masters_select_verified" ON masters;
CREATE POLICY "masters_select_verified" ON masters FOR SELECT
  USING (is_verified = true);

DROP POLICY IF EXISTS "masters_select_own" ON masters;
CREATE POLICY "masters_select_own" ON masters FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "masters_update_own" ON masters;
CREATE POLICY "masters_update_own" ON masters FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid() AND
    is_verified = (SELECT is_verified FROM masters m WHERE m.id = masters.id) AND
    rating = (SELECT rating FROM masters m WHERE m.id = masters.id) AND
    balance = (SELECT balance FROM masters m WHERE m.id = masters.id)
  );

DROP POLICY IF EXISTS "masters_all_admin" ON masters;
CREATE POLICY "masters_all_admin" ON masters FOR ALL
  USING (
    auth.jwt() ->> 'role' = 'superadmin' OR
    (auth.jwt() ->> 'role' = 'city_admin' AND city_id::text = auth.jwt() ->> 'city_id')
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'superadmin' OR
    (auth.jwt() ->> 'role' = 'city_admin' AND city_id::text = auth.jwt() ->> 'city_id')
  );

-- RLS: master_categories
ALTER TABLE master_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "master_categories_select_all" ON master_categories;
CREATE POLICY "master_categories_select_all" ON master_categories FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "master_categories_modify_own" ON master_categories;
CREATE POLICY "master_categories_modify_own" ON master_categories FOR ALL
  USING (master_id IN (SELECT id FROM masters WHERE user_id = auth.uid()))
  WITH CHECK (master_id IN (SELECT id FROM masters WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "master_categories_all_admin" ON master_categories;
CREATE POLICY "master_categories_all_admin" ON master_categories FOR ALL
  USING (auth.jwt() ->> 'role' IN ('city_admin','superadmin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('city_admin','superadmin'));

-- RLS: master_portfolio
ALTER TABLE master_portfolio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "master_portfolio_select_all" ON master_portfolio;
CREATE POLICY "master_portfolio_select_all" ON master_portfolio FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "master_portfolio_modify_own" ON master_portfolio;
CREATE POLICY "master_portfolio_modify_own" ON master_portfolio FOR ALL
  USING (master_id IN (SELECT id FROM masters WHERE user_id = auth.uid()))
  WITH CHECK (master_id IN (SELECT id FROM masters WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "master_portfolio_all_admin" ON master_portfolio;
CREATE POLICY "master_portfolio_all_admin" ON master_portfolio FOR ALL
  USING (auth.jwt() ->> 'role' IN ('city_admin','superadmin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('city_admin','superadmin'));

-- RLS: master_applications
ALTER TABLE master_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "master_applications_select_own" ON master_applications;
CREATE POLICY "master_applications_select_own" ON master_applications FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "master_applications_insert_own" ON master_applications;
CREATE POLICY "master_applications_insert_own" ON master_applications FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "master_applications_all_admin" ON master_applications;
CREATE POLICY "master_applications_all_admin" ON master_applications FOR ALL
  USING (
    auth.jwt() ->> 'role' = 'superadmin' OR
    (auth.jwt() ->> 'role' = 'city_admin' AND city_id::text = auth.jwt() ->> 'city_id')
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'superadmin' OR
    (auth.jwt() ->> 'role' = 'city_admin' AND city_id::text = auth.jwt() ->> 'city_id')
  );
