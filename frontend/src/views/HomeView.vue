<script setup lang="ts">
import { onMounted } from 'vue'
import { useHealthCheck } from '@/composables/useHealthCheck'

// このコンポーネントはcomposableから受け取った状態をどう表示するかにのみ専念する
const { status, checkHealth } = useHealthCheck()

onMounted(checkHealth)
</script>

<template>
  <main>
    <h1>PenAndPalette</h1>
    <p data-testid="backend-status">backend: {{ status }}</p>
  </main>
</template>
