<script setup lang="ts">
import { ref } from 'vue'
import type { Task } from './types/task'

const tasks = ref<Task[]>([
  { id: 1, title: 'Create SprintDesk', status: 'todo', priority: 'high' },
  { id: 2, title: 'Learn Vue', status: 'in_progress', priority: 'medium', assignee: 'Nashi' },
  { id: 3, title: 'Prepare for interview', status: 'done', priority: 'urgent' },
])

function addTask() {
  const taskId = tasks.value.map((task) => task.id)
  const maxId = taskId.length > 0 ? Math.max(...taskId) : 0
  const newId = maxId + 1
  tasks.value.push({
    id: newId,
    title: 'Learn NestJS',
    status: 'todo',
    priority: 'high',
  })
}
</script>

<template>
  <main>
    <h1>SprintDesk — Project Management</h1>

    <div v-for="task in tasks" :key="task.id">
      <p>
        {{ task.title }} - {{ task.status }} - {{ task.priority }} -
        {{ task.assignee ?? 'Unassigned' }}
      </p>
    </div>

    <button @click="addTask">Add Task</button>
  </main>
</template>
