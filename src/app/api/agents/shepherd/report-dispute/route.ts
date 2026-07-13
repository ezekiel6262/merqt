import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { GoogleGenAI, Type } from '@google/genai'
import { logAgentAction } from '@/lib/agents/logAgentAction'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { orderId, reason } = await req.json()
  if (!orderId || !reason || typeof reason !== 'string' || reason.trim().length < 3) {
    return NextResponse.json({ error: 'orderId and reason are required' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: userRow } = await admin.from('users').select('id').eq('clerk_id', userId).single()
  if (!userRow) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: order } = await admin
    .from('orders')
    .select('id, is_service, request_description')
    .eq('id', orderId)
    .eq('buyer_id', userRow.id)
    .single()
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let category = 'other'
  let suggestedAction = ''
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
    const prompt = `A buyer on Merqt (a Nigerian trade marketplace) reported a problem with an order. Categorize it and suggest one short next step for the seller.

Order type: ${order.is_service ? 'service request' : 'product order'}
Buyer's reported problem: "${reason}"

Respond with:
- category: one of "not_received", "not_as_described", "quality_issue", "other"
- suggestedAction: one short sentence suggesting what the seller should do next.`

    const result = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING, enum: ['not_received', 'not_as_described', 'quality_issue', 'other'] },
            suggestedAction: { type: Type.STRING },
          },
          required: ['category', 'suggestedAction'],
        },
      },
    })
    const raw = JSON.parse(result.text ?? '{}')
    category = typeof raw.category === 'string' ? raw.category : 'other'
    suggestedAction = typeof raw.suggestedAction === 'string' ? raw.suggestedAction : ''
  } catch (err) {
    console.error('Dispute categorization failed, logging raw report only:', err)
  }

  const { error: updateError } = await admin
    .from('orders')
    .update({
      dispute_status: 'reported',
      dispute_reason: reason,
      disputed_at: new Date().toISOString(),
      dispute_category: category,
      dispute_suggested_action: suggestedAction || null,
    })
    .eq('id', orderId)

  if (updateError) return NextResponse.json({ error: 'Could not save report' }, { status: 500 })

  await logAgentAction({
    agentName: 'shepherd_agent',
    entityType: 'clerk_user',
    entityId: userId,
    actionType: 'dispute_report',
    input: { orderId, reason },
    output: { category, suggestedAction },
    confidence: null,
  })

  return NextResponse.json({ ok: true })
}
