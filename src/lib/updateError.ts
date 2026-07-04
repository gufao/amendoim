/**
 * Normalizes whatever `@tauri-apps/plugin-updater` / `plugin-process` throw during
 * `downloadAndInstall()` / `relaunch()` into a human-readable string.
 *
 * Tauri surfaces Rust-side failures in several shapes: a thrown string (the most
 * common — the serialized Rust error), an `Error` instance, or an object with a
 * `message`. The updater step replaces the running `.app` bundle, so the message
 * is what tells the user *why* it failed (e.g. "Read-only file system" when the app
 * runs from a translocated/quarantined location instead of /Applications).
 */
export function formatUpdateError(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err.length > 0) return err;
  if (err && typeof err === "object") {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string" && message.length > 0) return message;
    try {
      const json = JSON.stringify(err);
      if (json && json !== "{}") return json;
    } catch {
      // fall through to String()
    }
  }
  const str = String(err);
  // "[object Object]" happens when an object had no usable message and couldn't
  // be JSON-stringified (e.g. circular) — it tells the user nothing, so drop it.
  return str === "null" ||
    str === "undefined" ||
    str === "[object Object]" ||
    str.length === 0
    ? "Unknown error"
    : str;
}
