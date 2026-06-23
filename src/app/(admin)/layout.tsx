import Link from 'next/link'

const NAV_ITEMS = [
  { href: '/admin', label: 'Дашборд' },
  { href: '/admin/masters', label: 'Мастера' },
  { href: '/admin/applications', label: 'Заявки' },
  { href: '/admin/orders', label: 'Заказы' },
  { href: '/admin/reviews', label: 'Отзывы' },
  { href: '/admin/withdrawals', label: 'Выводы' },
  { href: '/admin/cities', label: 'Города' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <nav className="flex gap-1 p-2 border-b border-tg-hint/20 overflow-x-auto">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="px-3 py-2 rounded-lg text-sm whitespace-nowrap bg-tg-secondary-bg"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <main className="flex-1 p-4">{children}</main>
    </div>
  )
}
