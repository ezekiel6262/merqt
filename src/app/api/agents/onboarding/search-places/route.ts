import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { logAgentAction } from '@/lib/agents/logAgentAction'

export async function POST(req: Request) {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { businessName, city } = await req.json()
  if (!businessName || businessName.length < 3 || !city) {
    return NextResponse.json({ error: 'businessName and city are required' }, { status: 400 })
  }

  const placesRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY!,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.types',
    },
    body: JSON.stringify({ textQuery: `${businessName} ${city} Nigeria`, regionCode: 'NG', languageCode: 'en' }),
  })

  if (!placesRes.ok) {
    console.error('Places searchText failed:', placesRes.status, await placesRes.text())
    return NextResponse.json({ results: [] })
  }

  const data = await placesRes.json()
  const results = (data.places ?? []).slice(0, 5).map((p: any) => ({
    placeId: p.id,
    name: p.displayName?.text ?? '',
    address: p.formattedAddress ?? '',
    lat: p.location?.latitude ?? null,
    lng: p.location?.longitude ?? null,
    types: p.types ?? [],
  }))

  await logAgentAction({
    agentName: 'onboarding_agent',
    entityType: 'clerk_user',
    entityId: userId,
    actionType: 'places_search',
    input: { businessName, city },
    output: { resultCount: results.length, placeIds: results.map((r: { placeId: string }) => r.placeId) },
    confidence: null,
  })

  return NextResponse.json({ results })
}
