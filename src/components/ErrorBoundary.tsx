import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error?: Error; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="text-center p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Something went wrong</h2>
            <button onClick={() => window.location.reload()} className="px-4 py-2 bg-brand-green text-white rounded-md text-sm font-medium hover:bg-brand-darkgreen">Reload Page</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
