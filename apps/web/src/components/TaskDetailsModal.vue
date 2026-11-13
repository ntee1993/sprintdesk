<template>
  <BaseModal title="Task Details" @close="emit('close')">
    <div class="task-detail-heading">
      <div>
        <span class="detail-id">TASK #{{ task.id }}</span>
        <h3>{{ task.title }}</h3>
      </div>
      <span class="detail-status">{{ task.status.replace('_', ' ') }}</span>
    </div>
    <section class="comments" aria-label="Comments">
      <div class="comments-header">
        <div>
          <p class="comments-kicker">CONVERSATION</p>
          <h3>
            Comments <span>{{ comments.length }}</span>
          </h3>
        </div>
      </div>
      <p v-if="loading" role="status">Loading comments...</p>
      <p v-if="error" role="alert">{{ error }}</p>
      <p v-if="busy" role="status">
        {{ pendingOperation === 'deleting' ? 'Deleting comment...' : 'Saving comment...' }}
      </p>
      <p v-if="!loading && !error && comments.length === 0">No comments yet.</p>
      <ul>
        <li v-for="comment in comments" :key="comment.id" class="comment-row">
          <div class="comment-meta">
            <span class="comment-avatar" aria-hidden="true">{{
              comment.author.name.charAt(0).toUpperCase()
            }}</span
            ><strong>{{ comment.author.name }}</strong>
            <time :datetime="comment.createdAt">{{
              new Date(comment.createdAt).toLocaleString()
            }}</time>
          </div>
          <template v-if="editingId === comment.id">
            <form @submit.prevent="saveEdit(comment.id)">
              <label :for="`edit-comment-${comment.id}`">Edit comment</label>
              <textarea
                :id="`edit-comment-${comment.id}`"
                v-model="editContent"
                maxlength="2000"
                required
              />
              <button type="submit" :disabled="busy || !editContent.trim()">Save comment</button>
              <button type="button" :disabled="busy" @click="editingId = null">Cancel</button>
            </form>
          </template>
          <p v-else>{{ comment.content }}</p>
          <template v-if="comment.authorId === auth.user?.id && editingId !== comment.id">
            <button type="button" :disabled="busy || loading" @click="startEdit(comment)">
              Edit comment
            </button>
            <button type="button" :disabled="busy || loading" @click="remove(comment.id)">
              Delete comment
            </button>
          </template>
        </li>
      </ul>
      <form class="comment-compose" @submit.prevent="create">
        <label for="new-comment">Write a comment</label>
        <textarea
          id="new-comment"
          v-model="content"
          maxlength="2000"
          placeholder="Share an update with your team..."
          required
        />
        <button type="submit" :disabled="busy || loading || !content.trim()">Add comment</button>
      </form>
    </section>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import BaseModal from './BaseModal.vue'
import type { Task } from '@/types/task'
import { useAuthStore } from '@/stores/auth'
import {
  getTaskComments,
  createTaskComment,
  updateTaskComment,
  deleteTaskComment,
  type TaskComment,
} from '@/services/task-comments-api'

const props = defineProps<{ task: Task }>()
const emit = defineEmits<{ close: [] }>()
const auth = useAuthStore()
const comments = ref<TaskComment[]>([])
const loading = ref(false)
const pendingOperation = ref<'saving' | 'deleting' | null>(null)
const busy = computed(() => pendingOperation.value !== null)
const error = ref<string | null>(null)
const content = ref('')
const editingId = ref<number | null>(null)
const editContent = ref('')
let generation = 0
let nextTemporaryId = -1

watch(
  () => props.task.id,
  async (taskId) => {
    const current = ++generation
    comments.value = []
    error.value = null
    content.value = ''
    editingId.value = null
    pendingOperation.value = null
    loading.value = true
    try {
      const result = await getTaskComments(taskId)
      if (current === generation)
        comments.value = [...result].sort(
          (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id,
        )
    } catch (err) {
      if (current === generation)
        error.value = err instanceof Error ? err.message : 'Failed to load comments'
    } finally {
      if (current === generation) loading.value = false
    }
  },
  { immediate: true, flush: 'sync' },
)

watch(
  () => auth.sessionGeneration,
  () => {
    generation++
    comments.value = []
    content.value = ''
    editingId.value = null
    error.value = null
    loading.value = false
    pendingOperation.value = null
    emit('close')
  },
  { flush: 'sync' },
)
onBeforeUnmount(() => {
  generation++
})

async function create() {
  const text = content.value.trim()
  const user = auth.user
  if (!text || busy.value || loading.value || !user) return
  const current = generation
  const taskId = props.task.id
  const temporaryId = nextTemporaryId--
  const now = new Date().toISOString()
  const temporary: TaskComment = {
    id: temporaryId,
    taskId,
    authorId: user.id,
    author: { id: user.id, name: user.name },
    content: text,
    createdAt: now,
    updatedAt: now,
  }
  pendingOperation.value = 'saving'
  error.value = null
  comments.value = [...comments.value, temporary]
  try {
    const result = await createTaskComment(taskId, text)
    if (current === generation) {
      comments.value = comments.value
        .map((comment) => (comment.id === temporaryId ? result : comment))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id)
      if (content.value.trim() === text) content.value = ''
    }
  } catch (err) {
    if (current === generation) {
      comments.value = comments.value.filter((comment) => comment.id !== temporaryId)
      error.value = err instanceof Error ? err.message : 'Failed to create comment'
    }
  } finally {
    if (current === generation) pendingOperation.value = null
  }
}

