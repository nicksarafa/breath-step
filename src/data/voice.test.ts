import { describe, expect, it } from 'vitest'
import { allVoiceLines, withoutTopic } from './voice'

describe('voice script', () => {
  it('fits the ElevenLabs free tier (10,000 characters)', () => {
    const chars = allVoiceLines().join('').length
    console.log(`voice lines: ${allVoiceLines().length}, characters: ${chars}`)
    expect(chars).toBeLessThan(9000)
  })
  it('never includes the user question', () => {
    expect(withoutTopic('Bring in your question. “What is my next step?”')).toBe('Bring in your question.')
    expect(withoutTopic('Bring in your question. {topic}')).toBe('Bring in your question.')
  })
})
