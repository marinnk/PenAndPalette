import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/apiClient'
import { useHeaderSearch } from './useHeaderSearch'

vi.mock('@/lib/apiClient', () => ({
  apiClient: { get: vi.fn() },
}))

function makeUser(id: number, username: string) {
  return { id, username, display_name: username, avatar_url: null }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(apiClient.get).mockReset()
  vi.mocked(apiClient.get).mockResolvedValue({ data: [] })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useHeaderSearch', () => {
  it('入力が落ち着いてから検索し、候補を開く（デバウンス）', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: [makeUser(2, 'jiro')] })
    const { keyword, users, open } = useHeaderSearch()

    keyword.value = 'ji'
    keyword.value = 'jir'
    keyword.value = 'jiro'
    expect(apiClient.get).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(300)

    expect(apiClient.get).toHaveBeenCalledTimes(1)
    expect(apiClient.get).toHaveBeenCalledWith('/api/users/', { params: { q: 'jiro' } })
    expect(users.value.map((u) => u.id)).toEqual([2])
    expect(open.value).toBe(true)
  })

  it('キーワードを空にすると候補を閉じ、検索しない', async () => {
    const { keyword, open } = useHeaderSearch()

    keyword.value = 'jiro'
    await vi.advanceTimersByTimeAsync(300)
    expect(open.value).toBe(true)

    keyword.value = '  '
    await vi.advanceTimersByTimeAsync(300)

    expect(open.value).toBe(false)
    expect(apiClient.get).toHaveBeenCalledTimes(1)
  })

  it('runNow: デバウンスを待たず即座に検索して候補を開く', async () => {
    const { keyword, open, runNow } = useHeaderSearch()

    keyword.value = 'jiro'
    runNow()
    await vi.runAllTimersAsync()

    expect(apiClient.get).toHaveBeenCalledWith('/api/users/', { params: { q: 'jiro' } })
    expect(open.value).toBe(true)
  })

  it('runNow: キーワードが空白のみなら検索せず候補も開かない', async () => {
    const { keyword, open, runNow } = useHeaderSearch()

    keyword.value = '   '
    runNow()
    await vi.runAllTimersAsync()

    expect(apiClient.get).not.toHaveBeenCalled()
    expect(open.value).toBe(false)
  })

  it('reset: 候補を閉じてキーワードもリセットする', async () => {
    const { keyword, open, runNow, reset } = useHeaderSearch()

    keyword.value = 'jiro'
    runNow()
    await vi.runAllTimersAsync()
    expect(open.value).toBe(true)

    reset()

    expect(open.value).toBe(false)
    expect(keyword.value).toBe('')
  })
})
