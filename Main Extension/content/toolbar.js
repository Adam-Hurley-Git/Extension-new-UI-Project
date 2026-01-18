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

  function closePanel() {
    state.activePanel = null;
    renderToolbar();
  }

  function handleClickOutside(e) {
    const toolbar = document.querySelector('.cc3-toolbar');
    if (toolbar && !toolbar.contains(e.target)) {
      if (state.activePanel) closePanel();
    }
  }

  function renderColorTabs(activeTab, onTabClick) {
    const tabs = createEl('div', { className: 'cc3-color-tabs' });
    ['vibrant', 'pastel', 'dark', 'custom'].forEach(tab => {
      const btn = createEl('button', {
        className: `cc3-color-tab ${activeTab === tab ? 'cc3-active' : ''}`,
      }, [tab.charAt(0).toUpperCase() + tab.slice(1)]);
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        onTabClick(tab);
      });
      tabs.appendChild(btn);
    });
    return tabs;
  }

  function renderColorPalette(colors, selectedColor, onColorSelect) {
    const grid = createEl('div', { className: 'cc3-color-palette' });
    colors.forEach(color => {
      const swatch = createEl('button', { className: `cc3-palette-swatch ${selectedColor === color ? 'cc3-selected' : ''}` });
      swatch.style.backgroundColor = color;
      if (color === '#ffffff') swatch.style.border = '1px solid #ccc';
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        onColorSelect(color);
      });
      grid.appendChild(swatch);
    });
    return grid;
  }

  function renderCustomColorInput(selectedColor, onChange) {
    const row = createEl('div', { className: 'cc3-custom-input-row' });
    const input = createEl('input', { type: 'color', className: 'cc3-custom-color-picker' });
    input.value = selectedColor || '#FDE68A';
    input.addEventListener('input', (e) => onChange(e.target.value));
    row.appendChild(input);

    const hexInput = createEl('input', {
      type: 'text',
      className: 'cc3-hex-input',
      placeholder: '#RRGGBB',
      value: selectedColor || ''
    });
    hexInput.addEventListener('change', (e) => {
      const val = e.target.value;
      if (/^#[0-9A-Fa-f]{6}$/.test(val)) onChange(val);
    });
    row.appendChild(hexInput);
    return row;
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
    input.addEventListener('change', (e) => {
      e.stopPropagation();
      onDateChange(e.target.value);
    });
    container.appendChild(input);
    return container;
  }

  function renderColorPanel() {
    const panel = createEl('div', { className: 'cc3-flyout-panel cc3-color-panel' });
    const isPremium = window.cc3IsPremium;

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
      renderToolbar();
    }, isPremium));

    // Day/Date selector based on mode
    if (state.colorMode === 'recurring') {
      panel.appendChild(renderDaySelector(state.colorSelectedDay, (day) => {
        state.colorSelectedDay = day;
        renderToolbar();
      }));
    } else {
      panel.appendChild(renderDatePicker(state.colorSelectedDate, (date) => {
        state.colorSelectedDate = date;
        renderToolbar();
      }));
    }

    // Color tabs
    panel.appendChild(renderColorTabs(state.colorActiveTab, (tab) => {
      state.colorActiveTab = tab;
      renderToolbar();
    }));

    // Color palette based on active tab
    const paletteContainer = createEl('div', { className: 'cc3-palette-container' });
    let colors = VIBRANT_COLORS;
    if (state.colorActiveTab === 'pastel') colors = PASTEL_COLORS;
    else if (state.colorActiveTab === 'dark') colors = DARK_COLORS;

    if (state.colorActiveTab === 'custom') {
      paletteContainer.appendChild(renderCustomColorInput(state.selectedColor, (color) => {
        state.selectedColor = color;
        renderToolbar();
      }));
    } else {
      paletteContainer.appendChild(renderColorPalette(colors, state.selectedColor, (color) => {
        state.selectedColor = color;
        renderToolbar();
      }));
    }
    panel.appendChild(paletteContainer);

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
        renderToolbar();
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
    });
    opacitySlider.addEventListener('change', () => renderToolbar());
    opacitySection.appendChild(opacitySlider);
    panel.appendChild(opacitySection);

    // Preview
    const previewSection = createEl('div', { className: 'cc3-preview-section' });
    previewSection.appendChild(createEl('span', { className: 'cc3-section-label' }, ['Preview:']));
    const previewSwatch = createEl('div', { className: 'cc3-preview-swatch' });
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

  function renderBlockPanel() {
    const panel = createEl('div', { className: 'cc3-flyout-panel cc3-block-panel' });
    const isPremium = window.cc3IsPremium;

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
      renderToolbar();
    }, isPremium));

    // Day/Date selector based on mode
    if (state.blockMode === 'recurring') {
      panel.appendChild(renderDaySelector(state.blockSelectedDay, (day) => {
        state.blockSelectedDay = day;
        renderToolbar();
      }));
    } else {
      panel.appendChild(renderDatePicker(state.blockSelectedDate, (date) => {
        state.blockSelectedDate = date;
        renderToolbar();
      }));
    }

    // Time selection
    const timeSection = createEl('div', { className: 'cc3-time-section' });

    // Start time
    const startRow = createEl('div', { className: 'cc3-form-row' });
    startRow.appendChild(createEl('label', {}, ['Start:']));
    const startSelect = createEl('select', { className: 'cc3-select' });
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 30) {
        const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        const option = createEl('option', { value: time }, [formatTime(time)]);
        if (time === state.blockStartTime) option.selected = true;
        startSelect.appendChild(option);
      }
    }
    startSelect.addEventListener('change', (e) => { state.blockStartTime = e.target.value; });
    startRow.appendChild(startSelect);
    timeSection.appendChild(startRow);

    // End time
    const endRow = createEl('div', { className: 'cc3-form-row' });
    endRow.appendChild(createEl('label', {}, ['End:']));
    const endSelect = createEl('select', { className: 'cc3-select' });
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 30) {
        const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        const option = createEl('option', { value: time }, [formatTime(time)]);
        if (time === state.blockEndTime) option.selected = true;
        endSelect.appendChild(option);
      }
    }
    endSelect.addEventListener('change', (e) => { state.blockEndTime = e.target.value; });
    endRow.appendChild(endSelect);
    timeSection.appendChild(endRow);
    panel.appendChild(timeSection);

    // Label input
    const labelRow = createEl('div', { className: 'cc3-form-row' });
    labelRow.appendChild(createEl('label', {}, ['Label:']));
    const labelInput = createEl('input', {
      type: 'text', className: 'cc3-text-input',
      placeholder: 'e.g., Deep Work', value: state.blockLabel
    });
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
    styleRow.appendChild(styleSelect);
    panel.appendChild(styleRow);

    // Color tabs
    panel.appendChild(renderColorTabs(state.blockActiveTab, (tab) => {
      state.blockActiveTab = tab;
      renderToolbar();
    }));

    // Color palette
    const paletteContainer = createEl('div', { className: 'cc3-palette-container' });
    let colors = VIBRANT_COLORS;
    if (state.blockActiveTab === 'pastel') colors = PASTEL_COLORS;
    else if (state.blockActiveTab === 'dark') colors = DARK_COLORS;

    if (state.blockActiveTab === 'custom') {
      paletteContainer.appendChild(renderCustomColorInput(state.selectedBlockColor, (color) => {
        state.selectedBlockColor = color;
        renderToolbar();
      }));
    } else {
      paletteContainer.appendChild(renderColorPalette(colors, state.selectedBlockColor, (color) => {
        state.selectedBlockColor = color;
        renderToolbar();
      }));
    }
    panel.appendChild(paletteContainer);

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
    const existing = document.querySelector('.cc3-toolbar');
    if (existing) existing.remove();

    if (!state.settings) return;

    const root = createEl('div', { className: `cc3-toolbar ${state.collapsed ? 'cc3-collapsed' : ''}` });

    const collapseBtn = createEl('button', {
      className: 'cc3-collapse-btn',
      innerHTML: state.collapsed ? '&#9650;' : '&#9660;',
      title: state.collapsed ? 'Expand toolbar' : 'Collapse toolbar',
    });
    collapseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.collapsed = !state.collapsed;
      if (state.collapsed) state.activePanel = null;
      renderToolbar();
    });

    if (state.collapsed) {
      root.appendChild(collapseBtn);
      document.documentElement.appendChild(root);
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
      renderToolbar();
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
      renderToolbar();
    });
    buttonRow.appendChild(blockBtn);

    buttonRow.appendChild(collapseBtn);
    content.appendChild(buttonRow);
    root.appendChild(content);
    document.documentElement.appendChild(root);
  }

  async function mount() {
    state.settings = await window.cc3Storage.getSettings();
    renderToolbar();
    window.cc3Storage.onSettingsChanged((s) => {
      state.settings = s;
      if (!state.activePanel) renderToolbar();
    });
    document.addEventListener('click', handleClickOutside);
  }

  window.cc3Toolbar = { mount };
})();
