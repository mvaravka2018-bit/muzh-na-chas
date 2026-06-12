# CLAUDE.md — Муж на час (Telegram Mini App)

## Обзор проекта
Мультигородская платформа бытовых услуг. Клиент заказывает мастера через Telegram Mini App.
Мастер получает уведомление, принимает заказ, выполняет. Платформа берёт 5% комиссии.
Один деплой — все города. Новый город = запись в таблице `cities`.

## Стек
- **Frontend**: Next.js 14 App Router + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL + Auth + Realtime + Edge Functions)
- **Платежи**: ЮKassa SDK + Telegram Stars (резерв)
- **Уведомления**: Telegram Bot API (grammy)
- **Хостинг**: Vercel + Supabase Cloud

## Архитектура
```
src/app/(client)/    — страницы клиента (Mini App)
src/app/(master)/    — страницы мастера
src/app/(admin)/     — admin панель
src/app/api/         — API routes (Next.js)
supabase/migrations/ — SQL миграции (порядок важен)
supabase/functions/  — Edge Functions: commission, notify
```

## Ключевые таблицы
`cities` → `users` → `masters` / `orders` → `payments` → `commission_transactions`
Каждая таблица содержит `city_id` для мультигорода. RLS на всех таблицах — обязательно.

## Правила разработки
1. Все миграции — в `supabase/migrations/` с префиксом `YYYYMMDD_NNN_name.sql`
2. RLS политики создаются в той же миграции, что и таблица
3. Все API routes — валидация через zod перед обращением к БД
4. Telegram initData валидируется HMAC-SHA256 с bot_token города (не глобальным)
5. Edge Functions вызываются только через `INTERNAL_API_SECRET` header
6. Никаких `any` в TypeScript — строгие типы через `src/types/`
7. Компоненты — в `src/components/ui/` (shadcn) и `src/components/app/` (кастомные)
8. Состояния загрузки и ошибок — обязательны для каждого компонента
9. Supabase client: браузер — `createBrowserClient`, сервер — `createServerClient`
10. Комиссия списывается ТОЛЬКО через Edge Function `commission` при `status=confirmed`

## Команды
```bash
npm run dev          # локальный сервер
npm run build        # продакшн сборка
npm run typecheck    # проверка типов
supabase db push     # применить миграции
supabase functions serve commission  # тест Edge Function
```

## Переменные окружения
Все в `.env.local`. Обязательные: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY`, `INTERNAL_API_SECRET`.

## Субагенты
Используй субагентов по специализации. database-architect — любые изменения схемы БД.
payments-specialist — всё связанное с ЮKassa и комиссией. qa-reviewer — после каждого модуля.

## Спецификация
Полная спецификация — в `SPEC.md`. При любых вопросах по структуре БД или API — читай SPEC.md.
