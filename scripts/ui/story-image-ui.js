/**
 * Instagram story image generation
 */

const STORY_WIDTH = 1080;
const STORY_HEIGHT = 1920;

/**
 * Wrap text to fit within a maximum width
 */
const wrapText = (ctx, text, maxWidth) => {
  const words = text.split(" ");
  const lines = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
};

/**
 * Draw the warm gradient background
 */
const drawGradient = (ctx, width, height) => {
  const gradient = ctx.createLinearGradient(0, height, width, 0);
  gradient.addColorStop(0, "#FFEB3B");
  gradient.addColorStop(0.5, "#FF9800");
  gradient.addColorStop(1, "#FF5722");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
};

/**
 * Generate Instagram story canvas
 */
export const generateStoryCanvas = async (headline, locationLabel) => {
  await document.fonts.ready;

  const canvas = document.createElement("canvas");
  canvas.width = STORY_WIDTH;
  canvas.height = STORY_HEIGHT;
  const ctx = canvas.getContext("2d");

  drawGradient(ctx, STORY_WIDTH, STORY_HEIGHT);

  ctx.textBaseline = "top";
  ctx.fillStyle = "#FFFFFF";

  const padding = 80;
  const maxTextWidth = STORY_WIDTH - padding * 2;

  // Font sizes (larger)
  const locationFontSize = 72;
  const headlineFontSize = 84;
  const footerFontSize = 36;

  // Line heights
  const locationLineHeight = 100;
  const headlineLineHeight = 110;
  const gapAfterLocation = 40;
  const gapBeforeFooter = 60;

  // Prepare text content
  const locationText = locationLabel ? `${locationLabel}` : "";
  const locationLine = locationText
    ? `\u2600\uFE0F${locationText}\u2600\uFE0F`
    : "\u2600\uFE0F\u2600\uFE0F\u2600\uFE0F";
  const goodNewsText = `Good news! ${headline}`;
  const footerText = "from SunshineOptimist.com";

  // Calculate headline lines for height measurement
  ctx.font = `bold ${headlineFontSize}px Merriweather, serif`;
  const headlineLines = wrapText(ctx, goodNewsText, maxTextWidth);

  // Calculate total content height
  const totalHeight =
    locationLineHeight +
    gapAfterLocation +
    headlineLines.length * headlineLineHeight +
    gapBeforeFooter +
    footerFontSize;

  // Center vertically
  let y = (STORY_HEIGHT - totalHeight) / 2;

  // Draw location line
  ctx.font = `bold ${locationFontSize}px Merriweather, serif`;
  ctx.shadowColor = "rgba(0, 0, 0, 0.15)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  ctx.fillText(locationLine, padding, y);
  y += locationLineHeight + gapAfterLocation;

  // Draw headline lines
  ctx.font = `bold ${headlineFontSize}px Merriweather, serif`;
  for (const line of headlineLines) {
    ctx.fillText(line, padding, y);
    y += headlineLineHeight;
  }

  // Draw footer
  y += gapBeforeFooter;
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.font = `${footerFontSize}px Merriweather, serif`;
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.fillText(footerText, padding, y);

  return canvas;
};

/**
 * Download story image from canvas
 */
export const downloadStoryImage = (canvas) => {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to create image blob"));
          return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "sunshine-optimist-story.png";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        resolve();
      },
      "image/png",
      1.0
    );
  });
};
