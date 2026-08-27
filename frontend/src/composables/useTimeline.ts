import { ref } from 'vue'
import { apiClient } from '@/lib/apiClient'
import { createLatestRequest } from '@/lib/latestRequest'
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
  // 分類タグによる絞り込み（S03「絞り込み」セクション）。scope・postTypeとは独立した軸で
  // 単一選択。nullは絞り込みなし。バックエンドへはtag_idとして渡す（基本設計書6.3章）
  const tagId = ref<number | null>(null)
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
  // load() の世代トークン。呼ばれるたびに begin() し、応答が届いたときに古ければ結果を破棄する。
  // これが無いと、タブを素早く切り替えたとき先に始まった load の応答が後から届いて
  // 新しいタブの一覧を上書きしてしまう。loadMore も同じトークンを見て、取得中に load が
  // 走ったらその結果を捨てる（loadMore は元々このガードを持っていたが load には無かった）
  const latestLoad = createLatestRequest()
  let loadToken = latestLoad.begin()

  async function fetchPosts(params: Record<string, string | number>) {
    const { data } = await apiClient.get<PostListResponse>('/api/posts', { params })
    return data
  }

  // scope・post_type・tag_id はどの取得（初回・追加・ポーリング）でも共通で送る絞り込み軸。
  // tag_id は選択時のみ付ける（null のときはパラメータごと省略＝絞り込みなし）
  function filterParams(): Record<string, string | number> {
    const params: Record<string, string | number> = {
      scope: scope.value,
      post_type: postType.value,
    }
    if (tagId.value !== null) params.tag_id = tagId.value
    return params
  }

  function stopPolling() {
    if (pollTimer !== null) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  async function poll() {
    try {
      const data = await fetchPosts({ ...filterParams(), after_id: pollAnchorId })
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
    newTagId: number | null = tagId.value,
  ) {
    loadToken = latestLoad.begin()
    const token = loadToken
    scope.value = newScope
    postType.value = newPostType
    tagId.value = newTagId
    loading.value = true
    error.value = false
    deleteError.value = null
    // タブ切替は一覧をやり直すため、保留中の新着通知は持ち越さない
    pendingNewPosts = []
    newPostCount.value = 0
    // 新しいタブの一覧をまだ取得していないので、追加読み込みのカーソルを一旦無効化する。
    // これで新しい load が完了するまで loadMore() は動かず、古いカーソルで別タブの
    // 投稿を混ぜてしまうことがなくなる
    oldestLoadedId = null
    try {
      const data = await fetchPosts({ ...filterParams(), limit: PAGE_SIZE })
      // 応答を待つ間に後発の load（タブの再切替）が始まっていたら、古い結果で上書きしない
      if (token.isStale()) return
      posts.value = data.results
      hasMore.value = data.has_more
      pollAnchorId = data.results[0]?.id ?? 0
      oldestLoadedId = data.results[data.results.length - 1]?.id ?? null
      startPolling()
    } catch {
      if (!token.isStale()) error.value = true
    } finally {
      if (!token.isStale()) loading.value = false
    }
  }

  async function loadMore() {
    if (!hasMore.value || loadingMore.value || oldestLoadedId === null) return
    loadingMore.value = true
    const token = loadToken
    try {
      const data = await fetchPosts({
        ...filterParams(),
        before_id: oldestLoadedId,
        limit: PAGE_SIZE,
      })
      // 応答を待つ間に load が走った（タブ切替・再読込）なら、この結果は捨てる
      if (token.isStale()) return
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
    tagId,
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
