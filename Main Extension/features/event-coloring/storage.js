// ========================================
// EVENT COLORING STORAGE SERVICE
// ========================================
// Manages storage for event colors and color palettes
// Uses chrome.storage.sync for cross-device sync

(function () {
  'use strict';

  // Default color palette (ColorKit Essentials)
  const DEFAULT_PALETTE = {
    id: 'default',
    name: 'ColorKit Essentials',
    order: 0,
    isDefault: true,
    colors: [
      { hex: '#4285f4', name: 'Primary Blue' },
      { hex: '#ea4335', name: 'Alert Red' },
      { hex: '#34a853', name: 'Success Green' },
      { hex: '#fbbc04', name: 'Warning Yellow' },
      { hex: '#ff6d01', name: 'Vibrant Orange' },
      { hex: '#9c27b0', name: 'Deep Purple' },
      { hex: '#e91e63', name: 'Hot Pink' },
      { hex: '#00bcd4', name: 'Cyan' },
      { hex: '#8bc34a', name: 'Light Green' },
      { hex: '#ff9800', name: 'Amber' },
      { hex: '#607d8b', name: 'Blue Grey' },
      { hex: '#795548', name: 'Brown' },
    ],
  };

  // Storage keys
  const STORAGE_KEYS = {
    EVENT_COLORS: 'cf.eventColors',
    PALETTES: 'cf.eventColorPalettes',
    GOOGLE_COLOR_LABELS: 'cf.googleColorLabels',
    SETTINGS: 'cf.eventColoringSettings',
  };

  // ========================================
  // EVENT COLOR OPERATIONS
  // ========================================

  /**
   * Save color for an event
   * @param {string} eventId - Google Calendar event ID
   * @param {string} hex - Color hex code
   * @param {boolean} isRecurring - Whether this is a recurring event
   * @returns {Promise<void>}
   */
  async function saveEventColor(eventId, hex, isRecurring = false) {
    if (!eventId || !hex) {
      throw new Error('eventId and hex are required');
    }

    return new Promise((resolve, reject) => {
      chrome.storage.sync.get(STORAGE_KEYS.EVENT_COLORS, (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }

        const eventColors = result[STORAGE_KEYS.EVENT_COLORS] || {};
        eventColors[eventId] = {
          hex,
          isRecurring,
          timestamp: Date.now(),
        };

        chrome.storage.sync.set({ [STORAGE_KEYS.EVENT_COLORS]: eventColors }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            console.log(`[Event Coloring] Saved color ${hex} for event ${eventId}`);
            resolve();
          }
        });
      });
    });
  }

  /**
   * Get color for an event
   * @param {string} eventId - Google Calendar event ID
   * @returns {Promise<Object|null>} Color data or null if not found
   */
  async function getEventColor(eventId) {
    if (!eventId) return null;

    return new Promise((resolve) => {
      chrome.storage.sync.get(STORAGE_KEYS.EVENT_COLORS, (result) => {
        const eventColors = result[STORAGE_KEYS.EVENT_COLORS] || {};
        resolve(eventColors[eventId] || null);
      });
    });
  }

  /**
   * Get all event colors
   * @returns {Promise<Object>} Map of eventId -> color data
   */
  async function getAllEventColors() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(STORAGE_KEYS.EVENT_COLORS, (result) => {
        resolve(result[STORAGE_KEYS.EVENT_COLORS] || {});
      });
    });
  }

  /**
   * Remove color from an event
   * @param {string} eventId - Google Calendar event ID
   * @returns {Promise<void>}
   */
  async function removeEventColor(eventId) {
    if (!eventId) return;

    return new Promise((resolve, reject) => {
      chrome.storage.sync.get(STORAGE_KEYS.EVENT_COLORS, (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }

        const eventColors = result[STORAGE_KEYS.EVENT_COLORS] || {};
        delete eventColors[eventId];

        chrome.storage.sync.set({ [STORAGE_KEYS.EVENT_COLORS]: eventColors }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            console.log(`[Event Coloring] Removed color for event ${eventId}`);
            resolve();
          }
        });
      });
    });
  }

  /**
   * Apply color to all instances of a recurring event
   * @param {string} baseEventId - Base event ID for the recurring series
   * @param {string} hex - Color hex code
   * @returns {Promise<void>}
   */
  async function saveRecurringEventColor(baseEventId, hex) {
    if (!baseEventId || !hex) {
      throw new Error('baseEventId and hex are required');
    }

    return saveEventColor(baseEventId, hex, true);
  }

  // ========================================
  // PALETTE OPERATIONS
  // ========================================

  /**
   * Initialize default palette if none exists
   * @returns {Promise<void>}
   */
  async function initializeDefaultPalette() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(STORAGE_KEYS.PALETTES, (result) => {
        const palettes = result[STORAGE_KEYS.PALETTES] || {};

        // Only initialize if no palettes exist
        if (Object.keys(palettes).length === 0) {
          palettes[DEFAULT_PALETTE.id] = DEFAULT_PALETTE;

          chrome.storage.sync.set({ [STORAGE_KEYS.PALETTES]: palettes }, () => {
            console.log('[Event Coloring] Default palette initialized');
            resolve();
          });
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Get all color palettes
   * @returns {Promise<Object>} Map of paletteId -> palette data
   */
  async function getAllPalettes() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(STORAGE_KEYS.PALETTES, (result) => {
        resolve(result[STORAGE_KEYS.PALETTES] || {});
      });
    });
  }

  /**
   * Get a specific palette by ID
   * @param {string} paletteId - Palette ID
   * @returns {Promise<Object|null>} Palette data or null
   */
  async function getPalette(paletteId) {
    if (!paletteId) return null;

    return new Promise((resolve) => {
      chrome.storage.sync.get(STORAGE_KEYS.PALETTES, (result) => {
        const palettes = result[STORAGE_KEYS.PALETTES] || {};
        resolve(palettes[paletteId] || null);
      });
    });
  }

  /**
   * Save a color palette
   * @param {Object} palette - Palette data
   * @returns {Promise<void>}
   */
  async function savePalette(palette) {
    if (!palette || !palette.id) {
      throw new Error('Palette must have an id');
    }

    return new Promise((resolve, reject) => {
      chrome.storage.sync.get(STORAGE_KEYS.PALETTES, (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }

        const palettes = result[STORAGE_KEYS.PALETTES] || {};
        palettes[palette.id] = {
          ...palette,
          updatedAt: Date.now(),
        };

        chrome.storage.sync.set({ [STORAGE_KEYS.PALETTES]: palettes }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            console.log(`[Event Coloring] Saved palette: ${palette.name}`);
            resolve();
          }
        });
      });
    });
  }

  /**
   * Delete a color palette
   * @param {string} paletteId - Palette ID
   * @returns {Promise<void>}
   */
  async function deletePalette(paletteId) {
    if (!paletteId) return;

    return new Promise((resolve, reject) => {
      chrome.storage.sync.get(STORAGE_KEYS.PALETTES, (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }

        const palettes = result[STORAGE_KEYS.PALETTES] || {};

        // Don't allow deleting the default palette
        if (palettes[paletteId]?.isDefault) {
          reject(new Error('Cannot delete default palette'));
          return;
        }

        delete palettes[paletteId];

        chrome.storage.sync.set({ [STORAGE_KEYS.PALETTES]: palettes }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            console.log(`[Event Coloring] Deleted palette: ${paletteId}`);
            resolve();
          }
        });
      });
    });
  }

  // ========================================
  // GOOGLE COLOR LABELS
  // ========================================

  /**
   * Save custom label for a Google color
   * @param {string} googleColorHex - Google's color hex
   * @param {string} customLabel - Custom label
   * @returns {Promise<void>}
   */
  async function saveGoogleColorLabel(googleColorHex, customLabel) {
    if (!googleColorHex || !customLabel) return;

    return new Promise((resolve, reject) => {
      chrome.storage.sync.get(STORAGE_KEYS.GOOGLE_COLOR_LABELS, (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }

        const labels = result[STORAGE_KEYS.GOOGLE_COLOR_LABELS] || {};
        labels[googleColorHex] = customLabel;

        chrome.storage.sync.set({ [STORAGE_KEYS.GOOGLE_COLOR_LABELS]: labels }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });
    });
  }

  /**
   * Get custom label for a Google color
   * @param {string} googleColorHex - Google's color hex
   * @returns {Promise<string|null>}
   */
  async function getGoogleColorLabel(googleColorHex) {
    if (!googleColorHex) return null;

    return new Promise((resolve) => {
      chrome.storage.sync.get(STORAGE_KEYS.GOOGLE_COLOR_LABELS, (result) => {
        const labels = result[STORAGE_KEYS.GOOGLE_COLOR_LABELS] || {};
        resolve(labels[googleColorHex] || null);
      });
    });
  }

  // ========================================
  // SETTINGS
  // ========================================

  /**
   * Get event coloring settings
   * @returns {Promise<Object>}
   */
  async function getSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(STORAGE_KEYS.SETTINGS, (result) => {
        const defaultSettings = {
          enabled: true,
          showGoogleColors: true,
          lastSync: null,
        };
        resolve({ ...defaultSettings, ...(result[STORAGE_KEYS.SETTINGS] || {}) });
      });
    });
  }

  /**
   * Update event coloring settings
   * @param {Object} settings - Settings to update
   * @returns {Promise<void>}
   */
  async function updateSettings(settings) {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.get(STORAGE_KEYS.SETTINGS, (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }

        const currentSettings = result[STORAGE_KEYS.SETTINGS] || {};
        const updatedSettings = { ...currentSettings, ...settings };

        chrome.storage.sync.set({ [STORAGE_KEYS.SETTINGS]: updatedSettings }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });
    });
  }

  // ========================================
  // UTILITY FUNCTIONS
  // ========================================

  /**
   * Get storage quota information
   * @returns {Promise<Object>}
   */
  async function getStorageQuota() {
    return new Promise((resolve) => {
      chrome.storage.sync.getBytesInUse(null, (bytesInUse) => {
        const quota = chrome.storage.sync.QUOTA_BYTES || 102400; // 100KB
        const percentUsed = (bytesInUse / quota) * 100;

        resolve({
          bytesInUse,
          quota,
          percentUsed: percentUsed.toFixed(1),
          remaining: quota - bytesInUse,
        });
      });
    });
  }

  /**
   * Clear all event coloring data (for reset/debugging)
   * @returns {Promise<void>}
   */
  async function clearAllData() {
    return new Promise((resolve, reject) => {
      const keys = Object.values(STORAGE_KEYS);

      chrome.storage.sync.remove(keys, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          console.log('[Event Coloring] All data cleared');
          resolve();
        }
      });
    });
  }

  /**
   * Generate a unique ID for palettes
   * @returns {string}
   */
  function generateId() {
    return `palette_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ========================================
  // EXPORT API
  // ========================================

  window.eventColoringStorage = {
    // Event colors
    saveEventColor,
    getEventColor,
    getAllEventColors,
    removeEventColor,
    saveRecurringEventColor,

    // Palettes
    initializeDefaultPalette,
    getAllPalettes,
    getPalette,
    savePalette,
    deletePalette,

    // Google color labels
    saveGoogleColorLabel,
    getGoogleColorLabel,

    // Settings
    getSettings,
    updateSettings,

    // Utilities
    getStorageQuota,
    clearAllData,
    generateId,

    // Constants
    STORAGE_KEYS,
    DEFAULT_PALETTE,
  };

  console.log('[Event Coloring] Storage service loaded');
})();
