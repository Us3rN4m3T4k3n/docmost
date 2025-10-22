import React, { useEffect, useState, useCallback, useRef } from 'react';
import api from '@/lib/api-client';
import './ContentProtection.css';

interface ContentProtectionAlwaysProps {
  children: React.ReactNode;
}

// Dev tools detection and logging (no auth required for shared pages)
const logProtectionAttempt = async (attemptType: string, details?: string) => {
  try {
    // For shared pages, log without JWT (may fail, that's OK)
    console.warn(`Content Protection: ${attemptType}`, details);
  } catch (error) {
    // Silently fail
  }
};

/**
 * ContentProtectionAlways - Always applies protection regardless of user role
 * Use this for public/shared pages that should ALWAYS be protected
 */
export const ContentProtectionAlways: React.FC<ContentProtectionAlwaysProps> = ({ children }) => {
  const [devToolsOpen, setDevToolsOpen] = useState(false);
  const [blurred, setBlurred] = useState(false);
  const devToolsCheckInterval = useRef<NodeJS.Timeout | null>(null);
  const protectionRef = useRef<HTMLDivElement>(null);

  // Detect dev tools
  const checkDevTools = useCallback(() => {
    const widthThreshold = window.outerWidth - window.innerWidth > 160;
    const heightThreshold = window.outerHeight - window.innerHeight > 160;
    const orientation = widthThreshold ? 'vertical' : 'horizontal';

    if (
      (widthThreshold && (window as any).Firebug?.chrome?.isInitialized) ||
      widthThreshold ||
      heightThreshold
    ) {
      if (!devToolsOpen) {
        setDevToolsOpen(true);
        setBlurred(true);
        logProtectionAttempt('dev_tools_opened', `Orientation: ${orientation}`);
      }
    } else {
      if (devToolsOpen) {
        setDevToolsOpen(false);
        setBlurred(false);
      }
    }
  }, [devToolsOpen]);

  useEffect(() => {
    // Start dev tools detection
    devToolsCheckInterval.current = setInterval(checkDevTools, 1000);

    return () => {
      if (devToolsCheckInterval.current) {
        clearInterval(devToolsCheckInterval.current);
      }
    };
  }, [checkDevTools]);

  // Keyboard event handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const ctrlKey = isMac ? e.metaKey : e.ctrlKey;

    // Block copy, cut, select all
    if (ctrlKey && ['c', 'x', 'a'].includes(e.key.toLowerCase())) {
      e.preventDefault();
      e.stopPropagation();
      logProtectionAttempt('keyboard_shortcut', `Blocked: ${e.key}`);
      return false;
    }

    // Block print
    if (ctrlKey && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      e.stopPropagation();
      logProtectionAttempt('print_attempt', 'Ctrl+P blocked');
      return false;
    }

    // Block save
    if (ctrlKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      e.stopPropagation();
      logProtectionAttempt('save_attempt', 'Ctrl+S blocked');
      return false;
    }

    // Block view source
    if (ctrlKey && e.key.toLowerCase() === 'u') {
      e.preventDefault();
      e.stopPropagation();
      logProtectionAttempt('view_source_attempt', 'Ctrl+U blocked');
      return false;
    }

    // Block F12 and dev tools shortcuts
    if (
      e.key === 'F12' ||
      (ctrlKey && e.shiftKey && e.key.toLowerCase() === 'i') ||
      (ctrlKey && e.shiftKey && e.key.toLowerCase() === 'j') ||
      (ctrlKey && e.shiftKey && e.key.toLowerCase() === 'c')
    ) {
      e.preventDefault();
      e.stopPropagation();
      logProtectionAttempt('dev_tools_shortcut', `Blocked: ${e.key}`);
      return false;
    }

    if (ctrlKey && e.shiftKey && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      e.stopPropagation();
      logProtectionAttempt('dev_tools_shortcut', 'Firefox console blocked');
      return false;
    }
  }, []);

  // Context menu handler
  const handleContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    logProtectionAttempt('right_click', 'Context menu blocked');
    return false;
  }, []);

  // Drag start handler
  const handleDragStart = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    logProtectionAttempt('drag_attempt', 'Drag blocked');
    return false;
  }, []);

  // Select start handler
  const handleSelectStart = useCallback((e: Event) => {
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      return true;
    }
    e.preventDefault();
    return false;
  }, []);

  // Copy/Cut handler
  const handleCopy = useCallback((e: ClipboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.clipboardData?.clearData();
    logProtectionAttempt('copy_attempt', 'Copy blocked');
    return false;
  }, []);

  const handleCut = useCallback((e: ClipboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.clipboardData?.clearData();
    logProtectionAttempt('cut_attempt', 'Cut blocked');
    return false;
  }, []);

  // Touch handlers for mobile
  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    const target = e.target as HTMLElement;

    if (
      target.tagName === 'BUTTON' ||
      target.tagName === 'A' ||
      target.onclick !== null
    ) {
      return;
    }

    (target as any)._touchStart = Date.now();
  }, []);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    const target = e.target as HTMLElement;
    const touchStart = (target as any)._touchStart;

    if (touchStart && Date.now() - touchStart > 500) {
      e.preventDefault();
      logProtectionAttempt('mobile_long_press', 'Mobile selection blocked');
    }

    delete (target as any)._touchStart;
  }, []);

  useEffect(() => {
    const element = protectionRef.current;
    if (!element) return;

    // Add all event listeners
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('contextmenu', handleContextMenu, true);
    document.addEventListener('dragstart', handleDragStart, true);
    document.addEventListener('selectstart', handleSelectStart, true);
    document.addEventListener('copy', handleCopy, true);
    document.addEventListener('cut', handleCut, true);
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, true);

    element.style.setProperty('-webkit-touch-callout', 'none');
    element.style.setProperty('-webkit-user-select', 'none');
    element.style.setProperty('-moz-user-select', 'none');
    element.style.setProperty('-ms-user-select', 'none');
    element.style.setProperty('user-select', 'none');

    // Aggressive Safari Reader Mode prevention
    element.setAttribute('data-reader-mode', 'false');
    element.setAttribute('role', 'application');
    element.setAttribute('aria-hidden', 'false');
    
    // Remove and replace article tags that Safari looks for
    const articles = element.querySelectorAll('article');
    articles.forEach(article => {
      const div = document.createElement('div');
      div.innerHTML = article.innerHTML;
      div.className = article.className;
      for (const attr of article.attributes) {
        if (attr.name !== 'role') {
          div.setAttribute(attr.name, attr.value);
        }
      }
      div.setAttribute('role', 'presentation');
      div.setAttribute('data-no-reader', 'true');
      article.parentNode?.replaceChild(div, article);
    });
    
    // Remove semantic HTML tags that Safari looks for
    const semanticTags = ['article', 'section', 'main', 'header', 'footer', 'aside', 'nav'];
    semanticTags.forEach(tag => {
      const elements = element.querySelectorAll(tag);
      elements.forEach(elem => {
        elem.setAttribute('role', 'presentation');
        elem.setAttribute('data-no-reader', 'true');
      });
    });

    // MutationObserver to continuously prevent Safari Reader Mode
    const readerModeObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes') {
          const target = mutation.target as HTMLElement;
          if (target.getAttribute('role') !== 'presentation' && 
              semanticTags.includes(target.tagName.toLowerCase())) {
            target.setAttribute('role', 'presentation');
            target.setAttribute('data-no-reader', 'true');
          }
        }
      });
    });
    
    readerModeObserver.observe(element, {
      attributes: true,
      subtree: true,
      attributeFilter: ['role', 'data-reader-mode'],
    });

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('contextmenu', handleContextMenu, true);
      document.removeEventListener('dragstart', handleDragStart, true);
      document.removeEventListener('selectstart', handleSelectStart, true);
      document.removeEventListener('copy', handleCopy, true);
      document.removeEventListener('cut', handleCut, true);
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
      readerModeObserver.disconnect();
    };
  }, [
    handleKeyDown,
    handleContextMenu,
    handleDragStart,
    handleSelectStart,
    handleCopy,
    handleCut,
    handleTouchStart,
    handleTouchEnd,
  ]);

  // Disable print dialog
  useEffect(() => {
    const beforePrint = () => {
      logProtectionAttempt('print_dialog', 'Print dialog opened');
      alert('Printing is disabled for this content.');
      return false;
    };

    window.addEventListener('beforeprint', beforePrint);

    return () => {
      window.removeEventListener('beforeprint', beforePrint);
    };
  }, []);

  return (
    <div ref={protectionRef} className="content-protection">
      {blurred && devToolsOpen && (
        <div className="dev-tools-warning">
          <div className="dev-tools-warning-content">
            <h2>⚠️ Developer Tools Detected</h2>
            <p>
              Access to content is restricted when developer tools are open.
            </p>
            <p>Please close developer tools to continue viewing content.</p>
          </div>
        </div>
      )}
      <div className={blurred ? 'content-blurred' : 'content-protected'}>
        {children}
      </div>
    </div>
  );
};

export default ContentProtectionAlways;

