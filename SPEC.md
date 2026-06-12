# SPEC.md — Техническая спецификация: Муж на час

> Версия 1.0 · Стек: Next.js 14 (App Router) · Supabase · ЮKassa · Telegram Mini App · Vercel

---

## Стек и окружение

| Слой | Технология | Версия |
|------|-----------|--------|
| Frontend | Next.js (App Router) | 14.x |
| UI | Tailwind CSS + shadcn/ui | latest |
| Backend | Supabase (PostgreSQL + Auth + Realtime + Edge Functions) | latest |
| Платежи | ЮKassa SDK | 2.x |
| Бот | Telegram Bot API (grammy) | 2.x |
| Хостинг | Vercel (frontend) + Supabase Cloud | — |
| Язык | TypeScript | 5.x |

---

## Модуль 1 — Города (cities)

### User Stories
- Как суперадмин, я хочу добавить новый город, чтобы платформа заработала там без изменения кода
- Как суперадмин, я хочу задать комиссию для каждого города отдельно, чтобы гибко управлять монетизацией
- Как система, я хочу определять город пользователя по `city_slug` из URL/бота, чтобы показывать локальный контент
- Как суперадмин, я хочу деактивировать город, чтобы временно отключить его без удаления данных

### Модель данных

```sql
CREATE TABLE cities (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text UNIQUE NOT NULL,           -- 'tula', 'voronezh'
  name            text NOT NULL,                  -- 'Тула'
  bot_token       text NOT NULL,                  -- токен Telegram-бота города
  bot_username    text NOT NULL,                  -- '@muzhnacha s_tula_bot'
  timezone        text NOT NULL DEFAULT 'Europe/Moscow',
  commission_rate numeric(4,2) NOT NULL DEFAULT 0.05, -- 0.05 = 5%
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
-- SELECT: все авторизованные пользователи видят активные города
CREATE POLICY "cities_select" ON cities FOR SELECT
  USING (is_active = true);
-- INSERT/UPDATE/DELETE: только суперадмин (role = 'superadmin')
CREATE POLICY "cities_admin" ON cities FOR ALL
  USING (auth.jwt() ->> 'role' = 'superadmin');
```

### API

```
GET  /api/cities
  → 200: [{id, slug, name, bot_username, timezone}]

GET  /api/cities/[slug]
  → 200: {id, slug, name, timezone, commission_rate}
  → 404: {error: 'city_not_found'}

POST /api/admin/cities                    (superadmin only)
  body: {slug, name, bot_token, bot_username, timezone, commission_rate}
  → 201: {id, slug}
  → 400: {error: 'slug_taken'}

PATCH /api/admin/cities/[id]              (superadmin only)
  body: {is_active?, commission_rate?, bot_token?}
  → 200: {id, updated_at}
```

### Крайние случаи
- Slug содержит кириллицу → 400: `slug_invalid` (только a-z, 0-9, дефис)
- bot_token недействителен → 400: `bot_token_invalid` (проверяем через getMe)
- Попытка деактивировать город с активными заказами → 400: `city_has_active_orders`

---

## Модуль 2 — Аутентификация (auth)

### User Stories
- Как новый пользователь, я хочу войти через Telegram, чтобы не создавать отдельный аккаунт
- Как система, я хочу знать роль пользователя (client/master/city_admin/superadmin), чтобы показывать нужный интерфейс
- Как мастер, я хочу привязать номер телефона, чтобы клиенты могли связаться со мной
- Как пользователь, я хочу автоматически входить при повторном открытии Mini App

### Модель данных

```sql
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id   bigint UNIQUE NOT NULL,
  city_id       uuid NOT NULL REFERENCES cities(id),
  role          text NOT NULL DEFAULT 'client'
                CHECK (role IN ('client','master','city_admin','superadmin')),
  first_name    text NOT NULL,
  last_name     text,
  username      text,                        -- Telegram username без @
  phone         text,
  avatar_url    text,
  is_blocked    boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz
);

-- RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_select_own" ON users FOR SELECT
  USING (auth.uid() = id);
CREATE POLICY "users_update_own" ON users FOR UPDATE
  USING (auth.uid() = id);
CREATE POLICY "users_admin_all" ON users FOR ALL
  USING (auth.jwt() ->> 'role' IN ('city_admin','superadmin'));
```

