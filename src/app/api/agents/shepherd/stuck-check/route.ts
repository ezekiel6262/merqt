import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { GoogleGenAI } from '@google/genai'
import { logAgentAction } from '@/lib/agents/logAgentAction'
import { createAdminClient } from '@/lib/supabase/admin'

const STUCK_THRESHOLD_MS = 48 * 60 * 60 * 1000

function isTerminal(status: string) {
  return status === 'delivered' || status === 'completed' || status === 'cancelled'
}

export async function POST(req: Request) {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { orderId } = await req.json()
  if (!orderId) return NextResponse.json({ error: 'orderId is required' }, { status: 400 })

  const admin = createAdminClient()

  const { data: userRow } = await admin.from('users').select('id').eq('clerk_id', userId).single()
  if (!userRow) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: sellerRows } = await admin.from('sellers').select('id').eq('user_id', userRow.id)
  const sellerIds = (sellerRows ?? []).map((s) => s.id)
  if (sellerIds.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: order } = await admin
    .from('orders')
    .select('*, product:products(name, type)')
    .eq('id', orderId)
    .in('seller_id', sellerIds)
    .single()
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const msStuck = Date.now() - new Date(order.status_changed_at).getTime()
  const hoursStuck = msStuck / (60 * 60 * 1000)
  if (isTerminal(order.status) || msStuck < STUCK_THRESHOLD_MS) {
    return NextResponse.json({ stuck: false })
  }

  let note = 'This order hasn\'t been updated in a while - consider following up.'
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
    const prompt = `You are an operations assistant for Merqt, a trade marketplace in Nigeria. A seller has an order/request that has been sitting in the same status for a while without progressing. Write ONE short, friendly, actionable sentence nudging the seller to move it forward.

Type: ${order.is_service ? 'service request' : 'product order'}
Current status: "${order.status}"
Hours in this status: ${Math.round(hoursStuck)}
${order.request_description ? `Buyer's request: "${order.request_description}"` : ''}

Keep it under 25 words, written for a small business owner, no jargon.`

    const result = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: prompt,
    })
    if (result.text) note = result.text.trim()
  } catch (err) {
    console.error('Shepherd nudge generation failed, using fallback note:', err)
  }

  await logAgentAction({
    agentName: 'shepherd_agent',
    entityType: 'clerk_user',
    entityId: userId,
    actionType: 'stuck_check',
    input: { orderId, status: order.status, hoursStuck: Math.round(hoursStuck) },
    output: { stuck: true, note },
    confidence: null,
  })

  return NextResponse.json({ stuck: true, note })
}
