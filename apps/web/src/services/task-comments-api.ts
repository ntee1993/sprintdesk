import { csrfFetch } from './csrf-fetch'
import { API_BASE_URL } from './api-config'

export type TaskComment = {
  id: number
  taskId: number
  authorId: number
  content: string
  createdAt: string
  updatedAt: string
  author: { id: number; name: string }
}

const endpoint = (taskId: number) => `${API_BASE_URL}/tasks/${taskId}/comments`

async function checked(response: Response): Promise<Response> {
  if (!response.ok) throw new Error(`Comments request failed (HTTP ${response.status})`)
  return response
}

export async function getTaskComments(taskId: number): Promise<TaskComment[]> {
  const response = await checked(await fetch(endpoint(taskId), { credentials: 'include' }))
  return (await response.json()) as TaskComment[]
}

export async function createTaskComment(taskId: number, content: string): Promise<TaskComment> {
  const response = await checked(
    await csrfFetch(endpoint(taskId), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    }),
  )
  return (await response.json()) as TaskComment
}

export async function updateTaskComment(
  taskId: number,
  commentId: number,
  content: string,
): Promise<TaskComment> {
  const response = await checked(
    await csrfFetch(`${endpoint(taskId)}/${commentId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    }),
  )
  return (await response.json()) as TaskComment
}

export async function deleteTaskComment(taskId: number, commentId: number): Promise<void> {
  await checked(
    await csrfFetch(`${endpoint(taskId)}/${commentId}`, {
      method: 'DELETE',
      credentials: 'include',
    }),
  )
}