### API

```
POST /api/auth/telegram
  body: {initData: string, city_slug: string}
  → Валидация Telegram InitData (HMAC-SHA256 с bot_token города)
  → Upsert пользователя по telegram_id
  → Создать Supabase session (signInWithPassword или custom JWT)
  → 200: {access_token, refresh_token, user: {id, role, city_id}}
  → 400: {error: 'invalid_init_data'}
  → 403: {error: 'user_blocked'}

POST /api/auth/refresh
  body: {refresh_token: string}
  → 200: {access_token, refresh_token}
  → 401: {error: 'token_expired'}

GET  /api/auth/me
  headers: Authorization: Bearer <token>
  → 200: {id, telegram_id, role, city_id, first_name, phone}
  → 401: {error: 'unauthorized'}
```

### Бизнес-логика
- Валидация `initData`: HMAC-SHA256(data_check_string, SHA256(bot_token))
- JWT claims: `{sub: user.id, role: user.role, city_id: user.city_id}`
- `city_id` определяется по `city_slug` из запроса, не из Telegram
- Если пользователь существует — обновляем `first_name`, `username`, `last_seen_at`

### Крайние случаи
- `initData` старше 1 часа → 400: `init_data_expired`
- Пользователь заблокирован → 403: `user_blocked`
- Город неактивен → 403: `city_inactive`

---

## Модуль 3 — Каталог услуг (catalog)

### User Stories
- Как клиент, я хочу видеть категории услуг с иконками, чтобы быстро найти нужную
- Как клиент, я хочу видеть базовую цену услуги, чтобы понимать примерную стоимость
- Как city_admin, я хочу добавлять и редактировать категории в своём городе
- Как суперадмин, я хочу создавать шаблоны категорий, которые копируются в новые города

### Модель данных

```sql
CREATE TABLE categories (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id       uuid NOT NULL REFERENCES cities(id),
  slug          text NOT NULL,                 -- 'plumber', 'electrician'
  name          text NOT NULL,                 -- 'Сантехник'
  description   text,
  icon_emoji    text NOT NULL DEFAULT '🔧',
  base_price    numeric(10,2) NOT NULL,        -- минимальная цена в руб
  price_label   text NOT NULL DEFAULT 'от',   -- 'от', 'фиксированно', 'по договору'
  sort_order    int NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  UNIQUE(city_id, slug)
);

CREATE TABLE category_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text UNIQUE NOT NULL,
  name        text NOT NULL,
  description text,
  icon_emoji  text NOT NULL DEFAULT '🔧',
  base_price  numeric(10,2) NOT NULL,
  sort_order  int NOT NULL DEFAULT 0
);

-- RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_select_active" ON categories FOR SELECT
  USING (is_active = true);
CREATE POLICY "categories_city_admin" ON categories FOR ALL
  USING (
    auth.jwt() ->> 'role' = 'superadmin' OR
    (auth.jwt() ->> 'role' = 'city_admin' AND
     city_id::text = auth.jwt() ->> 'city_id')
  );
```

### API

```
GET  /api/cities/[slug]/categories
  → 200: [{id, slug, name, icon_emoji, base_price, price_label}]
  → Сортировка по sort_order ASC

GET  /api/cities/[slug]/categories/[category_slug]
  → 200: {id, slug, name, description, base_price, price_label}
  → 404: {error: 'category_not_found'}

POST /api/admin/cities/[city_id]/categories   (city_admin, superadmin)
  body: {slug, name, description?, icon_emoji?, base_price, price_label?, sort_order?}
  → 201: {id, slug}

PATCH /api/admin/categories/[id]              (city_admin, superadmin)
  body: {name?, base_price?, is_active?, sort_order?}
  → 200: {id}

GET  /api/admin/category-templates            (superadmin)
  → 200: [{id, slug, name, icon_emoji, base_price}]

POST /api/admin/cities/[city_id]/categories/from-template  (superadmin)
  body: {template_ids: uuid[]}
  → 201: {created: number}
```

### Стартовые категории (из шаблонов)
Сантехник (от 800 руб), Электрик (от 700 руб), Сборка мебели (от 500 руб),
Мелкий ремонт (от 600 руб), Натяжные потолки (по договору),
Плиточник (от 1200 руб/м²), Штукатурка (по договору), Демонтаж (от 1500 руб)

