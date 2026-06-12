export function BalanceCard({ balance, totalEarned }: { balance: number; totalEarned: number }) {
  return (
    <div className="rounded-xl bg-tg-secondary-bg p-4 space-y-1">
      <p className="text-sm text-tg-hint">Доступно к выводу</p>
      <p className="text-2xl font-semibold">{balance} ₽</p>
      <p className="text-sm text-tg-hint">Всего заработано: {totalEarned} ₽</p>
    </div>
  )
}
