import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { GoogleGenAI, Type } from '@google/genai'
import { logAgentAction } from '@/lib/agents/logAgentAction'
import { createAdminClient } from '@/lib/supabase/admin'

async function imageUrlToPart(url: string) {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const mimeType = res.headers.get('content-type') ?? 'image/jpeg'
    const buffer = await res.arrayBuffer()
    const data = Buffer.from(buffer).toString('base64')
    return { inlineData: { mimeType, data } }
  } catch {
    return null
  }
}

export async function POST(req: Request) {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { documentUrl } = await req.json()
  if (!documentUrl) return NextResponse.json({ error: 'documentUrl is required' }, { status: 400 })

  const admin = createAdminClient()
  const { data: userRow } = await admin.from('users').select('id').eq('clerk_id', userId).single()
  if (!userRow) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: sellerRow } = await admin.from('sellers').select('id, business_name').eq('user_id', userRow.id).single()
  if (!sellerRow) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // This is NOT a legal identity check - it cannot confirm the document is
  // authentic or belongs to this seller. It only filters out obviously
  // invalid submissions before a human reviews the rest. It can reject;
  // it can never approve - sellers.verified only changes via a human
  // admin decision in /admin/verifications.
  let status: 'pending' | 'rejected' = 'pending'
  let reason = ''

  try {
    const imagePart = await imageUrlToPart(documentUrl)
    if (!imagePart) throw new Error('Could not load document image')

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
    const prompt = `You are a pre-screening assistant for Merqt, a trade marketplace in Nigeria. A seller ("${sellerRow.business_name}") has uploaded a document for identity verification.

You CANNOT confirm this document is authentic or that it belongs to this person - that requires a human reviewer. Your ONLY job is to catch obviously invalid submissions before a human looks at the rest.

Look at the attached image and decide:
- looksLikeValidDocument: true if the image plausibly shows a government-issued ID (national ID, driver's license, passport, voter's card) or a business registration/CAC certificate. false if it is blank, an unrelated photo (e.g. a product photo, a selfie with no visible document, a meme, a screenshot of something else entirely).
- reason: one short sentence. If false, explain what's wrong so the seller knows what to resubmit. If true, just note what type of document it appears to be.

Never claim to verify the person's actual identity or the document's authenticity - only whether the right TYPE of document was submitted.`

    const result = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: [{ role: 'user', parts: [{ text: prompt }, imagePart] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            looksLikeValidDocument: { type: Type.BOOLEAN },
            reason: { type: Type.STRING },
          },
          required: ['looksLikeValidDocument', 'reason'],
        },
      },
    })

    const raw = JSON.parse(result.text ?? '{}')
    if (raw.looksLikeValidDocument === false) {
      status = 'rejected'
      reason = typeof raw.reason === 'string' ? raw.reason : 'This does not look like a valid ID or business document.'
    } else {
      status = 'pending'
      reason = ''
    }
  } catch (err) {
    // Fail toward "pending", not "rejected" - a technical hiccup on our side
    // shouldn't punish a seller who submitted a legitimate document. It also
    // never fails toward auto-approval either way.
    console.error('Identity pre-check failed, leaving pending for manual review:', err)
  }

  await admin.from('sellers').update({
    identity_document_url: documentUrl,
    identity_status: status,
    identity_rejection_reason: reason || null,
  }).eq('id', sellerRow.id)

  await logAgentAction({
    agentName: 'identity_verification_agent',
    entityType: 'clerk_user',
    entityId: userId,
    actionType: 'document_precheck',
    input: { documentUrl },
    output: { status, reason },
    confidence: null,
  })

  return NextResponse.json({ status, reason })
}
