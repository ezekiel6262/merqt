export function formatNaira(amount: number) {
  return '₦' + amount.toLocaleString('en-NG')
}

export function getInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')
}

export function timeAgo(dateStr: string) {
  const ms = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(ms / (24 * 60 * 60 * 1000))
  if (days <= 0) return 'today'
  if (days === 1) return '1 day ago'
  if (days < 30) return `${days} days ago`
  const months = Math.floor(days / 30)
  if (months === 1) return '1 month ago'
  return `${months} months ago`
}
