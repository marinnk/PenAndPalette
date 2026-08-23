<script setup lang="ts">
// 基本設計書6.10章の新着通知バナー。件数のみを表示し、クリックされるまで一覧には反映しない
defineProps<{ count: number }>()
const emit = defineEmits<{ reveal: [] }>()
</script>

<template>
  <button
    v-if="count > 0"
    type="button"
    class="new-post-banner"
    data-testid="new-post-banner"
    @click="emit('reveal')"
  >
    ↑ {{ count }}件の新しい投稿があります
  </button>
</template>
