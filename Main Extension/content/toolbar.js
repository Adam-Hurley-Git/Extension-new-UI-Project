(function () {
  const state = {
    settings: null,
    collapsed: true,
    activePanel: null, // 'color' | 'block' | null
    colorApplyTo: 'today', // 'today' | 'weekday'
    blockApplyTo: 'today', // 'today' | 'weekday'
    blockStartTime: '09:00',
    blockDuration: 60, // minutes
    selectedColor: null,
    selectedBlockColor: '#FFEB3B',
  };

  // Day key mapping for weeklySchedule
  const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Preset colors for day coloring
  const PRESET_COLORS = [
    '#FDE68A', // Yellow
    '#BFDBFE', // Blue
    '#C7D2FE', // Indigo
    '#FBCFE8', // Pink
    '#BBF7D0', // Green
    '#FCA5A5', // Red
    '#A7F3D0', // Teal
    '#F5D0FE', // Purple
    '#FED7AA', // Orange
    '#E5E7EB', // Gray
  ];

  // Preset colors for time blocks
  const BLOCK_COLORS = [
    '#FFEB3B', // Yellow
    '#4CAF50', // Green
    '#2196F3', // Blue
    '#FF9800', // Orange
    '#E91E63', // Pink
    '#9C27B0', // Purple
    '#00BCD4', // Cyan
    '#FF5722', // Deep Orange
  ];

  function createEl(tag, props = {}, children = []) {
    const el = document.createElement(tag);
    Object.assign(el, props);
    if (props.className) {
      el.setAttribute('class', props.className);
    }
    for (const child of children) {
      if (typeof child === 'string') el.appendChild(document.createTextNode(child));
      else if (child) el.appendChild(child);
    }
    return el;
  }

  function getTodayInfo() {
    const today = new Date();
    const dayIndex = today.getDay(); // 0 = Sunday
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

  function addMinutesToTime(time24, minutes) {
    const [hours, mins] = time24.split(':').map(Number);
    const totalMins = hours * 60 + mins + minutes;
    const newHours = Math.floor(totalMins / 60) % 24;
    const newMins = totalMins % 60;
    return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
  }

  function closePanel() {
    state.activePanel = null;
    renderToolbar();
  }

  // Close panel when clicking outside
  function handleClickOutside(e) {
    const toolbar = document.querySelector('.cc3-toolbar');
    if (toolbar && !toolbar.contains(e.target)) {
      if (state.activePanel) {
        closePanel();
      }
    }
  }

  function renderColorPanel() {
    const panel = createEl('div', { className: 'cc3-flyout-panel cc3-color-panel' });
    const { dayName, dateKey } = getTodayInfo();

    // Header
    const header = createEl('div', { className: 'cc3-panel-header' }, [
      createEl('span', {}, ['Color Day']),
      createEl('button', { className: 'cc3-panel-close', innerHTML: '&times;' }),
    ]);
    header.querySelector('.cc3-panel-close').addEventListener('click', closePanel);
    panel.appendChild(header);

    // Apply to section
    const applySection = createEl('div', { className: 'cc3-apply-section' });
    const applyLabel = createEl('div', { className: 'cc3-apply-label' }, ['Apply to:']);
    applySection.appendChild(applyLabel);

    const radioGroup = createEl('div', { className: 'cc3-radio-group' });

    // Today option
    const todayLabel = createEl('label', { className: 'cc3-radio-label' });
    const todayRadio = createEl('input', { type: 'radio', name: 'colorApply', value: 'today' });
    todayRadio.checked = state.colorApplyTo === 'today';
    todayRadio.addEventListener('change', () => {
      state.colorApplyTo = 'today';
      renderToolbar();
    });
    todayLabel.appendChild(todayRadio);
    todayLabel.appendChild(createEl('span', {}, ['Today only']));
    radioGroup.appendChild(todayLabel);

    // Weekday option (Pro)
    const weekdayLabel = createEl('label', { className: 'cc3-radio-label' });
    const weekdayRadio = createEl('input', { type: 'radio', name: 'colorApply', value: 'weekday' });
    weekdayRadio.checked = state.colorApplyTo === 'weekday';

    const isPremium = window.cc3IsPremium;
    if (!isPremium) {
      weekdayRadio.disabled = true;
      weekdayLabel.classList.add('cc3-disabled');
    }

    weekdayRadio.addEventListener('change', () => {
      if (isPremium) {
        state.colorApplyTo = 'weekday';
        renderToolbar();
      }
    });
    weekdayLabel.appendChild(weekdayRadio);
    weekdayLabel.appendChild(createEl('span', {}, [`All ${dayName}s`]));
    if (!isPremium) {
      weekdayLabel.appendChild(createEl('span', { className: 'cc3-pro-badge' }, ['PRO']));
    }
    radioGroup.appendChild(weekdayLabel);

    applySection.appendChild(radioGroup);
    panel.appendChild(applySection);

    // Color swatches
    const swatchSection = createEl('div', { className: 'cc3-swatch-section' });
    const swatchGrid = createEl('div', { className: 'cc3-swatch-grid' });

    PRESET_COLORS.forEach((color) => {
      const swatch = createEl('button', { className: 'cc3-swatch' });
      swatch.style.backgroundColor = color;
      if (state.selectedColor === color) {
        swatch.classList.add('cc3-swatch-selected');
      }
      swatch.addEventListener('click', async () => {
        state.selectedColor = color;
        await applyDayColor(color);
        closePanel();
      });
      swatchGrid.appendChild(swatch);
    });

    swatchSection.appendChild(swatchGrid);

    // Custom color picker (Pro)
    if (isPremium) {
      const customRow = createEl('div', { className: 'cc3-custom-color-row' });
      const colorInput = createEl('input', { type: 'color', className: 'cc3-color-input' });
      colorInput.value = state.selectedColor || '#FDE68A';
      const applyCustomBtn = createEl('button', { className: 'cc3-btn cc3-btn-small' }, ['Apply']);
      applyCustomBtn.addEventListener('click', async () => {
        await applyDayColor(colorInput.value);
        closePanel();
      });
      customRow.appendChild(colorInput);
      customRow.appendChild(applyCustomBtn);
      swatchSection.appendChild(customRow);
    }

    panel.appendChild(swatchSection);

    // Clear button
    const clearBtn = createEl('button', { className: 'cc3-btn cc3-btn-secondary cc3-btn-full' }, ['Clear Color']);
    clearBtn.addEventListener('click', async () => {
      await clearDayColor();
      closePanel();
    });
    panel.appendChild(clearBtn);

    return panel;
  }

  function renderBlockPanel() {
    const panel = createEl('div', { className: 'cc3-flyout-panel cc3-block-panel' });
    const { dayName } = getTodayInfo();
    const isPremium = window.cc3IsPremium;

    // Header
    const header = createEl('div', { className: 'cc3-panel-header' }, [
      createEl('span', {}, ['Add Time Block']),
      createEl('button', { className: 'cc3-panel-close', innerHTML: '&times;' }),
    ]);
    header.querySelector('.cc3-panel-close').addEventListener('click', closePanel);
    panel.appendChild(header);

    // Apply to section
    const applySection = createEl('div', { className: 'cc3-apply-section' });
    const applyLabel = createEl('div', { className: 'cc3-apply-label' }, ['Apply to:']);
    applySection.appendChild(applyLabel);

    const radioGroup = createEl('div', { className: 'cc3-radio-group' });

    // Today option
    const todayLabel = createEl('label', { className: 'cc3-radio-label' });
    const todayRadio = createEl('input', { type: 'radio', name: 'blockApply', value: 'today' });
    todayRadio.checked = state.blockApplyTo === 'today';
    todayRadio.addEventListener('change', () => {
      state.blockApplyTo = 'today';
      renderToolbar();
    });
    todayLabel.appendChild(todayRadio);
    todayLabel.appendChild(createEl('span', {}, ['Today only']));
    radioGroup.appendChild(todayLabel);

    // Weekday option (Pro)
    const weekdayLabel = createEl('label', { className: 'cc3-radio-label' });
    const weekdayRadio = createEl('input', { type: 'radio', name: 'blockApply', value: 'weekday' });
    weekdayRadio.checked = state.blockApplyTo === 'weekday';

    if (!isPremium) {
      weekdayRadio.disabled = true;
      weekdayLabel.classList.add('cc3-disabled');
    }

    weekdayRadio.addEventListener('change', () => {
      if (isPremium) {
        state.blockApplyTo = 'weekday';
        renderToolbar();
      }
    });
    weekdayLabel.appendChild(weekdayRadio);
    weekdayLabel.appendChild(createEl('span', {}, [`Every ${dayName}`]));
    if (!isPremium) {
      weekdayLabel.appendChild(createEl('span', { className: 'cc3-pro-badge' }, ['PRO']));
    }
    radioGroup.appendChild(weekdayLabel);

    applySection.appendChild(radioGroup);
    panel.appendChild(applySection);

    // Time selection
    const timeSection = createEl('div', { className: 'cc3-time-section' });

    // Start time
    const startRow = createEl('div', { className: 'cc3-form-row' });
    startRow.appendChild(createEl('label', {}, ['Start:']));
    const startSelect = createEl('select', { className: 'cc3-select' });

    // Generate time options (30 min intervals)
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 30) {
        const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        const option = createEl('option', { value: time }, [formatTime(time)]);
        if (time === state.blockStartTime) option.selected = true;
        startSelect.appendChild(option);
      }
    }
    startSelect.addEventListener('change', (e) => {
      state.blockStartTime = e.target.value;
    });
    startRow.appendChild(startSelect);
    timeSection.appendChild(startRow);

    // Duration
    const durationRow = createEl('div', { className: 'cc3-form-row' });
    durationRow.appendChild(createEl('label', {}, ['Duration:']));
    const durationSelect = createEl('select', { className: 'cc3-select' });

    const durations = [
      { value: 30, label: '30 min' },
      { value: 60, label: '1 hour' },
      { value: 90, label: '1.5 hours' },
      { value: 120, label: '2 hours' },
      { value: 180, label: '3 hours' },
      { value: 240, label: '4 hours' },
    ];

    durations.forEach(({ value, label }) => {
      const option = createEl('option', { value: String(value) }, [label]);
      if (value === state.blockDuration) option.selected = true;
      durationSelect.appendChild(option);
    });
    durationSelect.addEventListener('change', (e) => {
      state.blockDuration = parseInt(e.target.value, 10);
    });
    durationRow.appendChild(durationSelect);
    timeSection.appendChild(durationRow);

    panel.appendChild(timeSection);

    // Color selection for block
    const colorSection = createEl('div', { className: 'cc3-block-color-section' });
    colorSection.appendChild(createEl('label', {}, ['Color:']));
    const colorGrid = createEl('div', { className: 'cc3-block-color-grid' });

    BLOCK_COLORS.forEach((color) => {
      const swatch = createEl('button', { className: 'cc3-block-swatch' });
      swatch.style.backgroundColor = color;
      if (state.selectedBlockColor === color) {
        swatch.classList.add('cc3-swatch-selected');
      }
      swatch.addEventListener('click', () => {
        state.selectedBlockColor = color;
        renderToolbar();
      });
      colorGrid.appendChild(swatch);
    });

    colorSection.appendChild(colorGrid);
    panel.appendChild(colorSection);

    // Add Block button
    const addBtn = createEl('button', { className: 'cc3-btn cc3-btn-primary cc3-btn-full' }, ['Add Block']);
    addBtn.addEventListener('click', async () => {
      await addTimeBlock();
      closePanel();
    });
    panel.appendChild(addBtn);

    return panel;
  }

  async function applyDayColor(color) {
    const { dayIndex, dateKey } = getTodayInfo();

    if (state.colorApplyTo === 'today') {
      // Apply to specific date
      await window.cc3Storage.setDateColor(dateKey, color);
    } else {
      // Apply to weekday (Pro feature)
      await window.cc3Storage.setWeekdayColor(dayIndex, color);
    }

    // Trigger feature update
    const newSettings = await window.cc3Storage.getSettings();
    if (window.cc3Features && window.cc3Features.updateFeature) {
      window.cc3Features.updateFeature('dayColoring', newSettings);
    }
  }

  async function clearDayColor() {
    const { dayIndex, dateKey } = getTodayInfo();

    if (state.colorApplyTo === 'today') {
      await window.cc3Storage.clearDateColor(dateKey);
    } else {
      // Reset weekday to default or clear
      await window.cc3Storage.setWeekdayColor(dayIndex, null);
    }

    // Trigger feature update
    const newSettings = await window.cc3Storage.getSettings();
    if (window.cc3Features && window.cc3Features.updateFeature) {
      window.cc3Features.updateFeature('dayColoring', newSettings);
    }
  }

  async function addTimeBlock() {
    const { dayKey, dateKey } = getTodayInfo();
    const startTime = state.blockStartTime;
    const endTime = addMinutesToTime(startTime, state.blockDuration);

    const timeBlock = {
      timeRange: [startTime, endTime],
      color: state.selectedBlockColor,
      label: '',
    };

    if (state.blockApplyTo === 'today') {
      // Add to date-specific schedule
      await window.cc3Storage.addDateSpecificTimeBlock(dateKey, timeBlock);
    } else {
      // Add to weekly schedule (Pro feature)
      await window.cc3Storage.addTimeBlock(dayKey, timeBlock);
    }

    // Trigger feature update
    const newSettings = await window.cc3Storage.getSettings();
    if (window.cc3Features && window.cc3Features.updateFeature) {
      window.cc3Features.updateFeature('timeBlocking', newSettings.timeBlocking || {});
    }
  }

  function renderToolbar() {
    const existing = document.querySelector('.cc3-toolbar');
    if (existing) existing.remove();

    const settings = state.settings;
    if (!settings) return;

    const root = createEl('div', { className: `cc3-toolbar ${state.collapsed ? 'cc3-collapsed' : ''}` });

    // Collapse/expand button
    const collapseBtn = createEl('button', {
      className: 'cc3-collapse-btn',
      innerHTML: state.collapsed ? '&#9650;' : '&#9660;',
      title: state.collapsed ? 'Expand toolbar' : 'Collapse toolbar',
    });
    collapseBtn.addEventListener('click', () => {
      state.collapsed = !state.collapsed;
      if (state.collapsed) {
        state.activePanel = null;
      }
      renderToolbar();
    });

    if (state.collapsed) {
      root.appendChild(collapseBtn);
      document.documentElement.appendChild(root);
      return;
    }

    // Main content container
    const content = createEl('div', { className: 'cc3-toolbar-content' });

    // Flyout panel (if active)
    if (state.activePanel === 'color') {
      content.appendChild(renderColorPanel());
    } else if (state.activePanel === 'block') {
      content.appendChild(renderBlockPanel());
    }

    // Button row
    const buttonRow = createEl('div', { className: 'cc3-button-row' });

    // Color Day button
    const colorBtn = createEl('button', {
      className: `cc3-action-btn ${state.activePanel === 'color' ? 'cc3-active' : ''}`,
      title: 'Add day color',
    });
    colorBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 0 20"/></svg><span>Color</span>';
    colorBtn.addEventListener('click', () => {
      state.activePanel = state.activePanel === 'color' ? null : 'color';
      renderToolbar();
    });
    buttonRow.appendChild(colorBtn);

    // Add Block button
    const blockBtn = createEl('button', {
      className: `cc3-action-btn ${state.activePanel === 'block' ? 'cc3-active' : ''}`,
      title: 'Add time block',
    });
    blockBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><span>Block</span>';
    blockBtn.addEventListener('click', () => {
      state.activePanel = state.activePanel === 'block' ? null : 'block';
      renderToolbar();
    });
    buttonRow.appendChild(blockBtn);

    // Collapse button
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
      // Don't re-render if panel is open to avoid disrupting user interaction
      if (!state.activePanel) {
        renderToolbar();
      }
    });

    // Add click outside listener
    document.addEventListener('click', handleClickOutside);
  }

  // Global API
  window.cc3Toolbar = { mount };
})();
