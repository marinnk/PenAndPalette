<script setup lang="ts">
// リロード後もCookie（HttpOnly）があればログイン状態を復元できるよう、セッション確認
// （GET /api/auth/me）はrouter.beforeEach（router/index.ts）内で行う。
// 初回ナビゲーションの解決はonMountedより前後関係が不定なため、ここでは呼ばない
// （二重リクエストを避ける）
</script>

<template>
  <RouterView />
</template>
