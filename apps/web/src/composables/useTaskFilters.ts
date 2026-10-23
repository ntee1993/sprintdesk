import { ref, computed } from 'vue'
import type { Ref } from 'vue'
import type { Task, TaskStatus } from '@/types/task'

export function useTaskFilters(tasks: Ref<Task[]>) {
  const searchQuery = ref('')
  const selectedFilter = ref<TaskStatus | 'all'>('all')
  const filteredTasks = computed(() => {
    const query = searchQuery.value.trim().toLowerCase()
    const searchedTasks = tasks.value.filter((task) => task.title.toLowerCase().includes(query))

    if (selectedFilter.value === 'all') {
      return searchedTasks
    }

    return searchedTasks.filter((task) => task.status === selectedFilter.value)
  })

  function resetFilters() {
    searchQuery.value = ''
    selectedFilter.value = 'all'
  }

  const hasActiveFilters = computed(
    () => searchQuery.value.trim() !== '' || selectedFilter.value !== 'all',
  )

  return {
    searchQuery,
    selectedFilter,
    filteredTasks,
    resetFilters,
    hasActiveFilters,
  }
}
