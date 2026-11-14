import { csrfFetch } from './csrf-fetch'
import { API_BASE_URL } from './api-config'

export type Project = {
  id: number
  name: string
  ownerId: number
}

export type ProjectMember = {
  userId: number
  name: string
  email: string
  role: 'OWNER' | 'EDITOR' | 'VIEWER'
}

export async function getProjects(): Promise<Project[]> {
  const response = await fetch(`${API_BASE_URL}/projects`, {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error(`Failed to get projects (HTTP ${response.status})`)
  }

  return (await response.json()) as Project[]
}

export async function createProject(name: string): Promise<Project> {
  const response = await csrfFetch(`${API_BASE_URL}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ name }),
  })

  if (!response.ok) {
    throw new Error(`Failed to create project (HTTP ${response.status})`)
  }

  return (await response.json()) as Project
}

export async function getProjectMembers(projectId: number): Promise<ProjectMember[]> {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/members`, {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error(`Failed to get project members (HTTP ${response.status})`)
  }

  return (await response.json()) as ProjectMember[]
}

export async function addProjectMember(
  projectId: number,
  email: string,
  role: 'EDITOR' | 'VIEWER',
): Promise<void> {
  const response = await csrfFetch(`${API_BASE_URL}/projects/${projectId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, role }),
  })

  if (!response.ok) {
    throw new Error(`Failed to add project member (HTTP ${response.status})`)
  }
}

export async function updateProjectMemberRole(
  projectId: number,
  memberId: number,
  role: 'EDITOR' | 'VIEWER',
): Promise<void> {
  const response = await csrfFetch(`${API_BASE_URL}/projects/${projectId}/members/${memberId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ role }),
  })

  if (!response.ok) {
    throw new Error(`Failed to update project member role (HTTP ${response.status})`)
  }
}

export async function removeProjectMember(projectId: number, memberId: number): Promise<void> {
  const response = await csrfFetch(`${API_BASE_URL}/projects/${projectId}/members/${memberId}`, {
    method: 'DELETE',
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error(`Failed to remove project member (HTTP ${response.status})`)
  }
}
