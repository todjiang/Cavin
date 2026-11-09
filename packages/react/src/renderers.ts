import type { ReactNode } from 'react'
import type { CavinNode, FieldDescriptor } from '@cavin/core'

/**
 * Renderer slots: the composition seam a host uses to replace pieces of the
 * generated UI without forking the components. Pass `renderers` to
 * CavinCanvas; anything left unset falls back to the built-in
 * implementation.
 */
export interface FieldRenderProps<TAttr = unknown> {
  field: FieldDescriptor
  node: CavinNode<TAttr>
  value: unknown
  onChange: (value: unknown) => void
}

export interface CavinRenderers<TAttr = unknown> {
  /**
   * Replace the detail-form control for a field. Receives the field
   * descriptor, the node's current value and an onChange that patches the
   * node — so a host can render a date picker, a select, or a rich editor
   * in place of the generated input.
   */
  field?: (props: FieldRenderProps<TAttr>) => ReactNode
}
