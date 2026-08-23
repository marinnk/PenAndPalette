<script setup lang="ts">
import { onMounted } from 'vue'
import { useHealthCheck } from '@/composables/useHealthCheck'
import { useAuthStore } from '@/stores/auth'

// このコンポーネントはcomposable/storeから受け取った状態をどう表示するかにのみ専念する
const { status, checkHealth } = useHealthCheck()
const auth = useAuthStore()

onMounted(checkHealth)
</script>

<template>
  <main>
    <h1>PenAndPalette</h1>
    <p data-testid="backend-status">backend: {{ status }}</p>
    <!-- 共通ヘッダー（S03等が持つ想定）はまだ実装されていないための暫定表示。
         ヘッダー実装時にはそちらへ移設する -->
    <p v-if="auth.currentUser">
      ようこそ、{{ auth.currentUser.display_name }}さん
      <button data-testid="logout-button" @click="auth.logout">ログアウト</button>
    </p>
  </main>
</template>
