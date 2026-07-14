import Anthropic from 'npm:@anthropic-ai/sdk@0.24.3'
import { corsHeaders, jsonResponse, optionsResponse, requireUser } from '../_shared/auth.ts'

const DEFAULT_MODEL = 'claude-sonnet-4-6'
const DEFAULT_MAX_TOKENS = 4096

const ALLOWED_MODELS = new Set([
  'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001',
])

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()

  const auth = await requireUser(req)
  if ('error' in auth) return auth.error

  try {
    const { messages, systemPrompt, imageBase64, imageMimeType, model, maxTokens } = await req.json()

    const resolvedModel =
      typeof model === 'string' && ALLOWED_MODELS.has(model) ? model : DEFAULT_MODEL
    const resolvedMaxTokens =
      typeof maxTokens === 'number' && maxTokens >= 256 && maxTokens <= 4096
        ? Math.floor(maxTokens)
        : DEFAULT_MAX_TOKENS

    const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })

    const lastMsg = messages[messages.length - 1]
    const userContent: Anthropic.MessageParam['content'] = []

    if (imageBase64 && imageMimeType) {
      userContent.push({
        type: 'image',
        source: { type: 'base64', media_type: imageMimeType, data: imageBase64 },
      })
    }

    userContent.push({ type: 'text', text: lastMsg.content })

    const apiMessages: Anthropic.MessageParam[] = [
      ...messages.slice(0, -1).map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: userContent },
    ]

    const response = await client.messages.create({
      model: resolvedModel,
      max_tokens: resolvedMaxTokens,
      system: systemPrompt,
      messages: apiMessages,
    })

    const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
    return jsonResponse({ text })
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500)
  }
})
