<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
defineProps<{ registrationComplete?: boolean }>()
defineEmits<{ 'create-account': [] }>()
const heading = ref<HTMLElement | null>(null)
onMounted(() => heading.value?.focus())
const email = ref('')
const password = ref('')

async function handleSubmit() {
  try {
    await auth.signIn(email.value, password.value)
  } catch {
    // The store exposes the error to the form.
  }
}
</script>

<template>
  <main class="login-page">
    <div class="login-panel">
      <div class="login-brand">
        <span class="login-brand-mark" aria-hidden="true">✓</span> Sprint<span>Desk</span>
      </div>
      <div class="login-intro">
        <span class="login-eyebrow">YOUR WORKSPACE, SIMPLIFIED</span>
        <h1 ref="heading" tabindex="-1">Welcome back.</h1>
        <p>Sign in to pick up where you left off.</p>
      </div>
      <form @submit.prevent="handleSubmit">
        <h2>Sign in</h2>
        <p v-if="registrationComplete" role="status">Account created. Please sign in.</p>
        <label for="email">Email</label>
        <input id="email" v-model="email" type="email" autocomplete="email" required />

        <label for="password">Password</label>
        <input
          id="password"
          v-model="password"
          type="password"
          autocomplete="current-password"
          required
        />

        <p v-if="auth.error" role="alert">{{ auth.error }}</p>
        <button type="submit" :disabled="auth.loading">Login</button>
      </form>
      <p><a href="#" @click.prevent="$emit('create-account')">Create account</a></p>
    </div>
  </main>
</template>
