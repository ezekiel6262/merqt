export function StepDots({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="flex gap-1.5 mb-7">
      {steps.map((label, i) => (
        <div key={label} className="flex-1">
          <div
            className={
              'w-7 h-7 rounded-full flex items-center justify-center font-mono text-xs font-bold ' +
              (i <= current ? 'bg-merqt-indigo text-merqt-surface' : 'bg-merqt-border text-merqt-text-muted')
            }
          >
            {i + 1}
          </div>
          <div className="text-[11px] text-merqt-text-muted mt-1.5">{label}</div>
        </div>
      ))}
    </div>
  )
}
