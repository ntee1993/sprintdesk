export type Project = {
  id: number
  name: string
  ownerId: number
}

export async function getProjects(): Promise<Project[]> {
  const response = await fetch('http://localhost:3000/projects', {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error(`Failed to get projects (HTTP ${response.status})`)
  }

  return (await response.json()) as Project[]
}

export async function createProject(name: string): Promise<Project> {
  const response = await fetch('http://localhost:3000/projects', {
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
