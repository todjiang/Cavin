import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CavinCanvas } from '@cavin/react'
import type { TaskAttrs } from './adapter'
import { createMemoryCavinStorage } from '@cavin/core'
import { taskAdapter, seedTasks } from './adapter'

// No localStorage: the task board lives in memory for the tab's lifetime
// (two instances on one page would each get their own world).
const storage = createMemoryCavinStorage<TaskAttrs>()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CavinCanvas adapter={taskAdapter} storage={storage} initialNodes={seedTasks()} title="flat tasks" />
  </StrictMode>,
)
