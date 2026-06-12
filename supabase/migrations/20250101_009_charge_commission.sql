-- Migration: atomic commission charging function

CREATE OR REPLACE FUNCTION charge_commission(
  p_order_id uuid, p_master_id uuid, p_amount numeric, p_rate numeric
) RETURNS void AS $$
BEGIN
  UPDATE masters SET balance = balance - p_amount WHERE id = p_master_id;

  INSERT INTO commission_transactions(order_id, master_id, amount, rate, status, charged_at)
  VALUES (p_order_id, p_master_id, p_amount, p_rate, 'charged', now());

  UPDATE orders SET commission_amount = p_amount WHERE id = p_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
