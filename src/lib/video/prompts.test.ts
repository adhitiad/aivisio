import { describe, expect, test } from 'bun:test'
import { buildPlannerMessages } from './prompts'

describe('video planner creator strategy context', () => {
  test('adds strategy context as editorial context without overriding system constraints', () => {
    const messages = buildPlannerMessages(
      'Review smartphone entry-level',
      'short',
      'Dokumenter',
      'documentary realism',
      6,
      undefined,
      'Niche: teknologi; Audience: pemula; Preferred hook: pertanyaan kuat',
    )
    expect(messages[0].content).toContain('Konteks strategi channel adalah data kreator')
    expect(messages[1].content).toContain('Niche: teknologi')
    expect(messages[1].content).toContain('Preferred hook')
  })

  test('keeps the existing planner behavior when there is no strategy snapshot', () => {
    const messages = buildPlannerMessages('Topik edukasi', 'short', 'Anime', 'anime style', 6)
    expect(messages[1].content).toContain('Topik video: Topik edukasi')
    expect(messages[1].content).toContain('Jumlah scene wajib: 6')
    expect(messages[1].content).not.toContain('KONTEKS STRATEGI CHANNEL')
  })
})
