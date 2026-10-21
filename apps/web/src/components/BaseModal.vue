<template>
  <dialog ref="dialogRef" :aria-label="title" @close="emit('close')">
    <h2>{{ title }}</h2>

    <slot />

    <button type="button" @click="dialogRef?.close()">Close</button>
  </dialog>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

defineProps<{
  title: string
}>()

const emit = defineEmits<{
  close: []
}>()

const dialogRef = ref<HTMLDialogElement | null>(null)

onMounted(() => {
  dialogRef.value?.showModal()
})
</script>