---

## Модуль 4 — Мастера (masters)

### User Stories
- Как желающий стать мастером, я хочу подать заявку, чтобы начать получать заказы
- Как city_admin, я хочу верифицировать мастера после проверки документов
- Как клиент, я хочу видеть рейтинг, отзывы и портфолио мастера перед выбором
- Как мастер, я хочу видеть свой баланс и историю списаний комиссии
- Как мастер, я хочу указать свои специализации и рабочее время

### Модель данных

```sql
CREATE TABLE masters (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid UNIQUE NOT NULL REFERENCES users(id),
  city_id         uuid NOT NULL REFERENCES cities(id),
  bio             text,
  experience_years int NOT NULL DEFAULT 0,
  is_verified     boolean NOT NULL DEFAULT false,
  verified_at     timestamptz,
  verified_by     uuid REFERENCES users(id),
  is_available    boolean NOT NULL DEFAULT true,  -- онлайн/оффлайн
  rating          numeric(3,2) NOT NULL DEFAULT 0.00,
  reviews_count   int NOT NULL DEFAULT 0,
  balance         numeric(10,2) NOT NULL DEFAULT 0.00,  -- баланс для выплат
  total_earned    numeric(10,2) NOT NULL DEFAULT 0.00,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE master_categories (
  master_id   uuid NOT NULL REFERENCES masters(id),
  category_id uuid NOT NULL REFERENCES categories(id),
  custom_price numeric(10,2),   -- NULL = использовать базовую цену категории
  PRIMARY KEY (master_id, category_id)
);

CREATE TABLE master_portfolio (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id   uuid NOT NULL REFERENCES masters(id),
  image_url   text NOT NULL,
  caption     text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE master_applications (
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

-- RLS
ALTER TABLE masters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "masters_select_verified" ON masters FOR SELECT
  USING (is_verified = true);
CREATE POLICY "masters_select_own" ON masters FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "masters_update_own" ON masters FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (
    -- мастер не может менять is_verified, rating, balance
    is_verified = (SELECT is_verified FROM masters WHERE id = masters.id)
  );
CREATE POLICY "masters_admin" ON masters FOR ALL
  USING (auth.jwt() ->> 'role' IN ('city_admin','superadmin'));
```

### API

```
GET  /api/cities/[slug]/masters
  query: {category_slug?, available_only?: bool, page?: int, limit?: int}
  → 200: {data: [{id, user: {first_name, avatar_url}, rating, reviews_count,
                   categories: [{name, custom_price}], is_available}],
           total, page}
  → Сортировка: is_available DESC, rating DESC

GET  /api/masters/[id]
  → 200: {id, user: {first_name, avatar_url, phone}, bio, experience_years,
           rating, reviews_count, categories, portfolio: [{image_url, caption}]}

POST /api/master-applications
  headers: Authorization: Bearer <token>
  body: {full_name, phone, experience, category_ids: uuid[]}
  → 201: {id, status: 'pending'}
  → 409: {error: 'application_exists'}

PATCH /api/admin/master-applications/[id]   (city_admin, superadmin)
  body: {status: 'approved'|'rejected'}
  → При approved: создать запись в masters, отправить уведомление
  → 200: {id, status}

PATCH /api/masters/[id]/availability        (owner only)
  body: {is_available: bool}
  → 200: {is_available}

GET  /api/masters/[id]/balance              (owner only)
  → 200: {balance, total_earned,
           transactions: [{order_id, amount, type, created_at}]}
```

### Бизнес-логика
- Рейтинг пересчитывается через Supabase trigger после каждого нового отзыва:
  `rating = AVG(reviews.rating) WHERE order.master_id = master_id`
- Верификация: city_admin меняет `is_verified = true`, система отправляет уведомление мастеру
- Портфолио: максимум 10 фото, загрузка в Supabase Storage (`masters/{master_id}/portfolio/`)

### Крайние случаи
- Заявка подана повторно тем же пользователем → 409: `application_exists`
- Мастер пытается взять заказ, если `is_verified = false` → 403: `master_not_verified`
- Удаление последней категории мастера → 400: `min_one_category_required`

---

## Модуль 5 — Заказы (orders)

