(function () {
  // Global subscription state
  let hasActiveSubscription = false;
  let featuresEnabled = false;

  // Check subscription status (used for premium feature gating)
  async function checkSubscriptionStatus() {
    try {
      // OPTIMIZED: Read directly from storage instead of messaging background
      // Storage is kept fresh by push notifications and 3-day alarm
      const stored = await chrome.storage.local.get(['subscriptionActive']);

      if (stored.subscriptionActive) {
        hasActiveSubscription = true;
        console.log('[ColorKit] Premium subscription active - all features enabled');
      } else {
        hasActiveSubscription = false;
        console.log('[ColorKit] Free tier - basic features enabled, premium features gated');
      }

      // FREEMIUM: Expose premium status globally for feature-level gating
      window.cc3IsPremium = hasActiveSubscription;
      return hasActiveSubscription;
    } catch (error) {
      console.error('[ColorKit] Subscription check error:', error);
      // Fail-open for basic features - premium features will be gated individually
      hasActiveSubscription = false;
      window.cc3IsPremium = false;
      return false;
    }
  }

  // Disable all features
  async function disableAllFeatures() {
    console.log('[ColorKit] Disabling all features...');
    featuresEnabled = false;

    // Remove all applied colors and styles
    if (window.cc3Features) {
      // Disable each feature
      const features = window.cc3Features.features;
      for (const [id, feature] of features) {
        if (typeof feature.disable === 'function') {
          feature.disable();
        }
      }
    }

    // Remove toolbar if present
    if (window.cc3Toolbar && typeof window.cc3Toolbar.unmount === 'function') {
      window.cc3Toolbar.unmount();
    }

    // Clear any applied styles
    document.querySelectorAll('[data-cc3-applied]').forEach((el) => {
      el.style.backgroundColor = '';
      el.removeAttribute('data-cc3-applied');
    });
  }

  async function init() {
    // Wait for dependencies to load
    let retries = 0;
    while ((!window.cc3Features || !window.cc3Storage) && retries < 10) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      retries++;
    }

    if (!window.cc3Features) {
      console.error('cc3Features not available after waiting');
      return;
    }

    if (!window.cc3Storage) {
      console.error('cc3Storage not available after waiting');
      return;
    }

    // FREEMIUM: Check subscription status for premium feature gating
    // Features always boot - premium gating happens at the feature level
    await checkSubscriptionStatus();

    featuresEnabled = true;

    await window.cc3Features.boot();

    // Check if colors should be applied immediately on load
    await checkAndApplyInitialColors();

    // Additional check to ensure colors are applied if settings were loaded after boot
    setTimeout(async () => {
      if (featuresEnabled) await checkAndApplyInitialColors();
    }, 200);

    // Final check after a longer delay to ensure colors are applied
    setTimeout(async () => {
      if (featuresEnabled) await checkAndApplyInitialColors();
    }, 1000);

    // initialize toolbar
    try {
      window.cc3Toolbar && window.cc3Toolbar.mount();
    } catch (e) {
      console.warn('Toolbar init failed:', e);
    }

  }

  // Check if colors should be applied immediately on page load
  async function checkAndApplyInitialColors() {
    try {
      // Get current settings to check if coloring is enabled
      const rawSettings = await window.cc3Storage.getAll();

      // Handle nested settings structure
      let allSettings = rawSettings;
      if (rawSettings && rawSettings.settings) {
        allSettings = rawSettings.settings;
      }

      // Check if day coloring is enabled - settings are stored directly in the main object
      const dayColoringSettings = allSettings;
      if (dayColoringSettings && dayColoringSettings.enabled) {
        // Multiple attempts to apply colors as DOM becomes ready
        const applyColors = () => {
          if (window.cc3Features && window.cc3Features.updateFeature) {
            window.cc3Features.updateFeature('dayColoring', dayColoringSettings);
          }
        };

        // Immediate application
        applyColors();

        // Wait for DOM to be ready, then apply colors
        setTimeout(applyColors, 50);
        setTimeout(applyColors, 100);
        setTimeout(applyColors, 200);
        setTimeout(applyColors, 500);
        setTimeout(applyColors, 1000);

        // Also wait for specific calendar elements to be ready
        waitForCalendarElements().then(() => {
          applyColors();
        });
      } else {
      }
    } catch (error) {
      console.error('Error checking initial color settings:', error);
    }
  }

  // Wait for calendar elements to be ready
  async function waitForCalendarElements() {
    const maxWait = 5000; // 5 seconds max
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      // Check for common calendar elements
      const hasCalendarElements = document.querySelector('[role="grid"], [role="main"], [data-viewkey]');
      if (hasCalendarElements) {
        return true;
      }

      // Wait a bit before checking again
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return false;
  }

  // Listen for messages from popup and background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'settingsChanged' && message.feature && window.cc3Features) {
      // Only allow settings changes if subscription is active
      if (featuresEnabled) {
        window.cc3Features.updateFeature(message.feature, message.settings);
      }
    } else if (message.type === 'SUBSCRIPTION_CANCELLED') {
      // FREEMIUM: Subscription was cancelled - update premium status
      // Basic features continue to work, premium features will be gated
      console.log('[ColorKit] Received SUBSCRIPTION_CANCELLED - downgrading to free tier');
      hasActiveSubscription = false;
      window.cc3IsPremium = false;
    } else if (message.type === 'SUBSCRIPTION_UPDATED') {
      // Subscription status changed - update premium status
      console.log('[ColorKit] Received SUBSCRIPTION_UPDATED - checking status');
      checkSubscriptionStatus().then((isPremium) => {
        if (isPremium) {
          console.log('[ColorKit] Upgraded to premium - all features now available');
        } else {
          console.log('[ColorKit] Free tier - premium features gated');
        }
      });
    } else if (message.type === 'PENDING_ACTION_COMPLETED') {
      // Pending premium action was completed after upgrade - reload to apply changes
      console.log('[ColorKit] Pending action completed - reloading to apply changes');
      location.reload();
    } else if (message.type === 'SETTINGS_RESET') {
      // Complete reset detected - clean up and reload page
      console.log('[ColorKit] Settings reset detected - cleaning up and reloading page...');

      // Clear any cached data in features
      if (window.cc3Features) {
        const features = window.cc3Features.features;
        for (const [id, feature] of features) {
          if (typeof feature.cleanup === 'function') {
            try {
              feature.cleanup();
            } catch (error) {
              console.warn(`[ColorKit] Cleanup failed for feature ${id}:`, error);
            }
          }
        }
      }

      // Send acknowledgment
      sendResponse({ received: true });

      // Reload page after short delay to allow cleanup
      setTimeout(() => {
        window.location.reload();
      }, 500);

      return true;
    }
    return true;
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
