import type { ChatMessage } from './types'

/**
 * The most recent customer (`user`) turn in the conversation context.
 * Falls back to the last message of any role, then empty string.
 */
export function latestUserMessage(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') return messages[i].content
  }
  return messages.length > 0 ? messages[messages.length - 1].content : ''
}

/**
 * The text to retrieve knowledge against: the last `turns` customer
 * messages, oldest first. Follow-ups often drop the topic ("how much
 * would that cost me?" after "I want a website for my bakery"), so the
 * latest message alone can miss the relevant document. Lexical search
 * ORs the terms (migration 039), so extra turns widen recall without
 * making a match harder. Falls back to `latestUserMessage` when the
 * context has no customer turns. Shared by the draft route, the
 * playground and the auto-reply bot so all three query the knowledge
 * base the same way.
 */
export function knowledgeQuery(messages: ChatMessage[], turns = 3): string {
  const userTurns = messages
    .filter((m) => m.role === 'user')
    .slice(-turns)
    .map((m) => m.content)
  return userTurns.length > 0 ? userTurns.join('\n') : latestUserMessage(messages)
}
