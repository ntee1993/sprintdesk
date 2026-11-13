<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { AuthUser } from '@/services/auth-api'

const props = defineProps<{ user: AuthUser; loading: boolean; error: string | null }>()
const emit = defineEmits<{ logout: [] }>()
const route = useRoute()
const menuOpen = ref(false)
const menuButton = ref<HTMLButtonElement | null>(null)
const nav = ref<HTMLElement | null>(null)
const sidebar = ref<HTMLElement | null>(null)

function trapFocus(event: KeyboardEvent) {
  if (!menuOpen.value) return
  const items = sidebar.value?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)')
  if (!items?.length) return
  const first = items[0]!
  const last = items[items.length - 1]!
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

function closeMenu() {
  if (!menuOpen.value) return
  menuOpen.value = false
  void nextTick(() => menuButton.value?.focus())
}

function toggleMenu() {
  if (menuOpen.value) return closeMenu()
  menuOpen.value = true
  void nextTick(() => nav.value?.querySelector('a')?.focus())
}
const navigation = [
  { label: 'Dashboard', path: '/', icon: 'dashboard' },
  { label: 'Tasks', path: '/tasks', icon: 'tasks' },
  { label: 'Projects', path: '/projects', icon: 'projects' },
] as const
const currentPage = computed(
  () => navigation.find((item) => item.path === route.path)?.label ?? 'Workspace',
)
const initials = computed(
  () =>
    props.user.name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || '?',
)
watch(
  () => route.path,
  () => {
    closeMenu()
  },
)
</script>

<template>
  <div class="shell" @keydown.esc="closeMenu" @keydown.tab="trapFocus">
    <a class="skip-link" href="#main-content">Skip to content</a>
    <button
      v-if="menuOpen"
      class="sidebar-backdrop"
      type="button"
      aria-label="Close navigation"
      @click="closeMenu"
    ></button>
    <aside id="app-sidebar" ref="sidebar" class="sidebar" :class="{ 'sidebar--open': menuOpen }">
      <div class="brand">
        <span class="brand-mark" aria-hidden="true"
          ><svg viewBox="0 0 24 24" fill="none">
            <path
              d="M5 7.5 12 4l7 3.5v9L12 20l-7-3.5v-9Z"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linejoin="round"
            />
            <path
              d="m8.5 11.8 2.3 2.3 4.8-5"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            /></svg
        ></span>
        <span class="brand-name">Sprint<span>Desk</span></span>
      </div>
      <div class="workspace-label">WORKSPACE</div>
      <nav ref="nav" class="sidebar-nav" aria-label="Main navigation">
        <RouterLink
          v-for="item in navigation"
          :key="item.path"
          :to="item.path"
          :exact-active-class="'nav-link--active'"
          class="nav-link"
          @click="closeMenu"
        >
          <svg v-if="item.icon === 'dashboard'" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
            <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
            <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
            <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
          </svg>
          <svg v-else-if="item.icon === 'tasks'" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="4" y="4" width="16" height="16" rx="3" />
            <path d="m8 12 2.4 2.4L16.5 8.5" />
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M3.5 7a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V7Z"
            />
          </svg>
          {{ item.label }}
        </RouterLink>
      </nav>
      <div class="sidebar-bottom">
        <div class="sidebar-note"><span class="sidebar-note-dot"></span> Your workspace</div>
        <div class="account">
          <span class="avatar" aria-hidden="true">{{ initials }}</span>
          <span class="account-details"
            ><strong>{{ user.name }}</strong
            ><span>{{ user.email }}</span></span
          >
          <button
            class="logout-button"
            type="button"
            :disabled="loading"
            aria-label="Log out"
            title="Log out"
            @click="emit('logout')"
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M10 17v2H5V5h5v2m4 1 4 4-4 4m4-4H9"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
              /></svg
            ><span>Log out</span>
          </button>
        </div>
      </div>
    </aside>
    <div class="shell-main" :inert="menuOpen ? true : undefined">
      <header class="topbar">
        <button
          ref="menuButton"
          class="menu-button"
          type="button"
          :aria-expanded="menuOpen"
          aria-controls="app-sidebar"
          aria-label="Toggle navigation"
          @click="toggleMenu"
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M4 7h16M4 12h16M4 17h16"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
            />
          </svg>
        </button>
        <div class="breadcrumb">
          <span>Workspace</span><span class="breadcrumb-separator" aria-hidden="true">/</span
          ><strong>{{ currentPage }}</strong>
        </div>
        <div class="topbar-account">
          <span class="topbar-greeting">{{ user.name }}</span
          ><span class="avatar avatar--small" aria-hidden="true">{{ initials }}</span>
        </div>
      </header>
      <div class="content">
        <p v-if="error" class="feedback feedback--error" role="alert">{{ error }}</p>
        <slot />
      </div>
    </div>
  </div>
</template>
