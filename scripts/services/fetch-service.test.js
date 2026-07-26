import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithTimeout, RequestTimeoutError } from "./fetch-service.js";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("fetchWithTimeout", () => {
  it("aborts a request after its deadline", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_resource, { signal }) => {
        return new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      })
    );

    const request = fetchWithTimeout("/slow", { timeoutMs: 50 });
    const rejection = expect(request).rejects.toBeInstanceOf(RequestTimeoutError);
    await vi.advanceTimersByTimeAsync(50);

    await rejection;
  });

  it("preserves caller cancellation", async () => {
    const caller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn((_resource, { signal }) => {
        return new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      })
    );

    const request = fetchWithTimeout("/cancelled", {
      signal: caller.signal,
      timeoutMs: 1000,
    });
    caller.abort();

    await expect(request).rejects.toMatchObject({ name: "AbortError" });
  });

  it("clears its deadline after a successful response", async () => {
    vi.useFakeTimers();
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

    await expect(fetchWithTimeout("/fast", { timeoutMs: 50 })).resolves.toMatchObject({
      ok: true,
    });
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});
