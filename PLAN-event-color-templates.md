# Event Color Template Builder - Implementation Plan

## Overview

Add an **Event Color Template Builder** feature that allows users to create, manage, and apply multi-property color presets (background, text, border, borderWidth) to calendar events.

---

## Feature Requirements

### Core Functionality
1. **Template Properties**: Each template stores `background`, `text`, `border`, `borderWidth`
2. **Template Management**: Create, edit, delete, rename, reorder templates
3. **Category Assignment**: Templates can optionally be assigned to categories
4. **Display Logic**:
   - **Unassigned templates** → Appear in dedicated "Templates" section (below categories)
   - **Assigned templates** → Appear ONLY within their assigned category section (BELOW simple colors)
   - A template NEVER appears in both places (no duplicates)
5. **Drag-to-Reorder**: Templates can be reordered via drag-and-drop
6. **No Limit**: Unlimited templates allowed

### Injected UI Design Decision
**Mini-Preview Approach**: Template buttons in the injected color picker use a compact mini-preview design:
- The button itself IS the preview (uses bg color as background, text color for the label, border styling)
- The template name is the text content
- This is space-efficient and shows the actual visual result
```
┌─────────────────────────────┐
│  Professional Meeting       │  ← bg=#1a73e8, text=#fff, border=#1557b0 2px
└─────────────────────────────┘
┌─────────────────────────────┐
│  Urgent Deadline            │  ← bg=#d93025, text=#fff, border=#a50e0e 3px
└─────────────────────────────┘
```

---

## Data Structures

### New Template Schema
```javascript
// Storage: settings.eventColoring.templates
{
  "tmpl_1702900000000": {
    "id": "tmpl_1702900000000",
    "name": "Professional Meeting",
    "background": "#1a73e8",
    "text": "#ffffff",
    "border": "#1557b0",
    "borderWidth": 2,
    "categoryId": null,           // null = unassigned, or "cat_xxx" = assigned
    "order": 0,
    "createdAt": 1702900000000,
    "updatedAt": 1702900000000
  },
  "tmpl_1702900001000": {
    "id": "tmpl_1702900001000",
    "name": "Urgent Deadline",
    "background": "#d93025",
    "text": "#ffffff",
    "border": "#a50e0e",
    "borderWidth": 3,
    "categoryId": "cat_abc123",   // Assigned to category
    "order": 1,
    "createdAt": 1702900001000,
    "updatedAt": 1702900001000
  }
}
```

### Category Schema (unchanged, for reference)
```javascript
{
  "cat_abc123": {
    "id": "cat_abc123",
    "name": "Work Colors",
    "colors": [
      { "hex": "#FF6B6B", "label": "Meeting" }
    ],
    "order": 0
  }
}
```

---

## Implementation Phases

---

## Phase 1: Storage Layer

### File: `lib/storage.js`

#### New Functions to Add:

