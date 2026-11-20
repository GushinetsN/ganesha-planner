(() => {
  const collator = new Intl.Collator('ru');
  const plural = new Intl.PluralRules('ru');
  const projectForms = { one: 'проект', few: 'проекта', many: 'проектов', other: 'проекта' };
  const dateFormat = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'long', timeZone: 'UTC' });
  const yearFormat = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const normalize = text => text.trim().toLocaleLowerCase('ru').replaceAll('ё', 'е');
  const direction = document.querySelector('#agenda-arrow').content.firstElementChild;
  const periods = {
    today: ['Сегодня', 'Нет задач на сегодня.'],
    unscheduled: ['Без срока', 'Нет задач без срока.'],
    past: ['Прошедшие даты', 'Нет задач с прошедшими датами.'],
  };

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function icon(name) {
    const namespace = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(namespace, 'svg');
    const use = document.createElementNS(namespace, 'use');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('viewBox', '0 0 40 40');
    use.setAttribute('href', `planner-icons.svg?v=clear-icons#${name}`);
    svg.append(use);
    return svg;
  }

  function button(className, text) {
    const node = element('button', className, text);
    node.type = 'button';
    return node;
  }

  function taskButton(task, today) {
    const trigger = button('projects-task');
    trigger.dataset.task = task.id;
    trigger.dataset.taskBack = `К проекту «${task.project}»`;
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.append(element('span', 'projects-task-title', task.title));

    if (task.owner) trigger.append(element('small', 'projects-task-owner', task.owner));
    if (task.date || task.time) {
      const format = task.date?.slice(0, 4) === today.slice(0, 4) ? dateFormat : yearFormat;
      const date = task.date && format.format(new Date(task.date));
      const time = element('time', 'projects-task-date', [date, task.time].filter(Boolean).join(', '));
      time.dateTime = task.date && task.time ? `${task.date}T${task.time}` : task.date || task.time;
      trigger.append(time);
    }
    trigger.append(direction.cloneNode(true));
    return trigger;
  }

  function listItem(content) {
    const item = element('li');
    item.append(content);
    return item;
  }

  window.plannerSections ??= {};
  window.plannerSections.projects = (root, {
    tasks, projects = [], today, selection, navigate, editEntry, mountInlineEntry, leaveDraft, confirmProjectRemoval,
  }) => {
    root.innerHTML = `
      <div class="planner-projects planner-records">
        <div class="records-index">
          <form class="planner-section-controls records-filters projects-controls" role="search" aria-label="Поиск проектов и фильтр задач">
            <input type="search" name="query" aria-label="Название проекта" placeholder="Поиск проекта" autocomplete="off">
            <select name="period" aria-label="Дата задач проекта"><option value="">Все даты задач</option></select>
            <button class="planner-action planner-action--quiet projects-reset" type="button" hidden>Сбросить</button>
          </form>
          <div class="projects-scroll records-scroll" role="region" aria-label="Список проектов" tabindex="0">
            <p class="projects-message projects-result" role="status"></p>
            <ul class="projects-list"></ul>
          </div>
        </div>
        <section id="projects-details" class="records-summary" aria-label="Сведения о проекте">
            <div class="records-core projects-detail-body" hidden>
              <header class="records-card-heading">
                <h3 class="records-title" id="projects-details-title" aria-live="polite"></h3>
                <div class="planner-card-actions" role="group" aria-label="Действия с проектом">
                  <button class="planner-icon-action records-card-action projects-edit" type="button" aria-label="Редактировать проект" aria-haspopup="dialog">
                    <svg aria-hidden="true" viewBox="0 0 40 40"><use href="planner-icons.svg?v=card-actions#record-edit"/></svg>
                  </button>
                  <button class="planner-icon-action records-card-action projects-delete" type="button" aria-label="Удалить проект" aria-haspopup="dialog">
                    <svg aria-hidden="true" viewBox="0 0 40 40"><use href="planner-icons.svg?v=card-actions#record-delete"/></svg>
                  </button>
                </div>
              </header>
              <div class="records-copy records-scroll">
                <p class="projects-description records-description" hidden></p>
              </div>
            </div>
            <div class="records-actions">
              <button class="planner-action planner-action--primary section-create projects-create" type="button" aria-controls="projects-entry" aria-description="Новый проект">
                <svg aria-hidden="true" viewBox="0 0 40 40"><use href="planner-icons.svg?v=card-actions#record-create"/></svg>
                Создать
              </button>
            </div>
        </section>
        <aside class="records-related" aria-label="Связи проекта" hidden>
              <section class="records-relation" aria-labelledby="projects-team-title">
                <header class="projects-subheading">
                  <h4 id="projects-team-title"><svg class="planner-subheading-icon" aria-hidden="true" viewBox="0 0 40 40"><use href="planner-icons.svg?v=clear-icons#people"/></svg>Люди</h4>
                  <button class="planner-icon-action projects-team-link" type="button" aria-label="Открыть команду проекта">
                    <svg aria-hidden="true" viewBox="0 0 40 40"><use href="planner-icons.svg?v=clear-icons#direction"/></svg>
                  </button>
                </header>
                <ul class="projects-people records-scroll records-links" aria-label="Ответственные по задачам"></ul>
                <p class="projects-message projects-no-people" hidden>Ответственные не указаны.</p>
              </section>
              <section class="records-relation" aria-labelledby="projects-agenda-title">
                <header class="projects-subheading">
                  <h4 id="projects-agenda-title"><svg class="planner-subheading-icon" aria-hidden="true" viewBox="0 0 40 40"><use href="planner-icons.svg?v=clear-icons#tasks"/></svg>Задачи</h4>
                  <button class="planner-icon-action projects-all" type="button" aria-label="Все задачи проекта">
                    <svg aria-hidden="true" viewBox="0 0 40 40"><use href="planner-icons.svg?v=clear-icons#direction"></use></svg>
                  </button>
                </header>
                <p class="projects-message projects-agenda-status" role="status"></p>
                <ul class="projects-task-list records-scroll"></ul>
              </section>
        </aside>
        <section class="records-editor" aria-labelledby="projects-entry-title" hidden>
          <h3 id="projects-entry-title">Новый проект</h3>
          <div class="records-scroll" id="projects-entry"></div>
        </section>
      </div>`;

    const projectEntries = new Map(projects.map(entry => [entry.name, entry]));
    const byProject = new Map(projects.map(({ name }) => [name, []]));
    for (const task of tasks) {
      if (!task.project) continue;
      if (!byProject.has(task.project)) byProject.set(task.project, []);
      byProject.get(task.project).push(task);
    }

    const names = [...byProject.keys()].sort(collator.compare);
    const form = root.querySelector('.projects-controls');
    const query = form.elements.namedItem('query');
    const period = form.elements.namedItem('period');
    const reset = form.querySelector('.projects-reset');
    const list = root.querySelector('.projects-list');
    const result = root.querySelector('.projects-result');
    const details = root.querySelector('#projects-details');
    const detailTitle = details.querySelector('#projects-details-title');
    const detailBody = details.querySelector('.projects-detail-body');
    const description = details.querySelector('.projects-description');
    const actions = details.querySelector('.records-actions');
    const edit = detailBody.querySelector('.projects-edit');
    const remove = detailBody.querySelector('.projects-delete');
    const related = root.querySelector('.records-related');
    const editor = root.querySelector('#projects-entry');
    const editorPanel = editor.closest('.records-editor');
    const people = related.querySelector('.projects-people');
    const noPeople = related.querySelector('.projects-no-people');
    const teamLink = related.querySelector('.projects-team-link');
    const agendaStatus = related.querySelector('.projects-agenda-status');
    const taskList = related.querySelector('.projects-task-list');
    const all = related.querySelector('.projects-all');
    let preferred = byProject.has(selection?.project) ? selection.project : names[0];
    let activeProject;
    edit.addEventListener('click', () => {
      editEntry('project', projectEntries.get(activeProject) ?? { name: activeProject });
    });
    remove.addEventListener('click', () => {
      confirmProjectRemoval(activeProject, () => navigate('projects'));
    });
    const openNewEntry = mountInlineEntry('project', {
      panel: root.querySelector('.planner-projects'),
      editor,
      trigger: actions.querySelector('[aria-controls="projects-entry"]'),
      onToggle: showDetails,
    });

    function showDetails() {
      const creating = !editorPanel.hidden;
      detailBody.hidden = !activeProject;
      detailBody.inert = creating;
      related.hidden = creating || !activeProject;
    }

    function renderAgenda() {
      const entries = window.plannerSchedule(byProject.get(activeProject), today, period.value);
      taskList.replaceChildren(...entries.map(task => listItem(taskButton(task, today))));
      taskList.scrollTop = 0;
      const emptyMessage = period.value ? periods[period.value][1] : 'В проекте пока нет задач.';
      agendaStatus.textContent = entries.length ? '' : emptyMessage;
    }

    function showProject(project) {
      const hasProject = Boolean(project);
      activeProject = project;
      detailTitle.textContent = project ?? '';
      description.textContent = projectEntries.get(project)?.description ?? '';
      description.hidden = !description.textContent;
      showDetails();
      period.disabled = !hasProject;
      if (!hasProject) return;

      const tasks = byProject.get(project);

      const owners = [...new Set(tasks.map(task => task.owner).filter(Boolean))].sort(collator.compare);
      noPeople.hidden = Boolean(owners.length);
      teamLink.hidden = people.hidden = !owners.length;
      people.replaceChildren(...owners.map(person => {
        const link = button('records-link', person);
        link.append(direction.cloneNode(true));
        link.addEventListener('click', () => navigate('people', { person }));
        return listItem(link);
      }));
      people.scrollTop = 0;
      renderAgenda();
    }

    function renderProjects() {
      const search = normalize(query.value);
      const matches = names.filter(project => !search || normalize(project).includes(search));
      const project = matches.includes(preferred) ? preferred : matches[0];
      list.replaceChildren(...matches.map(name => {
        const choice = button('projects-choice', name);
        const indicator = icon('direction');
        indicator.classList.add('projects-current');
        choice.prepend(icon('pavilion'));
        choice.append(indicator);
        choice.setAttribute('aria-controls', details.id);
        choice.setAttribute('aria-pressed', String(name === project));
        choice.addEventListener('click', () => leaveDraft(() => {
          choice.focus({ preventScroll: true });
          preferred = name;
          if (name === activeProject) return;
          list.querySelector('[aria-pressed="true"]')?.setAttribute('aria-pressed', 'false');
          choice.setAttribute('aria-pressed', 'true');
          showProject(name);
        }));
        return listItem(choice);
      }));
      const count = matches.length;
      result.classList.toggle('sr-only', count > 0);
      result.textContent = count ? `В списке ${count} ${projectForms[plural.select(count)]}`
        : names.length ? 'По этому запросу проектов нет.' : 'Проектов пока нет.';
      if (activeProject !== project) showProject(project);
    }

    function updateReset() {
      reset.hidden = !(query.value || period.value);
    }

    query.hidden = period.hidden = !names.length;
    period.append(...Object.entries(periods).map(([key, [label]]) => new Option(label, key)));
    all.addEventListener('click', () => navigate('tasks', { project: activeProject }));
    teamLink.addEventListener('click', () => navigate('people', { project: activeProject }));
    form.addEventListener('submit', event => event.preventDefault());
    query.addEventListener('input', () => {
      renderProjects();
      updateReset();
    });
    period.addEventListener('change', () => {
      renderAgenda();
      updateReset();
    });
    reset.addEventListener('click', () => {
      form.reset();
      query.focus({ preventScroll: true });
      renderProjects();
      if (activeProject) renderAgenda();
      updateReset();
    });
    renderProjects();
    updateReset();
    return { openNewEntry };
  };
})();
