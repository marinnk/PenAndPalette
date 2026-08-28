<script setup lang="ts">
import type { ProfileTab } from '@/types/profile'

// S07 プロフィール画面の「投稿」「ブックマーク」タブ切替（自分のプロフィールのみ）。
// タイムラインの「全体／フォロー中」（TimelineTabs.vue）と同じ .timeline-tabs の見た目
defineProps<{ modelValue: ProfileTab }>()
const emit = defineEmits<{ 'update:modelValue': [value: ProfileTab] }>()
</script>

<template>
  <div class="timeline-tabs">
    <button
      type="button"
      :class="{ active: modelValue === 'posts' }"
      data-testid="profile-tab-posts"
      @click="emit('update:modelValue', 'posts')"
    >
      投稿
    </button>
    <button
      type="button"
      :class="{ active: modelValue === 'bookmarks' }"
      data-testid="profile-tab-bookmarks"
      @click="emit('update:modelValue', 'bookmarks')"
    >
      ブックマーク
    </button>
  </div>
</template>
