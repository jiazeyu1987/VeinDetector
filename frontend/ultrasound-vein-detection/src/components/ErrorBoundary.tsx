import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorInfo {
  componentStack: string;
}

const serializeError = (error: any): string => {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}\n${error.stack || ''}`;
  }
  return JSON.stringify(error, null, 2);
};

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<
  { 
    children: React.ReactNode;
    fallback?: React.ComponentType<{ error: Error; retry: () => void }>;
  },
  ErrorBoundaryState
> {
  constructor(props: { 
    children: React.ReactNode;
    fallback?: React.ComponentType<{ error: Error; retry: () => void }>;
  }) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleRetry = () => {
    this.setState({ 
      hasError: false, 
      error: null,
      errorInfo: null 
    });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // 使用自定义fallback组件（如果提供）
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error} retry={this.handleRetry} />;
      }

      // 默认错误界面
      return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
          <div className="bg-gray-800 border border-red-500 rounded-lg p-8 max-w-4xl w-full">
            {/* 错误图标和标题 */}
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-3 bg-red-500 bg-opacity-20 rounded-full">
                <AlertTriangle size={24} className="text-red-400" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-white">
                  应用遇到了一个错误
                </h1>
                <p className="text-gray-400 text-sm mt-1">
                  很抱歉，应用程序遇到了意外错误。请尝试刷新页面或联系技术支持。
                </p>
              </div>
            </div>

            {/* 错误详情 */}
            <div className="bg-gray-900 rounded-lg p-4 mb-6">
              <h3 className="text-white font-medium mb-3">错误详情：</h3>
              <div className="bg-gray-950 rounded p-3 overflow-auto max-h-60">
                <pre className="text-red-400 text-sm font-mono whitespace-pre-wrap">
                  {serializeError(this.state.error)}
                </pre>
              </div>
            </div>

            {/* 组件堆栈（开发环境） */}
            {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
              <div className="bg-gray-900 rounded-lg p-4 mb-6">
                <h3 className="text-white font-medium mb-3">组件堆栈：</h3>
                <div className="bg-gray-950 rounded p-3 overflow-auto max-h-40">
                  <pre className="text-gray-400 text-xs font-mono whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </div>
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex items-center space-x-4">
              <button
                onClick={this.handleRetry}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center space-x-2 transition-colors"
              >
                <RefreshCw size={16} />
                <span>重试</span>
              </button>
              
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
              >
                刷新页面
              </button>

              <button
                onClick={() => {
                  const errorDetails = {
                    error: serializeError(this.state.error),
                    componentStack: this.state.errorInfo?.componentStack,
                    userAgent: navigator.userAgent,
                    timestamp: new Date().toISOString(),
                  };
                  console.error('Error Report:', errorDetails);
                  alert('错误信息已记录到控制台');
                }}
                className="px-6 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
              >
                报告错误
              </button>
            </div>

            {/* 帮助信息 */}
            <div className="mt-6 pt-6 border-t border-gray-700">
              <h4 className="text-white font-medium mb-2">需要帮助？</h4>
              <div className="text-sm text-gray-400 space-y-1">
                <p>• 检查控制台是否有详细的错误信息</p>
                <p>• 确保您的浏览器版本是最新的</p>
                <p>• 尝试清除浏览器缓存后重新访问</p>
                <p>• 如果问题持续存在，请联系技术支持</p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;