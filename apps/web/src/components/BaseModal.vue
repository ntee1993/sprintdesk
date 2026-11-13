<template>
  <dialog ref="dialogRef" :aria-label="title" @close="emit('close')">
    <header class="modal-header">
      <div>
        <p class="modal-kicker">SPRINTDESK</p>
        <h2>{{ title }}</h2>
      </div>
      <button
        type="button"
        class="modal-close"
        aria-label="Close dialog"
        @click="dialogRef?.close()"
      >
        ×
      </button>
    </header>

    <slot />
  </dialog>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

defineProps<{
  title: string
}>()

const emit = defineEmits<{
  close: []
}>()

const dialogRef = ref<HTMLDialogElement | null>(null)

let previousFocus: HTMLElement | null = null
onMounted(() => {
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  dialogRef.value?.showModal()
})
onBeforeUnmount(() => {
  if (previousFocus?.isConnected) previousFocus.focus()
})
</script>

<style scoped>
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding-bottom: 18px;
  margin-bottom: 20px;
  border-bottom: 1px solid var(--color-border);
}
.modal-header h2 {
  margin: 0;
  font-size: 20px;
}
.modal-kicker {
  margin: 0 0 4px;
  color: var(--color-primary);
  font-weight: 700;
  font-size: 10px;
  letter-spacing: 0.12em;
}
.modal-close {
  min-width: 44px;
  min-height: 44px;
  font-size: 22px;
  line-height: 1;
}
</style>
