<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useReceivedRequests } from '@/composables/useReceivedRequests'

// S03・S05・S07・S09が共通で持つヘッダー（画面設計書1.5節）。
// 検索（S09）への導線は今回のスコープ外のため設けない
const router = useRouter()
const auth = useAuthStore()
const { receivedRequests, load: loadReceivedRequests } = useReceivedRequests()

// AppHeaderは各画面のテンプレート内に直接置かれており、画面遷移のたびに
// マウントし直される（ProfileView.vueの届いたリクエスト一覧とは別に、
// ヘッダーの通知バッジ用に独立して取得する）
onMounted(() => {
  if (auth.currentUser) loadReceivedRequests()
})

async function handleLogout() {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <header class="app-header">
    <RouterLink :to="{ name: 'timeline' }" class="app-header-title">PenAndPalette</RouterLink>
    <nav class="app-header-nav">
      <RouterLink
        v-if="auth.currentUser"
        :to="{ name: 'profile', params: { id: auth.currentUser.id } }"
        data-testid="header-profile-link"
      >
        {{ auth.currentUser.display_name }}
      </RouterLink>
      <RouterLink
        v-if="auth.currentUser && receivedRequests.length > 0"
        :to="{ name: 'profile', params: { id: auth.currentUser.id } }"
        class="app-header-request-badge"
        data-testid="header-request-badge"
      >
        🔔 届いたリクエスト {{ receivedRequests.length }}
      </RouterLink>
      <button data-testid="header-logout-button" @click="handleLogout">ログアウト</button>
    </nav>
  </header>
</template>
