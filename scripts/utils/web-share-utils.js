/**
 * Web Share API utilities for native mobile sharing
 */

/**
 * Check if device is mobile
 * @returns {boolean} True if on a mobile device
 */
export const isMobileDevice = () => {
  if (typeof navigator === "undefined") {
    return false;
  }

  // Check for mobile user agent
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;

  // Also check for touch support and narrow screen as additional indicators
  const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const isNarrowScreen = window.innerWidth <= 768;

  return mobileRegex.test(userAgent.toLowerCase()) || (hasTouch && isNarrowScreen);
};

/**
 * Check if Web Share API is available
 * @returns {boolean} True if navigator.share is supported
 */
export const isWebShareSupported = () => {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
};

/**
 * Check if Web Share API is available for social media sharing
 * This checks both Web Share API support AND if device is mobile
 * @returns {boolean} True if Web Share should be used for social sharing
 */
export const isWebShareAvailableForSocial = () => {
  return isWebShareSupported() && isMobileDevice();
};

/**
 * Check if Web Share API can share files
 * @returns {boolean} True if files can be shared
 */
export const canShareFiles = () => {
  if (!isWebShareSupported()) {
    return false;
  }

  // Check if files can be shared
  try {
    const testFile = new File([""], "test.png", { type: "image/png" });
    return Boolean(navigator.canShare && navigator.canShare({ files: [testFile] }));
  } catch {
    return false;
  }
};

/**
 * Share text using Web Share API
 * @param {string} text - The text to share
 * @param {string} title - The title for the share dialog
 * @returns {Promise<boolean>} True if share was successful, false if cancelled or failed
 */
export const shareText = async (text, title = "Sunshine Optimist") => {
  if (!isWebShareSupported()) {
    return false;
  }

  try {
    await navigator.share({
      title,
      text,
    });
    return true;
  } catch (error) {
    // User cancelled or share failed
    if (error.name === "AbortError") {
      // User cancelled - not a real error
      return false;
    }
    console.warn("Share failed:", error);
    return false;
  }
};

/**
 * Share image from canvas using Web Share API
 * @param {HTMLCanvasElement} canvas - The canvas element to share
 * @param {string} filename - The filename for the shared image
 * @returns {Promise<boolean>} True if share was successful, false if cancelled or failed
 */
export const shareCanvasAsImage = async (canvas, filename = "sunshine-optimist-story.png") => {
  if (!canShareFiles()) {
    return false;
  }

  try {
    // Convert canvas to blob
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to create blob from canvas"));
          }
        },
        "image/png",
        1.0
      );
    });

    // Create File from blob
    const file = new File([blob], filename, {
      type: "image/png",
      lastModified: new Date().getTime(),
    });

    // Share the file
    await navigator.share({
      files: [file],
      title: "Sunshine Optimist",
    });

    return true;
  } catch (error) {
    if (error.name === "AbortError") {
      return false;
    }
    console.warn("Share image failed:", error);
    return false;
  }
};
