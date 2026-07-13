export function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div>
      <div className="font-mono text-xl font-bold text-merqt-text">{value}</div>
      <div className="text-[11px] text-merqt-text-muted">{label}</div>
    </div>
  )
}

export function MetricCard({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="bg-merqt-surface border border-merqt-border rounded-card p-4">
      <div className="font-mono text-2xl font-bold text-merqt-text">{value}</div>
      <div className="text-xs text-merqt-text-muted mt-0.5">{label}</div>
    </div>
  )
}
