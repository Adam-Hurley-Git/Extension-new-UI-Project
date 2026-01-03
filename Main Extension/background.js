// ColorKit Background Service Worker (Manifest V3)
import { CONFIG, debugLog } from './config.production.js';
import { forceRefreshSubscription, validateSubscription } from './lib/subscription-validator.js';
import * as GoogleCalendarAPI from './lib/google-calendar-api.js';

// Service Worker Installation
chrome.runtime.onInstalled.addListener(async (details) => {
  debugLog('Extension installed/updated:', details.reason);

  if (details.reason === 'install') {
    // First time install
    chrome.storage.local.set({
      firstInstall: true,
      installDate: Date.now(),
    });
  }

  // Register with Web Push API for push notifications
  // This allows server to send instant updates when subscription changes
  if (CONFIG.VAPID_PUBLIC_KEY) {
    debugLog('Scheduling Web Push registration with VAPID public key');

    // Small delay to ensure service worker is fully initialized
    setTimeout(() => {
      ensureWebPushSubscription();
    }, 2000);
  } else {
    console.warn('⚠️ VAPID public key not configured, skipping push registration');
  }

  // OPTIMIZED: Setup 3-day validation alarm (backup check at 4 AM every 3 days)
  // This ensures subscription status is checked periodically
  // even if push notifications fail
  // Reduced from daily to every 3 days since push notifications are reliable
  const now = new Date();
  const next4AM = new Date(now);
  next4AM.setHours(4, 0, 0, 0);
  if (next4AM <= now) {
    next4AM.setDate(next4AM.getDate() + 1);
  }

  chrome.alarms.create('periodic-subscription-check', {
    when: next4AM.getTime(),
    periodInMinutes: 4320, // 72 hours (3 days)
  });

  debugLog('3-day subscription check alarm set for:', next4AM.toLocaleString());
});

// Service Worker Startup
// OPTIMIZED: Only ensure push subscription is registered on startup
// No need to validate subscription - storage already has current state
chrome.runtime.onStartup.addListener(async () => {
  debugLog('Browser started, ensuring Web Push subscription...');

  if (CONFIG.VAPID_PUBLIC_KEY) {
    setTimeout(() => {
      // Only register push subscription, don't force validation
      // Validation happens via push notifications and 3-day alarm
      ensureWebPushSubscription();
    }, 2000);
  }
});

// Web Push Message Listener
// Receives instant notifications from server when subscription changes
// IMPORTANT: Push is just an "invalidate cache" signal - always re-validate with server
self.addEventListener('push', async (event) => {
  debugLog('Web Push received');

  try {
    const data = event.data ? event.data.json() : {};
    debugLog('Push data:', data);

    // Don't trust push payload - treat it as an invalidate signal
    // Always fetch authoritative state from server
    debugLog('Push received - re-validating subscription from server...');

    // Force refresh from server (makes API call and updates storage)
    const result = await forceRefreshSubscription();
    debugLog('Server validation result:', result.isActive ? 'Active' : 'Inactive');

    // Broadcast to calendar tabs based on subscription status
    if (!result.isActive && result.reason !== 'no_session') {
      debugLog('Subscription inactive - notifying extension to lock');
      await broadcastToCalendarTabs({ type: 'SUBSCRIPTION_CANCELLED' });
    } else if (result.isActive) {
      debugLog('Subscription active - notifying extension to unlock');
      await broadcastToCalendarTabs({ type: 'SUBSCRIPTION_UPDATED' });
    }

    // Notify popup if open to refresh display
    notifyPopup({ type: 'SUBSCRIPTION_UPDATED' });
  } catch (error) {
    console.error('Error handling push notification:', error);
  }
});

// Alarm Listeners - Periodic validation (every 3 days)
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'periodic-subscription-check') {
    debugLog('Running periodic (3-day) subscription validation...');

    try {
      const result = await forceRefreshSubscription();
      debugLog('Periodic validation complete:', result.isActive ? 'Active' : 'Inactive');

      // Broadcast to calendar tabs based on subscription status
      // forceRefreshSubscription() already updated storage
      if (!result.isActive && result.reason !== 'no_session') {
        debugLog('Subscription inactive - notifying extension to lock');
        await broadcastToCalendarTabs({ type: 'SUBSCRIPTION_CANCELLED' });
        notifyPopup({ type: 'SUBSCRIPTION_UPDATED' });
      } else if (result.isActive) {
        debugLog('Subscription still active - no action needed');
        // Features already unlocked, storage already updated
      }
    } catch (error) {
      console.error('Periodic validation failed:', error);
    }
  }
});

