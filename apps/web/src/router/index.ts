import DashboardView from '@/views/DashboardView.vue'
import ProjectsView from '@/views/ProjectsView.vue'
import TasksView from '@/views/TasksView.vue'
import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', component: DashboardView },
  { path: '/tasks', component: TasksView },
  { path: '/projects', component: ProjectsView },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
