---
globs: ["src/app/api/**/*.ts"]
---

# Правила для API Routes (Next.js App Router)

## Структура каждого route
1. Проверка авторизации (`getUser()`) — первым делом
2. Валидация входных данных через zod
3. Проверка прав (роль, city_id)
4. Бизнес-логика
5. Возврат структурированного ответа

## Авторизация
```typescript
const supabase = createServerClient()
const { data: { user }, error } = await supabase.auth.getUser()
if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
```
Никогда не доверять данным из тела запроса для определения пользователя.

## Ошибки
- 400: невалидные данные (`{error: 'описание'}`)
- 401: не авторизован (`{error: 'unauthorized'}`)
- 403: нет прав (`{error: 'forbidden'}`)
- 404: не найдено (`{error: 'not_found'}`)
- 409: конфликт (`{error: 'conflict_reason'}`)
- 500: внутренняя ошибка (`{error: 'internal_error'}`) — не раскрывать детали

## Запрещено
- `any` в TypeScript
- Обращение к БД без проверки авторизации
- `console.log` (только `console.error` для ошибок)
- Хранение секретов в коде (только `process.env.*`)
- `NEXT_PUBLIC_` префикс для серверных секретов

## Мультигород
Всегда фильтровать данные по `city_id` пользователя из JWT, не принимать city_id от клиента
как доверенный без проверки прав.
