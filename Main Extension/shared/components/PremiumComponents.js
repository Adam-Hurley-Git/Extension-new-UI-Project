// ColorKit Premium UI Components
// ProBadge, UpgradeModal, and related premium feature UI elements
(function () {
  'use strict';

  // CSS for premium components (injected once)
  const PREMIUM_CSS = `
    /* Pro Badge - Subtle tag for premium features */
    .cc3-pro-badge {
      display: inline-flex;
      align-items: center;
      background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
      color: white;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-left: 6px;
      vertical-align: middle;
      line-height: 1.4;
      box-shadow: 0 1px 2px rgba(124, 58, 237, 0.3);
    }

    .cc3-pro-badge.cc3-pro-badge-small {
      padding: 1px 4px;
      font-size: 8px;
    }

    .cc3-pro-badge.cc3-pro-badge-inline {
      margin-left: 4px;
    }

    /* Upgrade Modal Backdrop */
    .cc3-upgrade-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(2px);
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.2s ease;
    }

    .cc3-upgrade-backdrop.active {
      opacity: 1;
    }

    /* Upgrade Modal */
    .cc3-upgrade-modal {
      background: white;
      border-radius: 16px;
      padding: 24px;
      max-width: 360px;
      width: 90%;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      transform: scale(0.9) translateY(20px);
      opacity: 0;
      transition: all 0.25s ease;
    }

    .cc3-upgrade-backdrop.active .cc3-upgrade-modal {
      transform: scale(1) translateY(0);
      opacity: 1;
    }

    /* Modal Header */
    .cc3-upgrade-header {
      text-align: center;
      margin-bottom: 16px;
    }

    .cc3-upgrade-icon {
      font-size: 40px;
      margin-bottom: 8px;
    }

    .cc3-upgrade-title {
      font-size: 18px;
      font-weight: 600;
      color: #1f2937;
      margin: 0 0 4px 0;
    }

    .cc3-upgrade-subtitle {
      font-size: 13px;
      color: #6b7280;
      margin: 0;
    }

    /* Feature Name Highlight */
    .cc3-upgrade-feature-name {
      background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      font-weight: 600;
    }

    /* Modal Body */
    .cc3-upgrade-body {
      background: #f9fafb;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 20px;
    }

    .cc3-upgrade-description {
      font-size: 14px;
      color: #4b5563;
      line-height: 1.5;
      margin: 0;
    }

    /* Benefits List */
    .cc3-upgrade-benefits {
      list-style: none;
      padding: 0;
      margin: 12px 0 0 0;
    }

    .cc3-upgrade-benefits li {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      font-size: 13px;
      color: #374151;
      margin-bottom: 8px;
    }

    .cc3-upgrade-benefits li:last-child {
      margin-bottom: 0;
    }

    .cc3-upgrade-check {
      color: #10b981;
      font-weight: bold;
      flex-shrink: 0;
    }

    /* Modal Actions */
    .cc3-upgrade-actions {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .cc3-upgrade-btn {
      padding: 12px 20px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
      border: none;
      text-align: center;
      text-decoration: none;
      display: block;
    }

    .cc3-upgrade-btn-primary {
      background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
      color: white;
      box-shadow: 0 4px 12px rgba(124, 58, 237, 0.4);
    }

    .cc3-upgrade-btn-primary:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(124, 58, 237, 0.5);
    }

    .cc3-upgrade-btn-secondary {
      background: transparent;
      color: #6b7280;
      border: 1px solid #e5e7eb;
    }

    .cc3-upgrade-btn-secondary:hover {
      background: #f3f4f6;
      color: #374151;
    }

    /* Premium Feature Disabled State */
    .cc3-premium-disabled {
      position: relative;
      pointer-events: none;
      opacity: 0.6;
    }

    .cc3-premium-disabled::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(255, 255, 255, 0.3);
      border-radius: inherit;
    }

    /* Premium Teaser State - allows interaction but shows it's premium */
    .cc3-premium-teaser {
      position: relative;
    }

    .cc3-premium-teaser .cc3-pro-badge {
      position: absolute;
      top: 4px;
      right: 4px;
    }
  `;

  // Inject CSS once when module loads
  let cssInjected = false;
  function injectCSS() {
    if (cssInjected) return;

    const style = document.createElement('style');
    style.id = 'cc3-premium-components-css';
    style.textContent = PREMIUM_CSS;
    document.head.appendChild(style);
    cssInjected = true;
  }

  /**
   * Create a Pro badge element
   * @param {object} options - Badge options
   * @param {boolean} options.small - Use smaller badge size
   * @param {boolean} options.inline - Use inline margins
   * @returns {HTMLElement}
   */
  function createProBadge(options = {}) {
    injectCSS();

    const badge = document.createElement('span');
    badge.className = 'cc3-pro-badge';
    badge.textContent = 'Pro';

    if (options.small) {
      badge.classList.add('cc3-pro-badge-small');
    }
    if (options.inline) {
      badge.classList.add('cc3-pro-badge-inline');
    }

    return badge;
  }

  /**
   * Create an HTML string for a Pro badge (for insertion via innerHTML)
   * @param {object} options - Badge options
   * @returns {string}
   */
  function createProBadgeHTML(options = {}) {
    const classes = ['cc3-pro-badge'];
    if (options.small) classes.push('cc3-pro-badge-small');
    if (options.inline) classes.push('cc3-pro-badge-inline');

    return `<span class="${classes.join(' ')}">Pro</span>`;
  }

  /**
   * Show the upgrade modal
   * @param {object} options - Modal options
   * @param {string} options.feature - Feature name being gated
   * @param {string} options.description - Description of the feature
   * @param {Function} options.onUpgrade - Callback when user clicks upgrade
   * @param {Function} options.onCancel - Callback when user cancels
   * @param {string} options.upgradeUrl - URL to open for upgrade (optional)
   */
  function showUpgradeModal(options = {}) {
    injectCSS();

    const {
      feature = 'This Feature',
      description = 'Upgrade to ColorKit Pro to unlock this premium feature.',
      onUpgrade = null,
      onCancel = null,
      upgradeUrl = null,
    } = options;

    // Remove any existing modal
    const existing = document.querySelector('.cc3-upgrade-backdrop');
    if (existing) existing.remove();

    // Create backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'cc3-upgrade-backdrop';

    // Create modal
    const modal = document.createElement('div');
    modal.className = 'cc3-upgrade-modal';

    modal.innerHTML = `
      <div class="cc3-upgrade-header">
        <div class="cc3-upgrade-icon">✨</div>
        <h2 class="cc3-upgrade-title">Upgrade to Pro</h2>
        <p class="cc3-upgrade-subtitle">
          <span class="cc3-upgrade-feature-name">${escapeHtml(feature)}</span> is a Pro feature
        </p>
      </div>

      <div class="cc3-upgrade-body">
        <p class="cc3-upgrade-description">${escapeHtml(description)}</p>
        <ul class="cc3-upgrade-benefits">
          <li><span class="cc3-upgrade-check">✓</span> Unlock all premium features</li>
          <li><span class="cc3-upgrade-check">✓</span> Priority support</li>
          <li><span class="cc3-upgrade-check">✓</span> Future updates included</li>
        </ul>
      </div>

      <div class="cc3-upgrade-actions">
        <button class="cc3-upgrade-btn cc3-upgrade-btn-primary" id="cc3-upgrade-btn">
          🚀 Upgrade Now
        </button>
        <button class="cc3-upgrade-btn cc3-upgrade-btn-secondary" id="cc3-cancel-btn">
          Maybe Later
        </button>
      </div>
    `;

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    // Animate in
    requestAnimationFrame(() => {
      backdrop.classList.add('active');
    });

    // Get the actual upgrade URL
    const actualUpgradeUrl = upgradeUrl || (window.cc3FeatureAccess ? window.cc3FeatureAccess.getUpgradeUrl() : 'https://portal.calendarextension.com/upgrade');

    // Handle upgrade click
    const upgradeBtn = modal.querySelector('#cc3-upgrade-btn');
    upgradeBtn.addEventListener('click', () => {
      if (onUpgrade) {
        onUpgrade();
      }
      // Open upgrade URL in new tab
      window.open(actualUpgradeUrl, '_blank');
      closeModal();
    });

    // Handle cancel click
    const cancelBtn = modal.querySelector('#cc3-cancel-btn');
    cancelBtn.addEventListener('click', () => {
      if (onCancel) {
        onCancel();
      }
      closeModal();
    });

    // Handle backdrop click
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        if (onCancel) {
          onCancel();
        }
        closeModal();
      }
    });

    // Handle escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        if (onCancel) {
          onCancel();
        }
        closeModal();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);

    function closeModal() {
      backdrop.classList.remove('active');
      setTimeout(() => {
        backdrop.remove();
      }, 200);
    }

    return {
      close: closeModal,
      element: backdrop,
    };
  }

  /**
   * Helper to escape HTML in strings
   */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Add a Pro badge to an existing element
   * @param {HTMLElement} element - Element to add badge to
   * @param {object} options - Badge options
   */
  function addProBadgeTo(element, options = {}) {
    if (!element) return;

    // Check if badge already exists
    if (element.querySelector('.cc3-pro-badge')) return;

    const badge = createProBadge(options);
    element.appendChild(badge);
  }

  /**
   * Check premium status and show upgrade modal if needed
   * Returns true if user has premium, false if upgrade modal was shown
   * @param {string} featureKey - The feature being accessed
   * @param {object} modalOptions - Options for the upgrade modal
   * @returns {Promise<boolean>}
   */
  async function checkAndPromptUpgrade(featureKey, modalOptions = {}) {
    // If featureAccess isn't loaded, assume premium (fail-open)
    if (!window.cc3FeatureAccess) {
      console.warn('[PremiumComponents] cc3FeatureAccess not loaded, allowing access');
      return true;
    }

    const access = await window.cc3FeatureAccess.canAccess(featureKey);

    if (access.allowed) {
      return true;
    }

    // Track the attempt
    await window.cc3FeatureAccess.trackPremiumAttempt(featureKey, 'upgrade_prompt');

    // Show upgrade modal with feature info
    const featureInfo = access.featureInfo || {};
    showUpgradeModal({
      feature: modalOptions.feature || featureInfo.name || featureKey,
      description: modalOptions.description || featureInfo.description || 'This feature requires a Pro subscription.',
      onUpgrade: modalOptions.onUpgrade,
      onCancel: modalOptions.onCancel,
    });

    return false;
  }

  /**
   * Store pending action and show upgrade modal
   * Used when user configures a premium feature and tries to save
   * @param {string} featureKey - The feature being accessed
   * @param {object} pendingAction - The action to store for completion after upgrade
   * @param {object} modalOptions - Options for the upgrade modal
   * @returns {Promise<boolean>}
   */
  async function gateAndStorePendingAction(featureKey, pendingAction, modalOptions = {}) {
    // If featureAccess isn't loaded, assume premium (fail-open)
    if (!window.cc3FeatureAccess) {
      console.warn('[PremiumComponents] cc3FeatureAccess not loaded, allowing access');
      return true;
    }

    const access = await window.cc3FeatureAccess.canAccess(featureKey);

    if (access.allowed) {
      return true;
    }

    // Store the pending action
    await window.cc3FeatureAccess.storePendingAction(pendingAction);

    // Track the attempt
    await window.cc3FeatureAccess.trackPremiumAttempt(featureKey, 'save_blocked');

    // Show upgrade modal with feature info
    const featureInfo = access.featureInfo || {};
    showUpgradeModal({
      feature: modalOptions.feature || featureInfo.name || featureKey,
      description: modalOptions.description || featureInfo.description || 'Upgrade to Pro to save this configuration.',
      onUpgrade: modalOptions.onUpgrade,
      onCancel: modalOptions.onCancel,
    });

    return false;
  }

  // Expose to global scope
  window.cc3PremiumComponents = {
    createProBadge,
    createProBadgeHTML,
    showUpgradeModal,
    addProBadgeTo,
    checkAndPromptUpgrade,
    gateAndStorePendingAction,
    injectCSS,
  };
})();