// Listen for messages from web app (externally_connectable)
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  debugLog('External message received from:', sender.url);

  // Verify message is from our web app
  if (sender.url && sender.url.startsWith(CONFIG.WEB_APP_URL)) {
    handleWebAppMessage(message);
    sendResponse({ received: true, status: 'success' });
  } else {
    debugLog('Message from unauthorized source:', sender.url);
    sendResponse({ received: false, status: 'unauthorized' });
  }

  return true; // Required for async sendResponse
});

// Listen for messages from popup/content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  debugLog('Internal message received:', message.type);

  switch (message.type) {
    case 'CHECK_AUTH':
      checkAuthStatus().then(sendResponse);
      return true; // Required for async

    case 'CHECK_SUBSCRIPTION':
      // Content script asking if subscription is active
      checkSubscriptionStatus().then(sendResponse);
      return true; // Required for async

    case 'OPEN_WEB_APP':
      const url = message.path || '/onboarding';
      chrome.tabs.create({ url: `${CONFIG.WEB_APP_URL}${url}` });
      sendResponse({ opened: true });
      break;

    case 'CLEAR_AUTH':
      clearAuthData().then(() => {
        sendResponse({ cleared: true });
      });
      return true;

    case 'ENSURE_PUSH':
      // Optional: Allow popup/content script to trigger push subscription check
      ensureWebPushSubscription().then(() => {
        sendResponse({ initiated: true });
      });
      return true;

    // ========================================
    // CALENDAR COLORS MESSAGE HANDLERS
    // ========================================

    case 'GET_CALENDAR_COLORS':
      // Fetch all calendar colors (single API call, cached)
      GoogleCalendarAPI.fetchCalendarColors(message.forceRefresh || false).then(sendResponse);
      return true;

    case 'GET_CALENDAR_COLOR_FOR_EVENT':
      // Get calendar color for a specific event ID
      GoogleCalendarAPI.getCalendarColorFromEventId(message.eventId).then(sendResponse);
      return true;

    case 'SUBSCRIPTION_UPDATED':
      // Notify all calendar tabs about subscription status change
      broadcastToCalendarTabs({ type: 'SUBSCRIPTION_UPDATED' }).then(() => {
        debugLog('Subscription update broadcasted to calendar tabs');
        sendResponse({ broadcasted: true });
      });
      return true;

    case 'SETTINGS_RESET_COMPLETE':
      // Handle complete reset - clear background caches
      debugLog('Settings reset complete - clearing background caches');
      sendResponse({ success: true });
      return true;

    default:
      sendResponse({ error: 'Unknown message type' });
  }

  return true;
});

