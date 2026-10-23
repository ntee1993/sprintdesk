<template>
  <div>
    <h2>Task Summary</h2>

    <p>Total Tasks: {{ totalTasks }}</p>
    <p>To Do: {{ todoCount }}</p>
    <p>In Progress: {{ inProgressCount }}</p>
    <p>Completed: {{ completedCount }}</p>
    <p>Urgent: {{ urgentCount }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Task } from '@/types/task'

const props = defineProps<{
  tasks: Task[]
}>()

const totalTasks = computed(() => props.tasks.length)
const todoCount = computed(() => props.tasks.filter((task) => task.status === 'todo').length)
const inProgressCount = computed(
  () => props.tasks.filter((task) => task.status === 'in_progress').length,
)
const completedCount = computed(() => props.tasks.filter((task) => task.status === 'done').length)
const urgentCount = computed(() => props.tasks.filter((task) => task.priority === 'urgent').length)
</script>
