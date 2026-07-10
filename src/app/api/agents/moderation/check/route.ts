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

  let parsed: {
    verdict: 'approved' | 'flagged'
    reason: string
    flaggedCategory: string | null
    confidence: number | null
    imageMismatch: boolean
    mismatchReason: string
  } = {
    verdict: 'flagged',
    reason: 'Could not complete an automated safety check for this listing yet.',
    flaggedCategory: 'other',
    confidence: null,
    // Fails OPEN, unlike the safety verdict above - a technical hiccup in our
    // own check shouldn't block a seller from submitting a legitimate listing.
    imageMismatch: false,
    mismatchReason: '',
  }

  try {
    const imageParts = (
      await Promise.all((Array.isArray(images) ? images : []).slice(0, 6).map(imageUrlToPart))
    ).filter((p): p is { inlineData: { mimeType: string; data: string } } => p !== null)

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
    const prompt = `You are a content reviewer for Merqt, a public trade marketplace in Nigeria. A seller has submitted a new listing. You are checking two SEPARATE, INDEPENDENT things - do not mix them up.

Listing name: "${name}"
Category: "${category ?? 'unspecified'}"
Description: "${description ?? ''}"

CHECK 1 - Photo/text mismatch (a fixable quality problem, not a safety issue):
Does at least one attached photo clearly fail to depict the described product/service (e.g. an unrelated object, a random stock photo, a cartoon/illustration standing in for a real item photo)? Only flag a genuine, obvious mismatch - do not flag photos that are merely low-quality, informal, or imperfect but still plausibly show the real item. If there are no photos at all, there is no mismatch to flag.

CHECK 2 - Safety policy violation (independent of Check 1):
Flag ONLY if the listing contains or depicts one of these specific violations: explicit or adult sexual content, illegal items (weapons, drugs, counterfeit goods), hate symbols or hateful content, or obvious scam/spam text (e.g. fake giveaways, phishing links, requests for bank/card details, nonsensical repeated text). Do NOT flag for vague/sparse descriptions or photo quality/mismatch issues - that is Check 1's job, not this one. Merqt sellers are often small, informal traders - normal listings should always pass this check even with imperfect photos or descriptions.

Respond with:
- imageMismatch: true only if Check 1 finds a genuine mismatch, else false
- mismatchReason: if imageMismatch is true, one short sentence telling the seller what's wrong and that they should upload a photo of the actual item. Empty string otherwise.
- verdict: "approved" or "flagged" for Check 2, independent of Check 1
- reason: if flagged (Check 2), one short sentence explaining why, written to be shown to the seller. Empty string if approved.
- flaggedCategory: one of "explicit_content", "prohibited_item", "hate_content", "scam_or_spam", "other" if flagged, or "none" if approved.
- confidence: your confidence in the Check 2 verdict, 0 to 1.`

    const result = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: [{ role: 'user', parts: [{ text: prompt }, ...imageParts] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            imageMismatch: { type: Type.BOOLEAN },
            mismatchReason: { type: Type.STRING },
            verdict: { type: Type.STRING, enum: ['approved', 'flagged'] },
            reason: { type: Type.STRING },
            flaggedCategory: {
              type: Type.STRING,
              enum: ['explicit_content', 'prohibited_item', 'hate_content', 'scam_or_spam', 'other', 'none'],
            },
            confidence: { type: Type.NUMBER },
          },
          required: ['imageMismatch', 'mismatchReason', 'verdict', 'reason', 'flaggedCategory', 'confidence'],
        },
      },
    })

    const raw = JSON.parse(result.text ?? '{}')
    parsed = {
      verdict: raw.verdict === 'approved' ? 'approved' : 'flagged',
      reason: typeof raw.reason === 'string' ? raw.reason : '',
      flaggedCategory: raw.flaggedCategory === 'none' ? null : (raw.flaggedCategory ?? null),
      confidence: typeof raw.confidence === 'number' ? raw.confidence : null,
      imageMismatch: raw.imageMismatch === true,
      mismatchReason: typeof raw.mismatchReason === 'string' ? raw.mismatchReason : '',
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
    output: {
      verdict: parsed.verdict,
      reason: parsed.reason,
      flaggedCategory: parsed.flaggedCategory,
      imageMismatch: parsed.imageMismatch,
      mismatchReason: parsed.mismatchReason,
    },
    confidence: parsed.confidence,
  })

  if (parsed.imageMismatch) {
    return NextResponse.json({ rejected: true, reason: parsed.mismatchReason }, { status: 422 })
  }

  return NextResponse.json(parsed)
}
