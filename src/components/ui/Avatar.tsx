import { getInitials } from '@/lib/format'

export function Avatar({
  src,
  name,
  size = 40,
  shape = 'circle',
  className = '',
}: {
  src?: string | null
  name: string
  size?: number
  shape?: 'circle' | 'square'
  className?: string
}) {
  const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded'
  const style = { width: size, height: size, fontSize: Math.round(size * 0.32) }

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={name} style={style} className={`${shapeClass} object-cover flex-shrink-0 ${className}`} />
    )
  }

  return (
    <div
      style={style}
      className={`${shapeClass} bg-merqt-indigo-soft flex items-center justify-center text-merqt-indigo-dark font-semibold flex-shrink-0 ${className}`}
    >
      {getInitials(name)}
    </div>
  )
}
