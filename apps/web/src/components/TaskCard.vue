<template>
  <div>
    <p>
      {{ task.title }} - {{ task.status }} - {{ task.priority }} -
      {{ task.assignee ?? 'Unassigned' }}
    </p>

    <button @click="handleDelete">Delete</button>
  </div>
</template>

<script setup lang="ts">
import type { Task } from '../types/task'

const props = defineProps<{
  task: Task
}>()

const emit = defineEmits<{
  delete: [taskId: number]
}>()

function handleDelete() {
  const taskId = props.task.id
  emit('delete', taskId)
}
</script>
