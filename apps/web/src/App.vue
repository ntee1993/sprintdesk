<script setup lang="ts">
import { onMounted } from 'vue'
import LoginForm from '@/components/LoginForm.vue'
import AppShell from '@/components/AppShell.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

onMounted(() => {
  void auth.initialize().catch(() => {
    // The store exposes the error to the UI.
  })
})

async function handleSignOut() {
  try {
    await auth.signOut()
  } catch {
    // The store exposes the error to the UI.
  }
}
</script>

<template>
  <div v-if="!auth.initialized" class="app-loading" role="status">
    <span class="spinner" aria-hidden="true"></span> Loading your workspace...
  </div>
  <LoginForm v-else-if="!auth.user" />
  <AppShell
    v-else
    :user="auth.user"
    :loading="auth.loading"
    :error="auth.error"
    @logout="handleSignOut"
  >
    <RouterView />
  </AppShell>
</template>
