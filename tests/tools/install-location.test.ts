import { describe, it, expect } from 'vitest'
import { join } from 'node:path'
import { resolveInstallLocation } from '../../src/tools/install-location.js'

describe('resolveInstallLocation', () => {
  it('asks user to choose when both .claude and .github are missing', () => {
    const result = resolveInstallLocation('/workspace', undefined, undefined, () => false)
    expect(result.needsChoice).toBe(true)
    expect(result.message).toMatch(/install_base/i)
    expect(result.message).toMatch(/\.claude/i)
    expect(result.message).toMatch(/\.github/i)
    expect(result.message).toMatch(/universal/i)
  })

  it('uses explicit install_base=.claude', () => {
    const result = resolveInstallLocation('/workspace', undefined, '.claude', () => false)
    expect(result.needsChoice).toBe(false)
    expect(result.targetDir).toBe(join('/workspace', '.claude'))
  })

  it('uses explicit install_base=.github', () => {
    const result = resolveInstallLocation('/workspace', undefined, '.github', () => false)
    expect(result.needsChoice).toBe(false)
    expect(result.targetDir).toBe(join('/workspace', '.github'))
  })

  it('uses explicit install_base=universal (workspace root)', () => {
    const result = resolveInstallLocation('/workspace', undefined, 'universal', () => false)
    expect(result.needsChoice).toBe(false)
    expect(result.targetDir).toBe('/workspace')
  })

  it('does not ask when one ecosystem directory exists', () => {
    const result = resolveInstallLocation('/workspace', undefined, undefined, (p) => p.endsWith('.github'))
    expect(result.needsChoice).toBe(false)
    expect(result.targetDir).toBeUndefined()
  })
})
