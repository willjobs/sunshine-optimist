import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithTimeout, fetchJsonWithTimeout, RequestTimeoutError } from "./fetch-service.js";

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

describe("JSON body deadlines", () => {
  const installStreamingResponse = () => {
    let requestSignal;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, { signal }) => {
        requestSignal = signal;
        return new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('{"value":'));
              signal.addEventListener("abort", () => controller.error(signal.reason), {
                once: true,
              });
            },
          }),
          { status: 200 }
        );
      })
    );
    return () => requestSignal;
  };

  it("times out after headers when the JSON body stalls", async () => {
    vi.useFakeTimers();
    installStreamingResponse();
    const result = fetchJsonWithTimeout("/stream", { timeoutMs: 50 });
    const rejected = expect(result).rejects.toBeInstanceOf(RequestTimeoutError);
    await vi.advanceTimersByTimeAsync(50);
    await rejected;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps caller cancellation connected while reading JSON", async () => {
    const signalFor = installStreamingResponse();
    const caller = new AbortController();
    const result = fetchJsonWithTimeout("/stream", { signal: caller.signal });
    await Promise.resolve();
    caller.abort();
    await expect(result).rejects.toMatchObject({ name: "AbortError" });
    expect(signalFor().aborted).toBe(true);
  });

  it("preserves HTTP failures and clears the deadline after a complete body", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"ok":true}')));
    await expect(fetchJsonWithTimeout("/ok")).resolves.toEqual({ ok: true });
    expect(vi.getTimerCount()).toBe(0);
    fetch.mockResolvedValue(new Response("unavailable", { status: 503 }));
    await expect(
      fetchJsonWithTimeout("/bad", { errorMessage: "City lookup failed." })
    ).rejects.toThrow("City lookup failed.");
    expect(vi.getTimerCount()).toBe(0);
  });
});
