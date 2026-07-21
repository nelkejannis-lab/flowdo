/** Public nova config — safe in browser bundle. */
const envJoin = (import.meta.env.VITE_TWILIO_SANDBOX_JOIN_CODE as string | undefined)?.trim() || null
const envBot = (import.meta.env.VITE_TWILIO_WHATSAPP_FROM as string | undefined)?.trim() || null

/** Browser calls same-origin proxy (/api/nova → nova-server); dev uses Vite proxy. */
export const NOVA_PUBLIC = {
  serverUrl: '/api/nova',
  /** Display-only bot number shown in Settings → Verbindungen. */
  whatsappBotNumber: (envBot?.replace(/^whatsapp:/i, '') || '+14155238886') as string,
  /** Twilio Sandbox is required until a paid WhatsApp Business sender is configured. */
  whatsappSandboxMode: true,
  /** Full phrase e.g. "join yellow-tiger" — set via VITE_TWILIO_SANDBOX_JOIN_CODE or nova-server. */
  whatsappSandboxJoinCode: envJoin,
}
