<script setup lang="ts">
import { onMounted } from 'vue'
import LoginForm from '@/components/LoginForm.vue'
import { useAuthStore } from '@/stores/auth'
import { useProjectStore } from '@/stores/project'
import { useTaskStore } from '@/stores/task'

const auth = useAuthStore()
const projectStore = useProjectStore()
const taskStore = useTaskStore()

onMounted(() => {
  void auth.initialize().catch(() => {
    // The store exposes the error to the UI.
  })
})

async function handleSignOut() {
  try {
    await auth.signOut()
    taskStore.clearTasks()
    projectStore.clearProjects()
  } catch {
    // The store exposes the error to the UI.
  }
}
</script>

<template>
  <p v-if="!auth.initialized">Loading...</p>
  <LoginForm v-else-if="!auth.user" />
  <template v-else>
    <header>
      <nav aria-label="Main navigation">
        <RouterLink to="/">Dashboard</RouterLink>
        <RouterLink to="/tasks">Tasks</RouterLink>
        <RouterLink to="/projects">Projects</RouterLink>
      </nav>
      <button type="button" :disabled="auth.loading" @click="handleSignOut">Logout</button>
      <p v-if="auth.error" role="alert">{{ auth.error }}</p>
    </header>

    <RouterView />
  </template>
</template>

<style scoped>
nav {
  display: flex;
  gap: 16px;
}
</style>
