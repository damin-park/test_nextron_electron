/**
 * 렌더러 전역 ErrorBoundary.
 * 하위 트리에서 렌더 중 예외가 발생해도 전체 화면이 블랭크가 되지 않도록
 * 에러 메시지를 표시한다. (React 19 는 미처리 렌더 에러 시 root 를 언마운트한다)
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // 개발 중 콘솔에서 원인 추적이 가능하도록 로깅한다.
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, message: '' });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-boundary__title">
            화면 렌더링 중 오류가 발생했습니다
          </div>
          <div className="error-boundary__message">{this.state.message}</div>
          <button
            type="button"
            className="error-boundary__retry"
            onClick={this.handleReset}
          >
            다시 시도
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
