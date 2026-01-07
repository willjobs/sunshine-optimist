// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isMobileDevice,
  isWebShareSupported,
  isWebShareAvailableForSocial,
  canShareFiles,
  shareText,
  shareCanvasAsImage,
} from "./web-share-utils.js";

describe("web-share-utils", () => {
  let originalNavigator;

  beforeEach(() => {
    originalNavigator = global.navigator;
  });

  afterEach(() => {
    global.navigator = originalNavigator;
  });

  describe("isMobileDevice", () => {
    let originalWindow;

    beforeEach(() => {
      originalWindow = global.window;
      global.window = {
        innerWidth: 1024,
        ontouchstart: undefined,
      };
      global.navigator = {
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        maxTouchPoints: 0,
      };
    });

    afterEach(() => {
      global.window = originalWindow;
    });

    it("returns true for mobile user agent", () => {
      global.navigator.userAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)";
      expect(isMobileDevice()).toBe(true);
    });

    it("returns true for Android device", () => {
      global.navigator.userAgent = "Mozilla/5.0 (Linux; Android 10)";
      expect(isMobileDevice()).toBe(true);
    });

    it("returns true for iPad", () => {
      global.navigator.userAgent = "Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)";
      expect(isMobileDevice()).toBe(true);
    });

    it("returns true for touch device with narrow screen", () => {
      global.navigator.userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";
      global.navigator.maxTouchPoints = 5;
      global.window.innerWidth = 768;
      expect(isMobileDevice()).toBe(true);
    });

    it("returns false for desktop without touch", () => {
      global.navigator.userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";
      global.navigator.maxTouchPoints = 0;
      global.window.innerWidth = 1920;
      expect(isMobileDevice()).toBe(false);
    });

    it("returns false when navigator is undefined", () => {
      global.navigator = undefined;
      expect(isMobileDevice()).toBe(false);
    });
  });

  describe("isWebShareSupported", () => {
    it("returns true when navigator.share exists", () => {
      global.navigator.share = vi.fn();
      expect(isWebShareSupported()).toBe(true);
    });

    it("returns false when navigator.share does not exist", () => {
      delete global.navigator.share;
      expect(isWebShareSupported()).toBe(false);
    });

    it("returns false when navigator is undefined", () => {
      global.navigator = undefined;
      expect(isWebShareSupported()).toBe(false);
    });
  });

  describe("isWebShareAvailableForSocial", () => {
    let originalWindow;

    beforeEach(() => {
      originalWindow = global.window;
      global.window = {
        innerWidth: 1024,
        ontouchstart: undefined,
      };
      global.navigator = {
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)",
        maxTouchPoints: 0,
        share: vi.fn(),
      };
    });

    afterEach(() => {
      global.window = originalWindow;
    });

    it("returns true when Web Share API is supported and device is mobile", () => {
      global.navigator.share = vi.fn();
      global.navigator.userAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)";
      expect(isWebShareAvailableForSocial()).toBe(true);
    });

    it("returns false when Web Share API is supported but device is not mobile", () => {
      global.navigator.share = vi.fn();
      global.navigator.userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";
      global.navigator.maxTouchPoints = 0;
      global.window.innerWidth = 1920;
      expect(isWebShareAvailableForSocial()).toBe(false);
    });

    it("returns false when device is mobile but Web Share API is not supported", () => {
      delete global.navigator.share;
      global.navigator.userAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)";
      expect(isWebShareAvailableForSocial()).toBe(false);
    });

    it("returns false when neither condition is met", () => {
      delete global.navigator.share;
      global.navigator.userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";
      global.navigator.maxTouchPoints = 0;
      global.window.innerWidth = 1920;
      expect(isWebShareAvailableForSocial()).toBe(false);
    });
  });

  describe("canShareFiles", () => {
    it("returns false when Web Share is not supported", () => {
      delete global.navigator.share;
      expect(canShareFiles()).toBe(false);
    });

    it("returns true when canShare supports files", () => {
      global.navigator.share = vi.fn();
      global.navigator.canShare = vi.fn(() => true);
      expect(canShareFiles()).toBe(true);
      expect(global.navigator.canShare).toHaveBeenCalledWith({
        files: expect.arrayContaining([
          expect.objectContaining({
            name: "test.png",
            type: "image/png",
          }),
        ]),
      });
    });

    it("returns false when canShare does not support files", () => {
      global.navigator.share = vi.fn();
      global.navigator.canShare = vi.fn(() => false);
      expect(canShareFiles()).toBe(false);
    });

    it("returns false when canShare does not exist", () => {
      global.navigator.share = vi.fn();
      delete global.navigator.canShare;
      expect(canShareFiles()).toBe(false);
    });

    it("returns false when File constructor throws", () => {
      global.navigator.share = vi.fn();
      global.navigator.canShare = vi.fn(() => true);
      // Mock File to throw
      const OriginalFile = global.File;
      global.File = vi.fn(() => {
        throw new Error("File not supported");
      });
      expect(canShareFiles()).toBe(false);
      global.File = OriginalFile;
    });
  });

  describe("shareText", () => {
    it("calls navigator.share with text and title", async () => {
      const mockShare = vi.fn(() => Promise.resolve());
      global.navigator.share = mockShare;

      const result = await shareText("Test text", "Test Title");

      expect(mockShare).toHaveBeenCalledWith({
        title: "Test Title",
        text: "Test text",
      });
      expect(result).toBe(true);
    });

    it("uses default title when not provided", async () => {
      const mockShare = vi.fn(() => Promise.resolve());
      global.navigator.share = mockShare;

      const result = await shareText("Test text");

      expect(mockShare).toHaveBeenCalledWith({
        title: "Sunshine Optimist",
        text: "Test text",
      });
      expect(result).toBe(true);
    });

    it("returns false when user cancels (AbortError)", async () => {
      const abortError = new Error("User cancelled");
      abortError.name = "AbortError";
      global.navigator.share = vi.fn(() => Promise.reject(abortError));

      const result = await shareText("Test text");

      expect(result).toBe(false);
    });

    it("returns false and logs warning for other errors", async () => {
      const error = new Error("Network error");
      error.name = "NetworkError";
      global.navigator.share = vi.fn(() => Promise.reject(error));
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const result = await shareText("Test text");

      expect(result).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith("Share failed:", error);
      consoleWarnSpy.mockRestore();
    });

    it("returns false when Web Share is not supported", async () => {
      delete global.navigator.share;

      const result = await shareText("Test text");

      expect(result).toBe(false);
    });
  });

  describe("shareCanvasAsImage", () => {
    it("converts canvas to blob and shares", async () => {
      const mockBlob = new Blob(["test"], { type: "image/png" });
      const mockCanvas = {
        toBlob: vi.fn((callback) => {
          callback(mockBlob);
        }),
      };

      const mockShare = vi.fn(() => Promise.resolve());
      global.navigator.share = mockShare;
      global.navigator.canShare = vi.fn(() => true);

      const result = await shareCanvasAsImage(mockCanvas, "test.png");

      expect(mockCanvas.toBlob).toHaveBeenCalledWith(expect.any(Function), "image/png", 1.0);
      expect(mockShare).toHaveBeenCalledWith({
        files: expect.arrayContaining([
          expect.objectContaining({
            name: "test.png",
            type: "image/png",
          }),
        ]),
        title: "Sunshine Optimist",
      });
      expect(result).toBe(true);
    });

    it("uses default filename when not provided", async () => {
      const mockBlob = new Blob(["test"], { type: "image/png" });
      const mockCanvas = {
        toBlob: vi.fn((callback) => {
          callback(mockBlob);
        }),
      };

      const mockShare = vi.fn(() => Promise.resolve());
      global.navigator.share = mockShare;
      global.navigator.canShare = vi.fn(() => true);

      await shareCanvasAsImage(mockCanvas);

      expect(mockShare).toHaveBeenCalledWith({
        files: expect.arrayContaining([
          expect.objectContaining({
            name: "sunshine-optimist-story.png",
          }),
        ]),
        title: "Sunshine Optimist",
      });
    });

    it("returns false when user cancels (AbortError)", async () => {
      const mockBlob = new Blob(["test"], { type: "image/png" });
      const mockCanvas = {
        toBlob: vi.fn((callback) => {
          callback(mockBlob);
        }),
      };

      const abortError = new Error("User cancelled");
      abortError.name = "AbortError";
      global.navigator.share = vi.fn(() => Promise.reject(abortError));
      global.navigator.canShare = vi.fn(() => true);

      const result = await shareCanvasAsImage(mockCanvas);

      expect(result).toBe(false);
    });

    it("returns false and logs warning for other errors", async () => {
      const mockBlob = new Blob(["test"], { type: "image/png" });
      const mockCanvas = {
        toBlob: vi.fn((callback) => {
          callback(mockBlob);
        }),
      };

      const error = new Error("Network error");
      error.name = "NetworkError";
      global.navigator.share = vi.fn(() => Promise.reject(error));
      global.navigator.canShare = vi.fn(() => true);
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const result = await shareCanvasAsImage(mockCanvas);

      expect(result).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith("Share image failed:", error);
      consoleWarnSpy.mockRestore();
    });

    it("returns false when canvas.toBlob fails", async () => {
      const mockCanvas = {
        toBlob: vi.fn((callback) => {
          callback(null);
        }),
      };

      global.navigator.share = vi.fn(() => Promise.resolve());
      global.navigator.canShare = vi.fn(() => true);
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const result = await shareCanvasAsImage(mockCanvas);

      expect(result).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });

    it("returns false when file sharing is not supported", async () => {
      const mockCanvas = {
        toBlob: vi.fn(),
      };

      delete global.navigator.share;

      const result = await shareCanvasAsImage(mockCanvas);

      expect(result).toBe(false);
      expect(mockCanvas.toBlob).not.toHaveBeenCalled();
    });
  });
});
