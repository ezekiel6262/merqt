import { createAdminClient } from '@/lib/supabase/admin'

export async function logAgentAction(params: {
  agentName: string
  entityType: string
  entityId: string | null
  actionType: string
  input: unknown
  output: unknown
  confidence?: number | null
}) {
  const admin = createAdminClient()
  const { error } = await admin.from('agent_actions').insert({
    agent_name: params.agentName,
    entity_type: params.entityType,
    entity_id: params.entityId,
    action_type: params.actionType,
    input: params.input,
    output: params.output,
    confidence: params.confidence ?? null,
  })
  if (error) console.error('agent_actions log failed:', error)
}
