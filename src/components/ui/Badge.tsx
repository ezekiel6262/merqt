import { Tone, TONE_CLASSES } from '@/lib/badges'

export function Badge({ label, tone = 'indigo' }: { label: string; tone?: Tone }) {
  return (
    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-pill whitespace-nowrap ${TONE_CLASSES[tone]}`}>
      {label}
    </span>
  )
}
