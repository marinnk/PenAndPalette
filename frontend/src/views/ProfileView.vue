<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import PostCard from '@/components/PostCard.vue'
import { useProfile } from '@/composables/useProfile'
import { useAuthStore } from '@/stores/auth'

// S07 プロフィール画面
const props = defineProps<{ id: string }>()
const router = useRouter()
const auth = useAuthStore()
const {
  profile,
  posts,
  loading,
  error,
  reactionError,
  isPending,
  deleteError,
  isDeleting,
  followError,
  followPending,
  load,
  toggleLike,
  toggleWant,
  deletePost,
  toggleFollow,
} = useProfile()

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
          <p class="profile-follow-counts">
            <button
              type="button"
              class="profile-follow-count"
              data-testid="profile-following-count"
              @click="router.push({ name: 'profile-following', params: { id: props.id } })"
            >
              フォロー中 {{ profile.following_count }}
            </button>
            <button
              type="button"
              class="profile-follow-count"
              data-testid="profile-follower-count"
              @click="router.push({ name: 'profile-followers', params: { id: props.id } })"
            >
              フォロワー {{ profile.follower_count }}
            </button>
          </p>
          <button
            v-if="isOwnProfile"
            type="button"
            class="form-submit"
            data-testid="profile-compose-button"
            @click="router.push({ name: 'post-create' })"
          >
            投稿する
          </button>
          <button
            v-else
            type="button"
            class="form-submit"
            data-testid="profile-follow-button"
            :disabled="followPending"
            @click="toggleFollow"
          >
            {{ profile.followed_by_me ? 'フォロー中' : 'フォローする' }}
          </button>
        </div>

        <p v-if="followError" class="field-error" data-testid="follow-error">
          {{ followError }}
        </p>
        <p v-if="reactionError" class="field-error" data-testid="reaction-error">
          {{ reactionError }}
        </p>
        <p v-if="deleteError" class="field-error" data-testid="delete-error">
          {{ deleteError }}
        </p>

        <h2>{{ profile.display_name }}の投稿</h2>
        <p v-if="posts.length === 0" class="empty-state" data-testid="profile-posts-empty">
          投稿がまだありません。
        </p>
        <PostCard
          v-for="post in posts"
          :key="post.id"
          :post="post"
          :pending="isPending(post.id) || isDeleting(post.id)"
          @toggle-like="toggleLike"
          @toggle-want="toggleWant"
          @delete="deletePost"
        />
      </template>
    </main>
  </div>
</template>
