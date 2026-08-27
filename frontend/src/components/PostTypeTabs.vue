<script setup lang="ts">
import type { PostType } from '@/types/post'

// S03の「イラスト」「小説」タブ切替（画面設計書114〜145行目）。「全体」「フォロー中」
// （TimelineTabs.vue）とは独立した軸で、組み合わせて絞り込める
defineProps<{ modelValue: PostType }>()
const emit = defineEmits<{ 'update:modelValue': [value: PostType] }>()
</script>

<template>
  <div class="timeline-tabs">
    <button
      type="button"
      :class="{ active: modelValue === 'illustration' }"
      data-testid="tab-illustration"
      @click="emit('update:modelValue', 'illustration')"
    >
      イラスト
    </button>
    <button
      type="button"
      :class="{ active: modelValue === 'novel' }"
      data-testid="tab-novel"
      @click="emit('update:modelValue', 'novel')"
    >
      小説
    </button>
  </div>
</template>
