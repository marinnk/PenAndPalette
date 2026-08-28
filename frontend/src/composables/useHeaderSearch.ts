import { ref, watch } from 'vue'
import { useUserSearch } from '@/composables/useUserSearch'

// 打鍵のたびにAPIを叩かず、入力が落ち着いてからまとめて検索するまでの待ち時間
const DEBOUNCE_MS = 300

// 画面共通ヘッダーの検索（画面設計書1.5節）。GET /api/users/?q= と応答の世代ガードは
// useUserSearch に委ね、ここでは入力のデバウンスと候補一覧の開閉だけを扱う。
// S09（ユーザー検索画面）と同じ composable を土台にするため、候補の中身・空表示・
// 失敗表示の条件は両画面で揃う。他の composable と同様ライフサイクルフックは持たず、
// タイマーの後始末（stop）と画面遷移時の後始末（reset）は呼び出し側から行う
export function useHeaderSearch() {
  const { keyword, users, loading, error, hasSearched, search } = useUserSearch()
  const open = ref(false)

  let timer: ReturnType<typeof setTimeout> | null = null
  function stop() {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  // 入力が空なら候補を閉じる。それ以外は現在のキーワードで検索して候補を開く
  function runNow() {
    stop()
    if (!keyword.value.trim()) {
      open.value = false
      return
    }
    open.value = true
    search()
  }

  watch(keyword, (value) => {
    stop()
    if (!value.trim()) {
      open.value = false
      return
    }
    timer = setTimeout(runNow, DEBOUNCE_MS)
  })

  function close() {
    stop()
    open.value = false
  }

  // 候補から利用者を選んで別画面へ移動したときの後始末（候補を閉じ、入力もリセット）
  function reset() {
    close()
    keyword.value = ''
  }

  return { keyword, users, loading, error, hasSearched, open, runNow, close, reset, stop }
}
