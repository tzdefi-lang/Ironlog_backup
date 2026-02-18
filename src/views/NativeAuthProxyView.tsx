import React, { useEffect, useRef, useState } from 'react';
import { getIdentityToken, usePrivy } from '@privy-io/react-auth';

declare global {
  interface Window {
    __privyCallback?: (accessToken: string) => void;
    webkit?: {
      messageHandlers?: {
        privyToken?: {
          postMessage?: (accessToken: string) => void;
        };
      };
    };
  }
}

const NativeAuthProxyView: React.FC = () => {
  const { ready, authenticated, login, getAccessToken } = usePrivy();
  const [status, setStatus] = useState('Initializing Privy...');
  const [error, setError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const hasSentTokenRef = useRef(false);

  useEffect(() => {
    if (!ready) {
      setStatus('Initializing Privy...');
      return;
    }
    if (!authenticated) {
      setStatus('Ready to sign in.');
      return;
    }
    if (hasSentTokenRef.current) {
      setStatus('Authentication complete. You can close this page.');
      return;
    }

    let cancelled = false;

    const sendTokenToNative = async () => {
      setStatus('Retrieving secure token...');
      setError(null);

      const attempts = 8;
      let token: string | null = null;
      let lastError: unknown = null;

      for (let i = 0; i < attempts; i++) {
        if (cancelled) return;
        setStatus(`Retrieving secure token... (${i + 1}/${attempts})`);

        const identityToken = await getIdentityToken().catch((err) => {
          lastError = err;
          return null;
        });
        const accessToken = await getAccessToken().catch((err) => {
          lastError = err;
          return null;
        });

        token = identityToken ?? accessToken;
        if (token) break;
        await new Promise((resolve) => setTimeout(resolve, 300 * (i + 1)));
      }

      if (!token) {
        if (!cancelled) {
          const reason =
            lastError instanceof Error && lastError.message
              ? ` (${lastError.message})`
              : '';
          setError(`Failed to retrieve Privy token${reason}. Please retry sign-in.`);
          setStatus('Token unavailable.');
        }
        return;
      }

      const callback = window.__privyCallback;
      if (typeof callback === 'function') {
        callback(token);
        hasSentTokenRef.current = true;
        if (!cancelled) {
          setStatus('Token sent to iOS app. Returning...');
        }
        return;
      }

      const handler = window.webkit?.messageHandlers?.privyToken?.postMessage;
      if (typeof handler === 'function') {
        handler(token);
        hasSentTokenRef.current = true;
        if (!cancelled) {
          setStatus('Token sent to iOS app. Returning...');
        }
        return;
      }

      if (!cancelled) {
        setError('Native callback not found. Open this page from the iOS app.');
        setStatus('Waiting for native bridge...');
      }
    };

    void sendTokenToNative();

    return () => {
      cancelled = true;
    };
  }, [authenticated, getAccessToken, ready]);

  const handleLogin = async () => {
    setError(null);
    setIsLoggingIn(true);
    setStatus('Opening Privy sign-in...');
    try {
      await login();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Privy login failed';
      setError(message);
      setStatus('Sign-in failed.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[var(--app-bg)] dark:bg-[var(--app-bg)] px-8 pt-[calc(2rem+var(--standalone-safe-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))] transition-colors">
      <div className="flex-1 flex flex-col justify-center min-h-0">
        <div className="pt-4 space-y-3 text-center">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-gray-900 dark:text-gray-100 display-serif">
            IronLog
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">iOS Secure Sign-in Bridge</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">{status}</p>
          {error && (
            <div className="mx-auto w-full max-w-xs rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[11px] text-red-600 text-center">
              {error}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col items-center w-full gap-4 shrink-0">
        <button
          onClick={handleLogin}
          disabled={isLoggingIn}
          className="pressable w-full bg-brand text-[var(--botanical-text)] py-4 rounded-3xl font-semibold text-lg shadow-[var(--surface-shadow-strong)] active:scale-[0.98] transition-all duration-500 ease-out hover:brightness-95"
        >
          {isLoggingIn
            ? 'Opening...'
            : authenticated
              ? 'Re-authenticate with Privy'
              : 'Sign in with Privy'}
        </button>
      </div>
    </div>
  );
};

export default NativeAuthProxyView;
