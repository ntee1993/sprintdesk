import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getCurrentUser, login, logout, type AuthUser } from '@/services/auth-api'
import { useProjectStore } from './project'
import { useTaskStore } from './task'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const initialized = ref(false)

  const projects = useProjectStore()
  const tasks = useTaskStore()
  let authRequestId = 0
  const sessionGeneration = ref(0)

  function applySession(nextUser: AuthUser | null) {
    sessionGeneration.value++
    projects.clearProjects()
    tasks.clearTasks()
    user.value = nextUser
  }

  async function initialize() {
    const requestId = ++authRequestId
    loading.value = true
    error.value = null

    try {
      const currentUser = await getCurrentUser()
      if (requestId === authRequestId) applySession(currentUser)
    } catch (err) {
      if (requestId === authRequestId)
        error.value = err instanceof Error ? err.message : 'Failed to restore session'
      throw err
    } finally {
      if (requestId === authRequestId) {
        initialized.value = true
        loading.value = false
      }
    }
  }

  async function signIn(email: string, password: string) {
    const requestId = ++authRequestId
    loading.value = true
    error.value = null

    try {
      const currentUser = await login(email, password)
      if (requestId === authRequestId) applySession(currentUser)
    } catch (err) {
      if (requestId === authRequestId)
        error.value = err instanceof Error ? err.message : 'Login failed'
      throw err
    } finally {
      if (requestId === authRequestId) {
        initialized.value = true
        loading.value = false
      }
    }
  }

  async function signOut() {
    const requestId = ++authRequestId
    loading.value = true
    error.value = null

    try {
      await logout()
      if (requestId === authRequestId) applySession(null)
    } catch (err) {
      if (requestId === authRequestId)
        error.value = err instanceof Error ? err.message : 'Logout failed'
      throw err
    } finally {
      if (requestId === authRequestId) {
        initialized.value = true
        loading.value = false
      }
    }
  }

  return { user, loading, error, initialized, sessionGeneration, initialize, signIn, signOut }
})
