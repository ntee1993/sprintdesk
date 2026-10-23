<template>
  <BaseModal title="Edit Task" @close="emit('close')">
    <form @submit.prevent="handleSave">
      <label for="draft-title">Task Title</label>
      <input
        type="text"
        v-model="draftTitle"
        id="draft-title"
        :aria-invalid="Boolean(titleError)"
        :aria-describedby="titleError ? 'draft-title-error' : undefined"
      />
      <p v-if="titleError" id="draft-title-error" role="alert">
        {{ titleError }}
      </p>

      <label for="draft-status">Status</label>
      <select v-model="draftStatus" id="draft-status">
        <option value="todo">To Do</option>
        <option value="in_progress">In Progress</option>
        <option value="done">Done</option>
      </select>

      <label for="draft-priority">Priority</label>
      <select v-model="draftPriority" id="draft-priority">
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
        <option value="urgent">Urgent</option>
      </select>

      <button type="submit">Save Changes</button>
    </form>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Task, TaskChanges } from '@/types/task'
import BaseModal from './BaseModal.vue'

const props = defineProps<{
  task: Task
}>()

const emit = defineEmits<{
  close: []
  save: [taskId: number, changes: TaskChanges]
}>()

const draftTitle = ref(props.task.title)
const draftStatus = ref(props.task.status)
const draftPriority = ref(props.task.priority)

const titleErrorMsg = 'Task title is required.'
const titleError = ref('')
watch(draftTitle, (newValue) => {
  if (newValue.trim().length !== 0) {
    titleError.value = ''
  }
})

function handleSave() {
  const title = draftTitle.value.trim()

  if (title === '') {
    titleError.value = titleErrorMsg
    return
  }

  titleError.value = ''

  const taskId = props.task.id
  const status = draftStatus.value
  const priority = draftPriority.value

  const changes: TaskChanges = {
    title,
    status,
    priority,
  }

  emit('save', taskId, changes)
}
</script>

<style scoped>
form {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}
</style>
