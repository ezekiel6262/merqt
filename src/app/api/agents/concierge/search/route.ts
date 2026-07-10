import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { GoogleGenAI, Type } from '@google/genai'
import { logAgentAction } from '@/lib/agents/logAgentAction'
import { CATEGORIES, CITIES } from '@/lib/constants'

export async function POST(req: Request) {
  const { userId } = auth()

  const { query } = await req.json()
  if (!query || typeof query !== 'string' || query.trim().length < 3) {
    return NextResponse.json({ error: 'query is required' }, { status: 400 })
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
  const prompt = `You are a search-intent parser for Merqt, a trade marketplace in Nigeria where buyers browse a directory of sellers/service providers.
A buyer typed this free-text search: "${query}"

Merqt's fixed seller categories are: ${CATEGORIES.join(', ')}.
Merqt's supported cities are: ${CITIES.join(', ')}.

Extract structured search intent from the buyer's text:
- category: the single best-matching Merqt category from the fixed list, or "null" if nothing in the text maps to one of them. Never invent a category outside this list.
- city: the single best-matching Merqt city from the fixed list, or "null" if no city is mentioned or it isn't one of these cities.
- keywords: 2-5 short lowercase words or phrases from the buyer's intent (e.g. the service type, occasion, or descriptive terms) useful for matching against a seller's bio and business name. Do not include the city or category name itself as a keyword if already captured above.
- explanation: one short, friendly sentence (under 20 words) telling the buyer what you searched for, e.g. "Showing wedding photographers in Lagos." Written for the buyer, not a debug log. If category and city are both "null", write a sentence acknowledging you're showing keyword matches instead.

Only extract what the fixed lists and buyer's own words support. Never fabricate a price, date, or rating filter - Merqt's current search cannot check those.`

  const result = await ai.models.generateContent({
    model: 'gemini-flash-latest',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING, enum: [...CATEGORIES, 'null'] },
          city: { type: Type.STRING, enum: [...CITIES, 'null'] },
          keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
          explanation: { type: Type.STRING },
        },
        required: ['category', 'city', 'keywords', 'explanation'],
      },
    },
  })

  const raw = JSON.parse(result.text ?? '{}')
  const parsed = {
    category: CATEGORIES.includes(raw.category) ? raw.category : null,
    city: CITIES.includes(raw.city) ? raw.city : null,
    keywords: Array.isArray(raw.keywords) ? raw.keywords.slice(0, 5) : [],
    explanation: typeof raw.explanation === 'string' ? raw.explanation : '',
  }

  await logAgentAction({
    agentName: 'concierge_agent',
    entityType: 'clerk_user',
    entityId: userId ?? null,
    actionType: 'search_parse',
    input: { query },
    output: parsed,
    confidence: null,
  })

  return NextResponse.json(parsed)
}
