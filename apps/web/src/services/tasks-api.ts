import type { Task, TaskChanges, TaskStatus, TaskPriority } from '@/types/task'

export async function createTask(input: {
  title: string
  status: TaskStatus
  priority: TaskPriority
  projectId: number
}): Promise<Task> {
  const response = await fetch('http://localhost:3000/tasks', {
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
  const response = await fetch(`http://localhost:3000/tasks/${taskId}`, {
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
  const response = await fetch(`http://localhost:3000/tasks/${taskId}`, {
    method: 'DELETE',
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error(`Failed to delete task (HTTP ${response.status})`)
  }
}
