import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Keeps a render crash from leaving a blank page: shows a short Hebrew notice with a
 * retry action instead. Also used by the search flow, where a failed lookup must never
 * take the whole screen down with it.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled UI error:", error, info.componentStack);
  }

  private reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen bg-gradient-dark flex items-center justify-center p-4" dir="rtl">
        <div className="glass rounded-2xl p-5 max-w-sm w-full text-center">
          <h1 className="text-base font-bold text-foreground mb-1">משהו השתבש בתצוגה</h1>
          <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
            השיר לא נטען כראוי. נסה שוב, ואם זה חוזר – פתח את האפליקציה מחדש.
          </p>
          <button
            type="button"
            onClick={this.reset}
            className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
          >
            נסה שוב
          </button>
        </div>
      </div>
    );
  }
}
