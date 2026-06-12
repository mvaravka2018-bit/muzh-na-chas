'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Users, ClipboardList } from 'lucide-react'
import { cn } from '@/lib/utils'

const ITEMS = [
  { href: '/', label: 'Главная', icon: Home },
  { href: '/masters', label: 'Мастера', icon: Users },
  { href: '/orders', label: 'Заказы', icon: ClipboardList },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 flex border-t border-tg-hint/20 bg-tg-secondary-bg">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== '/' && pathname.startsWith(href))
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex-1 flex flex-col items-center gap-1 py-2 min-h-[56px] justify-center transition-colors',
              active ? 'text-tg-link' : 'text-tg-hint'
            )}
          >
            <Icon className="w-5 h-5" />
            <span className="text-xs">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
