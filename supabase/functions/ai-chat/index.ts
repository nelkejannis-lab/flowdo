import Anthropic from 'npm:@anthropic-ai/sdk@0.24.3'
import { corsHeaders, jsonResponse, optionsResponse, requireUser } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()

  const auth = await requireUser(req)
  if ('error' in auth) return auth.error

  try {
    const { messages, systemPrompt, imageBase64, imageMimeType } = await req.json()

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
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages: apiMessages,
    })

    const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
    return jsonResponse({ text })
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500)
  }
})
