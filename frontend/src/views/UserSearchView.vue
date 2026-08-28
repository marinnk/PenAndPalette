<script setup lang="ts">
import AppHeader from '@/components/AppHeader.vue'
import AvatarIcon from '@/components/AvatarIcon.vue'
import BackLink from '@/components/BackLink.vue'
import { useUserSearch } from '@/composables/useUserSearch'

// S09 ユーザー検索画面（画面設計書1.5節: 共通ヘッダーを持つ画面）
const { keyword, users, loading, error, hasSearched, search } = useUserSearch()
</script>

<template>
  <div>
    <AppHeader />
    <main class="user-search">
      <BackLink :to="{ name: 'timeline' }" label="← タイムラインに戻る" testid="back-to-timeline" />

      <form class="user-search-form" @submit.prevent="search">
        <input
          v-model="keyword"
          type="text"
          aria-label="ユーザー名・表示名で検索"
          data-testid="user-search-keyword"
        />
        <button
          type="submit"
          class="form-submit"
          :disabled="loading"
          data-testid="user-search-submit"
        >
          検索
        </button>
      </form>

      <p v-if="loading" data-testid="user-search-loading">読み込み中...</p>
      <p v-else-if="error" class="field-error" data-testid="user-search-error">
        検索に失敗しました。
      </p>
      <template v-else-if="hasSearched">
        <p v-if="users.length === 0" class="empty-state" data-testid="user-search-empty">
          該当する利用者がいません。
        </p>
        <RouterLink
          v-for="user in users"
          :key="user.id"
          :to="{ name: 'profile', params: { id: user.id } }"
          class="user-search-item"
          :data-testid="`user-search-item-${user.id}`"
        >
          <AvatarIcon :src="user.avatar_url" :size="28" />
          {{ user.display_name }}
        </RouterLink>
      </template>
    </main>
  </div>
</template>
