<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import PostComposeForm from '@/components/PostComposeForm.vue'
import { usePostCreate } from '@/composables/usePostCreate'
import { MAX_IMAGES } from '@/composables/postImageValidation'

// S04 投稿作成画面
const router = useRouter()
const {
  body,
  images,
  imagePreviews,
  submitting,
  errorMessage,
  fieldErrors,
  addImage,
  removeImage,
  submit,
} = usePostCreate()

const imagePickError = ref<string | null>(null)

function onAddImage(file: File) {
  imagePickError.value = addImage(file)
}

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
    :body="body"
    :image-previews="imagePreviews"
    :can-add-more="images.length < MAX_IMAGES"
    :submit-disabled="body.trim().length === 0 && images.length === 0"
    :submitting="submitting"
    :error-message="errorMessage"
    :field-errors="fieldErrors"
    :image-pick-error="imagePickError"
    @update:body="body = $event"
    @add-image="onAddImage"
    @remove-image="removeImage"
    @submit="handleSubmit"
    @cancel="router.push({ name: 'timeline' })"
  />
</template>
