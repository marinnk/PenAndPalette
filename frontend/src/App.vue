<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'

// リロード後もCookie（HttpOnly）があればログイン状態を復元できるよう、
// アプリ起動時に一度だけ GET /api/auth/me を呼んでセッションを確認する
const auth = useAuthStore()
onMounted(auth.fetchMe)
</script>

<template>
  <RouterView />
</template>
