import type { Task, TaskChanges } from '@/types/task'
import {
  createTask,
  deleteTask as deleteTaskApi,
  updateTask as updateTaskApi,
} from '@/services/tasks-api'
import { defineStore } from 'pinia'
import { ref } from 'vue'

const TASK_PAGE_SIZE = 100

export const useTaskStore = defineStore('tasks', () => {
  const tasks = ref<Task[]>([])

  const isLoading = ref(false)
  const fetchError = ref<string | null>(null)
  let latestFetchId = 0
  let generation = 0
  let pending = 0
  let fetchPending = false

  async function fetchTasks(projectId?: number) {
    const requestId = ++latestFetchId
    if (fetchPending) pending--
    fetchPending = true
    pending++

    if (requestId === latestFetchId) {
      isLoading.value = true
      fetchError.value = null
    }
    try {
      const allTasks: Task[] = []
      let page = 1

      while (requestId === latestFetchId) {
        const query = new URLSearchParams()
        if (projectId !== undefined) query.set('projectId', String(projectId))
        query.set('limit', String(TASK_PAGE_SIZE))
        query.set('page', String(page))

        const response = await fetch(`http://localhost:3000/tasks?${query}`, {
          credentials: 'include',
        })
        if (requestId !== latestFetchId) return
        if (!response.ok) throw new Error('Failed to fetch tasks')

        const pageTasks = (await response.json()) as Task[]
        if (requestId !== latestFetchId) return

        allTasks.push(...pageTasks)
        if (pageTasks.length < TASK_PAGE_SIZE) {
          tasks.value = allTasks
          break
        }

        page++
      }
    } catch {
      if (requestId === latestFetchId) {
        fetchError.value = 'Failed to load tasks'
      }
    } finally {
      if (requestId === latestFetchId) {
        fetchPending = false
        isLoading.value = --pending > 0
      }
    }
  }

  async function addTask(input: Parameters<typeof createTask>[0]) {
    const requestGeneration = generation
    pending++
    isLoading.value = true
    fetchError.value = null

    try {
      const createdTask = await createTask(input)
      if (requestGeneration === generation) tasks.value.push(createdTask)
    } catch (error) {
      if (requestGeneration === generation)
        fetchError.value = error instanceof Error ? error.message : 'Failed to create task'
      throw error
    } finally {
      if (requestGeneration === generation) isLoading.value = --pending > 0
    }
  }

  async function deleteTask(taskId: Task['id']) {
    const requestGeneration = generation
    pending++
    isLoading.value = true
    fetchError.value = null

    try {
      await deleteTaskApi(taskId)
      if (requestGeneration === generation)
        tasks.value = tasks.value.filter((task) => task.id !== taskId)
    } catch (error) {
      if (requestGeneration === generation)
        fetchError.value = error instanceof Error ? error.message : 'Failed to delete task'
      throw error
    } finally {
      if (requestGeneration === generation) isLoading.value = --pending > 0
    }
  }

  async function updateTask(taskId: Task['id'], changes: TaskChanges) {
    const requestGeneration = generation
    pending++
    isLoading.value = true
    fetchError.value = null

    try {
      const updatedTask = await updateTaskApi(taskId, changes)
      if (requestGeneration === generation) {
        tasks.value = tasks.value.map((task) => (task.id === taskId ? updatedTask : task))
      }
    } catch (error) {
      if (requestGeneration === generation)
        fetchError.value = error instanceof Error ? error.message : 'Failed to update task'
      throw error
    } finally {
      if (requestGeneration === generation) isLoading.value = --pending > 0
    }
  }

  function clearTasks() {
    generation++
    pending = 0
    fetchPending = false
    latestFetchId++
    tasks.value = []
    fetchError.value = null
    isLoading.value = false
  }

  return { fetchTasks, isLoading, fetchError, tasks, addTask, deleteTask, updateTask, clearTasks }
})
