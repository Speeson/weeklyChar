import { Component, type ReactNode } from "react";

type PageErrorBoundaryProps = {
  children: ReactNode;
  detail: string;
  onRecover: () => void;
  recoverLabel: string;
  resetKey: string;
  title: string;
};

type PageErrorBoundaryState = {
  failed: boolean;
};

export class PageErrorBoundary extends Component<PageErrorBoundaryProps, PageErrorBoundaryState> {
  state: PageErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): PageErrorBoundaryState {
    return { failed: true };
  }

  componentDidUpdate(previous: PageErrorBoundaryProps): void {
    if (previous.resetKey !== this.props.resetKey && this.state.failed) {
      this.setState({ failed: false });
    }
  }

  private recover = () => {
    this.setState({ failed: false });
    this.props.onRecover();
  };

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section className="ks-page-error" role="alert">
        <div>
          <strong>{this.props.title}</strong>
          <p>{this.props.detail}</p>
          <button onClick={this.recover} type="button">{this.props.recoverLabel}</button>
        </div>
      </section>
    );
  }
}
