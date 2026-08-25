import { ref } from 'vue'
import { apiClient } from '@/lib/apiClient'
import type { Post, PostListResponse } from '@/types/post'

export type PickerTab = 'own' | 'target'

// S06 リクエスト作成画面: 「参考にしてほしい投稿」欄で、自分・宛先どちらの投稿一覧からも
// 選べるようにするpicker用のcomposable。タブ切り替えのたびに再取得しないよう、
// 取得済みの一覧をタブごとにref（postsByTab）へキャッシュする
// （プレーンなオブジェクトへの直接代入だとVueのリアクティブ検知が働かないため、
// 必ずref全体を新しいオブジェクトで置き換える）
export function useRequestRelatedPostPicker(ownUserId: number | undefined, targetUserId: number) {
  const selectedPost = ref<Post | null>(null)
  const pickerOpen = ref(false)
  const pickerTab = ref<PickerTab>('own')
  const pickerLoading = ref(false)
  const pickerError = ref<string | null>(null)
  const postsByTab = ref<Record<PickerTab, Post[] | null>>({ own: null, target: null })

  async function loadTab(tab: PickerTab) {
    const userId = tab === 'own' ? ownUserId : targetUserId
    if (!userId || postsByTab.value[tab]) return

    pickerLoading.value = true
    pickerError.value = null
    try {
      const { data } = await apiClient.get<PostListResponse>('/api/posts', {
        params: { user_id: userId },
      })
      postsByTab.value = { ...postsByTab.value, [tab]: data.results }
    } catch {
      pickerError.value = '投稿一覧の取得に失敗しました。'
    } finally {
      pickerLoading.value = false
    }
  }

  function openPicker() {
    pickerOpen.value = true
    loadTab(pickerTab.value)
  }

  function closePicker() {
    pickerOpen.value = false
  }

  function switchTab(tab: PickerTab) {
    pickerTab.value = tab
    loadTab(tab)
  }

  function selectPost(post: Post) {
    selectedPost.value = post
    pickerOpen.value = false
  }

  function clearSelection() {
    selectedPost.value = null
  }

  return {
    selectedPost,
    pickerOpen,
    pickerTab,
    pickerLoading,
    pickerError,
    postsByTab,
    openPicker,
    closePicker,
    switchTab,
    selectPost,
    clearSelection,
  }
}