// Handle messages from web app
async function handleWebAppMessage(message) {
  debugLog('Handling web app message:', message.type);

  switch (message.type) {
    case 'AUTH_SUCCESS':
      // Store Supabase session tokens
      const sessionData = {
        authenticated: true,
        authTimestamp: Date.now(),
      };

      // If session data provided, store it
      if (message.session) {
        sessionData.supabaseSession = {
          access_token: message.session.access_token,
          refresh_token: message.session.refresh_token,
          user: message.session.user,
        };
        debugLog('Supabase session tokens received and stored');
      }

      // If subscription status provided, store it
      // FAIL-OPEN: Only update if verification succeeded (verificationFailed !== true)
      if (message.subscriptionStatus) {
        if (message.subscriptionStatus.verificationFailed === true) {
          // Verification failed - don't update subscription state (preserve current)
          debugLog('⚠️ Subscription verification failed - preserving current lock state (fail-open)');
          // Don't add subscription data to sessionData - keep existing state
        } else {
          // Verification succeeded - update subscription state
          sessionData.subscriptionActive = message.subscriptionStatus.hasSubscription;
          sessionData.subscriptionStatus = {
            isActive: message.subscriptionStatus.hasSubscription,
            status: message.subscriptionStatus.status,
            message: message.subscriptionStatus.hasSubscription ? 'Subscription active' : 'No active subscription',
            dataSource: 'auth_success',
          };
          debugLog('Subscription status verified:', message.subscriptionStatus);
        }
      }

      await chrome.storage.local.set(sessionData);

      // If there's a pending push subscription, register it now that we have a session
      const { pendingPushSubscription, pushSubscription } = await chrome.storage.local.get([
        'pendingPushSubscription',
        'pushSubscription',
      ]);
      if (pendingPushSubscription) {
        debugLog('Found pending push subscription, registering now...');
        await registerPushSubscription(pendingPushSubscription);
      }

      // If we have a stored push subscription, validate it with backend now that we're logged in
      // This handles the case where extension subscribed before user logged in
      if (pushSubscription && !pendingPushSubscription) {
        debugLog('User logged in, validating stored push subscription...');
        const isValid = await validateSubscriptionWithBackend(pushSubscription);
        if (!isValid) {
          debugLog('Stored subscription not in backend, registering it now...');
          await registerPushSubscription(pushSubscription);
        }
      }

      // Notify popup if open
      notifyPopup({ type: 'AUTH_UPDATED' });
      debugLog('Auth success saved with session tokens');
      break;

    case 'PAYMENT_SUCCESS':
      // Set subscription state - extension now unlocked
      await chrome.storage.local.set({
        subscriptionActive: true,
        subscriptionStatus: {
          isActive: true,
          status: 'active',
          message: 'Subscription active',
          dataSource: 'payment_success',
        },
        subscriptionTimestamp: Date.now(),
      });

      // FREEMIUM: Complete any pending premium action after successful payment
      try {
        const { pendingPremiumAction } = await chrome.storage.local.get('pendingPremiumAction');
        if (pendingPremiumAction) {
          debugLog('Found pending premium action, completing...', pendingPremiumAction.type);
          await completePendingPremiumAction(pendingPremiumAction);
          await chrome.storage.local.remove('pendingPremiumAction');
          debugLog('Pending premium action completed and cleared');
        }
      } catch (error) {
        console.error('Error completing pending premium action:', error);
      }

      // Notify popup
      notifyPopup({ type: 'SUBSCRIPTION_UPDATED', pendingActionCompleted: !!pendingPremiumAction });

      // Broadcast to all calendar tabs to re-enable features
      await broadcastToCalendarTabs({ type: 'SUBSCRIPTION_UPDATED' });

      debugLog('Payment success saved - subscription now active, content scripts notified');
      break;

    case 'SUBSCRIPTION_CANCELLED':
      // Subscription was cancelled - update status and lock extension
      await chrome.storage.local.set({
        subscriptionActive: false,
        subscriptionStatus: {
          isActive: false,
          status: 'cancelled',
          reason: 'subscription_cancelled',
          message: 'Subscription cancelled',
          wasPreviouslySubscribed: true, // User had subscription - show "Sorry to see you go"
          dataSource: 'cancellation_event',
        },
        subscriptionTimestamp: Date.now(),
      });

      // Notify popup to show "Get Started" button
      notifyPopup({ type: 'SUBSCRIPTION_UPDATED' });

      // IMPORTANT: Broadcast to all calendar tabs to disable features immediately
      await broadcastToCalendarTabs({ type: 'SUBSCRIPTION_CANCELLED' });

      debugLog('Subscription cancelled - cache cleared, content scripts notified, extension blocked');
      break;

    case 'LOGOUT':
      await clearAuthData();
      notifyPopup({ type: 'AUTH_UPDATED' });
      debugLog('Logout processed');
      break;

    case 'PAGE_LOADED':
      // Web app page loaded - could use for heartbeat
      debugLog('Web app page loaded');
      break;

    default:
      debugLog('Unknown web app message type:', message.type);
  }
}

// Check current auth status
async function checkAuthStatus() {
  const data = await chrome.storage.local.get([
    'authenticated',
    'subscriptionActive',
    'authTimestamp',
    'subscriptionTimestamp',
  ]);

  return {
    authenticated: data.authenticated || false,
    subscriptionActive: data.subscriptionActive || false,
    authTimestamp: data.authTimestamp || null,
    subscriptionTimestamp: data.subscriptionTimestamp || null,
  };
}

// Check subscription status using validator (for content scripts)
async function checkSubscriptionStatus() {
  try {
    const result = await validateSubscription();

    debugLog('Subscription check result:', result.isActive ? 'Active' : 'Inactive');

    return {
      isActive: result.isActive || false,
      status: result.status || 'unknown',
      reason: result.reason || null,
    };
  } catch (error) {
    console.error('Subscription check failed:', error);

    // FAIL-OPEN: Preserve current state on error to avoid locking paying users
    try {
      const { subscriptionStatus } = await chrome.storage.local.get('subscriptionStatus');
      if (subscriptionStatus && subscriptionStatus.isActive) {
        debugLog('Preserving active subscription state due to validation error');
        return {
          isActive: true,
          status: 'error_preserved',
          reason: 'validation_failed_state_preserved',
        };
      }
    } catch (storageError) {
      console.error('Failed to read subscription status from storage:', storageError);
    }

    return {
      isActive: false,
      status: 'error',
      reason: 'validation_failed',
    };
  }
}

