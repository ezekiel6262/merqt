export function StatusPill({ label, cancelled = false }: { label: string; cancelled?: boolean }) {
  return (
    <span
      className={
        'text-[11px] font-semibold px-2.5 py-1 rounded-pill border border-merqt-border bg-merqt-bg capitalize whitespace-nowrap ' +
        (cancelled ? 'text-merqt-text-muted line-through' : 'text-merqt-text')
      }
    >
      {label}
    </span>
  )
}

export function TypeTag({ label, kind }: { label: string; kind: 'product' | 'service' }) {
  return (
    <span
      className={
        'text-[10.5px] font-bold px-2 py-1 rounded-pill whitespace-nowrap ' +
        (kind === 'product'
          ? 'bg-merqt-indigo-soft text-merqt-indigo-dark'
          : 'bg-merqt-ochre-soft text-merqt-ochre-dark')
      }
    >
      {label}
    </span>
  )
}
