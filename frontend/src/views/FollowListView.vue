<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import BackLink from '@/components/BackLink.vue'
import { useFollowList } from '@/composables/useFollowList'
import type { FollowListTab } from '@/composables/useFollowList'

// S10 フォロー中／フォロワー一覧画面（画面設計書1.5節: 共通ヘッダーを持たない画面）
const props = defineProps<{ id: string; tab: FollowListTab }>()
const router = useRouter()
const { activeTab, users, loading, error, load } = useFollowList()

function goToTab(tab: FollowListTab) {
  router.push({ name: tab === 'following' ? 'profile-following' : 'profile-followers', params: { id: props.id } })
}

onMounted(() => load(Number(props.id), props.tab))
watch(
  () => [props.id, props.tab] as const,
  ([id, tab]) => load(Number(id), tab),
)
</script>

<template>
  <main class="follow-list">
    <BackLink
      :to="{ name: 'profile', params: { id: props.id } }"
      label="← プロフィールに戻る"
      testid="back-to-profile"
    />

    <div class="follow-list-tabs">
      <button
        type="button"
        data-testid="follow-list-tab-following"
        :aria-pressed="activeTab === 'following'"
        @click="goToTab('following')"
      >
        フォロー中
      </button>
      <button
        type="button"
        data-testid="follow-list-tab-followers"
        :aria-pressed="activeTab === 'followers'"
        @click="goToTab('followers')"
      >
        フォロワー
      </button>
    </div>

    <p v-if="loading" data-testid="follow-list-loading">読み込み中...</p>
    <p v-else-if="error" class="field-error" data-testid="follow-list-error">
      一覧の取得に失敗しました。
    </p>
    <template v-else>
      <p v-if="users.length === 0" class="empty-state" data-testid="follow-list-empty">
        表示できる利用者がいません。
      </p>
      <RouterLink
        v-for="user in users"
        :key="user.id"
        :to="{ name: 'profile', params: { id: user.id } }"
        class="follow-list-item"
        :data-testid="`follow-list-item-${user.id}`"
      >
        {{ user.display_name }}
      </RouterLink>
    </template>
  </main>
</template>
