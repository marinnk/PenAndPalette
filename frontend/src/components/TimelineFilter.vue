<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Tag } from '@/types/post'

// S03 タイムラインの「絞り込み」開閉セクション。中に固定の分類タグ（12件）を表示順で並べ、
// 単一選択で絞り込む。範囲（TimelineTabs）・種別（PostTypeTabs）とは独立した軸で、
// 常時表示せず開閉ボタンの内側に置く（縦スペースの節約）
const props = defineProps<{ tags: Tag[]; modelValue: number | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: number | null] }>()

const open = ref(false)

const selectedName = computed(
  () => props.tags.find((tag) => tag.id === props.modelValue)?.name ?? null,
)

// 選択中のタグをもう一度押したら解除する（単一選択のトグル）
function select(tagId: number) {
  emit('update:modelValue', props.modelValue === tagId ? null : tagId)
}
</script>

<template>
  <div class="timeline-filter">
    <button
      type="button"
      class="timeline-filter-toggle"
      :aria-expanded="open"
      data-testid="filter-toggle"
      @click="open = !open"
    >
      絞り込み{{ selectedName ? `：#${selectedName}` : '' }}
    </button>
    <div v-if="open" class="timeline-filter-body" data-testid="filter-body">
      <button
        v-for="tag in tags"
        :key="tag.id"
        type="button"
        class="tag-chip"
        :class="{ active: modelValue === tag.id }"
        :aria-pressed="modelValue === tag.id"
        :data-testid="`filter-tag-${tag.id}`"
        @click="select(tag.id)"
      >
        #{{ tag.name }}
      </button>
    </div>
  </div>
</template>
