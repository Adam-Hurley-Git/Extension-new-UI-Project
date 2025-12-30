// ========================================
// GOOGLE CALENDAR API INTEGRATION MODULE
// ========================================
// Provides calendar color fetching for event coloring feature

import { getAuthToken } from './google-auth.js';

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

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
  if (!forceRefresh && calendarColorsCache && now - calendarColorsCacheTime < CACHE_TTL) {
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
        Authorization: `Bearer ${token}`,
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
          summary: calendar.summary || calendar.id, // Calendar name
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
 * Decode ttb_ prefixed data-eventid to extract calendar email
 * @param {string} ttbString - String like "ttb_MTVxbWhvcjNjN3Y3ZjYwcnAwdGVxMGxhazMgYWRhbS5odXJsZXkucHJpdmF0ZUBt"
 * @returns {Object|null} { calendarEventId, email } or null if invalid
 */
function decodeCalendarEventId(ttbString) {
  if (!ttbString || !ttbString.startsWith('ttb_')) {
    return null;
  }

  try {
    const base64Part = ttbString.slice(4); // Remove "ttb_" prefix
    const decoded = atob(base64Part); // Decode base64
    const parts = decoded.split(' '); // Split on space

    if (parts.length >= 1) {
      return {
        calendarEventId: parts[0],
        email: parts[1] || null,
      };
    }

    return null;
  } catch (error) {
    console.error('[CalendarAPI] Failed to decode ttb_ string:', ttbString, error);
    return null;
  }
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
  fetchCalendarColors,
  getCalendarColor,
  getCalendarColorFromEventId,
  clearCalendarColorsCache,
};

export default GoogleCalendarAPI;
