// ========================================
// GOOGLE OAUTH MODULE
// ========================================
// Shared OAuth token management for Google APIs
// Used by google-calendar-api.js for calendar colors

// ========================================
// OAUTH TOKEN MANAGEMENT
// ========================================

let cachedToken = null;
let tokenExpiry = null;
let tokenFetchPromise = null; // Lock to prevent concurrent token requests

/**
 * Get OAuth token for Google Calendar API
 * @param {boolean} interactive - Whether to show OAuth popup
 * @returns {Promise<string|null>} OAuth token or null
 */
export async function getAuthToken(interactive = false) {
  // Check if cached token is still valid
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  // If a token fetch is already in progress, wait for it
  if (tokenFetchPromise) {
    return tokenFetchPromise;
  }

  // Create a new fetch promise to prevent concurrent requests
  tokenFetchPromise = (async () => {
    try {
      // Manifest V3: getAuthToken returns an object with a token property
      const response = await chrome.identity.getAuthToken({
        interactive: interactive,
        scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
      });

      // Extract token string from response object
      const token = typeof response === 'string' ? response : response?.token;

      if (token) {
        cachedToken = token;
        tokenExpiry = Date.now() + 55 * 60 * 1000; // 55 minutes (tokens last 60min)
        return token;
      }
      return null;
    } catch (error) {
      console.error('OAuth token acquisition failed:', error);

      if (error.message?.includes('OAuth2 not granted') || error.message?.includes('not granted or revoked')) {
        throw new Error('OAUTH_NOT_GRANTED');
      }

      throw error;
    } finally {
      tokenFetchPromise = null; // Clear lock when done
    }
  })();

  return tokenFetchPromise;
}

/**
 * Clear cached OAuth token
 */
export async function clearAuthToken() {
  if (cachedToken) {
    try {
      // Ensure we're passing a string token (defensive check)
      const tokenString = typeof cachedToken === 'string' ? cachedToken : cachedToken?.token;
      if (tokenString) {
        await chrome.identity.removeCachedAuthToken({ token: tokenString });
      }
    } catch (error) {
      console.warn('Error clearing cached token:', error);
    }
  }

  cachedToken = null;
  tokenExpiry = null;
}

/**
 * Check if OAuth has been granted
 * @returns {Promise<boolean>}
 */
export async function isAuthGranted() {
  try {
    const token = await getAuthToken(false); // Non-interactive
    return !!token;
  } catch (error) {
    return false;
  }
}
