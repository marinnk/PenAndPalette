<script setup lang="ts">
// ログイン画面（S01）・新規登録画面（S02）で共通の左右分割レイアウト。
// 左側にオリジナルイラストのパネル、右側にフォームカード（スロット経由）を配置する。
// イラストは装飾目的のみのためスクリーンリーダーからは隠す。
</script>

<template>
  <div class="auth-layout">
    <div class="auth-illustration" aria-hidden="true" />
    <div class="auth-form-panel">
      <slot />
    </div>
  </div>
</template>