// Broadcast message to all Google Calendar tabs
async function broadcastToCalendarTabs(message) {
  try {
    const tabs = await chrome.tabs.query({ url: 'https://calendar.google.com/*' });
    debugLog(`Broadcasting ${message.type} to ${tabs.length} calendar tab(s)`);

    for (const tab of tabs) {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, message).catch(() => {
          // Tab might not have content script loaded yet
          debugLog('Could not send to tab:', tab.id);
        });
      }
    }
  } catch (error) {
    console.error('Failed to broadcast to tabs:', error);
  }
}

// Clear all auth data
async function clearAuthData() {
  await chrome.storage.local.remove([
    'authenticated',
    'subscriptionActive',
    'authTimestamp',
    'subscriptionTimestamp',
    'subscriptionStatus',
    'lastChecked',
    'supabaseSession', // Clear Supabase session tokens
  ]);

  debugLog('Auth data and session tokens cleared');
}

// Notify popup of updates
function notifyPopup(message) {
  chrome.runtime.sendMessage(message).catch(() => {
    // Popup might not be open, that's okay
    debugLog('Popup not open to receive message');
  });
}

// FREEMIUM: Complete a pending premium action after successful payment
// This function is called when a user upgrades and had a pending action waiting
async function completePendingPremiumAction(action) {
  if (!action || !action.type || !action.data) {
    debugLog('Invalid pending action, skipping');
    return;
  }

  debugLog('Completing pending action:', action.type);

  // Get current settings from sync storage
  const { settings = {} } = await chrome.storage.sync.get('settings');

  switch (action.type) {
    case 'dayColoring.specificDate': {
      // Complete date-specific color save
      const { dateKey, color, opacity, label } = action.data;
      if (dateKey && color) {
        const dateColors = settings.dateColors || {};
        const dateOpacity = settings.dateOpacity || {};
        const dateColorLabels = settings.dateColorLabels || {};

        dateColors[dateKey] = color;
        if (opacity !== undefined) dateOpacity[dateKey] = opacity;
        if (label) dateColorLabels[dateKey] = label;

        await chrome.storage.sync.set({
          settings: { ...settings, dateColors, dateOpacity, dateColorLabels },
        });
        debugLog('Completed: Date-specific color saved for', dateKey);
      }
      break;
    }

    case 'timeBlocking.specificDate': {
      // Complete date-specific time block save
      const { dateKey, block } = action.data;
      if (dateKey && block) {
        const timeBlocking = settings.timeBlocking || {};
        const dateSpecificSchedule = timeBlocking.dateSpecificSchedule || {};
        const existingBlocks = dateSpecificSchedule[dateKey] || [];

        dateSpecificSchedule[dateKey] = [...existingBlocks, block];

        await chrome.storage.sync.set({
          settings: {
            ...settings,
            timeBlocking: { ...timeBlocking, dateSpecificSchedule },
          },
        });
        debugLog('Completed: Date-specific time block saved for', dateKey);
      }
      break;
    }

    case 'eventColoring.calendarColor': {
      // Complete calendar default color save
      const { calendarId, colorType, color } = action.data;
      if (calendarId && colorType && color) {
        const eventColoring = settings.eventColoring || {};
        const calendarColors = eventColoring.calendarColors || {};
        const calendarEntry = calendarColors[calendarId] || {};

        calendarEntry[colorType] = color;
        calendarColors[calendarId] = calendarEntry;

        await chrome.storage.sync.set({
          settings: {
            ...settings,
            eventColoring: { ...eventColoring, calendarColors },
          },
        });
        debugLog('Completed: Calendar color saved for', calendarId, colorType);
      }
      break;
    }

    case 'eventColoring.template': {
      // Complete template save
      const { template } = action.data;
      if (template && template.id) {
        const eventColoring = settings.eventColoring || {};
        const templates = eventColoring.templates || {};

        templates[template.id] = template;

        await chrome.storage.sync.set({
          settings: {
            ...settings,
            eventColoring: { ...eventColoring, templates },
          },
        });
        debugLog('Completed: Template saved', template.id);
      }
      break;
    }

    case 'eventColoring.advancedColors': {
      // Complete advanced event color save (text/border/borderWidth)
      // This needs to be saved to local storage (cf.eventColors)
      const { eventId, colors } = action.data;
      if (eventId && colors) {
        const { 'cf.eventColors': eventColors = {} } = await chrome.storage.local.get('cf.eventColors');

        eventColors[eventId] = {
          ...eventColors[eventId],
          ...colors,
          appliedAt: Date.now(),
        };

        await chrome.storage.local.set({ 'cf.eventColors': eventColors });
        debugLog('Completed: Advanced event colors saved for', eventId);
      }
      break;
    }

    default:
      debugLog('Unknown pending action type:', action.type);
  }

  // Broadcast to calendar tabs to refresh
  await broadcastToCalendarTabs({ type: 'PENDING_ACTION_COMPLETED', actionType: action.type });
}

