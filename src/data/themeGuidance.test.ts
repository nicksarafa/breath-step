import { describe, expect, it } from 'vitest'
import { resolveThemeRequest } from '../../server/tts'
import { CYCLES } from './blueprint'
import { cleanTheme, THEME_TEMPLATES, themeLine, themeLines, toSecondPerson, weave } from './themeGuidance'

describe('theme guidance', () => {
  it('has questions for every cycle', () => {
    expect(THEME_TEMPLATES).toHaveLength(CYCLES.length)
    THEME_TEMPLATES.forEach((t) => expect(t.length).toBeGreaterThan(0))
  })
  it('speaks first person in "My dear body" lines and second person elsewhere', () => {
    expect(themeLine(1, 0, 'my dream company')).toBe('My dear body, please show me how I have been feeling about my dream company.')
    expect(themeLine(2, 0, 'my dream company')).toBe('What resistance shows up when you think about your dream company?')
    expect(toSecondPerson('me and my family')).toBe('you and your family')
  })
  it('cleans themes', () => {
    expect(cleanTheme('  my <b>purpose</b>?? ')).toBe('my bpurpose/b')
    expect(themeLines(0, '   ')).toEqual([])
  })
  it('weaves theme lines between the base guidance', () => {
    expect(weave(['a', 'b', 'c'], ['1', '2'])).toEqual(['a', '1', 'b', '2', 'c'])
  })
  it('the voice function only voices known templates', () => {
    expect(resolveThemeRequest({ cycle: 2, line: 0, theme: 'my health' })).toBe('What resistance shows up when you think about your health?')
    expect(resolveThemeRequest({ cycle: 2, line: 99, theme: 'x' })).toBeNull()
    expect(resolveThemeRequest({ text: 'say anything' })).toBeNull()
  })
})