### User Stories
- Как клиент, я хочу создать заявку с описанием и фото, чтобы мастер понял задачу
- Как клиент, я хочу выбрать конкретного мастера или получить назначенного автоматически
- Как мастер, я хочу принять или отклонить входящий заказ в течение 10 минут
- Как клиент, я хочу отслеживать статус заказа в реальном времени
- Как city_admin, я хочу видеть все заказы города и управлять проблемными

### Модель данных

```sql
CREATE TYPE order_status AS ENUM (
  'pending',      -- создан, ждёт мастера
  'accepted',     -- мастер принял
  'in_progress',  -- мастер на месте
  'completed',    -- выполнен, ждёт подтверждения клиента
  'confirmed',    -- клиент подтвердил, комиссия списана
  'cancelled',    -- отменён
  'disputed'      -- спор
);

CREATE TABLE orders (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id           uuid NOT NULL REFERENCES cities(id),
  client_id         uuid NOT NULL REFERENCES users(id),
  master_id         uuid REFERENCES masters(id),  -- NULL если ещё не назначен
  category_id       uuid NOT NULL REFERENCES categories(id),
  description       text NOT NULL,
  address           text NOT NULL,
  lat               numeric(9,6),
  lng               numeric(9,6),
  scheduled_at      timestamptz NOT NULL,
  status            order_status NOT NULL DEFAULT 'pending',
  total_amount      numeric(10,2),                -- финальная сумма
  commission_amount numeric(10,2),                -- 5% от total_amount
  payment_type      text NOT NULL DEFAULT 'cash'
                    CHECK (payment_type IN ('cash','online')),
  client_note       text,
  master_note       text,                         -- комментарий мастера
  cancelled_by      uuid REFERENCES users(id),
  cancel_reason     text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  accepted_at       timestamptz,
  completed_at      timestamptz,
  confirmed_at      timestamptz
);

CREATE TABLE order_photos (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id  uuid NOT NULL REFERENCES orders(id),
  image_url text NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE order_status_history (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   uuid NOT NULL REFERENCES orders(id),
  status     order_status NOT NULL,
  changed_by uuid REFERENCES users(id),
  note       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders_client" ON orders FOR SELECT
  USING (client_id = auth.uid());
CREATE POLICY "orders_master" ON orders FOR SELECT
  USING (master_id IN (SELECT id FROM masters WHERE user_id = auth.uid()));
CREATE POLICY "orders_admin" ON orders FOR ALL
  USING (auth.jwt() ->> 'role' IN ('city_admin','superadmin'));
```

### API

```
POST /api/orders
  headers: Authorization: Bearer <token>  (role: client)
  body: {category_id, description, address, lat?, lng?,
         scheduled_at, master_id?, payment_type, client_note?}
  → 201: {id, status: 'pending'}
  → Уведомление мастеру (если выбран) или всем доступным мастерам категории

GET  /api/orders/[id]
  → 200: {id, status, client, master, category, description, address,
           scheduled_at, total_amount, photos, status_history}
  → 403 если не клиент/мастер/админ заказа

GET  /api/orders
  query: {role: 'client'|'master', status?, page?, limit?}
  → 200: {data: [orders], total}

PATCH /api/orders/[id]/status
  body: {status, note?, total_amount?}
  Переходы (роль → допустимые переходы):
    master:  pending→accepted, pending→cancelled, accepted→in_progress,
             in_progress→completed
    client:  completed→confirmed, accepted→cancelled, pending→cancelled,
             completed→disputed
    admin:   любой переход
  → 200: {id, status}
  → 400: {error: 'invalid_status_transition'}

POST /api/orders/[id]/photos
  body: FormData {file: File}
  → 201: {image_url}
  → Загрузка в Supabase Storage: orders/{order_id}/{uuid}.jpg
  → Максимум 5 фото на заказ

GET  /api/cities/[slug]/orders/available   (masters only)
  → Заказы в статусе 'pending' без мастера в городе мастера
  → 200: [{id, category, description, address, scheduled_at, client: {first_name}}]
```

### Бизнес-логика
- При создании заказа с `master_id`: мастеру даётся 10 минут на принятие, иначе статус → `pending` без мастера
- При `status = confirmed`: автоматически вызвать Edge Function `commission`
- При `status = cancelled` после `accepted`: уведомить обе стороны
- `total_amount` устанавливает мастер при переходе `in_progress → completed`

