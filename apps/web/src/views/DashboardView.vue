<template>
  <main>
    <h1>Dashboard</h1>
    <p>SprintDesk project overview</p>
    <TaskSummary :tasks="tasks" />
  </main>
</template>

<script setup lang="ts">
import { useTaskStore } from '@/stores/task.ts'
import { storeToRefs } from 'pinia'
import TaskSummary from '@/components/TaskSummary.vue'

const taskStore = useTaskStore()
const { tasks } = storeToRefs(taskStore)
</script>
