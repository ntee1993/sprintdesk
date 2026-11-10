import type { Task, TaskChanges } from '@/types/task'
import {
  createTask,
  deleteTask as deleteTaskApi,
  updateTask as updateTaskApi,
} from '@/services/tasks-api'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useTaskStore = defineStore('tasks', () => {
  const tasks = ref<Task[]>([])

  const isLoading = ref(false)
  const fetchError = ref<string | null>(null)
  let latestFetchId = 0

  async function fetchTasks(projectId?: number) {
    const requestId = ++latestFetchId
    const url = projectId
      ? `http://localhost:3000/tasks?projectId=${projectId}`
      : 'http://localhost:3000/tasks'

    if (requestId === latestFetchId) {
      isLoading.value = true
      fetchError.value = null
    }
    try {
      const response = await fetch(url, { credentials: 'include' })
      if (!response.ok) {
        throw new Error('Failed to fetch tasks')
      }
      const data = (await response.json()) as Task[]
      if (requestId === latestFetchId) {
        tasks.value = data
      }
    } catch {
      if (requestId === latestFetchId) {
        fetchError.value = 'Failed to load tasks'
      }
    } finally {
      if (requestId === latestFetchId) {
        isLoading.value = false
      }
    }
  }

  async function addTask(input: Parameters<typeof createTask>[0]) {
    isLoading.value = true
    fetchError.value = null

    try {
      const createdTask = await createTask(input)
      tasks.value.push(createdTask)
    } catch (error) {
      fetchError.value = error instanceof Error ? error.message : 'Failed to create task'
      throw error
    } finally {
      isLoading.value = false
    }
  }

  async function deleteTask(taskId: Task['id']) {
    isLoading.value = true
    fetchError.value = null

    try {
      await deleteTaskApi(taskId)
      tasks.value = tasks.value.filter((task) => task.id !== taskId)
    } catch (error) {
      fetchError.value = error instanceof Error ? error.message : 'Failed to delete task'
      throw error
    } finally {
      isLoading.value = false
    }
  }

  async function updateTask(taskId: Task['id'], changes: TaskChanges) {
    isLoading.value = true
    fetchError.value = null

    try {
      const updatedTask = await updateTaskApi(taskId, changes)
      tasks.value = tasks.value.map((task) => (task.id === taskId ? updatedTask : task))
    } catch (error) {
      fetchError.value = error instanceof Error ? error.message : 'Failed to update task'
      throw error
    } finally {
      isLoading.value = false
    }
  }

  function clearTasks() {
    latestFetchId++
    tasks.value = []
    fetchError.value = null
    isLoading.value = false
  }

  return { fetchTasks, isLoading, fetchError, tasks, addTask, deleteTask, updateTask, clearTasks }
})
