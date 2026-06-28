import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertOctagon, RefreshCw } from 'lucide-react';
import { errorService } from '../services/errorService';

interface Props { children: ReactNode; }
interface State { hasError: boolean; }

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    errorService.log(error, `React Component Tree Crash: ${errorInfo.componentStack}`);
  }

  returnToMatrix = () => {
    window.location.href = '/dashboard';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0d0f12] flex flex-col items-center justify-center p-6 font-mono text-white">
          <div className="max-w-md w-full bg-[#16191e] border-2 border-red-500/30 rounded-xl p-8 shadow-2xl shadow-red-500/5 space-y-6 text-center">
            <div className="inline-flex p-4 bg-red-500/10 border border-red-500/20 rounded-full text-red-500 animate-pulse">
              <AlertOctagon className="w-10 h-10" />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-xl font-bold tracking-widest text-red-500 uppercase">// CRITICAL KERNEL PANIC</h1>
              <p className="text-xs text-gray-400 leading-relaxed">
                The UI rendering pipeline has collapsed. The active cryptographic session memory has been shielded to protect clinical metadata.
              </p>
            </div>

            <button 
              onClick={this.returnToMatrix}
              className="w-full py-3 bg-red-950/20 hover:bg-red-900/40 border border-red-500/50 hover:border-red-500 text-red-400 font-bold rounded-lg uppercase tracking-wider text-xs transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Hot-Reload Terminal
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}