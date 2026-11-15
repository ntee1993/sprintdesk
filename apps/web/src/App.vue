<script setup lang="ts">
import { onMounted, ref } from 'vue'
import LoginForm from '@/components/LoginForm.vue'
import RegisterForm from '@/components/RegisterForm.vue'
import AppShell from '@/components/AppShell.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const showRegister = ref(false)
const registrationComplete = ref(false)

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
  <template v-else-if="!auth.user">
    <RegisterForm
      v-if="showRegister"
      @back="showRegister = false"
      @registered="registrationComplete = true; showRegister = false"
    />
    <LoginForm
      v-else
      :registration-complete="registrationComplete"
      @create-account="registrationComplete = false; showRegister = true"
    />
  </template>
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
