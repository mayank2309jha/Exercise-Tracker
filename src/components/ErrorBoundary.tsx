import { Component, type ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div role="alert" className="rounded-2xl border border-red-800/60 bg-red-950/30 p-6 text-sm text-red-200">
          <h2 className="mb-2 text-base font-semibold">Something went wrong on this page</h2>
          <p className="mb-4 text-red-200/80">Your saved data is untouched. Try reloading, or export a backup from Settings.</p>
          <pre className="mb-4 overflow-x-auto rounded-lg bg-black/30 p-3 text-xs">{this.state.error.message}</pre>
          <button type="button" onClick={() => this.setState({ error: null })} className="rounded-xl border border-red-700 px-3 py-2 text-sm hover:bg-red-900/40">
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
