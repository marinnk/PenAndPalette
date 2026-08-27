import { ref } from 'vue'
import { apiClient } from '@/lib/apiClient'
import type { Tag } from '@/types/post'

// 分類タグ一覧（S04投稿作成・編集画面のタグ選択欄で使う）。GET /api/tagsは
// display_order順の固定12件を配列のまま返す（一覧APIと違いresultsでラップされない）
export function useTags() {
  const tags = ref<Tag[]>([])
  const loading = ref(false)
  const error = ref(false)

  async function load() {
    loading.value = true
    error.value = false
    try {
      const { data } = await apiClient.get<Tag[]>('/api/tags')
      tags.value = data
    } catch {
      error.value = true
    } finally {
      loading.value = false
    }
  }

  return { tags, loading, error, load }
}
