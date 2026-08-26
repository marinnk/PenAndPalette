<script setup lang="ts">
import { computed } from 'vue'
import { pickFileFromInput } from '@/lib/fileInput'
import {
  MAX_POST_TAGS,
  MAX_TITLE_LENGTH,
  maxBodyLengthForType,
  maxImagesForType,
} from '@/composables/postImageValidation'
import type { PostType, Tag } from '@/types/post'

// S04 投稿作成画面。自分の投稿の[編集]から開いた場合はmode="edit"で同じ画面を再利用する
// （画面設計書169行目）。純表示コンポーネントとして、状態・API呼び出しは持たず
// PostCreateView/PostEditViewからpropsで受け取った値を描画し、操作をemitで返すだけに徹する
const props = withDefaults(
  defineProps<{
    mode: 'create' | 'edit'
    postType: PostType
    title: string
    body: string
    imagePreviews: string[]
    canAddMore: boolean
    tags: Tag[]
    selectedTagIds: number[]
    submitDisabled: boolean
    submitting: boolean
    errorMessage?: string | null
    fieldErrors: Record<string, string[]>
    imagePickError?: string | null
  }>(),
  { errorMessage: null, imagePickError: null },
)
const emit = defineEmits<{
  'update:postType': [value: PostType]
  'update:title': [value: string]
  'update:body': [value: string]
  'update:tag-ids': [value: number[]]
  'add-image': [file: File]
  'remove-image': [index: number]
  submit: []
  cancel: []
}>()

const heading = props.mode === 'edit' ? '投稿を編集' : '投稿する'
const submitLabel = props.mode === 'edit' ? '保存する' : '投稿する'

const bodyMaxLength = computed(() => maxBodyLengthForType(props.postType))
const imageMaxCount = computed(() => maxImagesForType(props.postType))

function onFileSelected(event: Event) {
  const file = pickFileFromInput(event)
  if (file) emit('add-image', file)
}

function hasUnsavedInput() {
  return props.title.trim() !== '' || props.body.trim() !== '' || props.imagePreviews.length > 0
}

// 種別切替は入力開始前のみ想定（画面設計書169行目）。既に何か入力していたら
// 切替と同時に内容が失われることを確認してからemitする
function onSelectPostType(newType: PostType) {
  if (newType === props.postType) return
  if (hasUnsavedInput() && !window.confirm('入力した内容は失われます。切り替えますか？')) return
  emit('update:postType', newType)
}

function isTagSelected(tagId: number) {
  return props.selectedTagIds.includes(tagId)
}

// 最大5個まで選択可能（6個目以降はチェックボックス自体をdisabledにしてUIレベルでブロックする。
// docs/features/tag.md 53行目）
function onToggleTag(tagId: number) {
  if (isTagSelected(tagId)) {
    emit(
      'update:tag-ids',
      props.selectedTagIds.filter((id) => id !== tagId),
    )
  } else if (props.selectedTagIds.length < MAX_POST_TAGS) {
    emit('update:tag-ids', [...props.selectedTagIds, tagId])
  }
}
</script>

