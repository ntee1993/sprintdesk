import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getCurrentUser, login, logout, type AuthUser } from '@/services/auth-api'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const initialized = ref(false)

  async function initialize() {
    loading.value = true
    error.value = null

    try {
      user.value = await getCurrentUser()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to restore session'
      throw err
    } finally {
      initialized.value = true
      loading.value = false
    }
  }

  async function signIn(email: string, password: string) {
    loading.value = true
    error.value = null

    try {
      user.value = await login(email, password)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Login failed'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function signOut() {
    loading.value = true
    error.value = null

    try {
      await logout()
      user.value = null
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Logout failed'
      throw err
    } finally {
      loading.value = false
    }
  }

  return { user, loading, error, initialized, initialize, signIn, signOut }
})
