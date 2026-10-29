import type { Task, TaskChanges } from '@/types/task'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useTaskStore = defineStore('tasks', () => {
  const tasks = ref<Task[]>([
    { id: 1, title: 'Create SprintDesk', status: 'todo', priority: 'high' },
    { id: 2, title: 'Learn Vue', status: 'in_progress', priority: 'medium', assignee: 'Nashi' },
    { id: 3, title: 'Prepare for interview', status: 'done', priority: 'urgent' },
  ])

  const isLoading = ref(false)
  const fetchError = ref<string | null>(null)

  async function fetchTasks() {
    isLoading.value = true
    fetchError.value = null
    try {
      const response = await fetch('http://localhost:3000/tasks')
      if (!response.ok) {
        throw new Error('Failed to fetch tasks')
      }
      const data = (await response.json()) as Task[]
      tasks.value = data
    } catch {
      fetchError.value = 'Failed to load tasks'
    } finally {
      isLoading.value = false
    }
  }

  const addTask = (newTask: Pick<Task, 'title' | 'status' | 'priority'>) => {
    const taskIds = tasks.value.map((task) => task.id)
    const maxId = taskIds.length > 0 ? Math.max(...taskIds) : 0
    const id = maxId + 1

    tasks.value.push({
      id,
      ...newTask,
    })
  }

  const deleteTask = (taskId: Task['id']) => {
    const result = tasks.value.filter((task) => task.id !== taskId)
    tasks.value = result
  }

  const updateTask = (taskId: Task['id'], changes: TaskChanges) => {
    const updatedTask = tasks.value.map((task) => {
      if (task.id === taskId) {
        return {
          ...task,
          ...changes,
        }
      }

      return task
    })

    tasks.value = updatedTask
  }

  return { fetchTasks, isLoading, fetchError, tasks, addTask, deleteTask, updateTask }
})
