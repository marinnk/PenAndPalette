<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AvatarIcon from '@/components/AvatarIcon.vue'
import type { Post } from '@/types/post'

// S03/S05/S07で共通利用する投稿カード（画面設計書126〜133行目）。
// いいね/かきたいのAPI呼び出しは持たず、親（TimelineView等）にemitで委ねる。
// clickable=falseは投稿詳細画面（自分自身への遷移を避けるため）向け、
// pending=trueはいいね/かきたいの処理中に連打で二重送信させないためのもの。
// preview=trueはS06（RequestComposeForm）の「参考にしてほしい投稿」プレビュー専用で、
// 投稿者リンク・編集/削除・いいね/かきたいをすべて表示しない読み取り専用表示にする
// （clickable=falseだけでは、投稿者が自分の投稿の場合に編集/削除ボタンが出てしまい、
// 削除確認ダイアログの後に何も起きない・入力中の下書きを失って編集画面に飛ぶ、という
// 誤操作を招くため）
const props = withDefaults(
  defineProps<{ post: Post; clickable?: boolean; pending?: boolean; preview?: boolean }>(),
  {
    clickable: true,
    pending: false,
    preview: false,
  },
)
const emit = defineEmits<{
  'toggle-like': [post: Post]
  'toggle-want': [post: Post]
  delete: [post: Post]
}>()

const router = useRouter()
const auth = useAuthStore()

const formattedDate = computed(() => props.post.created_at.slice(0, 10))
// 自分の投稿にのみ[編集][削除]を表示する（画面設計書141行目「自分の投稿には[編集][削除]」）
const isOwnPost = computed(() => auth.currentUser?.id === props.post.author.id)

function goToDetail() {
  if (!props.clickable) return
  router.push({ name: 'post-detail', params: { id: props.post.id } })
}

function goToEdit() {
  router.push({ name: 'post-edit', params: { id: props.post.id } })
}

function onDeleteClick() {
  // モーダル基盤がこのプロジェクトにまだ無く、削除確認はこの1箇所のみのため
  // window.confirm()で済ませる（アクセシビリティ対応もブラウザ標準に任せられる）
  if (window.confirm('この投稿を削除しますか？')) {
    emit('delete', props.post)
  }
}
</script>

<template>
  <article
    class="post-card"
    :class="{ 'post-card-static': !clickable }"
    :data-testid="`post-card-${post.id}`"
    :role="clickable ? 'button' : undefined"
    :tabindex="clickable ? 0 : undefined"
    @click="goToDetail"
    @keydown.enter="goToDetail"
  >
    <div class="post-card-header">
      <RouterLink
        v-if="!preview"
        :to="{ name: 'profile', params: { id: post.author.id } }"
        class="post-card-author"
        :data-testid="`author-link-${post.id}`"
        @click.stop
      >
        <AvatarIcon :src="post.author.avatar_url" :size="24" :testid="`author-avatar-${post.id}`" />
        {{ post.author.display_name }}
      </RouterLink>
      <span v-else class="post-card-author">
        <AvatarIcon :src="post.author.avatar_url" :size="24" :testid="`author-avatar-${post.id}`" />
        {{ post.author.display_name }}
      </span>
      <span class="post-card-header-right">
        <span class="post-card-meta">{{ formattedDate }}</span>
        <span v-if="isOwnPost && !preview" class="post-card-author-actions">
          <button
            type="button"
            :disabled="pending"
            :data-testid="`edit-button-${post.id}`"
            @click.stop="goToEdit"
          >
            編集
          </button>
          <button
            type="button"
            :disabled="pending"
            :data-testid="`delete-button-${post.id}`"
            @click.stop="onDeleteClick"
          >
            削除
          </button>
        </span>
      </span>
    </div>
    <p
      v-if="post.post_type === 'novel' && post.title"
      class="post-card-title"
      data-testid="post-title"
    >
      【{{ post.title }}】
    </p>
    <p v-if="post.body" class="post-card-body">{{ post.body }}</p>
    <p v-if="post.tags.length > 0" class="post-card-tags" data-testid="post-tags">
      <!-- タグをタップするとそのタグで絞り込んだタイムライン（S03）へ遷移する。
           preview（S06のプレビュー）では遷移させず表示のみ -->
      <template v-for="tag in post.tags" :key="tag.id">
        <RouterLink
          v-if="!preview"
          :to="{ name: 'timeline', query: { tag: tag.id } }"
          class="post-card-tag"
          :data-testid="`post-tag-${tag.id}`"
          @click.stop
          >#{{ tag.name }}</RouterLink
        >
        <span v-else class="post-card-tag">#{{ tag.name }}</span>
      </template>
    </p>
    <div
      v-if="post.images.length > 0"
      class="post-card-images"
      :class="`post-card-images-${post.images.length}`"
    >
      <img v-for="(url, i) in post.images" :key="url" :src="url" :alt="`投稿画像${i + 1}`" />
    </div>
    <div v-if="!preview" class="post-card-actions">
      <button
        type="button"
        :class="{ active: post.liked_by_me }"
        :aria-pressed="post.liked_by_me"
        :disabled="pending"
        :data-testid="`like-button-${post.id}`"
        @click.stop="emit('toggle-like', post)"
      >
        ♥ いいね {{ post.like_count }}
      </button>
      <button
        type="button"
        :class="{ active: post.wanted_by_me }"
        :aria-pressed="post.wanted_by_me"
        :disabled="pending"
        :data-testid="`want-button-${post.id}`"
        @click.stop="emit('toggle-want', post)"
      >
        ✏ かきたい {{ post.want_count }}
      </button>
      <span class="post-card-comment-count">💬 コメント {{ post.comment_count }}</span>
    </div>
  </article>
</template>
