-- Migration: reviews with RLS and rating recalculation trigger

CREATE TABLE IF NOT EXISTS reviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid UNIQUE NOT NULL REFERENCES orders(id),
  client_id   uuid NOT NULL REFERENCES users(id),
  master_id   uuid NOT NULL REFERENCES masters(id),
  rating      smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     text,
  master_reply text,
  is_visible  boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  replied_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_reviews_master_id ON reviews(master_id);
CREATE INDEX IF NOT EXISTS idx_reviews_client_id ON reviews(client_id);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reviews_select_visible" ON reviews;
CREATE POLICY "reviews_select_visible" ON reviews FOR SELECT
  USING (is_visible = true OR client_id = auth.uid() OR master_id IN (SELECT id FROM masters WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "reviews_insert_client" ON reviews;
CREATE POLICY "reviews_insert_client" ON reviews FOR INSERT
  WITH CHECK (
    client_id = auth.uid() AND
    order_id IN (SELECT id FROM orders WHERE client_id = auth.uid() AND status = 'confirmed')
  );

DROP POLICY IF EXISTS "reviews_reply_master" ON reviews;
CREATE POLICY "reviews_reply_master" ON reviews FOR UPDATE
  USING (master_id IN (SELECT id FROM masters WHERE user_id = auth.uid()))
  WITH CHECK (
    master_id IN (SELECT id FROM masters WHERE user_id = auth.uid()) AND
    rating = (SELECT rating FROM reviews r WHERE r.id = reviews.id) AND
    is_visible = (SELECT is_visible FROM reviews r WHERE r.id = reviews.id)
  );

DROP POLICY IF EXISTS "reviews_all_admin" ON reviews;
CREATE POLICY "reviews_all_admin" ON reviews FOR ALL
  USING (auth.jwt() ->> 'role' IN ('city_admin','superadmin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('city_admin','superadmin'));

-- Trigger: пересчёт рейтинга мастера
CREATE OR REPLACE FUNCTION update_master_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE masters
  SET
    rating = (SELECT COALESCE(ROUND(AVG(rating)::numeric, 2), 0) FROM reviews
              WHERE master_id = NEW.master_id AND is_visible = true),
    reviews_count = (SELECT COUNT(*) FROM reviews
                     WHERE master_id = NEW.master_id AND is_visible = true)
  WHERE id = NEW.master_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS after_review_insert ON reviews;
CREATE TRIGGER after_review_insert
  AFTER INSERT OR UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_master_rating();
