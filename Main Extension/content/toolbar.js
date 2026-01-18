(function () {
  const state = {
    settings: null,
    collapsed: true,
    activePanel: null, // 'color' | 'block' | null
    // Day coloring state
    colorMode: 'recurring', // 'recurring' | 'specific'
    colorSelectedDay: new Date().getDay(), // 0-6 for weekday
    colorSelectedDate: null, // YYYY-MM-DD for specific date
    colorActiveTab: 'vibrant', // 'vibrant' | 'pastel' | 'dark' | 'custom'
    selectedColor: null,
    selectedOpacity: 30,
    // Time blocking state
    blockMode: 'recurring', // 'recurring' | 'specific'
    blockSelectedDay: new Date().getDay(),
    blockSelectedDate: null,
    blockStartTime: '09:00',
    blockEndTime: '10:00',
    selectedBlockColor: '#FFEB3B',
    blockActiveTab: 'vibrant',
    blockLabel: '',
    blockShadingStyle: 'solid',
    // Anti-flicker flags
    isRendering: false,
    pendingRender: false,
  };

  // Day names
  const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Color palettes
  const VIBRANT_COLORS = [
    '#d50000', '#ff1744', '#f44336', '#ff5722', '#ff9800', '#ffc107',
    '#ffeb3b', '#cddc39', '#8bc34a', '#4caf50', '#00e676', '#1de9b6',
    '#009688', '#00e5ff', '#00bcd4', '#00b0ff', '#03a9f4', '#2196f3',
    '#2979ff', '#3d5afe', '#651fff', '#3f51b5', '#673ab7', '#aa00ff',
    '#9c27b0', '#e91e63', '#c2185b', '#ad1457', '#880e4f', '#4a148c',
    '#795548', '#607d8b', '#9e9e9e', '#000000', '#ffffff'
  ];

  const PASTEL_COLORS = [
    '#f8bbd9', '#f48fb1', '#f06292', '#ec407a', '#e1bee7', '#d1c4e9',
    '#ce93d8', '#ba68c8', '#ab47bc', '#c8e6c9', '#a5d6a7', '#81c784',
    '#66bb6a', '#dcedc8', '#bbdefb', '#90caf9', '#64b5f6', '#42a5f5',
    '#b3e5fc', '#b2ebf2', '#80deea', '#4dd0e1', '#26c6da', '#f0f4c3',
    '#fff9c4', '#fff59d', '#fff176', '#ffee58', '#ffe0b2', '#ffccbc',
    '#ffab91', '#ff8a65', '#ff7043', '#d7ccc8', '#bcaaa4', '#a1887f',
    '#8d6e63', '#e0e0e0', '#bdbdbd'
  ];

  const DARK_COLORS = [
    '#b71c1c', '#c62828', '#d32f2f', '#880e4f', '#4a148c', '#6a1b9a',
    '#7b1fa2', '#8e24aa', '#311b92', '#0d47a1', '#1565c0', '#1976d2',
    '#1e88e5', '#01579b', '#004d40', '#00695c', '#00796b', '#00897b',
    '#1b5e20', '#2e7d32', '#388e3c', '#43a047', '#33691e', '#bf360c',
    '#d84315', '#e64100', '#ff3d00', '#3e2723', '#212121', '#424242',
    '#616161', '#757575', '#263238', '#1a237e', '#3949ab'
  ];

  // Opacity presets
  const OPACITY_PRESETS = [10, 20, 30, 40, 50, 100];

  // Custom colors from Color Lab (loaded from storage)
  let customColors = [];

  // Load custom colors from chrome storage
  async function loadCustomColors() {
    try {
      const result = await chrome.storage.sync.get('customDayColors');
      customColors = result.customDayColors || [];
    } catch (error) {
      console.error('Error loading custom colors:', error);
      customColors = [];
    }
  }

  function createEl(tag, props = {}, children = []) {
    const el = document.createElement(tag);
    Object.assign(el, props);
    if (props.className) el.setAttribute('class', props.className);
    for (const child of children) {
      if (typeof child === 'string') el.appendChild(document.createTextNode(child));
      else if (child) el.appendChild(child);
    }
    return el;
  }

  function getTodayInfo() {
    const today = new Date();
    const dayIndex = today.getDay();
    const dayKey = WEEKDAY_KEYS[dayIndex];
    const dayName = WEEKDAY_NAMES[dayIndex];
    const dateKey = window.cc3Storage.ymdFromDate(today);
    return { dayIndex, dayKey, dayName, dateKey, date: today };
  }

  function formatTime(time24) {
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  }

  function formatDateForInput(date) {
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  }

  // Debounced render to prevent flickering
  function scheduleRender() {
    if (state.isRendering) {
      state.pendingRender = true;
      return;
    }
    requestAnimationFrame(() => {
      renderToolbar();
    });
  }

  // Safe update that avoids unnecessary re-renders
  function updateStateAndRender(updates) {
    Object.assign(state, updates);
    scheduleRender();
  }

  function closePanel() {
    state.activePanel = null;
    scheduleRender();
  }

  // Block Google Calendar keyboard shortcuts
  function blockCalendarHotkeys(e) {
    // Prevent all keyboard events from reaching Google Calendar
    e.stopPropagation();
    // Also stop immediate propagation to prevent any other listeners
    e.stopImmediatePropagation();
  }

  // Create typeable time picker (HH:MM format)
  function createTimePicker(initialTime, onTimeChange, label) {
    const [initialHours, initialMinutes] = (initialTime || '09:00').split(':');

    const container = createEl('div', { className: 'cc3-time-picker-row' });

    const labelEl = createEl('label', { className: 'cc3-time-label' }, [label]);
    container.appendChild(labelEl);

    const pickerWrapper = createEl('div', { className: 'cc3-time-picker-wrapper' });

    const hoursInput = createEl('input', {
      type: 'text',
      className: 'cc3-time-input cc3-hours',
      maxLength: 2,
      placeholder: '00',
      value: initialHours.padStart(2, '0')
    });

    const separator = createEl('span', { className: 'cc3-time-separator' }, [':']);

    const minutesInput = createEl('input', {
      type: 'text',
      className: 'cc3-time-input cc3-minutes',
      maxLength: 2,
      placeholder: '00',
      value: initialMinutes.padStart(2, '0')
    });

    // Validation functions
    const validateHours = (value) => {
      const num = parseInt(value, 10);
      if (isNaN(num) || num < 0) return '00';
      if (num > 23) return '23';
      return num.toString().padStart(2, '0');
    };

    const validateMinutes = (value) => {
      const num = parseInt(value, 10);
      if (isNaN(num) || num < 0) return '00';
      if (num > 59) return '59';
      return num.toString().padStart(2, '0');
    };

    const getTimeValue = () => {
      const hours = validateHours(hoursInput.value);
      const minutes = validateMinutes(minutesInput.value);
      return `${hours}:${minutes}`;
    };

    const notifyChange = () => {
      const time = getTimeValue();
      hoursInput.value = time.split(':')[0];
      minutesInput.value = time.split(':')[1];
      if (onTimeChange) onTimeChange(time);
    };

    // Block all keyboard events from reaching Google Calendar
    [hoursInput, minutesInput].forEach(input => {
      input.addEventListener('keydown', (e) => {
        blockCalendarHotkeys(e);

        if (e.key === 'Enter') {
          e.preventDefault();
          notifyChange();
          if (input === hoursInput) {
            minutesInput.focus();
            minutesInput.select();
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (input === hoursInput) {
            const current = parseInt(hoursInput.value) || 0;
            hoursInput.value = Math.min(23, current + 1).toString().padStart(2, '0');
          } else {
            const current = parseInt(minutesInput.value) || 0;
            minutesInput.value = Math.min(59, current + 1).toString().padStart(2, '0');
          }
          notifyChange();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (input === hoursInput) {
            const current = parseInt(hoursInput.value) || 0;
            hoursInput.value = Math.max(0, current - 1).toString().padStart(2, '0');
          } else {
            const current = parseInt(minutesInput.value) || 0;
            minutesInput.value = Math.max(0, current - 1).toString().padStart(2, '0');
          }
          notifyChange();
        } else if (e.key === 'Tab') {
          // Allow Tab but prevent Google Calendar from intercepting
        }
      });

      input.addEventListener('keyup', blockCalendarHotkeys);
      input.addEventListener('keypress', blockCalendarHotkeys);

      input.addEventListener('input', (e) => {
        // Only allow numbers
        e.target.value = e.target.value.replace(/[^0-9]/g, '');

        // Auto-advance from hours to minutes
        if (input === hoursInput && e.target.value.length === 2) {
          minutesInput.focus();
          minutesInput.select();
        }
      });

      input.addEventListener('blur', notifyChange);
      input.addEventListener('focus', () => input.select());
    });

    pickerWrapper.appendChild(hoursInput);
    pickerWrapper.appendChild(separator);
    pickerWrapper.appendChild(minutesInput);
    container.appendChild(pickerWrapper);

    return container;
  }

  function handleClickOutside(e) {
    const toolbar = document.querySelector('.cc3-toolbar');
    if (toolbar && !toolbar.contains(e.target)) {
      if (state.activePanel) closePanel();
    }
  }

  // Create a color palette grid
  function renderColorPalette(colors, selectedColor, onColorSelect, containerId) {
    const grid = createEl('div', { className: 'cc3-color-palette' });
    if (containerId) grid.id = containerId;

    colors.forEach(color => {
      const swatch = createEl('button', { className: `cc3-palette-swatch ${selectedColor === color ? 'cc3-selected' : ''}` });
      swatch.style.backgroundColor = color;
      swatch.dataset.color = color;
      if (color === '#ffffff') swatch.style.border = '1px solid #ccc';
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        // Update selection visually in all palettes
        const container = grid.closest('.cc3-color-picker-section');
        if (container) {
          container.querySelectorAll('.cc3-palette-swatch').forEach(s => s.classList.remove('cc3-selected'));
        }
        swatch.classList.add('cc3-selected');
        onColorSelect(color);
      });
      grid.appendChild(swatch);
    });
    return grid;
  }

  // Create empty state for custom colors
  function createCustomColorsEmptyState() {
    const empty = createEl('div', { className: 'cc3-custom-empty' });
    empty.appendChild(createEl('div', { className: 'cc3-custom-empty-icon' }, ['🎨']));
    empty.appendChild(createEl('div', { className: 'cc3-custom-empty-text' }, ['No custom colors yet']));
    empty.appendChild(createEl('div', { className: 'cc3-custom-empty-subtext' }, ['Add colors in Color Lab (Preferences)']));
    return empty;
  }

  // Create the full color picker section (color input + hex + tabs + palettes)
  function renderColorPickerSection(selectedColor, activeTab, onColorSelect, onTabChange, pickerId) {
    const section = createEl('div', { className: 'cc3-color-picker-section' });

    // Color input row (color picker + hex input) - ABOVE tabs
    const colorInputRow = createEl('div', { className: 'cc3-color-input-row' });

    const colorInput = createEl('input', {
      type: 'color',
      className: 'cc3-color-picker-input',
      value: selectedColor || '#000000'
    });

    const hexInput = createEl('input', {
      type: 'text',
      className: 'cc3-hex-input',
      placeholder: '#000000',
      value: (selectedColor || '#000000').toUpperCase(),
      maxLength: 7
    });

    // Sync color picker and hex input
    const syncHexFromColor = () => {
      hexInput.value = colorInput.value.toUpperCase();
      hexInput.style.borderColor = '';
      onColorSelect(colorInput.value);
    };

    const syncColorFromHex = () => {
      let hexValue = hexInput.value.trim();
      if (!hexValue.startsWith('#')) hexValue = '#' + hexValue;
      if (/^#[0-9A-Fa-f]{6}$/.test(hexValue)) {
        colorInput.value = hexValue;
        hexInput.style.borderColor = '#1a73e8';
        onColorSelect(hexValue);
      } else {
        hexInput.style.borderColor = '#dc2626';
      }
    };

    colorInput.addEventListener('input', syncHexFromColor);
    colorInput.addEventListener('change', syncHexFromColor);
    hexInput.addEventListener('input', syncColorFromHex);
    hexInput.addEventListener('change', syncColorFromHex);

    // Block keyboard events
    [colorInput, hexInput].forEach(input => {
      input.addEventListener('keydown', blockCalendarHotkeys);
      input.addEventListener('keyup', blockCalendarHotkeys);
      input.addEventListener('keypress', blockCalendarHotkeys);
    });

    colorInputRow.appendChild(colorInput);
    colorInputRow.appendChild(hexInput);
    section.appendChild(colorInputRow);

    // Tabs
    const tabs = createEl('div', { className: 'cc3-color-tabs' });
    ['vibrant', 'pastel', 'dark', 'custom'].forEach(tab => {
      const btn = createEl('button', {
        className: `cc3-color-tab ${activeTab === tab ? 'cc3-active' : ''}`,
      }, [tab.charAt(0).toUpperCase() + tab.slice(1)]);
      btn.dataset.tab = tab;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Update tab active state
        tabs.querySelectorAll('.cc3-color-tab').forEach(t => t.classList.remove('cc3-active'));
        btn.classList.add('cc3-active');
        // Update panel visibility
        section.querySelectorAll('.cc3-color-tab-panel').forEach(p => p.classList.remove('cc3-active'));
        const panel = section.querySelector(`[data-panel="${tab}"]`);
        if (panel) panel.classList.add('cc3-active');
        onTabChange(tab);
      });
      tabs.appendChild(btn);
    });
    section.appendChild(tabs);

    // Tab panels container
    const tabContent = createEl('div', { className: 'cc3-color-tab-content' });

    // Vibrant panel
    const vibrantPanel = createEl('div', {
      className: `cc3-color-tab-panel ${activeTab === 'vibrant' ? 'cc3-active' : ''}`
    });
    vibrantPanel.dataset.panel = 'vibrant';
    vibrantPanel.appendChild(renderColorPalette(VIBRANT_COLORS, selectedColor, (color) => {
      colorInput.value = color;
      hexInput.value = color.toUpperCase();
      onColorSelect(color);
    }, `${pickerId}-vibrant`));
    tabContent.appendChild(vibrantPanel);

    // Pastel panel
    const pastelPanel = createEl('div', {
      className: `cc3-color-tab-panel ${activeTab === 'pastel' ? 'cc3-active' : ''}`
    });
    pastelPanel.dataset.panel = 'pastel';
    pastelPanel.appendChild(renderColorPalette(PASTEL_COLORS, selectedColor, (color) => {
      colorInput.value = color;
      hexInput.value = color.toUpperCase();
      onColorSelect(color);
    }, `${pickerId}-pastel`));
    tabContent.appendChild(pastelPanel);

    // Dark panel
    const darkPanel = createEl('div', {
      className: `cc3-color-tab-panel ${activeTab === 'dark' ? 'cc3-active' : ''}`
    });
    darkPanel.dataset.panel = 'dark';
    darkPanel.appendChild(renderColorPalette(DARK_COLORS, selectedColor, (color) => {
      colorInput.value = color;
      hexInput.value = color.toUpperCase();
      onColorSelect(color);
    }, `${pickerId}-dark`));
    tabContent.appendChild(darkPanel);

    // Custom panel
    const customPanel = createEl('div', {
      className: `cc3-color-tab-panel ${activeTab === 'custom' ? 'cc3-active' : ''}`
    });
    customPanel.dataset.panel = 'custom';

    if (customColors.length === 0) {
      customPanel.appendChild(createCustomColorsEmptyState());
    } else {
      customPanel.appendChild(renderColorPalette(customColors, selectedColor, (color) => {
        colorInput.value = color;
        hexInput.value = color.toUpperCase();
        onColorSelect(color);
      }, `${pickerId}-custom`));
    }
    tabContent.appendChild(customPanel);

    section.appendChild(tabContent);

    return section;
  }

  function renderModeSelector(mode, onModeChange, isPremium) {
    const container = createEl('div', { className: 'cc3-mode-section' });
    container.appendChild(createEl('div', { className: 'cc3-section-label' }, ['Apply to:']));

    const group = createEl('div', { className: 'cc3-mode-group' });

    // Recurring option (free)
    const recurringBtn = createEl('button', {
      className: `cc3-mode-btn ${mode === 'recurring' ? 'cc3-active' : ''}`
    }, ['Recurring']);
    recurringBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onModeChange('recurring');
    });
    group.appendChild(recurringBtn);

    // Specific date option (pro)
    const specificBtn = createEl('button', {
      className: `cc3-mode-btn ${mode === 'specific' ? 'cc3-active' : ''} ${!isPremium ? 'cc3-disabled' : ''}`
    });
    specificBtn.appendChild(createEl('span', {}, ['Specific Date']));
    if (!isPremium) {
      specificBtn.appendChild(createEl('span', { className: 'cc3-pro-badge' }, ['PRO']));
    }
    specificBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isPremium) onModeChange('specific');
    });
    group.appendChild(specificBtn);

    container.appendChild(group);
    return container;
  }

  function renderDaySelector(selectedDay, onDayChange) {
    const container = createEl('div', { className: 'cc3-day-selector' });
    container.appendChild(createEl('div', { className: 'cc3-section-label' }, ['Day of week:']));

    const grid = createEl('div', { className: 'cc3-day-grid' });
    WEEKDAY_SHORT.forEach((name, idx) => {
      const btn = createEl('button', {
        className: `cc3-day-btn ${selectedDay === idx ? 'cc3-active' : ''}`
      }, [name]);
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        onDayChange(idx);
      });
      grid.appendChild(btn);
    });
    container.appendChild(grid);
    return container;
  }

  function renderDatePicker(selectedDate, onDateChange) {
    const container = createEl('div', { className: 'cc3-date-picker' });
    container.appendChild(createEl('div', { className: 'cc3-section-label' }, ['Select date:']));

    const input = createEl('input', {
      type: 'date',
      className: 'cc3-date-input',
      value: selectedDate || formatDateForInput(new Date())
    });

    // Block all keyboard events to prevent Google Calendar hotkeys
    input.addEventListener('keydown', blockCalendarHotkeys);
    input.addEventListener('keyup', blockCalendarHotkeys);
    input.addEventListener('keypress', blockCalendarHotkeys);

    input.addEventListener('change', (e) => {
      e.stopPropagation();
      onDateChange(e.target.value);
    });

    // Also prevent click events from reaching Google Calendar
    input.addEventListener('click', (e) => e.stopPropagation());
    input.addEventListener('mousedown', (e) => e.stopPropagation());

    container.appendChild(input);
    return container;
  }

  function renderColorPanel() {
    const panel = createEl('div', { className: 'cc3-flyout-panel cc3-color-panel' });
    const isPremium = window.cc3IsPremium;

    // Block all keyboard events on the panel itself
    panel.addEventListener('keydown', blockCalendarHotkeys);
    panel.addEventListener('keyup', blockCalendarHotkeys);
    panel.addEventListener('keypress', blockCalendarHotkeys);

    // Header
    const header = createEl('div', { className: 'cc3-panel-header' }, [
      createEl('span', {}, ['Color Day']),
      createEl('button', { className: 'cc3-panel-close', innerHTML: '&times;' }),
    ]);
    header.querySelector('.cc3-panel-close').addEventListener('click', (e) => {
      e.stopPropagation();
      closePanel();
    });
    panel.appendChild(header);

    // Mode selector
    panel.appendChild(renderModeSelector(state.colorMode, (mode) => {
      state.colorMode = mode;
      if (mode === 'specific' && !state.colorSelectedDate) {
        state.colorSelectedDate = formatDateForInput(new Date());
      }
      scheduleRender();
    }, isPremium));

    // Day/Date selector based on mode
    if (state.colorMode === 'recurring') {
      panel.appendChild(renderDaySelector(state.colorSelectedDay, (day) => {
        state.colorSelectedDay = day;
        scheduleRender();
      }));
    } else {
      panel.appendChild(renderDatePicker(state.colorSelectedDate, (date) => {
        state.colorSelectedDate = date;
      }));
    }

    // Color section label
    panel.appendChild(createEl('div', { className: 'cc3-section-label' }, ['Color:']));

    // Color picker section (color input + hex + tabs + palettes)
    panel.appendChild(renderColorPickerSection(
      state.selectedColor || VIBRANT_COLORS[0],
      state.colorActiveTab,
      (color) => {
        state.selectedColor = color;
        updatePreviewSwatch();
      },
      (tab) => {
        state.colorActiveTab = tab;
      },
      'color-day-picker'
    ));

    // Opacity section
    const opacitySection = createEl('div', { className: 'cc3-opacity-section' });
    const opacityHeader = createEl('div', { className: 'cc3-opacity-header' });
    opacityHeader.appendChild(createEl('span', { className: 'cc3-section-label' }, ['Opacity:']));
    const opacityValue = createEl('span', { className: 'cc3-opacity-value' }, [`${state.selectedOpacity}%`]);
    opacityHeader.appendChild(opacityValue);
    opacitySection.appendChild(opacityHeader);

    const opacityPresets = createEl('div', { className: 'cc3-opacity-presets' });
    OPACITY_PRESETS.forEach(val => {
      const btn = createEl('button', {
        className: `cc3-opacity-btn ${state.selectedOpacity === val ? 'cc3-active' : ''}`
      }, [`${val}%`]);
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.selectedOpacity = val;
        opacityValue.textContent = `${val}%`;
        opacitySlider.value = val;
        updatePreviewSwatch();
        updateOpacitySelection(opacityPresets, val);
      });
      opacityPresets.appendChild(btn);
    });
    opacitySection.appendChild(opacityPresets);

    const opacitySlider = createEl('input', {
      type: 'range', className: 'cc3-opacity-slider',
      min: '0', max: '100', value: String(state.selectedOpacity)
    });
    opacitySlider.addEventListener('input', (e) => {
      state.selectedOpacity = parseInt(e.target.value, 10);
      opacityValue.textContent = `${state.selectedOpacity}%`;
      updatePreviewSwatch();
    });
    opacitySection.appendChild(opacitySlider);
    panel.appendChild(opacitySection);

    // Preview
    const previewSection = createEl('div', { className: 'cc3-preview-section' });
    previewSection.appendChild(createEl('span', { className: 'cc3-section-label' }, ['Preview:']));
    const previewSwatch = createEl('div', { className: 'cc3-preview-swatch', id: 'cc3-preview-swatch' });
    previewSwatch.style.backgroundColor = state.selectedColor || VIBRANT_COLORS[0];
    previewSwatch.style.opacity = state.selectedOpacity / 100;
    previewSection.appendChild(previewSwatch);
    panel.appendChild(previewSection);

    // Action buttons
    const actionRow = createEl('div', { className: 'cc3-action-row' });
    const applyBtn = createEl('button', { className: 'cc3-btn cc3-btn-primary' }, ['Apply']);
    applyBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await applyDayColor();
      closePanel();
    });
    actionRow.appendChild(applyBtn);

    const clearBtn = createEl('button', { className: 'cc3-btn cc3-btn-secondary' }, ['Clear']);
    clearBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await clearDayColor();
      closePanel();
    });
    actionRow.appendChild(clearBtn);
    panel.appendChild(actionRow);

    return panel;
  }

  // Helper to update preview without re-rendering
  function updatePreviewSwatch() {
    const swatch = document.getElementById('cc3-preview-swatch');
    if (swatch) {
      swatch.style.backgroundColor = state.selectedColor || VIBRANT_COLORS[0];
      swatch.style.opacity = state.selectedOpacity / 100;
    }
  }

  // Helper to update palette selection without re-rendering
  function updatePaletteSelection(container, selectedColor) {
    const swatches = container.querySelectorAll('.cc3-palette-swatch');
    swatches.forEach(swatch => {
      const color = swatch.style.backgroundColor;
      // Convert rgb to hex for comparison
      const isSelected = swatch.dataset.color === selectedColor;
      swatch.classList.toggle('cc3-selected', isSelected);
    });
  }

  // Helper to update opacity button selection without re-rendering
  function updateOpacitySelection(container, selectedValue) {
    const buttons = container.querySelectorAll('.cc3-opacity-btn');
    buttons.forEach(btn => {
      const val = parseInt(btn.textContent);
      btn.classList.toggle('cc3-active', val === selectedValue);
    });
  }

  function renderBlockPanel() {
    const panel = createEl('div', { className: 'cc3-flyout-panel cc3-block-panel' });
    const isPremium = window.cc3IsPremium;

    // Block all keyboard events on the panel itself
    panel.addEventListener('keydown', blockCalendarHotkeys);
    panel.addEventListener('keyup', blockCalendarHotkeys);
    panel.addEventListener('keypress', blockCalendarHotkeys);

    // Header
    const header = createEl('div', { className: 'cc3-panel-header' }, [
      createEl('span', {}, ['Add Time Block']),
      createEl('button', { className: 'cc3-panel-close', innerHTML: '&times;' }),
    ]);
    header.querySelector('.cc3-panel-close').addEventListener('click', (e) => {
      e.stopPropagation();
      closePanel();
    });
    panel.appendChild(header);

    // Mode selector
    panel.appendChild(renderModeSelector(state.blockMode, (mode) => {
      state.blockMode = mode;
      if (mode === 'specific' && !state.blockSelectedDate) {
        state.blockSelectedDate = formatDateForInput(new Date());
      }
      scheduleRender();
    }, isPremium));

    // Day/Date selector based on mode
    if (state.blockMode === 'recurring') {
      panel.appendChild(renderDaySelector(state.blockSelectedDay, (day) => {
        state.blockSelectedDay = day;
        scheduleRender();
      }));
    } else {
      panel.appendChild(renderDatePicker(state.blockSelectedDate, (date) => {
        state.blockSelectedDate = date;
        // Don't re-render for date changes
      }));
    }

    // Time selection - using new typeable time pickers
    const timeSection = createEl('div', { className: 'cc3-time-section' });

    // Start time - typeable input
    timeSection.appendChild(createTimePicker(state.blockStartTime, (time) => {
      state.blockStartTime = time;
    }, 'Start:'));

    // End time - typeable input
    timeSection.appendChild(createTimePicker(state.blockEndTime, (time) => {
      state.blockEndTime = time;
    }, 'End:'));

    panel.appendChild(timeSection);

    // Label input
    const labelRow = createEl('div', { className: 'cc3-form-row' });
    labelRow.appendChild(createEl('label', {}, ['Label:']));
    const labelInput = createEl('input', {
      type: 'text', className: 'cc3-text-input',
      placeholder: 'e.g., Deep Work', value: state.blockLabel
    });
    // Block keyboard events for label input
    labelInput.addEventListener('keydown', blockCalendarHotkeys);
    labelInput.addEventListener('keyup', blockCalendarHotkeys);
    labelInput.addEventListener('keypress', blockCalendarHotkeys);
    labelInput.addEventListener('input', (e) => { state.blockLabel = e.target.value; });
    labelRow.appendChild(labelInput);
    panel.appendChild(labelRow);

    // Style selection
    const styleRow = createEl('div', { className: 'cc3-form-row' });
    styleRow.appendChild(createEl('label', {}, ['Style:']));
    const styleSelect = createEl('select', { className: 'cc3-select' });
    [{ value: 'solid', label: 'Solid' }, { value: 'hashed', label: 'Hashed' }].forEach(({ value, label }) => {
      const option = createEl('option', { value }, [label]);
      if (value === state.blockShadingStyle) option.selected = true;
      styleSelect.appendChild(option);
    });
    styleSelect.addEventListener('change', (e) => { state.blockShadingStyle = e.target.value; });
    styleSelect.addEventListener('keydown', blockCalendarHotkeys);
    styleRow.appendChild(styleSelect);
    panel.appendChild(styleRow);

    // Color section label
    panel.appendChild(createEl('div', { className: 'cc3-section-label' }, ['Color:']));

    // Color picker section (color input + hex + tabs + palettes)
    panel.appendChild(renderColorPickerSection(
      state.selectedBlockColor || '#FFEB3B',
      state.blockActiveTab,
      (color) => {
        state.selectedBlockColor = color;
      },
      (tab) => {
        state.blockActiveTab = tab;
      },
      'time-block-picker'
    ));

    // Add Block button
    const addBtn = createEl('button', { className: 'cc3-btn cc3-btn-primary cc3-btn-full' }, ['Add Block']);
    addBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await addTimeBlock();
      closePanel();
    });
    panel.appendChild(addBtn);

    return panel;
  }

  async function applyDayColor() {
    const color = state.selectedColor || VIBRANT_COLORS[0];
    const opacity = state.selectedOpacity;

    if (state.colorMode === 'recurring') {
      await window.cc3Storage.setWeekdayColor(state.colorSelectedDay, color);
      await window.cc3Storage.setWeekdayOpacity(state.colorSelectedDay, opacity);
    } else {
      const dateKey = state.colorSelectedDate || formatDateForInput(new Date());
      await window.cc3Storage.setDateColor(dateKey, color);
      await window.cc3Storage.setDateOpacity(dateKey, opacity);
    }

    const newSettings = await window.cc3Storage.getSettings();
    if (window.cc3Features?.updateFeature) {
      window.cc3Features.updateFeature('dayColoring', newSettings);
    }
  }

  async function clearDayColor() {
    if (state.colorMode === 'recurring') {
      // Set to white/transparent to "clear" the color
      await window.cc3Storage.setWeekdayColor(state.colorSelectedDay, '#ffffff');
      await window.cc3Storage.setWeekdayOpacity(state.colorSelectedDay, 0);
    } else {
      const dateKey = state.colorSelectedDate || formatDateForInput(new Date());
      await window.cc3Storage.clearDateColor(dateKey);
    }

    const newSettings = await window.cc3Storage.getSettings();
    if (window.cc3Features?.updateFeature) {
      window.cc3Features.updateFeature('dayColoring', newSettings);
    }
  }

  async function addTimeBlock() {
    // Validate end time is after start time
    const startMins = timeToMinutes(state.blockStartTime);
    const endMins = timeToMinutes(state.blockEndTime);
    if (endMins <= startMins) {
      console.warn('End time must be after start time');
      return;
    }

    const timeBlock = {
      timeRange: [state.blockStartTime, state.blockEndTime],
      color: state.selectedBlockColor,
      label: state.blockLabel || '',
      style: state.blockShadingStyle,
    };

    if (state.blockMode === 'recurring') {
      const dayKey = WEEKDAY_KEYS[state.blockSelectedDay];
      await window.cc3Storage.addTimeBlock(dayKey, timeBlock);
    } else {
      const dateKey = state.blockSelectedDate || formatDateForInput(new Date());
      await window.cc3Storage.addDateSpecificTimeBlock(dateKey, timeBlock);
    }

    state.blockLabel = '';
    const newSettings = await window.cc3Storage.getSettings();
    if (window.cc3Features?.updateFeature) {
      window.cc3Features.updateFeature('timeBlocking', newSettings.timeBlocking || {});
    }
  }

  function timeToMinutes(time24) {
    const [hours, mins] = time24.split(':').map(Number);
    return hours * 60 + mins;
  }

  function renderToolbar() {
    // Anti-flicker guard
    if (state.isRendering) {
      state.pendingRender = true;
      return;
    }
    state.isRendering = true;

    try {
      const existing = document.querySelector('.cc3-toolbar');
      if (existing) existing.remove();

      if (!state.settings) {
        state.isRendering = false;
        return;
      }

      const root = createEl('div', { className: `cc3-toolbar ${state.collapsed ? 'cc3-collapsed' : ''}` });

      // Block keyboard events on the entire toolbar
      root.addEventListener('keydown', blockCalendarHotkeys);
      root.addEventListener('keyup', blockCalendarHotkeys);
      root.addEventListener('keypress', blockCalendarHotkeys);

      const collapseBtn = createEl('button', {
        className: 'cc3-collapse-btn',
        innerHTML: state.collapsed ? '&#9650;' : '&#9660;',
        title: state.collapsed ? 'Expand toolbar' : 'Collapse toolbar',
      });
      collapseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.collapsed = !state.collapsed;
        if (state.collapsed) state.activePanel = null;
        scheduleRender();
      });

      if (state.collapsed) {
        root.appendChild(collapseBtn);
        document.documentElement.appendChild(root);
        state.isRendering = false;
        return;
      }

      const content = createEl('div', { className: 'cc3-toolbar-content' });

      if (state.activePanel === 'color') {
        content.appendChild(renderColorPanel());
      } else if (state.activePanel === 'block') {
        content.appendChild(renderBlockPanel());
      }

      const buttonRow = createEl('div', { className: 'cc3-button-row' });

      const colorBtn = createEl('button', {
        className: `cc3-action-btn ${state.activePanel === 'color' ? 'cc3-active' : ''}`,
        title: 'Color day',
      });
      colorBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 0 20"/></svg><span>Color</span>';
      colorBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (state.activePanel !== 'color') {
          // Set default color if none selected
          if (!state.selectedColor) state.selectedColor = VIBRANT_COLORS[0];
        }
        state.activePanel = state.activePanel === 'color' ? null : 'color';
        scheduleRender();
      });
      buttonRow.appendChild(colorBtn);

      const blockBtn = createEl('button', {
        className: `cc3-action-btn ${state.activePanel === 'block' ? 'cc3-active' : ''}`,
        title: 'Add time block',
      });
      blockBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><span>Block</span>';
      blockBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (state.activePanel !== 'block') {
          // Set default block color if none selected
          if (!state.selectedBlockColor) state.selectedBlockColor = VIBRANT_COLORS[6]; // Yellow
        }
        state.activePanel = state.activePanel === 'block' ? null : 'block';
        scheduleRender();
      });
      buttonRow.appendChild(blockBtn);

      buttonRow.appendChild(collapseBtn);
      content.appendChild(buttonRow);
      root.appendChild(content);
      document.documentElement.appendChild(root);
    } finally {
      state.isRendering = false;

      // Check if another render was requested while we were rendering
      if (state.pendingRender) {
        state.pendingRender = false;
        requestAnimationFrame(() => renderToolbar());
      }
    }
  }

  async function mount() {
    // Load settings and custom colors
    state.settings = await window.cc3Storage.getSettings();
    await loadCustomColors();

    renderToolbar();

    // Listen for settings changes
    window.cc3Storage.onSettingsChanged((s) => {
      state.settings = s;
      if (!state.activePanel) renderToolbar();
    });

    // Listen for custom colors changes from Color Lab
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'sync' && changes.customDayColors) {
        customColors = changes.customDayColors.newValue || [];
        // Re-render if panel is open to update custom colors
        if (state.activePanel) {
          scheduleRender();
        }
      }
    });

    document.addEventListener('click', handleClickOutside);
  }

  window.cc3Toolbar = { mount };
})();
