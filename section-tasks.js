(() => {
  const collator = new Intl.Collator('ru');
  const plural = new Intl.PluralRules('ru');
  const taskForms = { one: 'задача', few: 'задачи', many: 'задач', other: 'задачи' };
  const dateFormat = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'long', timeZone: 'UTC' });
  const yearFormat = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const normalize = text => text.trim().toLocaleLowerCase('ru').replaceAll('ё', 'е');
  const matchesSearch = (task, search, tagsOnly) =>
    (!tagsOnly && normalize(task.title).includes(search)) ||
    (task.tags ?? []).some(tag => normalize(tag).includes(search));
  const tagKey = text => normalize(text).replace(/^#+\s*/, '');
  const direction = document.querySelector('#agenda-arrow').content.firstElementChild;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    node.textContent = text;
    return node;
  }

  window.plannerSections ??= {};
  window.plannerSections.tasks = (root, {
    tasks, today, selection = {}, navigate, editTask, mountInlineEntry, leaveDraft, confirmTaskRemoval,
  }) => {
    root.innerHTML = `
      <div class="planner-tasks planner-records">
        <div class="records-index">
          <form class="planner-section-controls records-filters" role="search" aria-label="Поиск и фильтры задач">
            <input type="search" name="query" aria-label="Название задачи или метка" placeholder="Поиск / #метка" autocomplete="off">
            <details class="task-filter-options">
              <summary>Фильтры</summary>
              <div class="task-filter-fields">
                <select name="view" aria-label="Просмотр задач">
                  <option value="">Все задачи</option>
                  <option value="today">Сегодня</option>
                  <option value="unscheduled">Без срока</option>
                  <option value="past">Прошедшие даты</option>
                </select>
                <select name="person" aria-label="Ответственный"><option value="">Все люди</option></select>
                <select name="project" aria-label="Проект"><option value="">Все проекты</option></select>
                <button class="planner-action planner-action--quiet tasks-reset" type="button">Сбросить</button>
              </div>
            </details>
          </form>
          <div class="task-results">
            <p class="tasks-result" role="status"></p>
            <p class="task-active-filters" hidden></p>
            <button type="button" class="planner-tag task-clear-tag" hidden>
              <span></span>
              <svg aria-hidden="true" viewBox="0 0 40 40"><use href="planner-icons.svg?v=clear-icons#close"/></svg>
            </button>
          </div>
          <div class="tasks-scroll records-scroll" role="region" aria-label="Список задач" tabindex="0">
            <ul class="tasks-list"></ul>
          </div>
        </div>
        <section id="tasks-details" class="records-summary" aria-label="Сведения о задаче">
          <div class="records-core tasks-detail-body" hidden>
            <header class="records-card-heading">
              <h3 class="records-title tasks-detail-title" aria-live="polite"></h3>
              <div class="planner-card-actions" role="group" aria-label="Действия с задачей">
                <button class="planner-icon-action records-card-action tasks-edit-card" type="button" aria-label="Редактировать задачу" aria-haspopup="dialog">
                  <svg aria-hidden="true" viewBox="0 0 40 40"><use href="planner-icons.svg?v=card-actions#record-edit"/></svg>
                </button>
                <button class="planner-icon-action records-card-action tasks-delete" type="button" aria-label="Удалить задачу" aria-haspopup="dialog">
                  <svg aria-hidden="true" viewBox="0 0 40 40"><use href="planner-icons.svg?v=card-actions#record-delete"/></svg>
                </button>
              </div>
            </header>
            <div class="records-copy records-scroll">
              <p class="tasks-detail-meta"></p>
              <div class="task-labels" hidden><h4>Метки</h4><ul class="planner-tags"></ul></div>
              <p class="tasks-detail-description" hidden></p>
            </div>
          </div>
          <div class="records-actions">
            <button class="planner-action planner-action--primary section-create tasks-new-button" type="button" aria-controls="tasks-entry" aria-description="Новая задача">
              <svg aria-hidden="true" viewBox="0 0 40 40"><use href="planner-icons.svg?v=card-actions#record-create"/></svg>
              Создать
            </button>
          </div>
        </section>
        <aside class="records-related" aria-label="Связи задачи" hidden>
          <section class="records-relation" aria-labelledby="task-related-people">
            <h4 id="task-related-people"><svg class="planner-subheading-icon" aria-hidden="true" viewBox="0 0 40 40"><use href="planner-icons.svg?v=clear-icons#people"/></svg>Люди</h4>
            <p class="records-empty tasks-no-owner">Ответственный не назначен.</p>
            <ul class="records-scroll records-links"><li><button type="button" class="records-link tasks-owner-link"></button></li></ul>
          </section>
          <section class="records-relation" aria-labelledby="task-related-projects">
            <h4 id="task-related-projects"><svg class="planner-subheading-icon" aria-hidden="true" viewBox="0 0 40 40"><use href="planner-icons.svg?v=clear-icons#pavilion"/></svg>Проекты</h4>
            <p class="records-empty tasks-no-project">Проект не указан.</p>
            <ul class="records-scroll records-links"><li><button type="button" class="records-link tasks-project-link"></button></li></ul>
          </section>
        </aside>
        <section class="records-editor" aria-labelledby="tasks-entry-title" hidden>
          <h3 id="tasks-entry-title">Новая задача</h3>
          <div class="records-scroll" id="tasks-entry"></div>
        </section>
      </div>`;

    const form = root.querySelector('form');
    const filters = form.querySelector('.task-filter-options');
    const query = form.elements.namedItem('query');
    const view = form.elements.namedItem('view');
    const person = form.elements.namedItem('person');
    const project = form.elements.namedItem('project');
    const reset = form.querySelector('.tasks-reset');
    const scroll = root.querySelector('.tasks-scroll');
    const result = root.querySelector('.tasks-result');
    const activeFilters = root.querySelector('.task-active-filters');
    const clearTag = root.querySelector('.task-clear-tag');
    const list = root.querySelector('.tasks-list');
    const panel = root.querySelector('.planner-tasks');
    const newButton = root.querySelector('.tasks-new-button');
    const editor = root.querySelector('#tasks-entry');
    const editorPanel = editor.closest('.records-editor');
    const details = root.querySelector('.tasks-detail-body');
    const edit = details.querySelector('.tasks-edit-card');
    const detailTitle = details.querySelector('.tasks-detail-title');
    const detailCopy = details.querySelector('.records-copy');
    const detailMeta = details.querySelector('.tasks-detail-meta');
    const detailDescription = details.querySelector('.tasks-detail-description');
    const tags = details.querySelector('.planner-tags');
    const related = root.querySelector('.records-related');
    const ownerLink = related.querySelector('.tasks-owner-link');
    const projectLink = related.querySelector('.tasks-project-link');
    const noOwner = related.querySelector('.tasks-no-owner');
    const noProject = related.querySelector('.tasks-no-project');
    let selectedTask = tasks.find(task => task.id === selection.task);
    let activeTag = selection.tag ?? '';
    edit.addEventListener('click', () => editTask(selectedTask));
    details.querySelector('.tasks-delete').addEventListener('click', () => {
      const task = selectedTask;
      confirmTaskRemoval(task, () => {
        const row = list.querySelector('[aria-pressed="true"]')?.closest('li');
        const neighbor = row?.nextElementSibling ?? row?.previousElementSibling;
        const nextId = neighbor?.firstElementChild.dataset.taskId;
        const scrollTop = scroll.scrollTop;
        tasks = tasks.filter(entry => entry.id !== task.id);
        selectedTask = tasks.find(entry => entry.id === nextId);
        render();
        scroll.scrollTop = scrollTop;
        (list.querySelector('[aria-pressed="true"]') ?? query).focus();
      });
    });
    ownerLink.addEventListener('click', () => navigate('people', { person: selectedTask.owner }));
    projectLink.addEventListener('click', () => navigate('projects', { project: selectedTask.project }));
    const openNewEntry = mountInlineEntry('task', {
      panel, editor, trigger: newButton, onToggle: showDetails,
    });

    function fillFilter(control, field, selected) {
      const values = [...new Set(tasks.map(task => task[field]).filter(Boolean))].sort(collator.compare);
      control.append(...values.map(value => new Option(value, value)));
      control.value = values.includes(selected) ? selected : '';
    }

    function dateLabel(task) {
      if (!task.date) return '';
      const format = task.date.slice(0, 4) === today.slice(0, 4) ? dateFormat : yearFormat;
      return format.format(new Date(task.date));
    }

    function showDetails() {
      const creating = !editorPanel.hidden;
      details.hidden = !selectedTask;
      details.inert = creating;
      related.hidden = creating || !selectedTask;
      if (details.hidden) return;
      detailTitle.textContent = selectedTask.title;
      detailMeta.textContent = [dateLabel(selectedTask), selectedTask.time].filter(Boolean).join(', ') || 'Без срока';
      detailDescription.hidden = !selectedTask.description;
      detailDescription.textContent = selectedTask.description ?? '';
      window.printPlannerTags(tags, selectedTask.tags, tag => {
        activeTag = tag;
        render();
        clearTag.focus({ preventScroll: true });
      });
      showLink(ownerLink, noOwner, selectedTask.owner);
      showLink(projectLink, noProject, selectedTask.project);
      detailCopy.scrollTop = 0;
    }

    function showLink(link, empty, value) {
      link.closest('ul').hidden = !value;
      empty.hidden = Boolean(value);
      if (value) link.replaceChildren(value, direction.cloneNode(true));
    }

    function taskRow(task) {
      const row = document.createElement('li');
      const button = element('button', 'tasks-row', '');
      button.type = 'button';
      button.dataset.taskId = task.id;
      button.setAttribute('aria-controls', 'tasks-details');
      button.setAttribute('aria-pressed', String(task === selectedTask));
      button.addEventListener('click', () => leaveDraft(() => {
        button.focus({ preventScroll: true });
        list.querySelector('[aria-pressed="true"]')?.setAttribute('aria-pressed', 'false');
        button.setAttribute('aria-pressed', 'true');
        selectedTask = task;
        showDetails();
      }));

      button.append(element('span', 'tasks-row-title', task.title));
      const metadata = [task.project, task.owner].filter(Boolean).join(' · ');
      if (metadata) button.append(element('small', 'tasks-row-meta', metadata));

      const date = task.date ?? '';
      const time = task.time ?? '';
      if (date || time) {
        const caption = element('time', 'tasks-row-date', [dateLabel(task), time].filter(Boolean).join(', '));
        caption.dateTime = date && time ? `${date}T${time}` : date || time;
        button.append(caption);
      }
      button.append(direction.cloneNode(true));
      row.append(button);
      return row;
    }

    function render() {
      const queryText = normalize(query.value);
      const tagsOnly = queryText.startsWith('#');
      const search = tagsOnly ? tagKey(queryText) : queryText;
      const exactTag = tagKey(activeTag);
      const matches = tasks.filter(task => (!search || matchesSearch(task, search, tagsOnly)) &&
        (!exactTag || (task.tags ?? []).some(tag => tagKey(tag) === exactTag)) &&
        (!person.value || task.owner === person.value) && (!project.value || task.project === project.value));
      const entries = window.plannerSchedule(matches, today, view.value);
      if (!entries.includes(selectedTask)) selectedTask = entries[0];
      list.replaceChildren(...entries.map(taskRow));
      showDetails();
      const count = entries.length;
      const activeOptions = [view, person, project].filter(select => select.value);
      activeFilters.textContent = activeOptions.map(select => select.selectedOptions[0].textContent).join(' · ');
      activeFilters.hidden = !activeOptions.length;
      clearTag.hidden = !activeTag;
      clearTag.firstElementChild.textContent = '#' + activeTag;
      clearTag.setAttribute('aria-label', 'Снять отбор по метке ' + activeTag);
      reset.disabled = !(query.value || activeOptions.length || activeTag);
      result.textContent = `В списке ${count} ${taskForms[plural.select(count)]}`;
      scroll.scrollTop = 0;
    }

    fillFilter(person, 'owner', selection.person);
    fillFilter(project, 'project', selection.project);
    form.addEventListener('submit', event => event.preventDefault());
    panel.addEventListener('click', event => {
      if (!filters.contains(event.target)) filters.open = false;
    });
    filters.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || !filters.open) return;
      event.stopPropagation();
      event.preventDefault();
      filters.open = false;
      filters.querySelector('summary').focus();
    });
    query.addEventListener('input', render);
    for (const select of [view, person, project]) select.addEventListener('change', render);
    clearTag.addEventListener('click', () => {
      activeTag = '';
      render();
      query.focus({ preventScroll: true });
    });
    reset.addEventListener('click', () => {
      activeTag = '';
      form.reset();
      query.focus({ preventScroll: true });
      render();
    });
    render();
    const selectedRow = list.querySelector('[aria-pressed="true"]');
    if (selectedRow) scroll.scrollTop = selectedRow.getBoundingClientRect().top - scroll.getBoundingClientRect().top;
    return { openNewEntry };
  };
})();
