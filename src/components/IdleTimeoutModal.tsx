import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const COUNTDOWN_SECONDS = 10;

const ACTIVITY_EVENTS: (keyof DocumentEventMap)[] = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "click",
];

const IdleTimeoutModal = () => {
  const { user, signOut } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clear all timers
  const clearAllTimers = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  // Start the idle timer (30 min)
  const resetIdleTimer = useCallback(() => {
    if (!user) return;

    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }

    idleTimerRef.current = setTimeout(() => {
      // 30 minutes of inactivity — show warning modal
      setShowModal(true);
      setCountdown(COUNTDOWN_SECONDS);
    }, IDLE_TIMEOUT_MS);
  }, [user]);

  // Handle "Keep My Session"
  const handleKeepSession = useCallback(() => {
    setShowModal(false);
    setCountdown(COUNTDOWN_SECONDS);
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    resetIdleTimer();
  }, [resetIdleTimer]);

  // Handle "Okay" (logout now)
  const handleLogout = useCallback(async () => {
    clearAllTimers();
    setShowModal(false);
    await signOut();
  }, [clearAllTimers, signOut]);

  // Countdown logic once modal opens
  useEffect(() => {
    if (!showModal) return;

    countdownTimerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Time's up — force logout
          clearInterval(countdownTimerRef.current!);
          countdownTimerRef.current = null;
          handleLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    };
  }, [showModal, handleLogout]);

  // Register activity listeners when user is logged in
  useEffect(() => {
    if (!user) {
      clearAllTimers();
      setShowModal(false);
      return;
    }

    const onActivity = () => {
      // Only reset if the warning modal is NOT showing
      if (!showModal) {
        resetIdleTimer();
      }
    };

    ACTIVITY_EVENTS.forEach((event) => {
      document.addEventListener(event, onActivity, { passive: true });
    });

    // Start the initial idle timer
    resetIdleTimer();

    return () => {
      ACTIVITY_EVENTS.forEach((event) => {
        document.removeEventListener(event, onActivity);
      });
      clearAllTimers();
    };
  }, [user, showModal, resetIdleTimer, clearAllTimers]);

  // Don't render anything if user is not logged in or modal is hidden
  if (!user || !showModal) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* Warning icon */}
        <div style={styles.iconWrapper}>
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: "#E65100" }}
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 12 12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <h2 style={styles.title}>Session Timeout</h2>
        <p style={styles.message}>
          You've been inactive for a while. Your session will automatically log
          out in
        </p>

        {/* Countdown circle */}
        <div style={styles.countdownContainer}>
          <svg width="90" height="90" viewBox="0 0 90 90" style={styles.countdownSvg}>
            <circle
              cx="45"
              cy="45"
              r="38"
              fill="none"
              stroke="hsl(124 55% 24% / 0.12)"
              strokeWidth="5"
            />
            <circle
              cx="45"
              cy="45"
              r="38"
              fill="none"
              stroke="hsl(124, 55%, 24%)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 38}`}
              strokeDashoffset={`${
                2 * Math.PI * 38 * (1 - countdown / COUNTDOWN_SECONDS)
              }`}
              style={{
                transition: "stroke-dashoffset 1s linear",
                transform: "rotate(-90deg)",
                transformOrigin: "center",
              }}
            />
          </svg>
          <span style={styles.countdownNumber}>{countdown}</span>
          <span style={styles.countdownLabel}>seconds</span>
        </div>

        {/* Buttons */}
        <div style={styles.buttonRow}>
          <button
            onClick={handleKeepSession}
            style={styles.keepButton}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow =
                "0 6px 20px hsl(124 55% 24% / 0.35)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow =
                "0 2px 10px hsl(124 55% 24% / 0.25)";
            }}
          >
            Keep My Session
          </button>
          <button
            onClick={handleLogout}
            style={styles.okayButton}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "hsl(0 0% 92%)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "hsl(0 0% 96%)";
            }}
          >
            Okay
          </button>
        </div>
      </div>
    </div>
  );
};

/* ---------- inline styles ---------- */
const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 99999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0, 0, 0, 0.55)",
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
    animation: "fadeInOverlay 0.25s ease-out",
  },
  modal: {
    background: "#fff",
    borderRadius: "1rem",
    padding: "2rem 2rem 1.75rem",
    maxWidth: "380px",
    width: "90%",
    textAlign: "center",
    boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
    animation: "slideUpModal 0.3s ease-out",
  },
  iconWrapper: {
    marginBottom: "0.75rem",
  },
  title: {
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontSize: "1.25rem",
    fontWeight: 700,
    color: "hsl(216, 28%, 14%)",
    margin: "0 0 0.5rem",
  },
  message: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: "0.9rem",
    color: "hsl(215, 14%, 46%)",
    lineHeight: 1.5,
    margin: "0 0 1.25rem",
  },
  countdownContainer: {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "1.5rem",
    width: "90px",
    height: "90px",
  },
  countdownSvg: {
    position: "absolute",
    inset: 0,
  },
  countdownNumber: {
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontSize: "1.75rem",
    fontWeight: 800,
    color: "hsl(124, 55%, 24%)",
    lineHeight: 1,
    position: "relative",
    top: "-4px",
  },
  countdownLabel: {
    position: "absolute",
    bottom: "18px",
    fontFamily: "'DM Sans', sans-serif",
    fontSize: "0.65rem",
    color: "hsl(215, 14%, 46%)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  buttonRow: {
    display: "flex",
    gap: "0.75rem",
    justifyContent: "center",
  },
  keepButton: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: "0.875rem",
    fontWeight: 600,
    padding: "0.65rem 1.5rem",
    borderRadius: "0.5rem",
    border: "none",
    cursor: "pointer",
    background: "hsl(124, 55%, 24%)",
    color: "#fff",
    boxShadow: "0 2px 10px hsl(124 55% 24% / 0.25)",
    transition: "all 0.2s ease",
  },
  okayButton: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: "0.875rem",
    fontWeight: 600,
    padding: "0.65rem 1.5rem",
    borderRadius: "0.5rem",
    border: "1px solid hsl(214, 20%, 90%)",
    cursor: "pointer",
    background: "hsl(0, 0%, 96%)",
    color: "hsl(216, 28%, 14%)",
    transition: "all 0.2s ease",
  },
};

/* Inject keyframe animations */
if (typeof document !== "undefined") {
  const styleTag = document.createElement("style");
  styleTag.textContent = `
    @keyframes fadeInOverlay {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes slideUpModal {
      from { opacity: 0; transform: translateY(20px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
  `;
  document.head.appendChild(styleTag);
}

export default IdleTimeoutModal;
