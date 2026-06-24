-- Migration: atomic replace of master_categories
CREATE OR REPLACE FUNCTION replace_master_categories(
  p_master_id uuid,
  p_category_ids uuid[]
) RETURNS void AS $$
BEGIN
  DELETE FROM master_categories WHERE master_id = p_master_id;
  INSERT INTO master_categories (master_id, category_id)
    SELECT p_master_id, unnest(p_category_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
