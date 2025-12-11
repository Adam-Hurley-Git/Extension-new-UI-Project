// ========================================
// EVENT ID UTILITIES
// ========================================
// Handles event ID encoding/decoding and recurring event matching

(function () {
  'use strict';

  // ========================================
  // EVENT ID TYPES
  // ========================================

  const EventIdType = {
    CALENDAR: 'calendar', // Standard calendar event ID
    RECURRING: 'recurring', // Recurring event base ID
    INSTANCE: 'instance', // Specific instance of recurring event
    UNKNOWN: 'unknown',
  };

  // ========================================
  // EVENT ID PARSING
  // ========================================

  /**
   * Parse event ID to extract type and components
   * @param {string} eventId - Raw event ID from Google Calendar
   * @returns {Object} Parsed event data
   */
  function parseEventId(eventId) {
    if (!eventId) {
      return {
        type: EventIdType.UNKNOWN,
        raw: null,
        baseId: null,
        instanceDate: null,
        isRecurring: false,
      };
    }

    // Check for recurring event pattern
    // Recurring events often have format: baseId_instanceDate or baseId R instanceDate
    const recurringPattern = /^(.+?)(?:_R|_)(\d{8}T\d{6}Z?)$/;
    const match = eventId.match(recurringPattern);

    if (match) {
      return {
        type: EventIdType.INSTANCE,
        raw: eventId,
        baseId: match[1],
        instanceDate: match[2],
        isRecurring: true,
      };
    }

    // Check if this is a base recurring event ID
    // These often end with _R or have special markers
    if (eventId.includes('_R') || eventId.endsWith('R')) {
      return {
        type: EventIdType.RECURRING,
        raw: eventId,
        baseId: eventId,
        instanceDate: null,
        isRecurring: true,
      };
    }

    // Standard single event
    return {
      type: EventIdType.CALENDAR,
      raw: eventId,
      baseId: eventId,
      instanceDate: null,
      isRecurring: false,
    };
  }

  /**
   * Extract base event ID from any event ID
   * @param {string} eventId - Event ID
   * @returns {string} Base event ID (for recurring series)
   */
  function getBaseEventId(eventId) {
    const parsed = parseEventId(eventId);
    return parsed.baseId || eventId;
  }

  /**
   * Check if two event IDs represent the same event or series
   * @param {string} eventId1 - First event ID
   * @param {string} eventId2 - Second event ID
   * @returns {boolean}
   */
  function isSameEvent(eventId1, eventId2) {
    if (!eventId1 || !eventId2) return false;
    if (eventId1 === eventId2) return true;

    // Compare base IDs for recurring events
    const base1 = getBaseEventId(eventId1);
    const base2 = getBaseEventId(eventId2);

    return base1 === base2;
  }

  /**
   * Check if event ID represents a recurring event
   * @param {string} eventId - Event ID
   * @returns {boolean}
   */
  function isRecurringEvent(eventId) {
    const parsed = parseEventId(eventId);
    return parsed.isRecurring;
  }

  // ========================================
  // RECURRING EVENT MATCHING
  // ========================================

  /**
   * Check if two event IDs match (considering recurring patterns)
   * @param {Object} parsedId1 - Parsed event ID 1
   * @param {Object} parsedId2 - Parsed event ID 2
   * @returns {boolean}
   */
  function matchesEvent(parsedId1, parsedId2) {
    if (!parsedId1 || !parsedId2) return false;

    // Exact match
    if (parsedId1.raw === parsedId2.raw) return true;

    // Both are from same recurring series
    if (parsedId1.isRecurring && parsedId2.isRecurring) {
      return parsedId1.baseId === parsedId2.baseId;
    }

    return false;
  }

  /**
   * Get all instances of a recurring event on the page
   * @param {string} baseEventId - Base event ID
   * @returns {Array<HTMLElement>}
   */
  function findRecurringEventInstances(baseEventId) {
    if (!baseEventId) return [];

    const allEvents = document.querySelectorAll('[data-eventid]');
    const instances = [];

    allEvents.forEach((element) => {
      const elementEventId = element.getAttribute('data-eventid');
      if (elementEventId && isSameEvent(elementEventId, baseEventId)) {
        instances.push(element);
      }
    });

    return instances;
  }

  // ========================================
  // EVENT ID ENCODING/DECODING
  // ========================================

  /**
   * Encode event data to a storable format
   * @param {Object} eventData - Event data
   * @returns {string}
   */
  function encodeEventData(eventData) {
    try {
      return btoa(JSON.stringify(eventData));
    } catch (error) {
      console.error('[Event Coloring] Error encoding event data:', error);
      return null;
    }
  }

  /**
   * Decode event data from storage format
   * @param {string} encoded - Encoded data
   * @returns {Object|null}
   */
  function decodeEventData(encoded) {
    try {
      return JSON.parse(atob(encoded));
    } catch (error) {
      console.error('[Event Coloring] Error decoding event data:', error);
      return null;
    }
  }

  // ========================================
  // EVENT ID VALIDATION
  // ========================================

  /**
   * Validate event ID format
   * @param {string} eventId - Event ID to validate
   * @returns {boolean}
   */
  function isValidEventId(eventId) {
    if (!eventId || typeof eventId !== 'string') return false;

    // Basic validation - Google Calendar event IDs are typically alphanumeric with underscores
    const validPattern = /^[a-zA-Z0-9_]+$/;
    return validPattern.test(eventId) && eventId.length > 0;
  }

  /**
   * Sanitize event ID for storage
   * @param {string} eventId - Event ID
   * @returns {string}
   */
  function sanitizeEventId(eventId) {
    if (!eventId) return '';

    // Remove any special characters that might cause storage issues
    return eventId.replace(/[^a-zA-Z0-9_]/g, '');
  }

  // ========================================
  // EVENT FINGERPRINTING
  // ========================================

  /**
   * Create a fingerprint for an event (for recurring event matching)
   * @param {string} title - Event title
   * @param {string} time - Event time
   * @returns {string}
   */
  function createEventFingerprint(title, time) {
    if (!title && !time) return '';

    const normalizedTitle = (title || '').toLowerCase().trim();
    const normalizedTime = (time || '').toLowerCase().trim();

    return `${normalizedTitle}|${normalizedTime}`;
  }

  /**
   * Check if two events match by fingerprint
   * @param {string} fingerprint1 - First fingerprint
   * @param {string} fingerprint2 - Second fingerprint
   * @returns {boolean}
   */
  function matchesByFingerprint(fingerprint1, fingerprint2) {
    if (!fingerprint1 || !fingerprint2) return false;
    return fingerprint1 === fingerprint2;
  }

  // ========================================
  // TEMPORARY SELECTION STORAGE
  // ========================================
  // For new events that don't have IDs yet

  let tempColorSelection = null;

  /**
   * Store temporary color selection for new event
   * @param {string} color - Color hex
   */
  function setTempColorSelection(color) {
    tempColorSelection = {
      color,
      timestamp: Date.now(),
    };
    console.log('[Event Coloring] Temp color selection stored:', color);
  }

  /**
   * Get temporary color selection
   * @returns {Object|null}
   */
  function getTempColorSelection() {
    // Clear if older than 5 minutes (user probably abandoned)
    if (tempColorSelection && Date.now() - tempColorSelection.timestamp > 5 * 60 * 1000) {
      clearTempColorSelection();
      return null;
    }

    return tempColorSelection;
  }

  /**
   * Clear temporary color selection
   */
  function clearTempColorSelection() {
    tempColorSelection = null;
    console.log('[Event Coloring] Temp color selection cleared');
  }

  // ========================================
  // EXPORT API
  // ========================================

  window.eventColoringIdUtils = {
    // Types
    EventIdType,

    // Parsing
    parseEventId,
    getBaseEventId,
    isSameEvent,
    isRecurringEvent,

    // Matching
    matchesEvent,
    findRecurringEventInstances,

    // Encoding
    encodeEventData,
    decodeEventData,

    // Validation
    isValidEventId,
    sanitizeEventId,

    // Fingerprinting
    createEventFingerprint,
    matchesByFingerprint,

    // Temporary storage
    setTempColorSelection,
    getTempColorSelection,
    clearTempColorSelection,
  };

  console.log('[Event Coloring] Event ID utilities loaded');
})();
