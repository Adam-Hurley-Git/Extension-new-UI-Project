// ColorKit Feature Access Control
// Manages freemium feature gating - determines which features require premium subscription
(function () {
  'use strict';

  // Premium feature definitions
  // Features listed here require an active subscription
  const PREMIUM_FEATURES = {
    // Day Coloring - specific date colors are premium
    'dayColoring.specificDates': {
      name: 'Date-Specific Colors',
      description: 'Color specific dates like holidays, deadlines, or important events.',
      category: 'dayColoring',
    },

    // Time Blocking - date-specific blocks are premium
    'timeBlocking.specificDates': {
      name: 'Date-Specific Time Blocks',
      description: 'Create one-time time blocks for specific dates - perfect for holidays, deadlines, or schedule exceptions.',
      category: 'timeBlocking',
    },

    // Event Coloring - advanced styling options are premium
    'eventColoring.textColor': {
      name: 'Text Color',
      description: 'Customize the text color of your calendar events for better readability.',
      category: 'eventColoring',
    },
    'eventColoring.borderColor': {
      name: 'Border Color',
      description: 'Add custom borders to your events to make them stand out.',
      category: 'eventColoring',
    },
    'eventColoring.borderWidth': {
      name: 'Border Thickness',
      description: 'Control the thickness of event borders (1-6px).',
      category: 'eventColoring',
    },
    'eventColoring.templates': {
      name: 'Color Templates',
      description: 'Save and reuse complete color combinations (background, text, border) for quick event styling.',
      category: 'eventColoring',
    },
    'eventColoring.calendarColors': {
      name: 'Calendar Default Colors',
      description: 'Set default colors for all events from specific calendars automatically.',
      category: 'eventColoring',
    },
  };

  // Portal upgrade URL
  const UPGRADE_URL = 'https://portal.calendarextension.com/upgrade';

  /**
   * Check if user has premium (active subscription)
   * @returns {Promise<boolean>}
   */
  async function isPremium() {
    try {
      const { subscriptionActive } = await chrome.storage.local.get('subscriptionActive');
      return subscriptionActive === true;
    } catch (error) {
      console.error('[FeatureAccess] Error checking premium status:', error);
      return false;
    }
  }

  /**
   * Check if a specific feature requires premium
   * @param {string} featureKey - The feature key to check
   * @returns {boolean}
   */
  function isPremiumFeature(featureKey) {
    return featureKey in PREMIUM_FEATURES;
  }

  /**
   * Get feature info for a premium feature
   * @param {string} featureKey - The feature key
   * @returns {object|null}
   */
  function getFeatureInfo(featureKey) {
    return PREMIUM_FEATURES[featureKey] || null;
  }

  /**
   * Check if user can access a specific feature
   * @param {string} featureKey - The feature key to check
   * @returns {Promise<{allowed: boolean, reason: string, featureInfo: object|null}>}
   */
  async function canAccess(featureKey) {
    // If it's not a premium feature, always allow
    if (!isPremiumFeature(featureKey)) {
      return {
        allowed: true,
        reason: 'free',
        featureInfo: null,
      };
    }

    // Check if user has premium
    const hasPremium = await isPremium();
    const featureInfo = getFeatureInfo(featureKey);

    return {
      allowed: hasPremium,
      reason: hasPremium ? 'premium' : 'requires_upgrade',
      featureInfo: featureInfo,
    };
  }

  /**
   * Store a pending action for completion after upgrade
   * When user tries to save a premium feature without subscription,
   * we store what they were trying to do so it can be completed after payment
   * @param {object} action - The action to store
   */
  async function storePendingAction(action) {
    try {
      const pendingAction = {
        ...action,
        timestamp: Date.now(),
      };
      await chrome.storage.local.set({ pendingPremiumAction: pendingAction });
      console.log('[FeatureAccess] Stored pending action:', action.type);
    } catch (error) {
      console.error('[FeatureAccess] Error storing pending action:', error);
    }
  }

  /**
   * Get the pending premium action (if any)
   * @returns {Promise<object|null>}
   */
  async function getPendingAction() {
    try {
      const { pendingPremiumAction } = await chrome.storage.local.get('pendingPremiumAction');

      // Check if action is still valid (within 24 hours)
      if (pendingPremiumAction && pendingPremiumAction.timestamp) {
        const ageMs = Date.now() - pendingPremiumAction.timestamp;
        const maxAgeMs = 24 * 60 * 60 * 1000; // 24 hours

        if (ageMs > maxAgeMs) {
          // Action expired, clear it
          await clearPendingAction();
          return null;
        }
      }

      return pendingPremiumAction || null;
    } catch (error) {
      console.error('[FeatureAccess] Error getting pending action:', error);
      return null;
    }
  }

  /**
   * Clear the pending premium action
   */
  async function clearPendingAction() {
    try {
      await chrome.storage.local.remove('pendingPremiumAction');
      console.log('[FeatureAccess] Cleared pending action');
    } catch (error) {
      console.error('[FeatureAccess] Error clearing pending action:', error);
    }
  }

  /**
   * Track when a user attempts to use a premium feature
   * Useful for analytics to understand which features drive upgrades
   * @param {string} featureKey - The feature attempted
   * @param {string} action - What user tried to do (e.g., 'save', 'configure')
   */
  async function trackPremiumAttempt(featureKey, action = 'access') {
    try {
      const { premiumAttempts = [] } = await chrome.storage.local.get('premiumAttempts');

      premiumAttempts.push({
        feature: featureKey,
        action,
        timestamp: Date.now(),
      });

      // Keep only last 100 attempts to avoid storage bloat
      const trimmedAttempts = premiumAttempts.slice(-100);

      await chrome.storage.local.set({ premiumAttempts: trimmedAttempts });
    } catch (error) {
      console.error('[FeatureAccess] Error tracking premium attempt:', error);
    }
  }

  /**
   * Get analytics on premium feature attempts
   * @returns {Promise<{total: number, byFeature: object, recent: array}>}
   */
  async function getPremiumAttemptStats() {
    try {
      const { premiumAttempts = [] } = await chrome.storage.local.get('premiumAttempts');

      // Group by feature
      const byFeature = {};
      premiumAttempts.forEach((attempt) => {
        byFeature[attempt.feature] = (byFeature[attempt.feature] || 0) + 1;
      });

      return {
        total: premiumAttempts.length,
        byFeature,
        recent: premiumAttempts.slice(-10),
      };
    } catch (error) {
      console.error('[FeatureAccess] Error getting premium attempt stats:', error);
      return { total: 0, byFeature: {}, recent: [] };
    }
  }

  /**
   * Get the upgrade URL
   * @returns {string}
   */
  function getUpgradeUrl() {
    return UPGRADE_URL;
  }

  /**
   * Get all premium feature definitions
   * @returns {object}
   */
  function getAllPremiumFeatures() {
    return { ...PREMIUM_FEATURES };
  }

  /**
   * Get premium features by category
   * @param {string} category - The category to filter by
   * @returns {object}
   */
  function getPremiumFeaturesByCategory(category) {
    const result = {};
    for (const [key, value] of Object.entries(PREMIUM_FEATURES)) {
      if (value.category === category) {
        result[key] = value;
      }
    }
    return result;
  }

  /**
   * Check if any premium features are being used in a colors object
   * Used by EventColorModal to determine if upgrade is needed
   * @param {object} colors - Colors object with background, text, border, borderWidth
   * @returns {boolean}
   */
  function usesPremiumEventColorFeatures(colors) {
    if (!colors) return false;

    // Text color is premium (only if explicitly set, not null/undefined)
    if (colors.text && colors.text !== null) return true;

    // Border color is premium (only if explicitly set)
    if (colors.border && colors.border !== null) return true;

    // Note: borderWidth alone is NOT premium - it only matters if border color is also set
    // The default borderWidth of 2 should not trigger premium gate
    // borderWidth is only meaningful when there's a border color to apply it to

    return false;
  }

  // Expose to global scope for use in content scripts and popup
  window.cc3FeatureAccess = {
    isPremium,
    isPremiumFeature,
    getFeatureInfo,
    canAccess,
    storePendingAction,
    getPendingAction,
    clearPendingAction,
    trackPremiumAttempt,
    getPremiumAttemptStats,
    getUpgradeUrl,
    getAllPremiumFeatures,
    getPremiumFeaturesByCategory,
    usesPremiumEventColorFeatures,
    PREMIUM_FEATURES,
    UPGRADE_URL,
  };
})();
