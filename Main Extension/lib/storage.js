// cc3 storage utilities (no module syntax to keep content scripts simple)
(function () {
  const DEFAULT_PRESET_COLORS = [
    '#FDE68A',
    '#BFDBFE',
    '#C7D2FE',
    '#FBCFE8',
    '#BBF7D0',
    '#FCA5A5',
    '#A7F3D0',
    '#F5D0FE',
    '#FDE68A',
    '#E9D5FF',
  ];

  const DEFAULT_WEEKDAY_COLORS = {
    0: '#ffd5d5', // Sunday - Light coral/rose
    1: '#e8deff', // Monday - Light lavender
    2: '#d5f5e3', // Tuesday - Light mint
    3: '#ffe8d5', // Wednesday - Light peach
    4: '#d5f0ff', // Thursday - Light sky blue
    5: '#fff5d5', // Friday - Light yellow
    6: '#f0d5ff', // Saturday - Light lilac
  };

  const DEFAULT_WEEKDAY_OPACITY = {
    0: 30, // Sunday
    1: 30, // Monday
    2: 30, // Tuesday
    3: 30, // Wednesday
    4: 30, // Thursday
    5: 30, // Friday
    6: 30, // Saturday
  };

  const defaultSettings = {
    enabled: true, // Day coloring enabled by default
    weekdayColors: DEFAULT_WEEKDAY_COLORS,
    weekdayOpacity: DEFAULT_WEEKDAY_OPACITY,
    dateColors: {}, // 'YYYY-MM-DD' -> hex color
    dateOpacity: {}, // 'YYYY-MM-DD' -> opacity (0-100)
    presetColors: DEFAULT_PRESET_COLORS,
    weekStart: 0, // 0=Sunday, 1=Monday, 6=Saturday
    weekStartConfigured: false, // Whether user has explicitly set week start
    timeBlocking: {
      enabled: true, // Time blocking enabled by default
      globalColor: '#FFEB3B',
      shadingStyle: 'solid', // "solid" or "hashed"
      weeklySchedule: {
        mon: [],
        tue: [],
        wed: [],
        thu: [],
        fri: [],
        sat: [],
        sun: [],
      },
      dateSpecificSchedule: {}, // 'YYYY-MM-DD' -> array of timeblocks
    },
    eventColoring: {
      enabled: true, // Event coloring enabled by default
      categories: {}, // User-defined color categories
      templates: {}, // User-defined color templates (bg/text/border/borderWidth presets)
      googleColorLabels: {}, // Custom labels for Google's built-in colors
      quickAccessColors: [], // Recently used colors
      disableCustomColors: false, // Hide custom categories, show only Google colors
      calendarColors: {}, // Per-calendar default colors: calendarId -> { background, text, border }
    },
  };

  function deepMerge(base, partial) {
    // Replace-keys: when these appear at the current level, we do a hard replace
    // This ensures deletions work properly (removed keys stay removed)
    const REPLACE_KEYS = new Set([
      'dateSpecificSchedule',
      'weeklySchedule',
      'pendingTextColors', // Text colors need hard replace for deletions
      'textColors', // Text colors need hard replace for deletions
      'completedStyling', // Completed styling needs hard replace for deletions
      'calendarColors', // Calendar colors need hard replace for deletions
      'categories', // Event color categories need hard replace for deletions
      'templates', // Event color templates need hard replace for deletions
      'dateColors', // Date-specific day colors need hard replace for deletions
    ]);

    // If either side isn't a plain object, prefer partial directly
    const isPlainObject = (v) => v && typeof v === 'object' && !Array.isArray(v);

    if (!isPlainObject(base) || !isPlainObject(partial)) {
      return partial;
    }

    const out = { ...base };

    for (const k in partial) {
      const pv = partial[k];

      // For arrays, always replace
      if (Array.isArray(pv)) {
        out[k] = pv;
        continue;
      }

      // For specific nested maps, hard replace (so removals stick)
      if (REPLACE_KEYS.has(k)) {
        out[k] = isPlainObject(pv) ? { ...pv } : pv;
        continue;
      }

      // Otherwise, recurse for plain objects
      if (isPlainObject(pv)) {
        out[k] = deepMerge(base[k] || {}, pv);
      } else {
        out[k] = pv; // primitives -> replace
      }
    }

    return out;
  }

  async function getSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get({ settings: defaultSettings }, (res) => {
        resolve(deepMerge(defaultSettings, res.settings || {}));
      });
    });
  }

  async function setSettings(partial) {
    const current = await getSettings();
    const next = deepMerge(current, partial);
    return new Promise((resolve) => {
      chrome.storage.sync.set({ settings: next }, () => resolve(next));
    });
  }

  function onSettingsChanged(callback) {
    const listener = (changes, area) => {
      if (area !== 'sync' || !changes.settings) return;
      const { newValue } = changes.settings;
      // Only call callback if we have a valid newValue, avoid falling back to defaults
      // which could override user choices with default enabled: true
      if (newValue) {
        callback(newValue);
      }
    };
    chrome.storage.onChanged.addListener(listener);

    // Return unsubscribe function for cleanup
    return () => chrome.storage.onChanged.removeListener(listener);
  }

  function ymdFromDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  async function setEnabled(enabled) {
    return setSettings({ enabled });
  }
  async function setWeekdayColor(weekdayIndex, color) {
    const key = String(weekdayIndex);
    return setSettings({ weekdayColors: { [key]: color } });
  }
  async function setWeekdayOpacity(weekdayIndex, opacity) {
    const key = String(weekdayIndex);
    return setSettings({ weekdayOpacity: { [key]: opacity } });
  }
  async function setDateColor(dateKey, color) {
    if (!dateKey) return;
    // Always get current dateColors and merge, since dateColors is in REPLACE_KEYS
    const current = await getSettings();
    const next = { ...(current.dateColors || {}) };

    if (color) {
      next[dateKey] = color;
    } else {
      delete next[dateKey];
    }

    return setSettings({ dateColors: next });
  }
  async function clearDateColor(dateKey) {
    return setDateColor(dateKey, null);
  }
  async function setDateOpacity(dateKey, opacity) {
    if (!dateKey) return;
    // Always get current dateOpacity and merge, since dateOpacity is in REPLACE_KEYS
    const current = await getSettings();
    const next = { ...(current.dateOpacity || {}) };

    if (opacity !== null && opacity !== undefined) {
      next[dateKey] = opacity;
    } else {
      delete next[dateKey];
    }

    return setSettings({ dateOpacity: next });
  }
  async function setDateColorLabel(dateKey, label) {
    if (!dateKey) return;
    // Always get current dateColorLabels and merge
    const current = await getSettings();
    const next = { ...(current.dateColorLabels || {}) };

    if (label !== null && label !== undefined && label.trim() !== '') {
      next[dateKey] = label.trim();
    } else {
      delete next[dateKey];
    }

    return setSettings({ dateColorLabels: next });
  }
  async function addPresetColor(color) {
    const current = await getSettings();
    const set = new Set([...(current.presetColors || []), color]);
    return setSettings({ presetColors: Array.from(set).slice(0, 32) });
  }
  async function setWeekStart(weekStart) {
    return setSettings({ weekStart });
  }
  async function setWeekStartConfigured(configured) {
    return setSettings({ weekStartConfigured: configured });
  }

  // ========================================
  // EVENT COLORING FUNCTIONS
  // ========================================

  /**
   * Enable/disable event coloring feature
   * @param {boolean} enabled - Enable event coloring
   * @returns {Promise<Object>} Updated settings
   */
  async function setEventColoringEnabled(enabled) {
    return setSettings({
      eventColoring: { enabled },
    });
  }

  /**
   * Get event coloring settings
   * @returns {Promise<Object>} Event coloring settings
   */
  async function getEventColoringSettings() {
    const all = await getSettings();
    return all.eventColoring || {};
  }

  /**
   * Add or update an event color category
   * @param {Object} category - Category object { id, name, colors, order }
   * @returns {Promise<Object>} Updated settings
   */
  async function setEventColorCategory(category) {
    if (!category || !category.id) return;

    const current = await getSettings();
    const categories = current.eventColoring?.categories || {};
    categories[category.id] = category;

    return setSettings({
      eventColoring: { categories },
    });
  }

  /**
   * Delete an event color category
   * @param {string} categoryId - Category ID to delete
   * @returns {Promise<Object>} Updated settings
   */
  async function deleteEventColorCategory(categoryId) {
    if (!categoryId) return;

    const current = await getSettings();
    const categories = { ...(current.eventColoring?.categories || {}) };
    delete categories[categoryId];

    return setSettings({
      eventColoring: { categories },
    });
  }

  /**
   * Get all event color categories
   * @returns {Promise<Object>} All categories
   */
  async function getEventColorCategories() {
    const settings = await getSettings();
    return settings.eventColoring?.categories || {};
  }

  // ========================================
  // EVENT COLOR TEMPLATES
  // Templates are multi-property color presets (bg/text/border/borderWidth)
  // ========================================

  /**
   * Get all event color templates
   * @returns {Promise<Object>} - { templateId: templateData, ... }
   */
  async function getEventColorTemplates() {
    const settings = await getSettings();
    return settings.eventColoring?.templates || {};
  }

  /**
   * Get a single template by ID
   * @param {string} templateId
   * @returns {Promise<Object|null>}
   */
  async function getEventColorTemplate(templateId) {
    const templates = await getEventColorTemplates();
    return templates[templateId] || null;
  }

  /**
   * Save/update an event color template
   * @param {Object} template - Template object with id, name, background, text, border, borderWidth, categoryId, order
   * @returns {Promise<Object>} Updated settings
   */
  async function setEventColorTemplate(template) {
    if (!template) return;

    // Generate ID if not present
    if (!template.id) {
      template.id = `tmpl_${Date.now()}`;
    }

    // Set timestamps
    template.updatedAt = Date.now();
    if (!template.createdAt) {
      template.createdAt = template.updatedAt;
    }

    const current = await getSettings();
    const templates = current.eventColoring?.templates || {};
    templates[template.id] = template;

    return setSettings({
      eventColoring: { templates },
    });
  }

  /**
   * Delete an event color template
   * @param {string} templateId - Template ID to delete
   * @returns {Promise<Object>} Updated settings
   */
  async function deleteEventColorTemplate(templateId) {
    if (!templateId) return;

    const current = await getSettings();
    const templates = { ...(current.eventColoring?.templates || {}) };
    delete templates[templateId];

    return setSettings({
      eventColoring: { templates },
    });
  }

  /**
   * Reorder templates (update order field for multiple templates)
   * @param {Array<{id: string, order: number}>} orderUpdates
   * @returns {Promise<Object>} Updated settings
   */
  async function reorderEventColorTemplates(orderUpdates) {
    if (!orderUpdates || !Array.isArray(orderUpdates)) return;

    const current = await getSettings();
    const templates = { ...(current.eventColoring?.templates || {}) };

    for (const update of orderUpdates) {
      if (templates[update.id]) {
        templates[update.id] = {
          ...templates[update.id],
          order: update.order,
          updatedAt: Date.now(),
        };
      }
    }

    return setSettings({
      eventColoring: { templates },
    });
  }

  /**
   * Get templates for a specific category (assigned to it)
   * @param {string} categoryId
   * @returns {Promise<Array>} - Sorted array of templates
   */
  async function getTemplatesForCategory(categoryId) {
    const templates = await getEventColorTemplates();
    return Object.values(templates)
      .filter((t) => t.categoryId === categoryId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  /**
   * Get unassigned templates (not assigned to any category)
   * @returns {Promise<Array>} - Sorted array of templates
   */
  async function getUnassignedTemplates() {
    const templates = await getEventColorTemplates();
    return Object.values(templates)
      .filter((t) => !t.categoryId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  /**
   * Assign template to a category
   * @param {string} templateId
   * @param {string|null} categoryId - null to unassign
   * @returns {Promise<Object>} Updated settings
   */
  async function assignTemplateToCategory(templateId, categoryId) {
    const template = await getEventColorTemplate(templateId);
    if (template) {
      template.categoryId = categoryId;
      return setEventColorTemplate(template);
    }
  }

  /**
   * Set custom label for a Google color
   * @param {string} colorHex - Color hex code
   * @param {string} label - Custom label
   * @returns {Promise<Object>} Updated settings
   */
  async function setGoogleColorLabel(colorHex, label) {
    if (!colorHex) return;

    const current = await getSettings();
    const labels = current.eventColoring?.googleColorLabels || {};
    labels[colorHex] = label;

    return setSettings({
      eventColoring: { googleColorLabels: labels },
    });
  }

  /**
   * Get all Google color labels
   * @returns {Promise<Object>} Google color labels
   */
  async function getGoogleColorLabels() {
    const settings = await getSettings();
    return settings.eventColoring?.googleColorLabels || {};
  }

  /**
   * Set Google color scheme (modern or classic)
   * @param {string} scheme - 'modern' or 'classic'
   * @returns {Promise<Object>} Updated settings
   */
  async function setGoogleColorScheme(scheme) {
    return setSettings({
      eventColoring: { googleColorScheme: scheme },
    });
  }

  /**
   * Get Google color scheme
   * @returns {Promise<string>} Color scheme ('modern' or 'classic')
   */
  async function getGoogleColorScheme() {
    const settings = await getSettings();
    return settings.eventColoring?.googleColorScheme || 'modern';
  }

  /**
   * Save event color
   * @param {string} eventId - Calendar event ID
   * @param {string} colorHex - Color hex code
   * @param {boolean} isRecurring - Whether event is recurring
   * @returns {Promise<void>}
   */
  async function saveEventColor(eventId, colorHex, isRecurring = false) {
    if (!eventId) return;

    return new Promise((resolve) => {
      chrome.storage.local.get('cf.eventColors', (result) => {
        const eventColors = result['cf.eventColors'] || {};

        eventColors[eventId] = {
          hex: colorHex,
          isRecurring,
          appliedAt: Date.now(),
        };

        chrome.storage.local.set({ 'cf.eventColors': eventColors }, () => {
          resolve();
        });
      });
    });
  }

  /**
   * Get event color
   * @param {string} eventId - Calendar event ID
   * @returns {Promise<Object|null>} Event color object or null
   */
  async function getEventColor(eventId) {
    if (!eventId) return null;

    return new Promise((resolve) => {
      chrome.storage.local.get('cf.eventColors', (result) => {
        const eventColors = result['cf.eventColors'] || {};
        resolve(eventColors[eventId] || null);
      });
    });
  }

  /**
   * Get all event colors
   * @returns {Promise<Object>} All event colors
   */
  async function getAllEventColors() {
    return new Promise((resolve) => {
      chrome.storage.local.get('cf.eventColors', (result) => {
        resolve(result['cf.eventColors'] || {});
      });
    });
  }

  /**
   * Remove event color
   * @param {string} eventId - Calendar event ID
   * @returns {Promise<void>}
   */
  async function removeEventColor(eventId) {
    if (!eventId) return;

    return new Promise((resolve) => {
      chrome.storage.local.get('cf.eventColors', (result) => {
        const eventColors = result['cf.eventColors'] || {};
        delete eventColors[eventId];

        chrome.storage.local.set({ 'cf.eventColors': eventColors }, () => {
          resolve();
        });
      });
    });
  }

  /**
   * Save event color with recurring event support
   * When saving a recurring event with applyToAll=true, stores under base event ID
   * and cleans up individual instance colors
   * @param {string} eventId - Calendar event ID
   * @param {string} colorHex - Color hex code (legacy single color)
   * @param {Object} options - Options { applyToAll: boolean }
   * @returns {Promise<void>}
   */
  async function saveEventColorAdvanced(eventId, colorHex, options = {}) {
    if (!eventId || !colorHex) return;

    const { applyToAll = false } = options;

    return new Promise((resolve) => {
      chrome.storage.local.get('cf.eventColors', (result) => {
        const eventColors = result['cf.eventColors'] || {};

        // Parse the event ID to check if recurring
        const parsed = parseEventId(eventId);

        if (applyToAll && parsed.isRecurring) {
          // Store under base ID for recurring events
          const baseStorageId = encodeEventId(parsed.decodedId, parsed.emailSuffix);

          console.log('[Storage] Storing recurring event:', {
            baseId: parsed.decodedId,
            emailSuffix: parsed.emailSuffix,
            storageId: baseStorageId,
            color: colorHex,
          });

          // Save with recurring flag
          eventColors[baseStorageId] = {
            hex: colorHex,
            isRecurring: true,
            appliedAt: Date.now(),
          };

          // Clean up any individual instance colors for this recurring event
          Object.keys(eventColors).forEach((storedId) => {
            try {
              const storedParsed = parseEventId(storedId);
              if (storedParsed.decodedId === parsed.decodedId && storedId !== baseStorageId) {
                delete eventColors[storedId];
              }
            } catch (e) {
              // Skip invalid IDs
            }
          });
        } else {
          // Single event or single instance
          eventColors[eventId] = {
            hex: colorHex,
            isRecurring: false,
            appliedAt: Date.now(),
          };
        }

        chrome.storage.local.set({ 'cf.eventColors': eventColors }, () => {
          resolve();
        });
      });
    });
  }

  /**
   * Save event colors with full background/text/border/borderWidth support
   * @param {string} eventId - Calendar event ID
   * @param {Object} colors - Colors { background, text, border, borderWidth }
   * @param {Object} options - Options { applyToAll: boolean }
   * @returns {Promise<void>}
   */
  async function saveEventColorsFullAdvanced(eventId, colors, options = {}) {
    if (!eventId) return;

    console.log('[Storage] saveEventColorsFullAdvanced called:', { eventId: eventId.slice(0, 30) + '...', colors });
    console.log('[Storage] colors.borderWidth:', colors.borderWidth, 'type:', typeof colors.borderWidth);

    const { applyToAll = false } = options;

    return new Promise((resolve) => {
      chrome.storage.local.get('cf.eventColors', (result) => {
        const eventColors = result['cf.eventColors'] || {};

        // Parse the event ID to check if recurring
        const parsed = parseEventId(eventId);

        // Use null-coalescing (??) for borderWidth to preserve explicit 0 values
        // but fall back to 2 if undefined/null
        const colorData = {
          background: colors.background || null,
          text: colors.text || null,
          border: colors.border || null,
          borderWidth: colors.borderWidth ?? 2, // Changed from || to ?? to properly handle numeric values
          // Keep hex for backward compatibility (use background as primary)
          hex: colors.background || null,
          isRecurring: false,
          appliedAt: Date.now(),
        };

        console.log('[Storage] colorData to store:', colorData);

        if (applyToAll && parsed.isRecurring) {
          // Store under base ID for recurring events
          const baseStorageId = encodeEventId(parsed.decodedId, parsed.emailSuffix);

          console.log('[Storage] Storing recurring event colors:', {
            baseId: parsed.decodedId,
            emailSuffix: parsed.emailSuffix,
            storageId: baseStorageId,
            colors,
          });

          colorData.isRecurring = true;
          eventColors[baseStorageId] = colorData;

          // Clean up any individual instance colors for this recurring event
          Object.keys(eventColors).forEach((storedId) => {
            try {
              const storedParsed = parseEventId(storedId);
              if (storedParsed.decodedId === parsed.decodedId && storedId !== baseStorageId) {
                delete eventColors[storedId];
              }
            } catch (e) {
              // Skip invalid IDs
            }
          });
        } else {
          // Single event or single instance
          eventColors[eventId] = colorData;
        }

        chrome.storage.local.set({ 'cf.eventColors': eventColors }, () => {
          resolve();
        });
      });
    });
  }

  /**
   * Get normalized event color data (handles both old and new formats)
   * @param {Object} colorData - Raw color data from storage
   * @returns {Object} Normalized { background, text, border, borderWidth, hex, isRecurring }
   */
  function normalizeEventColorData(colorData) {
    if (!colorData) return null;

    // Handle string format (very old)
    if (typeof colorData === 'string') {
      return {
        background: colorData,
        text: null,
        border: null,
        borderWidth: 2, // Default border width
        hex: colorData,
        isRecurring: false,
      };
    }

    // Handle old format with only hex
    if (colorData.hex && !colorData.background && colorData.background !== null) {
      return {
        background: colorData.hex,
        text: null,
        border: null,
        borderWidth: colorData.borderWidth || 2, // Default if not set
        hex: colorData.hex,
        isRecurring: colorData.isRecurring || false,
      };
    }

    // New format - return as-is with defaults
    return {
      background: colorData.background || null,
      text: colorData.text || null,
      border: colorData.border || null,
      borderWidth: colorData.borderWidth || 2, // Default if not set
      hex: colorData.hex || colorData.background || null,
      isRecurring: colorData.isRecurring || false,
    };
  }

  /**
   * Find event color considering recurring events (returns normalized format)
   * @param {string} eventId - Calendar event ID
   * @returns {Promise<{background, text, border, hex, isRecurring}|null>}
   */
  async function findEventColorFull(eventId) {
    if (!eventId) return null;

    return new Promise((resolve) => {
      chrome.storage.local.get('cf.eventColors', (result) => {
        const eventColors = result['cf.eventColors'] || {};

        // Direct match first
        if (eventColors[eventId]) {
          resolve(normalizeEventColorData(eventColors[eventId]));
          return;
        }

        // Check for recurring event match
        const parsed = parseEventId(eventId);
        if (parsed.type !== 'calendar') {
          resolve(null);
          return;
        }

        // Look for matching recurring event by base ID
        for (const [storedId, colorData] of Object.entries(eventColors)) {
          const normalized = normalizeEventColorData(colorData);
          if (normalized && normalized.isRecurring) {
            const storedParsed = parseEventId(storedId);
            if (storedParsed.decodedId === parsed.decodedId) {
              resolve(normalized);
              return;
            }
          }
        }

        resolve(null);
      });
    });
  }

  /**
   * Find event color considering recurring events
   * @param {string} eventId - Calendar event ID
   * @returns {Promise<{hex: string, isRecurring: boolean}|null>}
   */
  async function findEventColor(eventId) {
    if (!eventId) return null;

    return new Promise((resolve) => {
      chrome.storage.local.get('cf.eventColors', (result) => {
        const eventColors = result['cf.eventColors'] || {};

        // Direct match first
        if (eventColors[eventId]) {
          resolve(eventColors[eventId]);
          return;
        }

        // Check for recurring event match
        const parsed = parseEventId(eventId);
        if (parsed.type !== 'calendar') {
          resolve(null);
          return;
        }

        // Look for matching recurring event by base ID
        for (const [storedId, colorData] of Object.entries(eventColors)) {
          if (typeof colorData === 'object' && colorData.isRecurring) {
            const storedParsed = parseEventId(storedId);
            if (storedParsed.decodedId === parsed.decodedId) {
              resolve(colorData);
              return;
            }
          }
        }

        resolve(null);
      });
    });
  }

  /**
   * Parse a Google Calendar event ID
   * @param {string} encodedId - Base64 encoded event ID
   * @returns {Object} Parsed event info
   */
  function parseEventId(encodedId) {
    try {
      if (!encodedId) {
        return { type: 'invalid', isRecurring: false };
      }

      let decoded;
      try {
        decoded = atob(encodedId);
      } catch (e) {
        return {
          type: 'calendar',
          encodedId,
          decodedId: encodedId,
          isRecurring: false,
          emailSuffix: '',
        };
      }

      const emailMatch = decoded.match(/\s+(\S+@\S+)$/);
      const emailSuffix = emailMatch ? emailMatch[1] : '';
      const eventPart = emailSuffix
        ? decoded.substring(0, decoded.length - emailSuffix.length).trim()
        : decoded;

      const recurringMatch = eventPart.match(/^(.+?)(_\d{8}T\d{6}Z)?$/);
      const baseId = recurringMatch ? recurringMatch[1] : eventPart;
      const instanceDate = recurringMatch && recurringMatch[2] ? recurringMatch[2] : null;

      return {
        type: 'calendar',
        encodedId,
        decodedId: baseId,
        instanceDate,
        isRecurring: !!instanceDate,
        emailSuffix,
        fullDecoded: decoded,
      };
    } catch (error) {
      return { type: 'invalid', encodedId, isRecurring: false };
    }
  }

  /**
   * Encode an event ID
   * @param {string} decodedId - Base event ID
   * @param {string} emailSuffix - Email suffix
   * @returns {string} Base64 encoded event ID
   */
  function encodeEventId(decodedId, emailSuffix) {
    try {
      const combined = emailSuffix ? `${decodedId} ${emailSuffix}` : decodedId;
      return btoa(combined);
    } catch (error) {
      return decodedId;
    }
  }

  /**
   * Check if custom colors are disabled
   * @returns {Promise<boolean>}
   */
  async function getIsCustomColorsDisabled() {
    const settings = await getSettings();
    return settings.eventColoring?.disableCustomColors || false;
  }

  /**
   * Set disable custom colors flag
   * @param {boolean} disabled - Disable custom colors
   * @returns {Promise<Object>} Updated settings
   */
  async function setDisableCustomColors(disabled) {
    return setSettings({
      eventColoring: { disableCustomColors: disabled },
    });
  }

  /**
   * Add color to quick access
   * @param {string} colorHex - Color hex code
   * @returns {Promise<Object>} Updated settings
   */
  async function addQuickAccessColor(colorHex) {
    if (!colorHex) return;

    const current = await getSettings();
    const quickAccess = current.eventColoring?.quickAccessColors || [];

    // Remove if already exists, then add to front
    const filtered = quickAccess.filter(c => c !== colorHex);
    const updated = [colorHex, ...filtered].slice(0, 10); // Keep max 10

    return setSettings({
      eventColoring: { quickAccessColors: updated },
    });
  }

  // ========================================
  // EVENT CALENDAR COLORS (per-calendar default colors)
  // Completely separate from task list coloring
  // ========================================

  /**
   * Get all calendar colors
   * @returns {Promise<Object>} Map of calendarId -> { background, text, border }
   */
  async function getEventCalendarColors() {
    const settings = await getSettings();
    return settings.eventColoring?.calendarColors || {};
  }

  /**
   * Get colors for a specific calendar
   * @param {string} calendarId - Calendar ID (email)
   * @returns {Promise<Object|null>} { background, text, border } or null
   */
  async function getEventCalendarColor(calendarId) {
    if (!calendarId) return null;
    const calendarColors = await getEventCalendarColors();
    return calendarColors[calendarId] || null;
  }

  /**
   * Set background color for a calendar
   * @param {string} calendarId - Calendar ID (email)
   * @param {string} color - Hex color
   * @returns {Promise<Object>} Updated settings
   */
  async function setEventCalendarBackgroundColor(calendarId, color) {
    if (!calendarId) return;

    const current = await getSettings();
    const calendarColors = current.eventColoring?.calendarColors || {};
    const existingColors = calendarColors[calendarId] || {};

    calendarColors[calendarId] = {
      ...existingColors,
      background: color,
    };

    return setSettings({
      eventColoring: { calendarColors },
    });
  }

  /**
   * Set text color for a calendar
   * @param {string} calendarId - Calendar ID (email)
   * @param {string} color - Hex color
   * @returns {Promise<Object>} Updated settings
   */
  async function setEventCalendarTextColor(calendarId, color) {
    if (!calendarId) return;

    const current = await getSettings();
    const calendarColors = current.eventColoring?.calendarColors || {};
    const existingColors = calendarColors[calendarId] || {};

    calendarColors[calendarId] = {
      ...existingColors,
      text: color,
    };

    return setSettings({
      eventColoring: { calendarColors },
    });
  }

  /**
   * Set border color for a calendar
   * @param {string} calendarId - Calendar ID (email)
   * @param {string} color - Hex color
   * @returns {Promise<Object>} Updated settings
   */
  async function setEventCalendarBorderColor(calendarId, color) {
    if (!calendarId) return;

    const current = await getSettings();
    const calendarColors = current.eventColoring?.calendarColors || {};
    const existingColors = calendarColors[calendarId] || {};

    calendarColors[calendarId] = {
      ...existingColors,
      border: color,
    };

    return setSettings({
      eventColoring: { calendarColors },
    });
  }

  /**
   * Set border width for a calendar
   * @param {string} calendarId - Calendar ID (email)
   * @param {number} width - Border width in pixels (1-6)
   * @returns {Promise<Object>} Updated settings
   */
  async function setEventCalendarBorderWidth(calendarId, width) {
    if (!calendarId) return;

    // Validate width is within range
    const validWidth = Math.max(1, Math.min(6, parseInt(width) || 2));
    console.log('[Storage] setEventCalendarBorderWidth:', { calendarId, width, validWidth });

    const current = await getSettings();
    const calendarColors = current.eventColoring?.calendarColors || {};
    const existingColors = calendarColors[calendarId] || {};
    console.log('[Storage] Existing colors for calendar:', JSON.stringify(existingColors));

    calendarColors[calendarId] = {
      ...existingColors,
      borderWidth: validWidth,
    };
    console.log('[Storage] Updated colors for calendar:', JSON.stringify(calendarColors[calendarId]));

    return setSettings({
      eventColoring: { calendarColors },
    });
  }

  /**
   * Clear border width for a calendar (reset to default)
   * @param {string} calendarId - Calendar ID (email)
   * @returns {Promise<Object>} Updated settings
   */
  async function clearEventCalendarBorderWidth(calendarId) {
    if (!calendarId) return;

    const current = await getSettings();
    const calendarColors = { ...(current.eventColoring?.calendarColors || {}) };

    if (calendarColors[calendarId]) {
      const { borderWidth, ...rest } = calendarColors[calendarId];
      if (Object.keys(rest).filter(k => rest[k]).length === 0) {
        delete calendarColors[calendarId];
      } else {
        calendarColors[calendarId] = rest;
      }
    }

    return setSettings({
      eventColoring: { calendarColors },
    });
  }

  /**
   * Clear background color for a calendar
   * @param {string} calendarId - Calendar ID (email)
   * @returns {Promise<Object>} Updated settings
   */
  async function clearEventCalendarBackgroundColor(calendarId) {
    if (!calendarId) return;

    const current = await getSettings();
    const calendarColors = { ...(current.eventColoring?.calendarColors || {}) };

    if (calendarColors[calendarId]) {
      const { background, ...rest } = calendarColors[calendarId];
      if (Object.keys(rest).filter(k => rest[k]).length === 0) {
        delete calendarColors[calendarId];
      } else {
        calendarColors[calendarId] = rest;
      }
    }

    return setSettings({
      eventColoring: { calendarColors },
    });
  }

  /**
   * Clear text color for a calendar
   * @param {string} calendarId - Calendar ID (email)
   * @returns {Promise<Object>} Updated settings
   */
  async function clearEventCalendarTextColor(calendarId) {
    if (!calendarId) return;

    const current = await getSettings();
    const calendarColors = { ...(current.eventColoring?.calendarColors || {}) };

    if (calendarColors[calendarId]) {
      const { text, ...rest } = calendarColors[calendarId];
      if (Object.keys(rest).filter(k => rest[k]).length === 0) {
        delete calendarColors[calendarId];
      } else {
        calendarColors[calendarId] = rest;
      }
    }

    return setSettings({
      eventColoring: { calendarColors },
    });
  }

  /**
   * Clear border color for a calendar
   * @param {string} calendarId - Calendar ID (email)
   * @returns {Promise<Object>} Updated settings
   */
  async function clearEventCalendarBorderColor(calendarId) {
    if (!calendarId) return;

    const current = await getSettings();
    const calendarColors = { ...(current.eventColoring?.calendarColors || {}) };

    if (calendarColors[calendarId]) {
      const { border, ...rest } = calendarColors[calendarId];
      if (Object.keys(rest).filter(k => rest[k]).length === 0) {
        delete calendarColors[calendarId];
      } else {
        calendarColors[calendarId] = rest;
      }
    }

    return setSettings({
      eventColoring: { calendarColors },
    });
  }

  /**
   * Clear all colors for a calendar
   * @param {string} calendarId - Calendar ID (email)
   * @returns {Promise<Object>} Updated settings
   */
  async function clearEventCalendarColors(calendarId) {
    if (!calendarId) return;

    const current = await getSettings();
    const calendarColors = { ...(current.eventColoring?.calendarColors || {}) };
    delete calendarColors[calendarId];

    return setSettings({
      eventColoring: { calendarColors },
    });
  }

  // Time Blocking functions
  async function setTimeBlockingEnabled(enabled) {
    return setSettings({ timeBlocking: { enabled } });
  }

  async function setTimeBlockingGlobalColor(color) {
    return setSettings({ timeBlocking: { globalColor: color } });
  }

  async function setTimeBlockingShadingStyle(style) {
    return setSettings({ timeBlocking: { shadingStyle: style } });
  }

  async function setTimeBlockingSchedule(schedule) {
    return setSettings({ timeBlocking: { weeklySchedule: schedule } });
  }

  async function addTimeBlock(dayKey, timeBlock) {
    const current = await getSettings();
    const currentSchedule = current.timeBlocking?.weeklySchedule || {};
    const dayBlocks = currentSchedule[dayKey] || [];
    const newBlocks = [...dayBlocks, timeBlock];
    // Sort blocks by start time
    newBlocks.sort((a, b) => {
      const timeToMinutes = (time) => {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
      };
      return timeToMinutes(a.timeRange[0]) - timeToMinutes(b.timeRange[0]);
    });
    return setSettings({ timeBlocking: { weeklySchedule: { ...currentSchedule, [dayKey]: newBlocks } } });
  }

  async function removeTimeBlock(dayKey, blockIndex) {
    const current = await getSettings();
    const currentSchedule = current.timeBlocking?.weeklySchedule || {};
    const dayBlocks = currentSchedule[dayKey] || [];
    const newBlocks = dayBlocks.filter((_, index) => index !== blockIndex);
    return setSettings({ timeBlocking: { weeklySchedule: { ...currentSchedule, [dayKey]: newBlocks } } });
  }

  async function updateTimeBlock(dayKey, blockIndex, timeBlock) {
    const current = await getSettings();
    const currentSchedule = current.timeBlocking?.weeklySchedule || {};
    const dayBlocks = currentSchedule[dayKey] || [];
    const newBlocks = [...dayBlocks];
    if (blockIndex >= 0 && blockIndex < newBlocks.length) {
      newBlocks[blockIndex] = timeBlock;
      // Sort blocks by start time
      newBlocks.sort((a, b) => {
        const timeToMinutes = (time) => {
          const [hours, minutes] = time.split(':').map(Number);
          return hours * 60 + minutes;
        };
        return timeToMinutes(a.timeRange[0]) - timeToMinutes(b.timeRange[0]);
      });
    }
    return setSettings({ timeBlocking: { weeklySchedule: { ...currentSchedule, [dayKey]: newBlocks } } });
  }

  // Date-specific timeblock functions
  async function addDateSpecificTimeBlock(dateKey, timeBlock) {
    const current = await getSettings();
    const currentSchedule = current.timeBlocking?.dateSpecificSchedule || {};
    const dateBlocks = currentSchedule[dateKey] || [];
    const newBlocks = [...dateBlocks, timeBlock];
    // Sort blocks by start time
    newBlocks.sort((a, b) => {
      const timeToMinutes = (time) => {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
      };
      return timeToMinutes(a.timeRange[0]) - timeToMinutes(b.timeRange[0]);
    });
    return setSettings({ timeBlocking: { dateSpecificSchedule: { ...currentSchedule, [dateKey]: newBlocks } } });
  }

  async function removeDateSpecificTimeBlock(dateKey, blockIndex) {
    const current = await getSettings();
    const currentSchedule = current.timeBlocking?.dateSpecificSchedule || {};
    const dateBlocks = currentSchedule[dateKey] || [];
    const newBlocks = dateBlocks.filter((_, index) => index !== blockIndex);

    // If no blocks left for this date, remove the date key entirely
    if (newBlocks.length === 0) {
      const updatedSchedule = { ...currentSchedule };
      delete updatedSchedule[dateKey];
      return setSettings({ timeBlocking: { dateSpecificSchedule: updatedSchedule } });
    }

    return setSettings({ timeBlocking: { dateSpecificSchedule: { ...currentSchedule, [dateKey]: newBlocks } } });
  }

  async function updateDateSpecificTimeBlock(dateKey, blockIndex, timeBlock) {
    const current = await getSettings();
    const currentSchedule = current.timeBlocking?.dateSpecificSchedule || {};
    const dateBlocks = currentSchedule[dateKey] || [];
    const newBlocks = [...dateBlocks];
    if (blockIndex >= 0 && blockIndex < newBlocks.length) {
      newBlocks[blockIndex] = timeBlock;
      // Sort blocks by start time
      newBlocks.sort((a, b) => {
        const timeToMinutes = (time) => {
          const [hours, minutes] = time.split(':').map(Number);
          return hours * 60 + minutes;
        };
        return timeToMinutes(a.timeRange[0]) - timeToMinutes(b.timeRange[0]);
      });
    }
    return setSettings({ timeBlocking: { dateSpecificSchedule: { ...currentSchedule, [dateKey]: newBlocks } } });
  }

  async function clearDateSpecificBlocks(dateKey) {
    const current = await getSettings();
    const currentSchedule = current.timeBlocking?.dateSpecificSchedule || {};
    const updatedSchedule = { ...currentSchedule };
    delete updatedSchedule[dateKey];
    return setSettings({ timeBlocking: { dateSpecificSchedule: updatedSchedule } });
  }

  // Additional methods for feature registry compatibility
  async function get(key, defaultValue = null) {
    return new Promise((resolve) => {
      chrome.storage.sync.get([key], (result) => {
        resolve(result[key] || defaultValue);
      });
    });
  }

  async function set(key, value) {
    return new Promise((resolve) => {
      chrome.storage.sync.set({ [key]: value }, () => {
        resolve();
      });
    });
  }

  async function getAll() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(null, (result) => {
        resolve(result);
      });
    });
  }

  /**
   * Perform complete reset of all user settings and data
   * Preserves subscription status and system data
   * @returns {Promise<{success: boolean, results: object, error?: string}>}
   */
  async function performCompleteReset() {
    const results = {
      syncStorage: 'pending',
      settings: 'pending',
      localStorage: 'pending',
    };

    try {
      // Step 1: Clear Chrome Storage Sync (CRITICAL)
      const syncKeysToRemove = [
        'customDayColors',
      ];

      try {
        await new Promise((resolve, reject) => {
          chrome.storage.sync.remove(syncKeysToRemove, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          });
        });
        results.syncStorage = 'success';
      } catch (error) {
        results.syncStorage = 'failed';
        throw new Error(`Failed to clear sync storage: ${error.message}`);
      }

      // Step 2: Reset Settings to Defaults (CRITICAL)
      try {
        await setSettings(defaultSettings);
        results.settings = 'success';
      } catch (error) {
        results.settings = 'failed';
        throw new Error(`Failed to reset settings: ${error.message}`);
      }

      // Step 3: Clear Chrome Storage Local caches (non-critical)
      const localKeysToRemove = [
        'cf.eventColors',
      ];

      try {
        await new Promise((resolve, reject) => {
          chrome.storage.local.remove(localKeysToRemove, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          });
        });
        results.localStorage = 'success';
      } catch (error) {
        results.localStorage = 'failed';
        console.warn('Local storage clear failed (non-critical):', error);
      }

      return { success: true, results };
    } catch (error) {
      console.error('CRITICAL RESET FAILURE:', error);
      return { success: false, results, error: error.message };
    }
  }

  // Expose globally under cc3Storage
  window.cc3Storage = {
    getSettings,
    setSettings,
    onSettingsChanged,
    setEnabled,
    setWeekdayColor,
    setWeekdayOpacity,
    setDateColor,
    clearDateColor,
    setDateOpacity,
    setDateColorLabel,
    addPresetColor,
    setWeekStart,
    setWeekStartConfigured,
    ymdFromDate,
    defaultSettings,
    // Event coloring functions
    setEventColoringEnabled,
    getEventColoringSettings,
    setEventColorCategory,
    deleteEventColorCategory,
    getEventColorCategories,
    // Event color template functions
    getEventColorTemplates,
    getEventColorTemplate,
    setEventColorTemplate,
    deleteEventColorTemplate,
    reorderEventColorTemplates,
    getTemplatesForCategory,
    getUnassignedTemplates,
    assignTemplateToCategory,
    setGoogleColorLabel,
    getGoogleColorLabels,
    setGoogleColorScheme,
    getGoogleColorScheme,
    saveEventColor,
    getEventColor,
    getAllEventColors,
    removeEventColor,
    saveEventColorAdvanced,
    saveEventColorsFullAdvanced,
    findEventColor,
    findEventColorFull,
    normalizeEventColorData,
    parseEventId,
    encodeEventId,
    getIsCustomColorsDisabled,
    setDisableCustomColors,
    addQuickAccessColor,
    // Event calendar coloring functions (per-calendar default colors)
    getEventCalendarColors,
    getEventCalendarColor,
    setEventCalendarBackgroundColor,
    setEventCalendarTextColor,
    setEventCalendarBorderColor,
    setEventCalendarBorderWidth,
    clearEventCalendarBackgroundColor,
    clearEventCalendarTextColor,
    clearEventCalendarBorderColor,
    clearEventCalendarBorderWidth,
    clearEventCalendarColors,
    // Time blocking functions
    setTimeBlockingEnabled,
    setTimeBlockingGlobalColor,
    setTimeBlockingShadingStyle,
    setTimeBlockingSchedule,
    addTimeBlock,
    removeTimeBlock,
    updateTimeBlock,
    // Date-specific timeblock functions
    addDateSpecificTimeBlock,
    removeDateSpecificTimeBlock,
    updateDateSpecificTimeBlock,
    clearDateSpecificBlocks,
    // Feature registry compatibility
    get,
    set,
    getAll,
    // Reset function
    performCompleteReset,
  };
})();
