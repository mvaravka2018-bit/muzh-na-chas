-- Migration: payments, commission_transactions, withdrawal_requests with RLS

CREATE TABLE IF NOT EXISTS payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            uuid NOT NULL REFERENCES orders(id),
  provider            text NOT NULL CHECK (provider IN ('yookassa','cash')),
  amount              numeric(10,2) NOT NULL,
  status              text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','succeeded','cancelled','refunded')),
  provider_payment_id text,
  provider_data       jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_provider_payment_id ON payments(provider_payment_id) WHERE provider_payment_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS commission_transactions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid NOT NULL REFERENCES orders(id),
  master_id   uuid NOT NULL REFERENCES masters(id),
  amount      numeric(10,2) NOT NULL,
  rate        numeric(4,2) NOT NULL,
  status      text NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','charged','failed')),
  charged_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commission_transactions_order_id ON commission_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_commission_transactions_master_id ON commission_transactions(master_id);

CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id   uuid NOT NULL REFERENCES masters(id),
  amount      numeric(10,2) NOT NULL,
  status      text NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','processing','completed','rejected')),
  bank_details jsonb NOT NULL,
  admin_note  text,
  processed_by uuid REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_master_id ON withdrawal_requests(master_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(status);

-- RLS: payments
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments_select_client" ON payments;
CREATE POLICY "payments_select_client" ON payments FOR SELECT
  USING (order_id IN (SELECT id FROM orders WHERE client_id = auth.uid()));

DROP POLICY IF EXISTS "payments_select_master" ON payments;
CREATE POLICY "payments_select_master" ON payments FOR SELECT
  USING (order_id IN (SELECT id FROM orders WHERE master_id IN (SELECT id FROM masters WHERE user_id = auth.uid())));

DROP POLICY IF EXISTS "payments_all_admin" ON payments;
CREATE POLICY "payments_all_admin" ON payments FOR ALL
  USING (auth.jwt() ->> 'role' IN ('city_admin','superadmin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('city_admin','superadmin'));

-- RLS: commission_transactions
ALTER TABLE commission_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "commission_transactions_select_master" ON commission_transactions;
CREATE POLICY "commission_transactions_select_master" ON commission_transactions FOR SELECT
  USING (master_id IN (SELECT id FROM masters WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "commission_transactions_all_admin" ON commission_transactions;
CREATE POLICY "commission_transactions_all_admin" ON commission_transactions FOR ALL
  USING (auth.jwt() ->> 'role' IN ('city_admin','superadmin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('city_admin','superadmin'));

-- RLS: withdrawal_requests
ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "withdrawal_requests_select_own" ON withdrawal_requests;
CREATE POLICY "withdrawal_requests_select_own" ON withdrawal_requests FOR SELECT
  USING (master_id IN (SELECT id FROM masters WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "withdrawal_requests_insert_own" ON withdrawal_requests;
CREATE POLICY "withdrawal_requests_insert_own" ON withdrawal_requests FOR INSERT
  WITH CHECK (master_id IN (SELECT id FROM masters WHERE user_id = auth.uid()))
;

DROP POLICY IF EXISTS "withdrawal_requests_all_admin" ON withdrawal_requests;
CREATE POLICY "withdrawal_requests_all_admin" ON withdrawal_requests FOR ALL
  USING (auth.jwt() ->> 'role' = 'superadmin')
  WITH CHECK (auth.jwt() ->> 'role' = 'superadmin');