### Крайние случаи
- Клиент пытается создать 2 заказа в одно время → 409: `time_conflict`
- Мастер пытается принять заказ в другом городе → 403: `wrong_city`
- `scheduled_at` в прошлом → 400: `scheduled_at_in_past`
- `scheduled_at` менее чем через 30 минут → 400: `too_soon` (минимум 30 мин)
- Отмена подтверждённого заказа → 400: `cannot_cancel_confirmed`

---

## Модуль 6 — Платежи и комиссия (payments)

### User Stories
- Как клиент, я хочу оплатить заказ онлайн через ЮKassa, чтобы не иметь наличных
- Как платформа, я хочу автоматически списывать 5% комиссии после подтверждения заказа
- Как мастер, я хочу видеть баланс и запрашивать вывод средств
- Как суперадмин, я хочу видеть общую выручку по городам

### Модель данных

```sql
CREATE TABLE payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            uuid NOT NULL REFERENCES orders(id),
  provider            text NOT NULL CHECK (provider IN ('yookassa','cash')),
  amount              numeric(10,2) NOT NULL,
  status              text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','succeeded','cancelled','refunded')),
  provider_payment_id text,                   -- id платежа в ЮKassa
  provider_data       jsonb,                  -- полный ответ провайдера
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE commission_transactions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid NOT NULL REFERENCES orders(id),
  master_id   uuid NOT NULL REFERENCES masters(id),
  amount      numeric(10,2) NOT NULL,         -- сумма комиссии
  rate        numeric(4,2) NOT NULL,          -- ставка на момент заказа
  status      text NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','charged','failed')),
  charged_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE withdrawal_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id   uuid NOT NULL REFERENCES masters(id),
  amount      numeric(10,2) NOT NULL,
  status      text NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','processing','completed','rejected')),
  bank_details jsonb NOT NULL,                -- {bank, account, bik, name}
  admin_note  text,
  processed_by uuid REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

-- RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments_client" ON payments FOR SELECT
  USING (order_id IN (SELECT id FROM orders WHERE client_id = auth.uid()));
CREATE POLICY "payments_admin" ON payments FOR ALL
  USING (auth.jwt() ->> 'role' IN ('city_admin','superadmin'));
```

### API

```
POST /api/payments/create
  headers: Authorization: Bearer <token>  (role: client)
  body: {order_id, return_url: string}
  → Создать платёж в ЮKassa
  → 201: {payment_url, payment_id}
  → 400: {error: 'order_already_paid'}

POST /api/payments/webhook                  (ЮKassa webhook, no auth)
  body: YooKassa Notification Object
  headers: {IP проверяем: 185.71.76.0/27, 185.71.77.0/27}
  → При status=succeeded: обновить payment.status, уведомить клиента
  → 200: OK

-- Edge Function: commission (вызывается при order.status = 'confirmed')
supabase/functions/commission/index.ts
  body: {order_id: uuid}
  → Прочитать order: total_amount, master_id, city.commission_rate
  → commission_amount = total_amount * commission_rate
  → Создать commission_transaction
  → Вычесть commission_amount из masters.balance (если хватает) или списать в долг
  → Обновить orders.commission_amount
  → Уведомить мастера о списании
  → 200: {commission_amount}

POST /api/withdrawals
  headers: Authorization: Bearer <token>  (role: master)
  body: {amount, bank_details: {bank, account, bik, name}}
  → 201: {id, status: 'pending'}
  → 400: {error: 'insufficient_balance'} если amount > masters.balance

GET  /api/admin/withdrawals                 (city_admin, superadmin)
  query: {status?, city_id?}
  → 200: [{id, master: {name, phone}, amount, bank_details, status, created_at}]

PATCH /api/admin/withdrawals/[id]           (superadmin)
  body: {status: 'completed'|'rejected', admin_note?}
  → При completed: вычесть из masters.balance
  → 200: {id, status}
```

### Бизнес-логика
- ЮKassa: платёж привязан к заказу, назначение = `Заказ #{order_id} — {category.name}`
- Комиссия списывается ТОЛЬКО при `order.status = confirmed` (клиент подтвердил выполнение)
- Минимальная сумма вывода: 500 руб
- Если у мастера отрицательный баланс — новые заказы блокируются до пополнения
- Наличная оплата: платёж со статусом `cash` создаётся автоматически при `status = confirmed`