// Global flag to prevent concurrent push subscription attempts
let subscribing = false;

// Helper: Convert VAPID key from base64 to Uint8Array
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');

  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Helper: validate subscription with backend
async function validateSubscriptionWithBackend(subscription) {
  try {
    // Get current Supabase session
    const { supabaseSession } = await chrome.storage.local.get('supabaseSession');

    if (!supabaseSession || !supabaseSession.access_token) {
      debugLog('No session available for validation, will validate after login');
      return false;
    }

    const resp = await fetch(`${CONFIG.WEB_APP_URL}/api/extension/validate-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseSession.access_token}`,
      },
      body: JSON.stringify({ subscription }),
    });

    if (!resp.ok) {
      debugLog('Backend validation failed:', resp.status);
      return false;
    }

    const { valid } = await resp.json();
    return !!valid;
  } catch (error) {
    debugLog('Backend validation error:', error?.message);
    return false;
  }
}

// Main: ensure we have a push subscription and the backend accepts it
// Uses storage-first approach to avoid unnecessary re-subscription
async function ensureWebPushSubscription() {
  if (subscribing) {
    debugLog('Push subscription already in progress, skipping...');
    return;
  }

  subscribing = true;

  try {
    // Get the service worker registration (we're already in a service worker)
    const registration = self.registration;

    // Check if we already have a subscription stored
    const { pushSubscription } = await chrome.storage.local.get(['pushSubscription']);

    if (pushSubscription) {
      debugLog('Found stored push subscription, validating with backend...');
      const ok = await validateSubscriptionWithBackend(pushSubscription);
      if (ok) {
        debugLog('✅ Stored push subscription is valid, no re-subscription needed');
        return;
      }
      debugLog('Stored subscription is invalid or not in backend, will subscribe fresh');
    } else {
      debugLog('No stored push subscription found, will subscribe fresh');
    }

    // Subscribe to push notifications (silent mode - Chrome 121+)
    debugLog('Subscribing to Web Push with VAPID public key...');

    const applicationServerKey = urlBase64ToUint8Array(CONFIG.VAPID_PUBLIC_KEY);

    // Silent push (Chrome 121+) - no visible notifications required
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: false,
      applicationServerKey: applicationServerKey,
    });

    debugLog('✅ Web Push subscription successful (silent mode)!');
    debugLog('   Subscription endpoint:', subscription.endpoint);

    // Convert subscription to JSON format for storage/transmission
    const subscriptionJson = subscription.toJSON();

    // Store subscription locally
    await chrome.storage.local.set({ pushSubscription: subscriptionJson });
    debugLog('Push subscription stored in extension storage');

    // Send to backend (or save as pending if no session yet)
    await registerPushSubscription(subscriptionJson);
  } catch (e) {
    console.error('❌ Web Push subscription failed:', e?.message || e);
    console.error('   Will retry on next service worker wake.');
  } finally {
    subscribing = false;
  }
}

// Register push subscription with server
// Allows server to send push notifications to this extension instance
async function registerPushSubscription(subscription) {
  debugLog('Registering push subscription with server...');

  // Get current Supabase session
  const { supabaseSession } = await chrome.storage.local.get('supabaseSession');

  if (!supabaseSession || !supabaseSession.access_token) {
    debugLog('No session available, will register push subscription after login');
    // Store subscription locally to register later when user logs in
    await chrome.storage.local.set({ pendingPushSubscription: subscription });
    return;
  }

  try {
    const response = await fetch(`${CONFIG.WEB_APP_URL}/api/extension/register-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseSession.access_token}`,
      },
      body: JSON.stringify({
        subscription: subscription,
        user_id: supabaseSession.user.id,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to register push subscription: ${response.status} - ${errorText}`);
    }

    debugLog('Push subscription registered with server successfully');

    // Clear pending subscription if it was stored
    await chrome.storage.local.remove('pendingPushSubscription');
  } catch (error) {
    console.error('Failed to register push subscription with server:', error);
    // Store subscription to retry later
    await chrome.storage.local.set({ pendingPushSubscription: subscription });
  }
}

// Keep service worker alive with periodic heartbeat (optional)
// Service workers can shut down after 30 seconds of inactivity
// This is normal behavior in MV3, state should be in storage
debugLog('Background service worker initialized');