```javascript
// ============ EVENT COLOR TEMPLATES ============

/**
 * Get all event color templates
 * @returns {Promise<Object>} - { templateId: templateData, ... }
 */
async function getEventColorTemplates() {
  const settings = await getSettings();
  return settings?.eventColoring?.templates || {};
}

/**
 * Get a single template by ID
 * @param {string} templateId
 * @returns {Promise<Object|null>}
 */
async function getEventColorTemplate(templateId) {
  const templates = await getEventColorTemplates();
  return templates[templateId] || null;
}

/**
 * Save/update an event color template
 * @param {Object} template - Template object with id, name, background, text, border, borderWidth, categoryId, order
 * @returns {Promise<void>}
 */
async function setEventColorTemplate(template) {
  if (!template.id) {
    template.id = `tmpl_${Date.now()}`;
  }
  template.updatedAt = Date.now();
  if (!template.createdAt) {
    template.createdAt = template.updatedAt;
  }

  const settings = await getSettings();
  if (!settings.eventColoring) settings.eventColoring = {};
  if (!settings.eventColoring.templates) settings.eventColoring.templates = {};

  settings.eventColoring.templates[template.id] = template;
  await saveSettings(settings);
}

/**
 * Delete an event color template
 * @param {string} templateId
 * @returns {Promise<void>}
 */
async function deleteEventColorTemplate(templateId) {
  const settings = await getSettings();
  if (settings?.eventColoring?.templates?.[templateId]) {
    delete settings.eventColoring.templates[templateId];
    await saveSettings(settings);
  }
}

/**
 * Reorder templates (update order field for multiple templates)
 * @param {Array<{id: string, order: number}>} orderUpdates
 * @returns {Promise<void>}
 */
async function reorderEventColorTemplates(orderUpdates) {
  const settings = await getSettings();
  if (!settings?.eventColoring?.templates) return;

  for (const update of orderUpdates) {
    if (settings.eventColoring.templates[update.id]) {
      settings.eventColoring.templates[update.id].order = update.order;
      settings.eventColoring.templates[update.id].updatedAt = Date.now();
    }
  }
  await saveSettings(settings);
}

/**
 * Get templates for a specific category (assigned to it)
 * @param {string} categoryId
 * @returns {Promise<Array>} - Sorted array of templates
 */
async function getTemplatesForCategory(categoryId) {
  const templates = await getEventColorTemplates();
  return Object.values(templates)
    .filter(t => t.categoryId === categoryId)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

/**
 * Get unassigned templates (not assigned to any category)
 * @returns {Promise<Array>} - Sorted array of templates
 */
async function getUnassignedTemplates() {
  const templates = await getEventColorTemplates();
  return Object.values(templates)
    .filter(t => !t.categoryId)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

/**
 * Assign template to a category
 * @param {string} templateId
 * @param {string|null} categoryId - null to unassign
 * @returns {Promise<void>}
 */
async function assignTemplateToCategory(templateId, categoryId) {
  const template = await getEventColorTemplate(templateId);
  if (template) {
    template.categoryId = categoryId;
    await setEventColorTemplate(template);
  }
}
```

#### Export Updates:
```javascript
// Add to window.cc3Storage exports
window.cc3Storage = {
  // ... existing exports ...
  getEventColorTemplates,
  getEventColorTemplate,
  setEventColorTemplate,
  deleteEventColorTemplate,
  reorderEventColorTemplates,
  getTemplatesForCategory,
  getUnassignedTemplates,
  assignTemplateToCategory,
};
```

---

## Phase 2: Popup UI - Template List Section

### File: `popup/popup.html`

#### Add after Categories section (around line 4637):

```html
<!-- Event Color Templates Section -->
<div class="feature-section" id="eventColorTemplatesSection" style="margin-top: 24px;">
  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
    <div style="display: flex; align-items: center; gap: 8px;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5f6368" stroke-width="2">
        <rect x="3" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
      <span style="font-weight: 600; font-size: 14px; color: #202124;">Color Templates</span>
    </div>
    <button id="addEventColorTemplateBtn" class="action-button-secondary" style="padding: 6px 12px; font-size: 12px;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      New Template
    </button>
  </div>

  <!-- Info card -->
  <div id="templateInfoCard" class="info-card" style="margin-bottom: 16px; padding: 12px; background: #f8f9fa; border-radius: 8px; border: 1px solid #e8eaed;">
    <div style="display: flex; align-items: flex-start; gap: 8px;">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5f6368" stroke-width="2" style="flex-shrink: 0; margin-top: 2px;">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="16" x2="12" y2="12"/>
        <line x1="12" y1="8" x2="12" y2="8"/>
      </svg>
      <div style="font-size: 12px; color: #5f6368; line-height: 1.5;">
        Templates save complete color styles (background, text, border) for quick application.
        Assign templates to categories to organize them, or leave unassigned to show them in their own section.
      </div>
    </div>
  </div>

  <!-- Templates List Container -->
  <div id="eventColorTemplatesList" class="templates-list">
    <!-- Rendered by JavaScript -->
  </div>
</div>
```

---

## Phase 3: Popup UI - Template Management Logic

### File: `popup/popup.js`

#### Add Template State Variable (near other eventColoring state):
```javascript
let eventColorTemplates = {};
```

#### Add in initialization (after loading eventColoring settings):
```javascript
// Load templates
eventColorTemplates = await window.cc3Storage.getEventColorTemplates();
renderEventColorTemplates();
```

