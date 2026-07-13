import { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-merqt-indigo text-merqt-surface border border-transparent disabled:bg-merqt-border disabled:text-merqt-text-muted',
  ghost: 'bg-transparent text-merqt-text border border-merqt-border',
  danger: 'bg-merqt-ochre-dark text-merqt-surface border border-transparent',
}

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-[13px]',
  lg: 'px-5 py-3 text-sm',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={`rounded font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    />
  )
}
