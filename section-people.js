(() => {
  const demoRoles = new Map([
    ['Татьяна', 'Расписание репетиций'],
    ['Софья', 'Музыка для прогона'],
    ['Лидия', 'Костюмы и реквизит'],
  ]);
  const compare = new Intl.Collator('ru').compare;
  const normalize = text => text.trim().toLocaleLowerCase('ru').replaceAll('ё', 'е');
  const shortDate = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'long', timeZone: 'UTC' });
  const longDate = new Intl.DateTimeFormat('ru', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
  const uniqueNames = values => [...new Set(values.filter(Boolean))].sort(compare);
  const direction = document.querySelector('#agenda-arrow').content.firstElementChild;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function buttonRow(title, className = 'tasks-row') {
    const row = element('li');
    const button = element('button', className);
    button.type = 'button';
    button.append(element('span', 'tasks-row-title', title), direction.cloneNode(true));
    row.append(button);
    return { row, button };
  }

  function avatarSource(avatar) {
    return 'people-avatar-' + avatar + '-soft.png';
  }

  function avatarBadge(name, avatar) {
    const badge = element('span', 'people-avatar');
    badge.setAttribute('aria-hidden', 'true');
    if (avatar) {
      const image = element('img');
      image.src = avatarSource(avatar);
      image.alt = '';
      badge.append(image);
    } else {
      badge.textContent = name.trim().split(/\s+/).slice(0, 2)
        .map(part => [...part][0]).join('').toLocaleUpperCase('ru');
    }
    return badge;
  }

  function taskRow(task, today) {
    const { row, button } = buttonRow(task.title);
    button.dataset.task = task.id;
    button.dataset.taskBack = 'К подробностям о человеке';
    button.setAttribute('aria-haspopup', 'dialog');
    if (task.project) button.append(element('small', 'tasks-row-meta', task.project));
    if (task.date) {
      const formatter = task.date.slice(0, 4) === today.slice(0, 4) ? shortDate : longDate;
      const label = formatter.format(new Date(task.date));
      const date = element('time', 'tasks-row-date', [label, task.time].filter(Boolean).join(', '));
      date.dateTime = task.time ? task.date + 'T' + task.time : task.date;
      button.append(date);
    }
    return row;
  }

  window.plannerSections ??= {};
  window.plannerSections.people = (root, {
    tasks, people = [], projects = [], today, selection = {}, navigate, editEntry, mountInlineEntry, leaveDraft, confirmPersonRemoval,
  }) => {
    const avatars = window.plannerPersonAvatars;
    const assigned = new Map(people.map(({ name }) => [name, []]));
    const peopleEntries = new Map(people.map(entry => [entry.name, entry]));
    for (const task of tasks) {
      if (!task.owner) continue;
      if (!assigned.has(task.owner)) assigned.set(task.owner, []);
      assigned.get(task.owner).push(task);
    }
    const names = [...assigned.keys()].sort(compare);
    const projectNames = uniqueNames([...projects.map(project => project.name), ...tasks.map(task => task.project)]);

    root.innerHTML = `
      <div class="planner-tasks people-view planner-records">
        <div class="records-index">
          <form class="planner-section-controls records-filters" role="search" aria-label="Поиск и фильтры по людям">
            <input type="search" name="query" aria-label="Имя человека" placeholder="Поиск по имени" autocomplete="off">
            <select name="project" aria-label="Проект"><option value="">Все проекты</option></select>
            <button class="planner-action planner-action--quiet tasks-reset" type="button" hidden>Сбросить</button>
          </form>
          <div class="tasks-scroll people-scroll records-scroll" role="region" aria-label="Список людей" tabindex="0">
            <p class="tasks-result" role="status"></p>
            <ul class="tasks-list people-list"></ul>
          </div>
        </div>
        <section id="people-details" class="records-summary" aria-label="Сведения о человеке">
          <div class="records-core people-profile" hidden>
            <div class="people-portrait" aria-hidden="true" hidden><img alt=""></div>
            <header class="records-card-heading">
              <h3 class="records-title people-name" aria-live="polite"></h3>
              <div class="planner-card-actions" role="group" aria-label="Действия с человеком">
                <button class="planner-icon-action records-card-action people-edit" type="button" aria-label="Редактировать человека" aria-haspopup="dialog">
                  <svg aria-hidden="true" viewBox="0 0 40 40"><use href="planner-icons.svg?v=card-actions#record-edit"/></svg>
                </button>
                <button class="planner-icon-action records-card-action people-delete" type="button" aria-label="Удалить человека" aria-haspopup="dialog">
                  <svg aria-hidden="true" viewBox="0 0 40 40"><use href="planner-icons.svg?v=card-actions#record-delete"/></svg>
                </button>
              </div>
            </header>
            <div class="records-copy records-scroll">
              <p class="people-role" hidden></p>
              <p class="people-description records-description" hidden></p>
            </div>
          </div>
          <div class="records-actions">
            <button class="planner-action planner-action--primary section-create" type="button" aria-controls="people-entry" aria-description="Новый человек">
              <svg aria-hidden="true" viewBox="0 0 40 40"><use href="planner-icons.svg?v=card-actions#record-create"/></svg>
              Создать
            </button>
          </div>
        </section>
        <aside class="records-related" aria-label="Связи человека" hidden>
          <section class="records-relation" aria-labelledby="people-related-projects">
            <h4 id="people-related-projects"><svg class="planner-subheading-icon" aria-hidden="true" viewBox="0 0 40 40"><use href="planner-icons.svg?v=clear-icons#pavilion"/></svg>Проекты</h4>
            <p class="records-empty people-no-projects">Пока нет проектов.</p>
            <ul class="records-scroll records-links people-projects"></ul>
          </section>
          <section class="records-relation" aria-labelledby="people-related-tasks">
            <h4 id="people-related-tasks"><svg class="planner-subheading-icon" aria-hidden="true" viewBox="0 0 40 40"><use href="planner-icons.svg?v=clear-icons#tasks"/></svg>Задачи</h4>
            <p class="records-empty people-no-tasks">Пока нет задач.</p>
            <ul class="tasks-list records-scroll people-related-tasks"></ul>
          </section>
        </aside>
        <section class="records-editor" aria-labelledby="people-entry-title" hidden>
          <h3 id="people-entry-title">Новый человек</h3>
          <div class="records-scroll" id="people-entry"></div>
        </section>
      </div>
      <dialog class="task-card entry-card people-avatar-dialog" aria-labelledby="people-avatar-title">
        <header class="task-card-heading">
          <h2 id="people-avatar-title">Выбрать аватар</h2>
          <form method="dialog">
            <button type="submit" class="task-icon task-close" aria-label="Закрыть выбор аватара">
              <svg aria-hidden="true" viewBox="0 0 40 40"><use href="planner-icons.svg?v=clear-icons#close"/></svg>
            </button>
          </form>
        </header>
        <div class="people-avatar-gallery"></div>
        <button class="planner-action people-avatar-initials" type="button">Инициалы</button>
      </dialog>`;

    const form = root.querySelector('form');
    const query = form.elements.namedItem('query');
    const project = form.elements.namedItem('project');
    const reset = form.querySelector('.tasks-reset');
    const list = root.querySelector('.people-list');
    const listScroll = root.querySelector('.people-scroll');
    const result = root.querySelector('.tasks-result');
    const profile = root.querySelector('.people-profile');
    const nameTitle = profile.querySelector('.people-name');
    const roleText = profile.querySelector('.people-role');
    const description = profile.querySelector('.people-description');
    const edit = profile.querySelector('.people-edit');
    const editor = root.querySelector('#people-entry');
    const editorPanel = editor.closest('.records-editor');
    const related = root.querySelector('.records-related');
    const links = related.querySelector('.people-projects');
    const rows = related.querySelector('.people-related-tasks');
    const noProjects = related.querySelector('.people-no-projects');
    const noTasks = related.querySelector('.people-no-tasks');
    const portrait = root.querySelector('.people-portrait');
    const portraitImage = portrait.firstElementChild;
    const avatarDialog = root.querySelector('.people-avatar-dialog');
    const gallery = avatarDialog.querySelector('.people-avatar-gallery');
    const initialsOption = avatarDialog.querySelector('.people-avatar-initials');
    let selected = assigned.has(selection.person) ? selection.person : undefined;
    edit.addEventListener('click', () => {
      const name = selected;
      const person = { ...peopleEntries.get(name), name, role: roleFor(name) };
      editEntry('person', person, form => addAvatarEditor(form, name));
    });
    profile.querySelector('.people-delete').addEventListener('click', () => {
      confirmPersonRemoval(selected, () => navigate('people'));
    });
    const openNewEntry = mountInlineEntry('person', {
      panel: root.querySelector('.people-view'),
      editor,
      trigger: root.querySelector('[aria-controls="people-entry"]'),
      onToggle: showDetails,
    });

    function roleFor(name) {
      return peopleEntries.get(name)?.role ?? demoRoles.get(name);
    }

    function showPortrait(avatar) {
      if (avatar) portraitImage.src = avatarSource(avatar);
      else portraitImage.removeAttribute('src');
      portrait.hidden = !avatar;
    }

    function chooseAvatar(name, current, onPick) {
      function apply(avatar) {
        onPick(avatar);
        avatarDialog.close();
      }

      gallery.replaceChildren(...Object.entries(avatars.labels).map(([avatar, label]) => {
        const option = element('button', 'people-avatar-option');
        option.type = 'button';
        option.setAttribute('aria-pressed', String(avatar === current));
        option.append(avatarBadge(name, avatar), element('span', '', label));
        option.addEventListener('click', () => apply(avatar));
        return option;
      }));
      initialsOption.setAttribute('aria-pressed', String(current === ''));
      initialsOption.onclick = () => apply('');
      avatarDialog.showModal();
      (gallery.querySelector('[aria-pressed="true"]') || initialsOption).focus();
    }

    function addAvatarEditor(form, name) {
      const label = form.querySelector('[data-entry-name-label]').closest('label');
      const row = element('div', 'people-edit-name');
      const field = element('input');
      field.type = 'hidden';
      field.name = 'avatar';
      const initialAvatar = avatars.read(name);
      field.value = initialAvatar;
      field.disabled = true;

      const trigger = element('button', 'planner-icon-action people-avatar-trigger');
      trigger.type = 'button';
      trigger.setAttribute('aria-label', 'Выбрать аватар');
      trigger.setAttribute('aria-haspopup', 'dialog');
      function updatePreview() {
        trigger.replaceChildren(avatarBadge(name, field.value));
        trigger.setAttribute('aria-description', avatars.labels[field.value] ?? 'Инициалы');
      }
      trigger.addEventListener('click', () => chooseAvatar(name, field.value, avatar => {
        field.value = avatar;
        field.disabled = avatar === initialAvatar;
        field.dispatchEvent(new Event('change', { bubbles: true }));
        updatePreview();
      }));
      updatePreview();
      label.before(row);
      row.append(label, trigger, field);
    }

    function showDetails() {
      const creating = !editorPanel.hidden;
      profile.hidden = !selected;
      profile.inert = creating;
      related.hidden = creating || !selected;
      showPortrait(profile.hidden ? '' : avatars.read(selected));
      if (profile.hidden) return;

      const role = roleFor(selected);
      const personTasks = assigned.get(selected);
      const personProjects = uniqueNames(personTasks.map(task => task.project));
      nameTitle.textContent = selected;
      roleText.textContent = role ?? '';
      roleText.hidden = !role;
      description.textContent = peopleEntries.get(selected)?.description ?? '';
      description.hidden = !description.textContent;
      links.replaceChildren(...personProjects.map(name => {
        const { row, button } = buttonRow(name, 'records-link');
        button.addEventListener('click', () => navigate('projects', { project: name }));
        return row;
      }));
      links.scrollTop = 0;
      noProjects.hidden = Boolean(personProjects.length);
      const visibleTasks = project.value ? personTasks.filter(task => task.project === project.value) : personTasks;
      rows.replaceChildren(...window.plannerSchedule(visibleTasks, today).map(task => taskRow(task, today)));
      rows.scrollTop = 0;
      noTasks.hidden = Boolean(visibleTasks.length);
    }

    function render() {
      const search = normalize(query.value);
      const matches = names.filter(name => normalize(name).includes(search) &&
        (!project.value || assigned.get(name).some(task => task.project === project.value)));
      if (!matches.includes(selected)) selected = matches[0];
      list.replaceChildren(...matches.map(name => {
        const { row, button } = buttonRow(name, 'tasks-row people-name-row');
        button.prepend(avatarBadge(name, avatars.read(name)));
        button.setAttribute('aria-controls', 'people-details');
        button.setAttribute('aria-pressed', String(name === selected));
        button.addEventListener('click', () => leaveDraft(() => {
          button.focus({ preventScroll: true });
          if (name === selected) return;
          list.querySelector('[aria-pressed="true"]')?.setAttribute('aria-pressed', 'false');
          button.setAttribute('aria-pressed', 'true');
          selected = name;
          showDetails();
        }));
        return row;
      }));
      reset.hidden = !(query.value || project.value);
      result.classList.toggle('sr-only', matches.length > 0);
      result.textContent = matches.length ? 'Людей в списке: ' + matches.length
        : search || project.value ? 'По этим условиям никого не найдено. Измените поиск или сбросьте фильтры.'
          : 'В ежедневнике пока нет людей.';
      listScroll.scrollTop = 0;
      showDetails();
    }

    project.append(...projectNames.map(name => new Option(name, name)));
    project.value = projectNames.includes(selection.project) ? selection.project : '';
    form.addEventListener('submit', event => event.preventDefault());
    query.addEventListener('input', render);
    project.addEventListener('change', render);
    reset.addEventListener('click', () => {
      form.reset();
      query.focus({ preventScroll: true });
      render();
    });
    render();
    const selectedRow = list.querySelector('[aria-pressed="true"]');
    if (selectedRow) listScroll.scrollTop = selectedRow.getBoundingClientRect().top - listScroll.getBoundingClientRect().top;
    return { openNewEntry };
  };
})();
