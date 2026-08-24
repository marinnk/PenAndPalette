<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import PostCard from '@/components/PostCard.vue'
import { useProfile } from '@/composables/useProfile'
import { useReceivedRequests } from '@/composables/useReceivedRequests'
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
const {
  receivedRequests,
  loading: receivedLoading,
  error: receivedError,
  load: loadReceived,
} = useReceivedRequests()

const isOwnProfile = computed(() => auth.currentUser?.id === Number(props.id))

// 届いたリクエストはデフォルトでは表示せず、[届いたリクエスト]ボタンを押したときだけ
// 表示・取得する（常時表示だと自分の投稿一覧より上のスペースを占有してしまうため）
const showReceivedRequests = ref(false)
let receivedRequestsLoadStarted = false

function toggleReceivedRequests() {
  showReceivedRequests.value = !showReceivedRequests.value
  if (showReceivedRequests.value && !receivedRequestsLoadStarted) {
    receivedRequestsLoadStarted = true
    loadReceived()
  }
}

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
          <div v-else class="profile-header-actions">
            <button
              type="button"
              class="form-submit"
              data-testid="profile-follow-button"
              :disabled="followPending"
              @click="toggleFollow"
            >
              {{ profile.followed_by_me ? 'フォロー中' : 'フォローする' }}
            </button>
            <button
              type="button"
              class="form-submit"
              data-testid="profile-request-button"
              @click="router.push({ name: 'request-create', params: { id: props.id } })"
            >
              リクエストする
            </button>
          </div>
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

        <div v-if="isOwnProfile" class="received-requests">
          <button
            type="button"
            class="received-requests-toggle"
            data-testid="received-requests-toggle"
            :aria-expanded="showReceivedRequests"
            @click="toggleReceivedRequests"
          >
            届いたリクエスト
          </button>
          <section v-if="showReceivedRequests">
            <p v-if="receivedLoading" data-testid="received-requests-loading">読み込み中...</p>
            <p v-else-if="receivedError" class="field-error" data-testid="received-requests-error">
              リクエスト一覧の取得に失敗しました。
            </p>
            <template v-else>
              <p
                v-if="receivedRequests.length === 0"
                class="empty-state"
                data-testid="received-requests-empty"
              >
                届いたリクエストはまだありません。
              </p>
              <div
                v-for="req in receivedRequests"
                :key="req.id"
                class="received-request-item"
                :data-testid="`received-request-${req.id}`"
              >
                {{ req.from_user.display_name }} さんから：「{{ req.message }}」
              </div>
            </template>
          </section>
        </div>

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