<template>
  <main class="form-card">
    <h1>{{ heading }}</h1>
    <!-- 種別切替は新規投稿時のみ。編集画面では投稿時の種別で固定される（画面設計書169行目） -->
    <div v-if="mode === 'create'" class="post-type-switch">
      <button
        type="button"
        :class="{ active: postType === 'illustration' }"
        data-testid="post-type-illustration"
        @click="onSelectPostType('illustration')"
      >
        イラストを投稿
      </button>
      <button
        type="button"
        :class="{ active: postType === 'novel' }"
        data-testid="post-type-novel"
        @click="onSelectPostType('novel')"
      >
        小説を投稿
      </button>
    </div>
    <form @submit.prevent="emit('submit')">
      <div v-if="postType === 'novel'" class="form-field">
        <label for="post-title">タイトル（{{ MAX_TITLE_LENGTH }}文字まで）</label>
        <input
          id="post-title"
          type="text"
          :value="title"
          :maxlength="MAX_TITLE_LENGTH"
          data-testid="post-title"
          @input="emit('update:title', ($event.target as HTMLInputElement).value)"
        />
        <p
          v-for="message in fieldErrors.title ?? []"
          :key="message"
          class="field-error"
          data-testid="post-title-error"
        >
          {{ message }}
        </p>
      </div>

      <div class="form-field">
        <label for="post-body">本文（{{ bodyMaxLength }}文字まで）</label>
        <textarea
          id="post-body"
          :value="body"
          :maxlength="bodyMaxLength"
          rows="4"
          data-testid="post-body"
          @input="emit('update:body', ($event.target as HTMLTextAreaElement).value)"
        ></textarea>
        <p class="post-compose-counter" data-testid="post-body-counter">
          {{ body.length }}/{{ bodyMaxLength }}
        </p>
        <p
          v-for="message in fieldErrors.body ?? []"
          :key="message"
          class="field-error"
          data-testid="post-body-error"
        >
          {{ message }}
        </p>
      </div>

      <div class="form-field">
        <label
          >{{ postType === 'novel' ? 'カバー画像' : '画像' }}（{{ imageMaxCount }}枚まで）</label
        >
        <div class="post-compose-images">
          <div v-for="(preview, i) in imagePreviews" :key="preview" class="post-compose-image-slot">
            <img :src="preview" :alt="`添付画像${i + 1}`" />
            <button
              type="button"
              :data-testid="`post-image-remove-${i}`"
              @click="emit('remove-image', i)"
            >
              削除
            </button>
          </div>
          <label
            v-if="canAddMore"
            class="post-compose-image-add"
            data-testid="post-image-add"
            aria-label="画像を追加"
          >
            <!-- テキストの「＋」は書体によって縦位置が揺れ丸の中心からずれるため、
            アイコンをSVGの直線2本で描いて確実に中央揃えにする -->
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path
                d="M12 5v14M5 12h14"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
              />
            </svg>
            <input
              type="file"
              accept="image/jpeg,image/png"
              class="visually-hidden"
              data-testid="post-image-input"
              @change="onFileSelected"
            />
          </label>
        </div>
        <p v-if="imagePickError" class="field-error" data-testid="post-image-pick-error">
          {{ imagePickError }}
        </p>
        <p
          v-for="message in fieldErrors.images ?? []"
          :key="message"
          class="field-error"
          data-testid="post-image-error"
        >
          {{ message }}
        </p>
        <!-- keep_image_idsはバックエンド側のバリデーション項目名で、単独のフォーム欄には
        対応しないため、画像欄のエラーとしてまとめて表示する -->
        <p
          v-for="message in fieldErrors.keep_image_ids ?? []"
          :key="message"
          class="field-error"
          data-testid="post-image-error"
        >
          {{ message }}
        </p>
      </div>

      <div class="form-field">
        <label>分類タグ（最大{{ MAX_POST_TAGS }}個）</label>
        <div class="post-compose-tags">
          <label v-for="tag in tags" :key="tag.id" class="post-compose-tag">
            <input
              type="checkbox"
              :checked="isTagSelected(tag.id)"
              :disabled="!isTagSelected(tag.id) && selectedTagIds.length >= MAX_POST_TAGS"
              :data-testid="`post-tag-${tag.id}`"
              @change="onToggleTag(tag.id)"
            />
            {{ tag.name }}
          </label>
        </div>
        <p
          v-for="message in fieldErrors.tag_ids ?? []"
          :key="message"
          class="field-error"
          data-testid="post-tag-error"
        >
          {{ message }}
        </p>
      </div>

      <p v-if="errorMessage" class="field-error" data-testid="post-compose-error">
        {{ errorMessage }}
      </p>
      <div class="form-actions">
        <button type="button" data-testid="post-compose-cancel" @click="emit('cancel')">
          キャンセル
        </button>
        <button
          type="submit"
          class="form-submit"
          :disabled="submitDisabled || submitting"
          data-testid="post-compose-submit"
        >
          {{ submitLabel }}
        </button>
      </div>
    </form>
  </main>
</template>
