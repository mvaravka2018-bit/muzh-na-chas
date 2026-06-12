import { BottomNav } from '@/components/app/BottomNav'

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen pb-16">
      <main className="flex-1">{children}</main>
      <BottomNav />
    </div>
  )
}
