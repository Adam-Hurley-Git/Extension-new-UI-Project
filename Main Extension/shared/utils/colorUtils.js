/**
 * Color Utilities
 * Shared color manipulation helpers
 *
 * @module colorUtils
 */

/**
 * Calculate readable text color (black or white) based on background
 * @param {string} hexColor - Background hex color
 * @param {number} [opacity=100] - Opacity percentage (0-100)
 * @returns {string} '#000000' or '#ffffff'
 */
function getReadableTextColor(hexColor, opacity = 100) {
  if (!hexColor) return '#000000';

  // Convert hex to RGB
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  // Apply opacity to RGB values (blend with white background)
  const alpha = opacity / 100;
  const blendedR = Math.round(r * alpha + 255 * (1 - alpha));
  const blendedG = Math.round(g * alpha + 255 * (1 - alpha));
  const blendedB = Math.round(b * alpha + 255 * (1 - alpha));

  // Calculate luminance using the relative luminance formula
  const luminance = (0.299 * blendedR + 0.587 * blendedG + 0.114 * blendedB) / 255;

  // Return white for dark backgrounds, black for light backgrounds
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

/**
 * Convert hex color to RGB object
 * @param {string} hex - Hex color string
 * @returns {{r: number, g: number, b: number}|null}
 */
function hexToRgb(hex) {
  if (!hex) return null;

  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Convert RGB values to hex string
 * @param {number} r - Red (0-255)
 * @param {number} g - Green (0-255)
 * @param {number} b - Blue (0-255)
 * @returns {string} Hex color string
 */
function rgbToHex(r, g, b) {
  return (
    '#' +
    [r, g, b]
      .map((x) => {
        const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      })
      .join('')
  );
}

/**
 * Convert hex color to HSL object
 * @param {string} hex - Hex color string
 * @returns {{h: number, s: number, l: number}|null}
 */
function hexToHsl(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;

  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h,
    s,
    l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Convert HSL to hex
 * @param {number} h - Hue (0-360)
 * @param {number} s - Saturation (0-100)
 * @param {number} l - Lightness (0-100)
 * @returns {string} Hex color string
 */
function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r, g, b;

  if (h >= 0 && h < 60) {
    [r, g, b] = [c, x, 0];
  } else if (h >= 60 && h < 120) {
    [r, g, b] = [x, c, 0];
  } else if (h >= 120 && h < 180) {
    [r, g, b] = [0, c, x];
  } else if (h >= 180 && h < 240) {
    [r, g, b] = [0, x, c];
  } else if (h >= 240 && h < 300) {
    [r, g, b] = [x, 0, c];
  } else {
    [r, g, b] = [c, 0, x];
  }

  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

/**
 * Lighten a color by a percentage
 * @param {string} hex - Hex color
 * @param {number} percent - Percentage to lighten (0-100)
 * @returns {string} Lightened hex color
 */
function lightenColor(hex, percent) {
  const hsl = hexToHsl(hex);
  if (!hsl) return hex;

  const newL = Math.min(100, hsl.l + percent);
  return hslToHex(hsl.h, hsl.s, newL);
}

/**
 * Darken a color by a percentage
 * @param {string} hex - Hex color
 * @param {number} percent - Percentage to darken (0-100)
 * @returns {string} Darkened hex color
 */
function darkenColor(hex, percent) {
  const hsl = hexToHsl(hex);
  if (!hsl) return hex;

  const newL = Math.max(0, hsl.l - percent);
  return hslToHex(hsl.h, hsl.s, newL);
}

/**
 * Apply opacity to a color (blend with white)
 * @param {string} hex - Hex color
 * @param {number} opacity - Opacity (0-1)
 * @returns {string} Color with opacity applied
 */
function applyOpacity(hex, opacity) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const blendedR = Math.round(rgb.r * opacity + 255 * (1 - opacity));
  const blendedG = Math.round(rgb.g * opacity + 255 * (1 - opacity));
  const blendedB = Math.round(rgb.b * opacity + 255 * (1 - opacity));

  return rgbToHex(blendedR, blendedG, blendedB);
}

/**
 * Validate hex color string
 * @param {string} hex - Color string to validate
 * @returns {boolean} Whether the string is a valid hex color
 */
function isValidHex(hex) {
  if (!hex || typeof hex !== 'string') return false;
  return /^#[0-9A-Fa-f]{6}$/.test(hex);
}

/**
 * Normalize hex color (ensure # prefix, uppercase)
 * @param {string} hex - Hex color
 * @returns {string|null} Normalized hex or null if invalid
 */
function normalizeHex(hex) {
  if (!hex) return null;

  let normalized = hex.trim();
  if (!normalized.startsWith('#')) {
    normalized = '#' + normalized;
  }
  normalized = normalized.toUpperCase();

  return isValidHex(normalized) ? normalized : null;
}

/**
 * Create a gradient string for calendar stripe preservation
 * @param {string} calendarColor - Original calendar color (4px stripe)
 * @param {string} customColor - Custom background color
 * @returns {string} CSS linear-gradient value
 */
function createCalendarStripeGradient(calendarColor, customColor) {
  return `linear-gradient(to right, ${calendarColor} 4px, ${customColor} 4px)`;
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getReadableTextColor,
    hexToRgb,
    rgbToHex,
    hexToHsl,
    hslToHex,
    lightenColor,
    darkenColor,
    applyOpacity,
    isValidHex,
    normalizeHex,
    createCalendarStripeGradient,
  };
}

if (typeof window !== 'undefined') {
  window.colorUtils = {
    getReadableTextColor,
    hexToRgb,
    rgbToHex,
    hexToHsl,
    hslToHex,
    lightenColor,
    darkenColor,
    applyOpacity,
    isValidHex,
    normalizeHex,
    createCalendarStripeGradient,
  };
}

export {
  getReadableTextColor,
  hexToRgb,
  rgbToHex,
  hexToHsl,
  hslToHex,
  lightenColor,
  darkenColor,
  applyOpacity,
  isValidHex,
  normalizeHex,
  createCalendarStripeGradient,
};
