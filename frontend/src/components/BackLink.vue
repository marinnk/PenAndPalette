<script setup lang="ts">
import { useRouter } from 'vue-router'
import type { RouteLocationRaw } from 'vue-router'

// 各画面の「← ○○に戻る」ボタン（S05投稿詳細・S09ユーザー検索・S10フォロー一覧で共通）。
// 遷移先・ラベル・data-testidだけが画面ごとに異なるため、それらをpropsで受け取る
const props = defineProps<{ to: RouteLocationRaw; label: string; testid?: string }>()
const router = useRouter()
</script>

<template>
  <button type="button" class="back-link" :data-testid="testid" @click="router.push(props.to)">
    {{ label }}
  </button>
</template>
