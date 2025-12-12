# Event Coloring - Critical Bug Found
## Label Updates Never Reach Content Script

**Date:** 2025-12-12
**Severity:** CRITICAL 🔴
**Status:** Root cause identified, fix ready

---

## 🐛 THE BUG

**User Action:**
1. User opens extension popup
2. User changes Google color label (e.g., "Lavender" → "My Custom Label")
3. Input field saves on blur

**What SHOULD happen:**
1. Label saved to storage ✅
2. Content script notified of change ❌ **MISSING**
3. Content script reloads settings ❌ **NEVER HAPPENS**
4. Next time color picker opens, shows new label ❌ **SHOWS OLD LABEL**

**Result:** Labels appear to save but never actually update in Google Calendar.

---

## 📍 ROOT CAUSE

### Popup Code (popup.js:8179-8185)
```javascript
async function updateGoogleColorLabel(colorHex, label) {
  // FIX #5: Ensure hex is always lowercase for consistency
  const normalizedHex = colorHex.toLowerCase();
  await window.cc3Storage.setGoogleColorLabel(normalizedHex, label);
  debugLog('Google color label updated:', normalizedHex, label);
  // ❌ NO MESSAGE SENT TO CONTENT SCRIPT!
}
```

### Compare with "Disable Custom Colors" Checkbox (popup.js:8223-8235)
```javascript
disableCustomColorsCheckbox.addEventListener('change', async (e) => {
  await window.cc3Storage.setDisableCustomColors(e.target.checked);
  debugLog('Disable custom colors:', e.target.checked);

  // ✅ CORRECTLY sends message to content script
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'EVENT_COLORING_SETTINGS_CHANGED'
      }).catch(() => {});
    }
  });
});
```

**The checkbox sends a message, but the label update doesn't!**

---

## 🔍 DATA FLOW ANALYSIS

### Current (Broken) Flow:
```
User changes label in popup
         ↓
updateGoogleColorLabel() called
         ↓
Label saved to chrome.storage.sync
         ↓
❌ NO MESSAGE SENT ❌
         ↓
Content script keeps using cached settings with old labels
         ↓
User opens color picker
         ↓
updateGoogleColorLabels() uses old cached settings.googleColorLabels
         ↓
Old label still shows
```

### Expected (Fixed) Flow:
```
User changes label in popup
         ↓
updateGoogleColorLabel() called
         ↓
Label saved to chrome.storage.sync
         ↓
✅ Send EVENT_COLORING_SETTINGS_CHANGED message
         ↓
Content script receives message
         ↓
Content script calls init() to reload settings
         ↓
New settings loaded from storage (with new labels)
         ↓
User opens color picker
         ↓
updateGoogleColorLabels() uses NEW settings.googleColorLabels
         ↓
New label shows correctly!
```

---

## 🔧 THE FIX

### Fix: Add Message Send to updateGoogleColorLabel

**File:** `Main Extension/popup/popup.js` (line ~8185)

**Before:**
```javascript
async function updateGoogleColorLabel(colorHex, label) {
  // FIX #5: Ensure hex is always lowercase for consistency
  const normalizedHex = colorHex.toLowerCase();
  await window.cc3Storage.setGoogleColorLabel(normalizedHex, label);
  debugLog('Google color label updated:', normalizedHex, label);
}
```

**After:**
```javascript
async function updateGoogleColorLabel(colorHex, label) {
  // FIX #5: Ensure hex is always lowercase for consistency
  const normalizedHex = colorHex.toLowerCase();
  await window.cc3Storage.setGoogleColorLabel(normalizedHex, label);
  debugLog('Google color label updated:', normalizedHex, label);

  // FIX #6: CRITICAL - Notify content script that labels changed
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
```

---

## ✅ CONTENT SCRIPT ALREADY HANDLES THIS

**File:** `Main Extension/features/event-coloring/index.js` (lines 680-683)

```javascript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'EVENT_COLORING_TOGGLED') {
    // ... handle toggle
  } else if (message.type === 'EVENT_COLORING_SETTINGS_CHANGED') {
    console.log('[EventColoring] Settings changed, reloading...');
    init(settings).catch((err) => console.error('[EventColoring] Reinit failed:', err));
  }
});
```

