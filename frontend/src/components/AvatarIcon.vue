<script setup lang="ts">
// ヘッダー・投稿カード・プロフィール画面・プロフィール編集画面で共通のアイコン画像表示。
// 画像が無い場合もアイコン分のスペースを開けておき、見た目の統一感を保つ
// （avatar_url未設定時にプレースホルダーを出す、というルールをこの1箇所に集約する）
withDefaults(defineProps<{ src?: string | null; size?: number; testid?: string }>(), {
  src: null,
  size: 32,
  testid: undefined,
})
</script>

<template>
  <!-- v-if/v-elseでルート要素が2種類あり、Vueの属性フォールスルーが自動では効かないため、
       呼び出し元から渡されたclass等（画面固有の余白調整など）をv-bind="$attrs"で明示的に
       両方の分岐へ伝える -->
  <img
    v-if="src"
    :src="src"
    alt=""
    class="avatar"
    :style="{ '--avatar-size': `${size}px` }"
    :data-testid="testid"
    v-bind="$attrs"
  />
  <div
    v-else
    class="avatar avatar-placeholder"
    :style="{ '--avatar-size': `${size}px` }"
    aria-hidden="true"
    v-bind="$attrs"
  ></div>
</template>
