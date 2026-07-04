import { describe, it, expect } from "vitest";
import { formatUpdateError } from "./updateError";

describe("formatUpdateError", () => {
  it("returns the message of an Error instance", () => {
    expect(formatUpdateError(new Error("Read-only file system (os error 30)"))).toBe(
      "Read-only file system (os error 30)"
    );
  });

  it("returns a plain string error unchanged (Tauri serializes Rust errors as strings)", () => {
    expect(formatUpdateError("Permission denied (os error 13)")).toBe(
      "Permission denied (os error 13)"
    );
  });

  it("reads .message from an error-like object", () => {
    expect(formatUpdateError({ message: "signature verification failed" })).toBe(
      "signature verification failed"
    );
  });

  it("serializes a plain object that has no message", () => {
    expect(formatUpdateError({ code: "EROFS", path: "/Applications/Amendoim.app" })).toContain(
      "EROFS"
    );
  });

  it("never returns an empty string for null/undefined", () => {
    expect(formatUpdateError(null).length).toBeGreaterThan(0);
    expect(formatUpdateError(undefined).length).toBeGreaterThan(0);
  });

  it("falls back to a readable message when an object can't be stringified", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(formatUpdateError(circular)).toBe("Unknown error");
  });
});
