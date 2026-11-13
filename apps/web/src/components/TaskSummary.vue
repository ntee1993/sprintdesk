<template>
  <section class="summary">
    <div class="summary-heading">
      <div>
        <p class="eyebrow">AT A GLANCE</p>
        <h2>Task Summary</h2>
      </div>
      <span class="summary-caption">Current task selection</span>
    </div>
    <div class="summary-grid">
      <p>
        <span>Total Tasks:</span> <strong>{{ totalTasks }}</strong>
      </p>
      <p>
        <span>To Do:</span> <strong>{{ todoCount }}</strong>
      </p>
      <p>
        <span>In Progress:</span> <strong>{{ inProgressCount }}</strong>
      </p>
      <p>
        <span>Completed:</span> <strong>{{ completedCount }}</strong>
      </p>
      <p>
        <span>Urgent:</span> <strong>{{ urgentCount }}</strong>
      </p>
    </div>
  </section>
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
