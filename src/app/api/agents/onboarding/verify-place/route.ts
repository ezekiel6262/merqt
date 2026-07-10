import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { GoogleGenAI, Type } from '@google/genai'
import { logAgentAction } from '@/lib/agents/logAgentAction'

const CATEGORIES = [
  'Fashion and Textiles', 'Food and Catering', 'Electronics and Gadgets', 'Home Services',
  'Beauty and Wellness', 'Creative Services', 'Professional Services', 'Other',
]

export async function POST(req: Request) {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { placeId, businessName, category, city } = await req.json()
  if (!placeId || !category) {
    return NextResponse.json({ error: 'placeId and category are required' }, { status: 400 })
  }

  const detailsRes = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: {
      'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY!,
      'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,types,regularOpeningHours,internationalPhoneNumber',
    },
  })
  if (!detailsRes.ok) return NextResponse.json({ error: 'Could not fetch place details' }, { status: 502 })
  const place = await detailsRes.json()

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
  const prompt = `You are a data-verification assistant for Merqt, a trade marketplace in Nigeria.
A seller signing up chose the Merqt category "${category}" for their business "${businessName}".
Google Maps returned this listing for the business they searched for:
- Name: ${place.displayName?.text}
- Address: ${place.formattedAddress}
- Google Place Types: ${(place.types ?? []).join(', ')}

Merqt's fixed category list is: ${CATEGORIES.join(', ')}.
Decide whether the seller's chosen category is a plausible match for Google's place types.
Also state which Merqt category (from the fixed list) best fits Google's place types.
Keep "reasoning" to one short sentence a small business owner can understand. Never refuse; always give your best judgment even with sparse data.`

  const result = await ai.models.generateContent({
    model: 'gemini-flash-latest',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          categoryMatch: { type: Type.BOOLEAN },
          matchedCategory: { type: Type.STRING, enum: CATEGORIES },
          confidence: { type: Type.NUMBER },
          reasoning: { type: Type.STRING },
        },
        required: ['categoryMatch', 'matchedCategory', 'confidence', 'reasoning'],
      },
    },
  })

  const verification = JSON.parse(result.text ?? '{}')

  await logAgentAction({
    agentName: 'onboarding_agent',
    entityType: 'clerk_user',
    entityId: userId,
    actionType: 'places_verify',
    input: { placeId, businessName, category, city },
    output: { place, verification },
    confidence: verification.confidence ?? null,
  })

  return NextResponse.json({
    place: {
      placeId: place.id,
      address: place.formattedAddress ?? '',
      lat: place.location?.latitude ?? null,
      lng: place.location?.longitude ?? null,
      phone: place.internationalPhoneNumber ?? null,
      hours: place.regularOpeningHours?.weekdayDescriptions ?? null,
    },
    verification,
  })
}
