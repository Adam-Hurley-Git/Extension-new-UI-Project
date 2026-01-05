// ========================================
// AUTH & SUBSCRIPTION VALIDATION
// ========================================

// Import validation function (will be loaded as module via script tag)
import { validateSubscription } from '../lib/subscription-validator.js';
import { CONFIG, debugLog } from '../config.production.js';

// Auth state
let isAuthenticated = false;
let hasActiveSubscription = false;

// Storage listener reference for cleanup
let storageChangeListener = null;

// Check auth and subscription on popup open
async function checkAuthAndSubscription() {
  debugLog('Checking auth and subscription status...');

  // OPTIMIZED: Read directly from storage instead of making API call
  // Storage is kept fresh by push notifications and 3-day alarm
  const stored = await chrome.storage.local.get(['subscriptionStatus']);

  // subscriptionStatus contains the full API response object
  const cachedData = stored.subscriptionStatus || {};

  const result = {
    isActive: cachedData.isActive || false,
    reason: cachedData.reason || 'unknown',
    message: cachedData.message || (cachedData.isActive ? 'Subscription active' : 'No active subscription'),
    status: cachedData.status || 'unknown',
    scheduledCancellation: cachedData.scheduledCancellation || false,
    cancellationDate: cachedData.cancellationDate || null,
    trialEnding: cachedData.trialEnding || null,
    wasPreviouslySubscribed: cachedData.wasPreviouslySubscribed || false,
  };

  debugLog('Validation result from storage:', result);

  // FREEMIUM MODEL: Always hide auth overlay - users get free tier access
  // Premium features are gated individually when users try to use them
  hideAuthOverlay();

  if (result.isActive) {
    // Premium user - full access
    isAuthenticated = true;
    hasActiveSubscription = true;

    // Show trial banner if user is in trial period
    if (result.status === 'trialing' && result.trialEnding) {
      showTrialBanner(result.trialEnding);
    }

    // Show scheduled cancellation banner if subscription is ending
    if (result.scheduledCancellation && result.cancellationDate) {
      showCancellationBanner(result.cancellationDate);
    }
  } else {
    // Free tier user - basic features only
    isAuthenticated = false;
    hasActiveSubscription = false;
    debugLog('Free tier user - premium features will be gated');
  }
}

// Show auth overlay
function showAuthOverlay(reason, message, wasPreviouslySubscribed = false) {
  const overlay = document.getElementById('authOverlay');
  const mainContent = document.getElementById('mainContent');

  if (overlay && mainContent) {
    // Update overlay content for previously subscribed users
    if (wasPreviouslySubscribed) {
      const title = overlay.querySelector('.auth-title');
      const description = overlay.querySelector('.auth-description');
      const button = overlay.querySelector('#getStartedBtn');
      const note = overlay.querySelector('.auth-note');

      if (title) title.textContent = "We're Sorry to See You Go";
      if (description) description.textContent = 'Reactivate your subscription to continue enjoying ColorKit features';
      if (button) {
        button.innerHTML = `
					Resubscribe to Plan
					<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
						<path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
				`;
      }
      if (note) note.textContent = 'Questions? Contact our support team anytime.';
    } else {
      // Reset to default "Get Started" content for new users
      const title = overlay.querySelector('.auth-title');
      const description = overlay.querySelector('.auth-description');
      const button = overlay.querySelector('#getStartedBtn');
      const note = overlay.querySelector('.auth-note');

      if (title) title.textContent = 'Welcome to ColorKit';
      if (description) description.textContent = 'Transform your Google Calendar with custom colors and time blocks';
      if (button) {
        button.innerHTML = `
					Get Started
					<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
						<path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
				`;
      }
      if (note) note.textContent = 'Already have an account? Sign in on the website and reopen this extension.';
    }

    overlay.classList.remove('hidden');
    mainContent.classList.add('disabled');
    debugLog('Auth overlay shown:', reason, 'Previously subscribed:', wasPreviouslySubscribed);
  }
}

// Hide auth overlay
function hideAuthOverlay() {
  const overlay = document.getElementById('authOverlay');
  const mainContent = document.getElementById('mainContent');

  if (overlay && mainContent) {
    overlay.classList.add('hidden');
    mainContent.classList.remove('disabled');
    debugLog('Auth overlay hidden');
  }
}

// Show trial banner
function showTrialBanner(trialEnding) {
  const daysLeft = Math.ceil((new Date(trialEnding) - new Date()) / (1000 * 60 * 60 * 24));

  const banner = document.createElement('div');
  banner.className = 'trial-banner';

  // Create elements safely to prevent XSS
  const span = document.createElement('span');
  span.textContent = `🎉 Free Trial: ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} remaining`;

  const link = document.createElement('a');
  link.href = `${CONFIG.WEB_APP_URL}/dashboard/subscriptions`;
  link.target = '_blank';
  link.textContent = 'Manage';

  banner.appendChild(span);
  banner.appendChild(link);

  const mainContent = document.getElementById('mainContent');
  if (mainContent && mainContent.firstChild) {
    mainContent.insertBefore(banner, mainContent.firstChild);
    debugLog('Trial banner shown:', daysLeft, 'days left');
  }
}

// Show scheduled cancellation banner
function showCancellationBanner(cancellationDate) {
  const endDate = new Date(cancellationDate);
  const formattedDate = endDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const banner = document.createElement('div');
  banner.className = 'cancellation-banner';
  banner.style.cssText = `
		background: #fff3cd;
		border: 1px solid #ffc107;
		border-radius: 8px;
		padding: 12px 16px;
		margin-bottom: 16px;
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 13px;
		color: #856404;
	`;

  // Create elements safely to prevent XSS
  const span = document.createElement('span');
  span.textContent = `⚠️ Subscription ends ${formattedDate}`;

  const link = document.createElement('a');
  link.href = `${CONFIG.WEB_APP_URL}/dashboard/subscriptions`;
  link.target = '_blank';
  link.style.cssText = 'color: #856404; text-decoration: underline; font-weight: 500;';
  link.textContent = 'Manage';

  banner.appendChild(span);
  banner.appendChild(link);

  const mainContent = document.getElementById('mainContent');
  if (mainContent && mainContent.firstChild) {
    mainContent.insertBefore(banner, mainContent.firstChild);
    debugLog('Cancellation banner shown: ends', formattedDate);
  }
}

// Handle "Get Started" button click
document.addEventListener('DOMContentLoaded', () => {
  const getStartedBtn = document.getElementById('getStartedBtn');
  if (getStartedBtn) {
    getStartedBtn.addEventListener('click', () => {
      // Check if user was previously subscribed - route accordingly
      chrome.storage.local.get(['subscriptionStatus'], (data) => {
        const wasPreviouslySubscribed = data.subscriptionStatus?.wasPreviouslySubscribed || false;

        if (wasPreviouslySubscribed) {
          // Lapsed subscriber - go directly to checkout (skip onboarding + no trial)
          debugLog('Resubscribe clicked, opening checkout page...');
          chrome.runtime.sendMessage({ type: 'OPEN_WEB_APP', path: '/checkout/pri_01k8m1wyqcebmvsvsc7pwvy69j' });
        } else {
          // New user - go to signup/onboarding
          debugLog('Get Started clicked, opening signup page...');
          chrome.runtime.sendMessage({ type: 'OPEN_WEB_APP', path: '/signup' });
        }
      });
    });
  }

  // Handle Account Dropdown Menu
  const accountMenuBtn = document.getElementById('accountMenuBtn');
  const accountDropdownMenu = document.getElementById('accountDropdownMenu');

  if (accountMenuBtn && accountDropdownMenu) {
    // Toggle dropdown on button click
    accountMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = accountDropdownMenu.style.display === 'block';

      if (isOpen) {
        accountDropdownMenu.style.display = 'none';
        accountMenuBtn.classList.remove('active');
      } else {
        accountDropdownMenu.style.display = 'block';
        accountMenuBtn.classList.add('active');
      }

      debugLog('Account menu toggled:', !isOpen ? 'opened' : 'closed');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!accountMenuBtn.contains(e.target) && !accountDropdownMenu.contains(e.target)) {
        accountDropdownMenu.style.display = 'none';
        accountMenuBtn.classList.remove('active');
      }
    });
  }

  // Handle "Manage Account" menu item
  const menuManageAccount = document.getElementById('menuManageAccount');
  if (menuManageAccount) {
    menuManageAccount.addEventListener('click', (e) => {
      e.preventDefault();
      debugLog('Manage Account clicked, opening dashboard...');
      chrome.runtime.sendMessage({ type: 'OPEN_WEB_APP', path: '/dashboard' });
      accountDropdownMenu.style.display = 'none';
      accountMenuBtn.classList.remove('active');
    });
  }

  // Handle "Open Feedback Portal" menu item
  const menuFeedback = document.getElementById('menuFeedback');
  if (menuFeedback) {
    menuFeedback.addEventListener('click', (e) => {
      e.preventDefault();
      debugLog('Feedback Portal clicked, opening in new tab...');
      chrome.tabs.create({ url: 'https://calendarextension.sleekplan.app' });
      accountDropdownMenu.style.display = 'none';
      accountMenuBtn.classList.remove('active');
    });
  }

  // Handle "Report an Issue or Bug" menu item
  const menuBugReport = document.getElementById('menuBugReport');
  if (menuBugReport) {
    menuBugReport.addEventListener('click', (e) => {
      e.preventDefault();
      debugLog('Bug Report clicked, opening in new tab...');
      chrome.tabs.create({ url: 'https://bugs-calendarextension.sleekplan.app/' });
      accountDropdownMenu.style.display = 'none';
      accountMenuBtn.classList.remove('active');
    });
  }

  // Handle "Tutorials" menu item
  const menuTutorials = document.getElementById('menuTutorials');
  if (menuTutorials) {
    menuTutorials.addEventListener('click', (e) => {
      e.preventDefault();
      debugLog('Tutorials clicked, opening in new tab...');
      chrome.tabs.create({ url: 'https://www.calendarextension.com/help' });
      accountDropdownMenu.style.display = 'none';
      accountMenuBtn.classList.remove('active');
    });
  }
});

// Listen for auth updates from background script
chrome.runtime.onMessage.addListener((message) => {
  debugLog('Message received in popup:', message.type);

  if (message.type === 'AUTH_UPDATED' || message.type === 'SUBSCRIPTION_UPDATED') {
    debugLog('Auth/subscription updated, re-reading from storage...');
    // No need to make API call - background.js already updated storage
    // Just re-read the fresh data from storage
    checkAuthAndSubscription();
  }
});

// Run auth check immediately
checkAuthAndSubscription();

// ========================================
// EXISTING POPUP LOGIC
// ========================================

