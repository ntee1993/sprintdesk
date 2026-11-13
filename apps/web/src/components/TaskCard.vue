<template>
  <div class="task-card">
    <p>{{ task.title }} - {{ task.status }} - {{ task.priority }}</p>
    <p>
      Assignee:
      {{ task.assigneeId == null ? 'Unassigned' : (assigneeName ?? `User #${task.assigneeId}`) }}
    </p>
    <p v-if="expanded">Additional details are visible.</p>

    <button type="button" @click="emit('details', task.id)">Details</button>
    <button type="button" @click="handleEdit">Edit</button>
    <button type="button" @click="handleDelete">Delete</button>
    <button type="button" @click="expandedToggle" :aria-expanded="expanded">
      {{ expanded ? 'Collapse' : 'Expand' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import type { Task } from '@/types/task'
import { ref } from 'vue'

const props = defineProps<{
  task: Task
  assigneeName?: string
}>()

const emit = defineEmits<{
  delete: [taskId: number]
  edit: [taskId: number]
  details: [taskId: number]
}>()

function handleDelete() {
  const taskId = props.task.id
  emit('delete', taskId)
}

function handleEdit() {
  const taskId = props.task.id
  emit('edit', taskId)
}

const expanded = ref(false)
function expandedToggle() {
  expanded.value = !expanded.value
}
</script>
