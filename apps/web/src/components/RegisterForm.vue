<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { register } from '@/services/auth-api'

const emit = defineEmits<{ back: []; registered: [] }>()
const heading = ref<HTMLElement | null>(null)
const name = ref('')
const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref<string | null>(null)

onMounted(() => heading.value?.focus())

async function handleSubmit() {
  if (loading.value) return
  loading.value = true
  error.value = null
  try {
    await register(name.value, email.value, password.value)
    password.value = ''
    emit('registered')
  } catch (err) {
    error.value = err instanceof TypeError
      ? 'Network error. Please check your connection and try again.'
      : err instanceof Error ? err.message : 'Could not create account. Please try again.'
  } finally {
    loading.value = false
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
        <h1 ref="heading" tabindex="-1">Create account.</h1>
        <p>Get started with your workspace.</p>
      </div>
      <form @submit.prevent="handleSubmit">
        <label for="register-name">Name</label>
        <input id="register-name" v-model="name" autocomplete="name" maxlength="120" required />
        <label for="register-email">Email</label>
        <input id="register-email" v-model="email" type="email" autocomplete="email" maxlength="254" required />
        <label for="register-password">Password</label>
        <input id="register-password" v-model="password" type="password" autocomplete="new-password" minlength="12" maxlength="1024" required />
        <p>Use at least 12 characters.</p>
        <p v-if="error" role="alert">{{ error }}</p>
        <button type="submit" :disabled="loading">{{ loading ? 'Creating account...' : 'Create account' }}</button>
      </form>
      <p><a href="#" @click.prevent="emit('back')">Back to sign in</a></p>
    </div>
  </main>
</template>
