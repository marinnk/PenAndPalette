<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import AvatarIcon from '@/components/AvatarIcon.vue'
import { validateCommentImage } from '@/composables/postImageValidation'
import { useSingleImagePreview } from '@/composables/useSingleImagePreview'
import { pickFileFromInput } from '@/lib/fileInput'
import type { Comment } from '@/types/comment'

// S05 投稿詳細画面のコメント1件分の表示。comment.md 4.2の通り、編集は別画面へ遷移せず
// このコンポーネント内でisEditingを切り替えてその場（インライン）で行う。
//
// updateCommentは関数プロパティとして受け取る（emitの発火だけで終わらせない）：更新の
// 成否をこのコンポーネント自身が判断してisEditingを制御する必要がある（保存に失敗した場合、
// 編集内容を破棄せず編集フォームを開いたままにする）ため、結果を受け取れるPromiseベースの
// 関数呼び出しにしている。deleteは結果に応じたこのコンポーネント側の状態変化が無いため、
// 従来通りemitのままでよい
const props = withDefaults(
  defineProps<{
    comment: Comment
    pending?: boolean
    updateComment: (payload: {
      content: string
      image?: File
      removeImage?: boolean
    }) => Promise<Comment | null>
  }>(),
  { pending: false },
)
const emit = defineEmits<{
  delete: []
}>()

const auth = useAuthStore()
const isOwnComment = computed(() => auth.currentUser?.id === props.comment.author.id)

const isEditing = ref(false)
const editContent = ref('')
const editImage = ref<File | undefined>(undefined)
const { preview: editImagePreview, setFile: setEditImagePreview, clear: clearEditImagePreview } =
  useSingleImagePreview()
const removeImage = ref(false)
const imageError = ref<string | null>(null)
const saveError = ref<string | null>(null)

function startEditing() {
  editContent.value = props.comment.content
  editImage.value = undefined
  clearEditImagePreview()
  removeImage.value = false
  imageError.value = null
  saveError.value = null
  isEditing.value = true
}

function cancelEditing() {
  clearEditImagePreview()
  isEditing.value = false
}

function onFileSelected(event: Event) {
  const file = pickFileFromInput(event)
  if (!file) return

  const error = validateCommentImage(file)
  if (error) {
    imageError.value = error
    return
  }
  imageError.value = null
  editImage.value = file
  setEditImagePreview(file)
  removeImage.value = false
}

function onRemoveExistingImage() {
  removeImage.value = true
  editImage.value = undefined
  clearEditImagePreview()
}

async function onSave() {
  saveError.value = null
  const result = await props.updateComment({
    content: editContent.value,
    image: editImage.value,
    removeImage: removeImage.value,
  })
  if (result) {
    // 保存成功時のみ編集モードを終える。失敗時は入力内容を破棄せず、編集フォームを
    // 開いたままエラーを示す（そのまま保存し直せるようにする）
    clearEditImagePreview()
    isEditing.value = false
  } else {
    saveError.value = '更新に失敗しました。もう一度お試しください。'
  }
}

function onDeleteClick() {
  if (window.confirm('このコメントを削除しますか？')) {
    emit('delete')
  }
}
</script>

<template>
  <li class="comment-item" :data-testid="`comment-item-${comment.id}`">
    <div class="comment-item-header">
      <RouterLink
        :to="{ name: 'profile', params: { id: comment.author.id } }"
        class="comment-item-author"
        :data-testid="`comment-author-link-${comment.id}`"
      >
        <AvatarIcon
          :src="comment.author.avatar_url"
          :size="20"
          :testid="`comment-author-avatar-${comment.id}`"
        />
        {{ comment.author.display_name }}
      </RouterLink>
      <span v-if="isOwnComment && !isEditing" class="comment-item-actions">
        <button
          type="button"
          :disabled="pending"
          :data-testid="`comment-edit-button-${comment.id}`"
          @click="startEditing"
        >
          編集
        </button>
        <button
          type="button"
          :disabled="pending"
          :data-testid="`comment-delete-button-${comment.id}`"
          @click="onDeleteClick"
        >
          削除
        </button>
      </span>
    </div>

    <template v-if="!isEditing">
      <p v-if="comment.content" class="comment-item-content" :data-testid="`comment-content-${comment.id}`">
        {{ comment.content }}
      </p>
      <img
        v-if="comment.image_url"
        :src="comment.image_url"
        alt="コメント画像"
        class="comment-item-image"
        :data-testid="`comment-image-${comment.id}`"
      />
    </template>

    <div v-else class="comment-item-edit">
      <textarea
        v-model="editContent"
        maxlength="280"
        rows="2"
        aria-label="コメントを編集"
        :data-testid="`comment-edit-content-${comment.id}`"
      ></textarea>
      <p class="post-compose-counter">{{ editContent.length }}/280</p>

      <div v-if="editImagePreview" class="comment-edit-image-preview">
        <img :src="editImagePreview" alt="新しい画像のプレビュー" />
      </div>
      <div v-else-if="comment.image_url && !removeImage" class="comment-edit-image-preview">
        <img :src="comment.image_url" alt="コメント画像" />
        <button
          type="button"
          :data-testid="`comment-edit-remove-image-${comment.id}`"
          @click="onRemoveExistingImage"
        >
          画像を削除
        </button>
      </div>
      <label v-else class="comment-edit-image-add">
        画像を追加
        <input
          type="file"
          accept="image/jpeg,image/png"
          class="visually-hidden"
          :data-testid="`comment-edit-image-input-${comment.id}`"
          @change="onFileSelected"
        />
      </label>
      <p v-if="imageError" class="field-error" :data-testid="`comment-edit-image-error-${comment.id}`">
        {{ imageError }}
      </p>
      <p v-if="saveError" class="field-error" :data-testid="`comment-edit-error-${comment.id}`">
        {{ saveError }}
      </p>

      <div class="form-actions">
        <button
          type="button"
          :data-testid="`comment-edit-cancel-${comment.id}`"
          @click="cancelEditing"
        >
          キャンセル
        </button>
        <button
          type="button"
          class="form-submit"
          :disabled="pending"
          :data-testid="`comment-edit-save-${comment.id}`"
          @click="onSave"
        >
          保存する
        </button>
      </div>
    </div>
  </li>
</template>
