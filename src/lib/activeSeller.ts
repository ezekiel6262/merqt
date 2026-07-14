const STORAGE_KEY = 'merqt_active_seller_id'

export function getStoredActiveSellerId(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(STORAGE_KEY)
}

export function setStoredActiveSellerId(id: string) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, id)
}

export function resolveActiveSellerId(sellers: { id: string }[]): string | null {
  const stored = getStoredActiveSellerId()
  if (stored && sellers.some((s) => s.id === stored)) return stored
  return sellers[0]?.id ?? null
}
