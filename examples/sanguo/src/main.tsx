import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CavinCanvas } from '@cavin/react'
import { sanguoAdapter } from './adapter'
import { buildSanguoWorld } from './app-data'

const { nodes, confirmedEdges } = buildSanguoWorld()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CavinCanvas
      adapter={sanguoAdapter}
      initialNodes={nodes}
      initialEdges={confirmedEdges}
      title="三国 sanguo"
    />
  </StrictMode>,
)
