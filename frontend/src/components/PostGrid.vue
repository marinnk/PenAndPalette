<script setup lang="ts">
import type { Post } from '@/types/post'

// S03 イラストタブの正方形グリッドギャラリー（画面設計書114〜145行目）。イラスト投稿は
// 必ず1〜4枚の画像を持つため、各投稿の最初の画像だけを正方形にクロップして並べる。
// 本文・タグ・いいね数などはタイル上に表示しない（ワイヤーフレーム通り）
defineProps<{ posts: Post[] }>()
</script>

<template>
  <div class="post-grid">
    <RouterLink
      v-for="post in posts"
      :key="post.id"
      :to="{ name: 'post-detail', params: { id: post.id } }"
      class="post-grid-tile"
      :data-testid="`post-grid-tile-${post.id}`"
    >
      <img :src="post.images[0]" :alt="`${post.author.display_name}の投稿画像`" />
    </RouterLink>
  </div>
</template>
