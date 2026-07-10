import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { GoogleGenAI, Type } from '@google/genai'
import { logAgentAction } from '@/lib/agents/logAgentAction'

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

  const { name, description, category, images } = await req.json()
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  let parsed: { verdict: 'approved' | 'flagged'; reason: string; flaggedCategory: string | null; confidence: number | null } = {
    verdict: 'flagged',
    reason: 'Could not complete an automated safety check for this listing yet.',
    flaggedCategory: 'other',
    confidence: null,
  }

  try {
    const imageParts = (
      await Promise.all((Array.isArray(images) ? images : []).slice(0, 6).map(imageUrlToPart))
    ).filter((p): p is { inlineData: { mimeType: string; data: string } } => p !== null)

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
    const prompt = `You are a content moderation reviewer for Merqt, a public trade marketplace in Nigeria. A seller has submitted a new listing. Review the text and any attached photos for policy violations before it goes live to buyers.

Listing name: "${name}"
Category: "${category ?? 'unspecified'}"
Description: "${description ?? ''}"

Flag the listing ONLY if it contains or depicts one of these specific violations: explicit or adult sexual content, illegal items (weapons, drugs, counterfeit goods), hate symbols or hateful content, or obvious scam/spam text (e.g. fake giveaways, phishing links, requests for bank/card details, nonsensical repeated text).

Do NOT flag a listing for any other reason, even if it seems unusual. In particular, never flag a listing merely because:
- a photo looks unrelated to, or does not clearly match, the text description
- a photo is a placeholder, illustration, cartoon, stock image, or low quality
- the description is vague, sparse, or informal
These are content-quality concerns, not safety violations, and Merqt sellers are often small, informal traders - normal listings should always be approved even with imperfect photos or descriptions. Only use "other" for a genuine safety violation that doesn't fit the other categories - never for a content-quality or mismatch concern.

Respond with:
- verdict: "approved" or "flagged"
- reason: if flagged, one short sentence explaining why, written to be shown to the seller. Empty string if approved.
- flaggedCategory: one of "explicit_content", "prohibited_item", "hate_content", "scam_or_spam", "other" if flagged, or "none" if approved.
- confidence: your confidence in this verdict, 0 to 1.`

    const result = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: [{ role: 'user', parts: [{ text: prompt }, ...imageParts] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            verdict: { type: Type.STRING, enum: ['approved', 'flagged'] },
            reason: { type: Type.STRING },
            flaggedCategory: {
              type: Type.STRING,
              enum: ['explicit_content', 'prohibited_item', 'hate_content', 'scam_or_spam', 'other', 'none'],
            },
            confidence: { type: Type.NUMBER },
          },
          required: ['verdict', 'reason', 'flaggedCategory', 'confidence'],
        },
      },
    })

    const raw = JSON.parse(result.text ?? '{}')
    parsed = {
      verdict: raw.verdict === 'approved' ? 'approved' : 'flagged',
      reason: typeof raw.reason === 'string' ? raw.reason : '',
      flaggedCategory: raw.flaggedCategory === 'none' ? null : (raw.flaggedCategory ?? null),
      confidence: typeof raw.confidence === 'number' ? raw.confidence : null,
    }
  } catch (err) {
    // Fail CLOSED, not open - unlike the onboarding/concierge agents, this is a
    // safety gate. If Gemini errors, the listing stays hidden pending review
    // rather than silently going live unchecked.
    console.error('Moderation check failed, defaulting to flagged:', err)
  }

  await logAgentAction({
    agentName: 'moderation_agent',
    entityType: 'clerk_user',
    entityId: userId,
    actionType: 'listing_check',
    input: { name, description, category, imageUrls: images ?? [] },
    output: { verdict: parsed.verdict, reason: parsed.reason, flaggedCategory: parsed.flaggedCategory },
    confidence: parsed.confidence,
  })

  return NextResponse.json(parsed)
}
