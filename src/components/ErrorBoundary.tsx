import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-ui" style={{ 
          height: '100vh', 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center',
          background: 'white',
          fontFamily: "'Outfit', sans-serif"
        }}>
          <div style={{ 
            fontSize: '64px', 
            marginBottom: '24px' 
          }}>⚠️</div>
          <h1 style={{ 
            fontSize: '24px', 
            fontWeight: 900,
            marginBottom: '12px' 
          }}>Algo salió mal</h1>
          <p style={{ 
            color: 'var(--text-muted)',
            marginBottom: '32px',
            maxWidth: '300px'
          }}>
            Hubo un error inesperado. Estamos trabajando para solucionarlo.
          </p>
          <button 
            onClick={() => window.location.reload()}
            style={{
              padding: '16px 32px',
              background: 'black',
              color: 'white',
              borderRadius: 'var(--radius-md)',
              fontWeight: 800,
              border: 'none'
            }}
          >
            Re intentar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
