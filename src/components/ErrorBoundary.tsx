import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'An unexpected system error occurred.',
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Application ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#09090B] text-[#F4F4F0] flex items-center justify-center p-6">
          <div className="max-w-lg w-full rounded-[22px] bg-[#131316] border border-white/15 p-6 space-y-4">
            <div className="font-mono text-xs text-[#E8452C]">SYSTEM RECOVERY</div>
            <h1 className="text-xl font-semibold">Something interrupted the cockpit view.</h1>
            <p className="text-sm text-[#A1A1AA] break-words">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="min-h-[42px] px-4 py-2 rounded-[10px] bg-[#E8452C] hover:bg-[#D53A22] text-white text-sm font-semibold cursor-pointer"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
