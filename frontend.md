---
globs: ["src/app/**/*.tsx", "src/components/**/*.tsx"]
---

# Правила для Frontend компонентов (Next.js + Telegram Mini App)

## Telegram Mini App
- Всегда подключать `https://telegram.org/js/telegram-web-app.js` в layout через `<Script strategy="beforeInteractive">`
- Цвета — через CSS переменные Telegram: `var(--tg-theme-bg-color)`, `var(--tg-theme-text-color)`,
  `var(--tg-theme-button-color)`, `var(--tg-theme-hint-color)`, `var(--tg-theme-secondary-bg-color)`
- Кнопки действий — через `Telegram.WebApp.MainButton` где уместно
- При успешных действиях — `Telegram.WebApp.HapticFeedback.notificationOccurred('success')`

## Компоненты
- Server Component по умолчанию, `'use client'` только при необходимости
- Каждый список: состояния loading (skeleton), error (сообщение + retry), empty (иллюстрация + CTA)
- Touch targets: минимум 44×44px для интерактивных элементов
- Анимации: `transition-transform active:scale-95` для кнопок (haptic-like feedback)

## Типы
- Импортировать из `src/types/database.ts` (генерируется Supabase CLI)
- Пропсы компонентов — именованные интерфейсы, не inline types

## Формы
- Использовать `react-hook-form` + `@hookform/resolvers/zod`
- Показывать inline ошибки под каждым полем
- Кнопка submit: `disabled={isSubmitting}`, показывать спиннер при загрузке

## Запрещено
- Inline стили для цветов (только Telegram CSS-переменные или Tailwind)
- Прямые fetch запросы без обработки ошибок
- Хранение токенов или секретов в localStorage
