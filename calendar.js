(() => {
  const dayKey = date => date.toISOString().split('T', 1)[0];
  function utcDay(year, month, date) {
    const day = new Date(0);
    day.setUTCFullYear(year, month, date);
    return day;
  }
  const localDay = (now = new Date()) => utcDay(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = (date, offset = 0) => utcDay(date.getUTCFullYear(), date.getUTCMonth() + offset, 1);
  const shiftDay = (date, offset) => utcDay(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + offset);
  const seasons = ['winter', 'spring', 'summer', 'autumn'];
  const seasonFor = date => seasons[Math.floor(((date.getUTCMonth() + 1) % 12) / 3)];
  const plural = new Intl.PluralRules('ru');
  const taskForms = { one: 'задача', few: 'задачи', many: 'задач', other: 'задачи' };
  const taskCountLabel = count => `${count} ${taskForms[plural.select(count)]}`;
  const byTitle = new Intl.Collator('ru').compare;
  const byTime = (a, b) => (a.time || '24:00').localeCompare(b.time || '24:00') || byTitle(a.title, b.title);

  function plannerSchedule(tasks, today, period = '') {
    const groups = { today: [], dated: [], unscheduled: [], past: [] };
    for (const task of tasks) {
      if (!task.date) groups.unscheduled.push(task);
      else if (task.date === today) groups.today.push(task);
      else if (task.date > today) groups.dated.push(task);
      else groups.past.push(task);
    }
    groups.today.sort(byTime);
    groups.dated.sort((a, b) => a.date.localeCompare(b.date) || byTime(a, b));
    groups.unscheduled.sort((a, b) => byTitle(a.title, b.title));
    groups.past.sort((a, b) => b.date.localeCompare(a.date) || byTime(a, b));
    return period ? groups[period] : Object.values(groups).flat();
  }

  function monthDays(date) {
    const first = monthStart(date);
    const before = (first.getUTCDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, index) => shiftDay(first, index - before));
  }

  const show = 'Зимний показ';
  const lesson = 'Открытый урок';
  const demo = [
    { id: 'book-hall', date: '2026-11-04', time: '11:00', short: 'Бронь зала', title: 'Подтвердить бронь зала', project: lesson, owner: 'Татьяна' },
    { id: 'poster', date: '2026-11-07', time: '15:00', short: 'Афиша', title: 'Обсудить макет афиши', project: lesson, owner: 'Лидия' },
    { id: 'costume-requests', date: '2026-11-10', time: '14:00', short: 'Костюмы', title: 'Собрать заявки на костюмы', project: show, owner: 'Лидия' },
    { id: 'rehearsal', date: '2026-11-14', time: '12:00', short: 'Репетиция', title: 'Провести общую репетицию', project: show, owner: 'Татьяна' },
    { id: 'rehearsal-plan', date: '2026-11-17', time: '10:30', short: 'План репетиций', title: 'Обсудить план репетиций с командой', project: show, owner: 'Татьяна' },
    { id: 'check-schedule', date: '2026-11-20', time: '11:00', short: 'Расписание', title: 'Сверить расписание', project: show, owner: 'Татьяна' },
    { id: 'collect-music', date: '2026-11-20', time: '15:30', short: 'Музыка', title: 'Собрать музыку', project: show, owner: 'Софья' },
    {
      id: 'dress-rehearsal', date: '2026-11-21', time: '12:00', short: 'Прогон', title: 'Генеральный прогон',
      project: show, owner: 'Татьяна', tags: ['Репетиция', 'Сцена'],
      description: 'Пройти программу показа целиком. Проверить выходы, смену музыки и готовность реквизита.',
    },
    { id: 'costume-fitting', date: '2026-11-26', time: '17:00', short: 'Примерка', title: 'Примерить костюмы для показа', project: show, owner: 'Лидия' },
    { id: 'open-class', date: '2026-11-28', time: '13:00', short: 'Открытый урок', title: 'Провести открытый урок', project: lesson, owner: 'Софья' },
    { id: 'costume-checklist', title: 'Проверить список костюмов', project: show, owner: 'Лидия' },
  ];
  const tasksFor = (key, tasks = demo) => tasks.filter(task => task.date === key);
  const taskById = (id, tasks = demo) => tasks.find(task => task.id === id);

  const demoOwners = new Set(demo.map(task => task.owner));
  const demoProjects = new Set(demo.map(task => task.project));

  function mergeTasks(base = demo, saved, {
    people = [], projects = [], deletedDemoProjects = [], deletedDemoPeople = [], deletedTasks = [],
  } = {}) {
    const renames = entries => new Map(entries.filter(entry => entry.demoName)
      .map(entry => [entry.demoName, entry.name]));
    const owners = renames(people);
    const projectNames = renames(projects);
    for (const name of deletedDemoPeople) owners.set(name, '');
    for (const name of deletedDemoProjects) projectNames.set(name, '');
    const byId = new Map(base.map(task => {
      const owner = owners.get(task.owner) ?? task.owner;
      const project = projectNames.get(task.project) ?? task.project;
      return [task.id, owner === task.owner && project === task.project ? task : { ...task, owner, project }];
    }));
    for (const task of saved) {
      if (!task.id.startsWith('scroll-demo-') || byId.has(task.id)) byId.set(task.id, task);
    }
    for (const id of deletedTasks) byId.delete(id);
    return [...byId.values()];
  }

  function createScrollDemo(today) {
    const samples = [
      ['09:00', 'Подготовить зал', 'Лидия'],
      ['09:30', 'Проверить микрофоны', 'Софья'],
      ['10:00', 'Разложить реквизит', 'Лидия'],
      ['10:30', 'Согласовать выходы', 'Татьяна'],
      ['11:15', 'Проверить свет на сцене', 'Софья'],
      ['11:40', 'Раздать сценарий', 'Татьяна'],
      ['13:15', 'Уточнить порядок номеров', 'Татьяна'],
      ['14:20', 'Проверить костюмы', 'Лидия'],
      ['16:00', 'Подготовить запись прогона', 'Софья'],
      ['17:10', 'Собрать замечания команды', 'Татьяна'],
    ];
    const dates = [[dayKey(today), 6], [dayKey(shiftDay(today, 1)), 10]];
    const extra = dates.flatMap(([date, count]) => samples.slice(0, Math.max(0, count - tasksFor(date).length))
      .map(([time, title, owner], index) => ({
        id: `scroll-demo-${date}-${index}`, date, time, title, short: title, project: show, owner,
      })));
    return [...demo, ...extra];
  }

  if (typeof module === 'object') {
    module.exports = { dayKey, localDay, monthDays, monthStart, tasksFor, taskById, taskCountLabel, seasonFor, createScrollDemo, mergeTasks, plannerSchedule };
    return;
  }
  window.plannerSchedule = plannerSchedule;
  const dateFormat = options => new Intl.DateTimeFormat('ru-RU', { ...options, timeZone: 'UTC' });
  const monthFormat = dateFormat({ month: 'long', year: 'numeric' });
  const monthName = dateFormat({ month: 'long' });
  const dateCaption = dateFormat({ day: 'numeric', month: 'long' });
  const fullDate = dateFormat({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const weekday = dateFormat({ weekday: 'long' });
  const headingDate = (formatter, date) => {
    const text = formatter.format(date).replace(/\sг\.$/u, '');
    return text[0].toUpperCase() + text.slice(1);
  };

  function makeElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  }

  function bindMandalaReveal(body) {
    function reveal(cell, property) {
      if (!cell) {
        body.style.removeProperty(property);
        return;
      }
      const { top, right, bottom, left, width, height } = body.getBoundingClientRect();
      const bounds = cell.getBoundingClientRect();
      const edges = [(bounds.top - top) / height, (right - bounds.right) / width,
        (bottom - bounds.bottom) / height, (bounds.left - left) / width];
      body.style.setProperty(property, 'inset(' + edges.map(edge => (edge * 100) + '%').join(' ') + ')');
    }

    body.addEventListener('pointerover', event => {
      if (event.pointerType !== 'touch') reveal(event.target.closest('.calendar-cell'), '--hover-reveal');
    });
    body.addEventListener('pointerleave', () => reveal(null, '--hover-reveal'));
    body.addEventListener('focusin', event => {
      if (event.target.matches(':focus-visible')) reveal(event.target.closest('.calendar-cell'), '--focus-reveal');
    });
    body.addEventListener('focusout', () => reveal(null, '--focus-reveal'));
  }

  window.createPlannerCalendar = (title, openTask, readEntries) => {
    const sheet = title.closest('.sheet');
    const weather = window.createCalendarWeather(sheet.querySelector('.calendar-weather'));
    const controls = document.querySelector('#calendar-controls');
    const titleLabel = title.querySelector('#section-title-label');
    const jump = title.querySelector('#calendar-jump');
    const jumpLabel = jump.querySelector('span');
    const jumpDialog = document.querySelector('#calendar-jump-dialog');
    const jumpForm = jumpDialog.querySelector('form');
    const monthField = jumpForm.elements.namedItem('month');
    const yearField = jumpForm.elements.namedItem('year');
    const previousMonth = controls.querySelector('[data-month="-1"]');
    const nextMonth = controls.querySelector('[data-month="1"]');
    const selectable = date => date.getUTCFullYear() >= 1 && date.getUTCFullYear() <= 9999;
    monthField.append(...Array.from({ length: 12 }, (_, index) =>
      new Option(headingDate(monthName, utcDay(2026, index, 1)), String(index))));
    const agendaArrow = document.querySelector('#agenda-arrow').content.firstElementChild;
    const message = document.querySelector('#calendar-message');
    const preview = document.querySelector('#calendar-preview');
    const previewTitle = document.querySelector('#preview-title');
    const previewWeekday = document.querySelector('#preview-weekday');
    const previewAgenda = document.querySelector('#preview-agenda');
    const previewEmpty = document.querySelector('#preview-empty');
    const scrollDemo = new URLSearchParams(location.search).get('demo') === 'scroll';

    let today = localDay();
    let availableTasks = [];
    let month = monthStart(today);
    let cursor = dayKey(today);
    let grid = null;
    let pinned = scrollDemo ? dayKey(shiftDay(today, 1)) : '';
    let shown = '';

    const dayButton = key => grid.querySelector('[data-day="' + key + '"]');

    const tasksForView = entries => mergeTasks(scrollDemo ? createScrollDemo(today) : demo, entries.tasks, entries);

    function refreshTasks() {
      availableTasks = tasksForView(readEntries());
    }

    function renderAgenda(list, key, empty) {
      const entries = tasksFor(key, availableTasks).sort((a, b) =>
        (a.time || '24:00').localeCompare(b.time || '24:00'));
      list.replaceChildren(...entries.map(({ id, time, title, project, owner }) => {
        const row = makeElement('li');
        const item = makeElement('button', 'agenda-item');
        item.type = 'button';
        item.dataset.task = id;
        item.setAttribute('aria-haspopup', 'dialog');
        if (time) {
          const clock = makeElement('time', '', time);
          clock.dateTime = key + 'T' + time;
          item.append(clock);
        }
        const description = makeElement('span', 'agenda-description');
        description.append(makeElement('span', 'agenda-name', title));
        const meta = [project, owner].filter(Boolean).join(' · ');
        if (meta) description.append(makeElement('small', 'agenda-meta', meta));
        item.append(description, agendaArrow.cloneNode(true));
        row.append(item);
        return row;
      }));
      empty.hidden = entries.length > 0;
    }

    function updatePreview() {
      const todayKey = dayKey(today);
      const key = pinned || todayKey;
      preview.hidden = !grid;
      if (preview.hidden || key === shown) return;
      shown = key;
      const date = new Date(key);
      const isToday = key === todayKey;
      previewTitle.textContent = isToday ? 'Сегодня' : dateCaption.format(date);
      previewWeekday.textContent = isToday
        ? `${dateCaption.format(date)}, ${weekday.format(date)}`
        : weekday.format(date);
      previewEmpty.textContent = isToday ? 'На сегодня дел нет' : 'На этот день дел нет';
      renderAgenda(previewAgenda, key, previewEmpty);
      preview.scrollTop = 0;
    }

    function renderDay(date) {
      const key = dayKey(date);
      const tasks = tasksFor(key, availableTasks);
      const summary = tasks.length > 1 ? taskCountLabel(tasks.length) : tasks[0]?.short;
      const cell = makeElement('td', 'calendar-cell');
      cell.dataset.calendarDay = key;
      const button = makeElement('button', 'calendar-day');
      button.type = 'button';
      button.dataset.day = key;
      button.tabIndex = key === cursor ? 0 : -1;
      button.disabled = !selectable(date);
      button.setAttribute('aria-label', headingDate(fullDate, date) +
        (summary ? '. ' + summary : ''));
      button.setAttribute('aria-pressed', String(key === pinned));
      if (key === dayKey(today)) button.setAttribute('aria-current', 'date');
      if (date.getUTCMonth() !== month.getUTCMonth()) button.classList.add('outside-month');
      button.append(makeElement('span', 'calendar-number', String(date.getUTCDate())));
      cell.append(button);
      if (summary) {
        const entry = makeElement('button', 'calendar-entry', summary);
        entry.type = 'button';
        entry.dataset.taskDay = key;
        entry.tabIndex = button.tabIndex;
        entry.setAttribute('aria-label', summary + ' · ' + dateCaption.format(date));
        if (tasks.length === 1) {
          entry.dataset.task = tasks[0].id;
          entry.setAttribute('aria-haspopup', 'dialog');
        } else {
          entry.setAttribute('aria-controls', preview.id);
        }
        cell.append(entry);
      }
      return cell;
    }

    function renderMonth() {
      jumpLabel.textContent = headingDate(monthFormat, month);
      previousMonth.disabled = !selectable(monthStart(month, -1));
      nextMonth.disabled = !selectable(monthStart(month, 1));
      sheet.dataset.season = seasonFor(month);
      weather.setSeason(sheet.dataset.season);
      const dates = monthDays(month);
      const weeks = Array.from({ length: 6 }, (_, week) => {
        const row = makeElement('tr');
        row.append(...dates.slice(week * 7, week * 7 + 7).map(renderDay));
        return row;
      });
      const body = grid.tBodies[0];
      body.style.removeProperty('--hover-reveal');
      body.style.removeProperty('--focus-reveal');
      body.replaceChildren(...weeks);
      updatePreview();
    }

    function setCursor(key) {
      if (key === cursor) return;
      for (const item of dayButton(cursor).parentElement.children) item.tabIndex = -1;
      cursor = key;
      for (const item of dayButton(key).parentElement.children) item.tabIndex = 0;
    }

    function selectDay(key, focus = false) {
      const nextMonth = monthStart(new Date(key));
      pinned = key;
      if (nextMonth.getTime() !== month.getTime()) {
        month = nextMonth;
        cursor = key;
        renderMonth();
      } else {
        setCursor(key);
        grid.querySelector('[aria-pressed="true"]')?.setAttribute('aria-pressed', 'false');
        dayButton(key).setAttribute('aria-pressed', 'true');
        updatePreview();
      }
      if (focus) dayButton(key).focus({ preventScroll: true });
    }

    function startMonth(date) {
      month = monthStart(date);
      cursor = dayKey(date);
      pinned = '';
      renderMonth();
    }

    jump.addEventListener('click', () => {
      monthField.value = String(month.getUTCMonth());
      yearField.value = String(month.getUTCFullYear());
      jumpDialog.showModal();
    });
    jumpForm.querySelector('[data-calendar-cancel]').addEventListener('click', () => jumpDialog.close());
    jumpForm.addEventListener('submit', event => {
      event.preventDefault();
      const chosen = utcDay(yearField.valueAsNumber, Number(monthField.value), 1);
      if (chosen.getTime() !== month.getTime()) selectDay(dayKey(chosen));
      jumpDialog.close();
    });

    controls.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!grid || !button) return;
      if (button.dataset.month) startMonth(monthStart(month, Number(button.dataset.month)));
      else {
        today = localDay();
        refreshTasks();
        shown = '';
        startMonth(today);
      }
    });

    function taskOpeningPoint(event, button) {
      if (event.detail > 0) return { x: event.clientX, y: event.clientY };
      const { left, bottom } = button.getBoundingClientRect();
      return { x: left, y: bottom };
    }

    function openDayTask(event) {
      const button = event.target.closest('[data-task]');
      if (!button || !grid) return;
      const task = taskById(button.dataset.task, availableTasks);
      if (button.dataset.taskDay) setCursor(button.dataset.taskDay);
      const back = 'К делам ' + dateCaption.format(new Date(task.date));
      openTask(task, button, back, taskOpeningPoint(event, button));
    }

    previewAgenda.addEventListener('click', openDayTask);

    function openSectionTask(button, event) {
      const task = taskById(button.dataset.task, sectionData().tasks);
      if (task) openTask(task, button, button.dataset.taskBack ?? 'К списку задач', taskOpeningPoint(event, button));
    }

    function mount(table) {
      grid = table;
      jump.hidden = !grid;
      titleLabel.hidden = Boolean(grid);
      controls.hidden = message.hidden = !grid;
      if (!grid) {
        delete sheet.dataset.season;
        weather.setSeason('');
        shown = '';
        updatePreview();
        return;
      }

      refreshTasks();
      shown = '';
      renderMonth();
      bindMandalaReveal(grid.tBodies[0]);
      grid.addEventListener('click', event => {
        const button = event.target.closest('[data-day], [data-task-day]');
        if (!button) return;
        if (button.dataset.task) openDayTask(event);
        else selectDay(button.dataset.day ?? button.dataset.taskDay, button.matches(':focus-visible'));
      });
      grid.addEventListener('keydown', event => {
        const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
        const offset = offsets[event.key];
        const from = event.target.closest('.calendar-cell');
        if (!offset || !from) return;
        event.preventDefault();
        const next = shiftDay(new Date(from.dataset.calendarDay), offset);
        if (!selectable(next)) return;
        const key = dayKey(next);
        if (next.getUTCMonth() !== month.getUTCMonth()) {
          month = monthStart(next);
          cursor = key;
          pinned = '';
          renderMonth();
        } else {
          setCursor(key);
        }
        dayButton(key).focus();
      });
    }

    function setInert(menu) {
      message.inert = preview.inert = menu;
      weather.setSeason(menu || !grid ? '' : sheet.dataset.season);
    }

    function sectionData() {
      const entries = readEntries();
      const tasks = tasksForView(entries);
      const people = new Map(entries.people.map(person => [person.name, person]));
      const projects = new Map(entries.projects.map(project => [project.name, project]));
      for (const task of tasks) {
        if (task.owner && !people.has(task.owner)) {
          people.set(task.owner, { name: task.owner, demoName: demoOwners.has(task.owner) ? task.owner : undefined });
        }
        if (task.project && !projects.has(task.project)) {
          projects.set(task.project, { name: task.project, demoName: demoProjects.has(task.project) ? task.project : undefined });
        }
      }
      return { tasks, people: [...people.values()], projects: [...projects.values()], today: dayKey(localDay()) };
    }
    return { mount, openSectionTask, setInert, sectionData, isOpen: () => jumpDialog.open };
  };
})();
