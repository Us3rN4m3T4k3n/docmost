import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

// Mock jotai useAtom to control userAtom return values in component tests
vi.mock("jotai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jotai")>();
  return {
    ...actual,
    useAtom: vi.fn(),
  };
});

// Mock the api client used by logProtectionAttempt
vi.mock("@/lib/api-client", () => ({
  default: {
    post: vi.fn().mockResolvedValue({}),
    get: vi.fn().mockResolvedValue({}),
  },
}));

// Import after mocks are defined
import { buildWatermarkDataUri } from "./ContentProtection";
import { ContentProtection } from "./ContentProtection";
import { useAtom } from "jotai";

const mockedUseAtom = vi.mocked(useAtom);

describe("buildWatermarkDataUri", () => {
  it("Test 1: returns a string starting with data:image/svg+xml,", () => {
    const result = buildWatermarkDataUri("test@example.com");
    expect(result).toMatch(/^data:image\/svg\+xml,/);
  });

  it("Test 2: decoded SVG contains the email string", () => {
    const result = buildWatermarkDataUri("test@example.com");
    const encoded = result.replace("data:image/svg+xml,", "");
    const decoded = decodeURIComponent(encoded);
    expect(decoded).toContain("test@example.com");
  });

  it("Test 3: decoded SVG contains rotate with a negative angle (diagonal)", () => {
    const result = buildWatermarkDataUri("test@example.com");
    const encoded = result.replace("data:image/svg+xml,", "");
    const decoded = decodeURIComponent(encoded);
    // Should contain a rotate transform with a negative number
    expect(decoded).toMatch(/rotate\(-\d+/);
  });

  it("Test 4: decoded SVG contains rgba fill with opacity between 0.05 and 0.10", () => {
    const result = buildWatermarkDataUri("test@example.com");
    const encoded = result.replace("data:image/svg+xml,", "");
    const decoded = decodeURIComponent(encoded);
    // Should contain an rgba fill — extract the opacity value
    const rgbaMatch = decoded.match(/rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)/);
    expect(rgbaMatch).not.toBeNull();
    const opacity = parseFloat(rgbaMatch![1]);
    expect(opacity).toBeGreaterThanOrEqual(0.05);
    expect(opacity).toBeLessThanOrEqual(0.10);
  });
});

describe("ContentProtection watermark rendering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Test 5: renders watermark div when protected=true with user email", () => {
    mockedUseAtom.mockReturnValue([{ email: "reader@client.com" } as any, vi.fn(), vi.fn()] as any);

    render(
      <ContentProtection protected={true}>
        <div>content</div>
      </ContentProtection>
    );

    // Watermark div should be in the DOM
    const watermark = document.querySelector(".content-watermark") ||
      document.querySelector("[aria-hidden='true']");
    expect(watermark).not.toBeNull();
  });

  it("Test 6: does NOT render watermark div when protected=false", () => {
    mockedUseAtom.mockReturnValue([{ email: "reader@client.com" } as any, vi.fn(), vi.fn()] as any);

    render(
      <ContentProtection protected={false}>
        <div>content</div>
      </ContentProtection>
    );

    const watermark = document.querySelector(".content-watermark");
    expect(watermark).toBeNull();
  });

  it("Test 7: renders watermark div when protected=true and userAtom returns null (graceful fallback)", () => {
    mockedUseAtom.mockReturnValue([null, vi.fn(), vi.fn()] as any);

    render(
      <ContentProtection protected={true}>
        <div>content</div>
      </ContentProtection>
    );

    // Watermark should still render — empty email is acceptable
    const watermark = document.querySelector(".content-watermark") ||
      document.querySelector("[aria-hidden='true']");
    expect(watermark).not.toBeNull();
  });
});