#### Main Render Function:
```javascript
async function renderEventColorTemplates() {
  const container = document.getElementById('eventColorTemplatesList');
  if (!container) return;

  const templates = await window.cc3Storage.getUnassignedTemplates();

  if (templates.length === 0) {
    container.innerHTML = `
      <div style="padding: 24px; text-align: center; color: #64748b; font-size: 13px; background: #fafafa; border-radius: 8px; border: 1px dashed #e0e0e0;">
        <div style="margin-bottom: 8px;">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5">
            <rect x="3" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/>
            <rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
        </div>
        <div style="font-weight: 500; margin-bottom: 4px;">No templates yet</div>
        <div>Click "New Template" to create your first color preset</div>
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

  // Initialize drag-and-drop
  initTemplatesDragDrop(sortableContainer);
}
```

#### Template Element Creator:
```javascript
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

  // Create color preview swatches
  const previewHtml = `
    <div class="template-color-preview" style="display: flex; gap: 6px; align-items: center;">
      <div title="Background" style="width: 20px; height: 20px; border-radius: 4px; background: ${template.background}; border: 1px solid rgba(0,0,0,0.1);"></div>
      <div title="Text" style="width: 20px; height: 20px; border-radius: 4px; background: ${template.text}; border: 1px solid rgba(0,0,0,0.1);"></div>
      <div title="Border" style="width: 20px; height: 20px; border-radius: 4px; background: ${template.border}; border: 1px solid rgba(0,0,0,0.1);"></div>
      <div title="Border Width" style="font-size: 11px; color: #666; padding: 2px 6px; background: #f0f0f0; border-radius: 4px;">${template.borderWidth}px</div>
    </div>
  `;

  // Live preview mini-event
  const miniPreviewHtml = `
    <div class="template-mini-preview" style="
      margin-top: 8px;
      padding: 6px 10px;
      border-radius: 4px;
      background: ${template.background};
      color: ${template.text};
      border: ${template.borderWidth}px solid ${template.border};
      font-size: 11px;
      font-weight: 500;
    ">
      Sample Event
    </div>
  `;

  div.innerHTML = `
    <div class="template-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
      <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
        <div class="drag-handle" style="cursor: grab; color: #9ca3af; display: flex; align-items: center;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
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
          style="border: none; background: transparent; font-weight: 500; font-size: 13px; color: #202124; flex: 1; padding: 4px 0;"
        />
      </div>
      <div class="template-actions" style="display: flex; gap: 4px;">
        <button class="edit-template-btn icon-btn" data-template-id="${template.id}" title="Edit Template" style="padding: 4px; border: none; background: none; cursor: pointer; color: #5f6368; border-radius: 4px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="delete-template-btn icon-btn" data-template-id="${template.id}" title="Delete Template" style="padding: 4px; border: none; background: none; cursor: pointer; color: #5f6368; border-radius: 4px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    </div>
    ${previewHtml}
    ${miniPreviewHtml}
    <div class="template-category-assign" style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #f0f0f0;">
      <label style="font-size: 11px; color: #666; display: flex; align-items: center; gap: 6px;">
        <span>Assign to category:</span>
        <select class="template-category-select" data-template-id="${template.id}" style="font-size: 11px; padding: 4px 8px; border: 1px solid #e0e0e0; border-radius: 4px; background: #fff;">
          <option value="">— None (show in Templates) —</option>
          <!-- Categories populated by JS -->
        </select>
      </label>
    </div>
  `;

  // Hover effects
  div.addEventListener('mouseenter', () => {
    div.style.borderColor = '#1a73e8';
    div.style.boxShadow = '0 2px 8px rgba(26, 115, 232, 0.15)';
  });
  div.addEventListener('mouseleave', () => {
    div.style.borderColor = '#e0e0e0';
    div.style.boxShadow = 'none';
  });

  // Event listeners
  setupTemplateEventListeners(div, template);

  // Populate category dropdown
  populateTemplateCategoryDropdown(div.querySelector('.template-category-select'), template.categoryId);

  return div;
}
```

#### Template Event Listeners:
```javascript
function setupTemplateEventListeners(element, template) {
  // Name input blur - save name
  const nameInput = element.querySelector('.template-name-input');
  nameInput.addEventListener('blur', async (e) => {
    const newName = e.target.value.trim();
    if (newName && newName !== template.name) {
      template.name = newName;
      await window.cc3Storage.setEventColorTemplate(template);
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
    }
  });

  // Category assignment dropdown
  const categorySelect = element.querySelector('.template-category-select');
  categorySelect.addEventListener('change', async (e) => {
    const categoryId = e.target.value || null;
    await window.cc3Storage.assignTemplateToCategory(template.id, categoryId);
    await renderEventColorTemplates();
    await renderEventColorCategories();
  });
}

