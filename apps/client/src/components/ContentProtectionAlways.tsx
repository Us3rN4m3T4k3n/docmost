import React, { useEffect, useCallback, useRef } from 'react';
import './ContentProtection.css';

interface ContentProtectionAlwaysProps {
  children: React.ReactNode;
}

/**
 * ContentProtectionAlways - Always applies protection regardless of user role
 * Use this for public/shared pages that should ALWAYS be protected
 */
export const ContentProtectionAlways: React.FC<ContentProtectionAlwaysProps> = ({ children }) => {
  const protectionRef = useRef<HTMLDivElement>(null);

  // Keyboard event handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const ctrlKey = isMac ? e.metaKey : e.ctrlKey;

    // Block copy, cut, select all
    if (ctrlKey && ['c', 'x', 'a'].includes(e.key.toLowerCase())) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Block print
    if (ctrlKey && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Block save
    if (ctrlKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Block view source
    if (ctrlKey && e.key.toLowerCase() === 'u') {
      e.preventDefault();
      e.stopPropagation();
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
      return false;
    }

    if (ctrlKey && e.shiftKey && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  }, []);

  // Context menu handler
  const handleContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }, []);

  // Drag start handler
  const handleDragStart = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
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
    return false;
  }, []);

  const handleCut = useCallback((e: ClipboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.clipboardData?.clearData();
    return false;
  }, []);

  // Touch handlers for mobile
  const handleTouchStart = useCallback((e: TouchEvent) => {
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
      <div className="content-protected">
        {children}
      </div>
    </div>
  );
};

export default ContentProtectionAlways;
