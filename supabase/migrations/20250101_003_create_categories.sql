-- Migration: categories and category_templates with RLS

CREATE TABLE IF NOT EXISTS categories (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id       uuid NOT NULL REFERENCES cities(id),
  slug          text NOT NULL,
  name          text NOT NULL,
  description   text,
  icon_emoji    text NOT NULL DEFAULT '🔧',
  base_price    numeric(10,2) NOT NULL,
  price_label   text NOT NULL DEFAULT 'от',
  sort_order    int NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  UNIQUE(city_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_categories_city_id ON categories(city_id);
CREATE INDEX IF NOT EXISTS idx_categories_is_active ON categories(is_active);

CREATE TABLE IF NOT EXISTS category_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text UNIQUE NOT NULL,
  name        text NOT NULL,
  description text,
  icon_emoji  text NOT NULL DEFAULT '🔧',
  base_price  numeric(10,2) NOT NULL,
  sort_order  int NOT NULL DEFAULT 0
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories_select_active" ON categories;
CREATE POLICY "categories_select_active" ON categories FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "categories_all_admin" ON categories;
CREATE POLICY "categories_all_admin" ON categories FOR ALL
  USING (
    auth.jwt() ->> 'role' = 'superadmin' OR
    (auth.jwt() ->> 'role' = 'city_admin' AND city_id::text = auth.jwt() ->> 'city_id')
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'superadmin' OR
    (auth.jwt() ->> 'role' = 'city_admin' AND city_id::text = auth.jwt() ->> 'city_id')
  );

DROP POLICY IF EXISTS "category_templates_select_all" ON category_templates;
CREATE POLICY "category_templates_select_all" ON category_templates FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "category_templates_all_superadmin" ON category_templates;
CREATE POLICY "category_templates_all_superadmin" ON category_templates FOR ALL
  USING (auth.jwt() ->> 'role' = 'superadmin')
  WITH CHECK (auth.jwt() ->> 'role' = 'superadmin');

-- Стартовые шаблоны категорий
INSERT INTO category_templates (slug, name, description, icon_emoji, base_price, sort_order) VALUES
  ('plumber', 'Сантехник', 'Ремонт и установка сантехники', '🔧', 800, 1),
  ('electrician', 'Электрик', 'Электромонтажные работы', '💡', 700, 2),
  ('furniture', 'Сборка мебели', 'Сборка и установка мебели', '🪑', 500, 3),
  ('handyman', 'Мелкий ремонт', 'Мелкий бытовой ремонт', '🛠️', 600, 4),
  ('ceiling', 'Натяжные потолки', 'Установка натяжных потолков', '🏠', 0, 5),
  ('tiler', 'Плиточник', 'Укладка плитки', '🧱', 1200, 6),
  ('plasterer', 'Штукатурка', 'Штукатурные работы', '🪣', 0, 7),
  ('demolition', 'Демонтаж', 'Демонтажные работы', '🔨', 1500, 8)
ON CONFLICT (slug) DO NOTHING;