function populateTemplateCategoryDropdown(selectElement, currentCategoryId) {
  const categories = Object.values(eventColoringSettings.categories || {})
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  for (const category of categories) {
    const option = document.createElement('option');
    option.value = category.id;
    option.textContent = category.name;
    option.selected = category.id === currentCategoryId;
    selectElement.appendChild(option);
  }
}
```

#### Drag-and-Drop Implementation:
```javascript
function initTemplatesDragDrop(container) {
  let draggedItem = null;
  let draggedOverItem = null;

  container.addEventListener('dragstart', (e) => {
    if (e.target.classList.contains('event-color-template')) {
      draggedItem = e.target;
      e.target.style.opacity = '0.5';
      e.dataTransfer.effectAllowed = 'move';
    }
  });

  container.addEventListener('dragend', (e) => {
    if (e.target.classList.contains('event-color-template')) {
      e.target.style.opacity = '1';
      draggedItem = null;

      // Save new order
      saveTemplatesOrder(container);
    }
  });

  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    const target = e.target.closest('.event-color-template');
    if (target && target !== draggedItem) {
      draggedOverItem = target;
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
}
```

#### New Template Button Handler:
```javascript
document.getElementById('addEventColorTemplateBtn').addEventListener('click', () => {
  openTemplateEditorModal(null); // null = create new
});
```

---

## Phase 4: Template Editor Modal

### File: `popup/popup.js` (add modal functions)

#### Or create new file: `popup/components/TemplateEditorModal.js`

```javascript
function openTemplateEditorModal(existingTemplate = null) {
  const isEdit = !!existingTemplate;

  // Default values for new template
  const template = existingTemplate || {
    id: null,
    name: '',
    background: '#1a73e8',
    text: '#ffffff',
    border: '#1557b0',
    borderWidth: 2,
    categoryId: null
  };

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

  // Create modal
  const modal = document.createElement('div');
  modal.className = 'template-editor-modal';
  modal.style.cssText = `
    background: #fff;
    border-radius: 12px;
    width: 380px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  `;

  modal.innerHTML = `
    <div class="modal-header" style="padding: 16px 20px; border-bottom: 1px solid #e0e0e0; display: flex; justify-content: space-between; align-items: center;">
      <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #202124;">
        ${isEdit ? 'Edit Template' : 'Create New Template'}
      </h3>
      <button class="modal-close-btn" style="background: none; border: none; cursor: pointer; padding: 4px; color: #5f6368;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>

    <div class="modal-body" style="padding: 20px;">
      <!-- Template Name -->
      <div class="form-group" style="margin-bottom: 20px;">
        <label style="display: block; font-size: 12px; font-weight: 500; color: #5f6368; margin-bottom: 6px;">Template Name</label>
        <input type="text" id="templateNameInput" value="${escapeHtml(template.name)}" placeholder="e.g., Professional Meeting" style="width: 100%; padding: 10px 12px; border: 1px solid #e0e0e0; border-radius: 6px; font-size: 14px; box-sizing: border-box;">
      </div>

      <!-- Live Preview -->
      <div class="form-group" style="margin-bottom: 20px;">
        <label style="display: block; font-size: 12px; font-weight: 500; color: #5f6368; margin-bottom: 6px;">Preview</label>
        <div id="templateLivePreview" style="
          padding: 12px 16px;
          border-radius: 6px;
          background: ${template.background};
          color: ${template.text};
          border: ${template.borderWidth}px solid ${template.border};
          font-size: 13px;
          font-weight: 500;
        ">
          <div style="font-weight: 600;">Sample Event Title</div>
          <div style="font-size: 11px; opacity: 0.9; margin-top: 2px;">10:00 AM - 11:00 AM</div>
        </div>
      </div>

      <!-- Color Inputs -->
      <div class="color-inputs-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
        <div class="form-group">
          <label style="display: block; font-size: 12px; font-weight: 500; color: #5f6368; margin-bottom: 6px;">Background</label>
          <div style="display: flex; gap: 8px; align-items: center;">
            <input type="color" id="templateBgColor" value="${template.background}" style="width: 40px; height: 32px; border: 1px solid #e0e0e0; border-radius: 4px; cursor: pointer; padding: 2px;">
            <input type="text" id="templateBgHex" value="${template.background}" style="flex: 1; padding: 6px 8px; border: 1px solid #e0e0e0; border-radius: 4px; font-size: 12px; font-family: monospace;">
          </div>
        </div>

        <div class="form-group">
          <label style="display: block; font-size: 12px; font-weight: 500; color: #5f6368; margin-bottom: 6px;">Text</label>
          <div style="display: flex; gap: 8px; align-items: center;">
            <input type="color" id="templateTextColor" value="${template.text}" style="width: 40px; height: 32px; border: 1px solid #e0e0e0; border-radius: 4px; cursor: pointer; padding: 2px;">
            <input type="text" id="templateTextHex" value="${template.text}" style="flex: 1; padding: 6px 8px; border: 1px solid #e0e0e0; border-radius: 4px; font-size: 12px; font-family: monospace;">
          </div>
        </div>

        <div class="form-group">
          <label style="display: block; font-size: 12px; font-weight: 500; color: #5f6368; margin-bottom: 6px;">Border</label>
          <div style="display: flex; gap: 8px; align-items: center;">
            <input type="color" id="templateBorderColor" value="${template.border}" style="width: 40px; height: 32px; border: 1px solid #e0e0e0; border-radius: 4px; cursor: pointer; padding: 2px;">
            <input type="text" id="templateBorderHex" value="${template.border}" style="flex: 1; padding: 6px 8px; border: 1px solid #e0e0e0; border-radius: 4px; font-size: 12px; font-family: monospace;">
          </div>
        </div>

        <div class="form-group">
          <label style="display: block; font-size: 12px; font-weight: 500; color: #5f6368; margin-bottom: 6px;">Border Width</label>
          <div style="display: flex; gap: 8px; align-items: center;">
            <input type="range" id="templateBorderWidth" value="${template.borderWidth}" min="0" max="5" step="1" style="flex: 1;">
            <span id="templateBorderWidthValue" style="font-size: 12px; color: #5f6368; min-width: 30px;">${template.borderWidth}px</span>
          </div>
        </div>
      </div>

      <!-- Category Assignment (optional) -->
      <div class="form-group" style="margin-bottom: 20px;">
        <label style="display: block; font-size: 12px; font-weight: 500; color: #5f6368; margin-bottom: 6px;">Assign to Category (optional)</label>
        <select id="templateCategorySelect" style="width: 100%; padding: 10px 12px; border: 1px solid #e0e0e0; border-radius: 6px; font-size: 13px; background: #fff;">
          <option value="">— None (show in Templates section) —</option>
          <!-- Populated by JS -->
        </select>
      </div>
    </div>

    <div class="modal-footer" style="padding: 16px 20px; border-top: 1px solid #e0e0e0; display: flex; justify-content: flex-end; gap: 12px;">
      <button class="modal-cancel-btn" style="padding: 10px 20px; border: 1px solid #e0e0e0; background: #fff; border-radius: 6px; font-size: 13px; cursor: pointer; color: #5f6368;">
        Cancel
      </button>
      <button class="modal-save-btn" style="padding: 10px 20px; border: none; background: #1a73e8; color: #fff; border-radius: 6px; font-size: 13px; cursor: pointer; font-weight: 500;">
        ${isEdit ? 'Save Changes' : 'Create Template'}
      </button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Populate category dropdown
  const categorySelect = modal.querySelector('#templateCategorySelect');
  const categories = Object.values(eventColoringSettings.categories || {})
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  for (const cat of categories) {
    const option = document.createElement('option');
    option.value = cat.id;
    option.textContent = cat.name;
    option.selected = cat.id === template.categoryId;
    categorySelect.appendChild(option);
  }

  // Setup live preview updates
  const preview = modal.querySelector('#templateLivePreview');
  const bgColor = modal.querySelector('#templateBgColor');
  const bgHex = modal.querySelector('#templateBgHex');
  const textColor = modal.querySelector('#templateTextColor');
  const textHex = modal.querySelector('#templateTextHex');
  const borderColor = modal.querySelector('#templateBorderColor');
  const borderHex = modal.querySelector('#templateBorderHex');
  const borderWidth = modal.querySelector('#templateBorderWidth');
  const borderWidthValue = modal.querySelector('#templateBorderWidthValue');

  function updatePreview() {
    preview.style.background = bgHex.value;
    preview.style.color = textHex.value;
    preview.style.border = `${borderWidth.value}px solid ${borderHex.value}`;
  }

  // Sync color picker and hex input
  bgColor.addEventListener('input', () => { bgHex.value = bgColor.value; updatePreview(); });
  bgHex.addEventListener('input', () => { bgColor.value = bgHex.value; updatePreview(); });
  textColor.addEventListener('input', () => { textHex.value = textColor.value; updatePreview(); });
  textHex.addEventListener('input', () => { textColor.value = textHex.value; updatePreview(); });
  borderColor.addEventListener('input', () => { borderHex.value = borderColor.value; updatePreview(); });
  borderHex.addEventListener('input', () => { borderColor.value = borderHex.value; updatePreview(); });
  borderWidth.addEventListener('input', () => { borderWidthValue.textContent = borderWidth.value + 'px'; updatePreview(); });

  // Close handlers
  const closeModal = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  modal.querySelector('.modal-close-btn').addEventListener('click', closeModal);
  modal.querySelector('.modal-cancel-btn').addEventListener('click', closeModal);

  // Escape key
  const escHandler = (e) => { if (e.key === 'Escape') { closeModal(); document.removeEventListener('keydown', escHandler); } };
  document.addEventListener('keydown', escHandler);

  // Save handler
  modal.querySelector('.modal-save-btn').addEventListener('click', async () => {
    const name = modal.querySelector('#templateNameInput').value.trim();
    if (!name) {
      alert('Please enter a template name');
      return;
    }

    const newTemplate = {
      id: template.id || `tmpl_${Date.now()}`,
      name,
      background: bgHex.value,
      text: textHex.value,
      border: borderHex.value,
      borderWidth: parseInt(borderWidth.value, 10),
      categoryId: categorySelect.value || null,
      order: template.order ?? Object.keys(await window.cc3Storage.getEventColorTemplates()).length,
      createdAt: template.createdAt,
      updatedAt: Date.now()
    };

    await window.cc3Storage.setEventColorTemplate(newTemplate);
    closeModal();
    await renderEventColorTemplates();
    await renderEventColorCategories();
  });

  // Focus name input
  modal.querySelector('#templateNameInput').focus();
}
```

---

## Phase 5: Injected Color Picker - Template Display

### File: `features/event-coloring/index.js`

#### Modify `injectCustomCategories()` to include templates:

```javascript
async function injectCustomCategories(colorPickerElement) {
  // ... existing validation code ...

  // Add separator after Google colors
  // ... existing separator code ...

  // ========== NEW: TEMPLATES SECTION ==========
  const unassignedTemplates = await window.cc3Storage.getUnassignedTemplates();

  if (unassignedTemplates.length > 0) {
    const templatesSection = createTemplatesSection(unassignedTemplates, colorPickerElement, scenario);
    parentContainer.appendChild(templatesSection);
  }
  // ========== END TEMPLATES SECTION ==========

  // Add categories (now also check for assigned templates)
  const categoriesArray = Object.values(categories).sort((a, b) => (a.order || 0) - (b.order || 0));

  for (const category of categoriesArray) {
    // Get templates assigned to this category
    const categoryTemplates = await window.cc3Storage.getTemplatesForCategory(category.id);

    const section = createCategorySectionWithTemplates(category, categoryTemplates, colorPickerElement, scenario);
    if (section) {
      parentContainer.appendChild(section);
    }
  }

  // ... rest of existing code (custom color button, etc.) ...
}
```

#### New Function: Create Templates Section:
```javascript
function createTemplatesSection(templates, pickerElement, scenario) {
  const section = document.createElement('div');
  section.style.cssText = 'margin-top: 16px; padding: 0 12px;';
  section.className = 'cf-templates-section';

  // Label
  const label = document.createElement('div');
  label.textContent = 'TEMPLATES';
  label.style.cssText = `
    font-size: 11px;
    font-weight: 600;
    color: #5f6368;
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    display: flex;
    align-items: center;
    gap: 6px;
  `;

  // Add icon
  const icon = document.createElement('span');
  icon.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="3" y="3" width="7" height="7" rx="1"/>
    <rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/>
    <rect x="14" y="14" width="7" height="7" rx="1"/>
  </svg>`;
  label.prepend(icon);

  // Template buttons container
  const templatesGrid = document.createElement('div');
  templatesGrid.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 8px;
  `;

  templates.forEach((template) => {
    const button = createTemplateButton(template, pickerElement, scenario);
    templatesGrid.appendChild(button);
  });

  section.appendChild(label);
  section.appendChild(templatesGrid);

  return section;
}
```

#### New Function: Create Template Button:
```javascript
function createTemplateButton(template, pickerElement, scenario) {
  const button = document.createElement('div');
  button.className = 'cf-template-button';
  button.setAttribute('role', 'button');
  button.setAttribute('tabindex', '0');
  button.setAttribute('aria-label', template.name);
  button.dataset.templateId = template.id;

  button.style.cssText = `
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    background: #f8f9fa;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
  `;

  // Color swatches preview
  const swatchesHtml = `
    <div style="display: flex; gap: 4px; align-items: center;">
      <div style="width: 16px; height: 16px; border-radius: 3px; background: ${template.background}; border: 1px solid rgba(0,0,0,0.1);"></div>
      <div style="width: 16px; height: 16px; border-radius: 3px; background: ${template.text}; border: 1px solid rgba(0,0,0,0.1);"></div>
      <div style="width: 16px; height: 16px; border-radius: 3px; background: ${template.border}; border: 1px solid rgba(0,0,0,0.1);"></div>
    </div>
  `;

  button.innerHTML = `
    ${swatchesHtml}
    <span style="font-size: 12px; font-weight: 500; color: #202124; flex: 1;">${escapeHtml(template.name)}</span>
    <span style="font-size: 10px; color: #9aa0a6;">${template.borderWidth}px</span>
  `;

  // Hover effects
  button.addEventListener('mouseenter', () => {
    button.style.background = '#e8f0fe';
    button.style.borderColor = '#1a73e8';
  });
  button.addEventListener('mouseleave', () => {
    button.style.background = '#f8f9fa';
    button.style.borderColor = '#e0e0e0';
  });

  // Click handler - apply template
  button.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const eventId = getEventIdFromContext(pickerElement, scenario);
    if (eventId) {
      await applyTemplate(eventId, template);
    }
  });

  // Keyboard support
  button.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      button.click();
    }
  });

  return button;
}
```

#### New Function: Apply Template:
```javascript
async function applyTemplate(eventId, template) {
  const colors = {
    background: template.background,
    text: template.text,
    border: template.border,
    borderWidth: template.borderWidth
  };

  // Check if recurring event
  const isRecurring = EventIdUtils.isRecurringEvent(eventId);

  if (isRecurring) {
    // Show recurring event dialog
    showRecurringEventDialog(eventId, colors);
  } else {
    // Apply directly
    await handleFullColorSelection(eventId, colors, false);
  }
}
```

#### Modify `createCategorySection()` to include assigned templates:
```javascript
function createCategorySectionWithTemplates(category, templates, pickerElement, scenario) {
  const section = document.createElement('div');
  section.style.cssText = 'margin-top: 16px; padding: 0 12px;';
  section.className = COLOR_PICKER_SELECTORS.CUSTOM_CLASSES.CATEGORY_SECTION;

  // Label
  const label = document.createElement('div');
  label.textContent = category.name;
  label.style.cssText = `
    font-size: 11px;
    font-weight: 600;
    color: #5f6368;
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  `;

  section.appendChild(label);

  // ========== TEMPLATES assigned to this category ==========
  if (templates && templates.length > 0) {
    const templatesContainer = document.createElement('div');
    templatesContainer.style.cssText = 'display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px;';

    templates.forEach((template) => {
      const button = createTemplateButton(template, pickerElement, scenario);
      templatesContainer.appendChild(button);
    });

    section.appendChild(templatesContainer);
  }

  // ========== COLORS in category (existing logic) ==========
  const colors = category.colors || [];
  if (colors.length > 0) {
    const colorGrid = document.createElement('div');
    colorGrid.className = COLOR_PICKER_SELECTORS.CUSTOM_CLASSES.COLOR_DIV_GROUP;
    colorGrid.style.cssText = `
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 8px;
    `;

    colors.forEach((color) => {
      const button = createColorButton(color, pickerElement, scenario);
      colorGrid.appendChild(button);
    });

    section.appendChild(colorGrid);
  }

  // If neither templates nor colors, show empty state
  if ((!templates || templates.length === 0) && colors.length === 0) {
    const emptyNote = document.createElement('div');
    emptyNote.textContent = 'No colors or templates in this category';
    emptyNote.style.cssText = 'font-size: 11px; color: #9aa0a6; font-style: italic;';
    section.appendChild(emptyNote);
  }

  return section;
}
```

---

## Phase 6: Categories UI Update (Popup)

### Show assigned templates in category cards

#### Modify `createCategoryElement()` in popup.js:

```javascript
async function createCategoryElement(category) {
  const div = document.createElement('div');
  // ... existing code ...

  // Get templates assigned to this category
  const assignedTemplates = await window.cc3Storage.getTemplatesForCategory(category.id);

  // Build templates HTML
  let templatesHtml = '';
  if (assignedTemplates.length > 0) {
    templatesHtml = `
      <div class="category-templates" style="margin-bottom: 10px;">
        <div style="font-size: 10px; color: #9ca3af; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Templates</div>
        <div style="display: flex; flex-direction: column; gap: 4px;">
          ${assignedTemplates.map(t => `
            <div class="category-template-item" data-template-id="${t.id}" style="
              display: flex;
              align-items: center;
              gap: 8px;
              padding: 6px 8px;
              background: #f8f9fa;
              border-radius: 4px;
              font-size: 11px;
            ">
              <div style="display: flex; gap: 3px;">
                <div style="width: 12px; height: 12px; border-radius: 2px; background: ${t.background};"></div>
                <div style="width: 12px; height: 12px; border-radius: 2px; background: ${t.text};"></div>
                <div style="width: 12px; height: 12px; border-radius: 2px; background: ${t.border};"></div>
              </div>
              <span style="flex: 1; color: #374151;">${escapeHtml(t.name)}</span>
              <button class="unassign-template-btn" data-template-id="${t.id}" title="Remove from category" style="
                background: none;
                border: none;
                cursor: pointer;
                color: #9ca3af;
                padding: 2px;
                line-height: 1;
              ">×</button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // Insert templates HTML before colors
  div.innerHTML = `
    <div class="category-header">
      <!-- ... existing header ... -->
    </div>
    ${templatesHtml}
    <div class="category-color-grid">
      <!-- ... existing colors ... -->
    </div>
  `;

  // Add unassign handlers
  div.querySelectorAll('.unassign-template-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const templateId = btn.dataset.templateId;
      await window.cc3Storage.assignTemplateToCategory(templateId, null);
      await renderEventColorTemplates();
      await renderEventColorCategories();
    });
  });

  return div;
}
```

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `lib/storage.js` | MODIFY | Add template CRUD functions |
| `popup/popup.html` | MODIFY | Add Templates section HTML |
| `popup/popup.js` | MODIFY | Add template rendering, editor modal, drag-drop |
| `features/event-coloring/index.js` | MODIFY | Inject templates in color picker, template application |

---

## Testing Checklist

### Storage
- [ ] Create template saves correctly
- [ ] Edit template updates correctly
- [ ] Delete template removes correctly
- [ ] Reorder persists order
- [ ] Category assignment persists
- [ ] Unassignment moves template back to Templates section

### Popup UI
- [ ] Empty state shows when no templates
- [ ] New Template button opens modal
- [ ] Live preview updates correctly
- [ ] Color pickers sync with hex inputs
- [ ] Template cards display all properties
- [ ] Drag-and-drop reorders templates
- [ ] Name editing saves on blur
- [ ] Delete confirmation works
- [ ] Category dropdown populates correctly
- [ ] Assigned templates appear in category cards
- [ ] Unassign button works

### Injected Color Picker
- [ ] Templates section appears (when unassigned templates exist)
- [ ] Template buttons render correctly
- [ ] Hover effects work
- [ ] Click applies all 4 color properties
- [ ] Recurring event dialog appears for recurring events
- [ ] Templates in categories appear within category section
- [ ] Templates don't duplicate across sections

### Edge Cases
- [ ] No categories exist - template dropdown shows "None"
- [ ] Category deleted - assigned templates become unassigned
- [ ] Empty template name rejected
- [ ] Invalid hex colors handled
- [ ] Border width 0 works correctly
- [ ] Very long template names truncate properly

---

## Future Enhancements (Out of Scope)

- Import/export templates
- Template sharing
- Template presets library
- Quick apply keyboard shortcuts
- Template search/filter
