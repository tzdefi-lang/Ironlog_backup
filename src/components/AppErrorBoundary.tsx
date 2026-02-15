import React from 'react';

type AppErrorBoundaryProps = {
  children: React.ReactNode;
};

type AppErrorBoundaryState = {
  error: Error | null;
};

class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[IronLog] Uncaught render error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors p-6">
          <div className="mx-auto max-w-md rounded-3xl border border-brand bg-brand-tint p-5">
            <h1 className="text-lg font-semibold">App crashed unexpectedly</h1>
            <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
              IronLog hit a runtime error. Reload to recover.
            </p>
            <p className="mt-2 text-xs text-brand break-words">
              {this.state.error.message}
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="mt-4 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-gray-900 hover:brightness-95"
            >
              Reload app
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AppErrorBoundary;
