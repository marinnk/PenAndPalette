<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PostComposeForm from '@/components/PostComposeForm.vue'
import { usePostCreate } from '@/composables/usePostCreate'
import { useTags } from '@/composables/useTags'
import { maxImagesForType } from '@/composables/postImageValidation'

// S04 投稿作成画面
const router = useRouter()
const {
  postType,
  title,
  body,
  images,
  imagePreviews,
  selectedTagIds,
  submitting,
  errorMessage,
  fieldErrors,
  setPostType,
  addImage,
  removeImage,
  submit,
} = usePostCreate()
const { tags, load: loadTags } = useTags()

onMounted(loadTags)

const imagePickError = ref<string | null>(null)

function onAddImage(file: File) {
  imagePickError.value = addImage(file)
}

// イラストは画像必須（本文は任意）、小説はタイトル・本文が必須（画像＝カバーは任意）
// （docs/features/post.md 2.1節の入力ルール）
const submitDisabled = computed(() =>
  postType.value === 'novel'
    ? title.value.trim().length === 0 || body.value.trim().length === 0
    : images.value.length === 0,
)

async function handleSubmit() {
  const post = await submit()
  if (post) {
    router.push({ name: 'timeline' })
  }
}
</script>

<template>
  <PostComposeForm
    mode="create"
    :post-type="postType"
    :title="title"
    :body="body"
    :image-previews="imagePreviews"
    :can-add-more="images.length < maxImagesForType(postType)"
    :tags="tags"
    :selected-tag-ids="selectedTagIds"
    :submit-disabled="submitDisabled"
    :submitting="submitting"
    :error-message="errorMessage"
    :field-errors="fieldErrors"
    :image-pick-error="imagePickError"
    @update:post-type="setPostType"
    @update:title="title = $event"
    @update:body="body = $event"
    @update:tag-ids="selectedTagIds = $event"
    @add-image="onAddImage"
    @remove-image="removeImage"
    @submit="handleSubmit"
    @cancel="router.push({ name: 'timeline' })"
  />
</template>
