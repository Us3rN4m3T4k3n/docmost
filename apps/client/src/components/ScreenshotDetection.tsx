import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import api from '@/lib/api-client';
import { logout } from '@/features/auth/services/auth-service';
import './ScreenshotDetection.css';

interface ScreenshotDetectionProps {
  children: React.ReactNode;
  protected: boolean;
}

interface ScreenshotAttempt {
  count: number;
  lastAttempt: Date;
  severity: 'warning' | 'final_warning' | 'suspended';
}

// Log screenshot attempt to backend
const logScreenshotAttempt = async (method: string, details?: string) => {
  try {
    const response = await api.post('/api/security/screenshot-attempt', {
      method,
      details,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
    });
    return response.data;
  } catch (error) {
    console.error('Failed to log screenshot attempt:', error);
    return null;
  }
};

export const ScreenshotDetection: React.FC<ScreenshotDetectionProps> = ({ children, protected: isProtected }) => {
  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState<{
    title: string;
    message: string;
    severity: 'warning' | 'final_warning' | 'suspended';
  } | null>(null);
  const [attemptCount, setAttemptCount] = useState(0);
  const lastDetectionTime = useRef<number>(0);
  const visibilityChangeCount = useRef<number>(0);
  const suspiciousActivityTimer = useRef<NodeJS.Timeout | null>(null);

  // Show warning modal with appropriate message based on attempt count
  const showScreenshotWarning = useCallback(async (method: string) => {
    // Prevent duplicate detections within 2 seconds
    const now = Date.now();
    if (now - lastDetectionTime.current < 2000) {
      return;
    }
    lastDetectionTime.current = now;

    // Increment count locally first (don't wait for API)
    const localCount = attemptCount + 1;
    setAttemptCount(localCount);

    // Try to log to backend (but don't fail if it doesn't work)
    try {
      const response = await logScreenshotAttempt(method);
      if (response?.attemptCount) {
        setAttemptCount(response.attemptCount);
      }
    } catch (error) {
      console.warn('[ScreenshotDetection] Failed to log to backend, using local count');
      // Continue with local count
    }

    const count = localCount;

    let message;
    if (count === 1) {
      // First offense - friendly warning
      message = {
        title: '⚠️ Screenshot Detected',
        message: `This is a friendly reminder that screenshots are not allowed.

This action is being logged and reported to admins.

Further attempts will escalate and get your account suspended.`,
        severity: 'warning' as const,
      };
    } else if (count === 2) {
      // Second offense - stern warning
      message = {
        title: '⚠️ Second Screenshot Detected',
        message: `This is your FINAL WARNING.

Admins have been notified.

Further attempt will get your account suspended with no right to appeal.

No refund will be given.`,
        severity: 'final_warning' as const,
      };
    } else if (count >= 3) {
      // Third offense - account action
      message = {
        title: '🚫 Account Suspended',
        message: `Access revoked immediately.`,
        severity: 'suspended' as const,
      };
    }

    setWarningMessage(message!);
    setShowWarning(true);
  }, [attemptCount]);

  // Method 1: Detect common screenshot keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const isWindows = navigator.platform.toUpperCase().indexOf('WIN') >= 0;

    // Mac screenshot shortcuts: Cmd+Shift+3, Cmd+Shift+4, Cmd+Shift+5, Cmd+Shift+6
    // NOTE: Mac screenshots happen at OS level - we can detect but NOT prevent them
    if (isMac && e.metaKey && e.shiftKey) {
      // Check using multiple methods for reliability
      const key = e.key || '';
      const code = e.code || '';
      const keyCode = e.keyCode || 0;

      // Screenshot keys: 3 (full screen), 4 (selection), 5 (screenshot app), 6 (Touch Bar if available)
      // Also check for shifted variants that some keyboard layouts produce
      const isScreenshotKey =
        // Check key value (most reliable)
        ['3', '4', '5', '6'].includes(key) ||
        // Check shifted symbols that might appear on some keyboards
        ['#', '$', '%', '^', '£', '¢', '∞', '§'].includes(key) ||
        // Check code (fallback)
        ['Digit3', 'Digit4', 'Digit5', 'Digit6'].includes(code) ||
        // Check keyCode (final fallback)
        [51, 52, 53, 54].includes(keyCode);

      if (isScreenshotKey) {
        console.log('[ScreenshotDetection] 🚨 macOS screenshot detected:', {
          key,
          code,
          keyCode,
          timestamp: new Date().toISOString()
        });

        // Show warning immediately
        const detectedKey = key || code || keyCode;
        showScreenshotWarning(`macOS screenshot: Cmd+Shift+${detectedKey}`);
        return;
      }
    }

    // Windows screenshot shortcuts
    if (isWindows) {
      // PrtScn, Alt+PrtScn, Win+Shift+S (Snipping Tool)
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        console.log('[ScreenshotDetection] 🚨 Windows PrintScreen detected');
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        showScreenshotWarning('Windows screenshot: PrintScreen');
        return false;
      }
      if (e.metaKey && e.shiftKey && e.key.toLowerCase() === 's') {
        console.log('[ScreenshotDetection] 🚨 Windows Snipping Tool detected');
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        showScreenshotWarning('Windows screenshot: Win+Shift+S');
        return false;
      }
    }
  }, [showScreenshotWarning]);

  // Method 2: Detect page visibility changes (potential screenshot indicator)
  // DISABLED - Too many false positives from normal tab switching
  const handleVisibilityChange = useCallback(() => {
    // Log for debugging but don't trigger warnings
    if (document.hidden) {
      console.log('[ScreenshotDetection] Page hidden (tab switch/minimize)');
    } else {
      console.log('[ScreenshotDetection] Page visible again');
    }
    // Note: This method is disabled because it triggers too many false positives
    // Users naturally switch tabs frequently and this shouldn't be flagged as suspicious
  }, []);

  // Method 3: Detect blur events (user switching to screenshot tool)
  // DISABLED - Too many false positives from normal window switching
  const handleBlur = useCallback(() => {
    console.log('[ScreenshotDetection] Window blur (window switched/lost focus)');
    // Note: Disabled because users naturally switch windows frequently
  }, []);

  // Method 4: Monitor for screenshot browser extensions
  useEffect(() => {
    if (!isProtected) return;

    // Some screenshot extensions inject specific elements or modify DOM
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            // Check for common screenshot extension patterns
            const suspiciousClasses = [
              'screenshot-overlay',
              'capture-overlay',
              'screen-capture',
              'nimbus-capture',
              'awesome-screenshot',
            ];

            const className = node.className || '';
            if (suspiciousClasses.some(cls =>
              typeof className === 'string' && className.includes(cls)
            )) {
              showScreenshotWarning('Screenshot extension detected');
            }
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [isProtected, showScreenshotWarning]);

  // Check for suspension status on mount
  useEffect(() => {
    if (!isProtected) return;

    const checkSuspensionStatus = async () => {
      try {
        console.log('[ScreenshotDetection] Checking user suspension status...');
        const response = await api.get('/api/security/screenshot-status');
        const attemptCount = response.data?.status?.attemptCount ?? response.data?.attemptCount ?? 0;

        console.log('[ScreenshotDetection] User attempt count:', attemptCount);
        setAttemptCount(attemptCount);

        // If user is suspended (3+ attempts), show modal immediately and block access
        if (attemptCount >= 3) {
          console.log('[ScreenshotDetection] 🚨 User is SUSPENDED - showing modal');
          setWarningMessage({
            title: '🚫 Account Suspended',
            message: `Access revoked immediately.`,
            severity: 'suspended',
          });
          setShowWarning(true);
        }
      } catch (error) {
        console.warn('[ScreenshotDetection] Failed to check suspension status:', error);
      }
    };

    checkSuspensionStatus();
  }, [isProtected]);

  // Attach event listeners
  useEffect(() => {
    if (!isProtected) return;

    console.log('[ScreenshotDetection] Attaching screenshot detection listeners');
    console.log('[ScreenshotDetection] Platform:', navigator.platform);
    console.log('[ScreenshotDetection] User Agent:', navigator.userAgent);

    // Use capture phase (true) to catch events before they bubble
    // Listen on window to ensure we catch the events early
    window.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [isProtected, handleKeyDown, handleVisibilityChange, handleBlur]);

  // If not protected, render children transparently
  if (!isProtected) {
    return <>{children}</>;
  }

  // Close warning modal (unless suspended)
  const closeWarning = () => {
    // If suspended (3+ attempts), don't allow closing - force logout
    if (attemptCount >= 3) {
      console.log('[ScreenshotDetection] Cannot close - account is suspended');
      return;
    }

    setShowWarning(false);
    // Keep warning message visible for 5 seconds before hiding
    setTimeout(() => {
      setWarningMessage(null);
    }, 300);
  };

  return (
    <>
      {children}

      {/* Render warning modal as portal to ensure it's always on top and centered */}
      {showWarning && warningMessage && createPortal(
        <div className={`screenshot-warning-overlay ${warningMessage.severity}`}>
          <div className="screenshot-warning-modal">
            <div className="screenshot-warning-header">
              {warningMessage.title}
            </div>
            <div className="screenshot-warning-body">
              <div className="screenshot-warning-icon">
                {warningMessage.severity === 'warning' && '⚠️'}
                {warningMessage.severity === 'final_warning' && '🚨'}
                {warningMessage.severity === 'suspended' && '🚫'}
              </div>
              <pre className="screenshot-warning-message">
                {warningMessage.message}
              </pre>
              <div className="screenshot-warning-meta">
                <p><strong>Detected Method:</strong> Screenshot attempt</p>
                <p><strong>Attempt Count:</strong> {attemptCount}</p>
                <p><strong>Account Status:</strong> {
                  attemptCount === 1 ? 'Good Standing' :
                  attemptCount === 2 ? 'Final Warning' :
                  'SUSPENDED'
                }</p>
                <p><strong>Timestamp:</strong> {new Date().toLocaleString()}</p>
              </div>
            </div>
            <div className="screenshot-warning-footer">
              {attemptCount >= 3 ? (
                // Suspended state - show logout and contact support buttons
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={async () => {
                      try {
                        console.log('[ScreenshotDetection] Logging out suspended user...');
                        await logout();
                        // Redirect to login page after logout
                        window.location.href = '/login';
                      } catch (error) {
                        console.error('[ScreenshotDetection] Logout error:', error);
                        // Force redirect to login even if logout fails
                        window.location.href = '/login';
                      }
                    }}
                    className="screenshot-warning-button suspended"
                    style={{ background: 'linear-gradient(135deg, #607d8b 0%, #455a64 100%)' }}
                  >
                    Log Off
                  </button>
                  <button
                    onClick={closeWarning}
                    className="screenshot-warning-button suspended"
                  >
                    Contact Support
                  </button>
                </div>
              ) : (
                // Warning states - show I Understand button
                <>
                  <button
                    onClick={closeWarning}
                    className={`screenshot-warning-button ${warningMessage.severity}`}
                  >
                    I Understand
                  </button>
                  <p className="screenshot-warning-terms">
                    By clicking "I Understand", you acknowledge that you've read and agree to comply with our terms of service.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default ScreenshotDetection;
