import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

// Mock react-helmet-async so Helmet doesn't need a provider
vi.mock("react-helmet-async", () => ({
  Helmet: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  HelmetProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock SettingsTitle to avoid its dependency chain
vi.mock("@/components/settings/settings-title", () => ({
  default: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

// Mock getAppName
vi.mock("@/lib/config", () => ({
  getAppName: () => "TestApp",
  isCloud: () => false,
}));

// Mock Mantine components to avoid jsdom/matchMedia issues
vi.mock("@mantine/core", () => ({
  Badge: ({ children, color }: { children: React.ReactNode; color?: string }) => (
    <span data-color={color}>{children}</span>
  ),
  Button: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    size?: string;
    variant?: string;
  }) => <button onClick={onClick}>{children}</button>,
  Table: ({ children }: { children: React.ReactNode }) => <table>{children}</table>,
  Text: ({ children }: { children: React.ReactNode; c?: string; mb?: string }) => (
    <p>{children}</p>
  ),
}));

// @mantine/core sub-components (Table.Thead, Table.Tbody, Table.Tr, Table.Th, Table.Td)
// Vitest module mocking doesn't handle sub-components; patch them after mock
vi.mock("@mantine/core", async () => {
  const TableComponent = ({ children }: { children: React.ReactNode }) => (
    <table>{children}</table>
  );
  TableComponent.Thead = ({ children }: { children: React.ReactNode }) => (
    <thead>{children}</thead>
  );
  TableComponent.Tbody = ({ children }: { children: React.ReactNode }) => (
    <tbody>{children}</tbody>
  );
  TableComponent.Tr = ({ children }: { children: React.ReactNode }) => <tr>{children}</tr>;
  TableComponent.Th = ({ children }: { children: React.ReactNode }) => <th>{children}</th>;
  TableComponent.Td = ({ children }: { children: React.ReactNode }) => <td>{children}</td>;

  return {
    Badge: ({
      children,
      color,
    }: {
      children: React.ReactNode;
      color?: string;
    }) => <span data-color={color}>{children}</span>,
    Button: ({
      children,
      onClick,
    }: {
      children: React.ReactNode;
      onClick?: () => void;
      size?: string;
      variant?: string;
    }) => <button onClick={onClick}>{children}</button>,
    Table: TableComponent,
    Text: ({
      children,
    }: {
      children: React.ReactNode;
      c?: string;
      mb?: string;
    }) => <p>{children}</p>,
  };
});

// Mock useUserRole hook
vi.mock("@/hooks/use-user-role", () => ({
  default: vi.fn(),
  useUserRole: vi.fn(),
}));

// Mock the api client
vi.mock("@/lib/api-client", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// Import after mocks
import ContentSecurity from "./content-security";
import useUserRole from "@/hooks/use-user-role";
import api from "@/lib/api-client";

const mockUseUserRole = vi.mocked(useUserRole);
const mockApi = vi.mocked(api);

const mockViolations = [
  {
    userId: "user-1",
    email: "alice@example.com",
    attemptCount: 2,
    lastAttempt: "2026-03-15T10:30:00Z",
    suspendedAt: null,
  },
  {
    userId: "user-2",
    email: "bob@example.com",
    attemptCount: 3,
    lastAttempt: "2026-03-18T14:00:00Z",
    suspendedAt: "2026-03-18T14:00:05Z",
  },
];

describe("ContentSecurity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Test 1: Non-admin user — component returns null, no table rendered", () => {
    mockUseUserRole.mockReturnValue({ isAdmin: false, isOwner: false, isMember: true });
    mockApi.get.mockResolvedValue([]);

    const { container } = render(<ContentSecurity />);

    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("Test 2: Admin user with 2 violation records — table renders 2 rows with correct data", async () => {
    mockUseUserRole.mockReturnValue({ isAdmin: true, isOwner: false, isMember: false });
    mockApi.get.mockResolvedValue(mockViolations);

    render(<ContentSecurity />);

    await waitFor(() => {
      expect(screen.getByText("alice@example.com")).toBeTruthy();
      expect(screen.getByText("bob@example.com")).toBeTruthy();
    });

    expect(screen.getByText("2")).toBeTruthy(); // attemptCount for alice
    expect(screen.getByText("3")).toBeTruthy(); // attemptCount for bob
  });

  it("Test 3: Row with suspendedAt set — Status shows 'Locked', Reinstate button present", async () => {
    mockUseUserRole.mockReturnValue({ isAdmin: true, isOwner: false, isMember: false });
    mockApi.get.mockResolvedValue([mockViolations[1]]); // bob — suspended

    render(<ContentSecurity />);

    await waitFor(() => {
      expect(screen.getByText("bob@example.com")).toBeTruthy();
    });

    expect(screen.getByText("Locked")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /reinstate/i }).length).toBeGreaterThan(0);
  });

  it("Test 4: Row with suspendedAt = null — Status shows 'Active', Reinstate button present", async () => {
    mockUseUserRole.mockReturnValue({ isAdmin: true, isOwner: false, isMember: false });
    mockApi.get.mockResolvedValue([mockViolations[0]]); // alice — not suspended

    render(<ContentSecurity />);

    await waitFor(() => {
      expect(screen.getByText("alice@example.com")).toBeTruthy();
    });

    expect(screen.getByText("Active")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /reinstate/i }).length).toBeGreaterThan(0);
  });

  it("Test 5: Clicking Reinstate calls POST /api/security/reinstate/:userId and refreshes list", async () => {
    mockUseUserRole.mockReturnValue({ isAdmin: true, isOwner: false, isMember: false });
    mockApi.get.mockResolvedValue([mockViolations[0]]);
    mockApi.post.mockResolvedValue({ success: true });

    render(<ContentSecurity />);

    await waitFor(() => {
      expect(screen.getByText("alice@example.com")).toBeTruthy();
    });

    const reinstateButton = screen.getByRole("button", { name: /reinstate/i });
    fireEvent.click(reinstateButton);

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith("/api/security/reinstate/user-1");
      // get should be called twice: initial load + after reinstate
      expect(mockApi.get).toHaveBeenCalledTimes(2);
    });
  });

  it("Test 6: Table columns exist: Email, Strike Count, Last Attempt, Status, Actions", async () => {
    mockUseUserRole.mockReturnValue({ isAdmin: true, isOwner: false, isMember: false });
    mockApi.get.mockResolvedValue([]);

    render(<ContentSecurity />);

    await waitFor(() => {
      expect(screen.getByText(/email/i)).toBeTruthy();
      expect(screen.getByText(/strike count/i)).toBeTruthy();
      expect(screen.getByText(/last attempt/i)).toBeTruthy();
      expect(screen.getByText(/status/i)).toBeTruthy();
      expect(screen.getByText(/actions/i)).toBeTruthy();
    });
  });
});
