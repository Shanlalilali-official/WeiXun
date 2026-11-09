(function () {
  'use strict';

  var CATALOG_URL = '/api/game-data/project-one-onboarding';
  var STYLE_LINK_ATTRIBUTE = 'data-project-one-onboarding-styles';
  var nextDialogId = 0;
  var activeInstance = null;
  var cachedCatalog = null;
  var catalogRequest = null;

  function loadStylesheet() {
    if (document.querySelector('link[' + STYLE_LINK_ATTRIBUTE + ']')) return;

    var script = document.currentScript;
    var href = script && script.src
      ? new URL('project-one-onboarding.css', script.src).href
      : '/project-one-onboarding.css';
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute(STYLE_LINK_ATTRIBUTE, '');
    (document.head || document.documentElement).appendChild(link);
  }

  function displayText(value) {
    return typeof value === 'string' ? value : '';
  }

  function element(tagName, className, text) {
    var node = document.createElement(tagName);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = displayText(text);
    return node;
  }

  function makeButton(label, className, dataAttribute) {
    var button = element('button', className, label);
    button.type = 'button';
    if (dataAttribute) button.setAttribute(dataAttribute, '');
    return button;
  }

  function makeOption(value, label) {
    var option = element('option', '', label);
    option.value = value;
    return option;
  }

  function mapCatalogItems(value) {
    if (!Array.isArray(value)) return [];
    return value
      .filter(function (item) {
        return item && typeof item.id === 'string' && item.id.length > 0
          && typeof item.label === 'string' && item.label.length > 0;
      })
      .map(function (item) {
        return { id: item.id, label: item.label };
      });
  }

  function normalizeCatalog(payload) {
    var source = payload && typeof payload === 'object' ? payload.catalog : null;
    if (!source || typeof source !== 'object') {
      throw new Error('开场目录暂不可用，请稍后重试。');
    }

    var industries = mapCatalogItems(source.industries);
    var businesses = mapCatalogItems(source.businesses);
    var scenarios = Array.isArray(source.scenarios)
      ? source.scenarios.filter(function (brief) {
        return brief && typeof brief.id === 'string' && brief.id.length > 0
          && typeof brief.industryId === 'string' && brief.industryId.length > 0
          && typeof brief.businessId === 'string' && brief.businessId.length > 0;
      })
      : [];

    if (!industries.length || !businesses.length || !scenarios.length) {
      throw new Error('开场目录暂不可用，请稍后重试。');
    }

    return { industries: industries, businesses: businesses, scenarios: scenarios };
  }

  function requestCatalog() {
    if (cachedCatalog) return Promise.resolve(cachedCatalog);
    if (catalogRequest) return catalogRequest;

    catalogRequest = fetch(CATALOG_URL, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
      .then(function (response) {
        if (!response.ok) throw new Error('开场目录暂不可用，请稍后重试。');
        return response.json();
      })
      .then(function (payload) {
        cachedCatalog = normalizeCatalog(payload);
        return cachedCatalog;
      })
      .catch(function (error) {
        catalogRequest = null;
        throw error;
      });

    return catalogRequest;
  }

  function normalizeBrief(source) {
    return {
      id: displayText(source.id),
      industryId: displayText(source.industryId),
      businessId: displayText(source.businessId),
      projectName: displayText(source.projectName),
      clientName: displayText(source.clientName),
      description: displayText(source.description),
      overview: displayText(source.overview),
      goals: Array.isArray(source.goals)
        ? source.goals.filter(function (item) { return typeof item === 'string'; })
        : [],
      facts: Array.isArray(source.facts)
        ? source.facts.filter(Boolean).map(function (fact) {
          return {
            label: displayText(fact.label),
            value: displayText(fact.value),
            note: displayText(fact.note),
          };
        })
        : [],
      details: Array.isArray(source.details)
        ? source.details.filter(Boolean).map(function (section) {
          return {
            title: displayText(section.title),
            items: Array.isArray(section.items)
              ? section.items.filter(Boolean).map(function (item) {
                return {
                  label: displayText(item.label),
                  value: displayText(item.value),
                };
              })
              : [],
          };
        })
        : [],
      people: Array.isArray(source.people)
        ? source.people.filter(Boolean).map(function (person) {
          return {
            id: displayText(person.id),
            name: displayText(person.name),
            title: displayText(person.title),
            photo: displayText(person.photo),
          };
        })
        : [],
    };
  }

  function publicPhotoUrl(value) {
    if (!value) return '';
    try {
      var url = new URL(value, window.location.href);
      if (url.origin !== window.location.origin || url.pathname.indexOf('/assets/people/') !== 0) {
        return '';
      }
      return url.href;
    } catch (_) {
      return '';
    }
  }

  function createRing() {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'po-opening-ring');
    svg.setAttribute('viewBox', '0 0 38 38');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');

    var circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '19');
    circle.setAttribute('cy', '19');
    circle.setAttribute('r', '17');
    circle.setAttribute('data-opening-animation', '');
    svg.appendChild(circle);
    return svg;
  }

  function createDialogDom() {
    var id = ++nextDialogId;
    var dialog = element('dialog', 'po-dialog');
    var selectTitleId = 'project-one-onboarding-select-title-' + id;
    var briefTitleId = 'project-one-onboarding-brief-title-' + id;
    var detailsId = 'project-one-onboarding-details-' + id;
    dialog.setAttribute('data-project-one-onboarding', '');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', selectTitleId);

    var shell = element('div', 'po-shell');
    var header = element('header', 'po-header');
    var brand = element('div', 'po-brand');
    var brandMark = element('span', 'po-brand-mark');
    brandMark.setAttribute('aria-hidden', 'true');
    brandMark.appendChild(element('span', 'po-brand-glyph', '▦'));
    brandMark.appendChild(createRing());
    var brandCopy = element('div', 'po-brand-copy');
    brandCopy.appendChild(element('strong', '', '项目一开场'));
    brandCopy.appendChild(element('span', '', '销售作战台'));
    brand.appendChild(brandMark);
    brand.appendChild(brandCopy);

    var headerActions = element('div', 'po-header-actions');
    var motionButton = makeButton('减少动画', 'po-motion-button', 'data-motion-toggle');
    motionButton.setAttribute('aria-pressed', 'false');
    var cancelButton = makeButton('×', 'po-close-button', 'data-onboarding-cancel');
    cancelButton.setAttribute('aria-label', '关闭开场');
    headerActions.appendChild(motionButton);
    headerActions.appendChild(cancelButton);
    header.appendChild(brand);
    header.appendChild(headerActions);
    shell.appendChild(header);

    var stepper = element('nav', 'po-stepper');
    stepper.setAttribute('aria-label', '开场步骤');
    var selectStep = element('div', 'po-step-item');
    selectStep.setAttribute('data-step-indicator', 'select');
    selectStep.setAttribute('data-active', 'true');
    selectStep.setAttribute('aria-current', 'step');
    selectStep.appendChild(element('span', 'po-step-number', '1'));
    selectStep.appendChild(element('span', '', '选择方向'));
    var connector = element('span', 'po-step-connector');
    connector.setAttribute('aria-hidden', 'true');
    var briefStep = element('div', 'po-step-item');
    briefStep.setAttribute('data-step-indicator', 'brief');
    briefStep.setAttribute('data-active', 'false');
    briefStep.appendChild(element('span', 'po-step-number', '2'));
    briefStep.appendChild(element('span', '', '客户简报'));
    var stepCount = element('span', 'po-step-count', '01 / 02');
    stepCount.setAttribute('data-current-step', '');
    stepper.appendChild(selectStep);
    stepper.appendChild(connector);
    stepper.appendChild(briefStep);
    stepper.appendChild(stepCount);
    shell.appendChild(stepper);

    var scroll = element('div', 'po-scroll');
    scroll.setAttribute('data-dialog-scroll', '');
    var selectStage = element('section', 'po-stage');
    selectStage.setAttribute('data-step', 'select');
    var selectLayout = element('div', 'po-select-layout');
    var welcome = element('article', 'po-welcome');
    var welcomeCopy = element('div', 'po-welcome-copy');
    welcomeCopy.appendChild(element('span', 'po-kicker', '客户沟通 · 项目协同'));
    var selectTitle = element('h1', 'po-title', '欢迎进入项目一');
    selectTitle.id = selectTitleId;
    selectTitle.tabIndex = -1;
    welcomeCopy.appendChild(selectTitle);
    welcomeCopy.appendChild(element(
      'p',
      'po-lead',
      '从需求沟通与项目协作出发，了解客户情境。选择客户行业和我方主营业务，查看对应的公开项目简报。',
    ));
    var hero = element('figure', 'po-hero');
    var heroImage = element('img', 'po-hero-image');
    heroImage.src = '/assets/project-one-onboarding.webp';
    heroImage.alt = '写实商务会议场景，项目团队围绕资料沟通协作';
    heroImage.width = 420;
    heroImage.height = 280;
    heroImage.decoding = 'async';
    hero.appendChild(heroImage);
    welcome.appendChild(welcomeCopy);
    welcome.appendChild(hero);

    var selectorPanel = element('div', 'po-selector-panel');
    selectorPanel.setAttribute('aria-label', '选择客户方向');
    var industryField = element('div', 'po-field');
    var industryLabel = element('label', '', '客户所属行业');
    industryLabel.htmlFor = 'project-one-onboarding-industry-' + id;
    var industrySelect = element('select', 'po-select');
    industrySelect.id = industryLabel.htmlFor;
    industrySelect.name = 'industry';
    industrySelect.setAttribute('aria-describedby', 'project-one-onboarding-industry-hint-' + id);
    industrySelect.disabled = true;
    industrySelect.appendChild(makeOption('', '请选择客户行业'));
    industryField.appendChild(industryLabel);
    industryField.appendChild(industrySelect);
    industryField.appendChild(element('p', 'po-field-hint', '请选择客户所属行业。'));

    var businessField = element('div', 'po-field');
    var businessLabel = element('label', '', '我方主营业务');
    businessLabel.htmlFor = 'project-one-onboarding-business-' + id;
    var businessSelect = element('select', 'po-select');
    businessSelect.id = businessLabel.htmlFor;
    businessSelect.name = 'business';
    businessSelect.setAttribute('aria-describedby', 'project-one-onboarding-business-hint-' + id);
    businessSelect.disabled = true;
    businessSelect.appendChild(makeOption('', '请先选择客户行业'));
    var businessHint = element('p', 'po-field-hint', '先选择客户行业，再选择主营业务。');
    businessHint.id = 'project-one-onboarding-business-hint-' + id;
    industryField.querySelector('.po-field-hint').id = 'project-one-onboarding-industry-hint-' + id;
    businessField.appendChild(businessLabel);
    businessField.appendChild(businessSelect);
    businessField.appendChild(businessHint);

    var selectionSummary = element(
      'p',
      'po-selection-summary',
      '尚未选择。请选择客户行业和主营业务后继续。',
    );
    selectionSummary.setAttribute('role', 'status');
    selectionSummary.setAttribute('aria-live', 'polite');
    var catalogError = element('div', 'po-catalog-error');
    catalogError.hidden = true;
    var catalogErrorText = element('p', 'po-catalog-error-text', '暂时无法读取项目目录，请重试。');
    catalogErrorText.setAttribute('role', 'alert');
    var retryCatalogButton = makeButton('重试读取目录', 'po-button po-button-secondary', 'data-retry-catalog');
    catalogError.appendChild(catalogErrorText);
    catalogError.appendChild(retryCatalogButton);
    selectorPanel.appendChild(industryField);
    selectorPanel.appendChild(businessField);
    selectorPanel.appendChild(selectionSummary);
    selectorPanel.appendChild(catalogError);
    selectLayout.appendChild(welcome);
    selectLayout.appendChild(selectorPanel);
    selectStage.appendChild(selectLayout);

    var briefStage = element('section', 'po-stage');
    briefStage.setAttribute('data-step', 'brief');
    briefStage.hidden = true;
    var briefTop = element('div', 'po-brief-top');
    var briefTitleGroup = element('div', 'po-brief-title-group');
    var briefTitle = element('h1', 'po-title po-brief-title', '客户项目简报');
    briefTitle.id = briefTitleId;
    briefTitle.tabIndex = -1;
    var clientName = element('strong', 'po-client-name', '');
    briefTitleGroup.appendChild(briefTitle);
    briefTitleGroup.appendChild(clientName);
    var briefTags = element('div', 'po-brief-tags');
    var industryTag = element('span', 'po-brief-tag', '');
    var businessTag = element('span', 'po-brief-tag', '');
    briefTags.appendChild(industryTag);
    briefTags.appendChild(businessTag);
    briefTop.appendChild(briefTitleGroup);
    briefTop.appendChild(briefTags);
    var description = element('p', 'po-brief-description', '');

    var briefCard = element('section', 'po-card');
    briefCard.setAttribute('aria-label', '项目要点');
    var factsHeading = element('div', 'po-section-heading');
    factsHeading.appendChild(element('h2', '', '项目要点'));
    factsHeading.appendChild(element('span', '', '公开简报'));
    var factsGrid = element('div', 'po-facts-grid');
    var overview = element('div', 'po-overview');
    var goalsList = element('ul', 'po-goals');
    briefCard.appendChild(factsHeading);
    briefCard.appendChild(factsGrid);
    briefCard.appendChild(overview);
    briefCard.appendChild(goalsList);

    var peopleCard = element('section', 'po-card');
    peopleCard.setAttribute('aria-label', '客户项目联系人');
    var peopleHeading = element('div', 'po-section-heading');
    peopleHeading.appendChild(element('h2', '', '项目联系人'));
    var peopleCount = element('span', '', '');
    peopleHeading.appendChild(peopleCount);
    var peopleGrid = element('div', 'po-people-grid');
    peopleCard.appendChild(peopleHeading);
    peopleCard.appendChild(peopleGrid);

    var detailsCard = element('section', 'po-card po-details-card');
    var detailsButton = makeButton('查看项目公开详情', 'po-details-toggle', 'data-open-details');
    detailsButton.setAttribute('aria-expanded', 'false');
    detailsButton.setAttribute('aria-controls', detailsId);
    var chevron = element('span', 'po-chevron', '⌄');
    chevron.setAttribute('aria-hidden', 'true');
    detailsButton.appendChild(chevron);
    var detailsPanel = element('div', 'po-details-panel');
    detailsPanel.id = detailsId;
    detailsPanel.setAttribute('data-details-panel', '');
    detailsPanel.hidden = true;
    detailsCard.appendChild(detailsButton);
    detailsCard.appendChild(detailsPanel);
    briefStage.appendChild(briefTop);
    briefStage.appendChild(description);
    briefStage.appendChild(briefCard);
    briefStage.appendChild(peopleCard);
    briefStage.appendChild(detailsCard);
    scroll.appendChild(selectStage);
    scroll.appendChild(briefStage);
    shell.appendChild(scroll);

    var selectFooter = element('footer', 'po-footer');
    selectFooter.setAttribute('data-step-footer', 'select');
    selectFooter.appendChild(element('p', 'po-footer-note', '选择行业与主营业务后查看客户简报。'));
    var continueButton = makeButton('查看客户简报', 'po-button po-button-primary', 'data-continue');
    continueButton.disabled = true;
    var selectActions = element('div', 'po-actions');
    selectActions.appendChild(continueButton);
    selectFooter.appendChild(selectActions);

    var briefFooter = element('footer', 'po-footer');
    briefFooter.setAttribute('data-step-footer', 'brief');
    briefFooter.hidden = true;
    var briefFooterCopy = element('div', 'po-footer-copy');
    briefFooterCopy.appendChild(element('p', 'po-footer-note', '先浏览项目摘要与联系人资料。'));
    var startStatus = element('p', 'po-start-status');
    startStatus.hidden = true;
    startStatus.setAttribute('role', 'status');
    startStatus.setAttribute('aria-live', 'polite');
    startStatus.setAttribute('aria-atomic', 'true');
    briefFooterCopy.appendChild(startStatus);
    var briefActions = element('div', 'po-actions');
    var backButton = makeButton('返回修改', 'po-button po-button-secondary', 'data-back');
    var startButton = makeButton('开始训练', 'po-button po-button-primary', 'data-start');
    startButton.disabled = true;
    briefActions.appendChild(backButton);
    briefActions.appendChild(startButton);
    briefFooter.appendChild(briefFooterCopy);
    briefFooter.appendChild(briefActions);

    shell.appendChild(selectFooter);
    shell.appendChild(briefFooter);
    dialog.appendChild(shell);

    return {
      dialog: dialog,
      shell: shell,
      selectTitle: selectTitle,
      briefTitle: briefTitle,
      motionButton: motionButton,
      cancelButton: cancelButton,
      selectStep: selectStep,
      briefStep: briefStep,
      stepCount: stepCount,
      scroll: scroll,
      selectStage: selectStage,
      briefStage: briefStage,
      industrySelect: industrySelect,
      businessSelect: businessSelect,
      industryHint: industryField.querySelector('.po-field-hint'),
      businessHint: businessHint,
      selectionSummary: selectionSummary,
      catalogError: catalogError,
      retryCatalogButton: retryCatalogButton,
      continueButton: continueButton,
      clientName: clientName,
      industryTag: industryTag,
      businessTag: businessTag,
      description: description,
      factsGrid: factsGrid,
      overview: overview,
      goalsList: goalsList,
      peopleCount: peopleCount,
      peopleGrid: peopleGrid,
      detailsButton: detailsButton,
      detailsPanel: detailsPanel,
      selectFooter: selectFooter,
      briefFooter: briefFooter,
      startStatus: startStatus,
      backButton: backButton,
      startButton: startButton,
    };
  }

  function clearChildren(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function optionFor(items, selectedId) {
    return items.find(function (item) { return item.id === selectedId; }) || null;
  }

  function makeFactCard(fact) {
    var card = element('div', 'po-fact-card');
    card.appendChild(element('span', 'po-fact-label', fact.label));
    card.appendChild(element('strong', 'po-fact-value', fact.value));
    if (fact.note) card.appendChild(element('span', 'po-fact-note', fact.note));
    return card;
  }

  function renderBrief(instance, source, industry, business) {
    var refs = instance.refs;
    var brief = normalizeBrief(source);
    instance.currentBrief = brief;
    refs.briefTitle.textContent = brief.projectName || '客户项目简报';
    refs.clientName.textContent = brief.clientName;
    refs.industryTag.textContent = industry ? industry.label : '';
    refs.businessTag.textContent = business ? business.label : '';
    refs.description.textContent = brief.description;

    clearChildren(refs.factsGrid);
    brief.facts.forEach(function (fact) {
      refs.factsGrid.appendChild(makeFactCard(fact));
    });

    clearChildren(refs.overview);
    if (brief.overview) {
      refs.overview.appendChild(element('p', 'po-overview-copy', brief.overview));
    }

    clearChildren(refs.goalsList);
    if (brief.goals.length) {
      brief.goals.forEach(function (goal) {
        refs.goalsList.appendChild(element('li', 'po-goal', goal));
      });
    }
    refs.goalsList.hidden = brief.goals.length === 0;

    clearChildren(refs.peopleGrid);
    refs.peopleCount.textContent = brief.people.length + ' 位联系人';
    brief.people.forEach(function (person) {
      var card = element('article', 'po-person-card');
      var photoFrame = element('span', 'po-person-photo-frame');
      var fallback = element('span', 'po-person-fallback', person.name.slice(0, 1) || '•');
      fallback.setAttribute('aria-hidden', 'true');
      photoFrame.appendChild(fallback);
      var photoUrl = publicPhotoUrl(person.photo);
      if (photoUrl) {
        var image = element('img', 'po-person-photo');
        image.src = photoUrl;
        image.alt = person.name ? person.name + '头像' : '联系人头像';
        image.width = 64;
        image.height = 64;
        image.loading = 'lazy';
        image.decoding = 'async';
        image.addEventListener('error', function () { image.remove(); }, { once: true });
        photoFrame.appendChild(image);
      }
      var copy = element('div', 'po-person-copy');
      copy.appendChild(element('strong', 'po-person-name', person.name));
      copy.appendChild(element('span', 'po-person-title', person.title));
      card.appendChild(photoFrame);
      card.appendChild(copy);
      refs.peopleGrid.appendChild(card);
    });

    clearChildren(refs.detailsPanel);
    brief.details.forEach(function (section) {
      var sectionNode = element('section', 'po-detail-section');
      sectionNode.appendChild(element('h3', '', section.title));
      var list = element('dl', 'po-detail-list');
      section.items.forEach(function (item) {
        list.appendChild(element('dt', '', item.label));
        list.appendChild(element('dd', '', item.value));
      });
      sectionNode.appendChild(list);
      refs.detailsPanel.appendChild(sectionNode);
    });
    refs.detailsButton.setAttribute('aria-expanded', 'false');
    refs.detailsPanel.hidden = true;
    refs.startStatus.textContent = '';
    refs.startStatus.hidden = true;
    refs.startButton.disabled = typeof instance.callbacks.onStart !== 'function';
    refs.dialog.setAttribute('aria-labelledby', refs.briefTitle.id);
    return brief;
  }

  function setOptions(select, items, placeholderText) {
    clearChildren(select);
    select.appendChild(makeOption('', placeholderText));
    items.forEach(function (item) {
      select.appendChild(makeOption(item.id, item.label));
    });
  }

  function setCatalogState(instance, catalog) {
    if (!instance.dialog.open) return;
    instance.catalog = catalog;
    var refs = instance.refs;
    setOptions(refs.industrySelect, catalog.industries, '请选择客户行业');
    refs.industrySelect.disabled = false;
    refs.businessSelect.disabled = true;
    setOptions(refs.businessSelect, [], '请先选择客户行业');
    refs.industryHint.textContent = '请选择客户所属行业。';
    refs.businessHint.textContent = '先选择客户行业，再选择主营业务。';
    refs.catalogError.hidden = true;
    refs.selectionSummary.textContent = '尚未选择。请选择客户行业和主营业务后继续。';
    updateSelection(instance);
  }

  function setCatalogError(instance) {
    if (!instance.dialog.open) return;
    var refs = instance.refs;
    refs.industrySelect.disabled = true;
    refs.businessSelect.disabled = true;
    refs.continueButton.disabled = true;
    refs.selectionSummary.textContent = '目录暂不可用，修复连接后可以重试。';
    refs.catalogError.hidden = false;
    refs.retryCatalogButton.disabled = false;
  }

  function loadCatalogFor(instance) {
    return requestCatalog().then(function (catalog) {
      setCatalogState(instance, catalog);
      return catalog;
    }).catch(function () {
      setCatalogError(instance);
      return null;
    });
  }

  function setStage(instance, stage, moveFocus) {
    var refs = instance.refs;
    var isSelect = stage === 'select';
    refs.selectStage.hidden = !isSelect;
    refs.briefStage.hidden = isSelect;
    refs.selectFooter.hidden = !isSelect;
    refs.briefFooter.hidden = isSelect;
    refs.selectStep.setAttribute('data-active', String(isSelect));
    refs.briefStep.setAttribute('data-active', String(!isSelect));
    if (isSelect) {
      refs.selectStep.setAttribute('aria-current', 'step');
      refs.briefStep.removeAttribute('aria-current');
      refs.stepCount.textContent = '01 / 02';
      refs.dialog.setAttribute('aria-labelledby', refs.selectTitle.id);
    } else {
      refs.briefStep.setAttribute('aria-current', 'step');
      refs.selectStep.removeAttribute('aria-current');
      refs.stepCount.textContent = '02 / 02';
      refs.dialog.setAttribute('aria-labelledby', refs.briefTitle.id);
    }
    refs.scroll.scrollTop = 0;
    if (moveFocus) {
      var heading = isSelect ? refs.selectTitle : refs.briefTitle;
      try {
        heading.focus({ preventScroll: true });
      } catch (_) {
        heading.focus();
      }
    }
  }

  function updateSelection(instance) {
    var refs = instance.refs;
    if (!instance.catalog) return;

    var industry = optionFor(instance.catalog.industries, refs.industrySelect.value);
    var matchingBusinesses = industry
      ? instance.catalog.businesses.filter(function (business) {
        return instance.catalog.scenarios.some(function (brief) {
          return brief.industryId === industry.id && brief.businessId === business.id;
        });
      })
      : [];
    var selectedBusiness = optionFor(matchingBusinesses, refs.businessSelect.value);

    if (!industry) {
      refs.businessSelect.disabled = true;
      setOptions(refs.businessSelect, [], '请先选择客户行业');
      refs.businessHint.textContent = '先选择客户行业，再选择主营业务。';
      refs.industryHint.textContent = '请选择客户所属行业。';
      refs.selectionSummary.textContent = '尚未选择。请选择客户行业和主营业务后继续。';
      refs.continueButton.disabled = true;
      return;
    }

    if (!matchingBusinesses.length) {
      refs.businessSelect.disabled = true;
      setOptions(refs.businessSelect, [], '当前行业暂无可选业务');
      refs.businessHint.textContent = '当前行业暂时没有可匹配的主营业务。';
      refs.industryHint.textContent = industry.label;
      refs.selectionSummary.textContent = '当前行业暂无可匹配的项目方向。';
      refs.continueButton.disabled = true;
      return;
    }

    var previousBusiness = refs.businessSelect.value;
    setOptions(refs.businessSelect, matchingBusinesses, '请选择主营业务');
    if (matchingBusinesses.some(function (business) { return business.id === previousBusiness; })) {
      refs.businessSelect.value = previousBusiness;
      selectedBusiness = optionFor(matchingBusinesses, previousBusiness);
    } else {
      refs.businessSelect.value = '';
      selectedBusiness = null;
    }
    refs.businessSelect.disabled = false;
    refs.industryHint.textContent = industry.label;
    refs.businessHint.textContent = selectedBusiness
      ? '已选择匹配的主营业务。'
      : '请选择一项主营业务查看对应客户简报。';

    if (selectedBusiness) {
      refs.selectionSummary.textContent = '已选择：' + industry.label + ' · ' + selectedBusiness.label + '。查看匹配的客户项目公开简报。';
    } else {
      refs.selectionSummary.textContent = '已选择客户行业。请选择主营业务后查看客户项目公开简报。';
    }
    refs.continueButton.disabled = !selectedBusiness;
  }

  function toggleDetails(instance) {
    var button = instance.refs.detailsButton;
    var panel = instance.refs.detailsPanel;
    var isOpen = button.getAttribute('aria-expanded') !== 'true';
    button.setAttribute('aria-expanded', String(isOpen));
    panel.hidden = !isOpen;
  }

  function setStartStatus(instance, message, isError) {
    var status = instance.refs.startStatus;
    status.textContent = message || '';
    status.hidden = !message;
    status.setAttribute('data-error', String(Boolean(isError)));
  }

  function displayStartError(error) {
    var message = error && typeof error.message === 'string' ? error.message.trim() : '';
    return message ? message.slice(0, 240) : '开始训练失败，请检查后重试。';
  }

  function setStarting(instance, starting) {
    instance.starting = starting;
    var refs = instance.refs;
    refs.startButton.disabled = starting || typeof instance.callbacks.onStart !== 'function';
    refs.backButton.disabled = starting;
    refs.cancelButton.disabled = starting;
    refs.dialog.setAttribute('aria-busy', String(starting));
  }

  async function startTraining(instance) {
    if (instance.starting || !instance.currentBrief || typeof instance.callbacks.onStart !== 'function') return;
    setStarting(instance, true);
    setStartStatus(instance, '正在开始训练…', false);

    try {
      var result = await instance.callbacks.onStart(instance.currentBrief);
      if (result === false) {
        setStartStatus(instance, '开始请求未完成，请重试。', true);
        setStarting(instance, false);
        return;
      }
      instance.closeReason = 'started';
      instance.dialog.close('started');
    } catch (error) {
      setStartStatus(instance, displayStartError(error), true);
      setStarting(instance, false);
    }
  }

  function installMotionControls(instance) {
    var media = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;
    instance.motionMedia = media;
    instance.motionUserChoice = null;

    function setReducedMotion(reduced) {
      instance.refs.dialog.classList.toggle('po-reduced-motion', reduced);
      instance.refs.motionButton.setAttribute('aria-pressed', String(reduced));
    }
    instance.setReducedMotion = setReducedMotion;
    setReducedMotion(Boolean(media && media.matches));

    instance.refs.motionButton.addEventListener('click', function () {
      var next = instance.refs.motionButton.getAttribute('aria-pressed') !== 'true';
      instance.motionUserChoice = next;
      setReducedMotion(next);
    });

    if (media) {
      instance.onMotionChange = function (event) {
        if (instance.motionUserChoice === null) setReducedMotion(Boolean(event.matches));
      };
      if (typeof media.addEventListener === 'function') media.addEventListener('change', instance.onMotionChange);
      else if (typeof media.addListener === 'function') media.addListener(instance.onMotionChange);
    }
  }

  function unlockPageScroll(instance) {
    if (!instance.scrollLock) return;
    document.documentElement.style.overflow = instance.scrollLock.htmlOverflow;
    document.body.style.overflow = instance.scrollLock.bodyOverflow;
    document.documentElement.classList.remove('po-onboarding-scroll-locked');
    document.body.classList.remove('po-onboarding-scroll-locked');
    instance.scrollLock = null;
  }

  function lockPageScroll(instance) {
    instance.scrollLock = {
      htmlOverflow: document.documentElement.style.overflow,
      bodyOverflow: document.body.style.overflow,
    };
    document.documentElement.classList.add('po-onboarding-scroll-locked');
    document.body.classList.add('po-onboarding-scroll-locked');
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
  }

  function finalizeClose(instance) {
    if (instance.finalized) return;
    instance.finalized = true;
    if (instance.motionMedia && instance.onMotionChange) {
      if (typeof instance.motionMedia.removeEventListener === 'function') {
        instance.motionMedia.removeEventListener('change', instance.onMotionChange);
      } else if (typeof instance.motionMedia.removeListener === 'function') {
        instance.motionMedia.removeListener(instance.onMotionChange);
      }
    }
    unlockPageScroll(instance);
    instance.dialog.remove();
    if (activeInstance === instance) activeInstance = null;

    if (instance.previousFocus && instance.previousFocus.isConnected
      && typeof instance.previousFocus.focus === 'function') {
      try {
        instance.previousFocus.focus({ preventScroll: true });
      } catch (_) {
        instance.previousFocus.focus();
      }
    }

    if (typeof instance.callbacks.onClose === 'function') {
      try {
        instance.callbacks.onClose(instance.closeReason || instance.dialog.returnValue || 'closed');
      } catch (_) {
        // A consumer close handler must not leave the native dialog mounted.
      }
    }
  }

  function open(options) {
    if (activeInstance && (activeInstance.dialog.open || !activeInstance.finalized)) {
      return activeInstance.dialog;
    }
    if (!document.body) throw new Error('开场弹窗需要在页面 DOM 创建后打开。');

    var callbacks = options && typeof options === 'object' ? options : {};
    var refs = createDialogDom();
    var instance = {
      dialog: refs.dialog,
      refs: refs,
      callbacks: callbacks,
      catalog: null,
      currentBrief: null,
      starting: false,
      finalized: false,
      closeReason: '',
      previousFocus: document.activeElement,
      scrollLock: null,
    };
    activeInstance = instance;
    lockPageScroll(instance);
    document.body.appendChild(refs.dialog);

    refs.dialog.addEventListener('close', function () {
      finalizeClose(instance);
    });
    refs.dialog.addEventListener('cancel', function (event) {
      if (instance.starting) {
        event.preventDefault();
        setStartStatus(instance, '训练仍在启动，请稍后再操作。', false);
        return;
      }
      instance.closeReason = 'cancelled';
    });
    refs.cancelButton.addEventListener('click', function () {
      if (instance.starting) return;
      instance.closeReason = 'cancelled';
      refs.dialog.close('cancelled');
    });
    refs.retryCatalogButton.addEventListener('click', function () {
      if (refs.retryCatalogButton.disabled) return;
      refs.retryCatalogButton.disabled = true;
      loadCatalogFor(instance);
    });
    refs.industrySelect.addEventListener('change', function () {
      if (!instance.catalog) return;
      refs.businessSelect.value = '';
      updateSelection(instance);
    });
    refs.businessSelect.addEventListener('change', function () {
      updateSelection(instance);
    });
    refs.continueButton.addEventListener('click', function () {
      if (refs.continueButton.disabled || !instance.catalog) return;
      var industry = optionFor(instance.catalog.industries, refs.industrySelect.value);
      var business = optionFor(instance.catalog.businesses, refs.businessSelect.value);
      var source = instance.catalog.scenarios.find(function (brief) {
        return industry && business
          && brief.industryId === industry.id
          && brief.businessId === business.id;
      });
      if (!source) {
        updateSelection(instance);
        return;
      }
      renderBrief(instance, source, industry, business);
      setStage(instance, 'brief', true);
    });
    refs.backButton.addEventListener('click', function () {
      if (instance.starting) return;
      refs.detailsPanel.hidden = true;
      refs.detailsButton.setAttribute('aria-expanded', 'false');
      setStage(instance, 'select', true);
    });
    refs.detailsButton.addEventListener('click', function () {
      toggleDetails(instance);
    });
    refs.startButton.addEventListener('click', function () {
      void startTraining(instance);
    });
    refs.dialog.addEventListener('click', function (event) {
      if (event.target === refs.dialog && !instance.starting) {
        instance.closeReason = 'cancelled';
        refs.dialog.close('cancelled');
      }
    });

    installMotionControls(instance);
    try {
      refs.dialog.showModal();
    } catch (error) {
      unlockPageScroll(instance);
      refs.dialog.remove();
      if (activeInstance === instance) activeInstance = null;
      throw error;
    }

    var focusTarget = refs.industrySelect.disabled ? refs.selectTitle : refs.industrySelect;
    try {
      focusTarget.focus({ preventScroll: true });
    } catch (_) {
      focusTarget.focus();
    }

    void loadCatalogFor(instance).then(function (catalog) {
      if (catalog && refs.dialog.open && document.activeElement === refs.selectTitle) {
        refs.industrySelect.focus();
      }
    });

    return refs.dialog;
  }

  loadStylesheet();
  void requestCatalog().catch(function () {});

  window.ProjectOneOnboarding = Object.freeze({ open: open });
})();