function startEdit(comment: TaskComment) {
  editingId.value = comment.id
  editContent.value = comment.content
}
async function saveEdit(commentId: number) {
  const draft = editContent.value
  const text = draft.trim()
  const existing = comments.value.find((comment) => comment.id === commentId)
  if (!text || !existing || busy.value || loading.value) return
  const current = generation
  const previousContent = existing.content
  pendingOperation.value = 'saving'
  error.value = null
  comments.value = comments.value.map((comment) =>
    comment.id === commentId ? { ...comment, content: text } : comment,
  )
  editingId.value = null
  try {
    const updated = await updateTaskComment(props.task.id, commentId, text)
    if (current === generation) {
      comments.value = comments.value.map((comment) =>
        comment.id === commentId ? updated : comment,
      )
    }
  } catch (err) {
    if (current === generation) {
      comments.value = comments.value.map((comment) =>
        comment.id === commentId && comment.content === text
          ? { ...comment, content: previousContent }
          : comment,
      )
      if (comments.value.some((comment) => comment.id === commentId)) {
        editingId.value = commentId
        editContent.value = draft
      }
      error.value = err instanceof Error ? err.message : 'Failed to update comment'
    }
  } finally {
    if (current === generation) pendingOperation.value = null
  }
}

async function remove(commentId: number) {
  if (busy.value || loading.value) return
  const index = comments.value.findIndex((comment) => comment.id === commentId)
  const removed = comments.value[index]
  if (!removed) return
  const current = generation
  pendingOperation.value = 'deleting'
  error.value = null
  comments.value = comments.value.filter((comment) => comment.id !== commentId)
  try {
    await deleteTaskComment(props.task.id, commentId)
  } catch (err) {
    if (current === generation) {
      if (!comments.value.some((comment) => comment.id === commentId)) {
        const restored = [...comments.value]
        restored.splice(Math.min(index, restored.length), 0, removed)
        comments.value = restored
      }
      error.value = err instanceof Error ? err.message : 'Failed to delete comment'
    }
  } finally {
    if (current === generation) pendingOperation.value = null
  }
}
</script>

<style scoped>
.task-detail-heading {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 16px;
}
.task-detail-heading h3 {
  margin: 5px 0 0;
  font-size: 20px;
  overflow-wrap: anywhere;
}
.detail-id,
.comments-kicker {
  font-size: 10px;
  letter-spacing: 0.1em;
  font-weight: 750;
  color: var(--color-muted);
}
.detail-status {
  flex: none;
  padding: 5px 10px;
  border-radius: 999px;
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: 12px;
  text-transform: capitalize;
}
.comments {
  border-top: 1px solid var(--color-border);
  padding-top: 18px;
}
.comments-header h3 {
  margin: 2px 0;
  font-size: 16px;
}
.comments-header h3 span {
  color: var(--color-muted);
  font-size: 12px;
}
.comments-kicker {
  margin: 0;
}
.comments ul {
  margin: 8px 0 18px;
}
.comment-row {
  overflow-wrap: anywhere;
}
.comment-meta {
  display: flex;
  align-items: center;
  gap: 9px;
}
.comment-meta time {
  margin-left: auto;
}
.comment-avatar {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  flex: none;
  border-radius: 10px;
  color: var(--color-primary);
  background: var(--color-primary-soft);
  font-size: 12px;
  font-weight: 700;
}
.comment-row p {
  margin: 8px 0 8px 41px;
  white-space: pre-wrap;
}
.comment-row button {
  margin: 0 6px 3px 0;
  font-size: 12px;
}
.comment-compose {
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
}
.comment-compose textarea {
  width: 100%;
  max-width: none;
  min-height: 90px;
}
.comment-compose button {
  align-self: flex-end;
}
@media (max-width: 480px) {
  .task-detail-heading {
    flex-wrap: wrap;
  }
  .comment-meta {
    flex-wrap: wrap;
  }
  .comment-meta time {
    flex-basis: 100%;
    margin-left: 41px;
  }
}
</style>
