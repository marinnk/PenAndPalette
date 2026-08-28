<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useReceivedRequests } from '@/composables/useReceivedRequests'
import { useHeaderSearch } from '@/composables/useHeaderSearch'
import AvatarIcon from '@/components/AvatarIcon.vue'

// S03・S05・S07・S09が共通で持つヘッダー（画面設計書1.5節）。
const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const { receivedRequests, load: loadReceivedRequests } = useReceivedRequests()
const showRequestsDropdown = ref(false)

// ヘッダーの検索入力欄。入力すると入力欄の直下に候補を一覧表示し、選ぶとプロフィールへ遷移する
const {
  keyword: searchKeyword,
  users: searchUsers,
  loading: searchLoading,
  error: searchError,
  hasSearched: searchHasSearched,
  open: showSearchResults,
  runNow: runSearch,
  close: closeSearch,
  reset: resetSearch,
  stop: stopSearch,
} = useHeaderSearch()
const searchEl = ref<HTMLElement | null>(null)

// 入力欄・候補の外側をクリックしたら候補を閉じる（候補内のクリックは遷移させたいので閉じない）
function onDocumentPointerDown(event: PointerEvent) {
  if (searchEl.value && !searchEl.value.contains(event.target as Node)) closeSearch()
}

// 候補から利用者を選ぶ等で別画面へ移動したら、候補を閉じて入力もリセットする
watch(() => route.fullPath, resetSearch)

// AppHeaderは各画面のテンプレート内に直接置かれており、画面遷移のたびにマウントし直される。
// 通知バッジの件数・ドロップダウンの中身の両方に使うため、マウント時に1回取得しておく
// （ドロップダウンを開く時点では再取得しない）
onMounted(() => {
  if (auth.currentUser) loadReceivedRequests()
  document.addEventListener('pointerdown', onDocumentPointerDown)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  stopSearch()
})

function toggleRequestsDropdown() {
  showRequestsDropdown.value = !showRequestsDropdown.value
}

async function handleLogout() {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <header class="app-header">
    <RouterLink :to="{ name: 'timeline' }" class="app-header-title">PenAndPalette</RouterLink>

    <div v-if="auth.currentUser" ref="searchEl" class="app-header-search">
      <form role="search" @submit.prevent="runSearch">
        <button
          type="submit"
          class="app-header-search-icon"
          aria-label="検索"
          data-testid="header-search-submit"
        >
          🔍
        </button>
        <input
          v-model="searchKeyword"
          type="search"
          placeholder="利用者を検索"
          aria-label="利用者を検索"
          data-testid="header-search-input"
        />
      </form>
      <div
        v-if="showSearchResults"
        class="app-header-search-dropdown"
        data-testid="header-search-dropdown"
      >
        <p v-if="searchLoading" class="app-header-search-status" data-testid="header-search-loading">
          検索中...
        </p>
        <p
          v-else-if="searchError"
          class="app-header-search-status field-error"
          data-testid="header-search-error"
        >
          検索に失敗しました。
        </p>
        <p
          v-else-if="searchHasSearched && searchUsers.length === 0"
          class="app-header-search-status"
          data-testid="header-search-empty"
        >
          該当する利用者がいません。
        </p>
        <RouterLink
          v-for="user in searchUsers"
          :key="user.id"
          :to="{ name: 'profile', params: { id: user.id } }"
          class="app-header-search-item"
          :data-testid="`header-search-item-${user.id}`"
        >
          <AvatarIcon :src="user.avatar_url" :size="24" />
          {{ user.display_name }}
        </RouterLink>
      </div>
    </div>

    <nav class="app-header-nav">
      <RouterLink
        v-if="auth.currentUser"
        :to="{ name: 'profile', params: { id: auth.currentUser.id } }"
        class="app-header-profile-link"
        data-testid="header-profile-link"
        aria-label="自分のプロフィール"
      >
        <AvatarIcon :src="auth.currentUser.avatar_url" :size="28" testid="header-avatar-image" />
      </RouterLink>

      <div v-if="auth.currentUser && receivedRequests.length > 0" class="app-header-requests">
        <button
          type="button"
          class="app-header-request-badge"
          data-testid="header-request-badge"
          :aria-expanded="showRequestsDropdown"
          :aria-label="`届いたリクエスト ${receivedRequests.length}件`"
          @click="toggleRequestsDropdown"
        >
          <span class="app-header-request-icon" aria-hidden="true">📨</span>
          <span class="app-header-request-count" data-testid="header-request-count">
            {{ receivedRequests.length }}
          </span>
        </button>
        <div
          v-if="showRequestsDropdown"
          class="app-header-request-dropdown"
          data-testid="header-request-dropdown"
        >
          <div
            v-for="req in receivedRequests"
            :key="req.id"
            class="received-request-item"
            :data-testid="`header-received-request-${req.id}`"
          >
            {{ req.from_user.display_name }} さんから：「{{ req.message }}」
          </div>
        </div>
      </div>

      <button data-testid="header-logout-button" @click="handleLogout">ログアウト</button>
    </nav>
  </header>
</template>