The content script **ALREADY** has the handler for `EVENT_COLORING_SETTINGS_CHANGED`. It just was never being called when labels changed!

### How init() Reloads Settings:
```javascript
async function init(featureSettings) {
  settings = featureSettings || {};

  // FIX #1: Ensure settings are fully loaded from storage
  if (!settings.googleColorLabels || !settings.categories) {
    console.log('[EventColoring] Settings incomplete, reloading from storage...');
    const fullSettings = await window.cc3Storage.getEventColoringSettings();
    settings = { ...settings, ...fullSettings };
  }
  // ... rest of init
}
```

When `init(settings)` is called:
1. It receives the old `settings` object (still in memory)
2. It sees `googleColorLabels` exists (but with old data)
3. It DOESN'T reload from storage! ❌

**Additional Fix Needed:** Force reload when settings change.

---

## 🔧 COMPLETE FIX

### Fix #6a: Notify Content Script

**File:** `popup/popup.js` (line ~8185)
```javascript
async function updateGoogleColorLabel(colorHex, label) {
  const normalizedHex = colorHex.toLowerCase();
  await window.cc3Storage.setGoogleColorLabel(normalizedHex, label);
  debugLog('Google color label updated:', normalizedHex, label);

  // FIX #6a: Notify content script
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'EVENT_COLORING_SETTINGS_CHANGED'
      }).catch(() => {});
    }
  });
}
```

### Fix #6b: Force Settings Reload in Content Script

**File:** `features/event-coloring/index.js` (line ~681)
```javascript
} else if (message.type === 'EVENT_COLORING_SETTINGS_CHANGED') {
  console.log('[EventColoring] Settings changed, reloading...');
  // FIX #6b: Force reload from storage, don't use cached settings
  const freshSettings = await window.cc3Storage.getEventColoringSettings();
  await init(freshSettings);
}
```

---

## 📊 WHY THIS WAS SO HARD TO FIND

1. **Storage was working** - Labels were actually being saved
2. **Selectors were correct** - `div[jsname="Ly0WL"]` and `.oMnJrf` are right
3. **Update logic was correct** - `updateGoogleColorLabels()` does the right thing
4. **The bug was silent** - No errors, no warnings
5. **Settings appeared to exist** - But content script was using cached version

It's a **communication failure** between popup and content script, not a logic error.

---

## 🎯 EXPECTED BEHAVIOR AFTER FIX

### Console Output When User Changes Label:

**Popup:**
```
[EventColoring] Google color label updated: #a4bdfc My Custom Label
```

**Content Script:**
```
[EventColoring] Settings changed, reloading...
[EventColoring] Initializing... {
  isEnabled: true,
  categoriesCount: 0,
  googleColorLabelsCount: 1,
  disableCustomColors: false
}
```

**Next Color Picker Open:**
```
[EventColoring] ✓ Color picker detected via jsname="Ly0WL"
[EventColoring] ========== updateGoogleColorLabels START ==========
[EventColoring] Custom labels: {#a4bdfc: 'My Custom Label'}
[EventColoring] Number of custom labels: 1
[EventColoring] Found 11 Google color buttons
[EventColoring] Button 0: #a4bdfc → #a4bdfc
[EventColoring] ✓ Applying custom label to #a4bdfc: "My Custom Label"
[EventColoring] ✓ Updated .oMnJrf element with data-text: "My Custom Label"
[EventColoring] Summary: 1 labels updated, 0 skipped
```

---

## 🧪 TESTING PLAN

1. **Before Fix:**
   - Change label in popup
   - Open color picker
   - **Expected:** Old label shows
   - **Verify:** Console shows no "Settings changed, reloading..." message

2. **After Fix:**
   - Change label in popup
   - **Verify:** Console shows "Settings changed, reloading..."
   - Open color picker
   - **Expected:** New label shows
   - **Verify:** Console shows label was applied

---

## 📝 SUMMARY

**Issue:** Popup never notifies content script when labels change
**Impact:** Labels appear to save but never show in Google Calendar
**Severity:** CRITICAL - Feature completely non-functional
**Fix Complexity:** Simple - Add 8 lines of code
**Confidence:** VERY HIGH - This is definitively the issue

