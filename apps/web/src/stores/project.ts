import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getProjects, createProject, type Project } from '@/services/projects-api'

export const useProjectStore = defineStore('projects', () => {
  const projects = ref<Project[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchProjects() {
    loading.value = true
    error.value = null

    try {
      projects.value = await getProjects()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load projects'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function addProject(name: string) {
    loading.value = true
    error.value = null

    try {
      const project = await createProject(name)
      projects.value.push(project)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create project'
      throw err
    } finally {
      loading.value = false
    }
  }

  function clearProjects() {
    projects.value = []
    error.value = null
  }

  return { projects, loading, error, fetchProjects, addProject, clearProjects }
})
