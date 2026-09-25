/**
 * Separa un mensaje de error en una parte legible (español, para el usuario)
 * y un detalle técnico (para programadores) que conviene ocultar tras "Ver
 * más". Los patrones técnicos son mensajes del navegador en inglés, nombres de
 * excepciones y URLs.
 */

const TECH_PATTERNS: RegExp[] = [
  /\bFailed to execute\b/i,
  /\bFailed to fetch\b/i,
  /\bFailed to load\b/i,
  /\bUser activation is required\b/i,
  /\b(?:DOMException|SecurityError|NotAllowedError|AbortError|QuotaExceededError|TypeError|SyntaxError|ReferenceError|RangeError|NetworkError|InvalidStateError)\b/,
  /\bError:\s/,
  /`[^`]+`/,
  /https?:\/\/[^\s]+/i,
]

export function splitErrorMessage(message: string): {
  friendly: string
  technical: string | null
} {
  let earliest = -1
  for (const re of TECH_PATTERNS) {
    const match = re.exec(message)
    if (match && (earliest === -1 || match.index < earliest)) earliest = match.index
  }
  if (earliest <= 0) return { friendly: message, technical: null }

  const friendly = message.slice(0, earliest).replace(/[\s:：-]+$/, '').trim()
  const technical = message.slice(earliest).trim()
  if (!friendly) return { friendly: message, technical: null }
  return { friendly, technical }
}