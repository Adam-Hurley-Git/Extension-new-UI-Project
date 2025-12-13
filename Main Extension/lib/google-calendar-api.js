// ========================================
// GOOGLE CALENDAR API INTEGRATION MODULE
// ========================================
// Provides mapping from Calendar Event IDs to Task IDs
// Required for new Google Calendar UI (ttb_ prefix)

import { getAuthToken } from './google-tasks-api.js';

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Decode ttb_ prefixed data-eventid to calendar event ID
 * @param {string} ttbString - String like "ttb_MTVxbWhvcjNjN3Y3ZjYwcnAwdGVxMGxhazMgYWRhbS5odXJsZXkucHJpdmF0ZUBt"
 * @returns {Object|null} { calendarEventId, email } or null if invalid
 */
export function decodeCalendarEventId(ttbString) {
  if (!ttbString || !ttbString.startsWith('ttb_')) {
    return null;
  }

  try {
    const base64Part = ttbString.slice(4); // Remove "ttb_" prefix
    const decoded = atob(base64Part); // Decode base64
    const parts = decoded.split(' '); // Split on space

    if (parts.length >= 1) {
      return {
        calendarEventId: parts[0], // e.g., "15qmhor3c7v7f60rp0teq0lak3"
        email: parts[1] || null, // e.g., "adam.hurley.private@m"
      };
    }

    return null;
  } catch (error) {
    console.error('[CalendarAPI] Failed to decode ttb_ string:', ttbString, error);
    return null;
  }
}

/**
 * Extract task fragment ID from calendar event description
 * @param {Object} event - Calendar API event object
 * @returns {string|null} Task fragment (e.g., "K8gRiZkif_qqDGI8") or null
 */
export function extractTaskFragmentFromEvent(event) {
  if (!event || !event.description) {
    return null;
  }

  try {
    // Look for task link in description: https://tasks.google.com/task/{FRAGMENT}
    const match = event.description.match(/tasks\.google\.com\/task\/([A-Za-z0-9_-]+)/);
    if (match && match[1]) {
      return match[1]; // Return the fragment ID
    }

    return null;
  } catch (error) {
    console.error('[CalendarAPI] Failed to extract task fragment from event:', error);
    return null;
  }
}

/**
 * Convert task fragment to Tasks API ID (base64 encoded)
 * @param {string} fragment - Task fragment (e.g., "K8gRiZkif_qqDGI8")
 * @returns {string} Base64 encoded task ID (e.g., "SzhnUmlaa2lmX3FxREdJOA==")
 */
export function taskFragmentToApiId(fragment) {
  if (!fragment) {
    return null;
  }

  try {
    // Base64 encode the fragment to get Tasks API ID
    return btoa(fragment);
  } catch (error) {
    console.error('[CalendarAPI] Failed to encode task fragment:', fragment, error);
    return null;
  }
}

/**
 * Convert Tasks API ID back to fragment
 * @param {string} taskApiId - Base64 encoded task ID
 * @returns {string|null} Task fragment or null
 */
export function taskApiIdToFragment(taskApiId) {
  if (!taskApiId) {
    return null;
  }

  try {
    return atob(taskApiId);
  } catch (error) {
    console.error('[CalendarAPI] Failed to decode task API ID:', taskApiId, error);
    return null;
  }
}

// ========================================
// CALENDAR API CALLS
// ========================================

/**
 * Fetch a single calendar event by ID
 * @param {string} eventId - Calendar event ID (e.g., "15qmhor3c7v7f60rp0teq0lak3")
 * @returns {Promise<Object|null>} Calendar event object or null
 */
