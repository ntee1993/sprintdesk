<script setup lang="ts">
import { ref } from 'vue'
type TaskStatus = 'todo' | 'in_progress' | 'done'
type Task = {
  id: number
  title: string
  status: TaskStatus
}
const tasks = ref<Task[]>([
  { id: 1, title: 'Create SprintDesk', status: 'todo' },
  { id: 2, title: 'Learn Vue', status: 'in_progress' },
  { id: 3, title: 'Prepare for interview', status: 'done' },
])
tasks.value.push({
  id: 4,
  title: 'Learn NestJS',
  status: 'todo',
})
</script>

<template>
  <main>
    <h1>SprintDesk</h1>
    <div v-for="task in tasks" :key="task.id">
      <p>{{ task.title }} - {{ task.status }}</p>
    </div>
    <div><p>SprintDesk — Project Management</p></div>
  </main>
</template>
