import { Component, type ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'

interface Props { children: ReactNode }
interface State { error: Error | null; retryKey: number }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, retryKey: 0 }
  static getDerivedStateFromError(error: Error): Partial<State> { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <p className="text-lg font-semibold text-gray-700 dark:text-white">Etwas ist schiefgelaufen</p>
          <p className="max-w-sm text-sm text-gray-400">{this.state.error.message}</p>
          <button
            onClick={() => this.setState((s) => ({ error: null, retryKey: s.retryKey + 1 }))}
            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
          >
            <RefreshCw size={16} /> Erneut versuchen
          </button>
        </div>
      )
    }
    return <div key={this.state.retryKey}>{this.props.children}</div>
  }
}
