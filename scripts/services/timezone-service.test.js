import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchCoordinateTimeZone, isValidTimeZone } from "./timezone-service.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("timezone-service", () => {
  it("resolves an IANA timezone for coordinates", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ timezone: "America/Los_Angeles" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchCoordinateTimeZone({ latitude: 47.6062, longitude: -122.3321 })
    ).resolves.toBe("America/Los_Angeles");
    expect(fetchMock.mock.calls[0][0]).toContain(
      "latitude=47.6062&longitude=-122.3321&timezone=auto"
    );
  });

  it("rejects invalid timezone values from the provider", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ timezone: "not/a-timezone" }),
      })
    );

    await expect(
      fetchCoordinateTimeZone({ latitude: 47.6062, longitude: -122.3321 })
    ).resolves.toBeNull();
  });

  it("validates IANA timezone identifiers", () => {
    expect(isValidTimeZone("Europe/Paris")).toBe(true);
    expect(isValidTimeZone("invalid")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });
});
