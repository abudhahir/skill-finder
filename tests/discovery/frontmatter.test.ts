// tests/discovery/frontmatter.test.ts
import { describe, it, expect } from 'vitest'
import { parseFrontmatter } from '../../src/discovery/frontmatter.js'

describe('parseFrontmatter', () => {
  it('parses name, description, tags, type from frontmatter', () => {
    const md = `---
name: tdd
description: Test-driven development
tags: [testing, tdd]
type: skill
---
# Content here`
    const result = parseFrontmatter(md)
    expect(result.name).toBe('tdd')
    expect(result.description).toBe('Test-driven development')
    expect(result.tags).toEqual(['testing', 'tdd'])
    expect(result.type).toBe('skill')
  })

  it('returns empty object when no frontmatter', () => {
    const result = parseFrontmatter('# Just a heading\nNo frontmatter.')
    expect(result.name).toBeUndefined()
  })

  it('handles missing optional fields gracefully', () => {
    const md = `---
name: my-agent
---`
    const result = parseFrontmatter(md)
    expect(result.name).toBe('my-agent')
    expect(result.tags).toBeUndefined()
  })
})
