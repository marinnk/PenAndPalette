<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import PostCard from '@/components/PostCard.vue'
import { useProfile } from '@/composables/useProfile'
import { useAuthStore } from '@/stores/auth'

// S07 プロフィール画面（今回はフォロー中/フォロワー数・フォロー/リクエストボタンを
// 含まないスタブ）
const props = defineProps<{ id: string }>()
const router = useRouter()
const auth = useAuthStore()
const { profile, posts, loading, error, reactionError, isPending, load, toggleLike, toggleWant } =
  useProfile()

const isOwnProfile = computed(() => auth.currentUser?.id === Number(props.id))

onMounted(() => load(Number(props.id)))
watch(
  () => props.id,
  (id) => load(Number(id)),
)
</script>

<template>
  <div>
    <AppHeader />
    <main class="profile">
      <p v-if="loading" data-testid="profile-loading">読み込み中...</p>
      <p v-else-if="error || !profile" class="field-error" data-testid="profile-error">
        利用者が見つかりませんでした。
      </p>
      <template v-else>
        <div class="profile-header">
          <h1 data-testid="profile-display-name">{{ profile.display_name }}</h1>
          <p v-if="profile.bio" data-testid="profile-bio">{{ profile.bio }}</p>
          <button
            v-if="isOwnProfile"
            type="button"
            class="form-submit"
            data-testid="profile-compose-button"
            @click="router.push({ name: 'post-create' })"
          >
            投稿する
          </button>
        </div>

        <p v-if="reactionError" class="field-error" data-testid="reaction-error">
          {{ reactionError }}
        </p>

        <h2>{{ profile.display_name }}の投稿</h2>
        <p v-if="posts.length === 0" class="empty-state" data-testid="profile-posts-empty">
          投稿がまだありません。
        </p>
        <PostCard
          v-for="post in posts"
          :key="post.id"
          :post="post"
          :pending="isPending(post.id)"
          @toggle-like="toggleLike"
          @toggle-want="toggleWant"
        />
      </template>
    </main>
  </div>
</template>
