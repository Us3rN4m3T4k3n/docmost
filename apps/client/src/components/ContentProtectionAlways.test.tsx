import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';

// Mock CSS imports
vi.mock('./ContentProtection.css', () => ({}));

// Mock api-client
vi.mock('@/lib/api-client', () => ({
  default: {
    post: vi.fn().mockResolvedValue({ data: {} }),
    get: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

import { ContentProtectionAlways } from './ContentProtectionAlways';

describe('ContentProtectionAlways', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // Test 1: setInterval is never called during mount
  it('does not create any interval on mount', () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');

    render(
      <ContentProtectionAlways>
        <div data-testid="child">Content</div>
      </ContentProtectionAlways>
    );

    expect(setIntervalSpy).not.toHaveBeenCalled();
  });

  // Test 2: After window resize, children remain visible (no blur class applied)
  it('children remain visible after window resize (no blur applied)', () => {
    const { container } = render(
      <ContentProtectionAlways>
        <div data-testid="child">Content</div>
      </ContentProtectionAlways>
    );

    // Simulate window resize
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    // The child should still be visible, and no content-blurred class should be present
    const blurredElement = container.querySelector('.content-blurred');
    expect(blurredElement).toBeNull();

    // Child should still be rendered
    expect(screen.getByTestId('child')).toBeTruthy();
  });

  // Test 3: Component renders children inside a div with class 'content-protected' (not 'content-blurred')
  it('renders children inside a div with class content-protected', () => {
    const { container } = render(
      <ContentProtectionAlways>
        <div data-testid="child">Content</div>
      </ContentProtectionAlways>
    );

    const protectedDiv = container.querySelector('.content-protected');
    expect(protectedDiv).not.toBeNull();

    const blurredDiv = container.querySelector('.content-blurred');
    expect(blurredDiv).toBeNull();
  });

  // Test 4: devToolsOpen state does not exist — rendered output is never blurred
  it('never renders with blurred state (devToolsOpen state removed)', () => {
    const { container } = render(
      <ContentProtectionAlways>
        <div>Content</div>
      </ContentProtectionAlways>
    );

    // Advance fake timers to simulate any interval that might have fired
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    // Should never have content-blurred class even after timers advance
    const blurredElement = container.querySelector('.content-blurred');
    expect(blurredElement).toBeNull();

    // Should not have dev-tools-warning element
    const devToolsWarning = container.querySelector('.dev-tools-warning');
    expect(devToolsWarning).toBeNull();
  });
});
