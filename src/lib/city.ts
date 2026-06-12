// Текущий MVP — однотовый деплой на один город.
// При мультигороде заменить на резолвинг city_slug из Telegram initData.
export function getDefaultCitySlug(): string {
  return process.env.NEXT_PUBLIC_DEFAULT_CITY_SLUG ?? 'tula'
}
