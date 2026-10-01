import { describe, it, expect } from 'vitest'
import { latestUserMessage, knowledgeQuery } from './query'

describe('knowledgeQuery', () => {
  it('joins the last three customer turns, oldest first, skipping replies', () => {
    expect(
      knowledgeQuery([
        { role: 'user', content: 'one' },
        { role: 'user', content: 'I want a website for my bakery' },
        { role: 'assistant', content: 'Sure!' },
        { role: 'user', content: 'connected to inventory' },
        { role: 'user', content: 'how much would that cost me?' },
      ]),
    ).toBe(
      'I want a website for my bakery\nconnected to inventory\nhow much would that cost me?',
    )
  })

  it('falls back to the last message when none are user', () => {
    expect(
      knowledgeQuery([{ role: 'assistant', content: 'only assistant' }]),
    ).toBe('only assistant')
  })

  it('returns empty string for no messages', () => {
    expect(knowledgeQuery([])).toBe('')
  })
})

describe('latestUserMessage', () => {
  it('returns the most recent user turn', () => {
    expect(
      latestUserMessage([
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'reply' },
        { role: 'user', content: 'latest' },
      ]),
    ).toBe('latest')
  })

  it('falls back to the last message when none are user', () => {
    expect(
      latestUserMessage([{ role: 'assistant', content: 'only assistant' }]),
    ).toBe('only assistant')
  })

  it('returns empty string for no messages', () => {
    expect(latestUserMessage([])).toBe('')
  })
})
