export const DEFAULT_REQUEST_TIMEOUT_MS = 8000;

export class RequestTimeoutError extends Error {
  constructor(message = "Request timed out.") {
    super(message);
    this.name = "TimeoutError";
  }
}

export const fetchWithTimeout = async (
  resource,
  {
    signal,
    timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
    consume = (response) => response,
    ...options
  } = {}
) => {
  const controller = new AbortController();
  let didTimeout = false;
  let timeoutId = null;

  const abortFromCaller = () => {
    controller.abort(signal?.reason);
  };

  if (signal?.aborted) {
    abortFromCaller();
  } else if (signal) {
    signal.addEventListener("abort", abortFromCaller, { once: true });
  }

  if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, timeoutMs);
  }

  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal,
    });
    return await consume(response);
  } catch (error) {
    if (didTimeout) {
      throw new RequestTimeoutError();
    }
    throw error;
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    if (signal) {
      signal.removeEventListener("abort", abortFromCaller);
    }
  }
};

/** Fetch and consume JSON under one deadline, including the response body. */
export const fetchJsonWithTimeout = (
  resource,
  { errorMessage = "Request failed.", ...options } = {}
) =>
  fetchWithTimeout(resource, {
    ...options,
    consume: async (response) => {
      if (!response.ok) throw new Error(errorMessage);
      return response.json();
    },
  });
