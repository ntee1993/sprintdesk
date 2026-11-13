import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getProjects, createProject, type Project } from '@/services/projects-api'

export const useProjectStore = defineStore('projects', () => {
  const projects = ref<Project[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  let generation = 0
  let pending = 0

  async function fetchProjects() {
    const requestGeneration = generation
    pending++
    loading.value = true
    error.value = null

    try {
      const result = await getProjects()
      if (requestGeneration === generation) projects.value = result
    } catch (err) {
      if (requestGeneration === generation)
        error.value = err instanceof Error ? err.message : 'Failed to load projects'
      throw err
    } finally {
      if (requestGeneration === generation) loading.value = --pending > 0
    }
  }

  async function addProject(name: string) {
    const requestGeneration = generation
    pending++
    loading.value = true
    error.value = null

    try {
      const project = await createProject(name)
      if (requestGeneration === generation) projects.value.push(project)
    } catch (err) {
      if (requestGeneration === generation)
        error.value = err instanceof Error ? err.message : 'Failed to create project'
      throw err
    } finally {
      if (requestGeneration === generation) loading.value = --pending > 0
    }
  }

  function clearProjects() {
    generation++
    pending = 0
    loading.value = false
    projects.value = []
    error.value = null
  }

  return { projects, loading, error, fetchProjects, addProject, clearProjects }
})
