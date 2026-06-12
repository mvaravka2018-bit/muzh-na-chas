---
globs: ["supabase/migrations/**/*.sql", "supabase/functions/**/*.ts"]
---

# Правила для работы с базой данных и Edge Functions

## Миграции SQL
- Имя файла: `YYYYMMDD_NNN_description.sql` (например: `20250101_001_create_cities.sql`)
- Каждая миграция идемпотентна: `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`
- Порядок в миграции: таблица → индексы → RLS enable → политики → триггеры
- Никогда не изменять уже применённые миграции — создавать новую
- Комментарий в начале каждой миграции: `-- Migration: краткое описание`

## RLS — обязательные правила
- `ALTER TABLE x ENABLE ROW LEVEL SECURITY` — в каждой миграции с новой таблицей
- Политики именовать: `{table}_{operation}_{role}` (например: `orders_select_client`)
- Суперадмин всегда получает полный доступ через `auth.jwt() ->> 'role' = 'superadmin'`
- Роль из JWT: `auth.jwt() ->> 'role'`, city_id из JWT: `auth.jwt() ->> 'city_id'`

## Деньги в БД
- Тип: `numeric(10,2)` — никогда `float`, `real`, `double precision`
- DEFAULT 0.00 для балансов, не NULL
- Комиссия: `numeric(4,2)` для ставки (0.05 = 5%)

## Edge Functions
- Проверять `x-internal-secret` header в начале каждой функции
- Использовать `createClient` с `SUPABASE_SERVICE_ROLE_KEY` (не anon key)
- Возвращать структурированный JSON: `{data}` или `{error: string}`
- Логировать ошибки через `console.error`, не `console.log`
