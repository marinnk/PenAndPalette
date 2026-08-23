<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

// S03・S05・S07・S09が共通で持つヘッダー（画面設計書1.5節）。
// 検索（S09）への導線は今回のスコープ外のため設けない
const router = useRouter()
const auth = useAuthStore()

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
      <button data-testid="header-logout-button" @click="handleLogout">ログアウト</button>
    </nav>
  </header>
</template>
