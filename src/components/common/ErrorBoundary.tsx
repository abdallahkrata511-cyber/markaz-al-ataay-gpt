import React from 'react';

interface State {
  error: Error | null;
}

/**
 * يمنع انهيار التطبيق بالكامل عند خطأ في شاشة واحدة، ويعرض رسالة عربية مع زر إعادة المحاولة.
 * البيانات المخزنة في SQLite لا تتأثر.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode; resetKey?: string }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('UI error boundary:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="p-6 m-3 rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200 text-sm space-y-3" dir="rtl">
        <p className="font-black">حدث خطأ غير متوقع في هذه الشاشة</p>
        <p className="text-xs opacity-80">بياناتك المحفوظة سليمة ولم تتأثر. يمكنك إعادة المحاولة أو الانتقال لشاشة أخرى.</p>
        <button
          type="button"
          onClick={() => this.setState({ error: null })}
          className="px-4 py-2 rounded-xl bg-red-600 text-white font-bold text-xs"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }
}
