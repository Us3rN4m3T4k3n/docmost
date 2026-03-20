import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock CSS imports
vi.mock('./ScreenshotDetection.css', () => ({}));

// Mock api-client
vi.mock('@/lib/api-client', () => ({
  default: {
    post: vi.fn().mockResolvedValue({ data: {} }),
    get: vi.fn().mockResolvedValue({ data: { attemptCount: 0 } }),
  },
}));

// Mock auth-service
vi.mock('@/features/auth/services/auth-service', () => ({
  logout: vi.fn().mockResolvedValue(undefined),
}));

// Mock createPortal so it renders inline for testing
vi.mock('react-dom', async () => {
  const actual = await vi.importActual<typeof import('react-dom')>('react-dom');
  return {
    ...actual,
    createPortal: (node: React.ReactNode) => node,
  };
});

import { ScreenshotDetection } from './ScreenshotDetection';

describe('ScreenshotDetection', () => {
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    addEventListenerSpy = vi.spyOn(document, 'addEventListener');
    removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
    vi.spyOn(window, 'addEventListener');
    vi.spyOn(window, 'removeEventListener');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Test 1: When protected=false, keyboard listeners are NOT attached and children are rendered transparently
  it('does not attach keyboard listeners when protected is false', () => {
    const { unmount } = render(
      <ScreenshotDetection protected={false}>
        <div data-testid="child">Content</div>
      </ScreenshotDetection>
    );

    // Children should be rendered
    expect(screen.getByTestId('child')).toBeTruthy();

    // keydown listener should NOT be registered on window or document
    const windowCalls = (window.addEventListener as ReturnType<typeof vi.spyOn>).mock.calls;
    const docCalls = addEventListenerSpy.mock.calls;

    const keydownOnWindow = windowCalls.some(([event]) => event === 'keydown');
    const keydownOnDocument = docCalls.some(([event]) => event === 'keydown');

    expect(keydownOnWindow).toBe(false);
    expect(keydownOnDocument).toBe(false);

    unmount();
  });

  // Test 2: When protected=true, keyboard listeners ARE attached
  it('attaches keyboard event listeners when protected is true', () => {
    const { unmount } = render(
      <ScreenshotDetection protected={true}>
        <div data-testid="child">Content</div>
      </ScreenshotDetection>
    );

    // Children should still be rendered
    expect(screen.getByTestId('child')).toBeTruthy();

    // keydown listener should be registered on window
    const windowCalls = (window.addEventListener as ReturnType<typeof vi.spyOn>).mock.calls;
    const keydownOnWindow = windowCalls.some(([event]) => event === 'keydown');
    expect(keydownOnWindow).toBe(true);

    unmount();
  });

  // Test 3: No useUserRole / isMember reference — the component must accept protected prop
  // (Structural test: if the component did NOT have a protected prop, TypeScript would fail.
  //  We verify here that the component renders with the protected prop without crashing.)
  it('accepts protected boolean prop without referencing isMember', () => {
    // This test verifies the component renders fine with the protected prop
    // If isMember was still used (and not mocked), this would throw
    expect(() =>
      render(
        <ScreenshotDetection protected={false}>
          <span>test</span>
        </ScreenshotDetection>
      )
    ).not.toThrow();
  });

  // Test 4: The screenshot-status URL contains /api/security/screenshot-status
  it('calls /api/security/screenshot-status (with /api prefix) on mount when protected', async () => {
    const apiModule = await import('@/lib/api-client');
    const apiGet = vi.mocked(apiModule.default.get);
    apiGet.mockResolvedValue({ data: { attemptCount: 0 } });

    render(
      <ScreenshotDetection protected={true}>
        <div>Content</div>
      </ScreenshotDetection>
    );

    // Wait for the async checkSuspensionStatus to fire
    await vi.waitFor(() => {
      const calls = apiGet.mock.calls;
      const hasCorrectUrl = calls.some(([url]) => url === '/api/security/screenshot-status');
      expect(hasCorrectUrl).toBe(true);
    });
  });

  // Test 5: No copy event listener is registered
  it('does not register a copy event listener', () => {
    const { unmount } = render(
      <ScreenshotDetection protected={true}>
        <div>Content</div>
      </ScreenshotDetection>
    );

    // copy listener should NOT be on document
    const docCalls = addEventListenerSpy.mock.calls;
    const copyOnDocument = docCalls.some(([event]) => event === 'copy');
    expect(copyOnDocument).toBe(false);

    // copy listener should NOT be on window
    const windowCalls = (window.addEventListener as ReturnType<typeof vi.spyOn>).mock.calls;
    const copyOnWindow = windowCalls.some(([event]) => event === 'copy');
    expect(copyOnWindow).toBe(false);

    unmount();
  });
});
