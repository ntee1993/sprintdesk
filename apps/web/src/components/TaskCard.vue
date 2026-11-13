<template>
  <article class="task-card">
    <div class="task-card__top">
      <span class="task-card__id">TASK #{{ task.id }}</span
      ><span class="task-card__priority" :data-priority="task.priority">{{ task.priority }}</span>
    </div>
    <p class="task-card__title">{{ task.title }}</p>
    <span class="task-card__status" :data-status="task.status">{{
      task.status.replace('_', ' ')
    }}</span>
    <p>
      Assignee:
      {{ task.assigneeId == null ? 'Unassigned' : (assigneeName ?? `User #${task.assigneeId}`) }}
    </p>
    <p v-if="expanded">Additional details are visible.</p>

    <div class="task-card__actions">
      <button type="button" @click="emit('details', task.id)">Details</button>
      <button v-if="canEdit" type="button" @click="handleEdit">Edit</button>
      <button v-if="canEdit" type="button" @click="handleDelete">Delete</button>
      <button type="button" @click="expandedToggle" :aria-expanded="expanded">
        {{ expanded ? 'Collapse' : 'Expand' }}
      </button>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { Task } from '@/types/task'
import { ref } from 'vue'

const props = defineProps<{
  task: Task
  assigneeName?: string
  canEdit?: boolean
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

<style scoped>
.task-card {
  padding: 18px;
  overflow-wrap: anywhere;
}
.task-card__top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.task-card__id {
  font-size: 10px;
  letter-spacing: 0.08em;
  font-weight: 700;
  color: var(--color-muted);
}
.task-card__priority,
.task-card__status {
  display: inline-flex;
  border-radius: 999px;
  padding: 4px 9px;
  font-size: 11px;
  font-weight: 700;
  text-transform: capitalize;
  background: #f0efff;
  color: #4b3fb0;
}
.task-card__priority[data-priority='urgent'],
.task-card__priority[data-priority='high'] {
  background: #fff1ee;
  color: #a43b2c;
}
.task-card__priority[data-priority='low'] {
  background: #eff7f4;
  color: #27684d;
}
.task-card .task-card__title {
  color: var(--color-ink);
  font-size: 15px;
  font-weight: 700;
  margin: 13px 0 9px;
}
.task-card__status {
  background: #f1f3f8;
  color: #515d72;
}
.task-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  border-top: 1px solid var(--color-border);
  padding-top: 10px;
  margin-top: 12px;
}
.task-card__actions button {
  margin: 0;
  min-height: 40px;
}
</style>