(function () {
  let settings = {};

  function qs(id) {
    return document.getElementById(id);
  }

  // Helper function to convert hex color to rgba with opacity
  function hexToRgba(hex, alpha) {
    if (!hex || hex === '#ffffff') return `rgba(255, 255, 255, ${alpha})`;
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return `rgba(255, 255, 255, ${alpha})`;
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // Helper function to update preview with color and opacity
  function updatePreview(dayIndex, color, opacity) {
    const alpha = opacity / 100; // Convert percentage to decimal
    const rgba = hexToRgba(color, alpha);

    // Update the day grid preview
    const preview = qs(`preview${dayIndex}`);
    if (preview && color) {
      preview.style.backgroundColor = rgba;
    }

    // Update the color input preview wrapper in the modal
    const colorPreview = qs(`colorPreview${dayIndex}`);
    if (colorPreview && color) {
      colorPreview.style.backgroundColor = rgba;
    }
  }

  // Default colors for weekdays (vibrant base colors that will be applied with opacity)
  const defaultColors = {
    0: '#f44336', // Sunday - red
    1: '#2196f3', // Monday - blue
    2: '#4caf50', // Tuesday - green
    3: '#ff9800', // Wednesday - orange
    4: '#e91e63', // Thursday - pink
    5: '#00bcd4', // Friday - teal
    6: '#9c27b0', // Saturday - purple
  };

  // Vibrant color palette for color picker - organized by spectrum order, no duplicates
  const colorPickerPalette = [
    // Red family
    '#d50000',
    '#ff1744',
    '#f44336',
    '#ff5722',
    // Orange family
    '#ff9800',
    '#ffc107',
    // Yellow family
    '#ffeb3b',
    '#cddc39',
    // Green family
    '#8bc34a',
    '#4caf50',
    '#00e676',
    '#1de9b6',
    '#009688',
    // Cyan family
    '#00e5ff',
    '#00bcd4',
    '#00b0ff',
    // Blue family
    '#03a9f4',
    '#2196f3',
    '#2979ff',
    '#3d5afe',
    // Purple family
    '#651fff',
    '#3f51b5',
    '#673ab7',
    '#aa00ff',
    // Pink/Magenta family
    '#9c27b0',
    '#e91e63',
    '#c2185b',
    '#ad1457',
    '#880e4f',
    '#4a148c',
    // Additional vibrant accents
    '#795548',
    '#607d8b',
    '#9e9e9e',
    // Black and white
    '#000000',
    '#ffffff',
  ];

  // Pastel color palette - soft, muted colors
  const pastelPalette = [
    // Pink pastels
    '#f8bbd9',
    '#f48fb1',
    '#f06292',
    '#ec407a',
    '#e1bee7',
    // Purple pastels
    '#d1c4e9',
    '#ce93d8',
    '#ba68c8',
    '#ab47bc',
    '#c8e6c9',
    // Green pastels
    '#c8e6c9',
    '#a5d6a7',
    '#81c784',
    '#66bb6a',
    '#dcedc8',
    // Blue pastels
    '#bbdefb',
    '#90caf9',
    '#64b5f6',
    '#42a5f5',
    '#b3e5fc',
    // Cyan pastels
    '#b2ebf2',
    '#80deea',
    '#4dd0e1',
    '#26c6da',
    '#f0f4c3',
    // Yellow pastels
    '#fff9c4',
    '#fff59d',
    '#fff176',
    '#ffee58',
    '#ffe0b2',
    // Orange pastels
    '#ffccbc',
    '#ffab91',
    '#ff8a65',
    '#ff7043',
    '#d7ccc8',
    // Brown/Grey pastels
    '#bcaaa4',
    '#a1887f',
    '#8d6e63',
    '#e0e0e0',
    '#bdbdbd',
  ];

  // Dark/Deep color palette - rich, dark colors
  const darkPalette = [
    // Dark reds
    '#b71c1c',
    '#c62828',
    '#d32f2f',
    '#f44336',
    '#880e4f',
    // Dark purples
    '#4a148c',
    '#6a1b9a',
    '#7b1fa2',
    '#8e24aa',
    '#311b92',
    // Dark blues
    '#0d47a1',
    '#1565c0',
    '#1976d2',
    '#1e88e5',
    '#01579b',
    // Dark teals/greens
    '#004d40',
    '#00695c',
    '#00796b',
    '#00897b',
    '#1b5e20',
    // Dark greens
    '#2e7d32',
    '#388e3c',
    '#43a047',
    '#4caf50',
    '#33691e',
    // Dark oranges/browns
    '#bf360c',
    '#d84315',
    '#e64100',
    '#ff3d00',
    '#3e2723',
    // Dark greys/blues
    '#212121',
    '#424242',
    '#616161',
    '#757575',
    '#263238',
    // Deep accent colors
    '#1a237e',
    '#3949ab',
    '#5e35b1',
    '#7e57c2',
    '#8bc34a',
  ];

  // Default opacity values for weekdays (0-100)
  const defaultOpacity = {
    0: 30, // Sunday
    1: 30, // Monday
    2: 30, // Tuesday
    3: 30, // Wednesday
    4: 30, // Thursday
    5: 30, // Friday
    6: 30, // Saturday
  };

  // Default week start (0=Sunday, 1=Monday, 6=Saturday)
  const defaultWeekStart = 0;

  // Custom colors storage - shared across all color pickers
  let customColors = [];

  // Color Lab state
  let selectedColors = new Set();
  let colorLabEnabled = true; // Enable by default so users can immediately use the palette tabs

  // Color templates
  const colorTemplates = {
    warmSunset: ['#ff6b35', '#f7931e', '#ffd23f', '#ffeb3b', '#ff5722', '#d84315', '#bf360c', '#ff3d00'],
    coolOcean: ['#0277bd', '#0288d1', '#039be5', '#03a9f4', '#29b6f6', '#4fc3f7', '#81d4fa', '#b3e5fc'],
    professional: ['#263238', '#37474f', '#455a64', '#546e7a', '#607d8b', '#78909c', '#90a4ae', '#b0bec5'],
    material: ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4'],
  };

  // Load custom colors from storage
  async function loadCustomColors() {
    try {
      const result = await chrome.storage.sync.get('customDayColors');
      customColors = result.customDayColors || [];
    } catch (error) {
      console.error('Error loading custom colors:', error);
      customColors = [];
    }
  }

  // Save custom colors to storage
  async function saveCustomColors() {
    try {
      await chrome.storage.sync.set({ customDayColors: customColors });
    } catch (error) {
      console.error('Error saving custom colors:', error);
    }
  }

  // Add a color to custom palette
  async function addCustomColor(dayIndex) {
    const colorInput = qs(`color${dayIndex}`);
    if (colorInput && colorInput.value) {
      const color = colorInput.value.toUpperCase();

      // Don't add duplicates
      if (!customColors.includes(color)) {
        customColors.push(color);
        await saveCustomColors();

        // Refresh all custom palettes for day colors
        for (let i = 0; i < 7; i++) {
          createCustomColorPalette(i);
        }

        // Refresh time block global custom palette
        createTimeBlockGlobalCustomColorPalette();

        // Refresh all individual time block custom palettes
        document.querySelectorAll('.time-block-color-item').forEach((item) => {
          const blockId = item.dataset.blockId;
          if (blockId) {
            const colorInput = qs(`timeBlockColor-${blockId}`);
            const preview = qs(`timeBlockPreview-${blockId}`);
            const customPalette = qs(`timeBlockCustomPalette-${blockId}`);

            if (customPalette && colorInput && preview) {
              customPalette.innerHTML = '';
              if (customColors.length === 0) {
                customPalette.appendChild(createCustomColorsEmptyState());
              } else {
                const blockRef = { colorInput, preview };
                customColors.forEach((color) => {
                  customPalette.appendChild(createTimeBlockColorSwatch(color, blockRef, customPalette, true));
                });
              }
            }
          }
        });
      }
    }
  }

  // Remove a color from custom palette
  async function removeCustomColor(color) {
    const index = customColors.indexOf(color);
    if (index !== -1) {
      customColors.splice(index, 1);
      await saveCustomColors();

      // Refresh all custom palettes for day colors and Color Lab
      for (let i = 0; i < 7; i++) {
        createCustomColorPalette(i);
      }

      // Refresh time block global custom palette
      createTimeBlockGlobalCustomColorPalette();

      // Refresh all individual time block custom palettes
      document.querySelectorAll('.time-block-color-item').forEach((item) => {
        const blockId = item.dataset.blockId;
        if (blockId) {
          const colorInput = qs(`timeBlockColor-${blockId}`);
          const preview = qs(`timeBlockPreview-${blockId}`);
          const customPalette = qs(`timeBlockCustomPalette-${blockId}`);

          if (customPalette && colorInput && preview) {
            customPalette.innerHTML = '';
            if (customColors.length === 0) {
              customPalette.appendChild(createCustomColorsEmptyState());
            } else {
              const blockRef = { colorInput, preview };
              customColors.forEach((color) => {
                customPalette.appendChild(createTimeBlockColorSwatch(color, blockRef, customPalette, true));
              });
            }
          }
        }
      });

      updateColorLab();
    }
  }

  // Color Lab Functions
  function updateColorLabToggle() {
    // Expand/collapse now handled by CSS via data-section mechanism
  }

  function updateColorLab() {
    updateQuickAddPalettes();
    updateCustomColorsLab();
    updateColorCount();
  }

  // Quick Add Palette System - Complete Rewrite
  let activeQuickAddPalette = 'vibrant';

  // Initialize Quick Add system
  function initializeQuickAddPalettes() {
    // Set up tab click handlers
    document.querySelectorAll('.palette-tab').forEach((tab) => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        const paletteName = tab.dataset.palette;
        switchToQuickAddPalette(paletteName);
      });
    });

    // Initialize with the currently active palette (preserve current tab state)
    switchToQuickAddPalette(activeQuickAddPalette);
  }

  // Switch to a specific palette
  function switchToQuickAddPalette(paletteName) {
    // Update active palette
    activeQuickAddPalette = paletteName;

    // Update tab visual states
    document.querySelectorAll('.palette-tab').forEach((tab) => {
      tab.classList.remove('active');
      if (tab.dataset.palette === paletteName) {
        tab.classList.add('active');
      }
    });

    // Get the correct color array
    let colors = [];
    switch (paletteName) {
      case 'vibrant':
        colors = colorPickerPalette;
        break;
      case 'pastel':
        colors = pastelPalette;
        break;
      case 'dark':
        colors = darkPalette;
        break;
      default:
        colors = colorPickerPalette;
    }

    // Update the color grid
    updateQuickAddColorGrid(colors);
  }

  // Update the color grid with new colors
  function updateQuickAddColorGrid(colors) {
    const grid = qs('quickAddGrid');
    if (!grid) return;

    // Clear existing colors
    grid.innerHTML = '';

    // Add new colors
    colors.forEach((color, index) => {
      const colorItem = document.createElement('div');
      colorItem.className = 'quick-add-color';
      colorItem.style.backgroundColor = color;
      colorItem.title = `Add ${color} to collection`;
      colorItem.dataset.color = color;

      // Click handler to add color to lab
      colorItem.onclick = () => {
        addColorToLab(color);
        // Visual feedback
        colorItem.classList.add('added');
        setTimeout(() => {
          colorItem.classList.remove('added');
        }, 1500);
      };

      grid.appendChild(colorItem);
    });
  }

  // Legacy function for backward compatibility
  function updateQuickAddPalettes() {
    initializeQuickAddPalettes();
  }

  function updateCustomColorsLab() {
    updateAllColors();
    updateEmptyState();
  }

  function updateAllColors() {
    const grid = qs('allColorsGrid');
    if (!grid) return;

    grid.innerHTML = '';
    customColors.forEach((color) => {
      grid.appendChild(createLabColorSwatch(color));
    });
  }

  function updateEmptyState() {
    const grid = qs('allColorsGrid');
    const emptyState = qs('customColorsEmpty');

    if (!grid || !emptyState) return;

    if (customColors.length === 0) {
      grid.style.display = 'none';
      emptyState.style.display = 'flex';
    } else {
      grid.style.display = 'grid';
      emptyState.style.display = 'none';
    }
  }

  function updateColorCount() {
    const countElement = qs('colorCount');
    if (countElement) {
      countElement.textContent = customColors.length;
    }
  }

  function createLabColorSwatch(color) {
    const swatch = document.createElement('div');
    swatch.className = 'lab-color-swatch';
    swatch.style.backgroundColor = color;
    swatch.title = color;
    swatch.dataset.color = color;

    // Click to select/deselect
    swatch.onclick = (e) => {
      e.stopPropagation();
      toggleColorSelection(color, swatch);
    };

    // Remove button
    const removeBtn = document.createElement('button');
    removeBtn.className = 'color-remove';
    removeBtn.innerHTML = '×';
    removeBtn.onclick = (e) => {
      e.stopPropagation();
      removeCustomColor(color);
    };
    swatch.appendChild(removeBtn);

    return swatch;
  }

  function toggleColorSelection(color, swatchElement) {
    if (selectedColors.has(color)) {
      selectedColors.delete(color);
      swatchElement.classList.remove('selected');
    } else {
      selectedColors.add(color);
      swatchElement.classList.add('selected');
    }
  }

  async function addColorToLab(color) {
    if (!color) return;

    // Normalize color format
    color = color.toUpperCase();

    // Don't add duplicates
    if (!customColors.includes(color)) {
      customColors.push(color);
      await saveCustomColors();

      // Refresh all custom palettes for day colors and Color Lab
      for (let i = 0; i < 7; i++) {
        createCustomColorPalette(i);
      }

      // Refresh time block global custom palette
      createTimeBlockGlobalCustomColorPalette();

      // Refresh all individual time block custom palettes
      document.querySelectorAll('.time-block-color-item').forEach((item) => {
        const blockId = item.dataset.blockId;
        if (blockId) {
          const colorInput = qs(`timeBlockColor-${blockId}`);
          const preview = qs(`timeBlockPreview-${blockId}`);
          const customPalette = qs(`timeBlockCustomPalette-${blockId}`);

          if (customPalette && colorInput && preview) {
            customPalette.innerHTML = '';
            if (customColors.length === 0) {
              customPalette.appendChild(createCustomColorsEmptyState());
            } else {
              const blockRef = { colorInput, preview };
              customColors.forEach((color) => {
                customPalette.appendChild(createTimeBlockColorSwatch(color, blockRef, customPalette, true));
              });
            }
          }
        }
      });

      updateColorLab();

      // Visual feedback
      showAddColorFeedback();
    }
  }

  function showAddColorFeedback() {
    const btn = qs('addColorBtn');
    if (btn) {
      const originalText = btn.textContent;
      btn.textContent = 'Added!';
      btn.style.background = '#059669';
      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '';
      }, 1000);
    }
  }

  function validateHexColor(hex) {
    const hexRegex = /^#[0-9A-F]{6}$/i;
    return hexRegex.test(hex);
  }

  function setupColorLabEventListeners() {
    // Color Lab expand/collapse now handled by standard data-section mechanism

    // Color picker sync with hex input
    const colorPicker = qs('colorLabPicker');
    const hexInput = qs('colorLabHex');

    if (colorPicker && hexInput) {
      colorPicker.onchange = () => {
        hexInput.value = colorPicker.value.toUpperCase();
      };

      hexInput.oninput = (e) => {
        let value = e.target.value;
        if (!value.startsWith('#')) value = '#' + value;
        if (validateHexColor(value)) {
          colorPicker.value = value;
          hexInput.style.borderColor = '#1a73e8';
        } else {
          hexInput.style.borderColor = '#dc2626';
        }
      };
    }

    // Add color button
    const addColorBtn = qs('addColorBtn');
    if (addColorBtn) {
      addColorBtn.onclick = () => {
        const color = colorPicker ? colorPicker.value : null;
        if (color) {
          addColorToLab(color);
        }
      };
    }

    // Bulk operations
    const selectAllBtn = qs('selectAllColors');
    if (selectAllBtn) {
      selectAllBtn.onclick = () => {
        selectedColors.clear();
        document.querySelectorAll('.lab-color-swatch').forEach((swatch) => {
          const color = swatch.dataset.color;
          if (color) {
            selectedColors.add(color);
            swatch.classList.add('selected');
          }
        });
      };
    }

    const clearSelectedBtn = qs('clearSelectedColors');
    if (clearSelectedBtn) {
      clearSelectedBtn.onclick = async () => {
        if (selectedColors.size === 0) return;

        if (confirm(`Remove ${selectedColors.size} selected colors?`)) {
          // Remove selected colors from customColors array
          customColors = customColors.filter((color) => !selectedColors.has(color));
          selectedColors.clear();
          await saveCustomColors();

          // Refresh all palettes for day colors
          for (let i = 0; i < 7; i++) {
            createCustomColorPalette(i);
          }

          // Refresh time block palettes
          createTimeBlockGlobalCustomColorPalette();
          document.querySelectorAll('.time-block-color-item').forEach((item) => {
            const blockId = item.dataset.blockId;
            if (blockId) {
              const customPalette = qs(`timeBlockCustomPalette-${blockId}`);
              if (customPalette) {
                customPalette.innerHTML = '';
                if (customColors.length === 0) {
                  customPalette.appendChild(createCustomColorsEmptyState());
                } else {
                  customColors.forEach((color) => {
                    customPalette.appendChild(
                      createTimeBlockColorSwatch(
                        color,
                        {
                          colorInput: qs(`timeBlockColor-${blockId}`),
                          preview: qs(`timeBlockPreview-${blockId}`),
                        },
                        customPalette,
                        true,
                      ),
                    );
                  });
                }
              }
            }
          });

          updateColorLab();
        }
      };
    }

    const exportBtn = qs('exportColors');
    if (exportBtn) {
      exportBtn.onclick = () => {
        const colorsToExport = selectedColors.size > 0 ? Array.from(selectedColors) : customColors;
        const hexList = colorsToExport.join(', ');
        navigator.clipboard.writeText(hexList).then(() => {
          exportBtn.textContent = 'Copied!';
          setTimeout(() => {
            exportBtn.textContent = 'Export';
          }, 1500);
        });
      };
    }

    const clearAllBtn = qs('clearAllColors');
    if (clearAllBtn) {
      clearAllBtn.onclick = async () => {
        if (customColors.length === 0) return;

        if (confirm(`Remove all ${customColors.length} custom colors?`)) {
          customColors = [];
          selectedColors.clear();
          await saveCustomColors();

          // Refresh all palettes for day colors
          for (let i = 0; i < 7; i++) {
            createCustomColorPalette(i);
          }

          // Refresh time block palettes
          createTimeBlockGlobalCustomColorPalette();
          document.querySelectorAll('.time-block-color-item').forEach((item) => {
            const blockId = item.dataset.blockId;
            if (blockId) {
              const customPalette = qs(`timeBlockCustomPalette-${blockId}`);
              if (customPalette) {
                customPalette.innerHTML = '';
                if (customColors.length === 0) {
                  customPalette.appendChild(createCustomColorsEmptyState());
                } else {
                  customColors.forEach((color) => {
                    customPalette.appendChild(
                      createTimeBlockColorSwatch(
                        color,
                        {
                          colorInput: qs(`timeBlockColor-${blockId}`),
                          preview: qs(`timeBlockPreview-${blockId}`),
                        },
                        customPalette,
                        true,
                      ),
                    );
                  });
                }
              }
            }
          });

          updateColorLab();
        }
      };
    }
  }

  async function loadSettings() {
    try {
      // Use the main storage system - this returns the full settings object
      settings = await window.cc3Storage.getSettings();
    } catch (error) {
      console.error('❌ Error loading settings:', error);
      settings = {
        enabled: false,
        weekdayColors: { ...defaultColors },
        weekdayOpacity: { ...defaultOpacity },
        dateColors: {},
        weekStart: defaultWeekStart,
      };
    }
  }

  async function saveSettings() {
    try {
      // Settings are already saved by the storage methods we used
      // Just need to notify content script of changes
      const tabs = await chrome.tabs.query({ url: '*://calendar.google.com/*' });

      for (const tab of tabs) {
        try {
          const message = {
            type: 'settingsChanged',
            feature: 'dayColoring',
            settings: settings, // Send the full settings object as expected by dayColoring feature
          };

          await chrome.tabs.sendMessage(tab.id, message);
        } catch (e) {}
      }
    } catch (error) {
      console.error('❌ Error saving settings:', error);
    }
  }

  function updateToggle() {
    const toggle = qs('enableDayColoring');
    const colorSettings = qs('colorSettings');
    const weekStartSetupPrompt = qs('weekStartSetupPrompt');

    if (settings.enabled) {
      toggle.classList.add('active');

      // Check if week start has been configured
      if (settings.weekStartConfigured) {
        // Normal state - show color settings, hide setup prompt
        weekStartSetupPrompt.style.display = 'none';
        colorSettings?.classList.remove('feature-disabled');
      } else {
        // Setup needed - show setup prompt, grey out color settings
        weekStartSetupPrompt.style.display = 'block';
        colorSettings?.classList.add('feature-disabled');
      }
    } else {
      toggle.classList.remove('active');
      weekStartSetupPrompt.style.display = 'none';
      colorSettings?.classList.add('feature-disabled');
    }
  }

  function updateTimeBlockingToggle() {
    const toggle = qs('enableTimeBlocking');
    const timeBlockSettings = qs('timeBlockSettings');

    if (settings.timeBlocking?.enabled) {
      toggle.classList.add('active');
      timeBlockSettings?.classList.remove('feature-disabled');
    } else {
      toggle.classList.remove('active');
      timeBlockSettings?.classList.add('feature-disabled');
    }
  }

  function updateTimeBlockingSettings() {
    const globalColor = qs('timeBlockGlobalColor');
    const globalPreview = qs('globalTimeBlockPreview');
    const shadingStyle = qs('timeBlockShadingStyle');

    if (globalColor) {
      globalColor.value = settings.timeBlocking?.globalColor || '#FFEB3B';
    }
    if (globalPreview) {
      globalPreview.style.backgroundColor = settings.timeBlocking?.globalColor || '#FFEB3B';
    }
    if (shadingStyle) {
      shadingStyle.value = settings.timeBlocking?.shadingStyle || 'solid';
    }

    // Create global time block color palettes
    createTimeBlockGlobalColorPalette();
    createTimeBlockGlobalPastelColorPalette();
    createTimeBlockGlobalDarkColorPalette();
    createTimeBlockGlobalCustomColorPalette();

    updateTimeBlockingSchedule();
    updateDateSpecificSchedule();
  }

  function showToast(message) {
    // Simple toast notification
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #323232;
      color: white;
      padding: 12px 24px;
      border-radius: 4px;
      font-size: 14px;
      z-index: 10000;
      box-shadow: 0 2px 5px rgba(0,0,0,0.3);
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  // Utility function to calculate luminance and determine readable text color
  function getReadableTextColor(hexColor, opacity = 100) {
    // Convert hex to RGB
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    // Apply opacity to RGB values (blend with white background)
    const alpha = opacity / 100;
    const blendedR = Math.round(r * alpha + 255 * (1 - alpha));
    const blendedG = Math.round(g * alpha + 255 * (1 - alpha));
    const blendedB = Math.round(b * alpha + 255 * (1 - alpha));

    // Calculate luminance using the relative luminance formula
    const luminance = (0.299 * blendedR + 0.587 * blendedG + 0.114 * blendedB) / 255;

    // Return white for dark backgrounds, black for light backgrounds
    return luminance > 0.5 ? '#000000' : '#ffffff';
  }

  // Utility function to get day color with opacity applied
  function getDayCardColor(dayKey) {
    const dayIndexMap = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 0 };
    const dayIndex = dayIndexMap[dayKey];

    if (!settings || !settings.weekdayColors || !settings.weekdayOpacity) {
      // Fallback to neutral color
      return { backgroundColor: '#e2e8f0', textColor: '#475569' };
    }

    const color = settings.weekdayColors[dayIndex] || '#e2e8f0';
    const opacity = settings.weekdayOpacity[dayIndex] || 30;

    // Convert to rgba for the background
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const alpha = opacity / 100;

    const backgroundColor = `rgba(${r}, ${g}, ${b}, ${alpha})`;
    const textColor = getReadableTextColor(color, opacity);

    return { backgroundColor, textColor };
  }

  function updateTimeBlockingSchedule() {
    const scheduleContainer = qs('timeBlockSchedule');
    if (!scheduleContainer) return;

    const dayKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    const dayNames = {
      mon: 'Monday',
      tue: 'Tuesday',
      wed: 'Wednesday',
      thu: 'Thursday',
      fri: 'Friday',
      sat: 'Saturday',
      sun: 'Sunday',
    };

    scheduleContainer.innerHTML = '';

    dayKeys.forEach((dayKey) => {
      const daySection = document.createElement('div');
      daySection.style.cssText = `
				margin-bottom: 16px;
			`;

      const header = document.createElement('div');
      header.className = 'time-block-day-header';

      const dayLabel = document.createElement('div');
      dayLabel.textContent = dayNames[dayKey];
      dayLabel.className = 'time-block-day-title-card';

      // Apply day color styling
      const dayColors = getDayCardColor(dayKey);
      dayLabel.style.backgroundColor = dayColors.backgroundColor;
      dayLabel.style.color = dayColors.textColor;

      const addButton = document.createElement('button');
      addButton.textContent = '+ Add Block';
      addButton.className = 'time-block-add-btn';
      addButton.onclick = () => addTimeBlock(dayKey);

      header.appendChild(dayLabel);
      header.appendChild(addButton);

      const blocksContainer = document.createElement('div');
      blocksContainer.id = `timeBlocks-${dayKey}`;

      const dayBlocks = settings.timeBlocking?.weeklySchedule?.[dayKey] || [];
      dayBlocks.forEach((block, index) => {
        blocksContainer.appendChild(createTimeBlockElement(dayKey, block, index));
      });

      daySection.appendChild(header);
      daySection.appendChild(blocksContainer);
      scheduleContainer.appendChild(daySection);
    });
  }

  function createTimeBlockElement(dayKey, block, index) {
    const blockEl = document.createElement('div');
    blockEl.className = 'time-block-item';

    // Custom time pickers for start and end time (removed auto-update)
    const startTimePicker = createTimePicker(block.timeRange[0], () => {
      // No automatic update - require manual save
    });

    const endTimePicker = createTimePicker(block.timeRange[1], () => {
      // No automatic update - require manual save
    });

    // Color picker with new UI
    const blockColorId = `${dayKey}-${index}`;
    const colorContainer = document.createElement('div');
    colorContainer.className = 'time-block-color-item';
    colorContainer.dataset.blockId = blockColorId;

    const colorPreview = document.createElement('div');
    colorPreview.className = 'time-block-color-preview';
    const previewColor = block.color || settings.timeBlocking?.globalColor || '#FFEB3B';
    colorPreview.style.backgroundColor = previewColor;
    colorPreview.id = `timeBlockPreview-${blockColorId}`;

    // Apply dashed pattern if block style is hashed
    if (block.style === 'hashed') {
      const encodedColor = encodeURIComponent(previewColor);
      const hashedPattern = `url("data:image/svg+xml;charset=utf8,%3Csvg%20width%3D%228%22%20height%3D%228%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M4%200h4L0%208V4l4-4zm4%204v4H4l4-4z%22%20fill%3D%22${encodedColor}%22%2F%3E%3C%2Fsvg%3E")`;
      colorPreview.style.background = hashedPattern;
      colorPreview.style.backgroundColor = 'white';
    }

    const blockStyle = block.style || settings.timeBlocking?.shadingStyle || 'solid';
    const colorDetails = document.createElement('div');
    colorDetails.className = 'time-block-color-details';
    colorDetails.id = `timeBlockDetails-${blockColorId}`;
    colorDetails.innerHTML = `
			<div class="style-selector-row" style="display: flex; gap: 6px; margin-bottom: 8px; padding: 8px; background: #f8f9fa; border-radius: 8px;">
				<button class="style-btn ${blockStyle === 'solid' ? 'active' : ''}" data-style="solid" data-timeblock="${blockColorId}" style="
					flex: 1;
					padding: 6px 10px;
					border: 2px solid ${blockStyle === 'solid' ? '#1a73e8' : '#dadce0'};
					border-radius: 6px;
					font-size: 11px;
					color: ${blockStyle === 'solid' ? '#1a73e8' : '#5f6368'};
					background: ${blockStyle === 'solid' ? '#e8f0fe' : 'white'};
					cursor: pointer;
					font-weight: ${blockStyle === 'solid' ? '600' : '500'};
				">Solid</button>
				<button class="style-btn ${blockStyle === 'hashed' ? 'active' : ''}" data-style="hashed" data-timeblock="${blockColorId}" style="
					flex: 1;
					padding: 6px 10px;
					border: 2px solid ${blockStyle === 'hashed' ? '#1a73e8' : '#dadce0'};
					border-radius: 6px;
					font-size: 11px;
					color: ${blockStyle === 'hashed' ? '#1a73e8' : '#5f6368'};
					background: ${blockStyle === 'hashed' ? '#e8f0fe' : 'white'};
					cursor: pointer;
					font-weight: ${blockStyle === 'hashed' ? '600' : '500'};
				">Dashed</button>
			</div>
			<div class="color-picker-tabs">
				<button class="color-tab active" data-tab="vibrant" data-timeblock="${blockColorId}">Vibrant</button>
				<button class="color-tab" data-tab="pastel" data-timeblock="${blockColorId}">Pastel</button>
				<button class="color-tab" data-tab="dark" data-timeblock="${blockColorId}">Dark</button>
				<button class="color-tab" data-tab="custom" data-timeblock="${blockColorId}">Custom</button>
			</div>
			<div class="color-tab-content">
				<div class="color-picker-container" style="margin-bottom: 8px;">
					<input type="color" id="timeBlockColor-${blockColorId}" value="${block.color || settings.timeBlocking?.globalColor || '#FFEB3B'}" style="width: 60%; height: 28px;">
					<input type="text" id="timeBlockHex-${blockColorId}" value="${(block.color || settings.timeBlocking?.globalColor || '#FFEB3B').toUpperCase()}" placeholder="#FF0000" maxlength="7" class="hex-input-small" style="width: 35%; height: 24px; margin-left: 4px; font-size: 10px; padding: 2px 4px; border: 1px solid #ccc; border-radius: 3px; text-transform: uppercase;">
					<div class="color-picker-icon" data-timeblock="${blockColorId}" title="Click to open/close color picker">🎨</div>
				</div>
				<div class="color-tab-panel active" id="timeblock-${blockColorId}-vibrant-panel">
					<div class="color-palette" id="timeBlockPalette-${blockColorId}"></div>
				</div>
				<div class="color-tab-panel" id="timeblock-${blockColorId}-pastel-panel">
					<div class="color-palette" id="timeBlockPastelPalette-${blockColorId}"></div>
				</div>
				<div class="color-tab-panel" id="timeblock-${blockColorId}-dark-panel">
					<div class="color-palette" id="timeBlockDarkPalette-${blockColorId}"></div>
				</div>
				<div class="color-tab-panel" id="timeblock-${blockColorId}-custom-panel">
					<div class="color-palette" id="timeBlockCustomPalette-${blockColorId}"></div>
				</div>
			</div>
		`;

    colorContainer.appendChild(colorPreview);
    colorContainer.appendChild(colorDetails);

    // Get the actual color input for existing functionality
    const colorInput = colorContainer.querySelector(`#timeBlockColor-${blockColorId}`);
    const hexInput = colorContainer.querySelector(`#timeBlockHex-${blockColorId}`);

    // Sync color picker and hex input (removed auto-update)
    if (hexInput) {
      // When color picker changes, update hex input
      const syncHexFromColor = () => {
        hexInput.value = colorInput.value.toUpperCase();
      };

      // When hex input changes, update color picker
      const syncColorFromHex = () => {
        const hexValue = hexInput.value.trim();
        // Add # if missing
        const normalizedHex = hexValue.startsWith('#') ? hexValue : '#' + hexValue;
        // Validate hex format
        if (/^#[0-9A-Fa-f]{6}$/.test(normalizedHex)) {
          colorInput.value = normalizedHex;
          hexInput.style.borderColor = '#1a73e8';
          // Removed auto-update call
        } else {
          hexInput.style.borderColor = '#dc2626';
        }
      };

      colorInput.addEventListener('change', syncHexFromColor);
      colorInput.addEventListener('input', syncHexFromColor);
      hexInput.addEventListener('input', syncColorFromHex);
      hexInput.addEventListener('change', syncColorFromHex);
    }

    // Custom label input (removed auto-update)
    const labelInput = createLabelInput(block.label, 'Label (optional)', 50, () => {
      // No automatic update - require manual save
    });

    // Error indicator
    const errorIndicator = document.createElement('div');
    errorIndicator.className = 'cc3-time-error-indicator';
    errorIndicator.style.cssText = `
			display: none;
			width: 20px;
			height: 20px;
			background: rgba(244, 67, 54, 0.2);
			border: 1px solid #f44336;
			color: #f44336;
			border-radius: 50%;
			font-size: 14px;
			font-weight: bold;
			line-height: 18px;
			text-align: center;
			cursor: help;
			margin-left: 4px;
		`;
    errorIndicator.textContent = '!';
    errorIndicator.title = 'End time must be after start time';

    // Save button
    const saveButton = document.createElement('button');
    saveButton.textContent = '✓';
    saveButton.style.cssText = `
			width: 22px;
			height: 22px;
			padding: 0;
			background: linear-gradient(135deg, #4caf50, #45a049);
			color: white;
			border: none;
			border-radius: 4px;
			font-size: 12px;
			font-weight: bold;
			cursor: pointer;
			display: flex;
			align-items: center;
			justify-content: center;
			margin-right: 4px;
			box-shadow: 0 2px 4px rgba(76, 175, 80, 0.3);
			transition: all 0.2s ease;
		`;
    saveButton.title = 'Save changes';

    // Track original values for change detection
    const originalValues = {
      startTime: block.timeRange[0],
      endTime: block.timeRange[1],
      color: block.color || settings.timeBlocking?.globalColor || '#FFEB3B',
      label: block.label || '',
    };

    // Function to disable save button (greyed out)
    const disableSaveButton = () => {
      saveButton.disabled = true;
      saveButton.style.background = 'linear-gradient(135deg, #9e9e9e, #757575)';
      saveButton.style.cursor = 'not-allowed';
      saveButton.style.opacity = '0.5';
      saveButton.title = 'No changes to save';
    };

    // Function to enable save button
    const enableSaveButton = () => {
      saveButton.disabled = false;
      saveButton.style.background = 'linear-gradient(135deg, #4caf50, #45a049)';
      saveButton.style.cursor = 'pointer';
      saveButton.style.opacity = '1';
      saveButton.title = 'Save changes';
    };

    // Function to check if there are changes
    const checkForChanges = () => {
      const hasChanges =
        startTimePicker.getValue() !== originalValues.startTime ||
        endTimePicker.getValue() !== originalValues.endTime ||
        colorInput.value.toUpperCase() !== originalValues.color.toUpperCase() ||
        labelInput.getValue() !== originalValues.label;

      if (hasChanges) {
        enableSaveButton();
      } else {
        disableSaveButton();
      }
    };

    // Initially disable save button (no changes yet)
    disableSaveButton();

    // Add change listeners to all inputs
    startTimePicker.addEventListener('change', checkForChanges);
    endTimePicker.addEventListener('change', checkForChanges);
    colorInput.addEventListener('change', checkForChanges);
    colorInput.addEventListener('input', checkForChanges);
    hexInput.addEventListener('change', checkForChanges);
    hexInput.addEventListener('input', checkForChanges);
    labelInput.addEventListener('input', checkForChanges);

    // Add hover effects (only when enabled)
    saveButton.addEventListener('mouseenter', () => {
      if (!saveButton.disabled) {
        saveButton.style.transform = 'translateY(-1px)';
        saveButton.style.boxShadow = '0 3px 6px rgba(76, 175, 80, 0.4)';
      }
    });
    saveButton.addEventListener('mouseleave', () => {
      if (!saveButton.disabled) {
        saveButton.style.transform = 'translateY(0)';
        saveButton.style.boxShadow = '0 2px 4px rgba(76, 175, 80, 0.3)';
      }
    });

    // Remove button
    const removeButton = document.createElement('button');
    removeButton.textContent = '×';
    removeButton.style.cssText = `
			width: 22px;
			height: 22px;
			padding: 0;
			background: linear-gradient(135deg, #f44336, #d32f2f);
			color: white;
			border: none;
			border-radius: 4px;
			font-size: 14px;
			font-weight: bold;
			cursor: pointer;
			display: flex;
			align-items: center;
			justify-content: center;
			box-shadow: 0 2px 4px rgba(244, 67, 54, 0.3);
			transition: all 0.2s ease;
		`;
    removeButton.title = 'Remove timeblock';

    // Add hover effects
    removeButton.addEventListener('mouseenter', () => {
      removeButton.style.transform = 'translateY(-1px)';
      removeButton.style.boxShadow = '0 3px 6px rgba(244, 67, 54, 0.4)';
    });
    removeButton.addEventListener('mouseleave', () => {
      removeButton.style.transform = 'translateY(0)';
      removeButton.style.boxShadow = '0 2px 4px rgba(244, 67, 54, 0.3)';
    });

    // Event listeners
    const updateBlock = async () => {
      const startTime = startTimePicker.getValue();
      const endTime = endTimePicker.getValue();

      if (startTime && endTime && startTime < endTime) {
        // Valid time range - hide error indicator
        errorIndicator.style.display = 'none';

        // Get current style from buttons
        let currentStyle = block.style || 'solid';
        const activeStyleBtn = colorContainer.querySelector('.style-btn[style*="rgb(26, 115, 232)"]');
        if (activeStyleBtn) {
          currentStyle = activeStyleBtn.dataset.style;
        }

        const newBlock = {
          timeRange: [startTime, endTime],
          color: colorInput.value,
          label: labelInput.getValue(),
          style: currentStyle,
        };
        await window.cc3Storage.updateTimeBlock(dayKey, index, newBlock);
        settings = await window.cc3Storage.getSettings();
        notifyTimeBlockingChange();

        // Update original values and disable save button after successful save
        originalValues.startTime = startTime;
        originalValues.endTime = endTime;
        originalValues.color = colorInput.value;
        originalValues.label = labelInput.getValue();
        disableSaveButton();
      } else {
        // Invalid time range - show error indicator instead of alert
        errorIndicator.style.display = 'block';
      }
    };

    // Save button click handler
    saveButton.onclick = updateBlock;

    // Removed automatic color updating

    removeButton.onclick = async () => {
      await window.cc3Storage.removeTimeBlock(dayKey, index);
      settings = await window.cc3Storage.getSettings();
      updateTimeBlockingSchedule();
      notifyTimeBlockingChange();
    };

    blockEl.appendChild(startTimePicker);
    blockEl.appendChild(document.createTextNode(' - '));
    blockEl.appendChild(endTimePicker);
    blockEl.appendChild(errorIndicator);
    blockEl.appendChild(colorContainer);
    blockEl.appendChild(labelInput);
    blockEl.appendChild(saveButton);
    blockEl.appendChild(removeButton);

    // Create color palettes for this time block after element is created
    requestAnimationFrame(() => {
      createIndividualTimeBlockPalettes(blockColorId);
    });

    return blockEl;
  }

  async function addTimeBlock(dayKey) {
    // Create time block modal for recurring weekly blocks
    const modal = createRecurringTimeBlockModal(dayKey);
    document.body.appendChild(modal);

    // Focus the modal for keyboard navigation
    modal.focus();

    return new Promise((resolve) => {
      const cleanup = () => {
        if (modal.parentNode) {
          document.body.removeChild(modal);
        }
        resolve(null);
      };

      // Handle time block creation
      const handleBlockCreate = async (timeRange, isAllDay, label, color, style) => {
        const newBlock = {
          timeRange: isAllDay ? ['00:00', '23:59'] : timeRange,
          color: color || settings.timeBlocking?.globalColor || '#FFEB3B',
          label: label || '',
          style: style || settings.timeBlocking?.shadingStyle || 'solid',
        };
        await window.cc3Storage.addTimeBlock(dayKey, newBlock);
        settings = await window.cc3Storage.getSettings();
        updateTimeBlockingSchedule();
        notifyTimeBlockingChange();
        cleanup();
        resolve(newBlock);
      };

      // Set up event handlers
      setupRecurringTimeBlockEvents(modal, handleBlockCreate, cleanup);
    });
  }

  function createRecurringTimeBlockModal(dayKey) {
    const dayNames = {
      sun: 'Sunday',
      mon: 'Monday',
      tue: 'Tuesday',
      wed: 'Wednesday',
      thu: 'Thursday',
      fri: 'Friday',
      sat: 'Saturday',
    };

    const modal = document.createElement('div');
    modal.className = 'cc3-time-block-modal';
    modal.tabIndex = -1;
    modal.style.cssText = `
			position: fixed;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			background: rgba(0, 0, 0, 0.5);
			display: flex;
			align-items: center;
			justify-content: center;
			z-index: 10000;
			opacity: 0;
			transition: opacity 0.2s ease;
		`;

    const picker = document.createElement('div');
    picker.className = 'cc3-time-block-picker';
    picker.style.cssText = `
			background: white;
			border-radius: 12px;
			padding: 24px;
			box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
			max-width: 400px;
			width: 90%;
			max-height: 90vh;
			overflow-y: auto;
			transform: translateY(-20px);
			transition: transform 0.2s ease;
		`;

    // Header with close button
    const header = document.createElement('div');
    header.style.cssText = `
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: 24px;
		`;

    const title = document.createElement('h3');
    title.textContent = `Add Time Block - ${dayNames[dayKey]}`;
    title.style.cssText = `
			margin: 0;
			font-size: 18px;
			font-weight: 600;
			color: #202124;
		`;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'cc3-close-btn';
    closeBtn.innerHTML = '×';
    closeBtn.style.cssText = `
			background: none;
			border: none;
			font-size: 28px;
			color: #5f6368;
			cursor: pointer;
			padding: 0;
			width: 32px;
			height: 32px;
			display: flex;
			align-items: center;
			justify-content: center;
			border-radius: 50%;
			transition: background-color 0.2s ease;
		`;
    closeBtn.onmouseover = () => (closeBtn.style.backgroundColor = '#f1f3f4');
    closeBtn.onmouseout = () => (closeBtn.style.backgroundColor = 'transparent');

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Time section
    const timeSection = document.createElement('div');
    timeSection.style.cssText = `
			margin-bottom: 24px;
		`;

    const timeTitle = document.createElement('div');
    timeTitle.textContent = 'Time:';
    timeTitle.style.cssText = `
			font-size: 12px;
			font-weight: 600;
			color: #5f6368;
			margin-bottom: 8px;
			text-transform: uppercase;
			letter-spacing: 0.5px;
		`;

    // All-day checkbox
    const allDayContainer = document.createElement('div');
    allDayContainer.style.cssText = `
			display: flex;
			align-items: center;
			gap: 8px;
			margin-bottom: 12px;
		`;

    const allDayCheckbox = document.createElement('input');
    allDayCheckbox.type = 'checkbox';
    allDayCheckbox.id = 'cc3-recurring-all-day-checkbox';
    allDayCheckbox.className = 'cc3-all-day-checkbox';
    allDayCheckbox.style.cssText = `
			width: 18px;
			height: 18px;
			cursor: pointer;
		`;

    const allDayLabel = document.createElement('label');
    allDayLabel.setAttribute('for', 'cc3-recurring-all-day-checkbox');
    allDayLabel.textContent = 'All day';
    allDayLabel.style.cssText = `
			font-size: 14px;
			color: #202124;
			cursor: pointer;
		`;

    allDayContainer.appendChild(allDayCheckbox);
    allDayContainer.appendChild(allDayLabel);

    // Time inputs container
    const timeInputsContainer = document.createElement('div');
    timeInputsContainer.className = 'cc3-time-inputs';
    timeInputsContainer.style.cssText = `
			display: flex;
			gap: 12px;
			align-items: center;
		`;

    // Start time input
    const startTimeContainer = document.createElement('div');
    startTimeContainer.style.cssText = `
			flex: 1;
		`;

    const startTimeLabel = document.createElement('label');
    startTimeLabel.textContent = 'Start';
    startTimeLabel.style.cssText = `
			display: block;
			font-size: 11px;
			color: #5f6368;
			margin-bottom: 4px;
			font-weight: 500;
		`;

    const startTimeInput = document.createElement('input');
    startTimeInput.type = 'time';
    startTimeInput.className = 'cc3-start-time';
    startTimeInput.value = '09:00';
    startTimeInput.style.cssText = `
			width: 100%;
			padding: 10px 12px;
			border: 2px solid #dadce0;
			border-radius: 8px;
			font-size: 14px;
			color: #202124;
			transition: border-color 0.2s ease;
			box-sizing: border-box;
		`;
    startTimeInput.onfocus = () => (startTimeInput.style.borderColor = '#1a73e8');
    startTimeInput.onblur = () => (startTimeInput.style.borderColor = '#dadce0');

    startTimeContainer.appendChild(startTimeLabel);
    startTimeContainer.appendChild(startTimeInput);

    // End time input
    const endTimeContainer = document.createElement('div');
    endTimeContainer.style.cssText = `
			flex: 1;
		`;

    const endTimeLabel = document.createElement('label');
    endTimeLabel.textContent = 'End';
    endTimeLabel.style.cssText = `
			display: block;
			font-size: 11px;
			color: #5f6368;
			margin-bottom: 4px;
			font-weight: 500;
		`;

    const endTimeInput = document.createElement('input');
    endTimeInput.type = 'time';
    endTimeInput.className = 'cc3-end-time';
    endTimeInput.value = '17:00';
    endTimeInput.style.cssText = `
			width: 100%;
			padding: 10px 12px;
			border: 2px solid #dadce0;
			border-radius: 8px;
			font-size: 14px;
			color: #202124;
			transition: border-color 0.2s ease;
			box-sizing: border-box;
		`;
    endTimeInput.onfocus = () => (endTimeInput.style.borderColor = '#1a73e8');
    endTimeInput.onblur = () => (endTimeInput.style.borderColor = '#dadce0');

    endTimeContainer.appendChild(endTimeLabel);
    endTimeContainer.appendChild(endTimeInput);

    timeInputsContainer.appendChild(startTimeContainer);
    timeInputsContainer.appendChild(endTimeContainer);

    timeSection.appendChild(timeTitle);
    timeSection.appendChild(allDayContainer);
    timeSection.appendChild(timeInputsContainer);

    // Handle all-day checkbox toggle
    allDayCheckbox.onchange = () => {
      const isAllDay = allDayCheckbox.checked;
      startTimeInput.disabled = isAllDay;
      endTimeInput.disabled = isAllDay;
      timeInputsContainer.style.opacity = isAllDay ? '0.5' : '1';
      timeInputsContainer.style.pointerEvents = isAllDay ? 'none' : 'auto';
    };

    // Label section
    const labelSection = document.createElement('div');
    labelSection.style.cssText = `
			margin-bottom: 24px;
		`;

    const labelTitle = document.createElement('div');
    labelTitle.textContent = 'Label (optional):';
    labelTitle.style.cssText = `
			font-size: 12px;
			font-weight: 600;
			color: #5f6368;
			margin-bottom: 8px;
			text-transform: uppercase;
			letter-spacing: 0.5px;
		`;

    const labelInput = document.createElement('input');
    labelInput.type = 'text';
    labelInput.className = 'cc3-label-input';
    labelInput.placeholder = 'e.g., Focus Time, Meeting, Break';
    labelInput.style.cssText = `
			width: 100%;
			padding: 12px 16px;
			border: 2px solid #dadce0;
			border-radius: 8px;
			font-size: 14px;
			color: #202124;
			transition: border-color 0.2s ease;
			box-sizing: border-box;
		`;
    labelInput.onfocus = () => (labelInput.style.borderColor = '#1a73e8');
    labelInput.onblur = () => (labelInput.style.borderColor = '#dadce0');

    labelSection.appendChild(labelTitle);
    labelSection.appendChild(labelInput);

    // Style selector section
    const styleSection = document.createElement('div');
    styleSection.style.cssText = `
			margin-bottom: 20px;
		`;

    const styleTitle = document.createElement('div');
    styleTitle.textContent = 'Style:';
    styleTitle.style.cssText = `
			font-size: 12px;
			font-weight: 600;
			color: #5f6368;
			margin-bottom: 8px;
			text-transform: uppercase;
			letter-spacing: 0.5px;
		`;

    const styleButtonsContainer = document.createElement('div');
    styleButtonsContainer.style.cssText = `
			display: flex;
			gap: 8px;
		`;

    const defaultStyle = settings.timeBlocking?.shadingStyle || 'solid';

    const solidBtn = document.createElement('button');
    solidBtn.textContent = 'Solid';
    solidBtn.className = 'cc3-style-btn';
    solidBtn.dataset.style = 'solid';
    solidBtn.style.cssText = `
			flex: 1;
			padding: 10px 16px;
			border: 2px solid ${defaultStyle === 'solid' ? '#1a73e8' : '#dadce0'};
			border-radius: 8px;
			font-size: 13px;
			color: ${defaultStyle === 'solid' ? '#1a73e8' : '#5f6368'};
			background: ${defaultStyle === 'solid' ? '#e8f0fe' : 'white'};
			cursor: pointer;
			font-weight: ${defaultStyle === 'solid' ? '600' : '500'};
			transition: all 0.2s ease;
		`;

    const hashedBtn = document.createElement('button');
    hashedBtn.textContent = 'Dashed';
    hashedBtn.className = 'cc3-style-btn';
    hashedBtn.dataset.style = 'hashed';
    hashedBtn.style.cssText = `
			flex: 1;
			padding: 10px 16px;
			border: 2px solid ${defaultStyle === 'hashed' ? '#1a73e8' : '#dadce0'};
			border-radius: 8px;
			font-size: 13px;
			color: ${defaultStyle === 'hashed' ? '#1a73e8' : '#5f6368'};
			background: ${defaultStyle === 'hashed' ? '#e8f0fe' : 'white'};
			cursor: pointer;
			font-weight: ${defaultStyle === 'hashed' ? '600' : '500'};
			transition: all 0.2s ease;
		`;

    // Style button click handlers
    const updateStyleButtons = (selectedStyle) => {
      [solidBtn, hashedBtn].forEach((btn) => {
        const isSelected = btn.dataset.style === selectedStyle;
        btn.style.borderColor = isSelected ? '#1a73e8' : '#dadce0';
        btn.style.color = isSelected ? '#1a73e8' : '#5f6368';
        btn.style.background = isSelected ? '#e8f0fe' : 'white';
        btn.style.fontWeight = isSelected ? '600' : '500';
      });
    };

    solidBtn.onclick = () => updateStyleButtons('solid');
    hashedBtn.onclick = () => updateStyleButtons('hashed');

    styleButtonsContainer.appendChild(solidBtn);
    styleButtonsContainer.appendChild(hashedBtn);
    styleSection.appendChild(styleTitle);
    styleSection.appendChild(styleButtonsContainer);

    // Color picker section
    const defaultColor = settings.timeBlocking?.globalColor || '#FFEB3B';
    const colorSection = createTimeBlockColorPicker('recurring', defaultColor);

    // Action buttons
    const actions = document.createElement('div');
    actions.style.cssText = `
			display: flex;
			gap: 12px;
			justify-content: flex-end;
		`;

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = 'cc3-cancel-btn';
    cancelBtn.style.cssText = `
			background: none;
			border: 1px solid #dadce0;
			border-radius: 6px;
			padding: 10px 20px;
			font-size: 14px;
			color: #5f6368;
			cursor: pointer;
			transition: all 0.2s ease;
		`;
    cancelBtn.onmouseover = () => {
      cancelBtn.style.backgroundColor = '#f8f9fa';
      cancelBtn.style.borderColor = '#5f6368';
    };
    cancelBtn.onmouseout = () => {
      cancelBtn.style.backgroundColor = 'transparent';
      cancelBtn.style.borderColor = '#dadce0';
    };

    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = 'Add Time Block';
    confirmBtn.className = 'cc3-confirm-btn';
    confirmBtn.style.cssText = `
			background: #1a73e8;
			border: none;
			border-radius: 6px;
			padding: 10px 20px;
			font-size: 14px;
			color: white;
			cursor: pointer;
			font-weight: 500;
			transition: background-color 0.2s ease;
		`;
    confirmBtn.onmouseover = () => (confirmBtn.style.backgroundColor = '#1557b0');
    confirmBtn.onmouseout = () => (confirmBtn.style.backgroundColor = '#1a73e8');

    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);

    // Assemble the picker
    picker.appendChild(header);
    picker.appendChild(timeSection);
    picker.appendChild(labelSection);
    picker.appendChild(styleSection);
    picker.appendChild(colorSection);
    picker.appendChild(actions);
    modal.appendChild(picker);

    // Trigger entrance animation
    requestAnimationFrame(() => {
      modal.style.opacity = '1';
      picker.style.transform = 'translateY(0)';
    });

    return modal;
  }

  function setupRecurringTimeBlockEvents(modal, onBlockCreate, onCancel) {
    const closeBtn = modal.querySelector('.cc3-close-btn');
    const cancelBtn = modal.querySelector('.cc3-cancel-btn');
    const confirmBtn = modal.querySelector('.cc3-confirm-btn');
    const startTimeInput = modal.querySelector('.cc3-start-time');
    const endTimeInput = modal.querySelector('.cc3-end-time');
    const allDayCheckbox = modal.querySelector('.cc3-all-day-checkbox');
    const labelInput = modal.querySelector('.cc3-label-input');
    const colorInput = modal.querySelector('.cc3-color-input');
    const styleButtons = modal.querySelectorAll('.cc3-style-btn');

    // Helper to get values
    const getValues = () => {
      const isAllDay = allDayCheckbox.checked;
      const timeRange = [startTimeInput.value || '09:00', endTimeInput.value || '17:00'];
      const label = labelInput.value.trim();
      const color = colorInput.value;
      // Get selected style from buttons
      let style = 'solid';
      styleButtons.forEach((btn) => {
        if (btn.style.borderColor === 'rgb(26, 115, 232)') {
          style = btn.dataset.style;
        }
      });
      return { timeRange, isAllDay, label, color, style };
    };

    // Close handlers
    const handleClose = () => onCancel();
    closeBtn.onclick = handleClose;
    cancelBtn.onclick = handleClose;

    // Confirm button handler
    confirmBtn.onclick = () => {
      const { timeRange, isAllDay, label, color, style } = getValues();
      onBlockCreate(timeRange, isAllDay, label, color, style);
    };

    // Click outside to close
    modal.onclick = (e) => {
      if (e.target === modal) {
        handleClose();
      }
    };

    // Keyboard navigation
    modal.onkeydown = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      } else if (e.key === 'Enter') {
        const { timeRange, isAllDay, label, color, style } = getValues();
        onBlockCreate(timeRange, isAllDay, label, color, style);
      }
    };

    // Focus the start time input initially
    setTimeout(() => startTimeInput.focus(), 100);
  }

  // Custom Time Picker Helper Function
  function createTimePicker(initialTime, onChangeCallback) {
    const [initialHours, initialMinutes] = initialTime.split(':');

    const timePickerContainer = document.createElement('div');
    timePickerContainer.className = 'custom-time-picker';

    const hoursInput = document.createElement('input');
    hoursInput.type = 'text';
    hoursInput.className = 'time-input hours';
    hoursInput.value = initialHours;
    hoursInput.maxLength = 2;
    hoursInput.placeholder = '00';

    const separator = document.createElement('span');
    separator.className = 'time-separator';
    separator.textContent = ':';

    const minutesInput = document.createElement('input');
    minutesInput.type = 'text';
    minutesInput.className = 'time-input minutes';
    minutesInput.value = initialMinutes;
    minutesInput.maxLength = 2;
    minutesInput.placeholder = '00';

    // Input validation and formatting
    const validateHours = (value) => {
      const num = parseInt(value) || 0;
      return Math.min(23, Math.max(0, num)).toString().padStart(2, '0');
    };

    const validateMinutes = (value) => {
      const num = parseInt(value) || 0;
      return Math.min(59, Math.max(0, num)).toString().padStart(2, '0');
    };

    const updateTime = () => {
      const hours = validateHours(hoursInput.value);
      const minutes = validateMinutes(minutesInput.value);
      const timeString = `${hours}:${minutes}`;

      // Update display values
      hoursInput.value = hours;
      minutesInput.value = minutes;

      if (onChangeCallback) {
        onChangeCallback(timeString);
      }
    };

    // Event listeners for validation and navigation
    hoursInput.addEventListener('input', (e) => {
      // Allow only numbers
      e.target.value = e.target.value.replace(/[^0-9]/g, '');

      // Auto-advance to minutes when 2 digits are entered
      if (e.target.value.length === 2) {
        minutesInput.focus();
        minutesInput.select();
      }
    });

    minutesInput.addEventListener('input', (e) => {
      // Allow only numbers
      e.target.value = e.target.value.replace(/[^0-9]/g, '');
    });

    hoursInput.addEventListener('blur', updateTime);
    minutesInput.addEventListener('blur', updateTime);

    // Enter key handling
    hoursInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        minutesInput.focus();
        minutesInput.select();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const currentHours = parseInt(hoursInput.value) || 0;
        hoursInput.value = Math.min(23, currentHours + 1)
          .toString()
          .padStart(2, '0');
        updateTime();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const currentHours = parseInt(hoursInput.value) || 0;
        hoursInput.value = Math.max(0, currentHours - 1)
          .toString()
          .padStart(2, '0');
        updateTime();
      }
    });

    minutesInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        updateTime();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const currentMinutes = parseInt(minutesInput.value) || 0;
        minutesInput.value = Math.min(59, currentMinutes + 1)
          .toString()
          .padStart(2, '0');
        updateTime();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const currentMinutes = parseInt(minutesInput.value) || 0;
        minutesInput.value = Math.max(0, currentMinutes - 1)
          .toString()
          .padStart(2, '0');
        updateTime();
      }
    });

    timePickerContainer.appendChild(hoursInput);
    timePickerContainer.appendChild(separator);
    timePickerContainer.appendChild(minutesInput);

    // Add a getValue method for easy access
    timePickerContainer.getValue = () => {
      const hours = validateHours(hoursInput.value);
      const minutes = validateMinutes(minutesInput.value);
      return `${hours}:${minutes}`;
    };

    // Add a setValue method
    timePickerContainer.setValue = (timeString) => {
      const [hours, minutes] = timeString.split(':');
      hoursInput.value = hours.padStart(2, '0');
      minutesInput.value = minutes.padStart(2, '0');
    };

    return timePickerContainer;
  }

  // Custom Label Input Helper Function
  function createLabelInput(initialValue, placeholder = 'Label (optional)', maxLength = 50, onChangeCallback) {
    const labelInputContainer = document.createElement('div');
    labelInputContainer.className = 'custom-label-input';

    const labelInput = document.createElement('input');
    labelInput.type = 'text';
    labelInput.className = 'label-input';
    labelInput.value = initialValue || '';
    labelInput.placeholder = placeholder;
    labelInput.maxLength = maxLength;

    // Store the initial value to compare for changes
    let lastValue = initialValue || '';

    // Only update when user finishes typing (on blur or Enter)
    const handleUpdate = () => {
      const currentValue = labelInput.value.trim();
      // Only call callback if value actually changed
      if (currentValue !== lastValue && onChangeCallback) {
        lastValue = currentValue;
        onChangeCallback(currentValue);
      }
    };

    // Event listeners - NO MORE real-time updates during typing
    labelInput.addEventListener('blur', handleUpdate);

    // Prevent event bubbling to avoid focus issues
    labelInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.stopPropagation(); // Only stop propagation for Enter key
        handleUpdate();
        labelInput.blur(); // Remove focus after Enter
      }
      // Allow other keys (including Ctrl+V for paste) to propagate normally
    });

    labelInput.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    labelInputContainer.appendChild(labelInput);

    // Add getValue method for easy access
    labelInputContainer.getValue = () => {
      return labelInput.value.trim();
    };

    // Add setValue method
    labelInputContainer.setValue = (value) => {
      labelInput.value = value || '';
    };

    // Add focus method
    labelInputContainer.focus = () => {
      labelInput.focus();
    };

    return labelInputContainer;
  }

  // Date-specific timeblock functions
  function updateDateSpecificSchedule() {
    const scheduleContainer = qs('dateSpecificSchedule');
    if (!scheduleContainer) return;

    const dateSpecificBlocks = settings.timeBlocking?.dateSpecificSchedule || {};
    scheduleContainer.innerHTML = '';

    // Sort dates chronologically
    const sortedDates = Object.keys(dateSpecificBlocks).sort();

    sortedDates.forEach((dateKey) => {
      const dateSection = document.createElement('div');
      dateSection.style.cssText = `
				margin-bottom: 8px;
				padding: 6px;
				border: 1px solid #e8eaed;
				border-radius: 6px;
				background: white;
			`;

      const header = document.createElement('div');
      header.style.cssText = `
				display: flex;
				justify-content: space-between;
				align-items: center;
				margin-bottom: 4px;
			`;

      const dateLabel = document.createElement('h4');
      const dateObj = new Date(dateKey + 'T12:00:00'); // Add time to avoid timezone issues
      const formattedDate = dateObj.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
      dateLabel.textContent = formattedDate;
      dateLabel.style.cssText = `
				margin: 0;
				font-size: 13px;
				color: #333;
				font-weight: 600;
			`;

      const removeAllButton = document.createElement('button');
      removeAllButton.textContent = 'Remove All';
      removeAllButton.style.cssText = `
				padding: 4px 8px;
				background: #f44336;
				color: white;
				border: none;
				border-radius: 4px;
				font-size: 10px;
				cursor: pointer;
			`;
      removeAllButton.onclick = () => removeDateBlocks(dateKey);

      header.appendChild(dateLabel);
      header.appendChild(removeAllButton);

      const blocksContainer = document.createElement('div');
      blocksContainer.id = `dateBlocks-${dateKey}`;

      const dayBlocks = dateSpecificBlocks[dateKey] || [];
      dayBlocks.forEach((block, index) => {
        blocksContainer.appendChild(createDateSpecificBlockElement(dateKey, block, index));
      });

      dateSection.appendChild(header);
      dateSection.appendChild(blocksContainer);
      scheduleContainer.appendChild(dateSection);
    });
  }

  function createDateSpecificBlockElement(dateKey, block, index) {
    const blockEl = document.createElement('div');
    blockEl.style.cssText = `
			display: flex;
			gap: 6px;
			align-items: center;
			margin-bottom: 3px;
			padding: 4px;
			background: #f0f8ff;
			border-radius: 3px;
			border-left: 3px solid #34a853;
		`;

    // Date indicator (read-only)
    const dateIndicator = document.createElement('span');
    dateIndicator.textContent = '📅';
    dateIndicator.style.cssText = `
			font-size: 12px;
			margin-right: 4px;
		`;

    // Custom time pickers for start and end time (removed auto-update)
    const startTimePicker = createTimePicker(block.timeRange[0], () => {
      // No automatic update - require manual save
    });

    const endTimePicker = createTimePicker(block.timeRange[1], () => {
      // No automatic update - require manual save
    });

    // Color picker with new UI
    const blockColorId = `date-${dateKey}-${index}`;
    const colorContainer = document.createElement('div');
    colorContainer.className = 'time-block-color-item';
    colorContainer.dataset.blockId = blockColorId;

    const colorPreview = document.createElement('div');
    colorPreview.className = 'time-block-color-preview';
    const previewColor = block.color || settings.timeBlocking?.globalColor || '#FFEB3B';
    colorPreview.style.backgroundColor = previewColor;
    colorPreview.id = `timeBlockPreview-${blockColorId}`;

    // Apply dashed pattern if block style is hashed
    if (block.style === 'hashed') {
      const encodedColor = encodeURIComponent(previewColor);
      const hashedPattern = `url("data:image/svg+xml;charset=utf8,%3Csvg%20width%3D%228%22%20height%3D%228%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M4%200h4L0%208V4l4-4zm4%204v4H4l4-4z%22%20fill%3D%22${encodedColor}%22%2F%3E%3C%2Fsvg%3E")`;
      colorPreview.style.background = hashedPattern;
      colorPreview.style.backgroundColor = 'white';
    }

    const blockStyle = block.style || settings.timeBlocking?.shadingStyle || 'solid';
    const colorDetails = document.createElement('div');
    colorDetails.className = 'time-block-color-details';
    colorDetails.id = `timeBlockDetails-${blockColorId}`;
    colorDetails.innerHTML = `
			<div class="style-selector-row" style="display: flex; gap: 6px; margin-bottom: 8px; padding: 8px; background: #f8f9fa; border-radius: 8px;">
				<button class="style-btn ${blockStyle === 'solid' ? 'active' : ''}" data-style="solid" data-timeblock="${blockColorId}" style="
					flex: 1;
					padding: 6px 10px;
					border: 2px solid ${blockStyle === 'solid' ? '#1a73e8' : '#dadce0'};
					border-radius: 6px;
					font-size: 11px;
					color: ${blockStyle === 'solid' ? '#1a73e8' : '#5f6368'};
					background: ${blockStyle === 'solid' ? '#e8f0fe' : 'white'};
					cursor: pointer;
					font-weight: ${blockStyle === 'solid' ? '600' : '500'};
				">Solid</button>
				<button class="style-btn ${blockStyle === 'hashed' ? 'active' : ''}" data-style="hashed" data-timeblock="${blockColorId}" style="
					flex: 1;
					padding: 6px 10px;
					border: 2px solid ${blockStyle === 'hashed' ? '#1a73e8' : '#dadce0'};
					border-radius: 6px;
					font-size: 11px;
					color: ${blockStyle === 'hashed' ? '#1a73e8' : '#5f6368'};
					background: ${blockStyle === 'hashed' ? '#e8f0fe' : 'white'};
					cursor: pointer;
					font-weight: ${blockStyle === 'hashed' ? '600' : '500'};
				">Dashed</button>
			</div>
			<div class="color-picker-tabs">
				<button class="color-tab active" data-tab="vibrant" data-timeblock="${blockColorId}">Vibrant</button>
				<button class="color-tab" data-tab="pastel" data-timeblock="${blockColorId}">Pastel</button>
				<button class="color-tab" data-tab="dark" data-timeblock="${blockColorId}">Dark</button>
				<button class="color-tab" data-tab="custom" data-timeblock="${blockColorId}">Custom</button>
			</div>
			<div class="color-tab-content">
				<div class="color-picker-container" style="margin-bottom: 8px;">
					<input type="color" id="timeBlockColor-${blockColorId}" value="${block.color || settings.timeBlocking?.globalColor || '#FFEB3B'}" style="width: 60%; height: 28px;">
					<input type="text" id="timeBlockHex-${blockColorId}" value="${(block.color || settings.timeBlocking?.globalColor || '#FFEB3B').toUpperCase()}" placeholder="#FF0000" maxlength="7" class="hex-input-small" style="width: 35%; height: 24px; margin-left: 4px; font-size: 10px; padding: 2px 4px; border: 1px solid #ccc; border-radius: 3px; text-transform: uppercase;">
					<div class="color-picker-icon" data-timeblock="${blockColorId}" title="Click to open/close color picker">🎨</div>
				</div>
				<div class="color-tab-panel active" id="timeblock-${blockColorId}-vibrant-panel">
					<div class="color-palette" id="timeBlockPalette-${blockColorId}"></div>
				</div>
				<div class="color-tab-panel" id="timeblock-${blockColorId}-pastel-panel">
					<div class="color-palette" id="timeBlockPastelPalette-${blockColorId}"></div>
				</div>
				<div class="color-tab-panel" id="timeblock-${blockColorId}-dark-panel">
					<div class="color-palette" id="timeBlockDarkPalette-${blockColorId}"></div>
				</div>
				<div class="color-tab-panel" id="timeblock-${blockColorId}-custom-panel">
					<div class="color-palette" id="timeBlockCustomPalette-${blockColorId}"></div>
				</div>
			</div>
		`;

    colorContainer.appendChild(colorPreview);
    colorContainer.appendChild(colorDetails);

    // Get the actual color input for existing functionality
    const colorInput = colorContainer.querySelector(`#timeBlockColor-${blockColorId}`);
    const hexInput = colorContainer.querySelector(`#timeBlockHex-${blockColorId}`);

    // Sync color picker and hex input
    if (hexInput) {
      // When color picker changes, update hex input
      const syncHexFromColor = () => {
        hexInput.value = colorInput.value.toUpperCase();
      };

      // When hex input changes, update color picker
      const syncColorFromHex = () => {
        const hexValue = hexInput.value.trim();
        // Add # if missing
        const normalizedHex = hexValue.startsWith('#') ? hexValue : '#' + hexValue;
        // Validate hex format
        if (/^#[0-9A-Fa-f]{6}$/.test(normalizedHex)) {
          colorInput.value = normalizedHex;
          hexInput.style.borderColor = '#1a73e8';
          // Removed auto-update call
        } else {
          hexInput.style.borderColor = '#dc2626';
        }
      };

      colorInput.addEventListener('change', syncHexFromColor);
      colorInput.addEventListener('input', syncHexFromColor);
      hexInput.addEventListener('input', syncColorFromHex);
      hexInput.addEventListener('change', syncColorFromHex);
    }

    // Custom label input (removed auto-update)
    const labelInput = createLabelInput(block.label, 'Label (optional)', 50, () => {
      // No automatic update - require manual save
    });

    // Error indicator
    const errorIndicator = document.createElement('div');
    errorIndicator.className = 'cc3-time-error-indicator';
    errorIndicator.style.cssText = `
			display: none;
			width: 20px;
			height: 20px;
			background: rgba(244, 67, 54, 0.2);
			border: 1px solid #f44336;
			color: #f44336;
			border-radius: 50%;
			font-size: 14px;
			font-weight: bold;
			line-height: 18px;
			text-align: center;
			cursor: help;
			margin-left: 4px;
		`;
    errorIndicator.textContent = '!';
    errorIndicator.title = 'End time must be after start time';

    // Save button
    const saveButton = document.createElement('button');
    saveButton.textContent = '✓';
    saveButton.style.cssText = `
			width: 22px;
			height: 22px;
			padding: 0;
			background: linear-gradient(135deg, #4caf50, #45a049);
			color: white;
			border: none;
			border-radius: 4px;
			font-size: 12px;
			font-weight: bold;
			cursor: pointer;
			display: flex;
			align-items: center;
			justify-content: center;
			margin-right: 4px;
			box-shadow: 0 2px 4px rgba(76, 175, 80, 0.3);
			transition: all 0.2s ease;
		`;
    saveButton.title = 'Save changes';

    // Track original values for change detection
    const originalValues = {
      startTime: block.timeRange[0],
      endTime: block.timeRange[1],
      color: block.color || settings.timeBlocking?.globalColor || '#FFEB3B',
      label: block.label || '',
    };

    // Function to disable save button (greyed out)
    const disableSaveButton = () => {
      saveButton.disabled = true;
      saveButton.style.background = 'linear-gradient(135deg, #9e9e9e, #757575)';
      saveButton.style.cursor = 'not-allowed';
      saveButton.style.opacity = '0.5';
      saveButton.title = 'No changes to save';
    };

    // Function to enable save button
    const enableSaveButton = () => {
      saveButton.disabled = false;
      saveButton.style.background = 'linear-gradient(135deg, #4caf50, #45a049)';
      saveButton.style.cursor = 'pointer';
      saveButton.style.opacity = '1';
      saveButton.title = 'Save changes';
    };

    // Function to check if there are changes
    const checkForChanges = () => {
      const hasChanges =
        startTimePicker.getValue() !== originalValues.startTime ||
        endTimePicker.getValue() !== originalValues.endTime ||
        colorInput.value.toUpperCase() !== originalValues.color.toUpperCase() ||
        labelInput.getValue() !== originalValues.label;

      if (hasChanges) {
        enableSaveButton();
      } else {
        disableSaveButton();
      }
    };

    // Initially disable save button (no changes yet)
    disableSaveButton();

    // Add change listeners to all inputs
    startTimePicker.addEventListener('change', checkForChanges);
    endTimePicker.addEventListener('change', checkForChanges);
    colorInput.addEventListener('change', checkForChanges);
    colorInput.addEventListener('input', checkForChanges);
    hexInput.addEventListener('change', checkForChanges);
    hexInput.addEventListener('input', checkForChanges);
    labelInput.addEventListener('input', checkForChanges);

    // Add hover effects (only when enabled)
    saveButton.addEventListener('mouseenter', () => {
      if (!saveButton.disabled) {
        saveButton.style.transform = 'translateY(-1px)';
        saveButton.style.boxShadow = '0 3px 6px rgba(76, 175, 80, 0.4)';
      }
    });
    saveButton.addEventListener('mouseleave', () => {
      if (!saveButton.disabled) {
        saveButton.style.transform = 'translateY(0)';
        saveButton.style.boxShadow = '0 2px 4px rgba(76, 175, 80, 0.3)';
      }
    });

    // Remove button
    const removeButton = document.createElement('button');
    removeButton.textContent = '×';
    removeButton.style.cssText = `
			width: 22px;
			height: 22px;
			padding: 0;
			background: linear-gradient(135deg, #f44336, #d32f2f);
			color: white;
			border: none;
			border-radius: 4px;
			font-size: 14px;
			font-weight: bold;
			cursor: pointer;
			display: flex;
			align-items: center;
			justify-content: center;
			box-shadow: 0 2px 4px rgba(244, 67, 54, 0.3);
			transition: all 0.2s ease;
		`;
    removeButton.title = 'Remove timeblock';

    // Add hover effects
    removeButton.addEventListener('mouseenter', () => {
      removeButton.style.transform = 'translateY(-1px)';
      removeButton.style.boxShadow = '0 3px 6px rgba(244, 67, 54, 0.4)';
    });
    removeButton.addEventListener('mouseleave', () => {
      removeButton.style.transform = 'translateY(0)';
      removeButton.style.boxShadow = '0 2px 4px rgba(244, 67, 54, 0.3)';
    });

    // Event listeners
    const updateBlock = async () => {
      const startTime = startTimePicker.getValue();
      const endTime = endTimePicker.getValue();

      if (startTime && endTime && startTime < endTime) {
        // Valid time range - hide error indicator
        errorIndicator.style.display = 'none';

        // Get current style from buttons
        let currentStyle = block.style || 'solid';
        const activeStyleBtn = colorContainer.querySelector('.style-btn[style*="rgb(26, 115, 232)"]');
        if (activeStyleBtn) {
          currentStyle = activeStyleBtn.dataset.style;
        }

        const newBlock = {
          timeRange: [startTime, endTime],
          color: colorInput.value,
          label: labelInput.getValue(),
          style: currentStyle,
        };
        await window.cc3Storage.updateDateSpecificTimeBlock(dateKey, index, newBlock);
        settings = await window.cc3Storage.getSettings();
        notifyTimeBlockingChange();

        // Update original values and disable save button after successful save
        originalValues.startTime = startTime;
        originalValues.endTime = endTime;
        originalValues.color = colorInput.value;
        originalValues.label = labelInput.getValue();
        disableSaveButton();
      } else {
        // Invalid time range - show error indicator instead of alert
        errorIndicator.style.display = 'block';
      }
    };

    // Save button click handler
    saveButton.onclick = updateBlock;

    // Removed automatic color updating

    removeButton.onclick = async () => {
      await window.cc3Storage.removeDateSpecificTimeBlock(dateKey, index);
      settings = await window.cc3Storage.getSettings();
      updateDateSpecificSchedule();
      notifyTimeBlockingChange();
    };

    blockEl.appendChild(dateIndicator);
    blockEl.appendChild(startTimePicker);
    blockEl.appendChild(document.createTextNode(' - '));
    blockEl.appendChild(endTimePicker);
    blockEl.appendChild(errorIndicator);
    blockEl.appendChild(colorContainer);
    blockEl.appendChild(labelInput);
    blockEl.appendChild(saveButton);
    blockEl.appendChild(removeButton);

    // Create color palettes for this time block after element is created
    requestAnimationFrame(() => {
      createIndividualTimeBlockPalettes(blockColorId);
    });

    return blockEl;
  }

  async function removeDateBlocks(dateKey) {
    if (confirm(`Remove all blocks for ${dateKey}?`)) {
      await window.cc3Storage.clearDateSpecificBlocks(dateKey);
      settings = await window.cc3Storage.getSettings();
      updateDateSpecificSchedule();
      notifyTimeBlockingChange();
    }
  }

  async function removeAllDateSpecificBlocks() {
    // Get current settings to see if there are any date-specific blocks
    const currentSettings = await window.cc3Storage.getSettings();
    const dateSpecificSchedule = currentSettings.timeBlocking?.dateSpecificSchedule || {};

    // Check if there are any blocks to remove
    const dateKeys = Object.keys(dateSpecificSchedule);
    if (dateKeys.length === 0) {
      alert('No date-specific blocks to remove.');
      return;
    }

    // Show confirmation with count of blocks
    const totalBlocks = dateKeys.reduce((sum, dateKey) => sum + (dateSpecificSchedule[dateKey]?.length || 0), 0);
    const confirmMessage = `⚠️ This will remove ALL date-specific blocks from ALL dates.\n\nThis includes:\n• ${totalBlocks} time blocks across ${dateKeys.length} dates\n\nThis action cannot be undone. Are you sure you want to continue?`;

    if (confirm(confirmMessage)) {
      // Clear all date-specific blocks by setting an empty schedule
      await window.cc3Storage.setSettings({
        timeBlocking: {
          ...currentSettings.timeBlocking,
          dateSpecificSchedule: {},
        },
      });

      // Update the UI and notify of changes
      settings = await window.cc3Storage.getSettings();
      updateDateSpecificSchedule();
      notifyTimeBlockingChange();
    }
  }

  async function addDateSpecificBlock() {
    // Create improved date picker modal with time selection
    const modal = createDatePickerModal();
    document.body.appendChild(modal);

    // Focus the modal for keyboard navigation
    modal.focus();

    return new Promise((resolve) => {
      const cleanup = () => {
        if (modal.parentNode) {
          document.body.removeChild(modal);
        }
        resolve(null);
      };

      // Handle date selection with time range
      const handleDateSelect = async (selectedDate, timeRange, isAllDay, label, color, style) => {
        if (selectedDate) {
          const newBlock = {
            timeRange: isAllDay ? ['00:00', '23:59'] : timeRange,
            color: color || settings.timeBlocking?.globalColor || '#FFEB3B',
            label: label || '',
            style: style || settings.timeBlocking?.shadingStyle || 'solid',
          };

          // FREEMIUM: Check premium access before saving date-specific time blocks
          if (window.cc3FeatureAccess && !hasActiveSubscription) {
            const access = await window.cc3FeatureAccess.canAccess('timeBlocking.specificDates');
            if (!access.allowed) {
              // Store pending action for completion after upgrade
              await window.cc3FeatureAccess.storePendingAction({
                type: 'timeBlocking.specificDate',
                data: { dateKey: selectedDate, block: newBlock },
              });
              await window.cc3FeatureAccess.trackPremiumAttempt('timeBlocking.specificDates', 'save');
              // Show upgrade modal
              if (window.cc3PremiumComponents) {
                window.cc3PremiumComponents.showUpgradeModal({
                  feature: 'Date-Specific Time Blocks',
                  description: 'Create one-time time blocks for specific dates - perfect for holidays, deadlines, or schedule exceptions. Upgrade to Pro to unlock this feature.',
                });
              }
              cleanup();
              resolve(null);
              return;
            }
          }

          await window.cc3Storage.addDateSpecificTimeBlock(selectedDate, newBlock);
          settings = await window.cc3Storage.getSettings();
          updateDateSpecificSchedule();
          notifyTimeBlockingChange();
        }
        cleanup();
        resolve(selectedDate);
      };

      // Set up event handlers
      setupDatePickerEvents(modal, handleDateSelect, cleanup);
    });
  }

  function createDatePickerModal() {
    const modal = document.createElement('div');
    modal.className = 'cc3-date-picker-modal';
    modal.tabIndex = -1;
    modal.style.cssText = `
			position: fixed;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			background: rgba(0, 0, 0, 0.4);
			display: flex;
			align-items: center;
			justify-content: center;
			z-index: 10000;
			backdrop-filter: blur(2px);
			opacity: 0;
			transition: opacity 0.2s ease;
		`;

    const picker = document.createElement('div');
    picker.className = 'cc3-date-picker';
    picker.style.cssText = `
			background: white;
			border-radius: 12px;
			box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
			padding: 24px;
			min-width: 320px;
			max-width: 400px;
			max-height: 90vh;
			overflow-y: auto;
			transform: translateY(20px);
			transition: transform 0.2s ease;
		`;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
			display: flex;
			align-items: center;
			justify-content: space-between;
			margin-bottom: 20px;
			padding-bottom: 16px;
			border-bottom: 1px solid #e8eaed;
		`;

    const title = document.createElement('h3');
    title.textContent = 'Select Date for Time Block';
    title.style.cssText = `
			margin: 0;
			font-size: 16px;
			font-weight: 600;
			color: #202124;
		`;

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '×';
    closeBtn.className = 'cc3-close-btn';
    closeBtn.style.cssText = `
			background: none;
			border: none;
			font-size: 24px;
			color: #5f6368;
			cursor: pointer;
			padding: 4px;
			border-radius: 4px;
			width: 32px;
			height: 32px;
			display: flex;
			align-items: center;
			justify-content: center;
			transition: background-color 0.2s ease;
		`;
    closeBtn.onmouseover = () => (closeBtn.style.backgroundColor = '#f1f3f4');
    closeBtn.onmouseout = () => (closeBtn.style.backgroundColor = 'transparent');

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Quick presets
    const presets = document.createElement('div');
    presets.style.cssText = `
			margin-bottom: 20px;
		`;

    const presetsTitle = document.createElement('div');
    presetsTitle.textContent = 'Quick Select:';
    presetsTitle.style.cssText = `
			font-size: 12px;
			font-weight: 600;
			color: #5f6368;
			margin-bottom: 8px;
			text-transform: uppercase;
			letter-spacing: 0.5px;
		`;

    const presetsContainer = document.createElement('div');
    presetsContainer.style.cssText = `
			display: flex;
			gap: 8px;
			flex-wrap: wrap;
		`;

    // Create preset buttons
    const today = new Date();
    const presetOptions = [
      { label: 'Today', date: new Date() },
      { label: 'Tomorrow', date: new Date(today.getTime() + 24 * 60 * 60 * 1000) },
      { label: 'Next Week', date: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000) },
    ];

    presetOptions.forEach((preset) => {
      const btn = document.createElement('button');
      btn.textContent = preset.label;
      btn.className = 'cc3-preset-btn';
      btn.dataset.date = formatDateForInput(preset.date);
      btn.style.cssText = `
				background: #f8f9fa;
				border: 1px solid #dadce0;
				border-radius: 6px;
				padding: 8px 12px;
				font-size: 12px;
				color: #202124;
				cursor: pointer;
				transition: all 0.2s ease;
			`;
      btn.onmouseover = () => {
        btn.style.backgroundColor = '#e8f0fe';
        btn.style.borderColor = '#1a73e8';
        btn.style.color = '#1a73e8';
      };
      btn.onmouseout = () => {
        btn.style.backgroundColor = '#f8f9fa';
        btn.style.borderColor = '#dadce0';
        btn.style.color = '#202124';
      };
      presetsContainer.appendChild(btn);
    });

    presets.appendChild(presetsTitle);
    presets.appendChild(presetsContainer);

    // Custom date picker
    const customSection = document.createElement('div');
    customSection.style.cssText = `
			margin-bottom: 24px;
		`;

    const customTitle = document.createElement('div');
    customTitle.textContent = 'Or choose a specific date:';
    customTitle.style.cssText = `
			font-size: 12px;
			font-weight: 600;
			color: #5f6368;
			margin-bottom: 8px;
			text-transform: uppercase;
			letter-spacing: 0.5px;
		`;

    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.className = 'cc3-date-input';
    dateInput.value = formatDateForInput(today);
    dateInput.style.cssText = `
			width: 100%;
			padding: 12px 16px;
			border: 2px solid #dadce0;
			border-radius: 8px;
			font-size: 14px;
			color: #202124;
			transition: border-color 0.2s ease;
			box-sizing: border-box;
		`;
    dateInput.onfocus = () => (dateInput.style.borderColor = '#1a73e8');
    dateInput.onblur = () => (dateInput.style.borderColor = '#dadce0');

    customSection.appendChild(customTitle);
    customSection.appendChild(dateInput);

    // Time selection section
    const timeSection = document.createElement('div');
    timeSection.style.cssText = `
			margin-bottom: 24px;
		`;

    const timeTitle = document.createElement('div');
    timeTitle.textContent = 'Time:';
    timeTitle.style.cssText = `
			font-size: 12px;
			font-weight: 600;
			color: #5f6368;
			margin-bottom: 8px;
			text-transform: uppercase;
			letter-spacing: 0.5px;
		`;

    // All-day checkbox
    const allDayContainer = document.createElement('div');
    allDayContainer.style.cssText = `
			display: flex;
			align-items: center;
			gap: 8px;
			margin-bottom: 12px;
		`;

    const allDayCheckbox = document.createElement('input');
    allDayCheckbox.type = 'checkbox';
    allDayCheckbox.id = 'cc3-all-day-checkbox';
    allDayCheckbox.className = 'cc3-all-day-checkbox';
    allDayCheckbox.style.cssText = `
			width: 18px;
			height: 18px;
			cursor: pointer;
		`;

    const allDayLabel = document.createElement('label');
    allDayLabel.setAttribute('for', 'cc3-all-day-checkbox');
    allDayLabel.textContent = 'All day';
    allDayLabel.style.cssText = `
			font-size: 14px;
			color: #202124;
			cursor: pointer;
		`;

    allDayContainer.appendChild(allDayCheckbox);
    allDayContainer.appendChild(allDayLabel);

    // Time inputs container
    const timeInputsContainer = document.createElement('div');
    timeInputsContainer.className = 'cc3-time-inputs';
    timeInputsContainer.style.cssText = `
			display: flex;
			gap: 12px;
			align-items: center;
		`;

    // Start time input
    const startTimeContainer = document.createElement('div');
    startTimeContainer.style.cssText = `
			flex: 1;
		`;

    const startTimeLabel = document.createElement('label');
    startTimeLabel.textContent = 'Start';
    startTimeLabel.style.cssText = `
			display: block;
			font-size: 11px;
			color: #5f6368;
			margin-bottom: 4px;
			font-weight: 500;
		`;

    const startTimeInput = document.createElement('input');
    startTimeInput.type = 'time';
    startTimeInput.className = 'cc3-start-time';
    startTimeInput.value = '09:00';
    startTimeInput.style.cssText = `
			width: 100%;
			padding: 10px 12px;
			border: 2px solid #dadce0;
			border-radius: 8px;
			font-size: 14px;
			color: #202124;
			transition: border-color 0.2s ease;
			box-sizing: border-box;
		`;
    startTimeInput.onfocus = () => (startTimeInput.style.borderColor = '#1a73e8');
    startTimeInput.onblur = () => (startTimeInput.style.borderColor = '#dadce0');

    startTimeContainer.appendChild(startTimeLabel);
    startTimeContainer.appendChild(startTimeInput);

    // End time input
    const endTimeContainer = document.createElement('div');
    endTimeContainer.style.cssText = `
			flex: 1;
		`;

    const endTimeLabel = document.createElement('label');
    endTimeLabel.textContent = 'End';
    endTimeLabel.style.cssText = `
			display: block;
			font-size: 11px;
			color: #5f6368;
			margin-bottom: 4px;
			font-weight: 500;
		`;

    const endTimeInput = document.createElement('input');
    endTimeInput.type = 'time';
    endTimeInput.className = 'cc3-end-time';
    endTimeInput.value = '17:00';
    endTimeInput.style.cssText = `
			width: 100%;
			padding: 10px 12px;
			border: 2px solid #dadce0;
			border-radius: 8px;
			font-size: 14px;
			color: #202124;
			transition: border-color 0.2s ease;
			box-sizing: border-box;
		`;
    endTimeInput.onfocus = () => (endTimeInput.style.borderColor = '#1a73e8');
    endTimeInput.onblur = () => (endTimeInput.style.borderColor = '#dadce0');

    endTimeContainer.appendChild(endTimeLabel);
    endTimeContainer.appendChild(endTimeInput);

    timeInputsContainer.appendChild(startTimeContainer);
    timeInputsContainer.appendChild(endTimeContainer);

    timeSection.appendChild(timeTitle);
    timeSection.appendChild(allDayContainer);
    timeSection.appendChild(timeInputsContainer);

    // Handle all-day checkbox toggle
    allDayCheckbox.onchange = () => {
      const isAllDay = allDayCheckbox.checked;
      startTimeInput.disabled = isAllDay;
      endTimeInput.disabled = isAllDay;
      timeInputsContainer.style.opacity = isAllDay ? '0.5' : '1';
      timeInputsContainer.style.pointerEvents = isAllDay ? 'none' : 'auto';
    };

    // Label section
    const labelSection = document.createElement('div');
    labelSection.style.cssText = `
			margin-bottom: 24px;
		`;

    const labelTitle = document.createElement('div');
    labelTitle.textContent = 'Label (optional):';
    labelTitle.style.cssText = `
			font-size: 12px;
			font-weight: 600;
			color: #5f6368;
			margin-bottom: 8px;
			text-transform: uppercase;
			letter-spacing: 0.5px;
		`;

    const labelInput = document.createElement('input');
    labelInput.type = 'text';
    labelInput.className = 'cc3-label-input';
    labelInput.placeholder = 'e.g., Focus Time, Meeting, Break';
    labelInput.style.cssText = `
			width: 100%;
			padding: 12px 16px;
			border: 2px solid #dadce0;
			border-radius: 8px;
			font-size: 14px;
			color: #202124;
			transition: border-color 0.2s ease;
			box-sizing: border-box;
		`;
    labelInput.onfocus = () => (labelInput.style.borderColor = '#1a73e8');
    labelInput.onblur = () => (labelInput.style.borderColor = '#dadce0');

    labelSection.appendChild(labelTitle);
    labelSection.appendChild(labelInput);

    // Style selector section
    const styleSection = document.createElement('div');
    styleSection.style.cssText = `
			margin-bottom: 20px;
		`;

    const styleTitle = document.createElement('div');
    styleTitle.textContent = 'Style:';
    styleTitle.style.cssText = `
			font-size: 12px;
			font-weight: 600;
			color: #5f6368;
			margin-bottom: 8px;
			text-transform: uppercase;
			letter-spacing: 0.5px;
		`;

    const styleButtonsContainer = document.createElement('div');
    styleButtonsContainer.style.cssText = `
			display: flex;
			gap: 8px;
		`;

    const defaultStyle = settings.timeBlocking?.shadingStyle || 'solid';

    const solidBtn = document.createElement('button');
    solidBtn.textContent = 'Solid';
    solidBtn.className = 'cc3-style-btn';
    solidBtn.dataset.style = 'solid';
    solidBtn.style.cssText = `
			flex: 1;
			padding: 10px 16px;
			border: 2px solid ${defaultStyle === 'solid' ? '#1a73e8' : '#dadce0'};
			border-radius: 8px;
			font-size: 13px;
			color: ${defaultStyle === 'solid' ? '#1a73e8' : '#5f6368'};
			background: ${defaultStyle === 'solid' ? '#e8f0fe' : 'white'};
			cursor: pointer;
			font-weight: ${defaultStyle === 'solid' ? '600' : '500'};
			transition: all 0.2s ease;
		`;

    const hashedBtn = document.createElement('button');
    hashedBtn.textContent = 'Dashed';
    hashedBtn.className = 'cc3-style-btn';
    hashedBtn.dataset.style = 'hashed';
    hashedBtn.style.cssText = `
			flex: 1;
			padding: 10px 16px;
			border: 2px solid ${defaultStyle === 'hashed' ? '#1a73e8' : '#dadce0'};
			border-radius: 8px;
			font-size: 13px;
			color: ${defaultStyle === 'hashed' ? '#1a73e8' : '#5f6368'};
			background: ${defaultStyle === 'hashed' ? '#e8f0fe' : 'white'};
			cursor: pointer;
			font-weight: ${defaultStyle === 'hashed' ? '600' : '500'};
			transition: all 0.2s ease;
		`;

    // Style button click handlers
    const updateStyleButtons = (selectedStyle) => {
      [solidBtn, hashedBtn].forEach((btn) => {
        const isSelected = btn.dataset.style === selectedStyle;
        btn.style.borderColor = isSelected ? '#1a73e8' : '#dadce0';
        btn.style.color = isSelected ? '#1a73e8' : '#5f6368';
        btn.style.background = isSelected ? '#e8f0fe' : 'white';
        btn.style.fontWeight = isSelected ? '600' : '500';
      });
    };

    solidBtn.onclick = () => updateStyleButtons('solid');
    hashedBtn.onclick = () => updateStyleButtons('hashed');

    styleButtonsContainer.appendChild(solidBtn);
    styleButtonsContainer.appendChild(hashedBtn);
    styleSection.appendChild(styleTitle);
    styleSection.appendChild(styleButtonsContainer);

    // Color picker section
    const defaultColor = settings.timeBlocking?.globalColor || '#FFEB3B';
    const colorSection = createTimeBlockColorPicker('datespecific', defaultColor);

    // Action buttons
    const actions = document.createElement('div');
    actions.style.cssText = `
			display: flex;
			gap: 12px;
			justify-content: flex-end;
		`;

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = 'cc3-cancel-btn';
    cancelBtn.style.cssText = `
			background: none;
			border: 1px solid #dadce0;
			border-radius: 6px;
			padding: 10px 20px;
			font-size: 14px;
			color: #5f6368;
			cursor: pointer;
			transition: all 0.2s ease;
		`;
    cancelBtn.onmouseover = () => {
      cancelBtn.style.backgroundColor = '#f8f9fa';
      cancelBtn.style.borderColor = '#5f6368';
    };
    cancelBtn.onmouseout = () => {
      cancelBtn.style.backgroundColor = 'transparent';
      cancelBtn.style.borderColor = '#dadce0';
    };

    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = 'Add Time Block';
    confirmBtn.className = 'cc3-confirm-btn';
    confirmBtn.style.cssText = `
			background: #1a73e8;
			border: none;
			border-radius: 6px;
			padding: 10px 20px;
			font-size: 14px;
			color: white;
			cursor: pointer;
			font-weight: 500;
			transition: background-color 0.2s ease;
		`;
    confirmBtn.onmouseover = () => (confirmBtn.style.backgroundColor = '#1557b0');
    confirmBtn.onmouseout = () => (confirmBtn.style.backgroundColor = '#1a73e8');

    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);

    // Assemble the picker
    picker.appendChild(header);
    picker.appendChild(presets);
    picker.appendChild(customSection);
    picker.appendChild(timeSection);
    picker.appendChild(labelSection);
    picker.appendChild(styleSection);
    picker.appendChild(colorSection);
    picker.appendChild(actions);
    modal.appendChild(picker);

    // Trigger entrance animation
    requestAnimationFrame(() => {
      modal.style.opacity = '1';
      picker.style.transform = 'translateY(0)';
    });

    return modal;
  }

  function setupDatePickerEvents(modal, onDateSelect, onCancel) {
    const closeBtn = modal.querySelector('.cc3-close-btn');
    const cancelBtn = modal.querySelector('.cc3-cancel-btn');
    const confirmBtn = modal.querySelector('.cc3-confirm-btn');
    const dateInput = modal.querySelector('.cc3-date-input');
    const presetBtns = modal.querySelectorAll('.cc3-preset-btn');
    const startTimeInput = modal.querySelector('.cc3-start-time');
    const endTimeInput = modal.querySelector('.cc3-end-time');
    const allDayCheckbox = modal.querySelector('.cc3-all-day-checkbox');
    const labelInput = modal.querySelector('.cc3-label-input');
    const colorInput = modal.querySelector('.cc3-color-input');
    const styleButtons = modal.querySelectorAll('.cc3-style-btn');

    // Helper to get time values
    const getTimeValues = () => {
      const isAllDay = allDayCheckbox.checked;
      const timeRange = [startTimeInput.value || '09:00', endTimeInput.value || '17:00'];
      const label = labelInput.value.trim();
      const color = colorInput.value;
      // Get selected style from buttons
      let style = 'solid';
      styleButtons.forEach((btn) => {
        if (btn.style.borderColor === 'rgb(26, 115, 232)') {
          style = btn.dataset.style;
        }
      });
      return { timeRange, isAllDay, label, color, style };
    };

    // Close handlers
    const handleClose = () => onCancel();
    closeBtn.onclick = handleClose;
    cancelBtn.onclick = handleClose;

    // Preset button handlers - just update date input, don't save yet
    presetBtns.forEach((btn) => {
      btn.onclick = () => {
        dateInput.value = btn.dataset.date;
      };
    });

    // Confirm button handler
    confirmBtn.onclick = () => {
      if (dateInput.value) {
        const { timeRange, isAllDay, label, color, style } = getTimeValues();
        onDateSelect(dateInput.value, timeRange, isAllDay, label, color, style);
      }
    };

    // Click outside to close
    modal.onclick = (e) => {
      if (e.target === modal) {
        handleClose();
      }
    };

    // Keyboard navigation
    modal.onkeydown = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      } else if (e.key === 'Enter') {
        if (dateInput.value) {
          const { timeRange, isAllDay, label, color, style } = getTimeValues();
          onDateSelect(dateInput.value, timeRange, isAllDay, label, color, style);
        }
      }
    };

    // Focus the date input initially
    setTimeout(() => dateInput.focus(), 100);
  }

  function formatDateForInput(date) {
    return (
      date.getFullYear() +
      '-' +
      String(date.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(date.getDate()).padStart(2, '0')
    );
  }

  // Create color picker section for time block modals
  function createTimeBlockColorPicker(modalId, defaultColor) {
    const colorSection = document.createElement('div');
    colorSection.style.cssText = `
			margin-bottom: 20px;
		`;

    const colorTitle = document.createElement('div');
    colorTitle.textContent = 'Color:';
    colorTitle.style.cssText = `
			font-size: 12px;
			font-weight: 600;
			color: #5f6368;
			margin-bottom: 6px;
			text-transform: uppercase;
			letter-spacing: 0.5px;
		`;

    // Color preview and inputs container
    const colorInputContainer = document.createElement('div');
    colorInputContainer.style.cssText = `
			display: flex;
			gap: 6px;
			align-items: center;
			margin-bottom: 8px;
		`;

    // Color preview box
    const colorPreview = document.createElement('div');
    colorPreview.className = 'cc3-color-preview';
    colorPreview.style.cssText = `
			width: 28px;
			height: 28px;
			border-radius: 6px;
			background-color: ${defaultColor};
			border: 2px solid #dadce0;
			cursor: pointer;
			transition: all 0.2s ease;
			flex-shrink: 0;
		`;

    // Color input (hidden)
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.className = 'cc3-color-input';
    colorInput.value = defaultColor;
    colorInput.style.cssText = `
			width: 0;
			height: 0;
			opacity: 0;
			position: absolute;
		`;

    // Hex input
    const hexInput = document.createElement('input');
    hexInput.type = 'text';
    hexInput.className = 'cc3-hex-input';
    hexInput.value = defaultColor.toUpperCase();
    hexInput.placeholder = '#000000';
    hexInput.maxLength = 7;
    hexInput.style.cssText = `
			flex: 1;
			padding: 6px 10px;
			border: 2px solid #dadce0;
			border-radius: 6px;
			font-size: 12px;
			color: #202124;
			font-family: 'Courier New', monospace;
			text-transform: uppercase;
			transition: border-color 0.2s ease;
			box-sizing: border-box;
		`;
    hexInput.onfocus = () => (hexInput.style.borderColor = '#1a73e8');
    hexInput.onblur = () => (hexInput.style.borderColor = '#dadce0');

    // Color preview click opens color input
    colorPreview.onclick = () => colorInput.click();

    // Sync color input with preview and hex
    colorInput.oninput = () => {
      const color = colorInput.value;
      colorPreview.style.backgroundColor = color;
      hexInput.value = color.toUpperCase();
    };

    // Sync hex input with preview and color input
    hexInput.oninput = () => {
      const hex = hexInput.value;
      if (/^#[0-9A-F]{6}$/i.test(hex)) {
        colorInput.value = hex;
        colorPreview.style.backgroundColor = hex;
      }
    };

    colorInputContainer.appendChild(colorPreview);
    colorInputContainer.appendChild(colorInput);
    colorInputContainer.appendChild(hexInput);

    // Palette tabs
    const paletteTabs = document.createElement('div');
    paletteTabs.style.cssText = `
			display: flex;
			gap: 6px;
			margin-bottom: 12px;
			margin-top: 8px;
			border-bottom: 1px solid #dadce0;
			padding-bottom: 8px;
		`;

    const tabs = [
      { id: 'vibrant', label: 'Vibrant' },
      { id: 'pastel', label: 'Pastel' },
      { id: 'dark', label: 'Dark' },
      { id: 'custom', label: 'Custom' },
    ];

    tabs.forEach((tab, index) => {
      const tabBtn = document.createElement('button');
      tabBtn.textContent = tab.label;
      tabBtn.className = `cc3-palette-tab ${index === 0 ? 'active' : ''}`;
      tabBtn.dataset.tab = tab.id;
      tabBtn.style.cssText = `
				background: ${index === 0 ? '#e8f0fe' : 'transparent'};
				border: none;
				padding: 5px 10px;
				font-size: 11px;
				color: ${index === 0 ? '#1a73e8' : '#5f6368'};
				cursor: pointer;
				border-radius: 4px;
				font-weight: ${index === 0 ? '600' : '500'};
				transition: all 0.2s ease;
			`;
      tabBtn.onclick = () => {
        // Update tab states
        paletteTabs.querySelectorAll('.cc3-palette-tab').forEach((btn) => {
          btn.style.backgroundColor = 'transparent';
          btn.style.color = '#5f6368';
          btn.style.fontWeight = '500';
          btn.classList.remove('active');
        });
        tabBtn.style.backgroundColor = '#e8f0fe';
        tabBtn.style.color = '#1a73e8';
        tabBtn.style.fontWeight = '600';
        tabBtn.classList.add('active');

        // Update panel visibility
        paletteContainer.querySelectorAll('.cc3-palette-panel').forEach((panel) => {
          panel.style.display = 'none';
        });
        paletteContainer.querySelector(`[data-palette="${tab.id}"]`).style.display = 'grid';
      };
      paletteTabs.appendChild(tabBtn);
    });

    // Palette container
    const paletteContainer = document.createElement('div');
    paletteContainer.className = 'cc3-palette-container';
    paletteContainer.style.cssText = `
			width: 100%;
		`;

    // Create palette panels
    const createPalette = (colors, paletteId) => {
      const panel = document.createElement('div');
      panel.className = 'cc3-palette-panel';
      panel.dataset.palette = paletteId;
      panel.style.cssText = `
				display: ${paletteId === 'vibrant' ? 'grid' : 'none'};
				grid-template-columns: repeat(10, 1fr);
				gap: 10px;
				padding: 8px 0;
			`;

      // Show empty state for custom colors when no colors are set
      if (paletteId === 'custom' && colors.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'custom-colors-empty-state';
        emptyMessage.style.cssText = `
          grid-column: 1 / -1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 8px 12px;
          text-align: center;
          color: #5f6368;
          font-size: 12px;
          line-height: 1.5;
          min-height: 90px;
          width: 100%;
          box-sizing: border-box;
        `;

        const icon = document.createElement('div');
        icon.textContent = '🎨';
        icon.style.cssText = `
          font-size: 28px;
          margin-bottom: 6px;
          opacity: 0.5;
        `;

        const text = document.createElement('div');
        text.style.cssText = `
          width: 100%;
          margin: 0 auto;
        `;
        text.innerHTML = `
          <div style="font-weight: 600; margin-bottom: 6px; color: #202124; font-size: 13px;">No custom colors yet</div>
          <div style="font-size: 11px; color: #5f6368; line-height: 1.5;">
            Set up custom colors in the Color Lab to see them here
          </div>
        `;

        emptyMessage.appendChild(icon);
        emptyMessage.appendChild(text);
        panel.appendChild(emptyMessage);

        return panel;
      }

      colors.forEach((color) => {
        const swatch = document.createElement('div');
        swatch.className = 'cc3-color-swatch';
        swatch.style.cssText = `
					width: 100%;
					height: 0;
					padding-bottom: 100%;
					border-radius: 4px;
					background-color: ${color};
					cursor: pointer;
					border: 2px solid transparent;
					transition: all 0.2s ease;
					position: relative;
				`;
        swatch.onmouseover = () => {
          swatch.style.transform = 'scale(1.15)';
          swatch.style.borderColor = '#1a73e8';
        };
        swatch.onmouseout = () => {
          swatch.style.transform = 'scale(1)';
          swatch.style.borderColor = 'transparent';
        };
        swatch.onclick = () => {
          colorInput.value = color;
          colorPreview.style.backgroundColor = color;
          hexInput.value = color.toUpperCase();
        };
        panel.appendChild(swatch);
      });

      return panel;
    };

    // Add palettes
    paletteContainer.appendChild(createPalette(colorPickerPalette, 'vibrant'));
    paletteContainer.appendChild(createPalette(pastelPalette, 'pastel'));
    paletteContainer.appendChild(createPalette(darkPalette, 'dark'));
    paletteContainer.appendChild(createPalette(customColors, 'custom'));

    // Assemble color section
    colorSection.appendChild(colorTitle);
    colorSection.appendChild(colorInputContainer);
    colorSection.appendChild(paletteTabs);
    colorSection.appendChild(paletteContainer);

    return colorSection;
  }

  // Function to notify content script of time blocking changes
  async function notifyTimeBlockingChange() {
    try {
      const tabs = await chrome.tabs.query({ url: '*://calendar.google.com/*' });
      for (const tab of tabs) {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            type: 'timeBlockingChanged',
            settings: settings.timeBlocking || {},
          });
        } catch (e) {
          // Tab might not be ready or extension not loaded
        }
      }
    } catch (error) {
      console.error('Error notifying time blocking change:', error);
    }
  }

  // Function to notify content script of time blocking color changes (real-time)
  async function notifyTimeBlockingColorChange() {
    try {
      const tabs = await chrome.tabs.query({ url: '*://calendar.google.com/*' });
      for (const tab of tabs) {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            type: 'timeBlockingColorChanged',
            settings: settings.timeBlocking || {},
          });
        } catch (e) {
          // Tab might not be ready or extension not loaded
        }
      }
    } catch (error) {
      console.error('Error notifying time blocking color change:', error);
    }
  }

  // Function to notify calendar tabs when a feature is toggled on/off
  async function notifyFeatureToggle(featureName, featureSettings) {
    try {
      const tabs = await chrome.tabs.query({ url: '*://calendar.google.com/*' });
      for (const tab of tabs) {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            type: 'settingsChanged',
            feature: featureName,
            settings: featureSettings,
          });
        } catch (e) {
          // Tab might not be ready or extension not loaded
        }
      }
    } catch (error) {
      console.error('Error notifying feature toggle:', error);
    }
  }

  // Time block color picker functions
  function createTimeBlockGlobalColorPalette() {
    const palette = qs('globalTimeBlockPalette');
    if (!palette) return;

    palette.innerHTML = '';
    colorPickerPalette.forEach((color) => {
      palette.appendChild(createTimeBlockColorSwatch(color, 'global', palette));
    });
  }

  function createTimeBlockGlobalPastelColorPalette() {
    const palette = qs('globalTimeBlockPastelPalette');
    if (!palette) return;

    palette.innerHTML = '';
    pastelPalette.forEach((color) => {
      palette.appendChild(createTimeBlockColorSwatch(color, 'global', palette));
    });
  }

  function createTimeBlockGlobalDarkColorPalette() {
    const palette = qs('globalTimeBlockDarkPalette');
    if (!palette) return;

    palette.innerHTML = '';
    darkPalette.forEach((color) => {
      palette.appendChild(createTimeBlockColorSwatch(color, 'global', palette));
    });
  }

  function createTimeBlockGlobalCustomColorPalette() {
    const palette = qs('globalTimeBlockCustomPalette');
    if (!palette) return;

    palette.innerHTML = '';

    // Show empty state message if no custom colors
    if (customColors.length === 0) {
      palette.appendChild(createCustomColorsEmptyState());
    } else {
      customColors.forEach((color) => {
        palette.appendChild(createTimeBlockColorSwatch(color, 'global', palette, true));
      });
    }
  }

  // Helper function to create empty state message for custom color palettes
  function createCustomColorsEmptyState() {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'custom-colors-empty-state';
    emptyMessage.style.cssText = `
			grid-column: 1 / -1;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			padding: 8px 12px;
			text-align: center;
			color: #5f6368;
			font-size: 12px;
			line-height: 1.5;
			min-height: 90px;
			width: 100%;
			box-sizing: border-box;
		`;

    const icon = document.createElement('div');
    icon.textContent = '🎨';
    icon.style.cssText = `
			font-size: 28px;
			margin-bottom: 6px;
			opacity: 0.5;
		`;

    const text = document.createElement('div');
    text.style.cssText = `
			width: 100%;
			margin: 0 auto;
		`;
    text.innerHTML = `
			<div style="font-weight: 600; margin-bottom: 6px; color: #202124; font-size: 13px;">No custom colors yet</div>
			<div style="font-size: 11px; color: #5f6368; margin-bottom: 10px; line-height: 1.5;">
				Set up custom colors in the Color Lab to see them here
			</div>
		`;

    const button = document.createElement('button');
    button.textContent = 'Go to Color Lab';
    button.style.cssText = `
			padding: 7px 24px;
			background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
			color: #ffffff;
			border: none;
			border-radius: 5px;
			font-size: 12px;
			font-weight: 600;
			cursor: pointer;
			transition: all 0.2s ease;
			box-shadow: 0 2px 4px rgba(251, 146, 60, 0.3);
		`;

    button.addEventListener('mouseover', () => {
      button.style.transform = 'translateY(-1px)';
      button.style.boxShadow = '0 4px 8px rgba(251, 146, 60, 0.4)';
    });

    button.addEventListener('mouseout', () => {
      button.style.transform = 'translateY(0)';
      button.style.boxShadow = '0 2px 4px rgba(251, 146, 60, 0.3)';
    });

    button.addEventListener('click', () => {
      // Switch to Preferences tab
      const tabButtons = document.querySelectorAll('.tab-button');
      const tabContents = document.querySelectorAll('.tab-content');

      tabButtons.forEach((btn) => btn.classList.remove('active'));
      tabContents.forEach((content) => content.classList.remove('active'));

      const preferencesButton = document.querySelector('[data-tab="preferences"]');
      const preferencesContent = document.getElementById('preferencesContent');

      if (preferencesButton) preferencesButton.classList.add('active');
      if (preferencesContent) preferencesContent.classList.add('active');

      // Expand Color Lab section
      setTimeout(() => {
        const colorLabHeader = document.getElementById('colorLabHeader');
        if (colorLabHeader && !colorLabHeader.classList.contains('expanded')) {
          colorLabHeader.classList.add('expanded');
        }

        // Scroll to Color Lab section
        setTimeout(() => {
          const colorLabSection = document.querySelector('.section.color-lab');
          if (colorLabSection) {
            colorLabSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 100);
      }, 100);
    });

    text.appendChild(button);
    emptyMessage.appendChild(icon);
    emptyMessage.appendChild(text);
    return emptyMessage;
  }

  // Create time block color swatch with click handler
  function createTimeBlockColorSwatch(color, blockId, palette, isCustom = false) {
    const swatch = document.createElement('div');
    swatch.className = isCustom ? 'color-swatch custom-color-swatch' : 'color-swatch';
    swatch.style.backgroundColor = color;
    swatch.title = color;
    swatch.dataset.color = color;
    swatch.dataset.blockId = typeof blockId === 'string' ? blockId : 'individual';

    swatch.onclick = (e) => {
      e.stopPropagation();

      if (blockId === 'global') {
        // Remove selected class from all swatches in global palettes
        document
          .querySelectorAll('#globalTimeBlockDetails .color-swatch')
          .forEach((s) => s.classList.remove('selected'));
        // Add selected class to clicked swatch
        swatch.classList.add('selected');

        // Update global color
        const colorInput = qs('timeBlockGlobalColor');
        const preview = qs('globalTimeBlockPreview');
        if (colorInput && preview) {
          colorInput.value = color;
          preview.style.backgroundColor = color;
          // Save the change
          saveTimeBlockGlobalColorChange(color);
        }
      } else if (typeof blockId === 'object' && blockId.colorInput && blockId.preview) {
        // Individual time block - blockId is an object with colorInput and preview
        const detailsId = blockId.colorInput.id.replace('timeBlockColor-', 'timeBlockDetails-');
        document.querySelectorAll(`#${detailsId} .color-swatch`).forEach((s) => s.classList.remove('selected'));
        swatch.classList.add('selected');

        // Update individual time block color
        blockId.colorInput.value = color;

        // FIX: Get current style from block data by parsing the blockColorId from element ID
        // Element IDs are like "timeBlockColor-mon-0" or "timeBlockColor-date-2025-11-20-0"
        const blockColorId = blockId.colorInput.id.replace('timeBlockColor-', '');
        let currentStyle = 'solid'; // default

        // Parse blockColorId to get the actual block from settings
        if (blockColorId.startsWith('date-')) {
          // Date-specific block: "date-YYYY-MM-DD-index"
          const parts = blockColorId.split('-');
          const dateKey = `${parts[1]}-${parts[2]}-${parts[3]}`; // "YYYY-MM-DD"
          const index = parseInt(parts[4]);
          const dateBlocks = settings.timeBlocking?.dateSpecificSchedule?.[dateKey] || [];
          if (dateBlocks[index]) {
            currentStyle = dateBlocks[index].style || settings.timeBlocking?.shadingStyle || 'solid';
          }
        } else {
          // Weekly block: "dayKey-index" like "mon-0"
          const parts = blockColorId.split('-');
          const dayKey = parts[0];
          const index = parseInt(parts[1]);
          const dayBlocks = settings.timeBlocking?.weeklySchedule?.[dayKey] || [];
          if (dayBlocks[index]) {
            currentStyle = dayBlocks[index].style || settings.timeBlocking?.shadingStyle || 'solid';
          }
        }

        // Apply styling based on current style
        if (currentStyle === 'hashed') {
          // Apply dashed pattern with new color
          const encodedColor = encodeURIComponent(color);
          const hashedPattern = `url("data:image/svg+xml;charset=utf8,%3Csvg%20width%3D%228%22%20height%3D%228%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M4%200h4L0%208V4l4-4zm4%204v4H4l4-4z%22%20fill%3D%22${encodedColor}%22%2F%3E%3C%2Fsvg%3E")`;
          blockId.preview.style.background = hashedPattern;
          blockId.preview.style.backgroundColor = 'white';
        } else {
          // Apply solid color
          blockId.preview.style.background = '';
          blockId.preview.style.backgroundColor = color;
        }

        // Trigger the existing save functionality
        blockId.colorInput.dispatchEvent(new Event('change'));
      }
    };

    return swatch;
  }

  // Save time block global color change
  async function saveTimeBlockGlobalColorChange(color) {
    try {
      await window.cc3Storage.setTimeBlockingGlobalColor(color);
      settings = await window.cc3Storage.getSettings();
      updateTimeBlockingSchedule(); // Refresh to show new default color
      notifyTimeBlockingColorChange();
    } catch (error) {
      console.error('Error saving time block global color:', error);
    }
  }

  // Handle time block color tab switching
  function switchTimeBlockColorTab(blockId, tabName) {
    // Update tab buttons
    const tabs = document.querySelectorAll(`[data-timeblock="${blockId}"][data-tab]`);
    tabs.forEach((tab) => {
      tab.classList.remove('active');
      if (tab.dataset.tab === tabName) {
        tab.classList.add('active');
      }
    });

    // Update tab panels
    const panelPrefix = blockId === 'global' ? 'global' : `timeblock-${blockId}`;
    const panels = [
      `${panelPrefix}-vibrant-panel`,
      `${panelPrefix}-pastel-panel`,
      `${panelPrefix}-dark-panel`,
      `${panelPrefix}-custom-panel`,
    ];
    panels.forEach((panelId) => {
      const panel = qs(panelId);
      if (panel) {
        panel.classList.remove('active');
        if (panelId === `${panelPrefix}-${tabName}-panel`) {
          panel.classList.add('active');
        }
      }
    });
  }


  // Create individual time block color palettes
  function createIndividualTimeBlockPalettes(blockColorId) {
    // Get references to elements
    const colorInput = qs(`timeBlockColor-${blockColorId}`);
    const preview = qs(`timeBlockPreview-${blockColorId}`);

    if (!colorInput || !preview) {
      // Retry after a short delay if elements aren't ready yet
      setTimeout(() => createIndividualTimeBlockPalettes(blockColorId), 50);
      return;
    }

    const blockRef = { colorInput, preview };

    // Set up style button handlers
    const colorDetails = qs(`timeBlockDetails-${blockColorId}`);
    if (colorDetails) {
      const styleButtons = colorDetails.querySelectorAll('.style-btn');
      styleButtons.forEach((btn) => {
        btn.onclick = async () => {
          const newStyle = btn.dataset.style;

          // Update button visual state
          styleButtons.forEach((b) => {
            const isSelected = b.dataset.style === newStyle;
            b.style.borderColor = isSelected ? '#1a73e8' : '#dadce0';
            b.style.color = isSelected ? '#1a73e8' : '#5f6368';
            b.style.background = isSelected ? '#e8f0fe' : 'white';
            b.style.fontWeight = isSelected ? '600' : '500';
          });

          // Update preview swatch
          const currentColor = colorInput.value;
          if (newStyle === 'hashed') {
            const encodedColor = encodeURIComponent(currentColor);
            const hashedPattern = `url("data:image/svg+xml;charset=utf8,%3Csvg%20width%3D%228%22%20height%3D%228%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M4%200h4L0%208V4l4-4zm4%204v4H4l4-4z%22%20fill%3D%22${encodedColor}%22%2F%3E%3C%2Fsvg%3E")`;
            preview.style.background = hashedPattern;
            preview.style.backgroundColor = 'white';
          } else {
            preview.style.background = '';
            preview.style.backgroundColor = currentColor;
          }

          // Update storage - parse blockColorId to get dayKey/dateKey and index
          // Format: "dayKey-index" for weekly or "date-dateKey-index" for date-specific
          if (blockColorId.startsWith('date-')) {
            // Date-specific block
            const parts = blockColorId.split('-');
            const dateKey = `${parts[1]}-${parts[2]}-${parts[3]}`;
            const index = parseInt(parts[4]);

            const currentSettings = await window.cc3Storage.getSettings();
            const dateBlocks = currentSettings.timeBlocking?.dateSpecificSchedule?.[dateKey] || [];
            if (dateBlocks[index]) {
              const updatedBlock = { ...dateBlocks[index], style: newStyle };
              await window.cc3Storage.updateDateSpecificTimeBlock(dateKey, index, updatedBlock);
            }
          } else {
            // Weekly block
            const parts = blockColorId.split('-');
            const dayKey = parts[0];
            const index = parseInt(parts[1]);

            const currentSettings = await window.cc3Storage.getSettings();
            const dayBlocks = currentSettings.timeBlocking?.weeklySchedule?.[dayKey] || [];
            if (dayBlocks[index]) {
              const updatedBlock = { ...dayBlocks[index], style: newStyle };
              await window.cc3Storage.updateTimeBlock(dayKey, index, updatedBlock);
            }
          }

          // Refresh settings and notify calendar
          settings = await window.cc3Storage.getSettings();
          notifyTimeBlockingChange();
        };
      });
    }

    // Vibrant palette
    const vibrantPalette = qs(`timeBlockPalette-${blockColorId}`);
    if (vibrantPalette) {
      vibrantPalette.innerHTML = '';
      colorPickerPalette.forEach((color) => {
        vibrantPalette.appendChild(createTimeBlockColorSwatch(color, blockRef, vibrantPalette));
      });
    }

    // Pastel palette
    const pastelPaletteEl = qs(`timeBlockPastelPalette-${blockColorId}`);
    if (pastelPaletteEl) {
      pastelPaletteEl.innerHTML = '';
      pastelPalette.forEach((color) => {
        pastelPaletteEl.appendChild(createTimeBlockColorSwatch(color, blockRef, pastelPaletteEl));
      });
    }

    // Dark palette
    const darkPaletteEl = qs(`timeBlockDarkPalette-${blockColorId}`);
    if (darkPaletteEl) {
      darkPaletteEl.innerHTML = '';
      darkPalette.forEach((color) => {
        darkPaletteEl.appendChild(createTimeBlockColorSwatch(color, blockRef, darkPaletteEl));
      });
    }

    // Custom palette
    const customPalette = qs(`timeBlockCustomPalette-${blockColorId}`);
    if (customPalette) {
      customPalette.innerHTML = '';
      if (customColors.length === 0) {
        customPalette.appendChild(createCustomColorsEmptyState());
      } else {
        customColors.forEach((color) => {
          customPalette.appendChild(createTimeBlockColorSwatch(color, blockRef, customPalette, true));
        });
      }
    }
  }

  // Handle tab switching
  function switchColorTab(dayIndex, tabName) {
    // Update tab buttons
    const tabs = document.querySelectorAll(`[data-day="${dayIndex}"][data-tab]`);
    tabs.forEach((tab) => {
      tab.classList.remove('active');
      if (tab.dataset.tab === tabName) {
        tab.classList.add('active');
      }
    });

    // Update tab panels
    const panels = [
      `vibrant-panel-${dayIndex}`,
      `pastel-panel-${dayIndex}`,
      `dark-panel-${dayIndex}`,
      `custom-panel-${dayIndex}`,
    ];
    panels.forEach((panelId) => {
      const panel = qs(panelId);
      if (panel) {
        panel.classList.remove('active');
        if (panelId === `${tabName}-panel-${dayIndex}`) {
          panel.classList.add('active');
        }
      }
    });
  }

  // Create color swatch with click handler
  function createColorSwatch(color, dayIndex, palette, isCustom = false) {
    const swatch = document.createElement('div');
    swatch.className = isCustom ? 'color-swatch custom-color-swatch' : 'color-swatch';
    swatch.style.backgroundColor = color;
    swatch.title = color;

    swatch.onclick = async () => {
      // Remove selected class from all swatches in this day's palettes
      document.querySelectorAll(`#details${dayIndex} .color-swatch`).forEach((s) => s.classList.remove('selected'));
      // Add selected class to clicked swatch
      swatch.classList.add('selected');
      // Update the color input
      const colorInput = qs(`color${dayIndex}`);
      const hexInput = qs(`hex${dayIndex}`);
      if (colorInput) {
        colorInput.value = color;

        // Reset opacity to 100% when selecting a new color
        const opacityInput = qs(`opacity${dayIndex}`);
        if (opacityInput) {
          opacityInput.value = 100;
          updateOpacityDisplay(dayIndex, 100);
          updateSliderFill(dayIndex, 100);
          updateOpacityPresetButtons(dayIndex, 100);
        }

        // Save color first, then opacity - avoid race condition by not using dispatchEvent
        settings = await window.cc3Storage.setWeekdayColor(dayIndex, color);
        settings = await window.cc3Storage.setWeekdayOpacity(dayIndex, 100);

        // Update hex input
        if (hexInput) {
          hexInput.value = color.toUpperCase();
        }

        // Update preview with 100% opacity
        updatePreview(dayIndex, color, 100);

        // Update clear button state
        updateClearButtonState(dayIndex, color);

        // Update "Clear All" button state (async to read fresh storage)
        if (window.updateClearAllButtonState) {
          await window.updateClearAllButtonState();
        }

        await saveSettings();
      }
    };

    return swatch;
  }

  // Create vibrant color palette
  function createColorPalette(dayIndex) {
    const palette = qs(`palette${dayIndex}`);
    if (!palette) return;

    palette.innerHTML = '';

    // Add main color picker palette
    colorPickerPalette.forEach((color) => {
      palette.appendChild(createColorSwatch(color, dayIndex, palette));
    });
  }

  // Create pastel color palette
  function createPastelColorPalette(dayIndex) {
    const palette = qs(`pastel-palette${dayIndex}`);
    if (!palette) return;

    palette.innerHTML = '';
    pastelPalette.forEach((color) => {
      palette.appendChild(createColorSwatch(color, dayIndex, palette));
    });
  }

  // Create dark color palette
  function createDarkColorPalette(dayIndex) {
    const palette = qs(`dark-palette${dayIndex}`);
    if (!palette) return;

    palette.innerHTML = '';
    darkPalette.forEach((color) => {
      palette.appendChild(createColorSwatch(color, dayIndex, palette));
    });
  }

  // Create custom color palette
  function createCustomColorPalette(dayIndex) {
    const palette = qs(`custom-palette${dayIndex}`);
    if (!palette) return;

    palette.innerHTML = '';

    // Show empty state message if no custom colors
    if (customColors.length === 0) {
      palette.appendChild(createCustomColorsEmptyState());
    } else {
      customColors.forEach((color) => {
        palette.appendChild(createColorSwatch(color, dayIndex, palette, true));
      });
    }
  }

  function updateColors() {
    for (let i = 0; i < 7; i++) {
      const colorInput = qs(`color${i}`);
      const hexInput = qs(`hex${i}`);
      const opacityInput = qs(`opacity${i}`);
      const opacityValue = qs(`opacityValue${i}`);
      const preview = qs(`preview${i}`);

      const color = settings.weekdayColors[String(i)] || defaultColors[String(i)];

      if (colorInput) {
        colorInput.value = color;
      }

      if (hexInput) {
        hexInput.value = color.toUpperCase();
      }

      if (preview) {
        const opacity = settings.weekdayOpacity?.[String(i)] || defaultOpacity[String(i)];
        updatePreview(i, color, opacity);
      }

      if (opacityInput) {
        const opacity = settings.weekdayOpacity?.[String(i)] || defaultOpacity[String(i)];
        opacityInput.value = opacity;
        if (opacityValue) {
          opacityValue.textContent = opacity + '%';
        }
      }

      // Create all color palettes for each day
      createColorPalette(i);
      createPastelColorPalette(i);
      createDarkColorPalette(i);
      createCustomColorPalette(i);
    }

    // Update week start setting
    const weekStartSelect = qs('weekStart');
    if (weekStartSelect && settings.weekStart !== undefined) {
      weekStartSelect.value = String(settings.weekStart);
    }

    // Reorganize day color row based on week start
    reorganizeWeekdaysDisplay();

    // Render date-specific colors
    renderDateColors();
  }

  // Render the date-specific colors list
  function renderDateColors() {
    const listContainer = qs('dateColorsList');
    const countBadge = qs('dateColorsCount');
    if (!listContainer) return;

    const dateColors = settings.dateColors || {};
    const dateColorLabels = settings.dateColorLabels || {};
    const dateOpacity = settings.dateOpacity || {};
    const entries = Object.entries(dateColors).sort(([a], [b]) => a.localeCompare(b));

    // Update count badge
    if (countBadge) {
      countBadge.textContent = entries.length;
    }

    // Clear existing list
    listContainer.innerHTML = '';

    if (entries.length === 0) {
      listContainer.innerHTML = `
        <div style="text-align: center; padding: 12px; color: #80868b; font-size: 11px;">
          No specific dates set. Click "Add Date Color" to add date overrides.
        </div>
      `;
      return;
    }

    // Helper to convert hex to rgba
    const hexToRgba = (hex, alpha) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      if (!result) return hex;
      const r = parseInt(result[1], 16);
      const g = parseInt(result[2], 16);
      const b = parseInt(result[3], 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    // Render each date color
    entries.forEach(([dateKey, color]) => {
      const label = dateColorLabels[dateKey] || '';
      const opacity = dateOpacity[dateKey] !== undefined ? dateOpacity[dateKey] : 30;
      const previewColor = hexToRgba(color, opacity / 100);

      const item = document.createElement('div');
      item.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        background: white;
        border: 1px solid #e8eaed;
        border-radius: 6px;
        margin-bottom: 6px;
        transition: all 0.2s ease;
      `;

      // Format the date for display
      const date = new Date(dateKey + 'T12:00:00');
      const formattedDate = date.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });

      // Build label HTML if present
      const labelHtml = label ? `
        <div style="
          font-size: 10px;
          color: #8b5cf6;
          background: #f3e8ff;
          padding: 2px 6px;
          border-radius: 4px;
          white-space: nowrap;
          max-width: 80px;
          overflow: hidden;
          text-overflow: ellipsis;
        " title="${label}">${label}</div>
      ` : '';

      item.innerHTML = `
        <div style="
          width: 24px;
          height: 24px;
          border-radius: 6px;
          background: ${previewColor};
          border: 2px solid ${color};
          flex-shrink: 0;
        " title="${color} at ${opacity}% opacity"></div>
        <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px;">
          <div style="font-size: 11px; font-weight: 500; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${formattedDate}
          </div>
          ${labelHtml}
        </div>
        <button
          class="remove-date-color-btn"
          data-date="${dateKey}"
          style="
            background: none;
            border: none;
            color: #dc3545;
            cursor: pointer;
            font-size: 16px;
            padding: 4px 8px;
            border-radius: 4px;
            line-height: 1;
            transition: background-color 0.2s ease;
          "
          title="Remove this date color"
        >×</button>
      `;

      // Add hover effects
      item.addEventListener('mouseenter', () => {
        item.style.borderColor = '#8b5cf6';
        item.style.boxShadow = '0 2px 4px rgba(139, 92, 246, 0.1)';
      });
      item.addEventListener('mouseleave', () => {
        item.style.borderColor = '#e8eaed';
        item.style.boxShadow = 'none';
      });

      listContainer.appendChild(item);
    });

    // Add event listeners for remove buttons
    listContainer.querySelectorAll('.remove-date-color-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const dateKey = e.target.getAttribute('data-date');
        if (dateKey) {
          settings = await window.cc3Storage.clearDateColor(dateKey);
          // Also clear the opacity and label for this date
          settings = await window.cc3Storage.setDateOpacity(dateKey, null);
          settings = await window.cc3Storage.setDateColorLabel(dateKey, null);
          renderDateColors();
          saveSettings(); // Notify content script to update colors immediately
        }
      });

      // Hover effect for remove button
      btn.addEventListener('mouseenter', () => {
        btn.style.backgroundColor = '#fee2e2';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.backgroundColor = 'transparent';
      });
    });
  }

  // Show a confirmation dialog for overriding existing date colors
  function showConfirmDialog(title, message, oldColor, newColor) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
        backdrop-filter: blur(2px);
      `;

      const dialog = document.createElement('div');
      dialog.style.cssText = `
        background: white;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        padding: 24px;
        max-width: 340px;
        text-align: center;
      `;

      // Color comparison preview
      const colorPreview = document.createElement('div');
      colorPreview.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        margin-bottom: 16px;
      `;
      colorPreview.innerHTML = `
        <div style="text-align: center;">
          <div style="width: 40px; height: 40px; border-radius: 8px; background: ${oldColor}; border: 2px solid #e5e7eb; margin: 0 auto;"></div>
          <div style="font-size: 10px; color: #6b7280; margin-top: 4px;">Current</div>
        </div>
        <div style="color: #9ca3af; font-size: 18px;">→</div>
        <div style="text-align: center;">
          <div style="width: 40px; height: 40px; border-radius: 8px; background: ${newColor}; border: 2px solid #8b5cf6; margin: 0 auto;"></div>
          <div style="font-size: 10px; color: #8b5cf6; margin-top: 4px;">New</div>
        </div>
      `;

      const titleEl = document.createElement('div');
      titleEl.textContent = title;
      titleEl.style.cssText = `
        font-size: 16px;
        font-weight: 600;
        color: #1f2937;
        margin-bottom: 12px;
      `;

      const messageEl = document.createElement('div');
      messageEl.textContent = message;
      messageEl.style.cssText = `
        font-size: 13px;
        color: #6b7280;
        line-height: 1.5;
        margin-bottom: 20px;
        white-space: pre-line;
      `;

      const buttonContainer = document.createElement('div');
      buttonContainer.style.cssText = `
        display: flex;
        gap: 12px;
        justify-content: center;
      `;

      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'Cancel';
      cancelBtn.style.cssText = `
        padding: 10px 24px;
        border-radius: 8px;
        border: 1px solid #e5e7eb;
        background: white;
        color: #374151;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
      `;
      cancelBtn.onmouseover = () => {
        cancelBtn.style.background = '#f9fafb';
        cancelBtn.style.borderColor = '#d1d5db';
      };
      cancelBtn.onmouseout = () => {
        cancelBtn.style.background = 'white';
        cancelBtn.style.borderColor = '#e5e7eb';
      };

      const confirmBtn = document.createElement('button');
      confirmBtn.textContent = 'Override';
      confirmBtn.style.cssText = `
        padding: 10px 24px;
        border-radius: 8px;
        border: none;
        background: linear-gradient(135deg, #8b5cf6, #7c3aed);
        color: white;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
      `;
      confirmBtn.onmouseover = () => {
        confirmBtn.style.transform = 'translateY(-1px)';
        confirmBtn.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.4)';
      };
      confirmBtn.onmouseout = () => {
        confirmBtn.style.transform = 'translateY(0)';
        confirmBtn.style.boxShadow = 'none';
      };

      buttonContainer.appendChild(cancelBtn);
      buttonContainer.appendChild(confirmBtn);

      dialog.appendChild(colorPreview);
      dialog.appendChild(titleEl);
      dialog.appendChild(messageEl);
      dialog.appendChild(buttonContainer);
      overlay.appendChild(dialog);
      document.body.appendChild(overlay);

      const cleanup = (result) => {
        if (overlay.parentNode) {
          document.body.removeChild(overlay);
        }
        resolve(result);
      };

      cancelBtn.onclick = () => cleanup(false);
      confirmBtn.onclick = () => cleanup(true);
      overlay.onclick = (e) => {
        if (e.target === overlay) cleanup(false);
      };

      // Focus the confirm button for keyboard navigation
      confirmBtn.focus();
    });
  }

  // Open the date color modal
  function openDateColorModal() {
    const modal = createDateColorModal();
    document.body.appendChild(modal);
    modal.focus();

    return new Promise((resolve) => {
      const cleanup = () => {
        if (modal.parentNode) {
          document.body.removeChild(modal);
        }
        resolve(null);
      };

      const handleSave = async (dateKey, color, opacity, label) => {
        if (dateKey && color) {
          // FREEMIUM: Check premium access before saving date-specific colors
          if (window.cc3FeatureAccess && !hasActiveSubscription) {
            const access = await window.cc3FeatureAccess.canAccess('dayColoring.specificDates');
            if (!access.allowed) {
              // Store pending action for completion after upgrade
              await window.cc3FeatureAccess.storePendingAction({
                type: 'dayColoring.specificDate',
                data: { dateKey, color, opacity, label },
              });
              await window.cc3FeatureAccess.trackPremiumAttempt('dayColoring.specificDates', 'save');
              // Show upgrade modal
              if (window.cc3PremiumComponents) {
                window.cc3PremiumComponents.showUpgradeModal({
                  feature: 'Date-Specific Colors',
                  description: 'Color specific dates like holidays, deadlines, or important events. Upgrade to Pro to unlock this feature.',
                });
              }
              cleanup();
              resolve(null);
              return;
            }
          }

          settings = await window.cc3Storage.setDateColor(dateKey, color);
          settings = await window.cc3Storage.setDateOpacity(dateKey, opacity);
          // Always clear old label first, then set new one if provided
          // This prevents old labels from persisting when overriding a date color
          await window.cc3Storage.setDateColorLabel(dateKey, null);
          if (label) {
            settings = await window.cc3Storage.setDateColorLabel(dateKey, label);
          }
          renderDateColors();
          saveSettings();
        }
        cleanup();
        resolve({ dateKey, color, opacity, label });
      };

      setupDateColorModalEvents(modal, handleSave, cleanup);
    });
  }

  // Create the date color modal
  function createDateColorModal() {
    const modal = document.createElement('div');
    modal.className = 'cc3-date-color-modal';
    modal.tabIndex = -1;
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      backdrop-filter: blur(2px);
      opacity: 0;
      transition: opacity 0.2s ease;
    `;

    const picker = document.createElement('div');
    picker.className = 'cc3-date-color-picker';
    picker.style.cssText = `
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      padding: 24px;
      min-width: 340px;
      max-width: 400px;
      max-height: 90vh;
      overflow-y: auto;
      transform: translateY(20px);
      transition: transform 0.2s ease;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 1px solid #e8eaed;
    `;

    const title = document.createElement('h3');
    title.textContent = 'Add Date Color';
    title.style.cssText = `
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #202124;
    `;

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '×';
    closeBtn.className = 'cc3-close-btn';
    closeBtn.style.cssText = `
      background: none;
      border: none;
      font-size: 24px;
      color: #5f6368;
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background-color 0.2s ease;
    `;
    closeBtn.onmouseover = () => (closeBtn.style.backgroundColor = '#f1f3f4');
    closeBtn.onmouseout = () => (closeBtn.style.backgroundColor = 'transparent');

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Quick date presets
    const presets = document.createElement('div');
    presets.style.cssText = `margin-bottom: 20px;`;

    const presetsTitle = document.createElement('div');
    presetsTitle.textContent = 'Quick Select:';
    presetsTitle.style.cssText = `
      font-size: 12px;
      font-weight: 600;
      color: #5f6368;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    `;

    const presetsContainer = document.createElement('div');
    presetsContainer.style.cssText = `display: flex; gap: 8px; flex-wrap: wrap;`;

    const today = new Date();
    const presetOptions = [
      { label: 'Today', date: new Date() },
      { label: 'Tomorrow', date: new Date(today.getTime() + 24 * 60 * 60 * 1000) },
      { label: 'Next Week', date: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000) },
    ];

    presetOptions.forEach((preset) => {
      const btn = document.createElement('button');
      btn.textContent = preset.label;
      btn.className = 'cc3-preset-btn';
      btn.dataset.date = formatDateForInput(preset.date);
      btn.style.cssText = `
        background: #f8f9fa;
        border: 1px solid #dadce0;
        border-radius: 6px;
        padding: 8px 12px;
        font-size: 12px;
        color: #202124;
        cursor: pointer;
        transition: all 0.2s ease;
      `;
      btn.onmouseover = () => {
        btn.style.backgroundColor = '#e8f0fe';
        btn.style.borderColor = '#8b5cf6';
        btn.style.color = '#8b5cf6';
      };
      btn.onmouseout = () => {
        btn.style.backgroundColor = '#f8f9fa';
        btn.style.borderColor = '#dadce0';
        btn.style.color = '#202124';
      };
      presetsContainer.appendChild(btn);
    });

    presets.appendChild(presetsTitle);
    presets.appendChild(presetsContainer);

    // Date input section
    const dateSection = document.createElement('div');
    dateSection.style.cssText = `margin-bottom: 20px;`;

    const dateTitle = document.createElement('div');
    dateTitle.textContent = 'Or choose a specific date:';
    dateTitle.style.cssText = `
      font-size: 12px;
      font-weight: 600;
      color: #5f6368;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    `;

    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.className = 'cc3-date-input';
    dateInput.value = formatDateForInput(today);
    dateInput.style.cssText = `
      width: 100%;
      padding: 12px 16px;
      border: 2px solid #dadce0;
      border-radius: 8px;
      font-size: 14px;
      color: #202124;
      transition: border-color 0.2s ease;
      box-sizing: border-box;
    `;
    dateInput.onfocus = () => (dateInput.style.borderColor = '#8b5cf6');
    dateInput.onblur = () => (dateInput.style.borderColor = '#dadce0');

    dateSection.appendChild(dateTitle);
    dateSection.appendChild(dateInput);

    // Label section
    const labelSection = document.createElement('div');
    labelSection.style.cssText = `margin-bottom: 20px;`;

    const labelTitle = document.createElement('div');
    labelTitle.textContent = 'Label (optional):';
    labelTitle.style.cssText = `
      font-size: 12px;
      font-weight: 600;
      color: #5f6368;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    `;

    const labelInput = document.createElement('input');
    labelInput.type = 'text';
    labelInput.className = 'cc3-label-input';
    labelInput.placeholder = 'e.g., Holiday, Birthday, Deadline';
    labelInput.style.cssText = `
      width: 100%;
      padding: 12px 16px;
      border: 2px solid #dadce0;
      border-radius: 8px;
      font-size: 14px;
      color: #202124;
      transition: border-color 0.2s ease;
      box-sizing: border-box;
    `;
    labelInput.onfocus = () => (labelInput.style.borderColor = '#8b5cf6');
    labelInput.onblur = () => (labelInput.style.borderColor = '#dadce0');

    labelSection.appendChild(labelTitle);
    labelSection.appendChild(labelInput);

    // Color section
    const colorSection = document.createElement('div');
    colorSection.style.cssText = `margin-bottom: 20px;`;

    const colorTitle = document.createElement('div');
    colorTitle.textContent = 'Color:';
    colorTitle.style.cssText = `
      font-size: 12px;
      font-weight: 600;
      color: #5f6368;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
    `;

    // Color picker tabs
    const colorTabs = document.createElement('div');
    colorTabs.style.cssText = `display: flex; gap: 4px; margin-bottom: 12px;`;

    const tabNames = ['Vibrant', 'Pastel', 'Dark', 'Custom'];
    tabNames.forEach((name, index) => {
      const tab = document.createElement('button');
      tab.textContent = name;
      tab.className = 'cc3-color-tab';
      tab.dataset.tab = name.toLowerCase();
      tab.style.cssText = `
        flex: 1;
        padding: 8px;
        font-size: 11px;
        border: none;
        border-radius: 6px;
        background: ${index === 0 ? '#8b5cf6' : '#f1f3f4'};
        color: ${index === 0 ? 'white' : '#333'};
        cursor: pointer;
        transition: all 0.2s ease;
        font-weight: 500;
      `;
      colorTabs.appendChild(tab);
    });

    // Color picker row (preview + hex input)
    const colorInputRow = document.createElement('div');
    colorInputRow.style.cssText = `display: flex; gap: 8px; margin-bottom: 12px; align-items: center;`;

    // Color preview wrapper - shows color with opacity applied
    const nativeColorWrapper = document.createElement('div');
    nativeColorWrapper.className = 'cc3-color-preview-wrapper';
    nativeColorWrapper.style.cssText = `
      position: relative;
      width: 50%;
      height: 36px;
      border-radius: 6px;
      overflow: hidden;
      border: 2px solid #8b5cf6;
      background: #8b5cf6;
      cursor: pointer;
      transition: all 0.2s ease;
    `;

    const nativeColorInput = document.createElement('input');
    nativeColorInput.type = 'color';
    nativeColorInput.className = 'cc3-native-color';
    nativeColorInput.value = '#8b5cf6';
    nativeColorInput.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      opacity: 0;
      cursor: pointer;
      border: none;
      padding: 0;
    `;

    nativeColorWrapper.appendChild(nativeColorInput);

    const hexInput = document.createElement('input');
    hexInput.type = 'text';
    hexInput.className = 'cc3-hex-input';
    hexInput.value = '#8B5CF6';
    hexInput.placeholder = '#FF0000';
    hexInput.maxLength = 7;
    hexInput.style.cssText = `
      width: 50%;
      height: 36px;
      padding: 4px 12px;
      border: 1px solid #dadce0;
      border-radius: 6px;
      font-size: 12px;
      text-transform: uppercase;
      box-sizing: border-box;
    `;

    colorInputRow.appendChild(nativeColorWrapper);
    colorInputRow.appendChild(hexInput);

    // Hidden color value input
    const colorValue = document.createElement('input');
    colorValue.type = 'hidden';
    colorValue.className = 'cc3-color-value';
    colorValue.value = '#8b5cf6';

    // Color palettes container
    const palettesContainer = document.createElement('div');
    palettesContainer.className = 'cc3-palettes-container';

    // Create palette panels
    const createPalettePanel = (name, colors, isActive = false) => {
      const panel = document.createElement('div');
      panel.className = 'cc3-palette-panel';
      panel.dataset.palette = name.toLowerCase();

      if (colors.length === 0) {
        // Empty state for custom colors
        panel.style.cssText = `
          display: ${isActive ? 'flex' : 'none'};
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 16px 12px;
          margin-bottom: 12px;
          text-align: center;
        `;

        const emptyContent = document.createElement('div');
        emptyContent.innerHTML = `
          <div style="font-weight: 600; margin-bottom: 6px; color: #202124; font-size: 13px;">No custom colors yet</div>
          <div style="font-size: 11px; color: #5f6368; margin-bottom: 12px; line-height: 1.5;">
            Set up custom colors in the Color Lab to see them here
          </div>
        `;

        const goToLabBtn = document.createElement('button');
        goToLabBtn.textContent = 'Go to Color Lab';
        goToLabBtn.className = 'cc3-go-to-lab-btn';
        goToLabBtn.style.cssText = `
          padding: 8px 20px;
          background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
          color: #ffffff;
          border: none;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 2px 4px rgba(251, 146, 60, 0.3);
        `;

        emptyContent.appendChild(goToLabBtn);
        panel.appendChild(emptyContent);
      } else {
        panel.style.cssText = `
          display: ${isActive ? 'grid' : 'none'};
          grid-template-columns: repeat(auto-fill, 26px);
          gap: 6px;
          justify-content: center;
          margin-bottom: 12px;
          padding: 4px 0;
        `;

        colors.forEach(color => {
          const swatch = document.createElement('div');
          swatch.className = 'cc3-swatch';
          swatch.dataset.color = color;
          swatch.style.cssText = `
            width: 26px;
            height: 26px;
            border-radius: 4px;
            background: ${color};
            cursor: pointer;
            border: 2px solid transparent;
            transition: all 0.15s ease;
            box-sizing: border-box;
          `;
          swatch.title = color.toUpperCase();
          panel.appendChild(swatch);
        });
      }

      return panel;
    };

    palettesContainer.appendChild(createPalettePanel('vibrant', colorPickerPalette, true));
    palettesContainer.appendChild(createPalettePanel('pastel', pastelPalette));
    palettesContainer.appendChild(createPalettePanel('dark', darkPalette));
    palettesContainer.appendChild(createPalettePanel('custom', customColors));

    // Opacity control
    const opacitySection = document.createElement('div');
    opacitySection.style.cssText = `margin-bottom: 24px;`;

    const opacityHeader = document.createElement('div');
    opacityHeader.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    `;

    const opacityLabel = document.createElement('div');
    opacityLabel.textContent = 'Opacity:';
    opacityLabel.style.cssText = `
      font-size: 12px;
      font-weight: 600;
      color: #5f6368;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    `;

    const opacityValueDisplay = document.createElement('div');
    opacityValueDisplay.className = 'cc3-opacity-value';
    opacityValueDisplay.textContent = '100%';
    opacityValueDisplay.style.cssText = `
      font-size: 12px;
      font-weight: 600;
      color: #8b5cf6;
    `;

    opacityHeader.appendChild(opacityLabel);
    opacityHeader.appendChild(opacityValueDisplay);

    // Opacity presets
    const opacityPresets = document.createElement('div');
    opacityPresets.style.cssText = `
      display: flex;
      gap: 6px;
      margin-bottom: 10px;
    `;

    [10, 20, 30, 40, 50, 100].forEach(value => {
      const btn = document.createElement('button');
      btn.textContent = `${value}%`;
      btn.className = 'cc3-opacity-preset';
      btn.dataset.opacity = value;
      btn.style.cssText = `
        flex: 1;
        padding: 6px 4px;
        font-size: 11px;
        border: 1px solid ${value === 100 ? '#8b5cf6' : '#dadce0'};
        border-radius: 4px;
        background: ${value === 100 ? '#f3e8ff' : '#f8f9fa'};
        color: ${value === 100 ? '#8b5cf6' : '#5f6368'};
        cursor: pointer;
        transition: all 0.2s ease;
        font-weight: ${value === 100 ? '600' : '400'};
      `;
      opacityPresets.appendChild(btn);
    });

    // Opacity slider
    const opacitySliderContainer = document.createElement('div');
    opacitySliderContainer.style.cssText = `
      position: relative;
      height: 8px;
      background: #e8eaed;
      border-radius: 4px;
      overflow: hidden;
    `;

    const opacitySliderFill = document.createElement('div');
    opacitySliderFill.className = 'cc3-opacity-fill';
    opacitySliderFill.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      height: 100%;
      width: 100%;
      background: linear-gradient(90deg, #8b5cf6, #7c3aed);
      border-radius: 4px;
      transition: width 0.1s ease;
    `;

    const opacitySlider = document.createElement('input');
    opacitySlider.type = 'range';
    opacitySlider.className = 'cc3-opacity-slider';
    opacitySlider.min = 0;
    opacitySlider.max = 100;
    opacitySlider.value = 100;
    opacitySlider.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      opacity: 0;
      cursor: pointer;
      margin: 0;
    `;

    opacitySliderContainer.appendChild(opacitySliderFill);
    opacitySliderContainer.appendChild(opacitySlider);

    opacitySection.appendChild(opacityHeader);
    opacitySection.appendChild(opacityPresets);
    opacitySection.appendChild(opacitySliderContainer);

    colorSection.appendChild(colorTitle);
    colorSection.appendChild(colorTabs);
    colorSection.appendChild(colorInputRow);
    colorSection.appendChild(colorValue);
    colorSection.appendChild(palettesContainer);
    colorSection.appendChild(opacitySection);

    // Action buttons
    const actions = document.createElement('div');
    actions.style.cssText = `
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    `;

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = 'cc3-cancel-btn';
    cancelBtn.style.cssText = `
      background: none;
      border: 1px solid #dadce0;
      border-radius: 6px;
      padding: 10px 20px;
      font-size: 14px;
      color: #5f6368;
      cursor: pointer;
      transition: all 0.2s ease;
    `;
    cancelBtn.onmouseover = () => {
      cancelBtn.style.backgroundColor = '#f8f9fa';
      cancelBtn.style.borderColor = '#5f6368';
    };
    cancelBtn.onmouseout = () => {
      cancelBtn.style.backgroundColor = 'transparent';
      cancelBtn.style.borderColor = '#dadce0';
    };

    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = 'Add Date Color';
    confirmBtn.className = 'cc3-confirm-btn';
    confirmBtn.style.cssText = `
      background: linear-gradient(135deg, #8b5cf6, #7c3aed);
      border: none;
      border-radius: 6px;
      padding: 10px 20px;
      font-size: 14px;
      color: white;
      cursor: pointer;
      font-weight: 500;
      transition: all 0.2s ease;
      box-shadow: 0 2px 4px rgba(139, 92, 246, 0.3);
    `;
    confirmBtn.onmouseover = () => {
      confirmBtn.style.transform = 'translateY(-1px)';
      confirmBtn.style.boxShadow = '0 4px 8px rgba(139, 92, 246, 0.4)';
    };
    confirmBtn.onmouseout = () => {
      confirmBtn.style.transform = 'translateY(0)';
      confirmBtn.style.boxShadow = '0 2px 4px rgba(139, 92, 246, 0.3)';
    };

    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);

    // Assemble the picker
    picker.appendChild(header);
    picker.appendChild(presets);
    picker.appendChild(dateSection);
    picker.appendChild(labelSection);
    picker.appendChild(colorSection);
    picker.appendChild(actions);
    modal.appendChild(picker);

    // Trigger entrance animation
    requestAnimationFrame(() => {
      modal.style.opacity = '1';
      picker.style.transform = 'translateY(0)';
    });

    return modal;
  }

  // Setup date color modal events
  function setupDateColorModalEvents(modal, onSave, onCancel) {
    const closeBtn = modal.querySelector('.cc3-close-btn');
    const cancelBtn = modal.querySelector('.cc3-cancel-btn');
    const confirmBtn = modal.querySelector('.cc3-confirm-btn');
    const dateInput = modal.querySelector('.cc3-date-input');
    const labelInput = modal.querySelector('.cc3-label-input');
    const presetBtns = modal.querySelectorAll('.cc3-preset-btn');
    const colorTabs = modal.querySelectorAll('.cc3-color-tab');
    const palettePanels = modal.querySelectorAll('.cc3-palette-panel');
    const swatches = modal.querySelectorAll('.cc3-swatch');
    const nativeColorInput = modal.querySelector('.cc3-native-color');
    const hexInput = modal.querySelector('.cc3-hex-input');
    const colorValue = modal.querySelector('.cc3-color-value');
    const colorPreviewWrapper = modal.querySelector('.cc3-color-preview-wrapper');
    const opacitySlider = modal.querySelector('.cc3-opacity-slider');
    const opacityFill = modal.querySelector('.cc3-opacity-fill');
    const opacityValueDisplay = modal.querySelector('.cc3-opacity-value');
    const opacityPresetBtns = modal.querySelectorAll('.cc3-opacity-preset');

    let currentOpacity = 100;

    // Helper: convert hex to rgba
    const hexToRgba = (hex, alpha) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      if (!result) return hex;
      const r = parseInt(result[1], 16);
      const g = parseInt(result[2], 16);
      const b = parseInt(result[3], 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    // Update color preview with current color and opacity
    const updateColorPreview = () => {
      const color = colorValue?.value || '#8b5cf6';
      colorPreviewWrapper.style.background = hexToRgba(color, currentOpacity / 100);
      colorPreviewWrapper.style.borderColor = color;
    };

    // Update opacity UI
    const updateOpacityUI = (opacity) => {
      currentOpacity = opacity;
      opacityValueDisplay.textContent = `${opacity}%`;
      opacitySlider.value = opacity;
      opacityFill.style.width = `${opacity}%`;

      // Update preset buttons
      opacityPresetBtns.forEach(btn => {
        const isActive = parseInt(btn.dataset.opacity) === opacity;
        btn.style.borderColor = isActive ? '#8b5cf6' : '#dadce0';
        btn.style.background = isActive ? '#f3e8ff' : '#f8f9fa';
        btn.style.color = isActive ? '#8b5cf6' : '#5f6368';
        btn.style.fontWeight = isActive ? '600' : '400';
      });

      updateColorPreview();
    };

    // Select a color
    const selectColor = (color) => {
      colorValue.value = color;
      nativeColorInput.value = color;
      hexInput.value = color.toUpperCase();
      hexInput.style.borderColor = '#dadce0';

      // Update swatch selection
      swatches.forEach(s => {
        if (s.dataset.color === color) {
          s.style.borderColor = '#8b5cf6';
          s.style.transform = 'scale(1.1)';
        } else {
          s.style.borderColor = 'transparent';
          s.style.transform = 'scale(1)';
        }
      });

      updateColorPreview();
    };

    // Preset date buttons
    presetBtns.forEach(btn => {
      btn.onclick = () => {
        dateInput.value = btn.dataset.date;
      };
    });

    // Color tab switching
    colorTabs.forEach(tab => {
      tab.onclick = () => {
        const tabName = tab.dataset.tab;

        colorTabs.forEach(t => {
          const isActive = t.dataset.tab === tabName;
          t.style.background = isActive ? '#8b5cf6' : '#f1f3f4';
          t.style.color = isActive ? 'white' : '#333';
        });

        palettePanels.forEach(panel => {
          panel.style.display = panel.dataset.palette === tabName ? 'grid' : 'none';
        });
      };
    });

    // Swatch click handlers
    swatches.forEach(swatch => {
      swatch.addEventListener('mouseenter', () => {
        swatch.style.transform = 'scale(1.1)';
        swatch.style.borderColor = '#8b5cf6';
      });
      swatch.addEventListener('mouseleave', () => {
        if (swatch.dataset.color !== colorValue.value) {
          swatch.style.transform = 'scale(1)';
          swatch.style.borderColor = 'transparent';
        }
      });
      swatch.addEventListener('click', () => {
        selectColor(swatch.dataset.color);
      });
    });

    // "Go to Color Lab" button handler
    const goToLabBtn = modal.querySelector('.cc3-go-to-lab-btn');
    if (goToLabBtn) {
      goToLabBtn.addEventListener('mouseover', () => {
        goToLabBtn.style.transform = 'translateY(-1px)';
        goToLabBtn.style.boxShadow = '0 4px 8px rgba(251, 146, 60, 0.4)';
      });
      goToLabBtn.addEventListener('mouseout', () => {
        goToLabBtn.style.transform = 'translateY(0)';
        goToLabBtn.style.boxShadow = '0 2px 4px rgba(251, 146, 60, 0.3)';
      });
      goToLabBtn.addEventListener('click', () => {
        // Close the modal first
        onCancel();

        // Switch to Preferences tab
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');

        tabButtons.forEach((btn) => btn.classList.remove('active'));
        tabContents.forEach((content) => content.classList.remove('active'));

        const preferencesButton = document.querySelector('[data-tab="preferences"]');
        const preferencesContent = document.getElementById('preferencesContent');

        if (preferencesButton) preferencesButton.classList.add('active');
        if (preferencesContent) preferencesContent.classList.add('active');

        // Expand Color Lab section
        setTimeout(() => {
          const colorLabHeader = document.getElementById('colorLabHeader');
          if (colorLabHeader && !colorLabHeader.classList.contains('expanded')) {
            colorLabHeader.classList.add('expanded');
          }

          // Scroll to Color Lab section
          setTimeout(() => {
            const colorLabSection = document.querySelector('.section.color-lab');
            if (colorLabSection) {
              colorLabSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }, 100);
        }, 100);
      });
    }

    // Native color input
    nativeColorInput.addEventListener('input', () => {
      hexInput.value = nativeColorInput.value.toUpperCase();
      colorValue.value = nativeColorInput.value;
      updateColorPreview();
    });
    nativeColorInput.addEventListener('change', () => {
      selectColor(nativeColorInput.value);
    });

    // Hex input
    hexInput.addEventListener('input', () => {
      let hex = hexInput.value.trim();
      if (!hex.startsWith('#')) hex = '#' + hex;
      if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
        nativeColorInput.value = hex;
        colorValue.value = hex;
        hexInput.style.borderColor = '#8b5cf6';
        updateColorPreview();
      } else {
        hexInput.style.borderColor = '#dc2626';
      }
    });
    hexInput.addEventListener('change', () => {
      let hex = hexInput.value.trim();
      if (!hex.startsWith('#')) hex = '#' + hex;
      if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
        selectColor(hex);
      }
    });

    // Opacity slider
    opacitySlider.addEventListener('input', (e) => {
      updateOpacityUI(parseInt(e.target.value, 10));
    });

    // Opacity preset buttons
    opacityPresetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        updateOpacityUI(parseInt(btn.dataset.opacity, 10));
      });
    });

    // Close handlers
    const handleClose = () => onCancel();
    closeBtn.onclick = handleClose;
    cancelBtn.onclick = handleClose;

    // Click outside to close
    modal.onclick = (e) => {
      if (e.target === modal) {
        handleClose();
      }
    };

    // Keyboard handler
    modal.onkeydown = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    // Confirm button
    confirmBtn.onclick = async () => {
      const dateKey = dateInput.value;
      if (!dateKey) {
        dateInput.style.borderColor = '#dc2626';
        dateInput.focus();
        return;
      }
      const color = colorValue.value;
      const label = labelInput.value.trim();

      // Check if this date already has a color assigned
      if (settings.dateColors && settings.dateColors[dateKey]) {
        const existingLabel = settings.dateColorLabels?.[dateKey];
        const existingColor = settings.dateColors[dateKey];

        // Format date for display
        const dateObj = new Date(dateKey + 'T00:00:00');
        const formattedDate = dateObj.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });

        // Build the message
        let message = `"${formattedDate}" already has a color assigned`;
        if (existingLabel) {
          message += ` with label "${existingLabel}"`;
        }
        message += '.\n\nDo you want to override it with the new color?';

        // Show confirmation dialog
        const confirmed = await showConfirmDialog(
          'Override Existing Color?',
          message,
          existingColor,
          color
        );

        if (!confirmed) {
          return;
        }
      }

      onSave(dateKey, color, currentOpacity, label);
    };

    // Initialize
    updateOpacityUI(100);
    selectColor('#8b5cf6');
  }

  // Reorganize the weekdays display based on week start setting
  function reorganizeWeekdaysDisplay() {
    const weekStart = settings.weekStart !== undefined ? settings.weekStart : 0; // 0=Sunday, 1=Monday, 6=Saturday
    const weekdaysContainer = document.querySelector('.weekdays');

    if (!weekdaysContainer) return;

    // Get all day color items
    const dayItems = Array.from(weekdaysContainer.querySelectorAll('.day-color-item'));

    if (dayItems.length !== 7) return;

    // Create a map of day index to element
    const dayMap = {};
    dayItems.forEach((item) => {
      const dayIndex = parseInt(item.getAttribute('data-day'));
      dayMap[dayIndex] = item;
    });

    // Clear the container
    weekdaysContainer.innerHTML = '';

    // Reorganize based on week start
    // If week starts on Sunday (0), order is: 0,1,2,3,4,5,6
    // If week starts on Monday (1), order is: 1,2,3,4,5,6,0
    // If week starts on Saturday (6), order is: 6,0,1,2,3,4,5
    for (let i = 0; i < 7; i++) {
      const dayIndex = (i + weekStart) % 7;
      if (dayMap[dayIndex]) {
        weekdaysContainer.appendChild(dayMap[dayIndex]);
      }
    }
  }

  function setupEventListeners() {
    // Accordion behavior for section headers
    const sectionHeaders = document.querySelectorAll('.section-header[data-section]');

    sectionHeaders.forEach(header => {
      header.addEventListener('click', (e) => {
        // Don't trigger accordion if clicking on toggle switch or its label
        if (e.target.closest('.toggle')) {
          return;
        }

        const isExpanded = header.classList.contains('expanded');

        // Close all sections
        sectionHeaders.forEach(h => h.classList.remove('expanded'));

        // If this section was not expanded, expand it
        if (!isExpanded) {
          header.classList.add('expanded');
        }
      });
    });

    // All sections start collapsed by default

    // Toggle switch
    qs('enableDayColoring').onclick = async (e) => {
      e.stopPropagation(); // Prevent accordion trigger
      const previousState = settings.enabled;

      // Use storage system's setEnabled method for bulletproof toggling
      settings = await window.cc3Storage.setEnabled(!previousState);

      updateToggle();
      await saveSettings();

      // Notify calendar tabs to refresh day coloring
      const newSettings = await window.cc3Storage.getSettings();
      await notifyFeatureToggle('dayColoring', newSettings);
    };

    // Time blocking toggle switch
    qs('enableTimeBlocking').onclick = async (e) => {
      e.stopPropagation(); // Prevent accordion trigger
      const currentEnabled = settings.timeBlocking?.enabled || false;
      await window.cc3Storage.setTimeBlockingEnabled(!currentEnabled);
      settings = await window.cc3Storage.getSettings();
      updateTimeBlockingToggle();
      updateTimeBlockingSettings();
      await saveSettings();

      // Immediately notify content script
      notifyTimeBlockingChange();
    };

    // Day Coloring info card toggle
    const dayColoringInfoToggle = qs('dayColoringInfoToggle');
    const dayColoringInfoExpanded = qs('dayColoringInfoExpanded');
    if (dayColoringInfoToggle && dayColoringInfoExpanded) {
      dayColoringInfoToggle.onclick = (e) => {
        e.preventDefault();
        const isExpanded = dayColoringInfoExpanded.style.display !== 'none';
        if (isExpanded) {
          dayColoringInfoExpanded.style.display = 'none';
          dayColoringInfoToggle.innerHTML = `
            See how to use
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style="transition: transform 0.2s ease;">
              <path d="M7 10l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          `;
        } else {
          dayColoringInfoExpanded.style.display = 'block';
          dayColoringInfoToggle.innerHTML = `
            Hide
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style="transform: rotate(180deg); transition: transform 0.2s ease;">
              <path d="M7 10l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          `;
        }
      };
    }

    const dayColoringVideoTutorialBtn = qs('dayColoringVideoTutorialBtn');
    if (dayColoringVideoTutorialBtn) {
      dayColoringVideoTutorialBtn.onclick = (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: 'https://www.calendarextension.com/help#day-coloring' });
      };
    }

    // Date-specific color add button - opens modal
    const addDateColorBtn = qs('addDateColorBtn');
    if (addDateColorBtn) {
      addDateColorBtn.onclick = () => {
        openDateColorModal();
      };
      // Add hover effect
      addDateColorBtn.addEventListener('mouseenter', () => {
        addDateColorBtn.style.transform = 'translateY(-1px)';
        addDateColorBtn.style.boxShadow = '0 4px 8px rgba(139, 92, 246, 0.4)';
      });
      addDateColorBtn.addEventListener('mouseleave', () => {
        addDateColorBtn.style.transform = 'translateY(0)';
        addDateColorBtn.style.boxShadow = '0 2px 4px rgba(139, 92, 246, 0.3)';
      });
    }

    // Time Blocking info card toggle
    const timeBlockingInfoToggle = qs('timeBlockingInfoToggle');
    const timeBlockingInfoExpanded = qs('timeBlockingInfoExpanded');
    if (timeBlockingInfoToggle && timeBlockingInfoExpanded) {
      timeBlockingInfoToggle.onclick = (e) => {
        e.preventDefault();
        const isExpanded = timeBlockingInfoExpanded.style.display !== 'none';
        if (isExpanded) {
          timeBlockingInfoExpanded.style.display = 'none';
          timeBlockingInfoToggle.innerHTML = `
            See how to use
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style="transition: transform 0.2s ease;">
              <path d="M7 10l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          `;
        } else {
          timeBlockingInfoExpanded.style.display = 'block';
          timeBlockingInfoToggle.innerHTML = `
            Hide
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style="transform: rotate(180deg); transition: transform 0.2s ease;">
              <path d="M7 10l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          `;
        }
      };
    }

    const timeBlockingVideoTutorialBtn = qs('timeBlockingVideoTutorialBtn');
    if (timeBlockingVideoTutorialBtn) {
      timeBlockingVideoTutorialBtn.onclick = (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: 'https://www.calendarextension.com/help#time-blocking' });
      };
    }

    // Color Lab info card toggle
    const colorLabInfoToggle = qs('colorLabInfoToggle');
    const colorLabInfoExpanded = qs('colorLabInfoExpanded');
    if (colorLabInfoToggle && colorLabInfoExpanded) {
      colorLabInfoToggle.onclick = (e) => {
        e.preventDefault();
        const isExpanded = colorLabInfoExpanded.style.display !== 'none';
        if (isExpanded) {
          colorLabInfoExpanded.style.display = 'none';
          colorLabInfoToggle.innerHTML = `
            See how to use
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style="transition: transform 0.2s ease;">
              <path d="M7 10l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          `;
        } else {
          colorLabInfoExpanded.style.display = 'block';
          colorLabInfoToggle.innerHTML = `
            Hide
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style="transform: rotate(180deg); transition: transform 0.2s ease;">
              <path d="M7 10l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          `;
        }
      };
    }

    const colorLabVideoTutorialBtn = qs('colorLabVideoTutorialBtn');
    if (colorLabVideoTutorialBtn) {
      colorLabVideoTutorialBtn.onclick = (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: 'https://www.calendarextension.com/help#color-lab' });
      };
    }

    // Date-Specific Blocks info card toggle
    const dateSpecificBlocksInfoToggle = qs('dateSpecificBlocksInfoToggle');
    const dateSpecificBlocksInfoExpanded = qs('dateSpecificBlocksInfoExpanded');
    if (dateSpecificBlocksInfoToggle && dateSpecificBlocksInfoExpanded) {
      dateSpecificBlocksInfoToggle.onclick = (e) => {
        e.preventDefault();
        const isExpanded = dateSpecificBlocksInfoExpanded.style.display !== 'none';
        if (isExpanded) {
          dateSpecificBlocksInfoExpanded.style.display = 'none';
          dateSpecificBlocksInfoToggle.innerHTML = `
            See how to use
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style="transition: transform 0.2s ease;">
              <path d="M7 10l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          `;
        } else {
          dateSpecificBlocksInfoExpanded.style.display = 'block';
          dateSpecificBlocksInfoToggle.innerHTML = `
            Hide
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style="transform: rotate(180deg); transition: transform 0.2s ease;">
              <path d="M7 10l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          `;
        }
      };
    }

    const dateSpecificBlocksVideoTutorialBtn = qs('dateSpecificBlocksVideoTutorialBtn');
    if (dateSpecificBlocksVideoTutorialBtn) {
      dateSpecificBlocksVideoTutorialBtn.onclick = (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: 'https://www.calendarextension.com/help#date-specific-blocks' });
      };
    }

    // Time blocking global settings
    const timeBlockGlobalColor = qs('timeBlockGlobalColor');
    const globalPreview = qs('globalTimeBlockPreview');
    if (timeBlockGlobalColor) {
      timeBlockGlobalColor.onchange = async (e) => {
        const newColor = e.target.value;
        // Update preview
        if (globalPreview) {
          globalPreview.style.backgroundColor = newColor;
        }
        await window.cc3Storage.setTimeBlockingGlobalColor(newColor);
        settings = await window.cc3Storage.getSettings();
        updateTimeBlockingSchedule(); // Refresh to show new default color
        await saveSettings();
        notifyTimeBlockingColorChange(); // Use real-time color update
      };
      // Also add real-time feedback during color picking
      timeBlockGlobalColor.oninput = async (e) => {
        const newColor = e.target.value;
        // Update preview in real-time
        if (globalPreview) {
          globalPreview.style.backgroundColor = newColor;
        }
        await window.cc3Storage.setTimeBlockingGlobalColor(newColor);
        settings = await window.cc3Storage.getSettings();
        notifyTimeBlockingColorChange();
      };

      // Add hex input synchronization for global color
      const globalHexInput = qs('timeBlockGlobalHex');
      if (globalHexInput) {
        // When color picker changes, update hex input
        const syncGlobalHexFromColor = () => {
          globalHexInput.value = timeBlockGlobalColor.value.toUpperCase();
        };

        // When hex input changes, update color picker
        const syncGlobalColorFromHex = async () => {
          const hexValue = globalHexInput.value.trim();
          // Add # if missing
          const normalizedHex = hexValue.startsWith('#') ? hexValue : '#' + hexValue;
          // Validate hex format
          if (/^#[0-9A-Fa-f]{6}$/.test(normalizedHex)) {
            timeBlockGlobalColor.value = normalizedHex;
            globalHexInput.style.borderColor = '#1a73e8';
            // Update preview and save
            if (globalPreview) {
              globalPreview.style.backgroundColor = normalizedHex;
            }
            await window.cc3Storage.setTimeBlockingGlobalColor(normalizedHex);
            settings = await window.cc3Storage.getSettings();
            updateTimeBlockingSchedule();
            await saveSettings();
            notifyTimeBlockingColorChange();
          } else {
            globalHexInput.style.borderColor = '#dc2626';
          }
        };

        timeBlockGlobalColor.addEventListener('change', syncGlobalHexFromColor);
        timeBlockGlobalColor.addEventListener('input', syncGlobalHexFromColor);
        globalHexInput.addEventListener('input', syncGlobalColorFromHex);
        globalHexInput.addEventListener('change', syncGlobalColorFromHex);
      }
    }

    const timeBlockShadingStyle = qs('timeBlockShadingStyle');
    if (timeBlockShadingStyle) {
      timeBlockShadingStyle.onchange = async (e) => {
        await window.cc3Storage.setTimeBlockingShadingStyle(e.target.value);
        settings = await window.cc3Storage.getSettings();
        await saveSettings();
        notifyTimeBlockingChange();
      };
    }

    // Add Date-specific Block button
    const addDateSpecificBlockBtn = qs('addDateSpecificBlock');
    if (addDateSpecificBlockBtn) {
      addDateSpecificBlockBtn.onclick = addDateSpecificBlock;
    }

    // Remove All Date-specific Blocks button
    const removeAllDateSpecificBlocksBtn = qs('removeAllDateSpecificBlocks');
    if (removeAllDateSpecificBlocksBtn) {
      removeAllDateSpecificBlocksBtn.onclick = removeAllDateSpecificBlocks;
    }

    // Color pickers and opacity controls
    for (let i = 0; i < 7; i++) {
      const colorInput = qs(`color${i}`);
      const hexInput = qs(`hex${i}`);
      const opacityInput = qs(`opacity${i}`);
      const opacityValue = qs(`opacityValue${i}`);
      const preview = qs(`preview${i}`);

      if (colorInput) {
        colorInput.onchange = async (e) => {
          settings = await window.cc3Storage.setWeekdayColor(i, e.target.value);
          const opacity = settings.weekdayOpacity?.[String(i)] || defaultOpacity[String(i)];
          updatePreview(i, e.target.value, opacity);
          // Update hex input
          if (hexInput) {
            hexInput.value = e.target.value.toUpperCase();
          }
          // Update clear button state
          updateClearButtonState(i, e.target.value);
          await saveSettings();
        };

        // Real-time feedback during color picking
        colorInput.oninput = (e) => {
          if (hexInput) {
            hexInput.value = e.target.value.toUpperCase();
          }
          // Update preview with current opacity
          const opacity = settings.weekdayOpacity?.[String(i)] || defaultOpacity[String(i)];
          updatePreview(i, e.target.value, opacity);
        };
      }

      // Hex input synchronization
      if (hexInput && colorInput) {
        hexInput.oninput = async () => {
          const hexValue = hexInput.value.trim();
          const normalizedHex = hexValue.startsWith('#') ? hexValue : '#' + hexValue;

          if (/^#[0-9A-Fa-f]{6}$/.test(normalizedHex)) {
            colorInput.value = normalizedHex;
            hexInput.style.borderColor = '#1a73e8';
            // Update preview and save
            settings = await window.cc3Storage.setWeekdayColor(i, normalizedHex);
            const opacity = settings.weekdayOpacity?.[String(i)] || defaultOpacity[String(i)];
            updatePreview(i, normalizedHex, opacity);
            // Update clear button state
            updateClearButtonState(i, normalizedHex);
            await saveSettings();
          } else {
            hexInput.style.borderColor = '#dc2626';
          }
        };

        hexInput.onchange = hexInput.oninput;
      }

      if (opacityInput) {
        // Enhanced real-time preview update as user drags slider
        opacityInput.oninput = (e) => {
          const opacity = parseInt(e.target.value);
          updateOpacityDisplay(i, opacity);
          updateSliderFill(i, opacity);
          // Update preview with new opacity (no save yet)
          const color = settings.weekdayColors?.[String(i)] || defaultColors[String(i)];
          updatePreview(i, color, opacity);
        };

        // Save and apply to calendar when user releases slider
        const saveOpacity = async (e) => {
          const opacity = parseInt(e.target.value);
          settings = await window.cc3Storage.setWeekdayOpacity(i, opacity);
          updateOpacityPresetButtons(i, opacity);
          await saveSettings();
        };

        opacityInput.onchange = saveOpacity;
        opacityInput.onmouseup = saveOpacity;
        opacityInput.ontouchend = saveOpacity;
      }

      // Clear button initialization
      const clearBtn = qs(`clearBtn${i}`);
      if (clearBtn) {
        // Set initial state based on current color
        const currentColor = settings.weekdayColors?.[String(i)] || defaultColors[String(i)];
        updateClearButtonState(i, currentColor);

        // Add click handler
        clearBtn.onclick = async (e) => {
          e.stopPropagation(); // Prevent day-color-item click
          await handleClearDay(i);
        };
      }
    }

    // Clear All Days button
    const clearAllDaysBtn = qs('clearAllDaysBtn');
    if (clearAllDaysBtn) {
      // Update button state based on whether all days are already white
      const updateClearAllButtonState = async () => {
        // Always read fresh from storage to avoid stale state
        const currentSettings = await window.cc3Storage.getSettings();

        const allDaysAreWhite = [0, 1, 2, 3, 4, 5, 6].every(dayIndex => {
          const color = (currentSettings.weekdayColors?.[String(dayIndex)] || defaultColors[String(dayIndex)]).toLowerCase().replace(/\s/g, '');
          return color === '#ffffff' || color === '#fff' || color === 'white';
        });

        clearAllDaysBtn.disabled = allDaysAreWhite;
        clearAllDaysBtn.title = allDaysAreWhite
          ? 'All days already at default (white)'
          : 'Reset all days to default (white)';
      };

      // Initial state
      updateClearAllButtonState();

      // Click handler
      clearAllDaysBtn.onclick = async (e) => {
        e.stopPropagation();

        // Optimistic UI update - disable immediately for instant visual feedback
        clearAllDaysBtn.disabled = true;
        clearAllDaysBtn.title = 'Clearing all days...';

        // Execute clear operation
        await handleClearAllDays();

        // Confirm final state (will stay disabled since all days are now white)
        await updateClearAllButtonState();
      };

      // Store reference for updates
      window.updateClearAllButtonState = updateClearAllButtonState;
    }

    // Week start selector
    const weekStartSelect = qs('weekStart');
    if (weekStartSelect) {
      weekStartSelect.onchange = async (e) => {
        settings = await window.cc3Storage.setWeekStart(parseInt(e.target.value, 10));
        // Also mark as configured when changed from the main dropdown
        if (!settings.weekStartConfigured) {
          settings = await window.cc3Storage.setWeekStartConfigured(true);
        }
        await saveSettings();
        // Reorganize day color row to match new week start
        reorganizeWeekdaysDisplay();
      };
    }

    // Week start setup prompt handlers
    const weekStartSetupSelect = qs('weekStartSetup');
    const confirmWeekStartBtn = qs('confirmWeekStart');

    if (weekStartSetupSelect && confirmWeekStartBtn) {
      // Enable confirm button when a selection is made
      weekStartSetupSelect.onchange = (e) => {
        if (e.target.value) {
          confirmWeekStartBtn.style.opacity = '1';
          confirmWeekStartBtn.style.pointerEvents = 'auto';
          confirmWeekStartBtn.disabled = false;
        } else {
          confirmWeekStartBtn.style.opacity = '0.5';
          confirmWeekStartBtn.style.pointerEvents = 'none';
          confirmWeekStartBtn.disabled = true;
        }
      };

      // Handle confirm button click
      confirmWeekStartBtn.onclick = async () => {
        const selectedValue = weekStartSetupSelect.value;
        if (!selectedValue) return;

        // Save the week start value
        settings = await window.cc3Storage.setWeekStart(parseInt(selectedValue, 10));
        // Mark as configured
        settings = await window.cc3Storage.setWeekStartConfigured(true);
        await saveSettings();

        // Sync the main weekStart dropdown
        if (weekStartSelect) {
          weekStartSelect.value = selectedValue;
        }

        // Update UI
        updateToggle();
        reorganizeWeekdaysDisplay();

        // Notify calendar tabs to refresh day coloring
        const newSettings = await window.cc3Storage.getSettings();
        await notifyFeatureToggle('dayColoring', newSettings);

        showToast('Week start configured! You can now customize your day colors.');
      };
    }

    // Enhanced Opacity Preset Buttons
    document.querySelectorAll('.opacity-preset-btn').forEach((button) => {
      button.onclick = async (e) => {
        const dayIndex = parseInt(e.target.dataset.day);
        const opacity = parseInt(e.target.dataset.opacity);
        const opacityInput = qs(`opacity${dayIndex}`);

        if (opacityInput) {
          // Update slider value
          opacityInput.value = opacity;
          // Update all UI elements
          updateOpacityDisplay(dayIndex, opacity);
          updateSliderFill(dayIndex, opacity);
          updateOpacityPresetButtons(dayIndex, opacity);
          // Save settings
          settings = await window.cc3Storage.setWeekdayOpacity(dayIndex, opacity);
          // Update preview with new opacity
          const color = settings.weekdayColors?.[String(dayIndex)] || defaultColors[String(dayIndex)];
          updatePreview(dayIndex, color, opacity);
          await saveSettings();
        }
      };
    });

    // Color tab switching
    document.querySelectorAll('.color-tab').forEach((tab) => {
      tab.onclick = () => {
        const dayIndex = tab.dataset.day;
        const tabName = tab.dataset.tab;
        switchColorTab(dayIndex, tabName);
      };
    });

    // Reset button - Complete reset with dual confirmation
    qs('resetBtn').onclick = async () => {
      // Get current data for confirmation message
      let timeBlockCount = 0;

      try {
        const schedules = settings?.timeBlocking?.weeklySchedule || {};
        timeBlockCount = Object.values(schedules).reduce((sum, blocks) => sum + blocks.length, 0);
      } catch (error) {
        console.warn('Failed to get counts:', error);
      }

      // First confirmation - detailed warning
      const confirm1 = confirm(
        `⚠️ WARNING: Complete Reset

This will PERMANENTLY delete:
• All day colors and opacity settings
• All event colors
• All time blocking schedules (${timeBlockCount} block${timeBlockCount !== 1 ? 's' : ''})

This will PRESERVE:
• Your subscription status
• Push notification settings

This action CANNOT be undone.

Do you want to continue?`,
      );

      if (!confirm1) {
        return;
      }

      // Second confirmation - type to confirm
      const confirm2 = prompt('Type "RESET" in ALL CAPS to confirm permanent deletion:', '');

      if (confirm2 !== 'RESET') {
        alert('Reset cancelled - nothing was changed.');
        return;
      }

      // Disable button during reset
      const btn = qs('resetBtn');
      const originalText = btn.textContent;
      const originalStyle = btn.style.background;
      btn.disabled = true;
      btn.textContent = 'Resetting...';
      btn.style.cursor = 'not-allowed';
      btn.style.opacity = '0.6';

      try {
        // Perform complete reset via storage helper
        const resetResult = await window.cc3Storage.performCompleteReset();

        if (!resetResult.success) {
          // Critical failure
          alert(
            `❌ Reset Failed

Completed steps:
• OAuth: ${resetResult.results.oauth}
• Sync storage: ${resetResult.results.syncStorage}
• Settings: ${resetResult.results.settings}
• Local storage: ${resetResult.results.localStorage}

Error: ${resetResult.error}

Some settings may have been reset.
Please close and reopen the extension.

If issues persist, reinstall the extension.`,
          );

          // Re-enable button
          btn.disabled = false;
          btn.textContent = originalText;
          btn.style.background = originalStyle;
          btn.style.cursor = 'pointer';
          btn.style.opacity = '1';
          return;
        }

        // Success! Now update UI
        settings = await window.cc3Storage.getSettings();
        customColors = [];
        await saveCustomColors();

        // Notify content scripts
        try {
          const tabs = await chrome.tabs.query({ url: 'https://calendar.google.com/*' });
          for (const tab of tabs) {
            chrome.tabs.sendMessage(tab.id, { type: 'SETTINGS_RESET' }).catch(() => {
              // Tab might be closed, ignore
            });
          }
        } catch (error) {
          console.warn('Failed to notify content scripts:', error);
        }

        // Notify background service worker
        try {
          await chrome.runtime.sendMessage({ type: 'SETTINGS_RESET_COMPLETE' });
        } catch (error) {
          console.warn('Failed to notify background:', error);
        }

        // Visual feedback - green success state
        btn.textContent = '✓ Reset Complete!';
        btn.style.background = '#059669';
        btn.style.borderColor = '#059669';
        btn.disabled = true; // Keep disabled
        btn.style.cursor = 'default';
        btn.style.opacity = '1';

        // Show detailed success message
        const successMessage = `✅ Reset Complete!

Successfully reset:
✓ Day coloring settings
✓ Event colors
✓ Time blocking schedules (${timeBlockCount} block${timeBlockCount !== 1 ? 's' : ''} cleared)

Preserved:
✓ Your subscription status
✓ Push notification settings

The popup will reload to show fresh settings.
Would you like to refresh all Google Calendar tabs?`;

        setTimeout(() => {
          const shouldRefreshTabs = confirm(successMessage);

          if (shouldRefreshTabs) {
            // Auto-refresh calendar tabs
            chrome.tabs.query({ url: 'https://calendar.google.com/*' }).then((tabs) => {
              tabs.forEach((tab) => {
                chrome.tabs.reload(tab.id);
              });
            });
          }

          // Reload the popup to show fresh UI with default settings
          window.location.reload();
        }, 100);
      } catch (error) {
        console.error('Reset error:', error);
        alert(`❌ Reset failed: ${error.message}\n\nPlease try again or contact support.`);

        // Re-enable button
        btn.disabled = false;
        btn.textContent = originalText;
        btn.style.background = originalStyle;
        btn.style.cursor = 'pointer';
        btn.style.opacity = '1';
      }
    };
  }

  // Enhanced opacity control helper functions
  function updateOpacityDisplay(dayIndex, opacity) {
    const opacityValue = qs(`opacityValue${dayIndex}`);
    if (opacityValue) {
      opacityValue.textContent = opacity + '%';
    }
  }

  function updateSliderFill(dayIndex, opacity) {
    const sliderFill = qs(`sliderFill${dayIndex}`);
    if (sliderFill) {
      sliderFill.style.width = opacity + '%';
    }
  }

  function updateOpacityPresetButtons(dayIndex, currentOpacity) {
    // Remove active class from all preset buttons for this day
    document.querySelectorAll(`[data-day="${dayIndex}"].opacity-preset-btn`).forEach((btn) => {
      btn.classList.remove('active');
    });

    // Add active class to the button that matches current opacity (if it exists)
    const activeButton = document.querySelector(
      `[data-day="${dayIndex}"][data-opacity="${currentOpacity}"].opacity-preset-btn`,
    );
    if (activeButton) {
      activeButton.classList.add('active');
    }
  }

  /**
   * Update clear button state based on current color
   * @param {number} dayIndex - Day index (0-6)
   * @param {string} color - Current color (hex)
   */
  function updateClearButtonState(dayIndex, color) {
    const clearBtn = qs(`clearBtn${dayIndex}`);
    const preview = qs(`preview${dayIndex}`);

    if (!clearBtn || !preview) return;

    // Check if color is white or close to white
    const normalizedColor = color.toLowerCase().replace(/\s/g, '');
    const isWhite =
      normalizedColor === '#ffffff' || normalizedColor === '#fff' || normalizedColor === 'white' || normalizedColor === '#fff';

    if (isWhite) {
      // Disable button and show cleared state
      clearBtn.disabled = true;
      clearBtn.title = 'Already at default (white)';
      preview.classList.add('cleared');
    } else {
      // Enable button
      clearBtn.disabled = false;
      clearBtn.title = 'Reset to default (white)';
      preview.classList.remove('cleared');
    }
  }

  /**
   * Update all color-related UI elements for a day
   * @param {number} dayIndex - Day index (0-6)
   * @param {string} color - New color (hex)
   */
  function updateColorUI(dayIndex, color) {
    // Update color input
    const colorInput = qs(`color${dayIndex}`);
    if (colorInput) {
      colorInput.value = color;
    }

    // Update hex input
    const hexInput = qs(`hex${dayIndex}`);
    if (hexInput) {
      hexInput.value = color.toUpperCase();
    }

    // Update color preview in picker
    const colorPreview = qs(`colorPreview${dayIndex}`);
    if (colorPreview) {
      colorPreview.style.backgroundColor = color;
    }
  }

  /**
   * Handle clearing a day's color
   * @param {number} dayIndex - Day index (0-6)
   */
  async function handleClearDay(dayIndex) {
    const whiteColor = '#ffffff';
    const defaultOpacity = 30;

    console.log(`Clearing day ${dayIndex} to white`);

    try {
      // 1. Set color to white
      settings = await window.cc3Storage.setWeekdayColor(dayIndex, whiteColor);

      // 2. Reset opacity to default
      settings = await window.cc3Storage.setWeekdayOpacity(dayIndex, defaultOpacity);

      // 3. Update all UI elements
      updateColorUI(dayIndex, whiteColor);
      updateOpacityDisplay(dayIndex, defaultOpacity);
      updatePreview(dayIndex, whiteColor, defaultOpacity);
      updateClearButtonState(dayIndex, whiteColor);
      updateSliderFill(dayIndex, defaultOpacity);
      updateOpacityPresetButtons(dayIndex, defaultOpacity);

      // 4. Save settings and notify calendar
      await saveSettings();

      // 5. Update "Clear All" button state
      if (window.updateClearAllButtonState) {
        await window.updateClearAllButtonState();
      }

      // 6. Show feedback
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      showToast(`${dayNames[dayIndex]} color cleared to default`);
    } catch (error) {
      console.error('Error clearing day color:', error);
      showToast('Failed to clear color', 'error');
    }
  }

  /**
   * Handle clearing all days' colors
   */
  async function handleClearAllDays() {
    const whiteColor = '#ffffff';
    const defaultOpacity = 30;

    console.log('Clearing all days to white');

    try {
      // Clear all 7 days
      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        // 1. Set color to white
        settings = await window.cc3Storage.setWeekdayColor(dayIndex, whiteColor);

        // 2. Reset opacity to default
        settings = await window.cc3Storage.setWeekdayOpacity(dayIndex, defaultOpacity);

        // 3. Update UI elements for this day
        updateColorUI(dayIndex, whiteColor);
        updateOpacityDisplay(dayIndex, defaultOpacity);
        updatePreview(dayIndex, whiteColor, defaultOpacity);
        updateClearButtonState(dayIndex, whiteColor);
        updateSliderFill(dayIndex, defaultOpacity);
        updateOpacityPresetButtons(dayIndex, defaultOpacity);
      }

      // 4. Save settings and notify calendar
      await saveSettings();

      // 5. Show feedback
      showToast('All day colors cleared to default');
    } catch (error) {
      console.error('Error clearing all day colors:', error);
      showToast('Failed to clear all colors', 'error');
    }
  }

  function initializeEnhancedOpacityControls() {
    // Initialize all opacity displays and slider fills based on current settings
    for (let i = 0; i < 7; i++) {
      const currentOpacity = settings.weekdayOpacity?.[String(i)] || defaultOpacity[String(i)];
      updateOpacityDisplay(i, currentOpacity);
      updateSliderFill(i, currentOpacity);
      updateOpacityPresetButtons(i, currentOpacity);
    }
  }

  // Enhanced color picker toggle functionality
  function setupColorPickerToggle() {
    // Track which color pickers are currently open
    const colorPickerStates = {};

    // Helper function to update icon appearance
    function updateIconAppearance(icon, isOpen) {
      if (isOpen) {
        icon.style.background = 'rgba(26, 115, 232, 0.9)';
        icon.style.color = 'white';
        icon.title = 'Click to close color picker';
      } else {
        icon.style.background = 'rgba(255, 255, 255, 0.9)';
        icon.style.color = '';
        icon.title = 'Click to open color picker';
      }
    }

    // Set up both icon and color input handlers
    document.querySelectorAll('.color-picker-icon').forEach((icon) => {
      const dayIndex = icon.dataset.day;
      const colorInput = qs(`color${dayIndex}`);
      if (!colorInput) return;

      colorPickerStates[dayIndex] = false; // Initially closed

      // Create a wrapper div to intercept clicks
      const container = colorInput.parentElement;

      // Add a click handler to the container that manages the toggle
      let isProcessingClick = false;

      container.onclick = (e) => {
        // Don't process if we're already handling a click
        if (isProcessingClick) return;
        isProcessingClick = true;

        // If clicking on the icon, handle toggle
        if (e.target === icon) {
          e.preventDefault();
          e.stopPropagation();

          colorPickerStates[dayIndex] = !colorPickerStates[dayIndex];
          updateIconAppearance(icon, colorPickerStates[dayIndex]);

          if (colorPickerStates[dayIndex]) {
            // Delay the click to allow our state to be set first
            setTimeout(() => {
              colorInput.click();
              isProcessingClick = false;
            }, 50);
          } else {
            isProcessingClick = false;
          }
          return;
        }

        // If clicking on the color input, handle toggle
        if (e.target === colorInput) {
          e.preventDefault();
          e.stopPropagation();

          colorPickerStates[dayIndex] = !colorPickerStates[dayIndex];
          updateIconAppearance(icon, colorPickerStates[dayIndex]);

          if (colorPickerStates[dayIndex]) {
            // Allow the native click to proceed for opening
            setTimeout(() => {
              // Restore the default click behavior temporarily
              const originalHandler = colorInput.onclick;
              colorInput.onclick = null;
              colorInput.click();
              colorInput.onclick = originalHandler;
              isProcessingClick = false;
            }, 50);
          } else {
            isProcessingClick = false;
          }
          return;
        }

        isProcessingClick = false;
      };

      // Handle when the color input changes (user selects a color)
      const originalOnChange = colorInput.onchange;
      colorInput.onchange = (e) => {
        // Call the original handler first
        if (originalOnChange) {
          originalOnChange(e);
        }

        // Auto-close the picker after selection
        setTimeout(() => {
          colorPickerStates[dayIndex] = false;
          updateIconAppearance(icon, false);
        }, 100);
      };
    });
  }

  // Helper function to position day details modal within viewport
  function positionDayDetailsInView(dayItem, details) {
    // Reset to default positioning first to get accurate measurements
    details.style.top = '100%';
    details.style.bottom = 'auto';
    details.style.left = '50%';
    details.style.right = 'auto';
    details.style.transform = 'translateX(-50%)';
    details.style.marginTop = '4px';
    details.style.marginBottom = '0';

    // Force reflow to get accurate measurements
    const detailsRect = details.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Check vertical overflow - position above if needed
    if (detailsRect.bottom > viewportHeight) {
      details.style.top = 'auto';
      details.style.bottom = '100%';
      details.style.marginTop = '0';
      details.style.marginBottom = '4px';
    }

    // Check horizontal overflow - adjust left/right positioning
    if (detailsRect.left < 0) {
      // Overflowing left edge - align to left
      details.style.left = '0';
      details.style.transform = 'none';
    } else if (detailsRect.right > viewportWidth) {
      // Overflowing right edge - align to right
      details.style.left = 'auto';
      details.style.right = '0';
      details.style.transform = 'none';
    }
  }

  // Helper function to reset day details positioning
  function resetDayDetailsPosition(details) {
    details.style.top = '100%';
    details.style.bottom = 'auto';
    details.style.left = '50%';
    details.style.right = 'auto';
    details.style.transform = 'translateX(-50%)';
    details.style.marginTop = '4px';
    details.style.marginBottom = '0';
  }

  function setupDayClickHandlers() {
    // Set up click handlers for day color items
    document.querySelectorAll('.day-color-item').forEach((dayItem, index) => {
      const dayIndex = parseInt(dayItem.dataset.day);
      const details = qs(`details${dayIndex}`);
      const preview = qs(`preview${dayIndex}`);

      // Click handler for the entire day item
      dayItem.onclick = (e) => {
        // Don't expand/collapse if clicking inside the day-details dropdown
        if (e.target.closest('.day-details')) {
          return;
        }

        // Don't expand if clicking on color input or other controls
        if (
          e.target.tagName === 'INPUT' ||
          e.target.tagName === 'BUTTON' ||
          e.target.classList.contains('color-swatch')
        ) {
          return;
        }

        // Close all other expanded items (including time block pickers)
        document
          .querySelectorAll(
            '.day-color-item, .time-block-color-details, .time-block-global-color-details',
          )
          .forEach((item) => {
            if (item !== dayItem) {
              item.classList.remove('expanded');
              const otherDetails = item.querySelector(
                '.day-details, .time-block-color-details, .time-block-global-color-details',
              );
              if (otherDetails) {
                otherDetails.classList.remove('expanded');
                otherDetails.style.zIndex = '';
              }
            }
          });

        // Toggle current item
        dayItem.classList.toggle('expanded');
        if (details) {
          details.classList.toggle('expanded');
          if (details.classList.contains('expanded')) {
            details.style.zIndex = '999999';
            positionDayDetailsInView(dayItem, details);
          } else {
            details.style.zIndex = '';
            resetDayDetailsPosition(details);
          }
        }
      };

      // Also add click handler specifically for the preview square
      if (preview) {
        preview.onclick = (e) => {
          e.stopPropagation();

          // Close all other expanded items (including time block pickers)
          document
            .querySelectorAll(
              '.day-color-item, .time-block-color-details, .time-block-global-color-details',
            )
            .forEach((item) => {
              if (item !== dayItem) {
                item.classList.remove('expanded');
                const otherDetails = item.querySelector(
                  '.day-details, .time-block-color-details, .time-block-global-color-details',
                );
                if (otherDetails) {
                  otherDetails.classList.remove('expanded');
                  otherDetails.style.zIndex = '';
                }
              }
            });

          // Toggle current item
          dayItem.classList.toggle('expanded');
          if (details) {
            details.classList.toggle('expanded');
            if (details.classList.contains('expanded')) {
              details.style.zIndex = '2147483000';
              positionDayDetailsInView(dayItem, details);
            } else {
              details.style.zIndex = '';
              resetDayDetailsPosition(details);
            }
          }
        };
      }

      // Prevent clicks inside day-details from bubbling up
      if (details) {
        details.onclick = (e) => {
          e.stopPropagation();
        };
      }
    });
  }

  function setupTimeBlockClickHandlers() {
    // Use event delegation for all time block color picker interactions
    document.addEventListener('click', (e) => {
      // Handle time block color preview clicks (both global and individual)
      if (e.target.matches('.time-block-global-color-preview') || e.target.matches('.time-block-color-preview')) {
        e.stopPropagation();

        let details;
        if (e.target.matches('.time-block-global-color-preview')) {
          details = qs('globalTimeBlockDetails');
        } else {
          const colorItem = e.target.closest('.time-block-color-item');
          details = colorItem?.querySelector('.time-block-color-details');
        }

        if (details) {
          // Close all other color pickers (including day pickers)
          document
            .querySelectorAll(
              '.time-block-color-details, .time-block-global-color-details, .day-details',
            )
            .forEach((otherDetails) => {
              if (otherDetails !== details) {
                otherDetails.classList.remove('expanded');
                otherDetails.style.zIndex = '';
                const otherRow = otherDetails.closest('.time-block-item');
                if (otherRow) {
                  otherRow.classList.remove('picker-expanded');
                  otherRow.style.zIndex = '';
                }
              }
            });

          // Toggle current picker
          details.classList.toggle('expanded');

          const scheduleSection = document.querySelector('.time-block-schedule-section');
          const row = details.closest('.time-block-item');

          if (details.classList.contains('expanded')) {
            // Raise the active row and mark schedule as "picker open"
            if (row) {
              row.classList.add('picker-expanded');
              row.style.zIndex = '2147483600';
            }
            if (scheduleSection) scheduleSection.classList.add('tb-picker-open');

            // Ensure the panel itself is on top inside the row
            details.style.zIndex = '2147483000';
          } else {
            // Collapse: restore row and schedule state if no other pickers are open
            details.style.zIndex = '';
            if (row) {
              row.classList.remove('picker-expanded');
              row.style.zIndex = '';
            }
            // If no pickers remain open, drop the global "picker-open" state
            const anyOpen = document.querySelector(
              '.time-block-color-details.expanded, .time-block-global-color-details.expanded',
            );
            if (!anyOpen && scheduleSection) {
              scheduleSection.classList.remove('tb-picker-open');
            }
          }
        }
      }

      // Handle time block color tab switching
      else if (e.target.matches('[data-timeblock][data-tab]')) {
        const blockId = e.target.dataset.timeblock;
        const tabName = e.target.dataset.tab;
        switchTimeBlockColorTab(blockId, tabName);
      }

      // Prevent clicks inside time block details from bubbling up
      else if (e.target.closest('.time-block-color-details, .time-block-global-color-details')) {
        e.stopPropagation();
      }

      // Close color pickers when clicking outside
      else if (
        !e.target.closest(
          '.time-block-color-item, .time-block-global-color-item, .day-color-item',
        )
      ) {
        // Close time block color pickers
        document
          .querySelectorAll('.time-block-color-details.expanded, .time-block-global-color-details.expanded')
          .forEach((details) => {
            details.classList.remove('expanded');
            details.style.zIndex = '';
            const row = details.closest('.time-block-item');
            if (row) {
              row.classList.remove('picker-expanded');
              row.style.zIndex = '';
            }
          });
        const scheduleSection = document.querySelector('.time-block-schedule-section');
        if (scheduleSection) scheduleSection.classList.remove('tb-picker-open');

        // Close day color pickers
        document.querySelectorAll('.day-color-item.expanded').forEach((item) => {
          item.classList.remove('expanded');
        });
        document.querySelectorAll('.day-details.expanded').forEach((details) => {
          details.classList.remove('expanded');
          details.style.zIndex = '';
        });
      }
    });
  }

  // Setup tab navigation
  function setupTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const targetTab = button.getAttribute('data-tab');

        // Remove active class from all buttons and contents
        tabButtons.forEach((btn) => btn.classList.remove('active'));
        tabContents.forEach((content) => content.classList.remove('active'));

        // Add active class to clicked button and corresponding content
        button.classList.add('active');
        const targetContent = document.getElementById(`${targetTab}Content`);
        if (targetContent) {
          targetContent.classList.add('active');
        }
      });
    });
  }

  async function init() {
    // Check auth and subscription first
    await checkAuthAndSubscription();

    await loadSettings();
    await loadCustomColors();
    updateToggle();
    updateTimeBlockingToggle();
    updateColorLabToggle();
    updateColors();
    initializeEnhancedOpacityControls();
    updateTimeBlockingSettings();
    updateColorLab();
    setupEventListeners();
    setupColorLabEventListeners();
    setupDayClickHandlers();
    setupTimeBlockClickHandlers(); // Add time block color picker handlers
    setupTabNavigation(); // Setup tab switching
    // Setup color picker toggle after all other event listeners
    setupColorPickerToggle();

    // Listen for storage changes
    // Store listener reference for cleanup on popup close
    storageChangeListener = (changes, area) => {
      if (area === 'sync' && changes.settings) {
        const oldSettings = changes.settings.oldValue || {};
        const newSettings = changes.settings.newValue || {};
        settings = newSettings;

        updateToggle();
        updateTimeBlockingToggle();

        updateColors();
        initializeEnhancedOpacityControls();
        updateTimeBlockingSettings();
      }
    };

    chrome.storage.onChanged.addListener(storageChangeListener);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Cleanup when popup closes to prevent listener accumulation
  window.addEventListener('unload', () => {
    if (storageChangeListener) {
      chrome.storage.onChanged.removeListener(storageChangeListener);
      storageChangeListener = null;
      debugLog('Popup closed - storage listener removed');
    }
  });

  // Quick Add palette switching - Now handled by the rewritten system above

  // Make functions globally available for HTML onclick handlers
  window.addCustomColor = addCustomColor;
  window.switchToQuickAddPalette = switchToQuickAddPalette;
  window.addFromTab = (tabName) => {
    // Get the currently active day color picker
    const expandedDay = document.querySelector('.day-color-item.expanded');
    if (!expandedDay) return;

    const dayIndex = parseInt(expandedDay.dataset.day);
    const activePanel = expandedDay.querySelector('.color-tab-panel.active');
    if (!activePanel) return;

    // Get the selected color from the active panel
    const selectedSwatch = activePanel.querySelector('.color-swatch.selected');
    if (selectedSwatch) {
      const color = selectedSwatch.title || selectedSwatch.style.backgroundColor;
      if (color && color.startsWith('#')) {
        addColorToLab(color);
      }
    }
  };

  window.addCurrentDayColor = () => {
    // Get the currently active day color picker
    const expandedDay = document.querySelector('.day-color-item.expanded');
    if (!expandedDay) return;

    const dayIndex = parseInt(expandedDay.dataset.day);
    const colorInput = qs(`color${dayIndex}`);
    if (colorInput && colorInput.value) {
      addColorToLab(colorInput.value);
    }
  };

  // Handle template file import
  window.handleTemplateImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        let colors = [];
        const content = e.target.result;

        if (file.name.endsWith('.json')) {
          const jsonData = JSON.parse(content);
          if (Array.isArray(jsonData)) {
            colors = jsonData;
          } else if (jsonData.colors && Array.isArray(jsonData.colors)) {
            colors = jsonData.colors;
          } else if (jsonData.template && Array.isArray(jsonData.template)) {
            colors = jsonData.template;
          }
        } else {
          // Plain text file - extract hex colors
          colors = extractColorsFromText(content);
        }

        if (colors.length === 0) {
          alert('No valid colors found in the file. Please ensure the file contains hex color codes.');
          return;
        }

        await importColorsToLab(colors, file.name);
      } catch (error) {
        console.error('Error importing template:', error);
        alert("Error reading file. Please ensure it's a valid JSON or text file with hex colors.");
      }
    };
    reader.readAsText(file);

    // Reset file input
    event.target.value = '';
  };

  // Import colors from text input
  window.importFromText = async () => {
    const textInput = document.getElementById('templateTextInput');
    if (!textInput.value.trim()) return;

    const colors = extractColorsFromText(textInput.value);
    if (colors.length === 0) {
      alert('No valid hex colors found. Please enter colors in format #RRGGBB or RRGGBB.');
      return;
    }

    await importColorsToLab(colors, 'text input');
    textInput.value = '';
  };

  // Extract colors from text content
  function extractColorsFromText(text) {
    const hexPattern = /#?([0-9A-Fa-f]{6})/g;
    const matches = [];
    let match;

    while ((match = hexPattern.exec(text)) !== null) {
      const color = '#' + match[1].toUpperCase();
      if (!matches.includes(color)) {
        matches.push(color);
      }
    }

    return matches;
  }

  // Import colors to the color lab
  async function importColorsToLab(colors, sourceName) {
    if (confirm(`Add ${colors.length} colors from ${sourceName} to your color lab?`)) {
      let addedCount = 0;
      for (const color of colors) {
        if (!customColors.includes(color.toUpperCase())) {
          await addColorToLab(color);
          addedCount++;
        }
      }

      if (addedCount > 0) {
        alert(`Successfully added ${addedCount} new colors to your color lab!`);
      } else {
        alert('All colors from this template are already in your color lab.');
      }
    }
  }

  // ========================================
  // EVENT COLORING LOGIC
  // ========================================

  let eventColoringSettings = {};

  // Google Calendar's 11 standard event colors - MODERN scheme (with white text)
  // These are the saturated colors shown when user has "Modern" color set selected
  const GOOGLE_COLORS_MODERN = [
    { hex: '#d50000', default: 'Tomato' },
    { hex: '#e67c73', default: 'Flamingo' },
    { hex: '#f4511e', default: 'Tangerine' },
    { hex: '#f6bf26', default: 'Banana' },
    { hex: '#33b679', default: 'Sage' },
    { hex: '#0b8043', default: 'Basil' },
    { hex: '#039be5', default: 'Peacock' },
    { hex: '#3f51b5', default: 'Blueberry' },
    { hex: '#7986cb', default: 'Lavender' },
    { hex: '#8e24aa', default: 'Grape' },
    { hex: '#616161', default: 'Graphite' }
  ];

  // Google Calendar's 11 standard event colors - CLASSIC scheme (with black text)
  // These are the pastel colors shown when user has "Classic" color set selected
  const GOOGLE_COLORS_CLASSIC = [
    { hex: '#dc2127', default: 'Tomato' },
    { hex: '#ff887c', default: 'Flamingo' },
    { hex: '#ffb878', default: 'Tangerine' },
    { hex: '#fbd75b', default: 'Banana' },
    { hex: '#7ae7bf', default: 'Sage' },
    { hex: '#51b749', default: 'Basil' },
    { hex: '#46d6db', default: 'Peacock' },
    { hex: '#5484ed', default: 'Blueberry' },
    { hex: '#a4bdfc', default: 'Lavender' },
    { hex: '#dbadff', default: 'Grape' },
    { hex: '#e1e1e1', default: 'Graphite' }
  ];

  // Bidirectional mapping between Modern and Classic color schemes
  // Maps Modern hex → Classic hex and vice versa
  const GOOGLE_COLOR_SCHEME_MAP = {
    // Modern → Classic
    '#d50000': '#dc2127',  // Tomato
    '#e67c73': '#ff887c',  // Flamingo
    '#f4511e': '#ffb878',  // Tangerine
    '#f6bf26': '#fbd75b',  // Banana
    '#33b679': '#7ae7bf',  // Sage
    '#0b8043': '#51b749',  // Basil
    '#039be5': '#46d6db',  // Peacock
    '#3f51b5': '#5484ed',  // Blueberry
    '#7986cb': '#a4bdfc',  // Lavender
    '#8e24aa': '#dbadff',  // Grape
    '#616161': '#e1e1e1',  // Graphite
    // Classic → Modern
    '#dc2127': '#d50000',  // Tomato
    '#ff887c': '#e67c73',  // Flamingo
    '#ffb878': '#f4511e',  // Tangerine
    '#fbd75b': '#f6bf26',  // Banana
    '#7ae7bf': '#33b679',  // Sage
    '#51b749': '#0b8043',  // Basil
    '#46d6db': '#039be5',  // Peacock
    '#5484ed': '#3f51b5',  // Blueberry
    '#a4bdfc': '#7986cb',  // Lavender
    '#dbadff': '#8e24aa',  // Grape
    '#e1e1e1': '#616161'   // Graphite
  };

  // Helper to check if a color is from Modern scheme
  function isModernColor(hex) {
    return GOOGLE_COLORS_MODERN.some(c => c.hex.toLowerCase() === hex.toLowerCase());
  }

  // Helper to check if a color is from Classic scheme
  function isClassicColor(hex) {
    return GOOGLE_COLORS_CLASSIC.some(c => c.hex.toLowerCase() === hex.toLowerCase());
  }

  // Get the Modern equivalent of any Google color (for consistent storage key)
  function getModernEquivalent(hex) {
    const normalizedHex = hex.toLowerCase();
    if (isModernColor(normalizedHex)) {
      return normalizedHex;
    }
    // If it's a Classic color, map it to Modern
    return GOOGLE_COLOR_SCHEME_MAP[normalizedHex] || normalizedHex;
  }

  // Get the color name for any hex (works for both Modern and Classic)
  function getGoogleColorName(hex) {
    const normalizedHex = hex.toLowerCase();
    // Check Modern colors first
    const modernColor = GOOGLE_COLORS_MODERN.find(c => c.hex.toLowerCase() === normalizedHex);
    if (modernColor) return modernColor.default;
    // Check Classic colors
    const classicColor = GOOGLE_COLORS_CLASSIC.find(c => c.hex.toLowerCase() === normalizedHex);
    if (classicColor) return classicColor.default;
    return null;
  }

  // Default to Modern colors (will be updated based on detected scheme)
  let GOOGLE_COLORS = GOOGLE_COLORS_MODERN;
  let detectedColorScheme = 'modern'; // Will be updated when we detect user's scheme

  // Helper to escape HTML
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Load event coloring settings
  async function loadEventColoringSettings() {
    debugLog('Loading event coloring settings...');
    const settings = await window.cc3Storage.getSettings();
    eventColoringSettings = settings.eventColoring || {};

    // Update toggle
    const toggle = qs('eventColoringToggle');
    if (toggle) {
      if (eventColoringSettings.enabled !== false) {
        toggle.classList.add('active');
      } else {
        toggle.classList.remove('active');
      }
    }

    // Update disable custom colors checkbox
    const disableCheckbox = qs('disableCustomColorsCheckbox');
    if (disableCheckbox) {
      disableCheckbox.checked = eventColoringSettings.disableCustomColors || false;
    }

    // Render categories
    await renderEventColorCategories();

    // Render templates
    await renderEventColorTemplates();

    // Render Google color labels
    await renderGoogleColorLabels();

    // Load event calendar colors (per-calendar defaults)
    await loadEventCalendarColors();

    debugLog('Event coloring settings loaded');
  }

  // Render event color categories
  async function renderEventColorCategories() {
    const container = qs('eventColorCategoriesList');
    if (!container) return;

    const categories = eventColoringSettings.categories || {};
    const categoriesArray = Object.values(categories).sort((a, b) => (a.order || 0) - (b.order || 0));

    if (categoriesArray.length === 0) {
      container.innerHTML = `
        <div style="padding: 24px; text-align: center; color: #64748b; font-size: 13px;">
          No categories yet. Click "New Category" to create one.
        </div>
      `;
      return;
    }

    container.innerHTML = '';

    for (const category of categoriesArray) {
      const categoryEl = await createCategoryElement(category);
      container.appendChild(categoryEl);
    }
  }

  // Create category element
  async function createCategoryElement(category) {
    const div = document.createElement('div');
    div.className = 'event-color-category';
    div.dataset.categoryId = category.id;

    // Get templates assigned to this category
    const assignedTemplates = await window.cc3Storage.getTemplatesForCategory(category.id);

    const colorsHtml = (category.colors || []).map(color => `
      <div
        class="category-color-item"
        style="background-color: ${color.hex};"
        data-color-hex="${color.hex}"
        data-category-id="${category.id}"
      >
        <span class="color-label-tooltip">${escapeHtml(color.label || color.hex)}</span>
        <button class="remove-color-btn">×</button>
      </div>
    `).join('');

    const addColorBtn = `
      <button class="add-color-to-category-btn" data-category-id="${category.id}">+</button>
    `;

    // Build assigned templates HTML - horizontal compact tabs
    const templatesHtml = assignedTemplates.length > 0 ? `
      <div class="category-templates" style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #f0f0f0;">
        <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">
          <span style="font-size: 9px; color: #8b5cf6; text-transform: uppercase; letter-spacing: 0.3px; font-weight: 500; margin-right: 2px;">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align: middle; margin-right: 2px;">
              <rect x="3" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/>
              <rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
          </span>
          ${assignedTemplates.map(t => {
            const bgColor = t.background || '#f0f0f0';
            const textColor = t.text || '#666';
            const borderColor = t.border || 'transparent';
            const borderWidth = t.borderWidth ?? 0;
            return `
            <div class="category-template-tab" data-template-id="${t.id}" style="
              display: inline-flex;
              align-items: center;
              gap: 4px;
              padding: 4px 8px;
              background: ${bgColor};
              color: ${textColor};
              outline: ${borderWidth}px solid ${borderColor};
              outline-offset: -${Math.round(borderWidth * 0.3)}px;
              border-radius: 12px;
              font-size: 11px;
              font-weight: 500;
              max-width: 100px;
              cursor: default;
            ">
              <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(t.name)}</span>
              <button class="unassign-template-btn" data-template-id="${t.id}" title="Remove from category" style="
                background: rgba(0,0,0,0.15);
                border: none;
                cursor: pointer;
                color: inherit;
                width: 14px;
                height: 14px;
                border-radius: 50%;
                line-height: 1;
                font-size: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
              ">×</button>
            </div>
          `}).join('')}
        </div>
      </div>
    ` : '';

    div.innerHTML = `
      <div class="category-header">
        <input
          type="text"
          class="category-name-input"
          value="${escapeHtml(category.name)}"
          data-category-id="${category.id}"
        />
        <div class="category-actions">
          <button class="icon-btn delete-category-btn" data-category-id="${category.id}" title="Delete Category">
            🗑️
          </button>
        </div>
      </div>
      <div class="category-color-grid">
        ${colorsHtml}
        ${addColorBtn}
      </div>
      ${templatesHtml}
    `;

    // Event listeners
    const nameInput = div.querySelector('.category-name-input');
    nameInput.addEventListener('blur', async (e) => {
      await updateCategoryName(category.id, e.target.value);
    });

    const deleteBtn = div.querySelector('.delete-category-btn');
    deleteBtn.addEventListener('click', async () => {
      if (confirm(`Delete category "${category.name}"?`)) {
        await deleteCategory(category.id);
      }
    });

    // Color item remove buttons
    div.querySelectorAll('.category-color-item').forEach(item => {
      const removeBtn = item.querySelector('.remove-color-btn');
      item.addEventListener('mouseenter', () => {
        removeBtn.style.display = 'flex';
      });
      item.addEventListener('mouseleave', () => {
        removeBtn.style.display = 'none';
      });
      removeBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await removeColorFromCategory(category.id, item.dataset.colorHex);
      });
    });

    // Add color button
    const addBtn = div.querySelector('.add-color-to-category-btn');
    addBtn.addEventListener('click', () => {
      openColorPickerForCategory(category.id);
    });

    // Unassign template buttons
    div.querySelectorAll('.unassign-template-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const templateId = btn.dataset.templateId;
        await window.cc3Storage.assignTemplateToCategory(templateId, null);
        await renderEventColorTemplates();
        await renderEventColorCategories();
        notifyContentScriptSettingsChanged();
      });
    });

    return div;
  }

  // Add new category
  async function addNewCategory() {
    const categoryId = `category_${Date.now()}`;
    const categories = eventColoringSettings.categories || {};
    const order = Object.keys(categories).length;

    const newCategory = {
      id: categoryId,
      name: "New Category",
      colors: [],
      order
    };

    await window.cc3Storage.setEventColorCategory(newCategory);
    await loadEventColoringSettings();
    notifyContentScriptSettingsChanged();

    debugLog('New category added:', categoryId);
  }

  // Update category name
  async function updateCategoryName(categoryId, newName) {
    const categories = eventColoringSettings.categories || {};
    if (!categories[categoryId]) return;

    categories[categoryId].name = newName;
    await window.cc3Storage.setEventColorCategory(categories[categoryId]);
    notifyContentScriptSettingsChanged();

    debugLog('Category name updated:', categoryId, newName);
  }

  // Delete category
  async function deleteCategory(categoryId) {
    await window.cc3Storage.deleteEventColorCategory(categoryId);
    await loadEventColoringSettings();
    notifyContentScriptSettingsChanged();

    debugLog('Category deleted:', categoryId);
  }

  // Open color picker modal for category
  function openColorPickerForCategory(categoryId) {
    // State for the selected color
    let selectedColor = '#4285F4';
    let colorLabel = '';

    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'category-color-picker-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10001;
    `;

    const modal = document.createElement('div');
    modal.className = 'category-color-picker-modal';
    modal.style.cssText = `
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      width: 320px;
      max-height: 90vh;
      overflow: hidden;
    `;

    modal.innerHTML = `
      <div class="modal-header" style="padding: 16px; border-bottom: 1px solid #e0e0e0; display: flex; align-items: center; justify-content: space-between;">
        <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #202124;">Add Color to Category</h3>
        <button class="modal-close-btn" style="width: 28px; height: 28px; border: none; background: #f1f3f4; cursor: pointer; font-size: 18px; color: #5f6368; border-radius: 50%; display: flex; align-items: center; justify-content: center;">×</button>
      </div>

      <div class="modal-body" style="padding: 16px;">
        <!-- Color Preview -->
        <div class="form-group" style="margin-bottom: 16px;">
          <label style="display: block; font-size: 11px; font-weight: 500; color: #5f6368; margin-bottom: 6px;">Preview</label>
          <div id="categoryColorPreview" style="
            width: 100%;
            height: 40px;
            border-radius: 8px;
            background: ${selectedColor};
            border: 1px solid #e0e0e0;
          "></div>
        </div>

        <!-- Label Input -->
        <div class="form-group" style="margin-bottom: 16px;">
          <label style="display: block; font-size: 11px; font-weight: 500; color: #5f6368; margin-bottom: 4px;">Label (optional)</label>
          <input type="text" id="categoryColorLabel" placeholder="e.g., Work, Personal..." style="
            width: 100%;
            padding: 8px 10px;
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            font-size: 12px;
            box-sizing: border-box;
          ">
        </div>

        <!-- Color Picker with Tabs -->
        <div class="form-group">
          <label style="display: block; font-size: 11px; font-weight: 500; color: #5f6368; margin-bottom: 6px;">Select Color</label>

          <!-- Direct color input row -->
          <div style="display: flex; gap: 4px; margin-bottom: 8px;">
            <input type="color" class="cat-direct-color" value="${selectedColor}" style="width: 50%; height: 28px; cursor: pointer; border: 1px solid #ccc; border-radius: 4px;">
            <input type="text" class="cat-hex-input" value="${selectedColor}" placeholder="#FF0000" maxlength="7" style="width: 50%; height: 28px; font-size: 10px; padding: 2px 6px; border: 1px solid #ccc; border-radius: 4px; text-transform: uppercase; font-family: monospace; box-sizing: border-box;">
          </div>

          <!-- Tabs -->
          <div class="color-picker-tabs" style="display: flex; background: #f8f9fa; border-radius: 6px 6px 0 0; border: 1px solid #e8eaed; border-bottom: none;">
            <button type="button" class="cat-color-tab active" data-tab="vibrant" style="flex: 1; padding: 8px 6px; font-size: 10px; font-weight: 500; text-align: center; background: white; border: none; cursor: pointer; color: #1a73e8; border-bottom: 2px solid #1a73e8; border-radius: 6px 0 0 0;">Vibrant</button>
            <button type="button" class="cat-color-tab" data-tab="pastel" style="flex: 1; padding: 8px 6px; font-size: 10px; font-weight: 500; text-align: center; background: #f8f9fa; border: none; cursor: pointer; color: #666; border-bottom: 2px solid transparent;">Pastel</button>
            <button type="button" class="cat-color-tab" data-tab="dark" style="flex: 1; padding: 8px 6px; font-size: 10px; font-weight: 500; text-align: center; background: #f8f9fa; border: none; cursor: pointer; color: #666; border-bottom: 2px solid transparent;">Dark</button>
            <button type="button" class="cat-color-tab" data-tab="custom" style="flex: 1; padding: 8px 6px; font-size: 10px; font-weight: 500; text-align: center; background: #f8f9fa; border: none; cursor: pointer; color: #666; border-bottom: 2px solid transparent; border-radius: 0 6px 0 0;">Custom</button>
          </div>

          <!-- Tab Panels -->
          <div style="border: 1px solid #e8eaed; border-top: none; border-radius: 0 0 6px 6px; padding: 8px;">
            <div class="cat-tab-panel active" data-panel="vibrant">
              <div class="cat-palette vibrant-palette" style="display: grid; grid-template-columns: repeat(9, 1fr); gap: 4px;"></div>
            </div>
            <div class="cat-tab-panel" data-panel="pastel" style="display: none;">
              <div class="cat-palette pastel-palette" style="display: grid; grid-template-columns: repeat(9, 1fr); gap: 4px;"></div>
            </div>
            <div class="cat-tab-panel" data-panel="dark" style="display: none;">
              <div class="cat-palette dark-palette" style="display: grid; grid-template-columns: repeat(9, 1fr); gap: 4px;"></div>
            </div>
            <div class="cat-tab-panel" data-panel="custom" style="display: none;">
              <div class="cat-palette custom-palette" style="display: grid; grid-template-columns: repeat(9, 1fr); gap: 4px;"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer" style="padding: 12px 16px; border-top: 1px solid #e0e0e0; display: flex; justify-content: flex-end; gap: 10px;">
        <button class="modal-cancel-btn" style="padding: 8px 16px; border: 1px solid #e0e0e0; background: #fff; border-radius: 6px; font-size: 12px; cursor: pointer; color: #5f6368;">
          Cancel
        </button>
        <button class="modal-add-btn" style="padding: 8px 16px; border: none; background: linear-gradient(135deg, #34a853 0%, #1e8e3e 100%); color: #fff; border-radius: 6px; font-size: 12px; cursor: pointer; font-weight: 500;">
          Add Color
        </button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Get elements
    const preview = modal.querySelector('#categoryColorPreview');
    const labelInput = modal.querySelector('#categoryColorLabel');
    const directColorInput = modal.querySelector('.cat-direct-color');
    const hexInput = modal.querySelector('.cat-hex-input');

    // Update preview function
    function updatePreview(color) {
      selectedColor = color.toUpperCase();
      preview.style.background = selectedColor;
      directColorInput.value = selectedColor;
      hexInput.value = selectedColor;
    }

    // Create color swatch
    function createSwatch(color, container) {
      const swatch = document.createElement('div');
      swatch.style.cssText = `
        width: 18px;
        height: 18px;
        border-radius: 3px;
        background: ${color};
        border: 1px solid #e0e0e0;
        cursor: pointer;
        transition: all 0.15s;
      `;
      swatch.title = color;
      swatch.dataset.color = color;
      swatch.addEventListener('mouseenter', () => {
        swatch.style.transform = 'scale(1.15)';
        swatch.style.borderColor = '#1a73e8';
      });
      swatch.addEventListener('mouseleave', () => {
        swatch.style.transform = 'scale(1)';
        swatch.style.borderColor = '#e0e0e0';
      });
      swatch.addEventListener('click', () => {
        updatePreview(color);
      });
      container.appendChild(swatch);
    }

    // Populate palettes
    const vibrantPaletteEl = modal.querySelector('.vibrant-palette');
    const pastelPaletteEl = modal.querySelector('.pastel-palette');
    const darkPaletteEl = modal.querySelector('.dark-palette');
    const customPaletteEl = modal.querySelector('.custom-palette');

    colorPickerPalette.forEach(color => createSwatch(color, vibrantPaletteEl));
    pastelPalette.forEach(color => createSwatch(color, pastelPaletteEl));
    darkPalette.forEach(color => createSwatch(color, darkPaletteEl));
    customColors.forEach(color => createSwatch(color, customPaletteEl));

    if (customColors.length === 0) {
      customPaletteEl.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #999; font-size: 11px; padding: 8px;">No custom colors saved yet</div>';
    }

    // Tab switching
    modal.querySelectorAll('.cat-color-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        // Update tab styles
        modal.querySelectorAll('.cat-color-tab').forEach(t => {
          t.classList.remove('active');
          t.style.background = '#f8f9fa';
          t.style.color = '#666';
          t.style.borderBottom = '2px solid transparent';
        });
        tab.classList.add('active');
        tab.style.background = 'white';
        tab.style.color = '#1a73e8';
        tab.style.borderBottom = '2px solid #1a73e8';

        // Show corresponding panel
        const panelName = tab.dataset.tab;
        modal.querySelectorAll('.cat-tab-panel').forEach(panel => {
          panel.style.display = panel.dataset.panel === panelName ? 'block' : 'none';
        });
      });
    });

    // Direct color input handler
    directColorInput.addEventListener('input', (e) => {
      updatePreview(e.target.value);
    });

    // Hex input handler
    hexInput.addEventListener('input', (e) => {
      let value = e.target.value.toUpperCase();
      if (!value.startsWith('#')) {
        value = '#' + value;
      }
      if (/^#[0-9A-F]{6}$/i.test(value)) {
        updatePreview(value);
      }
    });

    // Close handlers
    const closeModal = () => {
      document.body.removeChild(overlay);
    };

    modal.querySelector('.modal-close-btn').addEventListener('click', closeModal);
    modal.querySelector('.modal-cancel-btn').addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    // Add color handler
    modal.querySelector('.modal-add-btn').addEventListener('click', async () => {
      colorLabel = labelInput.value.trim();
      await addColorToCategory(categoryId, selectedColor, colorLabel);
      closeModal();
    });

    // Focus label input
    setTimeout(() => labelInput.focus(), 100);
  }

  // Add color to category
  async function addColorToCategory(categoryId, colorHex, label = '') {
    const categories = eventColoringSettings.categories || {};
    if (!categories[categoryId]) return;

    categories[categoryId].colors.push({ hex: colorHex, label });
    await window.cc3Storage.setEventColorCategory(categories[categoryId]);
    await loadEventColoringSettings();
    notifyContentScriptSettingsChanged();

    debugLog('Color added to category:', categoryId, colorHex);
  }

  // Remove color from category
  async function removeColorFromCategory(categoryId, colorHex) {
    const categories = eventColoringSettings.categories || {};
    if (!categories[categoryId]) return;

    categories[categoryId].colors = categories[categoryId].colors.filter(
      c => c.hex !== colorHex
    );
    await window.cc3Storage.setEventColorCategory(categories[categoryId]);
    await loadEventColoringSettings();
    notifyContentScriptSettingsChanged();

    debugLog('Color removed from category:', categoryId, colorHex);
  }

  // Render Google color labels
  // Uses the selected color scheme (Modern or Classic) to display swatches
  // Labels are stored using Modern hex as the key for consistency
  async function renderGoogleColorLabels() {
    const container = qs('googleColorLabelsList');
    if (!container) return;

    const customLabels = eventColoringSettings.googleColorLabels || {};

    // Get the selected color scheme
    const schemeSelect = qs('googleColorSchemeSelect');
    const selectedScheme = eventColoringSettings.googleColorScheme || 'modern';

    // Set the dropdown value
    if (schemeSelect) {
      schemeSelect.value = selectedScheme;
    }

    // Choose color array based on scheme
    const colors = selectedScheme === 'classic' ? GOOGLE_COLORS_CLASSIC : GOOGLE_COLORS_MODERN;

    container.innerHTML = '';

    for (let i = 0; i < colors.length; i++) {
      const color = colors[i];
      const modernColor = GOOGLE_COLORS_MODERN[i];

      // Always use Modern hex as the storage key for consistency
      const storageKey = modernColor.hex.toLowerCase();
      const customLabel = customLabels[storageKey] || color.default;

      const itemDiv = document.createElement('div');
      itemDiv.className = 'google-color-item';
      itemDiv.innerHTML = `
        <div
          class="google-color-preview"
          style="background-color: ${color.hex};"
          title="${color.default}: ${color.hex}"
        ></div>
        <input
          type="text"
          class="google-color-label-input"
          value="${escapeHtml(customLabel)}"
          data-color="${storageKey}"
          placeholder="${color.default}"
        />
      `;

      const input = itemDiv.querySelector('.google-color-label-input');
      input.addEventListener('blur', async (e) => {
        // Always store using Modern hex as key
        await updateGoogleColorLabel(storageKey, e.target.value);
      });

      container.appendChild(itemDiv);
    }

    debugLog('Google color labels rendered (scheme:', selectedScheme, ')');
  }

  // Handle color scheme change
  async function handleColorSchemeChange(scheme) {
    eventColoringSettings.googleColorScheme = scheme;
    await window.cc3Storage.setGoogleColorScheme(scheme);
    await renderGoogleColorLabels();
    debugLog('Color scheme changed to:', scheme);
  }

  // Update Google color label
  // Stores labels for BOTH Modern and Classic hex keys so lookup works regardless of user's scheme
  async function updateGoogleColorLabel(colorHex, label) {
    // FIX #5: Ensure hex is always lowercase for consistency
    const normalizedHex = colorHex.toLowerCase();

    // Store the label for the Modern hex (canonical key)
    await window.cc3Storage.setGoogleColorLabel(normalizedHex, label);

    // Also store for the Classic equivalent so it works for Classic scheme users
    const classicEquivalent = GOOGLE_COLOR_SCHEME_MAP[normalizedHex];
    if (classicEquivalent) {
      await window.cc3Storage.setGoogleColorLabel(classicEquivalent.toLowerCase(), label);
    }

    debugLog('Google color label updated:', normalizedHex, label, '(+ Classic:', classicEquivalent, ')');

    // FIX #6a: CRITICAL - Notify content script that labels changed
    // Without this, content script keeps using cached settings with old labels
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'EVENT_COLORING_SETTINGS_CHANGED'
        }).catch(() => {
          // Ignore errors if tab is not a calendar tab
        });
      }
    });
  }

  // ========================================
  // EVENT COLOR TEMPLATES
  // Multi-property color presets (bg/text/border/borderWidth)
  // ========================================

  // Render event color templates (shows ALL templates - assigned ones also appear as references in categories)
  async function renderEventColorTemplates() {
    const container = qs('eventColorTemplatesList');
    if (!container) return;

    // Get ALL templates (not just unassigned)
    const allTemplates = await window.cc3Storage.getEventColorTemplates();
    const templates = Object.values(allTemplates).sort((a, b) => (a.order || 0) - (b.order || 0));

    if (templates.length === 0) {
      container.innerHTML = `
        <div style="padding: 20px; text-align: center; color: #64748b; font-size: 13px; background: #faf5ff; border-radius: 8px; border: 1px dashed #e9d5ff;">
          <div style="margin-bottom: 8px;">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="1.5">
              <rect x="3" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/>
              <rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
          </div>
          <div style="font-weight: 500; margin-bottom: 4px;">No templates yet</div>
          <div style="font-size: 11px;">Click "New Template" to create your first color preset</div>
        </div>
      `;
      return;
    }

    container.innerHTML = '';

    // Create sortable container for drag-and-drop
    const sortableContainer = document.createElement('div');
    sortableContainer.className = 'templates-sortable-container';
    sortableContainer.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';

    for (const template of templates) {
      const templateEl = createTemplateElement(template);
      sortableContainer.appendChild(templateEl);
    }

    container.appendChild(sortableContainer);

    // Initialize drag-and-drop for templates
    initTemplatesDragDrop(sortableContainer);
  }

  // Create template element
  function createTemplateElement(template) {
    const div = document.createElement('div');
    div.className = 'event-color-template';
    div.dataset.templateId = template.id;
    div.draggable = true;

    div.style.cssText = `
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 12px;
      cursor: grab;
      transition: box-shadow 0.2s, border-color 0.2s;
    `;

    // Get categories for the dropdown
    const categories = eventColoringSettings.categories || {};
    const categoriesArray = Object.values(categories).sort((a, b) => (a.order || 0) - (b.order || 0));
    const categoryOptions = categoriesArray.map(cat =>
      `<option value="${cat.id}" ${cat.id === template.categoryId ? 'selected' : ''}>${escapeHtml(cat.name)}</option>`
    ).join('');

    div.innerHTML = `
      <div class="template-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
        <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
          <div class="drag-handle" style="cursor: grab; color: #9ca3af; display: flex; align-items: center;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="9" cy="6" r="1.5"/>
              <circle cx="15" cy="6" r="1.5"/>
              <circle cx="9" cy="12" r="1.5"/>
              <circle cx="15" cy="12" r="1.5"/>
              <circle cx="9" cy="18" r="1.5"/>
              <circle cx="15" cy="18" r="1.5"/>
            </svg>
          </div>
          <input
            type="text"
            class="template-name-input"
            value="${escapeHtml(template.name)}"
            data-template-id="${template.id}"
            style="border: none; background: transparent; font-weight: 500; font-size: 13px; color: #202124; flex: 1; padding: 4px 0; min-width: 0;"
          />
        </div>
        <div class="template-actions" style="display: flex; gap: 4px;">
          <button class="edit-template-btn" data-template-id="${template.id}" title="Edit Template" style="padding: 4px; border: none; background: none; cursor: pointer; color: #5f6368; border-radius: 4px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="delete-template-btn" data-template-id="${template.id}" title="Delete Template" style="padding: 4px; border: none; background: none; cursor: pointer; color: #5f6368; border-radius: 4px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Mini Preview -->
      <div class="template-mini-preview" style="
        padding: 8px 12px;
        border-radius: 4px;
        background: ${template.background};
        color: ${template.text};
        outline: ${template.borderWidth}px solid ${template.border};
        outline-offset: -${Math.round(template.borderWidth * 0.3)}px;
        font-size: 12px;
        font-weight: 500;
        margin-bottom: 10px;
      ">
        ${escapeHtml(template.name || 'Sample Event')}
      </div>

      <!-- Color swatches row -->
      <div class="template-color-preview" style="display: flex; gap: 6px; align-items: center; margin-bottom: 10px;">
        <div title="Background: ${template.background}" style="width: 18px; height: 18px; border-radius: 4px; background: ${template.background}; border: 1px solid rgba(0,0,0,0.1);"></div>
        <div title="Text: ${template.text}" style="width: 18px; height: 18px; border-radius: 4px; background: ${template.text}; border: 1px solid rgba(0,0,0,0.1);"></div>
        <div title="Border: ${template.border}" style="width: 18px; height: 18px; border-radius: 4px; background: ${template.border}; border: 1px solid rgba(0,0,0,0.1);"></div>
        <div title="Border Width" style="font-size: 10px; color: #666; padding: 2px 6px; background: #f0f0f0; border-radius: 4px;">${template.borderWidth}px</div>
      </div>

      <!-- Category Assignment -->
      <div class="template-category-assign" style="padding-top: 8px; border-top: 1px solid #f0f0f0;">
        <label style="font-size: 11px; color: #666; display: flex; align-items: center; gap: 6px;">
          <span>Category:</span>
          <select class="template-category-select" data-template-id="${template.id}" style="font-size: 11px; padding: 4px 8px; border: 1px solid #e0e0e0; border-radius: 4px; background: #fff; flex: 1; min-width: 0;">
            <option value="">— None —</option>
            ${categoryOptions}
          </select>
        </label>
      </div>
    `;

    // Hover effects
    div.addEventListener('mouseenter', () => {
      div.style.borderColor = '#8b5cf6';
      div.style.boxShadow = '0 2px 8px rgba(139, 92, 246, 0.15)';
    });
    div.addEventListener('mouseleave', () => {
      div.style.borderColor = '#e0e0e0';
      div.style.boxShadow = 'none';
    });

    // Event listeners
    setupTemplateEventListeners(div, template);

    return div;
  }

  // Setup event listeners for template element
  function setupTemplateEventListeners(element, template) {
    // Name input blur - save name
    const nameInput = element.querySelector('.template-name-input');
    nameInput.addEventListener('blur', async (e) => {
      const newName = e.target.value.trim();
      if (newName && newName !== template.name) {
        template.name = newName;
        await window.cc3Storage.setEventColorTemplate(template);
        // Update the mini preview text too
        const miniPreview = element.querySelector('.template-mini-preview');
        if (miniPreview) {
          miniPreview.textContent = newName;
        }
      }
    });
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.target.blur();
      }
    });

    // Edit button - open editor modal
    const editBtn = element.querySelector('.edit-template-btn');
    editBtn.addEventListener('click', () => {
      openTemplateEditorModal(template);
    });

    // Delete button
    const deleteBtn = element.querySelector('.delete-template-btn');
    deleteBtn.addEventListener('click', async () => {
      if (confirm(`Delete template "${template.name}"?`)) {
        await window.cc3Storage.deleteEventColorTemplate(template.id);
        await renderEventColorTemplates();
        await renderEventColorCategories(); // Refresh categories in case template was assigned
        notifyContentScriptSettingsChanged();
      }
    });

    // Category assignment dropdown
    const categorySelect = element.querySelector('.template-category-select');
    categorySelect.addEventListener('change', async (e) => {
      const categoryId = e.target.value || null;
      await window.cc3Storage.assignTemplateToCategory(template.id, categoryId);
      await renderEventColorTemplates();
      await renderEventColorCategories();
      notifyContentScriptSettingsChanged();
    });
  }

  // Initialize drag-and-drop for templates
  function initTemplatesDragDrop(container) {
    let draggedItem = null;

    container.addEventListener('dragstart', (e) => {
      const templateEl = e.target.closest('.event-color-template');
      if (templateEl) {
        draggedItem = templateEl;
        templateEl.style.opacity = '0.5';
        e.dataTransfer.effectAllowed = 'move';
      }
    });

    container.addEventListener('dragend', (e) => {
      const templateEl = e.target.closest('.event-color-template');
      if (templateEl) {
        templateEl.style.opacity = '1';
        draggedItem = null;
        // Save new order
        saveTemplatesOrder(container);
      }
    });

    container.addEventListener('dragover', (e) => {
      e.preventDefault();
      const target = e.target.closest('.event-color-template');
      if (target && target !== draggedItem && draggedItem) {
        const rect = target.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;

        if (e.clientY < midY) {
          target.parentNode.insertBefore(draggedItem, target);
        } else {
          target.parentNode.insertBefore(draggedItem, target.nextSibling);
        }
      }
    });
  }

  // Save templates order after drag
  async function saveTemplatesOrder(container) {
    const templateElements = container.querySelectorAll('.event-color-template');
    const orderUpdates = [];

    templateElements.forEach((el, index) => {
      orderUpdates.push({
        id: el.dataset.templateId,
        order: index
      });
    });

    await window.cc3Storage.reorderEventColorTemplates(orderUpdates);
    notifyContentScriptSettingsChanged();
  }

  // Add new template (opens editor modal with empty template)
  function addNewTemplate() {
    openTemplateEditorModal(null);
  }

  // Open template editor modal with swatch-based color pickers
  function openTemplateEditorModal(existingTemplate = null) {
    const isEdit = !!existingTemplate;

    // Current template state - start with null/empty values for new templates
    // This allows partial templates (e.g., only setting border color)
    const templateState = existingTemplate ? { ...existingTemplate } : {
      id: null,
      name: '',
      background: null,
      text: null,
      border: null,
      borderWidth: null,
      categoryId: null
    };

    // Helper to get display color (for preview/swatches when value is null)
    const getDisplayColor = (type) => {
      if (templateState[type]) return templateState[type];
      // Return placeholder colors for preview
      switch(type) {
        case 'background': return '#e8eaed';
        case 'text': return '#5f6368';
        case 'border': return '#dadce0';
        default: return '#e8eaed';
      }
    };

    // Check if a color is set (not null)
    const isColorSet = (type) => templateState[type] !== null;

    // Track which color property is currently being edited
    let activeColorType = null;

    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'template-editor-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

    // Get categories for dropdown
    const categories = eventColoringSettings.categories || {};
    const categoriesArray = Object.values(categories).sort((a, b) => (a.order || 0) - (b.order || 0));
    const categoryOptions = categoriesArray.map(cat =>
      `<option value="${cat.id}" ${cat.id === templateState.categoryId ? 'selected' : ''}>${escapeHtml(cat.name)}</option>`
    ).join('');

    // Create modal
    const modal = document.createElement('div');
    modal.className = 'template-editor-modal';
    modal.style.cssText = `
      background: #fff;
      border-radius: 12px;
      width: 360px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    `;

    modal.innerHTML = `
      <div class="modal-header" style="padding: 14px 16px; border-bottom: 1px solid #e0e0e0; display: flex; justify-content: space-between; align-items: center;">
        <h3 style="margin: 0; font-size: 15px; font-weight: 600; color: #202124;">
          ${isEdit ? 'Edit Template' : 'Create New Template'}
        </h3>
        <button class="modal-close-btn" style="background: none; border: none; cursor: pointer; padding: 4px; color: #5f6368; line-height: 1;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="modal-body" style="padding: 16px;">
        <!-- Template Name -->
        <div class="form-group" style="margin-bottom: 16px;">
          <label style="display: block; font-size: 11px; font-weight: 500; color: #5f6368; margin-bottom: 4px;">Template Name</label>
          <input type="text" id="templateNameInput" value="${escapeHtml(templateState.name)}" placeholder="e.g., Professional Meeting" style="width: 100%; padding: 8px 10px; border: 1px solid #e0e0e0; border-radius: 6px; font-size: 13px; box-sizing: border-box;">
        </div>

        <!-- Live Preview -->
        <div class="form-group" style="margin-bottom: 16px;">
          <label style="display: block; font-size: 11px; font-weight: 500; color: #5f6368; margin-bottom: 4px;">Preview <span style="font-weight: 400; color: #999;">(gray = unchanged)</span></label>
          <div id="templateLivePreview" style="
            padding: 10px 14px;
            border-radius: 6px;
            background: ${templateState.background || '#e8eaed'};
            color: ${templateState.text || '#5f6368'};
            outline: ${templateState.borderWidth ?? 0}px solid ${templateState.border || '#dadce0'};
            outline-offset: -${Math.round((templateState.borderWidth ?? 0) * 0.3)}px;
            font-size: 12px;
            font-weight: 500;
          ">
            <div class="preview-title" style="font-weight: 600;">${escapeHtml(templateState.name) || 'Sample Event Title'}</div>
            <div style="font-size: 11px; opacity: 0.9; margin-top: 2px;">10:00 AM - 11:00 AM</div>
          </div>
        </div>

        <!-- Color Swatches Row -->
        <div class="form-group" style="margin-bottom: 16px;">
          <label style="display: block; font-size: 11px; font-weight: 500; color: #5f6368; margin-bottom: 8px;">Colors <span style="font-weight: 400; color: #999;">(click to set, empty = no change)</span></label>
          <div style="display: flex; gap: 12px; align-items: center;">
            <!-- Background Swatch -->
            <div style="text-align: center;">
              <div class="template-color-swatch" data-type="background" style="
                width: 36px;
                height: 36px;
                border-radius: 6px;
                background: ${templateState.background || 'repeating-linear-gradient(-45deg, #f0f0f0, #f0f0f0 4px, #fff 4px, #fff 8px)'};
                border: 2px ${templateState.background ? 'solid' : 'dashed'} #e0e0e0;
                cursor: pointer;
                transition: all 0.15s;
                position: relative;
              " title="Background Color${templateState.background ? '' : ' (not set)'}"></div>
              <div style="font-size: 9px; color: #666; margin-top: 4px;">BG</div>
            </div>
            <!-- Text Swatch -->
            <div style="text-align: center;">
              <div class="template-color-swatch" data-type="text" style="
                width: 36px;
                height: 36px;
                border-radius: 6px;
                background: ${templateState.text || 'repeating-linear-gradient(-45deg, #f0f0f0, #f0f0f0 4px, #fff 4px, #fff 8px)'};
                border: 2px ${templateState.text ? 'solid' : 'dashed'} #e0e0e0;
                cursor: pointer;
                transition: all 0.15s;
              " title="Text Color${templateState.text ? '' : ' (not set)'}"></div>
              <div style="font-size: 9px; color: #666; margin-top: 4px;">Text</div>
            </div>
            <!-- Border Swatch -->
            <div style="text-align: center;">
              <div class="template-color-swatch" data-type="border" style="
                width: 36px;
                height: 36px;
                border-radius: 6px;
                background: ${templateState.border || 'repeating-linear-gradient(-45deg, #f0f0f0, #f0f0f0 4px, #fff 4px, #fff 8px)'};
                border: 2px ${templateState.border ? 'solid' : 'dashed'} #e0e0e0;
                cursor: pointer;
                transition: all 0.15s;
              " title="Border Color${templateState.border ? '' : ' (not set)'}"></div>
              <div style="font-size: 9px; color: #666; margin-top: 4px;">Border</div>
            </div>
          </div>
        </div>

        <!-- Color Picker Panel (hidden by default) -->
        <div id="templateColorPickerPanel" style="display: none; margin-bottom: 16px; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
          <div class="template-picker-header" style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: #f8f9fa; border-bottom: 1px solid #e0e0e0;">
            <span id="templatePickerLabel" style="font-size: 12px; font-weight: 500; color: #202124;">Select Color</span>
            <button class="template-picker-close" type="button" style="width: 20px; height: 20px; border: none; background: #e8eaed; cursor: pointer; font-size: 14px; color: #5f6368; border-radius: 4px; display: flex; align-items: center; justify-content: center;">×</button>
          </div>
          <div class="color-picker-tabs" style="display: flex; background: #f8f9fa; border-bottom: 1px solid #e8eaed;">
            <button type="button" class="tmpl-color-tab active" data-tab="vibrant" style="flex: 1; padding: 8px 6px; font-size: 10px; font-weight: 500; text-align: center; background: white; border: none; cursor: pointer; color: #1a73e8; border-bottom: 2px solid #1a73e8;">Vibrant</button>
            <button type="button" class="tmpl-color-tab" data-tab="pastel" style="flex: 1; padding: 8px 6px; font-size: 10px; font-weight: 500; text-align: center; background: #f8f9fa; border: none; cursor: pointer; color: #666; border-bottom: 2px solid transparent;">Pastel</button>
            <button type="button" class="tmpl-color-tab" data-tab="dark" style="flex: 1; padding: 8px 6px; font-size: 10px; font-weight: 500; text-align: center; background: #f8f9fa; border: none; cursor: pointer; color: #666; border-bottom: 2px solid transparent;">Dark</button>
            <button type="button" class="tmpl-color-tab" data-tab="custom" style="flex: 1; padding: 8px 6px; font-size: 10px; font-weight: 500; text-align: center; background: #f8f9fa; border: none; cursor: pointer; color: #666; border-bottom: 2px solid transparent;">Custom</button>
          </div>
          <div style="padding: 12px;">
            <div style="display: flex; gap: 4px; margin-bottom: 8px;">
              <input type="color" class="tmpl-direct-color" value="#4285f4" style="width: 50%; height: 28px; cursor: pointer; border: 1px solid #ccc; border-radius: 4px;">
              <input type="text" class="tmpl-hex-input" value="#4285F4" placeholder="#FF0000" maxlength="7" style="width: 50%; height: 24px; font-size: 10px; padding: 2px 6px; border: 1px solid #ccc; border-radius: 4px; text-transform: uppercase; font-family: monospace;">
            </div>
            <div class="tmpl-tab-panel active" data-panel="vibrant">
              <div class="tmpl-palette vibrant-palette" style="display: grid; grid-template-columns: repeat(9, 1fr); gap: 4px; padding: 8px; background: #f8f9fa; border-radius: 6px; border: 1px solid #e8eaed; max-height: 100px; overflow-y: auto;"></div>
            </div>
            <div class="tmpl-tab-panel" data-panel="pastel" style="display: none;">
              <div class="tmpl-palette pastel-palette" style="display: grid; grid-template-columns: repeat(9, 1fr); gap: 4px; padding: 8px; background: #f8f9fa; border-radius: 6px; border: 1px solid #e8eaed; max-height: 100px; overflow-y: auto;"></div>
            </div>
            <div class="tmpl-tab-panel" data-panel="dark" style="display: none;">
              <div class="tmpl-palette dark-palette" style="display: grid; grid-template-columns: repeat(9, 1fr); gap: 4px; padding: 8px; background: #f8f9fa; border-radius: 6px; border: 1px solid #e8eaed; max-height: 100px; overflow-y: auto;"></div>
            </div>
            <div class="tmpl-tab-panel" data-panel="custom" style="display: none;">
              <div class="tmpl-palette custom-palette" style="display: grid; grid-template-columns: repeat(9, 1fr); gap: 4px; padding: 8px; background: #f8f9fa; border-radius: 6px; border: 1px solid #e8eaed; max-height: 100px; overflow-y: auto;"></div>
            </div>
          </div>
        </div>

        <!-- Border Width -->
        <div class="form-group" style="margin-bottom: 16px;">
          <label style="display: block; font-size: 11px; font-weight: 500; color: #5f6368; margin-bottom: 6px;">Border Width <span style="font-weight: 400; color: #999;">(None = no change)</span></label>
          <div class="template-thickness-buttons" style="display: flex; gap: 4px; flex-wrap: wrap;">
            <button type="button" class="tmpl-thickness-btn${templateState.borderWidth === null ? ' active' : ''}" data-width="none" style="padding: 6px 10px; background: ${templateState.borderWidth === null ? '#fef3c7' : '#fff'}; color: ${templateState.borderWidth === null ? '#d97706' : '#5f6368'}; border: 1px ${templateState.borderWidth === null ? 'solid #d97706' : 'dashed #dadce0'}; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 500;">None</button>
            <button type="button" class="tmpl-thickness-btn${templateState.borderWidth === 0 ? ' active' : ''}" data-width="0" style="padding: 6px 10px; background: ${templateState.borderWidth === 0 ? '#e8f0fe' : '#fff'}; color: ${templateState.borderWidth === 0 ? '#1a73e8' : '#5f6368'}; border: 1px solid ${templateState.borderWidth === 0 ? '#1a73e8' : '#dadce0'}; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 500;">0px</button>
            <button type="button" class="tmpl-thickness-btn${templateState.borderWidth === 1 ? ' active' : ''}" data-width="1" style="padding: 6px 10px; background: ${templateState.borderWidth === 1 ? '#e8f0fe' : '#fff'}; color: ${templateState.borderWidth === 1 ? '#1a73e8' : '#5f6368'}; border: 1px solid ${templateState.borderWidth === 1 ? '#1a73e8' : '#dadce0'}; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 500;">1px</button>
            <button type="button" class="tmpl-thickness-btn${templateState.borderWidth === 2 ? ' active' : ''}" data-width="2" style="padding: 6px 10px; background: ${templateState.borderWidth === 2 ? '#e8f0fe' : '#fff'}; color: ${templateState.borderWidth === 2 ? '#1a73e8' : '#5f6368'}; border: 1px solid ${templateState.borderWidth === 2 ? '#1a73e8' : '#dadce0'}; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 500;">2px</button>
            <button type="button" class="tmpl-thickness-btn${templateState.borderWidth === 3 ? ' active' : ''}" data-width="3" style="padding: 6px 10px; background: ${templateState.borderWidth === 3 ? '#e8f0fe' : '#fff'}; color: ${templateState.borderWidth === 3 ? '#1a73e8' : '#5f6368'}; border: 1px solid ${templateState.borderWidth === 3 ? '#1a73e8' : '#dadce0'}; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 500;">3px</button>
            <button type="button" class="tmpl-thickness-btn${templateState.borderWidth === 4 ? ' active' : ''}" data-width="4" style="padding: 6px 10px; background: ${templateState.borderWidth === 4 ? '#e8f0fe' : '#fff'}; color: ${templateState.borderWidth === 4 ? '#1a73e8' : '#5f6368'}; border: 1px solid ${templateState.borderWidth === 4 ? '#1a73e8' : '#dadce0'}; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 500;">4px</button>
            <button type="button" class="tmpl-thickness-btn${templateState.borderWidth === 5 ? ' active' : ''}" data-width="5" style="padding: 6px 10px; background: ${templateState.borderWidth === 5 ? '#e8f0fe' : '#fff'}; color: ${templateState.borderWidth === 5 ? '#1a73e8' : '#5f6368'}; border: 1px solid ${templateState.borderWidth === 5 ? '#1a73e8' : '#dadce0'}; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 500;">5px</button>
          </div>
        </div>

        <!-- Category Assignment -->
        <div class="form-group" style="margin-bottom: 16px;">
          <label style="display: block; font-size: 11px; font-weight: 500; color: #5f6368; margin-bottom: 4px;">Assign to Category (optional)</label>
          <select id="templateCategorySelect" style="width: 100%; padding: 8px 10px; border: 1px solid #e0e0e0; border-radius: 6px; font-size: 12px; background: #fff;">
            <option value="">— None (show in Templates section) —</option>
            ${categoryOptions}
          </select>
        </div>
      </div>

      <div class="modal-footer" style="padding: 12px 16px; border-top: 1px solid #e0e0e0; display: flex; justify-content: flex-end; gap: 10px;">
        <button class="modal-cancel-btn" style="padding: 8px 16px; border: 1px solid #e0e0e0; background: #fff; border-radius: 6px; font-size: 12px; cursor: pointer; color: #5f6368;">
          Cancel
        </button>
        <button class="modal-save-btn" style="padding: 8px 16px; border: none; background: linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%); color: #fff; border-radius: 6px; font-size: 12px; cursor: pointer; font-weight: 500;">
          ${isEdit ? 'Save Changes' : 'Create Template'}
        </button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Get elements
    const preview = modal.querySelector('#templateLivePreview');
    const previewTitle = preview.querySelector('.preview-title');
    const nameInput = modal.querySelector('#templateNameInput');
    const colorPickerPanel = modal.querySelector('#templateColorPickerPanel');
    const pickerLabel = modal.querySelector('#templatePickerLabel');
    const directColorInput = modal.querySelector('.tmpl-direct-color');
    const hexInput = modal.querySelector('.tmpl-hex-input');
    const categorySelect = modal.querySelector('#templateCategorySelect');

    // Update preview function
    function updatePreview() {
      preview.style.background = templateState.background || '#e8eaed';
      preview.style.color = templateState.text || '#5f6368';
      const bw = templateState.borderWidth ?? 0;
      preview.style.outline = `${bw}px solid ${templateState.border || '#dadce0'}`;
      preview.style.outlineOffset = `-${Math.round(bw * 0.3)}px`;
    }

    // Update swatch colors
    function updateSwatches() {
      modal.querySelectorAll('.template-color-swatch').forEach(swatch => {
        const type = swatch.dataset.type;
        const color = templateState[type];
        if (color) {
          swatch.style.background = color;
          swatch.style.border = '2px solid #e0e0e0';
        } else {
          // Show striped pattern for unset colors
          swatch.style.background = 'repeating-linear-gradient(-45deg, #f0f0f0, #f0f0f0 4px, #fff 4px, #fff 8px)';
          swatch.style.border = '2px dashed #e0e0e0';
        }
      });
    }

    // Update border width buttons
    function updateThicknessButtons() {
      modal.querySelectorAll('.tmpl-thickness-btn').forEach(btn => {
        const width = btn.dataset.width;
        const isActive = (width === 'none' && templateState.borderWidth === null) ||
                        (width !== 'none' && templateState.borderWidth === parseInt(width));
        if (width === 'none') {
          btn.style.background = isActive ? '#fef3c7' : '#fff';
          btn.style.color = isActive ? '#d97706' : '#5f6368';
          btn.style.border = isActive ? '1px solid #d97706' : '1px dashed #dadce0';
        } else {
          btn.style.background = isActive ? '#e8f0fe' : '#fff';
          btn.style.color = isActive ? '#1a73e8' : '#5f6368';
          btn.style.border = `1px solid ${isActive ? '#1a73e8' : '#dadce0'}`;
        }
      });
    }

    // Create "None" swatch (to clear/unset color)
    function createNoneSwatch(container) {
      const swatch = document.createElement('div');
      swatch.style.cssText = `
        width: 18px;
        height: 18px;
        border-radius: 3px;
        background: repeating-linear-gradient(-45deg, #f0f0f0, #f0f0f0 3px, #fff 3px, #fff 6px);
        border: 1px dashed #d97706;
        cursor: pointer;
        transition: all 0.15s;
        position: relative;
      `;
      swatch.title = 'None (no change)';
      swatch.dataset.color = 'none';
      // Add a small "x" or slash indicator
      swatch.innerHTML = '<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 10px; color: #d97706; font-weight: bold;">∅</div>';
      swatch.addEventListener('mouseenter', () => {
        swatch.style.transform = 'scale(1.15)';
        swatch.style.borderColor = '#b45309';
      });
      swatch.addEventListener('mouseleave', () => {
        swatch.style.transform = 'scale(1)';
        swatch.style.borderColor = '#d97706';
      });
      swatch.addEventListener('click', () => {
        selectColor(null);
      });
      container.appendChild(swatch);
    }

    // Create color swatch
    function createSwatch(color, container) {
      const swatch = document.createElement('div');
      swatch.style.cssText = `
        width: 18px;
        height: 18px;
        border-radius: 3px;
        background: ${color};
        border: 1px solid #e0e0e0;
        cursor: pointer;
        transition: all 0.15s;
      `;
      swatch.title = color;
      swatch.dataset.color = color;
      swatch.addEventListener('mouseenter', () => {
        swatch.style.transform = 'scale(1.15)';
        swatch.style.borderColor = '#1a73e8';
      });
      swatch.addEventListener('mouseleave', () => {
        swatch.style.transform = 'scale(1)';
        swatch.style.borderColor = '#e0e0e0';
      });
      swatch.addEventListener('click', () => {
        selectColor(color);
      });
      container.appendChild(swatch);
    }

    // Populate palettes
    const vibrantPaletteEl = modal.querySelector('.vibrant-palette');
    const pastelPaletteEl = modal.querySelector('.pastel-palette');
    const darkPaletteEl = modal.querySelector('.dark-palette');
    const customPaletteEl = modal.querySelector('.custom-palette');

    // Add "None" swatch first in each palette
    createNoneSwatch(vibrantPaletteEl);
    createNoneSwatch(pastelPaletteEl);
    createNoneSwatch(darkPaletteEl);
    createNoneSwatch(customPaletteEl);

    colorPickerPalette.forEach(color => createSwatch(color, vibrantPaletteEl));
    pastelPalette.forEach(color => createSwatch(color, pastelPaletteEl));
    darkPalette.forEach(color => createSwatch(color, darkPaletteEl));
    customColors.forEach(color => createSwatch(color, customPaletteEl));

    if (customColors.length === 0) {
      // Keep the None swatch, just add a note
      const note = document.createElement('div');
      note.style.cssText = 'grid-column: 2/-1; text-align: left; color: #999; font-size: 10px; padding: 4px;';
      note.textContent = 'No custom colors yet';
      customPaletteEl.appendChild(note);
    }

    // Select color function
    function selectColor(color) {
      if (!activeColorType) return;
      templateState[activeColorType] = color;
      if (color) {
        directColorInput.value = color;
        hexInput.value = color.toUpperCase();
      } else {
        directColorInput.value = '#cccccc';
        hexInput.value = '';
      }
      updatePreview();
      updateSwatches();
    }

    // Open color picker for a specific type
    function openColorPicker(type) {
      activeColorType = type;
      const labels = { background: 'Background Color', text: 'Text Color', border: 'Border Color' };
      pickerLabel.textContent = labels[type];
      const currentColor = templateState[type];
      if (currentColor) {
        directColorInput.value = currentColor;
        hexInput.value = currentColor.toUpperCase();
      } else {
        directColorInput.value = '#cccccc';
        hexInput.value = '';
      }
      colorPickerPanel.style.display = 'block';

      // Highlight active swatch
      modal.querySelectorAll('.template-color-swatch').forEach(s => {
        s.style.borderColor = s.dataset.type === type ? '#1a73e8' : '#e0e0e0';
        s.style.boxShadow = s.dataset.type === type ? '0 0 0 2px rgba(26, 115, 232, 0.2)' : 'none';
      });
    }

    // Close color picker
    function closeColorPicker() {
      colorPickerPanel.style.display = 'none';
      activeColorType = null;
      modal.querySelectorAll('.template-color-swatch').forEach(s => {
        s.style.borderColor = '#e0e0e0';
        s.style.boxShadow = 'none';
      });
    }

    // Color swatch click handlers
    modal.querySelectorAll('.template-color-swatch').forEach(swatch => {
      swatch.addEventListener('click', () => {
        openColorPicker(swatch.dataset.type);
      });
    });

    // Close picker button
    modal.querySelector('.template-picker-close').addEventListener('click', closeColorPicker);

    // Tab switching
    modal.querySelectorAll('.tmpl-color-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        modal.querySelectorAll('.tmpl-color-tab').forEach(t => {
          t.style.background = '#f8f9fa';
          t.style.color = '#666';
          t.style.borderBottomColor = 'transparent';
        });
        tab.style.background = 'white';
        tab.style.color = '#1a73e8';
        tab.style.borderBottomColor = '#1a73e8';

        modal.querySelectorAll('.tmpl-tab-panel').forEach(p => p.style.display = 'none');
        modal.querySelector(`.tmpl-tab-panel[data-panel="${tab.dataset.tab}"]`).style.display = 'block';
      });
    });

    // Direct color input
    directColorInput.addEventListener('input', () => {
      hexInput.value = directColorInput.value.toUpperCase();
      selectColor(directColorInput.value);
    });

    hexInput.addEventListener('input', () => {
      if (/^#[0-9A-Fa-f]{6}$/.test(hexInput.value)) {
        directColorInput.value = hexInput.value;
        selectColor(hexInput.value);
      }
    });

    // Border width buttons
    modal.querySelectorAll('.tmpl-thickness-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const widthStr = btn.dataset.width;
        const width = widthStr === 'none' ? null : parseInt(widthStr, 10);
        templateState.borderWidth = width;
        updatePreview();
        updateThicknessButtons();
      });
    });

    // Name input
    nameInput.addEventListener('input', () => {
      previewTitle.textContent = nameInput.value || 'Sample Event Title';
    });

    // Close handlers
    const closeModal = () => overlay.remove();
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    modal.querySelector('.modal-close-btn').addEventListener('click', closeModal);
    modal.querySelector('.modal-cancel-btn').addEventListener('click', closeModal);

    // Escape key
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    // Save handler
    modal.querySelector('.modal-save-btn').addEventListener('click', async () => {
      const name = nameInput.value.trim();
      if (!name) {
        nameInput.style.borderColor = '#ef4444';
        nameInput.focus();
        return;
      }

      // FREEMIUM: Check premium access before saving templates
      if (window.cc3FeatureAccess && !hasActiveSubscription) {
        const access = await window.cc3FeatureAccess.canAccess('eventColoring.templates');
        if (!access.allowed) {
          const allTemplates = await window.cc3Storage.getEventColorTemplates();
          const pendingTemplate = {
            id: templateState.id || `tmpl_${Date.now()}`,
            name,
            background: templateState.background,
            text: templateState.text,
            border: templateState.border,
            borderWidth: templateState.borderWidth,
            categoryId: categorySelect.value || null,
            order: templateState.order ?? Object.keys(allTemplates).length,
            createdAt: templateState.createdAt,
            updatedAt: Date.now()
          };
          // Store pending action for completion after upgrade
          await window.cc3FeatureAccess.storePendingAction({
            type: 'eventColoring.template',
            data: { template: pendingTemplate },
          });
          await window.cc3FeatureAccess.trackPremiumAttempt('eventColoring.templates', 'save');
          closeModal();
          // Show upgrade modal
          if (window.cc3PremiumComponents) {
            window.cc3PremiumComponents.showUpgradeModal({
              feature: 'Color Templates',
              description: 'Save and reuse complete color combinations for quick event styling. Upgrade to Pro to unlock this feature.',
            });
          }
          return;
        }
      }

      const allTemplates = await window.cc3Storage.getEventColorTemplates();
      const newTemplate = {
        id: templateState.id || `tmpl_${Date.now()}`,
        name,
        background: templateState.background,
        text: templateState.text,
        border: templateState.border,
        borderWidth: templateState.borderWidth,
        categoryId: categorySelect.value || null,
        order: templateState.order ?? Object.keys(allTemplates).length,
        createdAt: templateState.createdAt,
        updatedAt: Date.now()
      };

      await window.cc3Storage.setEventColorTemplate(newTemplate);
      closeModal();
      await renderEventColorTemplates();
      await renderEventColorCategories();
      notifyContentScriptSettingsChanged();
    });

    // Focus name input
    nameInput.focus();
    nameInput.select();
  }

  // Notify content script that settings changed
  function notifyContentScriptSettingsChanged() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'EVENT_COLORING_SETTINGS_CHANGED'
        }).catch(() => {
          // Ignore errors if tab is not a calendar tab
        });
      }
    });
  }

  // ========================================
  // EVENT CALENDAR COLORS (per-calendar defaults)
  // Completely separate from task list coloring
  // ========================================

  let eventCalendarsList = []; // Cache of calendars from API
  let eventCalendarColors = {}; // Cache of calendar colors from settings
  let calendarDOMColors = {}; // Cache of actual DOM colors from content script (more accurate than API colors)
  let activeEventCalendarColorPicker = null; // Currently open color picker

  // Load event calendar colors
  async function loadEventCalendarColors() {
    debugLog('Loading event calendar colors...');

    const loadingEl = qs('eventCalendarColorsLoading');
    const contentEl = qs('eventCalendarColorsContent');
    const emptyEl = qs('eventCalendarColorsEmpty');

    if (!loadingEl || !contentEl || !emptyEl) {
      debugLog('Event calendar colors elements not found');
      return;
    }

    // Show loading state
    loadingEl.style.display = 'block';
    contentEl.style.display = 'none';
    emptyEl.style.display = 'none';

    try {
      // Fetch calendars from background script with forceRefresh to get latest Google colors
      const calendars = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'GET_CALENDAR_COLORS', forceRefresh: true }, (response) => {
          resolve(response || {});
        });
      });

      // Get saved calendar colors from storage
      eventCalendarColors = await window.cc3Storage.getEventCalendarColors();

      // Get cached DOM colors (actual colors displayed in Google Calendar, may differ from API)
      const domColorsData = await chrome.storage.local.get('cf.calendarDOMColors');
      calendarDOMColors = domColorsData['cf.calendarDOMColors'] || {};
      debugLog('Loaded DOM colors cache:', calendarDOMColors);

      // Convert response to array (now includes summary from API)
      eventCalendarsList = Object.entries(calendars).map(([id, data]) => ({
        id,
        name: data.summary || id,
        backgroundColor: data.backgroundColor || '#4285f4',
        foregroundColor: data.foregroundColor || '#ffffff',
      }));

      debugLog('Loaded', eventCalendarsList.length, 'calendars, colors:', eventCalendarColors);

      if (eventCalendarsList.length === 0) {
        loadingEl.style.display = 'none';
        emptyEl.style.display = 'block';
        return;
      }

      // Render calendars
      renderEventCalendarColors();

      loadingEl.style.display = 'none';
      contentEl.style.display = 'block';

    } catch (error) {
      console.error('[Popup] Failed to load event calendar colors:', error);
      loadingEl.style.display = 'none';
      emptyEl.style.display = 'block';
      emptyEl.textContent = 'Failed to load calendars. Please try again.';
    }
  }

  // Render event calendar colors list
  function renderEventCalendarColors() {
    const contentEl = qs('eventCalendarColorsContent');
    if (!contentEl) return;

    contentEl.innerHTML = '';

    for (const calendar of eventCalendarsList) {
      const colors = eventCalendarColors[calendar.id] || {};
      const item = createEventCalendarColorItem(calendar, colors);
      contentEl.appendChild(item);
    }
  }

  // Create calendar color item element
  function createEventCalendarColorItem(calendar, colors) {
    const item = document.createElement('div');
    item.className = 'event-calendar-item';
    item.dataset.calendarId = calendar.id;

    const bgColor = colors.background || null;
    const textColor = colors.text || null;
    const borderColor = colors.border || null;
    const borderWidth = colors.borderWidth || 2; // Default 2px

    // Helper to get contrast text color for preview
    const getContrastColor = (bgHex) => {
      if (!bgHex) return '#ffffff';
      const rgb = parseInt(bgHex.slice(1), 16);
      const r = (rgb >> 16) & 0xff;
      const g = (rgb >> 8) & 0xff;
      const b = rgb & 0xff;
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance > 0.6 ? '#000000' : '#ffffff';
    };

    // Calculate preview styles
    const previewBg = bgColor || calendar.backgroundColor || '#039be5';
    const previewText = textColor || getContrastColor(previewBg);
    const previewBorder = borderColor ? `outline: ${borderWidth}px solid ${borderColor}; outline-offset: -${borderWidth * 0.3}px;` : '';
    // Use DOM color if available (more accurate), fall back to API color
    const stripeColor = calendarDOMColors[calendar.id] || calendar.backgroundColor || '#1a73e8';

    item.innerHTML = `
      <div class="event-calendar-card">
        <div class="event-calendar-header">
          <div class="event-calendar-title-group">
            <div class="event-calendar-title">
              <span class="event-calendar-google-color" style="background-color: ${calendar.backgroundColor};" title="Google calendar color"></span>
              <span class="event-calendar-name" title="${escapeHtml(calendar.name)}">${escapeHtml(calendar.name)}</span>
            </div>
            <div class="event-calendar-meta">Google Calendar</div>
          </div>
          <div class="event-calendar-preview-wrapper">
            <div class="event-calendar-preview" data-calendar-id="${calendar.id}" style="background-color: ${previewBg}; ${previewBorder}" title="Click to customize colors">
              <div class="event-calendar-preview-stripe" style="background-color: ${stripeColor};"></div>
              <div class="event-calendar-preview-content">
                <span class="event-calendar-preview-title" style="color: ${previewText};">Sample Event</span>
              </div>
            </div>
          </div>
          <div class="event-calendar-expand">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </div>
        </div>
        <div class="event-calendar-details">
          <div class="event-calendar-color-stack">
            <div class="event-calendar-color-row" data-type="background">
              <div class="event-calendar-color-label">Background</div>
              <div class="event-calendar-color-actions">
                <div class="event-calendar-color-preview ${bgColor ? 'has-color' : ''}" style="${bgColor ? `background-color: ${bgColor};` : ''}" data-type="background" data-calendar-id="${calendar.id}"></div>
                ${bgColor ? `<button class="event-calendar-clear-btn" data-type="background" data-calendar-id="${calendar.id}">Clear</button>` : ''}
              </div>
            </div>
            <div class="event-calendar-color-row" data-type="text">
              <div class="event-calendar-color-label">Text Color</div>
              <div class="event-calendar-color-actions">
                <div class="event-calendar-color-preview ${textColor ? 'has-color' : 'computed'}" style="background-color: ${previewText};" data-type="text" data-calendar-id="${calendar.id}"></div>
                ${textColor ? `<button class="event-calendar-clear-btn" data-type="text" data-calendar-id="${calendar.id}">Clear</button>` : ''}
              </div>
            </div>
            <div class="event-calendar-color-row" data-type="border">
              <div class="event-calendar-color-label">Border</div>
              <div class="event-calendar-color-actions">
                <div class="event-calendar-color-preview ${borderColor ? 'has-color' : ''}" style="${borderColor ? `background-color: ${borderColor};` : ''}" data-type="border" data-calendar-id="${calendar.id}"></div>
                ${borderColor ? `<button class="event-calendar-clear-btn" data-type="border" data-calendar-id="${calendar.id}">Clear</button>` : ''}
              </div>
            </div>
            <div class="event-calendar-color-row event-calendar-thickness-row ${borderColor ? 'visible' : ''}" data-type="borderWidth">
              <div class="event-calendar-color-label">Border Thickness</div>
              <div class="event-calendar-thickness-actions">
                <div class="event-calendar-thickness-buttons" data-calendar-id="${calendar.id}">
                  <button type="button" class="event-calendar-thickness-btn${borderWidth === 1 ? ' active' : ''}" data-width="1" data-calendar-id="${calendar.id}">1px</button>
                  <button type="button" class="event-calendar-thickness-btn${borderWidth === 2 ? ' active' : ''}" data-width="2" data-calendar-id="${calendar.id}">2px</button>
                  <button type="button" class="event-calendar-thickness-btn${borderWidth === 3 ? ' active' : ''}" data-width="3" data-calendar-id="${calendar.id}">3px</button>
                  <button type="button" class="event-calendar-thickness-btn${borderWidth === 4 ? ' active' : ''}" data-width="4" data-calendar-id="${calendar.id}">4px</button>
                  <button type="button" class="event-calendar-thickness-btn${borderWidth === 5 ? ' active' : ''}" data-width="5" data-calendar-id="${calendar.id}">5px</button>
                  <button type="button" class="event-calendar-thickness-btn${borderWidth === 6 ? ' active' : ''}" data-width="6" data-calendar-id="${calendar.id}">6px</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Header click to expand/collapse
    const header = item.querySelector('.event-calendar-header');
    header.addEventListener('click', (e) => {
      // Don't toggle if clicking on preview card
      if (e.target.closest('.event-calendar-preview')) return;
      item.classList.toggle('expanded');

      // Close color picker when collapsing
      if (!item.classList.contains('expanded')) {
        closeEventCalendarColorPicker();
      }
    });

    // Preview card click - expand to show color options
    const previewCard = item.querySelector('.event-calendar-preview');
    if (previewCard) {
      previewCard.addEventListener('click', (e) => {
        e.stopPropagation();
        // Expand the card to show individual color options
        item.classList.add('expanded');
      });
    }

    // Color preview clicks in details - open color picker
    item.querySelectorAll('.event-calendar-color-preview').forEach((preview) => {
      preview.addEventListener('click', (e) => {
        e.stopPropagation();
        const type = preview.dataset.type;
        const calId = preview.dataset.calendarId;
        openEventCalendarColorPicker(calId, type, preview);
      });
    });

    // Clear button clicks
    item.querySelectorAll('.event-calendar-clear-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const type = btn.dataset.type;
        const calId = btn.dataset.calendarId;
        await clearEventCalendarColor(calId, type);
      });
    });

    // Border thickness button clicks
    item.querySelectorAll('.event-calendar-thickness-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const width = parseInt(btn.dataset.width);
        const calId = btn.dataset.calendarId;
        await setEventCalendarBorderWidth(calId, width);

        // Update active states for thickness buttons in this calendar row
        const thicknessRow = btn.closest('.event-calendar-thickness-row');
        if (thicknessRow) {
          thicknessRow.querySelectorAll('.event-calendar-thickness-btn').forEach((b) => {
            b.classList.toggle('active', parseInt(b.dataset.width) === width);
          });
        }
      });
    });

    return item;
  }

  // Open color picker for event calendar (using fixed modal with backdrop - matches task list pattern)
  function openEventCalendarColorPicker(calendarId, type, targetSwatch) {
    closeEventCalendarColorPicker();

    const calendar = eventCalendarsList.find(c => c.id === calendarId);
    const calendarName = calendar?.name || calendarId;

    const colors = eventCalendarColors[calendarId] || {};
    const currentColor = colors[type] || null;

    // Get or create modal
    let modal = document.getElementById('event-calendar-color-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'event-calendar-color-modal';
      modal.className = 'event-calendar-color-details';
      document.body.appendChild(modal);
    }

    // Get or create backdrop
    let backdrop = document.getElementById('event-calendar-color-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'event-calendar-color-backdrop';
      backdrop.className = 'event-calendar-color-backdrop';
      document.body.appendChild(backdrop);
    }

    activeEventCalendarColorPicker = { calendarId, type, modal };

    // Build modal content
    modal.innerHTML = `
      <div class="event-calendar-picker-header">
        <span>${type.charAt(0).toUpperCase() + type.slice(1)} Color - ${escapeHtml(calendarName)}</span>
        <button class="event-calendar-picker-close" type="button">×</button>
      </div>
      <div class="color-picker-tabs">
        <button type="button" class="color-tab active" data-tab="vibrant">Vibrant</button>
        <button type="button" class="color-tab" data-tab="pastel">Pastel</button>
        <button type="button" class="color-tab" data-tab="dark">Dark</button>
        <button type="button" class="color-tab" data-tab="custom">Custom</button>
      </div>
      <div class="color-tab-content">
        <div class="color-picker-container" style="margin-bottom: 8px; display: flex; gap: 4px;">
          <input type="color" class="event-cal-direct-color" value="${currentColor || '#4285f4'}" style="width: 60%; height: 28px; cursor: pointer;">
          <input type="text" class="event-cal-hex-input" value="${(currentColor || '#4285f4').toUpperCase()}" placeholder="#FF0000" maxlength="7" style="width: 35%; height: 24px; font-size: 10px; padding: 2px 4px; border: 1px solid #ccc; border-radius: 3px; text-transform: uppercase;">
        </div>
        <div class="color-tab-panel active" data-panel="vibrant">
          <div class="color-palette event-cal-vibrant-palette"></div>
        </div>
        <div class="color-tab-panel" data-panel="pastel">
          <div class="color-palette event-cal-pastel-palette"></div>
        </div>
        <div class="color-tab-panel" data-panel="dark">
          <div class="color-palette event-cal-dark-palette"></div>
        </div>
        <div class="color-tab-panel" data-panel="custom">
          <div class="color-palette event-cal-custom-palette"></div>
        </div>
      </div>
    `;

    // Show modal and backdrop
    modal.classList.add('expanded');
    backdrop.onclick = closeEventCalendarColorPicker;
    requestAnimationFrame(() => backdrop.classList.add('active'));

    // Prevent clicks inside modal from closing it
    modal.onclick = (e) => e.stopPropagation();

    // Setup tab switching
    modal.querySelectorAll('.color-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        modal.querySelectorAll('.color-tab').forEach(t => t.classList.remove('active'));
        modal.querySelectorAll('.color-tab-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        modal.querySelector(`.color-tab-panel[data-panel="${tab.dataset.tab}"]`).classList.add('active');
      });
    });

    // Close button
    modal.querySelector('.event-calendar-picker-close').addEventListener('click', closeEventCalendarColorPicker);

    // Color update function (does NOT close modal - let user keep picking)
    const updateColor = async (color) => {
      await setEventCalendarColor(calendarId, type, color);
    };

    // Direct color input
    const directColorInput = modal.querySelector('.event-cal-direct-color');
    const hexInput = modal.querySelector('.event-cal-hex-input');

    directColorInput.addEventListener('input', () => {
      hexInput.value = directColorInput.value.toUpperCase();
    });
    directColorInput.addEventListener('change', () => updateColor(directColorInput.value));

    hexInput.addEventListener('input', () => {
      const hex = hexInput.value.trim();
      const normalized = hex.startsWith('#') ? hex : '#' + hex;
      if (/^#[0-9A-Fa-f]{6}$/.test(normalized)) {
        directColorInput.value = normalized;
        hexInput.style.borderColor = '#1a73e8';
      } else {
        hexInput.style.borderColor = '#dc2626';
      }
    });
    hexInput.addEventListener('change', () => {
      const hex = hexInput.value.trim();
      const normalized = hex.startsWith('#') ? hex : '#' + hex;
      if (/^#[0-9A-Fa-f]{6}$/.test(normalized)) {
        updateColor(normalized);
      }
    });

    // Populate palettes
    const vibrantPalette = modal.querySelector('.event-cal-vibrant-palette');
    const pastelPaletteEl = modal.querySelector('.event-cal-pastel-palette');
    const darkPaletteEl = modal.querySelector('.event-cal-dark-palette');
    const customPaletteEl = modal.querySelector('.event-cal-custom-palette');

    const createSwatch = (color, paletteEl) => {
      const swatch = document.createElement('div');
      swatch.className = 'color-swatch';
      swatch.style.backgroundColor = color;
      swatch.title = color;
      swatch.dataset.color = color;
      if (currentColor && color.toLowerCase() === currentColor.toLowerCase()) {
        swatch.classList.add('selected');
      }
      swatch.onclick = async () => {
        paletteEl.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
        swatch.classList.add('selected');
        directColorInput.value = color;
        hexInput.value = color.toUpperCase();
        await updateColor(color);
      };
      return swatch;
    };

    colorPickerPalette.forEach(color => vibrantPalette.appendChild(createSwatch(color, vibrantPalette)));
    pastelPalette.forEach(color => pastelPaletteEl.appendChild(createSwatch(color, pastelPaletteEl)));
    darkPalette.forEach(color => darkPaletteEl.appendChild(createSwatch(color, darkPaletteEl)));

    if (customColors.length === 0) {
      customPaletteEl.innerHTML = '<div style="padding: 16px; text-align: center; color: #9aa0a6; font-size: 11px;">No custom colors yet. Add colors in the Preferences tab.</div>';
    } else {
      customColors.forEach(color => customPaletteEl.appendChild(createSwatch(color, customPaletteEl)));
    }
  }

  // Close the color picker (modal and backdrop)
  function closeEventCalendarColorPicker() {
    const modal = document.getElementById('event-calendar-color-modal');
    const backdrop = document.getElementById('event-calendar-color-backdrop');

    if (modal) {
      modal.classList.remove('expanded');
    }
    if (backdrop) {
      backdrop.classList.remove('active');
    }

    activeEventCalendarColorPicker = null;
  }

  // Set event calendar color - update UI without rebuilding
  async function setEventCalendarColor(calendarId, type, color) {
    debugLog('Setting event calendar color:', calendarId, type, color);

    // FREEMIUM: Check premium access before saving calendar colors
    if (window.cc3FeatureAccess && !hasActiveSubscription) {
      const access = await window.cc3FeatureAccess.canAccess('eventColoring.calendarColors');
      if (!access.allowed) {
        // Store pending action for completion after upgrade
        await window.cc3FeatureAccess.storePendingAction({
          type: 'eventColoring.calendarColor',
          data: { calendarId, colorType: type, color },
        });
        await window.cc3FeatureAccess.trackPremiumAttempt('eventColoring.calendarColors', 'save');
        // Show upgrade modal
        if (window.cc3PremiumComponents) {
          window.cc3PremiumComponents.showUpgradeModal({
            feature: 'Calendar Default Colors',
            description: 'Set automatic colors for all events from specific calendars. Upgrade to Pro to unlock this feature.',
          });
        }
        return;
      }
    }

    switch (type) {
      case 'background':
        await window.cc3Storage.setEventCalendarBackgroundColor(calendarId, color);
        break;
      case 'text':
        await window.cc3Storage.setEventCalendarTextColor(calendarId, color);
        break;
      case 'border':
        await window.cc3Storage.setEventCalendarBorderColor(calendarId, color);
        break;
    }

    // Update cache
    eventCalendarColors = await window.cc3Storage.getEventCalendarColors();

    // Update UI without rebuilding - just update the specific swatches
    updateEventCalendarSwatches(calendarId, type, color);

    // Show toast
    const calendar = eventCalendarsList.find(c => c.id === calendarId);
    showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} color set for "${calendar?.name || calendarId}"`);

    // Notify content script
    broadcastEventCalendarColorChange();
  }

  // Clear event calendar color - update UI without rebuilding
  async function clearEventCalendarColor(calendarId, type) {
    debugLog('Clearing event calendar color:', calendarId, type);

    switch (type) {
      case 'background':
        await window.cc3Storage.clearEventCalendarBackgroundColor(calendarId);
        break;
      case 'text':
        await window.cc3Storage.clearEventCalendarTextColor(calendarId);
        break;
      case 'border':
        await window.cc3Storage.clearEventCalendarBorderColor(calendarId);
        break;
    }

    // Update cache
    eventCalendarColors = await window.cc3Storage.getEventCalendarColors();

    // Update UI without rebuilding
    updateEventCalendarSwatches(calendarId, type, null);

    // Show toast
    const calendar = eventCalendarsList.find(c => c.id === calendarId);
    showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} color cleared for "${calendar?.name || calendarId}"`);

    // Force page refresh on calendar tabs to show cleared state correctly
    chrome.tabs.query({ url: 'https://calendar.google.com/*' }, (tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs.reload(tab.id);
      });
    });
  }

  // Set event calendar border width
  async function setEventCalendarBorderWidth(calendarId, width) {
    debugLog('Setting event calendar border width:', calendarId, width);
    console.log('[Popup] Setting border width:', { calendarId, width });

    await window.cc3Storage.setEventCalendarBorderWidth(calendarId, width);

    // Update cache
    eventCalendarColors = await window.cc3Storage.getEventCalendarColors();
    console.log('[Popup] Updated cache after setting width:', JSON.stringify(eventCalendarColors[calendarId]));

    // Update preview to show new border width
    updateEventCalendarPreview(calendarId);

    // Show toast
    const calendar = eventCalendarsList.find(c => c.id === calendarId);
    showToast(`Border thickness set to ${width}px for "${calendar?.name || calendarId}"`);

    // Notify content script
    broadcastEventCalendarColorChange();
  }

  // Update preview card and swatches without rebuilding the entire list
  function updateEventCalendarSwatches(calendarId, type, color) {
    const item = document.querySelector(`.event-calendar-item[data-calendar-id="${CSS.escape(calendarId)}"]`);
    if (!item) return;

    // Helper to get contrast text color
    const getContrastColor = (bgHex) => {
      if (!bgHex) return '#ffffff';
      const rgb = parseInt(bgHex.slice(1), 16);
      const r = (rgb >> 16) & 0xff;
      const g = (rgb >> 8) & 0xff;
      const b = rgb & 0xff;
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance > 0.6 ? '#000000' : '#ffffff';
    };

    // Get all current colors for this calendar
    const colors = eventCalendarColors[calendarId] || {};
    const calendar = eventCalendarsList.find(c => c.id === calendarId);
    const googleBgColor = calendar?.backgroundColor || '#039be5';

    // Update the unified preview card
    const previewCard = item.querySelector('.event-calendar-preview');
    if (previewCard) {
      const bgColor = colors.background || googleBgColor;
      const textColor = colors.text || getContrastColor(bgColor);
      const borderColor = colors.border;
      const borderWidth = colors.borderWidth || 2;

      previewCard.style.backgroundColor = bgColor;

      if (borderColor) {
        previewCard.style.outline = `${borderWidth}px solid ${borderColor}`;
        previewCard.style.outlineOffset = `-${borderWidth * 0.3}px`;
      } else {
        previewCard.style.outline = 'none';
      }

      const previewTitle = previewCard.querySelector('.event-calendar-preview-title');
      if (previewTitle) {
        previewTitle.style.color = textColor;
      }
    }

    // Update details preview (in expanded section)
    const detailsPreview = item.querySelector(`.event-calendar-color-preview[data-type="${type}"]`);
    if (detailsPreview) {
      if (color) {
        detailsPreview.classList.add('has-color');
        detailsPreview.classList.remove('computed');
        detailsPreview.style.backgroundColor = color;
      } else if (type === 'text') {
        // For text color, show the computed contrast color when no custom color is set
        const bgColor = colors.background || googleBgColor;
        const computedTextColor = getContrastColor(bgColor);
        detailsPreview.classList.remove('has-color');
        detailsPreview.classList.add('computed');
        detailsPreview.style.backgroundColor = computedTextColor;
      } else {
        detailsPreview.classList.remove('has-color');
        detailsPreview.classList.remove('computed');
        detailsPreview.style.backgroundColor = '';
      }
    }

    // When background changes, also update the text color swatch if it's using computed color
    if (type === 'background' && !colors.text) {
      const textPreview = item.querySelector('.event-calendar-color-preview[data-type="text"]');
      if (textPreview) {
        const bgColor = color || googleBgColor;
        const computedTextColor = getContrastColor(bgColor);
        textPreview.classList.remove('has-color');
        textPreview.classList.add('computed');
        textPreview.style.backgroundColor = computedTextColor;
      }
    }

    // Update/add/remove clear button
    const row = item.querySelector(`.event-calendar-color-row[data-type="${type}"]`);
    if (row) {
      const actionsDiv = row.querySelector('.event-calendar-color-actions');
      let clearBtn = row.querySelector('.event-calendar-clear-btn');

      if (color && !clearBtn) {
        clearBtn = document.createElement('button');
        clearBtn.className = 'event-calendar-clear-btn';
        clearBtn.dataset.type = type;
        clearBtn.dataset.calendarId = calendarId;
        clearBtn.textContent = 'Clear';
        clearBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await clearEventCalendarColor(calendarId, type);
        });
        actionsDiv.appendChild(clearBtn);
      } else if (!color && clearBtn) {
        clearBtn.remove();
      }
    }

    // Show/hide thickness row when border color changes
    if (type === 'border') {
      const thicknessRow = item.querySelector('.event-calendar-thickness-row');
      if (thicknessRow) {
        thicknessRow.classList.toggle('visible', !!color);
      }
    }
  }

  // Update the preview card for a calendar (used when border width changes)
  function updateEventCalendarPreview(calendarId) {
    const item = document.querySelector(`.event-calendar-item[data-calendar-id="${CSS.escape(calendarId)}"]`);
    if (!item) return;

    // Helper to get contrast text color
    const getContrastColor = (bgHex) => {
      if (!bgHex) return '#ffffff';
      const rgb = parseInt(bgHex.slice(1), 16);
      const r = (rgb >> 16) & 0xff;
      const g = (rgb >> 8) & 0xff;
      const b = rgb & 0xff;
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance > 0.6 ? '#000000' : '#ffffff';
    };

    const colors = eventCalendarColors[calendarId] || {};
    const calendar = eventCalendarsList.find(c => c.id === calendarId);
    const googleBgColor = calendar?.backgroundColor || '#039be5';

    const previewCard = item.querySelector('.event-calendar-preview');
    if (previewCard) {
      const bgColor = colors.background || googleBgColor;
      const textColor = colors.text || getContrastColor(bgColor);
      const borderColor = colors.border;
      const borderWidth = colors.borderWidth || 2;

      previewCard.style.backgroundColor = bgColor;

      if (borderColor) {
        previewCard.style.outline = `${borderWidth}px solid ${borderColor}`;
        previewCard.style.outlineOffset = `-${borderWidth * 0.3}px`;
      } else {
        previewCard.style.outline = 'none';
      }

      const previewTitle = previewCard.querySelector('.event-calendar-preview-title');
      if (previewTitle) {
        previewTitle.style.color = textColor;
      }
    }
  }

  // Broadcast event calendar color change to content script
  // Include colors in message to avoid race conditions with storage
  function broadcastEventCalendarColorChange() {
    // Debug: log what we're broadcasting
    console.log('[Popup] Broadcasting calendar colors:', JSON.stringify(eventCalendarColors));
    chrome.tabs.query({ url: 'https://calendar.google.com/*' }, (tabs) => {
      console.log('[Popup] Found', tabs.length, 'Calendar tabs to notify');
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(tab.id, {
          type: 'EVENT_CALENDAR_COLORS_CHANGED',
          calendarColors: eventCalendarColors,
        }).catch((err) => {
          console.error('[Popup] Failed to send message to tab', tab.id, ':', err);
        });
      });
    });
  }

  // Event Coloring event listeners
  const eventColoringToggle = qs('eventColoringToggle');
  if (eventColoringToggle) {
    eventColoringToggle.onclick = async (e) => {
      e.stopPropagation(); // Prevent accordion trigger
      const isCurrentlyActive = eventColoringToggle.classList.contains('active');
      const newState = !isCurrentlyActive;

      // Toggle the active class
      if (newState) {
        eventColoringToggle.classList.add('active');
      } else {
        eventColoringToggle.classList.remove('active');
      }

      await window.cc3Storage.setEventColoringEnabled(newState);
      debugLog('Event coloring enabled:', newState);

      // Update feature disabled state
      const section = document.querySelector('.event-coloring-section .section-content');
      if (section) {
        if (newState) {
          section.classList.remove('feature-disabled');
        } else {
          section.classList.add('feature-disabled');
        }
      }

      // Notify content script
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'EVENT_COLORING_TOGGLED',
            enabled: newState
          }).catch(() => {});
        }
      });
    };
  }

  const addCategoryBtn = qs('addEventColorCategoryBtn');
  if (addCategoryBtn) {
    addCategoryBtn.addEventListener('click', addNewCategory);
  }

  const addTemplateBtn = qs('addEventColorTemplateBtn');
  if (addTemplateBtn) {
    addTemplateBtn.addEventListener('click', addNewTemplate);
  }

  const disableCustomColorsCheckbox = qs('disableCustomColorsCheckbox');
  if (disableCustomColorsCheckbox) {
    disableCustomColorsCheckbox.addEventListener('change', async (e) => {
      await window.cc3Storage.setDisableCustomColors(e.target.checked);
      debugLog('Disable custom colors:', e.target.checked);

      // Notify content script
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'EVENT_COLORING_SETTINGS_CHANGED'
          }).catch(() => {});
        }
      });
    });
  }

  // Color scheme selector (Modern vs Classic)
  const colorSchemeSelect = qs('googleColorSchemeSelect');
  if (colorSchemeSelect) {
    colorSchemeSelect.addEventListener('change', async (e) => {
      await handleColorSchemeChange(e.target.value);
    });
  }

  // Calendar Colors info card toggle
  const calendarColorsInfoToggle = qs('calendarColorsInfoToggle');
  const calendarColorsInfoExpanded = qs('calendarColorsInfoExpanded');
  if (calendarColorsInfoToggle && calendarColorsInfoExpanded) {
    calendarColorsInfoToggle.onclick = (e) => {
      e.preventDefault();
      const isExpanded = calendarColorsInfoExpanded.style.display !== 'none';
      if (isExpanded) {
        calendarColorsInfoExpanded.style.display = 'none';
        calendarColorsInfoToggle.innerHTML = `
          See how to use
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style="transition: transform 0.2s ease;">
            <path d="M7 10l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        `;
      } else {
        calendarColorsInfoExpanded.style.display = 'block';
        calendarColorsInfoToggle.innerHTML = `
          Hide
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style="transform: rotate(180deg); transition: transform 0.2s ease;">
            <path d="M7 10l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        `;
      }
    };
  }

  // Google Color Labels info card toggle
  const googleColorLabelsInfoToggle = qs('googleColorLabelsInfoToggle');
  const googleColorLabelsInfoExpanded = qs('googleColorLabelsInfoExpanded');
  if (googleColorLabelsInfoToggle && googleColorLabelsInfoExpanded) {
    googleColorLabelsInfoToggle.onclick = (e) => {
      e.preventDefault();
      const isExpanded = googleColorLabelsInfoExpanded.style.display !== 'none';
      if (isExpanded) {
        googleColorLabelsInfoExpanded.style.display = 'none';
        googleColorLabelsInfoToggle.innerHTML = `
          See how to use
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style="transition: transform 0.2s ease;">
            <path d="M7 10l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        `;
      } else {
        googleColorLabelsInfoExpanded.style.display = 'block';
        googleColorLabelsInfoToggle.innerHTML = `
          Hide
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style="transform: rotate(180deg); transition: transform 0.2s ease;">
            <path d="M7 10l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        `;
      }
    };
  }

  // Event Coloring (Custom Categories) info card toggle
  const eventColoringInfoToggle = qs('eventColoringInfoToggle');
  const eventColoringInfoExpanded = qs('eventColoringInfoExpanded');
  if (eventColoringInfoToggle && eventColoringInfoExpanded) {
    eventColoringInfoToggle.onclick = (e) => {
      e.preventDefault();
      const isExpanded = eventColoringInfoExpanded.style.display !== 'none';
      if (isExpanded) {
        eventColoringInfoExpanded.style.display = 'none';
        eventColoringInfoToggle.innerHTML = `
          See how to use
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style="transition: transform 0.2s ease;">
            <path d="M7 10l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        `;
      } else {
        eventColoringInfoExpanded.style.display = 'block';
        eventColoringInfoToggle.innerHTML = `
          Hide
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style="transform: rotate(180deg); transition: transform 0.2s ease;">
            <path d="M7 10l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        `;
      }
    };
  }

  // Load event coloring settings on popup open
  loadEventColoringSettings().catch(err => {
    console.error('Failed to load event coloring settings:', err);
  });
})();

