// features/event-coloring/utils/eventIdUtils.js
// Event ID parsing and matching utilities for Google Calendar

/**
 * EventIdUtils - Handles Google Calendar event ID parsing and matching
 *
 * Google Calendar event IDs are base64 encoded and contain:
 * - Event base ID (recurring events share the same base)
 * - Instance date for recurring events
 * - User email suffix
 *
 * Format: base64(eventId + instanceDate + emailSuffix)
 */
export const EventIdUtils = {
  /**
   * Decode a Google Calendar event ID from base64
   * @param {string} encodedId - The base64 encoded event ID
   * @returns {object} Parsed event ID components
   */
  fromEncoded(encodedId) {
    try {
      if (!encodedId) {
        return { type: 'invalid', isRecurring: false };
      }

      // Try to decode as base64
      let decoded;
      try {
        decoded = atob(encodedId);
      } catch (e) {
        // Not valid base64, treat as plain ID
        return {
          type: 'calendar',
          encodedId: encodedId,
          decodedId: encodedId,
          isRecurring: false,
          emailSuffix: '',
        };
      }

      // Check for email suffix (usually starts with space + email)
      const emailMatch = decoded.match(/\s+(\S+@\S+)$/);
      const emailSuffix = emailMatch ? emailMatch[1] : '';

      // Remove email suffix to get the event part
      const eventPart = emailSuffix
        ? decoded.substring(0, decoded.length - emailSuffix.length).trim()
        : decoded;

      // Check if this is a recurring event instance
      // Recurring instances have a date suffix like _20231215T100000Z
      const recurringMatch = eventPart.match(/^(.+?)(_\d{8}T\d{6}Z)?$/);
      const baseId = recurringMatch ? recurringMatch[1] : eventPart;
      const instanceDate = recurringMatch && recurringMatch[2] ? recurringMatch[2] : null;
      const isRecurring = !!instanceDate;

      return {
        type: 'calendar',
        encodedId: encodedId,
        decodedId: baseId,
        instanceDate: instanceDate,
        isRecurring: isRecurring,
        emailSuffix: emailSuffix,
        fullDecoded: decoded,
      };
    } catch (error) {
      console.error('[CF] Error parsing event ID:', error);
      return {
        type: 'invalid',
        encodedId: encodedId,
        isRecurring: false,
      };
    }
  },

  /**
   * Create an encoded event ID from components
   * @param {string} decodedId - The base event ID
   * @param {string} emailSuffix - The email suffix
   * @returns {string} Base64 encoded event ID
   */
  toEncodedEventId(decodedId, emailSuffix) {
    try {
      const combined = emailSuffix
        ? `${decodedId} ${emailSuffix}`
        : decodedId;
      return btoa(combined);
    } catch (error) {
      console.error('[CF] Error encoding event ID:', error);
      return decodedId;
    }
  },

  /**
   * Check if two events match (same base event, ignoring instance date)
   * @param {object} event1 - First parsed event
   * @param {object} event2 - Second parsed event
   * @returns {boolean} True if events match
   */
  matchesEvent(event1, event2) {
    if (!event1 || !event2) return false;
    if (event1.type !== 'calendar' || event2.type !== 'calendar') return false;

    // Match on decoded base ID (without instance date)
    return event1.decodedId === event2.decodedId;
  },

  /**
   * Check if an event ID represents a recurring event
   * @param {string} encodedId - The encoded event ID
   * @returns {boolean} True if recurring
   */
  isRecurringEvent(encodedId) {
    const parsed = this.fromEncoded(encodedId);
    return parsed.isRecurring;
  },

  /**
   * Get the base event ID for storage (recurring events use base ID)
   * @param {string} encodedId - The encoded event ID
   * @param {boolean} applyToAll - Whether to apply to all instances
   * @returns {string} The ID to use for storage
   */
  getStorageId(encodedId, applyToAll = false) {
    const parsed = this.fromEncoded(encodedId);

    if (applyToAll && parsed.isRecurring) {
      // Use base ID for recurring events when applying to all
      return this.toEncodedEventId(parsed.decodedId, parsed.emailSuffix);
    }

    // Use original ID for single instances
    return encodedId;
  },

  /**
   * Extract event ID from a DOM element or its ancestors
   * @param {Element} element - The DOM element
   * @returns {string|null} The event ID if found
   */
  getEventIdFromElement(element) {
    if (!element) return null;

    // Check the element itself
    let eventId = element.getAttribute('data-eventid');
    if (eventId) return eventId;

    // Check ancestors
    const ancestor = element.closest('[data-eventid]');
    if (ancestor) {
      return ancestor.getAttribute('data-eventid');
    }

    // Check for event chip containers
    const chip = element.closest('[data-eventchip]');
    if (chip) {
      const chipId = chip.getAttribute('data-eventchip');
      if (chipId) return chipId;
    }

    return null;
  },
};

// Make available globally
if (typeof window !== 'undefined') {
  window.cfEventIdUtils = EventIdUtils;
}

export default EventIdUtils;
