import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { GoogleGenAI, Type } from '@google/genai'
import { logAgentAction } from '@/lib/agents/logAgentAction'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { reviewId, rating, body } = await req.json()
  if (!reviewId || typeof rating !== 'number') {
    return NextResponse.json({ error: 'reviewId and rating are required' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: userRow } = await admin.from('users').select('id').eq('clerk_id', userId).single()
  if (!userRow) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: review } = await admin
    .from('reviews')
    .select('id')
    .eq('id', reviewId)
    .eq('buyer_id', userRow.id)
    .single()
  if (!review) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let flagged = false
  let reason = ''

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
    const prompt = `You are a review-quality reviewer for Merqt, a trade marketplace in Nigeria. A buyer left this review for a completed order:

Star rating: ${rating} out of 5
Review text: "${body || '(no text)'}"

Flag this review as suspicious ONLY if one of these is clearly true:
- The text's sentiment clearly contradicts the star rating (e.g. a very negative or complaint-filled text with a 4 or 5 star rating, or a glowing positive text with a 1 or 2 star rating)
- The text is spam, gibberish, nonsensical, or copy-pasted unrelated content

Do NOT flag reviews merely for being short, vague, generic, or having no text at all - Merqt buyers often leave brief reviews and that is completely normal. A short "good" or "nice" with a 5-star rating is NOT suspicious.

Respond with:
- flagged: true or false
- reason: if flagged, one short sentence explaining why. Empty string if not flagged.`

    const result = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            flagged: { type: Type.BOOLEAN },
            reason: { type: Type.STRING },
          },
          required: ['flagged', 'reason'],
        },
      },
    })

    const raw = JSON.parse(result.text ?? '{}')
    flagged = raw.flagged === true
    reason = typeof raw.reason === 'string' ? raw.reason : ''
  } catch (err) {
    // Fails open - this is informational only, never blocks or hides a review.
    console.error('Review intelligence check failed, leaving unflagged:', err)
  }

  if (flagged) {
    await admin.from('reviews').update({ flagged_suspicious: true, flag_reason: reason }).eq('id', reviewId)
  }

  await logAgentAction({
    agentName: 'review_intelligence_agent',
    entityType: 'clerk_user',
    entityId: userId,
    actionType: 'review_check',
    input: { reviewId, rating, body },
    output: { flagged, reason },
    confidence: null,
  })

  return NextResponse.json({ flagged, reason })
}
