import { describe, expect, it } from 'vitest'
import { createLatestRequest } from './latestRequest'

describe('createLatestRequest', () => {
  it('begin()直後のトークンは古くない', () => {
    const latest = createLatestRequest()
    const token = latest.begin()
    expect(token.isStale()).toBe(false)
  })

  it('後からbegin()すると、前のトークンは古くなる', () => {
    const latest = createLatestRequest()
    const first = latest.begin()
    const second = latest.begin()
    expect(first.isStale()).toBe(true)
    expect(second.isStale()).toBe(false)
  })

  it('インスタンスごとに独立している', () => {
    const a = createLatestRequest()
    const b = createLatestRequest()
    const tokenA = a.begin()
    b.begin()
    expect(tokenA.isStale()).toBe(false)
  })
})
