# ColorKit Chrome Extension - Full Codebase Reference

 

**Last Updated**: December 18, 2025

**Extension Version**: 0.0.5

**Manifest Version**: 3

**Minimum Chrome Version**: 121

 

This document provides comprehensive context about the ColorKit Chrome extension codebase for AI assistants and developers.

 

---

 

## Table of Contents

 

1. [Architecture Overview](#architecture-overview)

2. [File Structure](#file-structure)

3. [Core Systems](#core-systems)

4. [Features](#features)

5. [Storage Schema](#storage-schema)

6. [Message Passing](#message-passing)

7. [API Integrations](#api-integrations)

8. [Critical Code Patterns](#critical-code-patterns)

9. [Performance Optimizations](#performance-optimizations)

10. [Security & Privacy](#security--privacy)

11. [Version History](#version-history)

 

---

 

## Architecture Overview

 

### Extension Type

 

**Manifest V3 Chrome Extension** with:

 

- Service Worker background script

- Content scripts injected into Google Calendar

- Popup UI for settings management

- OAuth 2.0 integration for Google Tasks API and Google Calendar API

- Supabase backend for subscription validation

 

### Technology Stack

 

- **JavaScript (ES6 modules)** - Background uses ES modules

- **Chrome Extension APIs**: storage, identity, runtime, tabs, alarms

- **Google Tasks API v1**: Read-only access for task list mapping

- **Google Calendar API v3**: Read-only access for calendar colors and event mapping

- **Supabase**: Authentication and subscription management

- **Vanilla HTML/CSS**: No framework dependencies

 

### Execution Contexts

 

**Service Worker** (`background.js`):

 

- Persistent background tasks

- Message routing

- OAuth token management

- Subscription validation

- Task list syncing state machine

- Calendar API calls

 

**Content Script** (`content/index.js`):

 

- Runs on https://calendar.google.com/*

- DOM manipulation

- Feature registration

- Activity tracking

- Subscription validation before enabling features

 

**Popup** (`popup/popup.html`, `popup/popup.js`):

 

- Settings UI (520x650px)

- Feature toggles

- Color pickers

- Subscription status

 

---

 

## File Structure

 

```

Main Extension/

├── manifest.json                       # Extension manifest (V3)

├── background.js                       # Service worker (ES module)

├── config.js                           # Development config

├── config.production.js                # Production config

├── debug-clear-oauth.js                # OAuth debugging utility

├── check-settings.js                   # Settings verification

│

├── content/

│   ├── index.js                        # Main content script entry

│   ├── content.css                     # Content script styles

│   ├── featureRegistry.js              # Feature registry (Map-based)

│   ├── modalInjection.js               # Task modal detection

│   └── toolbar.js                      # Toolbar injections

│

├── lib/

│   ├── storage.js                      # Storage abstraction layer

│   ├── google-tasks-api.js             # Google Tasks API integration

│   ├── google-calendar-api.js          # Google Calendar API integration (NEW)

│   ├── subscription-validator.js       # Supabase subscription validation

│   └── supabase-extension.js           # Supabase client library

│

├── features/

│   ├── shared/

│   │   └── utils.js                    # Shared utilities (color picker)

│   ├── calendar-coloring/

│   │   ├── index.js                    # Day/month coloring entry

│   │   ├── core/

│   │   │   ├── dayColoring.js          # Weekday coloring logic

│   │   │   └── monthColoring.js        # Month view coloring

│   │   └── utils/

│   │       └── dateUtils.js            # Date manipulation helpers

│   ├── tasks-coloring/

│   │   ├── index.js                    # Task coloring + list defaults + chains

│   │   └── styles.css                  # Task coloring styles

│   ├── event-coloring/                 # NEW: Calendar event coloring

│   │   ├── index.js                    # Main event coloring logic

│   │   ├── selectors.js                # DOM selectors for color picker

│   │   ├── core/

│   │   │   ├── colorRenderer.js        # Color application logic

│   │   │   └── colorPickerInjector.js  # Custom color picker injection

│   │   ├── components/

│   │   │   └── RecurringEventDialog.js # Recurring event color dialog

│   │   └── utils/

│   │       ├── eventIdUtils.js         # Event ID parsing utilities

│   │       └── scenarioDetector.js     # UI scenario detection

│   ├── time-blocking/

│   │   ├── index.js                    # Time blocking entry

│   │   └── core/

│   │       └── timeBlocking.js         # Time block rendering

│   └── columnCss.js                    # Column width adjustments

│

├── popup/

│   ├── popup.html                      # Settings UI (520x650px)

│   ├── popup.js                        # Settings logic

│   └── colorkit-logo.png               # Extension logo

│

├── options/

│   ├── options.html                    # Options page

│   ├── options.css                     # Options styles

│   └── options.js                      # Options logic

│

├── diagnostics/

│   ├── diagnostics.html                # Diagnostics page

│   ├── diagnostics.js                  # Debug tools

│   ├── quick-task-inspector.js         # Quick selector health check

│   ├── task-mapping-explorer.js        # Deep task mapping analysis

│   ├── monitoring-code-optional.js     # Optional selector monitoring

│   └── USAGE.md                        # Diagnostics usage guide

│

├── images/

│   ├── icon-16.png

│   ├── icon-48.png

│   ├── icon-128.png

│   └── colorkit-logo.png

│

├── docs/

│   ├── TASK_COLORING_GOOGLE_MODE.md

│   └── TASK_MAPPING_INVESTIGATION.md

│

├── CLAUDE.md                           # This file

├── USER_GUIDE.md                       # User guide

└── SETUP_INSTRUCTIONS.md               # Setup instructions

```

 

---

 

## Core Systems

 

### 1. Storage System (`lib/storage.js`)

 

**Purpose**: Abstraction layer over Chrome storage APIs with deep merge support

 

**Key Functions**:

 

```javascript

// Settings Management

async function getSettings()                              // Get settings object (merged with defaults)

async function setSettings(partialSettings)              // Update settings (deep merge)

async function onSettingsChanged(callback)               // Listen for changes

async function get(key, defaultValue)                    // Get specific key

async function set(key, value)                           // Set specific key

async function getAll()                                  // Get all sync storage

 

// Day Coloring

async function setEnabled(enabled)

async function setWeekdayColor(weekdayIndex, color)

async function setWeekdayOpacity(weekdayIndex, opacity)

async function setDateColor(dateKey, color)

async function clearDateColor(dateKey)

async function addPresetColor(color)

async function setWeekStart(weekStart)

async function setWeekStartConfigured(configured)

 

// Task Coloring (Presets & Inline)

async function setTaskColoringEnabled(enabled)

async function setTaskPresetColors(colors)

async function addTaskPresetColor(color)

async function removeTaskPresetColor(index)

async function updateTaskPresetColor(index, color)

async function setTaskInlineColors(colors)

async function updateTaskInlineColor(index, color)

 

// Recurring Task Chains (NEW chain-based system)

async function setTaskIdToChain(taskId, chainId)

async function getTaskIdToChainMap()

async function removeTaskIdFromChain(taskId)

async function setChainMetadata(chainId, metadata)

async function getChainMetadata(chainId)

async function getAllChainMetadata()

async function removeChain(chainId)

async function setChainColor(chainId, color)

async function getChainColors()

async function clearChainColor(chainId)

async function cleanupStaleChains(maxAgeDays)

async function migrateToChainSystem()

 

// Recurring Task Colors (Legacy - kept for backward compatibility)

async function setRecurringTaskColor(fingerprint, color)

async function clearRecurringTaskColor(fingerprint)

async function getRecurringTaskColors()

 

// Task List Coloring

async function setTaskListColoringEnabled(enabled)

async function setTaskListDefaultColor(listId, color)

async function setTaskListTextColor(listId, color)

async function clearTaskListDefaultColor(listId)

async function clearTaskListTextColor(listId)

async function getTaskListColors()

async function getTaskListTextColors()

async function getDefaultColorForTask(taskId)

async function getTaskListsMeta()

async function getTaskToListMap()

 

// Calendar Event Mapping (NEW - for new Google Calendar UI)

async function setCalendarEventMapping(calendarEventId, taskApiId, metadata)

async function getCalendarEventMapping(calendarEventId)

async function getCalendarEventMappings()

async function clearCalendarEventMapping(calendarEventId)

async function clearAllCalendarEventMappings()

async function getCalendarEventMappingMeta()

async function setCalendarEventMappingMeta(meta)

 

// Completed Task Styling

async function setCompletedStylingEnabled(listId, enabled)

async function setCompletedStylingMode(listId, mode)

async function setCompletedBgColor(listId, color)

async function setCompletedTextColor(listId, color)

async function setCompletedBgOpacity(listId, opacity)

async function setCompletedTextOpacity(listId, opacity)

async function clearCompletedStyling(listId)

async function getCompletedStyling(listId)

 

// Event Coloring (NEW)

async function setEventColoringEnabled(enabled)

async function getEventColoringSettings()

async function setEventColorCategory(category)

async function deleteEventColorCategory(categoryId)

async function getEventColorCategories()

async function setGoogleColorLabel(colorHex, label)

async function getGoogleColorLabels()

async function saveEventColor(eventId, colorHex, isRecurring)

async function saveEventColorAdvanced(eventId, colorHex, options)

async function getEventColor(eventId)

async function getAllEventColors()

async function removeEventColor(eventId)

async function findEventColor(eventId)

async function parseEventId(encodedId)

async function encodeEventId(decodedId, emailSuffix)

async function getIsCustomColorsDisabled()

async function setDisableCustomColors(disabled)

async function addQuickAccessColor(colorHex)

 

// Time Blocking

async function setTimeBlockingEnabled(enabled)

async function setTimeBlockingGlobalColor(color)

async function setTimeBlockingShadingStyle(style)

async function setTimeBlockingSchedule(schedule)

async function addTimeBlock(dayKey, timeBlock)

async function updateTimeBlock(dayKey, blockIndex, timeBlock)

async function removeTimeBlock(dayKey, blockIndex)

async function addDateSpecificTimeBlock(dateKey, timeBlock)

async function removeDateSpecificTimeBlock(dateKey, blockIndex)

async function updateDateSpecificTimeBlock(dateKey, blockIndex, timeBlock)

async function clearDateSpecificBlocks(dateKey)

 

// Complete Reset

async function performCompleteReset()

  // Clears: cf.taskColors, cf.taskListColors, cf.taskListTextColors, customDayColors

  // Clears: cf.taskToListMap, cf.taskListsMeta, cf.stateMachine

  // Clears: cf.taskIdToChainId, cf.recurringChains, cf.chainsMigrated

  // Resets: settings to defaultSettings

  // Revokes: Google OAuth token

  // Preserves: subscriptionStatus, subscriptionActive, pushSubscription

 

// Utilities

function ymdFromDate(date)                               // Format date as YYYY-MM-DD

```

 

**Default Settings** (all features enabled by default):

 

```javascript

const defaultSettings = {

  enabled: true,                                          // Day coloring enabled

  weekdayColors: { "0": "#ffd5d5", ... },                // Default pastel colors

  weekdayOpacity: { "0": 30, "1": 30, ... },             // Per-day opacity (0-100)

  dateColors: {},

  presetColors: [...],

  weekStart: 0,

  weekStartConfigured: false,

  taskColoring: {

    enabled: true,                                        // Individual task coloring

    presetColors: [...],

    inlineColors: [...],

  },

  taskListColoring: {

    enabled: true,                                        // Task list coloring (OAuth required)

    oauthGranted: false,

    lastSync: null,

    syncInterval: 5,

    pendingTextColors: {},

    completedStyling: {},

  },

  timeBlocking: {

    enabled: true,                                        // Time blocking enabled

    globalColor: "#FFEB3B",

    shadingStyle: "solid",

    weeklySchedule: { mon: [], tue: [], ... },

    dateSpecificSchedule: {},

  },

  eventColoring: {                                        // NEW: Event coloring

    enabled: true,

    categories: {},

    googleColorLabels: {},

    quickAccessColors: [],

    disableCustomColors: false,

  },

};

```

 

**Global Access**: Exported as `window.cc3Storage` in content scripts

 

---

 

### 2. Google Tasks API (`lib/google-tasks-api.js`)

 

**Purpose**: OAuth integration and API calls to Google Tasks API

 

**Key Functions**:

 

```javascript

// OAuth Management

async function getAuthToken(interactive = false)     // Get/refresh OAuth token

async function clearAuthToken()                      // Clear cached token

async function isAuthGranted()                       // Check if OAuth granted

 

// API Calls

async function fetchTaskLists()                      // GET /users/@me/lists

async function fetchTasksInList(listId, updatedMin)  // GET /lists/{listId}/tasks

async function fetchTasksWithCompletedLimit(listId, daysLimit)

 

// Mapping & Sync

async function buildTaskToListMapping()              // Full sync (all lists/tasks)

async function incrementalSync(lastSyncTime)         // Incremental sync (updatedMin)

async function getListIdForTask(taskId)              // Quick cache lookup

async function findTaskInAllLists(taskId)            // Parallel search for new tasks

 

// Utilities

async function safeApiCall(apiFunction, maxRetries)

async function exponentialBackoff(attempt)

async function checkStorageQuota()

```

 

**API Parameters**:

 

- `showCompleted: true` - Include completed tasks

- `showHidden: true` - **CRITICAL**: Include tasks completed in first-party clients

 

---

 

### 3. Google Calendar API (`lib/google-calendar-api.js`) - NEW

 

**Purpose**: Calendar API integration for the new Google Calendar UI (ttb_ prefix)

 

**Key Functions**:

 

```javascript

// TTB Decoding (New UI Support)

function decodeCalendarEventId(ttbString)            // Decode ttb_ to calendar event ID

function extractTaskFragmentFromEvent(event)         // Extract task fragment from description

function taskFragmentToApiId(fragment)               // Convert fragment to Task API ID

function taskApiIdToFragment(taskApiId)              // Convert Task API ID to fragment

 

// Calendar API Calls

async function fetchCalendarEvent(eventId)           // GET /calendars/primary/events/{eventId}

async function calendarEventIdToTaskId(eventId)      // Full mapping chain: Calendar → Task ID

async function isCalendarApiAccessible()             // Check calendar.readonly permission

 

// Calendar Colors (for event coloring feature)

async function fetchCalendarColors(forceRefresh)     // GET /users/me/calendarList

async function getCalendarColor(calendarId)          // Get color for specific calendar

async function getCalendarColorFromEventId(eventId)  // Get calendar color from event ID

function clearCalendarColorsCache()                  // Clear colors cache (5-min TTL)

```

 

**New UI Support**:

 

The new Google Calendar UI uses a different event ID format for tasks:

- **Old UI**: `data-eventid="tasks.{taskId}"` → Direct task ID

- **New UI**: `data-eventid="ttb_{base64}"` → Requires Calendar API resolution

 

---

 

### 4. Subscription Validation (`lib/subscription-validator.js`)

 

**Purpose**: Validate user subscriptions via Supabase backend with **FAIL-OPEN** architecture

 

**CRITICAL: Fail-Open Architecture**:

 

- ✅ Only locks when subscription is **confirmed inactive**

- ✅ Preserves unlock state on API errors, network issues, token expiry

- ✅ Auto-refreshes expired tokens instead of locking

- ❌ **NEVER** locks paying users during temporary system failures

 

**Key Functions**:

 

```javascript

async function validateSubscription()               // Read from storage (no API call)

async function forceRefreshSubscription()           // API call with fail-open logic

async function clearSubscriptionCache()             // Force revalidation

```

 

---

 

## Features

 

### Feature 1: Calendar Day Coloring

 

**Files**: `features/calendar-coloring/`

 

**How It Works**:

1. Content script loads on Google Calendar

2. Identifies day cells by data attributes

3. Applies background colors with per-day opacity

4. Watches for navigation via MutationObserver

5. Re-colors on date change

 

**DOM Selectors**:

- Day containers: `div[data-datekey]:not([jsaction])`

- Grid: `[role="grid"]`

 

---

 

### Feature 2: Individual Task Coloring

 

**Files**: `features/tasks-coloring/`

 

**How It Works**:

1. Detects tasks on calendar grid (both old and new UI)

2. Injects color picker into task popup

3. Saves color to `cf.taskColors` in storage

4. Supports both manual colors and list defaults

 

**DOM Selectors** (supports both UIs):

- Old UI: `[data-eventid^="tasks."]`, `[data-eventid^="tasks_"]`

- New UI: `[data-eventid^="ttb_"]` (requires Calendar API resolution)

 

---

 

### Feature 3: Task List Default Colors

 

**Files**: `lib/google-tasks-api.js`, `features/tasks-coloring/index.js`

 

**How It Works**:

1. OAuth grants access to Google Tasks API

2. Builds task→list mapping via API

3. Allows setting default colors per list

4. Priority: manual color > list default > none

 

**State Machine (Smart Polling)**:

```javascript

ACTIVE mode: 5-minute polling (calendar active + recent user activity)

IDLE mode: 15-minute polling (calendar open, no recent activity)

SLEEP mode: Polling paused (no calendar tabs open)

```

 

---

 

### Feature 4: Recurring Task Chain System

 

**Purpose**: Color all instances of a recurring task consistently

 

**Storage Structure**:

```javascript

// Chain ID format: listId|fingerprint (e.g., "MTVxbW...|Meeting|2pm")

// Fingerprint format: title|time (e.g., "Meeting|2pm")

 

{

  "cf.taskIdToChainId": {           // LOCAL storage

    "taskId_abc": "listId|Meeting|2pm",

    "taskId_xyz": "listId|Meeting|2pm"

  },

  "cf.recurringChains": {           // LOCAL storage

    "listId|Meeting|2pm": {

      "fingerprint": "Meeting|2pm",

      "listId": "listId",

      "lastSeen": 1702900000000

    }

  },

  "cf.recurringChainColors": {      // SYNC storage (syncs across devices)

    "listId|Meeting|2pm": "#ff0000"

  }

}

```

 

**Key Principles**:

1. TaskId → ChainId mapping is the source of truth

2. Always check storage, not just cache (cache may be stale)

3. Never overwrite existing chain mappings

4. Require listId match for fingerprint lookups (prevents cross-list pollution)

5. Chain's listId is authoritative for list coloring

 

---

 

### Feature 5: Event Coloring (NEW)

 

**Files**: `features/event-coloring/`

 

**How It Works**:

1. Detects Google Calendar's color picker opening

2. Injects custom color categories below Google's colors

3. Supports recurring events (apply to all/this instance)

4. Preserves calendar's left border color using gradient

5. Updates Google's color preview swatch

 

**Key Components**:

- `EventIdUtils`: Parse/encode calendar event IDs, detect recurring events

- `ScenarioDetector`: Detect EVENTEDIT, LISTVIEW, EVENTVIEW scenarios

- `RecurringEventDialog`: Modal for "Apply to all" vs "This event only"

 

**Storage**:

```javascript

{

  "cf.eventColors": {               // LOCAL storage

    "encodedEventId": {

      "hex": "#ff0000",

      "isRecurring": true,

      "appliedAt": 1702900000000

    }

  }

}

```

 

---

 

### Feature 6: Time Blocking

 

**Files**: `features/time-blocking/`

 

**How It Works**:

1. Renders colored overlays on calendar grid

2. Supports weekly recurring blocks

3. Supports date-specific one-time blocks

4. Multiple shading styles (solid, hashed)

 

---

 

## Storage Schema

 

### Chrome Storage Sync (max 100KB, syncs across devices)

 

```javascript

{

  "settings": { /* see defaultSettings above */ },

  "cf.taskColors": {},                               // Manual task colors

  "cf.taskListColors": {},                           // List default background colors

  "cf.taskListTextColors": {},                       // List text color overrides

  "cf.recurringTaskColors": {},                      // Legacy recurring colors

  "cf.recurringChainColors": {},                     // Chain colors (syncs across devices)

  "customDayColors": []                              // User's custom saved colors

}

```

 

### Chrome Storage Local (max 10MB, device-specific)

 

```javascript

{

  "cf.taskToListMap": {},                            // Task → List mapping cache

  "cf.taskListsMeta": [],                            // Task lists metadata

  "cf.taskIdToChainId": {},                          // Task → Chain mapping

  "cf.recurringChains": {},                          // Chain metadata

  "cf.calendarEventMapping": {},                     // Calendar event → Task ID (new UI)

  "cf.calendarEventMappingMeta": {},                 // Mapping metadata

  "cf.eventColors": {},                              // Event colors

  "cf.stateMachine": {},                             // Polling state machine state

  "cf.chainsMigrated": boolean,                      // Migration flag

  "subscriptionStatus": null,                        // Supabase subscription

  "subscriptionActive": false,                       // Quick-check lock state

  "subscriptionTimestamp": null,                     // Last check timestamp

  "pushSubscription": null,                          // Web Push subscription

  "pendingPushSubscription": null,                   // Pending push registration

  "supabaseSession": {},                             // Supabase session tokens

  "authenticated": boolean,                          // Auth state

  "authTimestamp": number,                           // Auth timestamp

  "firstInstall": boolean,                           // First install flag

  "installDate": number                              // Install timestamp

}

```

 

---

 

## Message Passing

 

### Content → Background

 

```javascript

// Subscription

{ type: 'CHECK_SUBSCRIPTION' }

{ type: 'CHECK_AUTH' }

 

// OAuth

{ type: 'GOOGLE_OAUTH_REQUEST' }

{ type: 'CHECK_OAUTH_STATUS' }

{ type: 'CLEAR_OAUTH_TOKEN' }

 

// Task List Coloring

{ type: 'SYNC_TASK_LISTS', fullSync: boolean }

{ type: 'GET_TASK_LISTS_META' }

{ type: 'NEW_TASK_DETECTED', taskId: string }

{ type: 'GET_LIST_DEFAULT_COLOR', listId: string }

{ type: 'APPLY_LIST_COLOR_TO_EXISTING', listId: string, color: string }

{ type: 'RESET_LIST_COLORS', listId: string, clearPending: boolean, clearCompleted: boolean }

 

// Calendar API (NEW)

{ type: 'RESOLVE_CALENDAR_EVENT', calendarEventId: string }

{ type: 'GET_CALENDAR_COLORS', forceRefresh: boolean }

{ type: 'GET_CALENDAR_COLOR_FOR_EVENT', eventId: string }

 

// Activity Tracking (State Machine)

{ type: 'USER_ACTIVITY' }

{ type: 'CALENDAR_TAB_ACTIVE' }

{ type: 'CALENDAR_TAB_INACTIVE' }

 

// Reset

{ type: 'SETTINGS_RESET_COMPLETE' }

 

// Web Push

{ type: 'ENSURE_PUSH' }

 

// Navigation

{ type: 'OPEN_WEB_APP', path: string }

{ type: 'CLEAR_AUTH' }

```

 

### Background → Content

 

```javascript

{ type: 'TASK_LISTS_UPDATED' }

{ type: 'SUBSCRIPTION_CANCELLED' }

{ type: 'SUBSCRIPTION_UPDATED' }

{ type: 'REPAINT_TASKS', listId: string, color: string }

{ type: 'settingsChanged', feature: string, settings: object }

{ type: 'SETTINGS_RESET' }

{ type: 'EVENT_COLORING_TOGGLED', enabled: boolean }

{ type: 'EVENT_COLORING_SETTINGS_CHANGED' }

```

 

### External Messages (from Web App)

 

```javascript

{ type: 'AUTH_SUCCESS', session: object, subscriptionStatus: object }

{ type: 'PAYMENT_SUCCESS' }

{ type: 'SUBSCRIPTION_CANCELLED' }

{ type: 'LOGOUT' }

{ type: 'PAGE_LOADED' }

```

 

---

 

## API Integrations

 

### Google Tasks API v1

 

**Base URL**: `https://tasks.googleapis.com/tasks/v1`

 

**Endpoints**:

- `GET /users/@me/lists` - List all task lists

- `GET /lists/{listId}/tasks` - Get tasks in a list

 

**OAuth Scope**: `https://www.googleapis.com/auth/tasks.readonly`

 

### Google Calendar API v3

 

**Base URL**: `https://www.googleapis.com/calendar/v3`

 

**Endpoints**:

- `GET /calendars/primary/events/{eventId}` - Get specific event

- `GET /users/me/calendarList` - Get all calendars with colors

 

**OAuth Scope**: `https://www.googleapis.com/auth/calendar.readonly`

 

### Manifest OAuth Configuration

 

```json

{

  "oauth2": {

    "client_id": "373311643778-...",

    "scopes": [

      "https://www.googleapis.com/auth/tasks.readonly",

      "https://www.googleapis.com/auth/calendar.readonly"

    ]

  }

}

```

 

---

 

## Critical Code Patterns

 

### 1. Deep Merge for Settings

 

```javascript

function deepMerge(base, partial) {

  const REPLACE_KEYS = new Set([

    'dateSpecificSchedule',

    'weeklySchedule',

    'pendingTextColors',

    'completedStyling',

  ]);

  // Arrays and REPLACE_KEYS get hard replaced

  // Objects get recursively merged

}

```

 

### 2. Base64 Fallback Lookup

 

```javascript

function lookupWithBase64Fallback(map, taskId) {

  // Try: direct → decoded (atob) → encoded (btoa)

  // Handles encoding differences between API and DOM

}

```

 

### 3. MutationObserver for DOM Changes

 

```javascript

const mo = new MutationObserver((mutations) => {

  // Detect navigation by mutation count

  // Multiple repaint waves to catch async DOM updates

});

```

 

### 4. State Machine for Polling

 

```javascript

// Persisted to storage, survives service worker restarts

let pollingState = 'SLEEP'; // 'ACTIVE' | 'IDLE' | 'SLEEP'

let activeCalendarTabs = new Set();

let lastUserActivity = Date.now();

```

 

### 5. Calendar Event ID Parsing

 

```javascript

function parseEventId(encodedId) {

  // Decode base64

  // Extract email suffix

  // Detect recurring events by _YYYYMMDDTHHMMSSZ suffix

  return { type, decodedId, instanceDate, isRecurring, emailSuffix };

}

```

 

---

 

## Performance Optimizations

 

### 1. In-Memory Caching

 

- Color cache: 30-second lifetime

- Calendar event mapping cache: 30-second lifetime

- Color map cache: 1-second lifetime

- Calendar colors cache: 5-minute lifetime

 

### 2. Parallel API Searches

 

```javascript

// Search all task lists in parallel

const searchPromises = lists.map(async (list) => {...});

const results = await Promise.all(searchPromises);

```

 

### 3. Fast Path for New Tasks

 

```javascript

// Fast path: Search last 30 seconds of updates first

// Fallback: Full search across all lists

```

 

### 4. Debounced Operations

 

- Repaint debounce: 100ms

- Activity reporting: 30-second throttle

 

---

 

## Security & Privacy

 

### Data Storage

 

- **Local only**: All coloring data stays on device

- **Chrome Sync**: Settings sync via Chrome's secure sync

- **No PII**: Extension doesn't send personal data to servers

 

### OAuth Permissions

 

- **Read-only**: Both Tasks and Calendar scopes are read-only

- **Secure tokens**: Managed by Chrome identity API

 

### Subscription Validation

 

- **Fail-open**: Never locks paying users during errors

- **Minimal data**: Only checks subscription status

 

---

 

## Version History

 

### v0.0.5 (December 2025) - Event Coloring & New UI Support

 

- ✨ **NEW: Event Coloring Feature** - Custom colors for calendar events

  - Custom color categories with user-defined palettes

  - Recurring event support ("Apply to all" / "This instance only")

  - Google color label customization

  - Preserves calendar border color with gradient

- ✨ **NEW: New Google Calendar UI Support** (ttb_ prefix)

  - Calendar API integration for event-to-task mapping

  - Calendar colors fetching from API

- ✨ **NEW: Calendar Colors API** - Fetch calendar background colors

- 🔧 **Google Calendar API scope** added to OAuth

- 🔧 **Chain-based recurring task system** improvements

- 🔧 **Default settings** - All features now enabled by default

 

### v0.0.3 (November 2025) - UX Fixes & Polish

 

- 🐛 Fixed: Completed task coloring (`showHidden: true`)

- 🐛 Fixed: Slider flickering and scroll conflicts

- 🐛 Fixed: Setting dependencies - all settings work independently

- 🐛 Fixed: Clear button UX

- ⚡ Smart storage listener prevents DOM destruction

 

### v0.0.2 (January 2025) - Chrome Web Store & Fail-Open

 

- 🔒 Fail-open architecture for subscription validation

- ❌ Removed unused permissions (cookies, notifications)

- ✅ Added identity permission for Google OAuth

 

### v0.0.1 (October 2024) - Initial Release

 

- ✨ Calendar day coloring with per-day opacity

- ✨ Individual task coloring

- ✨ Task List Default Colors

- ✨ Time blocking

- ⚡ In-memory cache for performance

 

---

 

## Development Notes

 

### Building & Testing

 

1. Open Chrome → `chrome://extensions`

2. Enable "Developer mode"

3. Click "Load unpacked"

4. Select `Main Extension` folder

 

### Debugging

 

```javascript

// Check storage

chrome.storage.sync.get(null, console.log);

chrome.storage.local.get(null, console.log);

 

// Check event coloring

window.cfEventColoring.refreshColors();

window.cfEventColoring.findColorForEvent(eventId);

```

 

### Common Pitfalls

 

1. **Base64 encoding**: Task IDs are base64 in API, may be decoded in DOM

2. **New UI (ttb_)**: Requires Calendar API to resolve task IDs

3. **Service worker lifecycle**: State must be persisted to storage

4. **Chain system**: Always check storage, not just cache

 

---

 

**End of CLAUDE.md** - Last updated December 18, 2025
