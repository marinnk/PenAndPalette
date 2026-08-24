<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useReceivedRequests } from '@/composables/useReceivedRequests'

// S03・S05・S07・S09が共通で持つヘッダー（画面設計書1.5節）。
// 検索（S09）への導線は今回のスコープ外のため設けない
const router = useRouter()
const auth = useAuthStore()
const { receivedRequests, load: loadReceivedRequests } = useReceivedRequests()
const showRequestsDropdown = ref(false)

// AppHeaderは各画面のテンプレート内に直接置かれており、画面遷移のたびにマウントし直される。
// 通知バッジの件数・ドロップダウンの中身の両方に使うため、マウント時に1回取得しておく
// （ドロップダウンを開く時点では再取得しない）
onMounted(() => {
  if (auth.currentUser) loadReceivedRequests()
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
    <nav class="app-header-nav">
      <RouterLink
        v-if="auth.currentUser"
        :to="{ name: 'profile', params: { id: auth.currentUser.id } }"
        data-testid="header-profile-link"
      >
        {{ auth.currentUser.display_name }}
      </RouterLink>

      <div v-if="auth.currentUser && receivedRequests.length > 0" class="app-header-requests">
        <button
          type="button"
          class="app-header-request-badge"
          data-testid="header-request-badge"
          :aria-expanded="showRequestsDropdown"
          @click="toggleRequestsDropdown"
        >
          🔔 届いたリクエスト {{ receivedRequests.length }}
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
