import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    // Optionally log to an external service
    // console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    // Force remount children if a resetKey is provided
    if (this.props.onReset) this.props.onReset();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 m-4 bg-red-50 border border-red-200 rounded-xl">
          <h2 className="text-lg font-semibold text-red-700 mb-2">Something went wrong.</h2>
          {this.props.friendlyMessage ? (
            <p className="text-sm text-red-600 mb-3">{this.props.friendlyMessage}</p>
          ) : null}
          <pre className="text-xs text-red-600 whitespace-pre-wrap overflow-auto mb-3">
            {this.state.error?.toString()}
          </pre>
          <button
            onClick={this.handleRetry}
            className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
