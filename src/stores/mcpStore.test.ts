import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the Tauri bridge BEFORE importing the store so the store binds to mocks.
vi.mock("../lib/tauri", () => ({
  getMcpStatus: vi.fn(),
  startMcpServer: vi.fn(),
  stopMcpServer: vi.fn(),
  installMcpClient: vi.fn(),
}));

import * as api from "../lib/tauri";
import { useMcpStore } from "./mcpStore";

const apiMock = api as unknown as {
  getMcpStatus: ReturnType<typeof vi.fn>;
  startMcpServer: ReturnType<typeof vi.fn>;
  stopMcpServer: ReturnType<typeof vi.fn>;
};

const RUNNING = {
  is_running: true,
  port: 7432,
  url: "http://127.0.0.1:7432/sse",
};

describe("useMcpStore — autoStart persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // setState first: persist writes through on every set, so clearing
    // afterwards is what actually leaves storage empty.
    useMcpStore.setState({
      isRunning: false,
      port: 7432,
      url: "http://127.0.0.1:7432/sse",
      isLoading: false,
      error: null,
      installMessage: null,
      autoStart: false,
      restoreError: null,
    });
    localStorage.clear();
  });

  it("arms autoStart after a successful start", async () => {
    apiMock.startMcpServer.mockResolvedValue(RUNNING);

    await useMcpStore.getState().startServer();

    expect(useMcpStore.getState().isRunning).toBe(true);
    expect(useMcpStore.getState().autoStart).toBe(true);
  });

  it("does NOT arm autoStart when start fails", async () => {
    apiMock.startMcpServer.mockRejectedValue("Failed to bind to port 7432");

    await useMcpStore.getState().startServer();

    expect(useMcpStore.getState().autoStart).toBe(false);
    expect(useMcpStore.getState().isRunning).toBe(false);
    expect(useMcpStore.getState().error).toContain("7432");
  });

  it("disarms autoStart when the user stops the server", async () => {
    apiMock.startMcpServer.mockResolvedValue(RUNNING);
    apiMock.stopMcpServer.mockResolvedValue(undefined);

    await useMcpStore.getState().startServer();
    await useMcpStore.getState().stopServer();

    expect(useMcpStore.getState().isRunning).toBe(false);
    expect(useMcpStore.getState().autoStart).toBe(false);
  });

  it("persists autoStart — and only autoStart — to localStorage", async () => {
    apiMock.startMcpServer.mockResolvedValue(RUNNING);

    await useMcpStore.getState().startServer();

    const raw = localStorage.getItem("amendoim-mcp");
    expect(raw).toBeTruthy();
    const persisted = JSON.parse(raw!);
    // isRunning describes live backend state; persisting it would let the status
    // bar claim a server is up before one has been started.
    expect(persisted.state).toEqual({ autoStart: true });
  });

  it("restoreServer starts the server when autoStart was left on", async () => {
    apiMock.startMcpServer.mockResolvedValue(RUNNING);
    useMcpStore.setState({ autoStart: true });

    await useMcpStore.getState().restoreServer();

    expect(apiMock.startMcpServer).toHaveBeenCalledTimes(1);
    expect(useMcpStore.getState().isRunning).toBe(true);
    expect(useMcpStore.getState().restoreError).toBeNull();
  });

  it("restoreServer is a no-op when autoStart is off", async () => {
    await useMcpStore.getState().restoreServer();

    expect(apiMock.startMcpServer).not.toHaveBeenCalled();
    expect(useMcpStore.getState().isRunning).toBe(false);
  });

  it("restoreServer surfaces a failed restore so it is not silent", async () => {
    apiMock.startMcpServer.mockRejectedValue("Address already in use");
    useMcpStore.setState({ autoStart: true });

    await useMcpStore.getState().restoreServer();

    // `error` alone only renders inside the MCP modal, which auto-start users
    // never open — restoreError is what App.tsx turns into a toast.
    expect(useMcpStore.getState().restoreError).toContain("Address already in use");
    // A failed restore must not disarm the retry on the next launch.
    expect(useMcpStore.getState().autoStart).toBe(true);
  });

  it("setAutoStart lets the user disarm a restore that keeps failing", async () => {
    apiMock.startMcpServer.mockRejectedValue("Address already in use");
    useMcpStore.setState({ autoStart: true });
    await useMcpStore.getState().restoreServer();
    expect(useMcpStore.getState().restoreError).toBeTruthy();

    // The modal's start/stop button only offers "Start" while isRunning is
    // false, so without this the flag would be unreachable and retry forever.
    useMcpStore.getState().setAutoStart(false);

    expect(useMcpStore.getState().autoStart).toBe(false);
    expect(JSON.parse(localStorage.getItem("amendoim-mcp")!).state).toEqual({
      autoStart: false,
    });

    apiMock.startMcpServer.mockClear();
    await useMcpStore.getState().restoreServer();
    expect(apiMock.startMcpServer).not.toHaveBeenCalled();
  });

  it("reports a failed restore even if the backend returns no error string", async () => {
    apiMock.startMcpServer.mockResolvedValue({ ...RUNNING, is_running: false });
    useMcpStore.setState({ autoStart: true });

    await useMcpStore.getState().restoreServer();

    expect(useMcpStore.getState().isRunning).toBe(false);
    expect(useMcpStore.getState().restoreError).toBeTruthy();
  });

  it("clearRestoreError dismisses it", async () => {
    useMcpStore.setState({ restoreError: "boom" });

    useMcpStore.getState().clearRestoreError();

    expect(useMcpStore.getState().restoreError).toBeNull();
  });
});

// These exercise the path the app actually takes: the store is created at import
// time and must already hold the persisted value when App's mount effect runs.
// Calling `persist.rehydrate()` explicitly (as an earlier version of this suite
// did) tests zustand rather than us — it stays green even with
// `skipHydration: true`, which would silently kill auto-start entirely.
describe("useMcpStore — hydration at module load", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it("holds autoStart from a previous launch without any explicit rehydrate call", async () => {
    localStorage.setItem(
      "amendoim-mcp",
      JSON.stringify({ state: { autoStart: true }, version: 0 })
    );

    const { useMcpStore: freshStore } = await import("./mcpStore");

    expect(freshStore.getState().autoStart).toBe(true);
  });

  it("stays off when nothing was persisted", async () => {
    const { useMcpStore: freshStore } = await import("./mcpStore");

    expect(freshStore.getState().autoStart).toBe(false);
  });
});
