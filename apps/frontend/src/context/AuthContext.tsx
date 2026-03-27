import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { api, setAuthToken } from '../lib/api';

// ─── Idle session configuration ───────────────────────────────────────────────
// Adjust these constants to change the inactivity thresholds.
const IDLE_TIMEOUT_MS       = 15 * 60 * 1000; // 15 min without interaction → show warning
const IDLE_WARNING_DURATION = 2  * 60;         // seconds to respond before auto-logout

// DOM events that count as user activity
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'] as const;

// ─── Types ────────────────────────────────────────────────────────────────────
interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  organizationId: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ requiresOtp: true; tempToken: string } | void>;
  loginWithOtp: (tempToken: string, otpToken: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();

  const [user, setUser]                         = useState<User | null>(null);
  const [sessionExpired, setSessionExpired]     = useState(false);
  const [expiredCountdown, setExpiredCountdown] = useState(3);
  const [idleWarning, setIdleWarning]           = useState(false);
  const [idleCountdown, setIdleCountdown]       = useState(IDLE_WARNING_DURATION);

  const idleTimerRef    = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const countdownRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const expiredTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const clearIdleTimers = useCallback(() => {
    if (idleTimerRef.current)  { clearTimeout(idleTimerRef.current);    idleTimerRef.current  = null; }
    if (countdownRef.current)  { clearInterval(countdownRef.current);   countdownRef.current  = null; }
  }, []);

  const performLogout = useCallback(() => {
    clearIdleTimers();
    if (expiredTimerRef.current) { clearInterval(expiredTimerRef.current); expiredTimerRef.current = null; }
    setAuthToken(null);
    setUser(null);
    setIdleWarning(false);
    setSessionExpired(false);
  }, [clearIdleTimers]);

  // ── Idle: start the 2-minute countdown after inactivity ───────────────────
  const startIdleCountdown = useCallback(() => {
    setIdleCountdown(IDLE_WARNING_DURATION);
    let remaining = IDLE_WARNING_DURATION;
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      setIdleCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(countdownRef.current!);
        countdownRef.current = null;
        setIdleWarning(false);
        performLogout();
        window.location.href = '/login';
      }
    }, 1000);
  }, [performLogout]);

  // ── Schedule the idle warning after IDLE_TIMEOUT_MS of silence ────────────
  const scheduleIdleWarning = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      setIdleWarning(true);
      startIdleCountdown();
    }, IDLE_TIMEOUT_MS);
  }, [startIdleCountdown]);

  // ── Reset idle timer whenever the user does something ─────────────────────
  const resetIdleTimer = useCallback(() => {
    if (countdownRef.current) {
      // Warning was showing — user came back, dismiss it
      clearInterval(countdownRef.current);
      countdownRef.current = null;
      setIdleWarning(false);
    }
    scheduleIdleWarning();
  }, [scheduleIdleWarning]);

  // ── Attach / detach activity listeners when auth state changes ────────────
  useEffect(() => {
    if (!user) {
      clearIdleTimers();
      ACTIVITY_EVENTS.forEach(ev => window.removeEventListener(ev, resetIdleTimer));
      return;
    }

    scheduleIdleWarning();
    ACTIVITY_EVENTS.forEach(ev =>
      window.addEventListener(ev, resetIdleTimer, { passive: true })
    );

    return () => {
      clearIdleTimers();
      ACTIVITY_EVENTS.forEach(ev => window.removeEventListener(ev, resetIdleTimer));
    };
  }, [user, scheduleIdleWarning, resetIdleTimer, clearIdleTimers]);

  // ── Listen for 401 events dispatched by api.ts ────────────────────────────
  useEffect(() => {
    const handler = () => {
      if (sessionExpired) return;
      clearIdleTimers();
      setIdleWarning(false);
      setUser(null);
      setExpiredCountdown(3);
      setSessionExpired(true);

      let seconds = 3;
      expiredTimerRef.current = setInterval(() => {
        seconds -= 1;
        setExpiredCountdown(seconds);
        if (seconds <= 0) {
          clearInterval(expiredTimerRef.current!);
          expiredTimerRef.current = null;
          setSessionExpired(false);
          window.location.href = '/login';
        }
      }, 1000);
    };

    window.addEventListener('rentcrm:session-expired', handler);
    return () => window.removeEventListener('rentcrm:session-expired', handler);
  }, [sessionExpired, clearIdleTimers]);

  // ── Auth actions ───────────────────────────────────────────────────────────
  const login = async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    if (data.requiresOtp) {
      return { requiresOtp: true as const, tempToken: data.tempToken };
    }
    setAuthToken(data.accessToken);
    setUser(data.user);
  };

  const loginWithOtp = async (tempToken: string, otpToken: string) => {
    const { data } = await api.post('/auth/otp/validate', { tempToken, otpToken });
    setAuthToken(data.accessToken);
    setUser(data.user);
  };

  const logout = useCallback(() => {
    performLogout();
    window.location.href = '/login';
  }, [performLogout]);

  const continueSession = useCallback(() => {
    clearIdleTimers();
    setIdleWarning(false);
    scheduleIdleWarning();
  }, [clearIdleTimers, scheduleIdleWarning]);

  const loginNow = useCallback(() => {
    if (expiredTimerRef.current) { clearInterval(expiredTimerRef.current); expiredTimerRef.current = null; }
    setSessionExpired(false);
    window.location.href = '/login';
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <AuthContext.Provider value={{ user, login, loginWithOtp, logout, isAuthenticated: !!user }}>
      {children}

      {/* ── Session Expired modal ────────────────────────────────────────── */}
      {sessionExpired && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
            <div className="text-4xl mb-4">🔒</div>
            <h2 className="text-xl font-bold text-white mb-2">
              {t('session.expiredTitle')}
            </h2>
            <p className="text-slate-300 text-sm mb-4">
              {t('session.expiredMessage')}
            </p>
            <p className="text-slate-400 text-xs mb-6">
              {t('session.redirecting', { seconds: expiredCountdown })}
            </p>
            <button
              onClick={loginNow}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-xl transition-colors"
            >
              {t('session.loginAgain')}
            </button>
          </div>
        </div>
      )}

      {/* ── Idle Warning modal ───────────────────────────────────────────── */}
      {idleWarning && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
            <div className="text-4xl mb-4">⏱️</div>
            <h2 className="text-xl font-bold text-white mb-2">
              {t('session.idleTitle')}
            </h2>
            <p className="text-slate-300 text-sm mb-3">
              {t('session.idleMessage')}
            </p>
            <p className="text-amber-400 text-sm font-medium mb-6">
              {t('session.idleCountdown', { seconds: idleCountdown })}
            </p>
            <div className="flex gap-3">
              <button
                onClick={continueSession}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-xl transition-colors"
              >
                {t('session.continueSession')}
              </button>
              <button
                onClick={logout}
                className="flex-1 bg-slate-600 hover:bg-slate-500 text-white font-medium py-2.5 rounded-xl transition-colors"
              >
                {t('session.logoutNow')}
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
