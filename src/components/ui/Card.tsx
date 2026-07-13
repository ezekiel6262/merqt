import { HTMLAttributes } from 'react'

export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`bg-merqt-surface border border-merqt-border rounded-card ${className}`}
      {...props}
    />
  )
}