### Крайние случаи
- Webhook с неизвестного IP → 403: отклонить без ответа
- Дубликат webhook (идемпотентность) → 200: OK, не обрабатывать повторно
- ЮKassa недоступна → сохранить заказ, предложить наличный расчёт
- Сумма вывода превышает баланс → 400: `insufficient_balance`

---

## Модуль 7 — Отзывы (reviews)

### User Stories
- Как клиент, я хочу оставить оценку и комментарий после выполнения заказа
- Как потенциальный клиент, я хочу читать отзывы о мастере перед выбором
- Как мастер, я хочу ответить на отзыв, чтобы объяснить свою позицию
- Как city_admin, я хочу скрывать неадекватные отзывы без удаления

### Модель данных

```sql
CREATE TABLE reviews (
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

-- RLS
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews_select_visible" ON reviews FOR SELECT
  USING (is_visible = true);
CREATE POLICY "reviews_insert_client" ON reviews FOR INSERT
  WITH CHECK (client_id = auth.uid());
CREATE POLICY "reviews_reply_master" ON reviews FOR UPDATE
  USING (master_id IN (SELECT id FROM masters WHERE user_id = auth.uid()))
  WITH CHECK (
    -- мастер может менять только master_reply
    rating = (SELECT rating FROM reviews WHERE id = reviews.id) AND
    is_visible = (SELECT is_visible FROM reviews WHERE id = reviews.id)
  );
CREATE POLICY "reviews_admin" ON reviews FOR ALL
  USING (auth.jwt() ->> 'role' IN ('city_admin','superadmin'));
```

### API

```
POST /api/reviews
  headers: Authorization: Bearer <token>  (role: client)
  body: {order_id, rating: 1-5, comment?}
  → Проверить: order.status = 'confirmed' И order.client_id = auth.uid()
  → Создать review
  → Trigger: пересчитать masters.rating
  → 201: {id}
  → 400: {error: 'order_not_confirmed'}
  → 409: {error: 'review_exists'}

GET  /api/masters/[id]/reviews
  query: {page?, limit?}
  → 200: {data: [{id, rating, comment, master_reply, client: {first_name},
                   created_at}], total, avg_rating}

PATCH /api/reviews/[id]/reply               (master only)
  body: {master_reply: string}
  → 200: {id, master_reply, replied_at}
  → 403 если не владелец

PATCH /api/admin/reviews/[id]              (city_admin, superadmin)
  body: {is_visible: bool}
  → 200: {id, is_visible}
```

### Trigger для пересчёта рейтинга
```sql
CREATE OR REPLACE FUNCTION update_master_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE masters
  SET
    rating = (SELECT ROUND(AVG(rating)::numeric, 2) FROM reviews
              WHERE master_id = NEW.master_id AND is_visible = true),
    reviews_count = (SELECT COUNT(*) FROM reviews
                     WHERE master_id = NEW.master_id AND is_visible = true)
  WHERE id = NEW.master_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_review_insert
  AFTER INSERT OR UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_master_rating();
```

### Крайние случаи
- Отзыв на незавершённый заказ → 400: `order_not_confirmed`
- Повторный отзыв → 409: `review_exists`
- Ответ мастера длиннее 500 символов → 400: `reply_too_long`
- Комментарий содержит контактные данные → (v2) автофильтрация через Edge Function

---

## Модуль 8 — Уведомления (notifications)

### User Stories
- Как мастер, я хочу получать уведомление о новом заказе в Telegram
- Как клиент, я хочу получать уведомления об изменении статуса моего заказа
- Как мастер, я хочу получить уведомление о списании комиссии
- Как city_admin, я хочу получать уведомления о спорных заказах

### Модель данных

```sql
CREATE TABLE notification_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id),
  type        text NOT NULL,         -- 'order_new', 'order_accepted', 'commission_charged'
  payload     jsonb NOT NULL,
  telegram_ok boolean,               -- успешно ли доставлено
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

### Edge Function: notify

```typescript
// supabase/functions/notify/index.ts
// Вызывается внутренне при изменении статуса заказа

