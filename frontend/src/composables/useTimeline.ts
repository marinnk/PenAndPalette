import { ref } from 'vue'
import { apiClient } from '@/lib/apiClient'
import { useReactablePosts } from '@/composables/usePostReactions'
import { useDeletablePosts } from '@/composables/usePostDelete'
import type { Post, PostListResponse, PostType, TimelineScope } from '@/types/post'

const POLL_INTERVAL_MS = 30_000
const PAGE_SIZE = 20

// S03 タイムライン画面の中核composable。一覧取得・無限スクロール・いいね/かきたい・
// 新着投稿ポーリング（基本設計書6.10章）の状態とAPI呼び出しをすべてここに集約し、
// ビュー側は状態を読んで表示するだけにする
export function useTimeline() {
  const posts = ref<Post[]>([])
  const hasMore = ref(false)
  const loading = ref(false)
  const loadingMore = ref(false)
  const error = ref(false)
  const scope = ref<TimelineScope>('all')
  // 「全体／フォロー中」（scope）とは独立した軸。組み合わせて絞り込める（画面設計書114〜145行目）
  const postType = ref<PostType>('illustration')
  // バナーに表示する新着件数。反映（revealNewPosts）されるまで一覧には混ぜない
  const newPostCount = ref(0)

  const { reactionError, isPending, toggleLike, toggleWant } = useReactablePosts(posts)
  const { deleteError, isDeleting, deletePost } = useDeletablePosts(posts)

  let pendingNewPosts: Post[] = []
  // ポーリングの基準id。0は「まだ投稿が無い」を表し、after_id=0は全件取得と等価になるため
  // 空のタイムラインでも特別分岐なしで動く（バックエンド側もafter_id=0を受け付ける）
  let pollAnchorId = 0
  let pollTimer: ReturnType<typeof setInterval> | null = null
  // 追加読み込み（before_id）の基準id。posts.value由来ではなくload/loadMoreの取得結果から
  // 更新する専用の変数として持つ。posts.valueから都度計算すると、削除機能により
  // 表示中の投稿が0件になった場合に「まだ何も読み込んでいない」と区別できず、
  // サーバーにはまだ投稿が残っている（hasMore=true）のに追加読み込みができなくなるため
  let oldestLoadedId: number | null = null

  async function fetchPosts(params: Record<string, string | number>) {
    const { data } = await apiClient.get<PostListResponse>('/api/posts', { params })
    return data
  }

  function stopPolling() {
    if (pollTimer !== null) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  async function poll() {
    try {
      const data = await fetchPosts({
        scope: scope.value,
        post_type: postType.value,
        after_id: pollAnchorId,
      })
      if (data.results.length > 0) {
        // 複数回のtickで見つかった新着はバナーの件数に積み上げる（上書きしない）
        pendingNewPosts = [...data.results, ...pendingNewPosts]
        pollAnchorId = data.results[0].id
        newPostCount.value = pendingNewPosts.length
      }
    } catch {
      // ポーリングの失敗は画面に表示せず、次回のtickで再試行する
    }
  }

  function startPolling() {
    stopPolling()
    pollTimer = setInterval(poll, POLL_INTERVAL_MS)
  }

  async function load(
    newScope: TimelineScope = scope.value,
    newPostType: PostType = postType.value,
  ) {
    scope.value = newScope
    postType.value = newPostType
    loading.value = true
    error.value = false
    deleteError.value = null
    // タブ切替は一覧をやり直すため、保留中の新着通知は持ち越さない
    pendingNewPosts = []
    newPostCount.value = 0
    try {
      const data = await fetchPosts({
        scope: newScope,
        post_type: newPostType,
        limit: PAGE_SIZE,
      })
      posts.value = data.results
      hasMore.value = data.has_more
      pollAnchorId = data.results[0]?.id ?? 0
      oldestLoadedId = data.results[data.results.length - 1]?.id ?? null
      startPolling()
    } catch {
      error.value = true
    } finally {
      loading.value = false
    }
  }

  async function loadMore() {
    if (!hasMore.value || loadingMore.value || oldestLoadedId === null) return
    loadingMore.value = true
    // 取得中にタブ（scope・postType）が切り替わっていないかを判定するため、
    // リクエスト時点の値を保持する
    const requestScope = scope.value
    const requestPostType = postType.value
    try {
      const data = await fetchPosts({
        scope: requestScope,
        post_type: requestPostType,
        before_id: oldestLoadedId,
        limit: PAGE_SIZE,
      })
      // 応答が返ってくるまでの間にタブが切り替わっていたら、古いタブの結果は捨てる
      // （捨てないと、切替後の一覧に古いタブの投稿が紛れ込む）
      if (requestScope !== scope.value || requestPostType !== postType.value) return
      posts.value = [...posts.value, ...data.results]
      hasMore.value = data.has_more
      if (data.results.length > 0) {
        oldestLoadedId = data.results[data.results.length - 1].id
      }
    } finally {
      loadingMore.value = false
    }
  }

  function revealNewPosts() {
    posts.value = [...pendingNewPosts, ...posts.value]
    pendingNewPosts = []
    newPostCount.value = 0
  }

  return {
    posts,
    hasMore,
    loading,
    loadingMore,
    error,
    scope,
    postType,
    newPostCount,
    reactionError,
    isPending,
    deleteError,
    isDeleting,
    load,
    loadMore,
    revealNewPosts,
    toggleLike,
    toggleWant,
    deletePost,
    stopPolling,
  }
}
