import { MasterBottomNav } from '@/components/app/MasterBottomNav'

export default function MasterLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen pb-16">
      <main className="flex-1">{children}</main>
      <MasterBottomNav />
    </div>
  )
}
