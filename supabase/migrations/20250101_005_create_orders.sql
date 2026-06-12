-- Migration: orders, order_photos, order_status_history with RLS and status history trigger

CREATE TYPE order_status AS ENUM (
  'pending',
  'accepted',
  'in_progress',
  'completed',
  'confirmed',
  'cancelled',
  'disputed'
);

CREATE TABLE IF NOT EXISTS orders (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id           uuid NOT NULL REFERENCES cities(id),
  client_id         uuid NOT NULL REFERENCES users(id),
  master_id         uuid REFERENCES masters(id),
  category_id       uuid NOT NULL REFERENCES categories(id),
  description       text NOT NULL,
  address           text NOT NULL,
  lat               numeric(9,6),
  lng               numeric(9,6),
  scheduled_at      timestamptz NOT NULL,
  status            order_status NOT NULL DEFAULT 'pending',
  total_amount      numeric(10,2),
  commission_amount numeric(10,2),
  payment_type      text NOT NULL DEFAULT 'cash'
                    CHECK (payment_type IN ('cash','online')),
  client_note       text,
  master_note       text,
  cancelled_by      uuid REFERENCES users(id),
  cancel_reason     text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  accepted_at       timestamptz,
  completed_at      timestamptz,
  confirmed_at      timestamptz
);

CREATE INDEX IF NOT EXISTS idx_orders_city_id ON orders(city_id);
CREATE INDEX IF NOT EXISTS idx_orders_client_id ON orders(client_id);
CREATE INDEX IF NOT EXISTS idx_orders_master_id ON orders(master_id);
CREATE INDEX IF NOT EXISTS idx_orders_category_id ON orders(category_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_scheduled_at ON orders(scheduled_at);

CREATE TABLE IF NOT EXISTS order_photos (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id  uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_photos_order_id ON order_photos(order_id);

CREATE TABLE IF NOT EXISTS order_status_history (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status     order_status NOT NULL,
  changed_by uuid REFERENCES users(id),
  note       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON order_status_history(order_id);

-- Trigger: записывать историю статусов при создании и изменении заказа
CREATE OR REPLACE FUNCTION fn_order_status_history()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO order_status_history(order_id, status, changed_by, note)
    VALUES (NEW.id, NEW.status, NEW.client_id, 'order_created');
  ELSIF (TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status) THEN
    INSERT INTO order_status_history(order_id, status, changed_by, note)
    VALUES (NEW.id, NEW.status, NULL, NULL);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_order_status_history ON orders;
CREATE TRIGGER trg_order_status_history
  AFTER INSERT OR UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION fn_order_status_history();

-- RLS: orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orders_select_client" ON orders;
CREATE POLICY "orders_select_client" ON orders FOR SELECT
  USING (client_id = auth.uid());

DROP POLICY IF EXISTS "orders_select_master" ON orders;
CREATE POLICY "orders_select_master" ON orders FOR SELECT
  USING (master_id IN (SELECT id FROM masters WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "orders_select_available_master" ON orders;
CREATE POLICY "orders_select_available_master" ON orders FOR SELECT
  USING (
    status = 'pending' AND master_id IS NULL AND
    city_id::text = auth.jwt() ->> 'city_id' AND
    auth.jwt() ->> 'role' = 'master'
  );

DROP POLICY IF EXISTS "orders_insert_client" ON orders;
CREATE POLICY "orders_insert_client" ON orders FOR INSERT
  WITH CHECK (client_id = auth.uid());

DROP POLICY IF EXISTS "orders_update_client" ON orders;
CREATE POLICY "orders_update_client" ON orders FOR UPDATE
  USING (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

DROP POLICY IF EXISTS "orders_update_master" ON orders;
CREATE POLICY "orders_update_master" ON orders FOR UPDATE
  USING (master_id IN (SELECT id FROM masters WHERE user_id = auth.uid()))
  WITH CHECK (master_id IN (SELECT id FROM masters WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "orders_accept_master" ON orders;
CREATE POLICY "orders_accept_master" ON orders FOR UPDATE
  USING (
    status = 'pending' AND master_id IS NULL AND
    city_id::text = auth.jwt() ->> 'city_id' AND
    auth.jwt() ->> 'role' = 'master'
  )
  WITH CHECK (
    master_id IN (SELECT id FROM masters WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "orders_all_admin" ON orders;
CREATE POLICY "orders_all_admin" ON orders FOR ALL
  USING (
    auth.jwt() ->> 'role' = 'superadmin' OR
    (auth.jwt() ->> 'role' = 'city_admin' AND city_id::text = auth.jwt() ->> 'city_id')
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'superadmin' OR
    (auth.jwt() ->> 'role' = 'city_admin' AND city_id::text = auth.jwt() ->> 'city_id')
  );

-- RLS: order_photos
ALTER TABLE order_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_photos_select" ON order_photos;
CREATE POLICY "order_photos_select" ON order_photos FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM orders WHERE
        client_id = auth.uid() OR
        master_id IN (SELECT id FROM masters WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "order_photos_insert" ON order_photos;
CREATE POLICY "order_photos_insert" ON order_photos FOR INSERT
  WITH CHECK (
    uploaded_by = auth.uid() AND
    order_id IN (
      SELECT id FROM orders WHERE
        client_id = auth.uid() OR
        master_id IN (SELECT id FROM masters WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "order_photos_all_admin" ON order_photos;
CREATE POLICY "order_photos_all_admin" ON order_photos FOR ALL
  USING (auth.jwt() ->> 'role' IN ('city_admin','superadmin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('city_admin','superadmin'));

-- RLS: order_status_history
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_status_history_select" ON order_status_history;
CREATE POLICY "order_status_history_select" ON order_status_history FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM orders WHERE
        client_id = auth.uid() OR
        master_id IN (SELECT id FROM masters WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "order_status_history_all_admin" ON order_status_history;
CREATE POLICY "order_status_history_all_admin" ON order_status_history FOR ALL
  USING (auth.jwt() ->> 'role' IN ('city_admin','superadmin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('city_admin','superadmin'));
