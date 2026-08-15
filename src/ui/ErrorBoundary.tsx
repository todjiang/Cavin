import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/** Last-resort guard: a render throw in any overlay must not white-screen the canvas. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[cavin] render error', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error-boundary">
          <div className="error-boundary-title">Something went wrong rendering the board</div>
          <div className="error-boundary-msg">{this.state.error.message}</div>
          <button className="hud-button" onClick={() => this.setState({ error: null })}>
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
