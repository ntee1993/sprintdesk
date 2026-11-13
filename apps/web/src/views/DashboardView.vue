<template>
  <main id="main-content" tabindex="-1" class="page dashboard-page">
    <div class="page-heading">
      <div>
        <p class="eyebrow">YOUR WORKSPACE</p>
        <h1>Dashboard</h1>
        <p class="page-description">SprintDesk project overview</p>
      </div>
    </div>
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