export async function fetchCalendarEvent(eventId) {
  if (!eventId) {
    console.warn('[CalendarAPI] fetchCalendarEvent called with empty eventId');
    return null;
  }

  try {
    const token = await getAuthToken(false); // Non-interactive
    if (!token) {
      console.warn('[CalendarAPI] No auth token available');
      return null;
    }

    const url = `${CALENDAR_API_BASE}/calendars/primary/events/${eventId}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    // Handle 404 - event not found (deleted, completed, etc.)
    if (response.status === 404) {
      console.log(`[CalendarAPI] Event not found: ${eventId}`);
      return null;
    }

    // Handle 401 - token expired, clear and retry once
    if (response.status === 401) {
      console.log('[CalendarAPI] Token expired, clearing cache and retrying');
      await chrome.identity.removeCachedAuthToken({ token });

      const newToken = await getAuthToken(false);
      if (!newToken) {
        console.error('[CalendarAPI] Failed to get new token after 401');
        return null;
      }

      const retryResponse = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${newToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!retryResponse.ok) {
        console.error('[CalendarAPI] Retry failed:', retryResponse.status);
        return null;
      }

      return await retryResponse.json();
    }

    // Handle 403 - permission denied
    if (response.status === 403) {
      console.error('[CalendarAPI] Permission denied - calendar.readonly scope may not be granted');
      return null;
    }

    // Handle other errors
    if (!response.ok) {
      console.error(`[CalendarAPI] API error: ${response.status}`);
      return null;
    }

    const event = await response.json();
    return event;
  } catch (error) {
    console.error('[CalendarAPI] Failed to fetch calendar event:', eventId, error);
    return null;
  }
}

/**
 * Complete mapping chain: Calendar Event ID → Task API ID
 * @param {string} calendarEventId - Calendar event ID
 * @returns {Promise<string|null>} Task API ID or null
 */
export async function calendarEventIdToTaskId(calendarEventId) {
  if (!calendarEventId) {
    return null;
  }

  try {
    // Fetch event from Calendar API
    const event = await fetchCalendarEvent(calendarEventId);
    if (!event) {
      return null;
    }

    // Extract task fragment from description
    const fragment = extractTaskFragmentFromEvent(event);
    if (!fragment) {
      console.warn('[CalendarAPI] No task fragment found in event description');
      return null;
    }

    // Convert fragment to Task API ID
    const taskApiId = taskFragmentToApiId(fragment);
    return taskApiId;
  } catch (error) {
    console.error('[CalendarAPI] Failed to map calendar event to task:', calendarEventId, error);
    return null;
  }
}

/**
 * Check if Calendar API is accessible (permission granted)
 * @returns {Promise<boolean>}
 */
export async function isCalendarApiAccessible() {
  try {
    const token = await getAuthToken(false);
    if (!token) {
      return false;
    }

    // Try a simple API call to check permissions
    const response = await fetch(`${CALENDAR_API_BASE}/calendars/primary`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    return response.ok;
  } catch (error) {
    console.error('[CalendarAPI] Calendar API accessibility check failed:', error);
    return false;
  }
}

// ========================================
// CALENDAR COLORS
// ========================================

// Cache for calendar colors: { calendarId: { backgroundColor, foregroundColor } }
let calendarColorsCache = null;
let calendarColorsCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch all calendars with their colors (single API call)
 * Results are cached for 5 minutes
 * @param {boolean} forceRefresh - Force refresh the cache
 * @returns {Promise<Object>} Map of calendarId → { backgroundColor, foregroundColor }
 */
export async function fetchCalendarColors(forceRefresh = false) {
  // Return cached data if still valid
  const now = Date.now();
  if (!forceRefresh && calendarColorsCache && (now - calendarColorsCacheTime) < CACHE_TTL) {
    return calendarColorsCache;
  }

  try {
    const token = await getAuthToken(false);
    if (!token) {
      console.warn('[CalendarAPI] No auth token available for calendar colors');
      return calendarColorsCache || {};
    }

    const url = `${CALENDAR_API_BASE}/users/me/calendarList`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('[CalendarAPI] Failed to fetch calendar list:', response.status);
      return calendarColorsCache || {};
    }

    const data = await response.json();
    const colors = {};

    if (data.items) {
      data.items.forEach((calendar) => {
        colors[calendar.id] = {
          backgroundColor: calendar.backgroundColor,
          foregroundColor: calendar.foregroundColor,
        };
      });
    }

    // Update cache
    calendarColorsCache = colors;
    calendarColorsCacheTime = now;

    console.log('[CalendarAPI] Cached colors for', Object.keys(colors).length, 'calendars');
    return colors;
  } catch (error) {
    console.error('[CalendarAPI] Failed to fetch calendar colors:', error);
    return calendarColorsCache || {};
  }
}

/**
 * Get the background color for a specific calendar
 * @param {string} calendarId - Calendar ID (usually an email address)
 * @returns {Promise<string|null>} Background color hex or null
 */
export async function getCalendarColor(calendarId) {
  if (!calendarId) return null;

  const colors = await fetchCalendarColors();
  const calendarColors = colors[calendarId];

  return calendarColors?.backgroundColor || null;
}

/**
 * Get calendar color from an encoded event ID
 * @param {string} encodedEventId - The data-eventid value from DOM
 * @returns {Promise<string|null>} Background color hex or null
 */
export async function getCalendarColorFromEventId(encodedEventId) {
  if (!encodedEventId) return null;

  try {
    // Handle different event ID formats
    let calendarId = null;

    if (encodedEventId.startsWith('ttb_')) {
      // TTB format: decode to get email
      const decoded = decodeCalendarEventId(encodedEventId);
      calendarId = decoded?.email;
    } else {
      // Standard format: base64 encoded with email suffix
      try {
        const decoded = atob(encodedEventId);
        // Format: eventId email@domain.com
        const spaceIndex = decoded.indexOf(' ');
        if (spaceIndex > 0) {
          calendarId = decoded.substring(spaceIndex + 1);
        }
      } catch (e) {
        // Not base64 encoded, might be plain ID
      }
    }

    if (calendarId) {
      return await getCalendarColor(calendarId);
    }

    return null;
  } catch (error) {
    console.error('[CalendarAPI] Failed to get calendar color from event ID:', error);
    return null;
  }
}

/**
 * Clear the calendar colors cache
 */
export function clearCalendarColorsCache() {
  calendarColorsCache = null;
  calendarColorsCacheTime = 0;
}

// ========================================
// EXPORTS
// ========================================

const GoogleCalendarAPI = {
  decodeCalendarEventId,
  extractTaskFragmentFromEvent,
  taskFragmentToApiId,
  taskApiIdToFragment,
  fetchCalendarEvent,
  calendarEventIdToTaskId,
  isCalendarApiAccessible,
  fetchCalendarColors,
  getCalendarColor,
  getCalendarColorFromEventId,
  clearCalendarColorsCache,
};

export default GoogleCalendarAPI;
