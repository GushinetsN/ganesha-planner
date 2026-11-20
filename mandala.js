(() => {
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const wrap = (value, range) => ((value % range) + range) % range;
  const arcDelta = (from, to) => wrap(to - from + 180, 360) - 180;
  function angleForSection(angle, index, slots) {
    const slot = slots[index];
    return 360 * Math.round((angle + slot) / 360) - slot + 0;
  }

  function sectionForAngle(angle, slots) {
    let nearest = 0;
    let shortest = Infinity;
    for (const [index, slot] of slots.entries()) {
      const distance = Math.abs(arcDelta(angle, -slot));
      if (distance < shortest) {
        nearest = index;
        shortest = distance;
      }
    }
    return nearest;
  }

  function snapAngle(angle, slots, velocity = 0) {
    const projected = angle + clamp(velocity * 145, -63, 63);
    return angleForSection(projected, sectionForAngle(projected, slots), slots);
  }
  const containsWheelPoint = ({ left, top, width, height }, x, y) =>
    Math.hypot(x - left - width / 2, y - top - height / 2) <= Math.min(width, height) / 2;

  if (typeof module === 'object') {
    module.exports = { arcDelta, snapAngle, sectionForAngle, angleForSection, containsWheelPoint };
    return;
  }

  const planner = document.querySelector('.planner');
  const stage = document.querySelector('#stage');
  const mandala = document.querySelector('#mandala');
  const ganesha = document.querySelector('#ganesha');
  const content = document.querySelector('.spread');
  const experience = document.querySelector('.experience');
  const announcement = document.querySelector('#current-section');
  const section = document.querySelector('#section');
  const sectionTitle = document.querySelector('#section-title');
  const sectionTitleLabel = sectionTitle.querySelector('#section-title-label');
  const sectionBody = document.querySelector('#section-body');
  const card = window.createPlannerTaskCard(planner, ganesha, editTask,
    (tag, task) => navigateSection('tasks', { tag, task: task.id }));
  const calendar = window.createPlannerCalendar(sectionTitle, card.open, window.readPlannerEntries);
  const creation = window.createPlannerEntryCard(planner, calendar.sectionData, (kind, entry) => {
    if (kind === 'task') navigateSection('tasks', { task: entry.id });
    else if (kind === 'project') navigateSection('projects', { project: entry.name });
    else navigateSection('people', { person: entry.name });
  });
  const flash = document.querySelector('.mandala-flash');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const buttons = [...mandala.querySelectorAll('.mandala-section')];
  const groups = [...mandala.querySelectorAll('.mandala-slot')];
  const slots = groups.map(group => Number(group.dataset.angle));
  const inlineSections = { task: 'tasks', person: 'people', project: 'projects' };
  let openNewEntry;

  let angle = 0;
  let frame = 0;
  let spinTarget = null;
  let gesture = null;
  let viewBeforeMenu = planner.dataset.view;
  let suppressClick = false;
  let selected = buttons[0];
  const controlOrnaments = new WeakMap();

  groups.forEach((group, index) => group.style.setProperty('--slot', slots[index] + 'deg'));

  function changeControlOrnament(button) {
    if (!getComputedStyle(button).getPropertyValue('--control-ornament')) return;
    const previous = controlOrnaments.get(button) ?? Math.floor(Math.random() * 5);
    const next = (previous + 1 + Math.floor(Math.random() * 4)) % 5;
    controlOrnaments.set(button, next);
    button.style.setProperty('--control-ornament',
      'url("control-rosette.svg?v=dots#ornament-' + (next + 1) + '")');
  }

  planner.addEventListener('pointerenter', event => {
    if (event.pointerType !== 'touch' && event.target.matches('button:enabled')) {
      changeControlOrnament(event.target);
    }
  }, true);
  planner.addEventListener('focusin', event => {
    if (event.target.matches('button:enabled:focus-visible')) changeControlOrnament(event.target);
  });

  const slotFor = button => groups.indexOf(button.parentElement);
  const listAt = value => groups[sectionForAngle(value, slots)].firstElementChild;

  function showAngle(value) {
    angle = value;
    mandala.style.setProperty('--spin', angle + 'deg');
    mandala.style.setProperty('--inlay-spin', -angle * .6 + 'deg');
    mandala.style.setProperty('--heart-spin', angle * .28 + 'deg');
  }

  function updateSelection(buttonToSelect) {
    selected = buttonToSelect;
    for (const button of buttons) {
      if (button === selected) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    }
    const context = selected.getAttribute('aria-description');
    announcement.textContent = 'Выбрано «' + selected.ariaLabel + '»' + (context ? '. ' + context : '');
  }

  function stopSpin() {
    cancelAnimationFrame(frame);
    frame = 0;
    spinTarget = null;
  }

  function spinTo(target, buttonToSelect = listAt(target)) {
    stopSpin();
    updateSelection(buttonToSelect);
    const from = angle;
    const distance = target - from;
    if (reducedMotion.matches || Math.abs(distance) < .1) {
      showAngle(target);
      return;
    }

    spinTarget = target;
    const start = performance.now();
    const duration = clamp(300 + Math.abs(distance) * 2.05, 340, 720);
    function step(now) {
      const t = Math.min(1, (now - start) / duration);
      showAngle(from + distance * (1 - Math.pow(1 - t, 3.6)));
      if (t < 1) frame = requestAnimationFrame(step);
      else {
        stopSpin();
      }
    }
    frame = requestAnimationFrame(step);
  }

  function turn(direction) {
    if (planner.dataset.view !== 'menu' || gesture) return;
    const base = spinTarget ?? angle;
    const adjacent = wrap(buttons.indexOf(selected) + (direction === 'previous' ? -1 : 1), buttons.length);
    const button = buttons[adjacent];
    spinTo(angleForSection(base, slotFor(button), slots), button);
  }

  function setView(view, returnFocus = false) {
    const previous = planner.dataset.view;
    const menu = view === 'menu';
    if (menu && previous !== 'menu') viewBeforeMenu = previous;
    planner.dataset.view = view;
    section.hidden = (menu ? viewBeforeMenu : view) !== 'section';
    experience.inert = !menu;
    content.inert = menu;
    calendar.setInert(menu);
    ganesha.inert = menu;
    stage.classList.toggle('is-revealing', menu && previous !== 'menu');
    if (menu) {
      updateSelection(listAt(angle));
      stage.focus({ preventScroll: true });
    } else {
      if (previous === 'menu') {
        const interrupted = gesture;
        gesture = null;
        if (interrupted && mandala.hasPointerCapture(interrupted.id)) {
          mandala.releasePointerCapture(interrupted.id);
        }
        stage.classList.remove('is-dragging');
        stopSpin();
        showAngle(snapAngle(angle, slots));
      }
      announcement.textContent = '';
      const focusTarget = view === 'section' && !returnFocus ? sectionTitle : ganesha;
      focusTarget.focus({ preventScroll: true });
    }
  }

  function renderSection(button, selection = {}) {
    const name = button.dataset.section;
    section.dataset.section = name;
    sectionTitleLabel.textContent = button.ariaLabel;
    const mountSection = window.plannerSections?.[name];
    const template = document.getElementById(name);
    sectionBody.replaceChildren();
    if (!mountSection && template) sectionBody.append(template.content.cloneNode(true));
    calendar.mount(sectionBody.querySelector('.calendar-grid'));
    openNewEntry = mountSection?.(sectionBody, {
      ...calendar.sectionData(), selection, navigate: navigateSection, editTask,
      editEntry: creation.open, mountInlineEntry: creation.mountInline, leaveDraft: creation.leaveDraft,
      confirmTaskRemoval: creation.confirmTaskRemoval,
      confirmProjectRemoval: creation.confirmProjectRemoval,
      confirmPersonRemoval: creation.confirmPersonRemoval,
    })?.openNewEntry;
    content.scrollTop = 0;
  }

  function navigateSection(name, selection, afterNavigate) {
    const button = buttons.find(candidate => candidate.dataset.section === name);
    if (!button) return;
    creation.leaveDraft(() => {
      stopSpin();
      showAngle(angleForSection(angle, slotFor(button), slots));
      renderSection(button, selection);
      setView('section');
      afterNavigate?.();
    });
  }

  function editTask(task) {
    if (section.dataset.section === 'tasks') creation.open('task', task);
    else navigateSection('tasks', { task: task.id }, () => creation.open('task', task));
  }

  function activateButton(button) {
    if (!button || planner.dataset.view !== 'menu') return;
    const kind = button.dataset.create;
    const target = inlineSections[kind];
    if (target) {
      if (section.dataset.section === target) {
        setView('section');
        openNewEntry?.();
      } else navigateSection(target, {}, () => openNewEntry?.());
    } else if (kind) creation.open(kind);
    else navigateSection(button.dataset.section);
  }

  function closeMenu() {
    setView(viewBeforeMenu, true);
  }

  const requestedSection = new URLSearchParams(location.search).get('section');
  const firstSection = buttons.find(button => button.dataset.section === requestedSection) ?? buttons[0];
  renderSection(firstSection);
  section.hidden = false;
  showAngle(angleForSection(angle, slotFor(firstSection), slots));

  sectionBody.addEventListener('click', event => {
    const trigger = event.target.closest('[data-task]');
    if (trigger) calendar.openSectionTask(trigger, event);
  });

  ganesha.addEventListener('click', event => {
    if (event.button === 0 && planner.dataset.view !== 'menu') setView('menu');
  });
  flash.addEventListener('animationend', () => stage.classList.remove('is-revealing'));

  mandala.addEventListener('click', event => {
    if (suppressClick) return;
    if (event.target.closest('.mandala-center')) closeMenu();
    else activateButton(event.target.closest('.mandala-section'));
  });

  experience.addEventListener('click', event => {
    if (planner.dataset.view !== 'menu' || suppressClick || event.target.closest('.mandala-section')) return;
    if (!containsWheelPoint(mandala.getBoundingClientRect(), event.clientX, event.clientY)) closeMenu();
  });

  function polar(x, y, drag) {
    return Math.atan2(y - drag.cy, x - drag.cx) * 180 / Math.PI;
  }

  mandala.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    const rect = mandala.getBoundingClientRect();
    if (!containsWheelPoint(rect, event.clientX, event.clientY)) return;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    gesture = {
      id: event.pointerId, x: event.clientX, y: event.clientY,
      cx: centerX, cy: centerY, size: rect.width,
      radial: Math.hypot(event.clientX - centerX, event.clientY - centerY) > rect.width * .22,
      distance: 0, speed: 0, time: event.timeStamp, moved: false,
    };
  });

  mandala.addEventListener('pointermove', event => {
    if (gesture?.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (!gesture.moved) {
      if (Math.hypot(dx, dy) < 7) return;
      gesture.moved = true;
      gesture.start = angle;
      stopSpin();
      stage.classList.add('is-dragging');
      mandala.setPointerCapture(event.pointerId);
    }

    const nearCenter = Math.hypot(event.clientX - gesture.cx, event.clientY - gesture.cy) < gesture.size * .13;
    const previousAtCenter = Math.hypot(gesture.x - gesture.cx, gesture.y - gesture.cy) < gesture.size * .13;
    const delta = gesture.radial
      ? (nearCenter || previousAtCenter ? 0 : arcDelta(
        polar(gesture.x, gesture.y, gesture), polar(event.clientX, event.clientY, gesture)))
      : (dx - dy * .6) * 210 / gesture.size;
    gesture.distance += delta;
    const speed = delta / Math.max(8, event.timeStamp - gesture.time);
    gesture.speed = gesture.speed * .44 + speed * .56;
    gesture.x = event.clientX;
    gesture.y = event.clientY;
    gesture.time = event.timeStamp;
    showAngle(gesture.start + gesture.distance);
  });

  function endGesture(event, cancelled = false) {
    if (gesture?.id !== event.pointerId) return;
    const finished = gesture;
    gesture = null;
    if (!finished.moved) return;
    stage.classList.remove('is-dragging');
    if (mandala.hasPointerCapture(event.pointerId)) mandala.releasePointerCapture(event.pointerId);
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
    const velocity = event.timeStamp - finished.time < 90 ? finished.speed : 0;
    spinTo(cancelled ? snapAngle(finished.start, slots) : snapAngle(angle, slots, velocity));
  }

  mandala.addEventListener('pointerup', event => endGesture(event));
  mandala.addEventListener('pointercancel', event => endGesture(event, true));
  mandala.addEventListener('lostpointercapture', event => endGesture(event, true));
  mandala.addEventListener('pointerleave', event => {
    if (gesture?.id === event.pointerId && !gesture.moved) gesture = null;
  });
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches && spinTarget !== null) spinTo(spinTarget, selected);
  });

  planner.addEventListener('keydown', event => {
    if (card.isOpen() || creation.isOpen() || calendar.isOpen()) return;
    const view = planner.dataset.view;
    if (event.key === 'Escape' && view !== 'home') {
      event.preventDefault();
      if (view === 'menu') closeMenu();
      else setView('menu');
    } else if (view === 'menu') {
      const keyTurns = { ArrowLeft: 'previous', ArrowUp: 'previous', ArrowRight: 'next', ArrowDown: 'next' };
      const direction = keyTurns[event.key];
      if (direction) {
        event.preventDefault();
        turn(direction);
      } else if (event.key === 'Enter' && event.target === stage) {
        event.preventDefault();
        activateButton(selected);
      }
    }
  });
})();
