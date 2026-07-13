const PAYSTACK_BASE = 'https://api.paystack.co'

async function paystackFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
  const data = await res.json()
  if (!res.ok || !data.status) {
    throw new Error(data.message ?? 'Paystack request failed')
  }
  return data.data
}

export async function initializeTransaction(params: { email: string; amountKobo: number; reference: string; callbackUrl: string }) {
  return paystackFetch('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email: params.email,
      amount: params.amountKobo,
      reference: params.reference,
      callback_url: params.callbackUrl,
    }),
  }) as Promise<{ authorization_url: string; access_code: string; reference: string }>
}

export async function verifyTransaction(reference: string) {
  return paystackFetch(`/transaction/verify/${encodeURIComponent(reference)}`) as Promise<{
    status: string
    amount: number
    reference: string
  }>
}
