<script setup lang="ts">
import type { TimelineScope } from '@/types/post'

// S03の「全体」「フォロー中」タブ切替（画面設計書114〜145行目）
defineProps<{ modelValue: TimelineScope }>()
const emit = defineEmits<{ 'update:modelValue': [value: TimelineScope] }>()
</script>

<template>
  <div class="timeline-tabs">
    <button
      type="button"
      :class="{ active: modelValue === 'all' }"
      data-testid="tab-all"
      @click="emit('update:modelValue', 'all')"
    >
      全体
    </button>
    <button
      type="button"
      :class="{ active: modelValue === 'following' }"
      data-testid="tab-following"
      @click="emit('update:modelValue', 'following')"
    >
      フォロー中
    </button>
  </div>
</template>