type NotifyPayload = {
  event: 'order_new' | 'order_accepted' | 'order_in_progress' |
         'order_completed' | 'order_confirmed' | 'order_cancelled' |
         'commission_charged' | 'master_verified' | 'withdrawal_processed'
  order_id?: string
  user_id?: string
  extra?: Record<string, unknown>
}

// Шаблоны сообщений
const TEMPLATES = {
  order_new: (o) => `🔔 Новый заказ!\n📋 ${o.category}\n📍 ${o.address}\n🕐 ${o.scheduled_at}\n\n${o.description}`,
  order_accepted: (o) => `✅ Мастер ${o.master_name} принял ваш заказ\n📞 ${o.master_phone}`,
  order_completed: (o) => `🏁 Мастер завершил работу. Подтвердите выполнение или откройте спор.`,
  commission_charged: (o) => `💳 Комиссия ${o.amount} руб списана за заказ #${o.short_id}`,
  master_verified: () => `🎉 Ваш профиль верифицирован! Теперь вы можете принимать заказы.`,
}
```

### API

```
POST /api/internal/notify               (только internal, service_role key)
  body: {event, order_id?, user_id?, extra?}
  → Определить получателей по event
  → Найти bot_token города пользователя
  → Отправить через Telegram Bot API sendMessage
  → Записать в notification_log
  → 200: {sent: number}
```

### Бизнес-логика — кто получает что
| Event | Получатель |
|-------|-----------|
| order_new | Мастер (если выбран) или все доступные мастера категории |
| order_accepted | Клиент |
| order_in_progress | Клиент |
| order_completed | Клиент |
| order_confirmed | Мастер |
| order_cancelled | Противоположная сторона |
| commission_charged | Мастер |
| master_verified | Мастер |
| withdrawal_processed | Мастер |

### Крайние случаи
- Telegram вернул 403 (бот заблокирован пользователем) → пометить `telegram_ok = false`, не ретраить
- Telegram вернул 429 (rate limit) → экспоненциальный backoff до 3 попыток
- Мастер без `telegram_id` → пропустить уведомление, залогировать

---

## Экраны Mini App

### Клиент
| Экран | Путь | Компоненты | Состояния |
|-------|------|-----------|----------|
| Главная | `/` | CategoryGrid, CityHeader | loading, empty, list |
| Мастера | `/masters?category=` | MasterCard, FilterBar | loading, empty, list |
| Профиль мастера | `/masters/[id]` | MasterInfo, ReviewsList, Portfolio | loading, error |
| Создать заказ | `/order/new` | OrderForm, DateTimePicker, AddressInput | loading, success, error |
| Мои заказы | `/orders` | OrderCard, StatusBadge | loading, empty, list |
| Заказ | `/orders/[id]` | OrderDetail, StatusTimeline, PhotoUpload | loading, error |
| Оставить отзыв | `/orders/[id]/review` | StarRating, CommentInput | loading, success |

### Мастер
| Экран | Путь | Компоненты | Состояния |
|-------|------|-----------|----------|
| Доступные заказы | `/master/orders` | OrderCard, AcceptButton | loading, empty, list |
| Мои заказы | `/master/my-orders` | OrderCard, StatusActions | loading, empty |
| Заказ | `/master/orders/[id]` | OrderDetail, AmountInput, StatusActions | loading |
| Профиль | `/master/profile` | ProfileForm, CategorySelect, PortfolioUpload | loading |
| Баланс | `/master/balance` | BalanceCard, TransactionsList, WithdrawForm | loading |

### Admin
| Экран | Путь | Доступ |
|-------|------|--------|
| Дашборд | `/admin` | city_admin |
| Мастера | `/admin/masters` | city_admin |
| Заявки мастеров | `/admin/applications` | city_admin |
| Заказы | `/admin/orders` | city_admin |
| Отзывы | `/admin/reviews` | city_admin |
| Выплаты | `/admin/withdrawals` | superadmin |
| Города | `/admin/cities` | superadmin |

---

## Переменные окружения

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# ЮKassa
YOOKASSA_SHOP_ID=
YOOKASSA_SECRET_KEY=

# Telegram (суперадмин-бот для уведомлений платформы)
TELEGRAM_SUPERADMIN_BOT_TOKEN=

# Внутренние
INTERNAL_API_SECRET=          # для вызова /api/internal/notify
NEXT_PUBLIC_APP_URL=          # https://муж.tula.ru
```
