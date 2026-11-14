import { csrfFetch } from './csrf-fetch'
import { API_BASE_URL } from './api-config'

import type { Task, TaskChanges, TaskStatus, TaskPriority } from '@/types/task'

export async function createTask(input: {
  title: string
  status: TaskStatus
  priority: TaskPriority
  projectId: number
  assigneeId?: number | null
}): Promise<Task> {
  const response = await csrfFetch(`${API_BASE_URL}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    throw new Error(`Failed to create task (HTTP ${response.status})`)
  }

  return (await response.json()) as Task
}

export async function updateTask(taskId: number, changes: TaskChanges): Promise<Task> {
  const response = await csrfFetch(`${API_BASE_URL}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(changes),
  })

  if (!response.ok) {
    throw new Error(`Failed to update task (HTTP ${response.status})`)
  }

  return (await response.json()) as Task
}

export async function deleteTask(taskId: number): Promise<void> {
  const response = await csrfFetch(`${API_BASE_URL}/tasks/${taskId}`, {
    method: 'DELETE',
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error(`Failed to delete task (HTTP ${response.status})`)
  }
}
