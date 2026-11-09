(function () {
  'use strict';

  const ICONS = {
    factory: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 21V9l6 3V8l6 4V5l6 3v13H3Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M7 17h2m3 0h2m3 0h2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    health: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 21s-8-4.8-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6.2-8 11-8 11Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M8 12h2l1.3-2.5L13 15l1.2-3H16" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    education: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m2.5 9 9.5-5 9.5 5-9.5 5-9.5-5Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M6 11v5.2c3.8 3.2 8.2 3.2 12 0V11M21.5 9v6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    energy: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M13.5 2.5 5 13h6l-.5 8.5L19 11h-6l.5-8.5Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
    logistics: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 6h11v11H3zM14 10h4l3 3v4h-7" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="7.5" cy="18" r="2" stroke="currentColor" stroke-width="1.7"/><circle cx="17.5" cy="18" r="2" stroke="currentColor" stroke-width="1.7"/></svg>',
    finance: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m3 9 9-5 9 5H3ZM5 10v8m4-8v8m6-8v8m4-8v8M3 21h18M4 18h16" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    retail: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 9h16l-1.2 11H5.2L4 9Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M8 9a4 4 0 0 1 8 0M9 13v3m6-3v3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    government: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m3 9 9-5 9 5H3ZM5 10v8m4-8v8m6-8v8m4-8v8M3 21h18M4 18h16" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    management: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M8 9h8M8 13h5M8 17h8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    iot: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="2.5" stroke="currentColor" stroke-width="1.7"/><path d="M6.4 6.4a8 8 0 0 0 0 11.2m11.2 0a8 8 0 0 0 0-11.2M3.6 3.6a12 12 0 0 0 0 16.8m16.8 0a12 12 0 0 0 0-16.8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    data: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 19V5m0 14h17M8 16l3-4 3 2 5-7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="16" r="1" fill="currentColor"/><circle cx="11" cy="12" r="1" fill="currentColor"/><circle cx="14" cy="14" r="1" fill="currentColor"/><circle cx="19" cy="7" r="1" fill="currentColor"/></svg>',
    infrastructure: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4" y="3" width="16" height="7" rx="1.5" stroke="currentColor" stroke-width="1.7"/><rect x="4" y="14" width="16" height="7" rx="1.5" stroke="currentColor" stroke-width="1.7"/><path d="M8 6.5h.01M8 17.5h.01M12 6.5h4M12 17.5h4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    workplace: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M8 21h8m-4-4v4M7 9h10m-10 4h6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    security: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3 20 6v5c0 5-3.4 8.2-8 10-4.6-1.8-8-5-8-10V6l8-3Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="m9 12 2 2 4-4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };

  const escapeHtml = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const byId = (items, id) => items.find((item) => item.id === id);

  function boot() {
    const dialog = document.querySelector('[data-demo-dialog]');
    const data = window.DEMO_DATA;
    if (!dialog || !data || dialog.dataset.demoEngineReady === 'true') return;

    const industrySelect = dialog.querySelector('select[data-industry-select]');
    const businessSelect = dialog.querySelector('select[data-business-select]');
    const selectGrid = dialog.querySelector('[data-industry-grid]');
    const businessGrid = dialog.querySelector('[data-business-grid]');
    const hasNativeSelects = Boolean(industrySelect || businessSelect);
    const businessControl = hasNativeSelects ? businessSelect : businessGrid;
    const summary = dialog.querySelector('[data-selection-summary]');
    const continueButtons = dialog.querySelectorAll('[data-continue]');
    const stages = Array.from(dialog.querySelectorAll('[data-step]'));
    const stepTitles = Array.from(dialog.querySelectorAll('[data-step] [data-screen-title]'));
    if ((hasNativeSelects && (!industrySelect || !businessSelect))
      || (!hasNativeSelects && (!selectGrid || !businessGrid))
      || !summary || stages.length !== 3) return;

    dialog.dataset.demoEngineReady = 'true';
    const state = { industryId: '', businessId: '', stage: 'select' };
    const scenarioKey = (industryId, businessId) => `${industryId}+${businessId}`;
    const getScenario = () => data.scenarios[scenarioKey(state.industryId, state.businessId)];
    let businessHint = dialog.querySelector('[data-business-hint]');

    if (!businessHint) {
      businessHint = dialog.querySelector('.business-panel .selection-note span');
      if (businessHint) businessHint.setAttribute('data-business-hint', '');
    }
    if (!businessHint) {
      businessHint = document.createElement('p');
      businessHint.className = 'business-help';
      businessHint.setAttribute('data-business-hint', '');
      businessControl.insertAdjacentElement('afterend', businessHint);
    }

    const describedBy = new Set((businessControl.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
    describedBy.add(businessHint.id || 'demo-business-guidance');
    if (!businessHint.id) businessHint.id = 'demo-business-guidance';
    businessHint.setAttribute('aria-live', 'polite');
    businessControl.setAttribute('aria-describedby', Array.from(describedBy).join(' '));

    function replaceSelectOptions(select, items, placeholderText) {
      const existingPlaceholder = Array.from(select.options).find((option) => option.value === '');
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = existingPlaceholder ? existingPlaceholder.textContent.trim() : placeholderText;
      select.replaceChildren(placeholder, ...items.map((item) => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = item.label;
        return option;
      }));
    }

    function renderIndustryChoices() {
      if (hasNativeSelects) {
        replaceSelectOptions(industrySelect, data.industries, '请选择客户行业');
        return;
      }
      selectGrid.innerHTML = data.industries.map((industry) => `
        <button class="choice-card" type="button" data-industry="${escapeHtml(industry.id)}" aria-pressed="false">
          <span class="choice-icon" aria-hidden="true">${ICONS[industry.icon] || ''}</span>
          <span class="choice-copy"><span class="choice-title">${escapeHtml(industry.label)}</span><span class="choice-desc">${escapeHtml(industry.description)}</span></span>
          <span class="choice-check" aria-hidden="true">✓</span>
        </button>`).join('');
    }

    function renderBusinessChoices() {
      if (hasNativeSelects) {
        replaceSelectOptions(businessSelect, data.businesses, '请先选择客户行业');
        return;
      }
      businessGrid.innerHTML = data.businesses.map((business) => `
        <button class="choice-card" type="button" data-business="${escapeHtml(business.id)}" aria-pressed="false">
          <span class="choice-icon" aria-hidden="true">${ICONS[business.icon] || ''}</span>
          <span class="choice-copy"><span class="choice-title">${escapeHtml(business.label)}</span><span class="choice-desc">${escapeHtml(business.description)}</span></span>
          <span class="choice-check" aria-hidden="true">✓</span>
        </button>`).join('');
    }

    function renderChoiceState() {
      const selectedIndustry = byId(data.industries, state.industryId);
      const selectedBusiness = byId(data.businesses, state.businessId);
      const validScenario = getScenario();

      const availableBusinesses = selectedIndustry
        ? data.businesses.filter((business) => Boolean(data.scenarios[scenarioKey(selectedIndustry.id, business.id)]))
        : [];

      if (hasNativeSelects) {
        industrySelect.value = state.industryId;
        businessSelect.disabled = !selectedIndustry;
        const placeholder = Array.from(businessSelect.options).find((option) => option.value === '');
        if (placeholder) {
          placeholder.textContent = selectedIndustry ? '请选择主营业务' : '请先选择客户行业';
          placeholder.disabled = false;
        }
        Array.from(businessSelect.options).forEach((option) => {
          if (!option.value) return;
          const business = byId(data.businesses, option.value);
          const available = Boolean(selectedIndustry && data.scenarios[scenarioKey(selectedIndustry.id, option.value)]);
          option.disabled = !available;
          option.title = available ? '' : selectedIndustry
            ? `本示例暂无“${selectedIndustry.label} + ${business ? business.label : option.textContent}”组合资料；这不代表公司不具备该业务。`
            : '请先选择客户行业';
        });
        businessSelect.value = state.businessId;
        businessSelect.title = selectedIndustry
          ? '请选择主营业务；灰色选项仅表示本示例暂无对应资料。'
          : '请先选择客户行业。';
      } else {
        dialog.querySelectorAll('[data-industry]').forEach((button) => {
          const selected = button.getAttribute('data-industry') === state.industryId;
          button.classList.toggle('is-selected', selected);
          button.setAttribute('aria-pressed', String(selected));
        });

        businessGrid.querySelectorAll('[data-business]').forEach((button) => {
          const businessId = button.getAttribute('data-business');
          const available = Boolean(selectedIndustry && data.scenarios[scenarioKey(selectedIndustry.id, businessId)]);
          button.disabled = !available;
          button.classList.toggle('is-selected', businessId === state.businessId);
          button.setAttribute('aria-pressed', String(businessId === state.businessId));
          button.title = available ? '' : selectedIndustry
            ? `本示例暂无“${selectedIndustry.label} + ${button.textContent.trim()}”组合资料；这不代表公司不具备该业务。`
            : '请先选择客户行业';
        });

        businessGrid.setAttribute('aria-label', selectedIndustry
          ? `${selectedIndustry.label}对应的主营业务选择。灰色选项仅表示本示例暂无对应资料。`
          : '请先选择客户行业，再选择主营业务。');
      }
      businessHint.textContent = selectedIndustry
        ? `本示例提供 ${availableBusinesses.length} 个适配项目；灰色业务仅表示暂无对应演示资料，不代表公司不具备该业务。`
        : '先选择客户行业，再选择自己公司的主营业务。灰色业务仅表示本示例暂无对应资料。';

      if (!selectedIndustry && selectedBusiness) {
        summary.textContent = `已选择主营业务：${selectedBusiness.label}。请选择客户行业。`;
      } else if (selectedIndustry && selectedBusiness && validScenario) {
        summary.textContent = `已选择 ${selectedIndustry.label} · ${selectedBusiness.label}，可继续查看对应的公开项目简报。`;
      } else if (selectedIndustry) {
        summary.textContent = `已选择客户行业：${selectedIndustry.label}。请再选择一项适配的主营业务。`;
      } else {
        summary.textContent = '尚未选择。请选择客户行业和主营业务后继续。';
      }

      continueButtons.forEach((button) => {
        button.disabled = !validScenario;
        button.setAttribute('aria-disabled', String(!validScenario));
      });
    }

    function renderFacts(project) {
      const target = dialog.querySelector('[data-brief-facts]');
      if (!target) return;
      target.innerHTML = project.facts.map((fact) => `
        <article class="fact-card">
          <span class="fact-label">${escapeHtml(fact.label)}</span>
          <strong class="fact-value">${escapeHtml(fact.value)}</strong>
          <span class="fact-note">${escapeHtml(fact.note)}</span>
        </article>`).join('');
    }

    function renderOverview(project) {
      const target = dialog.querySelector('[data-project-overview]');
      if (!target) return;
      target.innerHTML = `<p class="overview-copy">${escapeHtml(project.overview)}</p>
        <div class="goal-chips" aria-label="公开项目目标">${project.goals.map((goal) => `<span class="goal-chip">${escapeHtml(goal)}</span>`).join('')}</div>`;
    }

    function renderPeople(project) {
      const target = dialog.querySelector('[data-people-grid]');
      if (!target) return;
      target.innerHTML = data.people.map((person) => `
        <article class="person-card">
          <img class="person-photo" src="${escapeHtml(person.photo || '')}" alt="${escapeHtml(person.name)}照片" width="96" height="120" decoding="async" fetchpriority="high">
          <div class="person-copy"><strong class="person-name">${escapeHtml(person.name)}</strong><span class="person-role">${escapeHtml(project.peopleRoles[person.id] || '')}</span></div>
        </article>`).join('');
    }

    function renderDetails(project) {
      const panel = dialog.querySelector('[data-details-panel]');
      if (!panel) return;
      const sections = (Array.isArray(project.details) ? project.details : [])
        .filter((section) => section && typeof section === 'object')
        .map((section) => ({
          ...section,
          items: Array.isArray(section.items) ? section.items.filter((item) => item && item.status === '公开') : [],
        }))
        .filter((section) => section.items.length > 0);
      const detailsCard = panel.closest('.details-card');
      if (detailsCard) detailsCard.hidden = sections.length === 0;
      panel.innerHTML = sections.map((section) => `
        <section class="detail-section">
          <h3>${escapeHtml(section.title)}</h3>
          <dl class="detail-table">
            ${section.items.map((item) => `<dt>${escapeHtml(item.label)}</dt><dd><span class="detail-value">${escapeHtml(item.value)}</span><span class="detail-visibility is-public">公开信息</span></dd>`).join('')}
          </dl>
        </section>`).join('');
    }

    function populateProject() {
      const project = getScenario();
      if (!project) return false;
      const industry = byId(data.industries, project.industryId);
      const business = byId(data.businesses, project.businessId);
      const setText = (selector, value) => dialog.querySelectorAll(selector).forEach((node) => { node.textContent = value; });

      setText('[data-project-name]', project.projectName);
      setText('[data-client-name]', project.clientName);
      setText('[data-industry-label]', industry ? industry.label : '');
      setText('[data-business-label]', business ? business.label : '');
      setText('[data-project-description]', project.description);
      dialog.querySelectorAll('[data-demo-badge]').forEach((node) => { node.textContent = '演示资料 · 虚构客户'; });
      renderFacts(project);
      renderOverview(project);
      renderPeople(project);
      renderDetails(project);
      return true;
    }

    function updateStepIndicators(stageName) {
      dialog.querySelectorAll('[data-step-indicator]').forEach((indicator) => {
        const key = indicator.getAttribute('data-step-indicator');
        const active = key === stageName || (stageName === 'ready' && key === 'brief');
        indicator.dataset.active = String(active);
        if (active) indicator.setAttribute('aria-current', 'step');
        else indicator.removeAttribute('aria-current');
      });

      dialog.querySelectorAll('[data-current-step]').forEach((node) => {
        node.textContent = stageName === 'select' ? '01 / 02' : '02 / 02';
      });
      document.querySelectorAll('[data-step-footer]').forEach((footer) => {
        footer.hidden = footer.getAttribute('data-step-footer') !== stageName;
      });
    }

    function focusStageTitle(stageName) {
      const title = dialog.querySelector(`[data-step="${stageName}"] [data-screen-title]`);
      if (!title) return;
      if (!title.id) title.id = `demo-screen-title-${stageName}`;
      dialog.setAttribute('aria-labelledby', title.id);
      title.focus({ preventScroll: true });
    }

    function showStage(stageName, shouldFocus) {
      state.stage = stageName;
      stages.forEach((stage) => { stage.hidden = stage.getAttribute('data-step') !== stageName; });
      updateStepIndicators(stageName);
      const title = dialog.querySelector(`[data-step="${stageName}"] [data-screen-title]`);
      if (title) {
        if (!title.id) title.id = `demo-screen-title-${stageName}`;
        dialog.setAttribute('aria-labelledby', title.id);
      }
      if (shouldFocus) {
        const scrollTargets = new Set([
          dialog,
          dialog.querySelector('.dialog-scroll, [data-dialog-scroll], [data-scroll-container]'),
          document.scrollingElement,
          document.body,
        ].filter(Boolean));
        scrollTargets.forEach((target) => { target.scrollTop = 0; });
        window.scrollTo(0, 0);
        window.requestAnimationFrame(() => focusStageTitle(stageName));
      }
    }

    function setDetailsOpen(open) {
      const button = dialog.querySelector('[data-open-details]');
      const panel = dialog.querySelector('[data-details-panel]');
      if (!button || !panel) return;
      panel.hidden = !open;
      button.setAttribute('aria-expanded', String(open));
    }

    renderIndustryChoices();
    renderBusinessChoices();
    dialog.querySelectorAll('[data-step]').forEach((stage) => {
      stage.hidden = stage.getAttribute('data-step') !== 'select';
    });
    const detailsPanel = dialog.querySelector('[data-details-panel]');
    if (detailsPanel) detailsPanel.hidden = true;
    const detailsButton = dialog.querySelector('[data-open-details]');
    if (detailsButton) detailsButton.setAttribute('aria-expanded', 'false');
    if (dialog.querySelector('[data-demo-badge]')) {
      dialog.querySelectorAll('[data-demo-badge]').forEach((node) => { node.textContent = '演示资料 · 虚构客户'; });
    }
    renderChoiceState();
    showStage('select', false);

    function chooseIndustry(industryId) {
      const previousBusiness = state.businessId;
      state.industryId = industryId;
      if (previousBusiness && !data.scenarios[scenarioKey(state.industryId, previousBusiness)]) state.businessId = '';
      renderChoiceState();
    }

    function chooseBusiness(businessId) {
      state.businessId = businessId && data.scenarios[scenarioKey(state.industryId, businessId)] ? businessId : '';
      renderChoiceState();
    }

    if (hasNativeSelects) {
      industrySelect.addEventListener('change', () => chooseIndustry(industrySelect.value));
      businessSelect.addEventListener('change', () => chooseBusiness(businessSelect.value));
    }

    dialog.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target.closest('button') : null;
      if (!target || !dialog.contains(target) || target.disabled) return;

      if (target.hasAttribute('data-industry')) {
        chooseIndustry(target.getAttribute('data-industry'));
        return;
      }

      if (target.hasAttribute('data-business')) {
        chooseBusiness(target.getAttribute('data-business'));
        return;
      }

      if (target.hasAttribute('data-continue')) {
        if (getScenario() && populateProject()) {
          setDetailsOpen(false);
          showStage('brief', true);
        }
        return;
      }

      if (target.hasAttribute('data-back')) {
        setDetailsOpen(false);
        showStage('select', true);
        return;
      }

      if (target.hasAttribute('data-open-details')) {
        const open = target.getAttribute('aria-expanded') !== 'true';
        setDetailsOpen(open);
        return;
      }

      if (target.hasAttribute('data-start')) {
        showStage('ready', true);
        return;
      }

      if (target.hasAttribute('data-review')) {
        populateProject();
        setDetailsOpen(false);
        showStage('brief', true);
        return;
      }

      if (target.hasAttribute('data-restart')) {
        setDetailsOpen(false);
        showStage('select', true);
      }
    });

    const motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    let motionUserChoice = null;
    const motionButtons = dialog.querySelectorAll('[data-motion-toggle]');
    function setReducedMotion(reduced) {
      document.documentElement.classList.toggle('reduce-motion', reduced);
      motionButtons.forEach((button) => button.setAttribute('aria-pressed', String(reduced)));
    }
    setReducedMotion(Boolean(motionQuery && motionQuery.matches));
    motionButtons.forEach((button) => button.addEventListener('click', () => {
      const nextValue = button.getAttribute('aria-pressed') !== 'true';
      motionUserChoice = nextValue;
      setReducedMotion(nextValue);
    }));
    if (motionQuery) {
      const updateSystemMotion = (event) => {
        if (motionUserChoice === null) setReducedMotion(Boolean(event.matches));
      };
      if (typeof motionQuery.addEventListener === 'function') motionQuery.addEventListener('change', updateSystemMotion);
      else if (typeof motionQuery.addListener === 'function') motionQuery.addListener(updateSystemMotion);
    }

    const ready = dialog.querySelector('[data-step="ready"]');
    if (ready && !ready.textContent.includes('不会创建真实对局')) {
      const note = document.createElement('p');
      note.className = 'ready-demo-note';
      note.textContent = '本页为开场演示，不会创建真实对局，也不会启动倒计时或连接数据库。';
      ready.appendChild(note);
    }

    dialog.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        if (dialog.querySelector('[data-details-panel]:not([hidden])')) {
          setDetailsOpen(false);
          const button = dialog.querySelector('[data-open-details]');
          if (button) button.focus();
          event.preventDefault();
        }
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(dialog.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
        .filter((element) => element.getClientRects().length > 0 && !element.closest('[hidden]'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
