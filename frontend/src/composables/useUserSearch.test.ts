import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/apiClient'
import { useUserSearch } from './useUserSearch'

vi.mock('@/lib/apiClient', () => ({
  apiClient: { get: vi.fn() },
}))

beforeEach(() => {
  vi.mocked(apiClient.get).mockReset()
})

function makeUser(id: number, username: string) {
  return { id, username, display_name: username, avatar_url: null }
}

describe('useUserSearch', () => {
  it('search: キーワードをtrimしてGET /api/users/?qを呼び、結果を反映する', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: [makeUser(2, 'jiro')] })

    const { keyword, users, search, hasSearched, error } = useUserSearch()
    keyword.value = '  jiro  '
    await search()

    expect(apiClient.get).toHaveBeenCalledWith('/api/users/', { params: { q: 'jiro' } })
    expect(users.value.map((u) => u.id)).toEqual([2])
    expect(hasSearched.value).toBe(true)
    expect(error.value).toBe(false)
  })

  it('search: キーワードが未入力なら検索しない', async () => {
    const { keyword, search, hasSearched } = useUserSearch()
    keyword.value = '   '
    await search()

    expect(apiClient.get).not.toHaveBeenCalled()
    expect(hasSearched.value).toBe(false)
  })

  it('search: 失敗時はerrorがtrueになる', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('failed'))

    const { keyword, search, error } = useUserSearch()
    keyword.value = 'jiro'
    await search()

    expect(error.value).toBe(true)
  })

  it('search: 先に始まった検索の応答が後から届いても、新しいキーワードの結果を上書きしない', async () => {
    let resolveFirst!: (v: unknown) => void
    vi.mocked(apiClient.get)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve
          }),
      )
      .mockImplementationOnce(() => Promise.resolve({ data: [makeUser(20, 'abc')] }))

    const { keyword, users, search, loading } = useUserSearch()
    keyword.value = 'a'
    const first = search()
    keyword.value = 'ab'
    const second = search()
    await second
    expect(users.value.map((u) => u.id)).toEqual([20])

    resolveFirst({ data: [makeUser(10, 'aaa')] })
    await first
    expect(users.value.map((u) => u.id)).toEqual([20])
    expect(loading.value).toBe(false)
  })
})
