(() => {
  const prefix = 'ganesha.entry.v1:';
  const avatarPrefix = 'ganesha.avatar.v1:';
  const deletedDemoProjectPrefix = 'ganesha.deleted-demo-project.v1:';
  const deletedDemoPersonPrefix = 'ganesha.deleted-demo-person.v1:';
  const deletedTaskPrefix = 'ganesha.deleted-task.v1:';
  const avatarLabels = Object.freeze({
    ganesha: 'Ганеша',
    lakshmi: 'Лакшми',
    saraswati: 'Сарасвати',
    shiva: 'Шива',
    parvati: 'Парвати',
    krishna: 'Кришна',
    hanuman: 'Хануман',
    durga: 'Дурга',
    vishnu: 'Вишну',
    kali: 'Кали',
  });
  const groups = { task: 'tasks', project: 'projects', person: 'people' };
  const emptyEntries = () => ({ tasks: [], projects: [], people: [] });
  const clean = value => String(value ?? '').trim();
  const normalizedName = value => value.normalize('NFC').toLocaleLowerCase('ru');

  function readEntries(storage) {
    const entries = emptyEntries();
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      if (key?.startsWith(deletedDemoProjectPrefix)) {
        (entries.deletedDemoProjects ??= []).push(key.slice(deletedDemoProjectPrefix.length));
        continue;
      }
      if (key?.startsWith(deletedDemoPersonPrefix)) {
        (entries.deletedDemoPeople ??= []).push(key.slice(deletedDemoPersonPrefix.length));
        continue;
      }
      if (key?.startsWith(deletedTaskPrefix)) {
        (entries.deletedTasks ??= []).push(key.slice(deletedTaskPrefix.length));
        continue;
      }
      if (!key?.startsWith(prefix)) continue;
      const kind = key.slice(prefix.length).split(':', 1)[0];
      if (!Object.hasOwn(groups, kind)) continue;
      try {
        const entry = JSON.parse(storage.getItem(key));
        const label = kind === 'task' ? entry?.title : entry?.name;
        if (kind === 'task' && (typeof entry?.id !== 'string' || !entry.id)) continue;
        if (typeof label === 'string' && label) entries[groups[kind]].push(entry);
      } catch {
        // A damaged entry should not prevent loading the other cards.
      }
    }
    if (entries.deletedTasks) {
      const deleted = new Set(entries.deletedTasks);
      entries.tasks = entries.tasks.filter(task => !deleted.has(task.id));
    }
    return entries;
  }

  function writeChanges(storage, changes) {
    const previous = new Map([...changes.keys()].map(key => [key, storage.getItem(key)]));
    const applied = [];
    try {
      for (const [key, value] of changes) {
        if (value === null) storage.removeItem(key);
        else storage.setItem(key, value);
        applied.push(key);
      }
    } catch (error) {
      for (const key of applied) {
        if (previous.get(key) === null) storage.removeItem(key);
      }
      for (const key of applied) {
        if (previous.get(key) !== null) storage.setItem(key, previous.get(key));
      }
      throw error;
    }
  }

  function saveNamedEntry(storage, kind, name, { role, avatar, description }, entries = [], originalName) {
    const keyFor = value => prefix + kind + ':' + normalizedName(value);
    const original = entries.find(entry => entry.name === originalName);
    if (originalName !== undefined && !original) {
      throw new RangeError('Запись изменилась. Откройте карточку заново.');
    }
    const key = keyFor(name);
    const previousKey = original && keyFor(originalName);
    const taken = (key !== previousKey && storage.getItem(key) !== null) ||
      entries.some(entry => entry !== original && keyFor(entry.name) === key);
    if (taken) {
      throw new RangeError(kind === 'person' ? 'Человек с таким именем уже есть.' : 'Проект с таким названием уже есть.');
    }

    const entry = { ...original, name };
    if (kind === 'person') entry.role = clean(role);
    if (description !== undefined) {
      const details = clean(description);
      if (details) entry.description = details;
      else delete entry.description;
    }
    const changes = new Map([[key, JSON.stringify(entry)]]);
    const renamed = original && name !== originalName;
    if (renamed) {
      const field = kind === 'person' ? 'owner' : 'project';
      for (const task of readEntries(storage).tasks) {
        if (task[field] === originalName) {
          changes.set(prefix + 'task:' + task.id, JSON.stringify({ ...task, [field]: name }));
        }
      }
      if (key !== previousKey) changes.set(previousKey, null);
    }
    if (kind === 'person' && original && (renamed || avatar !== undefined)) {
      const nextAvatar = avatar ?? readPersonAvatar(storage, originalName);
      if (nextAvatar && !Object.hasOwn(avatarLabels, nextAvatar)) throw new RangeError('Выберите аватар из набора.');
      changes.set(avatarPrefix + name, nextAvatar || null);
      if (renamed) changes.set(avatarPrefix + originalName, null);
    }
    writeChanges(storage, changes);
    return entry;
  }

  function saveEntry(storage, kind, values, existing = {}, id) {
    if (!Object.hasOwn(groups, kind)) throw new RangeError('Выберите тип записи.');
    const title = clean(values.title);
    if (!title) throw new RangeError(kind === 'person' ? 'Введите имя.' : 'Введите название.');

    if (kind !== 'task') {
      return saveNamedEntry(storage, kind, title, values, existing[groups[kind]], id);
    }
    if (id !== undefined && storage.getItem(deletedTaskPrefix + id) !== null) {
      throw new RangeError('Эта задача уже удалена.');
    }

    const project = clean(values.project);
    if (project && existing.projects && !existing.projects.some(entry => entry.name === project)) {
      throw new RangeError('Проект больше недоступен. Откройте задачу заново и выберите проект.');
    }
    const owner = clean(values.owner);
    if (owner && existing.people && !existing.people.some(entry => entry.name === owner)) {
      throw new RangeError('Ответственный больше недоступен. Откройте задачу заново и выберите человека.');
    }
    const date = clean(values.date);
    const time = clean(values.time);
    const day = new Date(date + 'T00:00:00Z');
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(day.getTime()) ||
        day.toISOString().slice(0, 10) !== date)) {
      throw new RangeError('Укажите корректную дату.');
    }
    if (time && (!date || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time))) {
      throw new RangeError('Чтобы добавить время, укажите дату и корректное время.');
    }
    const original = existing.tasks?.find(task => task.id === id);
    const short = original?.title === title ? original.short || title : title;
    const entry = {
      id: id ?? 'local-' + crypto.randomUUID(), title, short, date, time,
      owner, project, description: clean(values.description),
      tags: [...new Set(clean(values.tags).split(',').map(clean).filter(Boolean))],
    };
    storage.setItem(prefix + 'task:' + entry.id, JSON.stringify(entry));
    return entry;
  }

  function removeTask(storage, id, tasks) {
    if (!tasks.some(task => task.id === id)) throw new RangeError('Эта задача уже удалена.');
    writeChanges(storage, new Map([
      [deletedTaskPrefix + id, '1'],
      [prefix + 'task:' + id, null],
    ]));
  }

  function removeNamedEntry(storage, kind, name, entries) {
    const entry = entries.find(candidate => candidate.name === name);
    const isPerson = kind === 'person';
    if (!entry) {
      throw new RangeError(isPerson ? 'Человек уже недоступен. Откройте список заново.'
        : 'Проект уже недоступен. Откройте список заново.');
    }
    const field = isPerson ? 'owner' : 'project';
    const changes = new Map([[prefix + kind + ':' + normalizedName(name), null]]);
    if (isPerson) changes.set(avatarPrefix + name, null);
    for (const task of readEntries(storage).tasks) {
      if (task[field] === name) {
        changes.set(prefix + 'task:' + task.id, JSON.stringify({ ...task, [field]: '' }));
      }
    }
    if (entry.demoName) {
      const demoPrefix = isPerson ? deletedDemoPersonPrefix : deletedDemoProjectPrefix;
      changes.set(demoPrefix + entry.demoName, '1');
    }
    writeChanges(storage, changes);
  }

  const removeProject = (storage, name, projects) => removeNamedEntry(storage, 'project', name, projects);
  const removePerson = (storage, name, people) => removeNamedEntry(storage, 'person', name, people);

  function readPersonAvatar(storage, name) {
    const avatar = storage.getItem(avatarPrefix + name);
    return Object.hasOwn(avatarLabels, avatar) ? avatar : '';
  }

  function savePersonAvatar(storage, name, avatar) {
    const key = avatarPrefix + name;
    if (avatar === '') {
      storage.removeItem(key);
      return;
    }
    if (!Object.hasOwn(avatarLabels, avatar)) throw new RangeError('Выберите аватар из набора.');
    storage.setItem(key, avatar);
  }

  if (typeof module === 'object') {
    module.exports = { readEntries, saveEntry, removeTask, removeProject, removePerson, readPersonAvatar, savePersonAvatar };
    return;
  }

  window.plannerPersonAvatars = {
    labels: avatarLabels,
    read(name) {
      try {
        return readPersonAvatar(window.localStorage, name);
      } catch {
        return '';
      }
    },
  };

  window.readPlannerEntries = () => {
    try {
      return readEntries(window.localStorage);
    } catch {
      return emptyEntries();
    }
  };

  window.createPlannerEntryCard = (planner, sectionData, onSave) => {
    const dialog = planner.querySelector('#entry-card');
    const discard = planner.querySelector('#draft-discard');
    const status = planner.querySelector('#planner-status');
    const template = document.querySelector('#entry-form-template');
    const heading = dialog.querySelector('#entry-title');
    const captions = { task: 'Новая задача', project: 'Новый проект', person: 'Новый человек' };
    const editCaptions = { task: 'Редактировать задачу', project: 'Редактировать проект', person: 'Редактировать человека' };
    const names = new Intl.Collator('ru').compare;
    let draft;
    let continueAfterDiscard;
    let statusTimer;

    const formState = form => new URLSearchParams(new FormData(form)).toString();
    const hasChanges = () => draft?.form.isConnected && formState(draft.form) !== draft.initial;

    function warnBeforeUnload(event) {
      if (!hasChanges()) return;
      event.preventDefault();
      event.returnValue = true;
    }

    function trackDraft(form, dismiss) {
      draft = { form, dismiss, initial: formState(form) };
      const updateWarning = () => {
        if (hasChanges()) window.addEventListener('beforeunload', warnBeforeUnload);
        else window.removeEventListener('beforeunload', warnBeforeUnload);
      };
      form.addEventListener('input', updateWarning);
      form.addEventListener('change', updateWarning);
    }

    function finishDraft() {
      const dismiss = draft?.dismiss;
      draft = undefined;
      window.removeEventListener('beforeunload', warnBeforeUnload);
      dismiss?.();
    }

    function leaveDraft(next) {
      function leave() {
        finishDraft();
        next?.();
      }
      if (!hasChanges()) {
        leave();
        return;
      }
      if (discard.open) return;
      continueAfterDiscard = leave;
      discard.returnValue = '';
      discard.showModal();
    }

    discard.addEventListener('close', () => {
      const next = continueAfterDiscard;
      continueAfterDiscard = undefined;
      if (discard.returnValue === 'discard') next?.();
      else if (draft?.form.isConnected && !draft.form.contains(document.activeElement)) {
        draft.form.elements.namedItem('title').focus();
      }
    });

    function fill(select, entries) {
      const options = entries.map(entry => entry.name).sort(names);
      select.append(...options.map(option => new Option(option, option)));
    }

    function makeForm(kind, cancel, saved, editing) {
      const form = template.content.firstElementChild.cloneNode(true);
      const taskFields = form.querySelector('[data-entry-task-fields]');
      const personFields = form.querySelector('[data-entry-person-fields]');
      const tags = form.querySelector('[data-entry-tags]');
      const description = form.querySelector('[name="description"]');
      const error = form.querySelector('.entry-error');
      form.querySelector('[type="submit"]').textContent = editing ? 'Сохранить' : 'Создать';
      form.querySelector('[data-entry-name-label]').textContent = kind === 'person' ? 'Имя' : 'Название';
      taskFields.hidden = taskFields.disabled = kind !== 'task';
      tags.hidden = tags.disabled = kind !== 'task';
      personFields.hidden = personFields.disabled = kind !== 'person';
      if (kind === 'task') {
        const { people, projects } = sectionData();
        fill(form.elements.namedItem('owner'), people);
        fill(form.elements.namedItem('project'), projects);
        if (editing) {
          for (const name of ['title', 'date', 'time', 'owner', 'project']) {
            form.elements.namedItem(name).value = editing[name] ?? '';
          }
          form.elements.namedItem('tags').value = (editing.tags ?? []).join(', ');
        }
      } else if (editing) {
        form.elements.namedItem('title').value = editing.name;
        if (kind === 'person') form.elements.namedItem('role').value = editing.role ?? '';
      }
      description.value = editing?.description ?? '';

      form.addEventListener('submit', event => {
        event.preventDefault();
        let entry;
        try {
          entry = saveEntry(window.localStorage, kind, Object.fromEntries(new FormData(form)),
            sectionData(), kind === 'task' ? editing?.id : editing?.name);
        } catch (problem) {
          error.textContent = problem instanceof RangeError
            ? problem.message
            : 'Браузер не смог сохранить запись. Проверьте доступ к локальному хранилищу.';
          error.hidden = false;
          return;
        }
        saved(entry);
      });
      form.querySelector('[data-entry-cancel]').addEventListener('click', cancel);
      return form;
    }

    function notify(message) {
      clearTimeout(statusTimer);
      status.replaceChildren(message);
      statusTimer = setTimeout(() => status.replaceChildren(), 3500);
    }

    function saved(kind, entry) {
      finishDraft();
      onSave(kind, entry);
      if (kind === 'task') notify('Задача сохранена');
    }

    function open(kind, editing, setupForm) {
      leaveDraft(() => {
        const form = makeForm(kind, () => leaveDraft(), entry => saved(kind, entry), editing);
        setupForm?.(form);
        heading.textContent = editing ? editCaptions[kind] : captions[kind];
        dialog.querySelector('form')?.remove();
        dialog.append(form);
        trackDraft(form, () => dialog.close());
        dialog.scrollTop = 0;
        dialog.showModal();
        form.elements.namedItem('title').focus({ preventScroll: true });
      });
    }

    function mountInline(kind, { panel, editor, trigger, onToggle }) {
      const editorPanel = editor.closest('.records-editor');
      function setVisible(visible) {
        editorPanel.hidden = !visible;
        panel.toggleAttribute('data-creating', visible);
        onToggle(visible);
      }

      function cancel() {
        editor.replaceChildren();
        setVisible(false);
        trigger.focus({ preventScroll: true });
      }

      function openInline() {
        if (editorPanel.hidden) {
          const form = makeForm(kind, () => leaveDraft(), entry => saved(kind, entry));
          form.setAttribute('aria-label', captions[kind]);
          form.addEventListener('keydown', event => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();
            leaveDraft();
          });
          editor.replaceChildren(form);
          setVisible(true);
          trackDraft(form, cancel);
        }
        editor.querySelector('[name="title"]').focus({ preventScroll: true });
      }

      trigger.addEventListener('click', openInline);
      return openInline;
    }

    function confirmRemoval(title, explanation, remove, failure, onRemove) {
      const form = document.querySelector('#entry-removal-template').content.firstElementChild.cloneNode(true);
      const cancel = form.querySelector('[data-entry-cancel]');
      const error = form.querySelector('.entry-error');
      form.querySelector('.entry-note').textContent = explanation;
      cancel.addEventListener('click', () => dialog.close());
      form.addEventListener('submit', event => {
        event.preventDefault();
        try {
          remove();
        } catch (problem) {
          error.textContent = problem instanceof RangeError ? problem.message : failure;
          error.hidden = false;
          return;
        }
        dialog.close();
        onRemove();
      });
      heading.textContent = title;
      dialog.querySelector('form')?.remove();
      dialog.append(form);
      dialog.scrollTop = 0;
      dialog.showModal();
      cancel.focus({ preventScroll: true });
    }

    function confirmTaskRemoval(task, onRemove) {
      confirmRemoval(`Удалить задачу «${task.title}»?`, 'Задача исчезнет из календаря и списков.',
        () => removeTask(window.localStorage, task.id, sectionData().tasks), 'Не удалось удалить задачу.', () => {
          onRemove();
          notify('Задача удалена');
        });
    }

    function confirmProjectRemoval(name, onRemove) {
      confirmRemoval(`Удалить проект «${name}»?`, 'Связанные задачи останутся в списке задач без проекта.',
        () => removeProject(window.localStorage, name, sectionData().projects), 'Не удалось удалить проект.', onRemove);
    }

    function confirmPersonRemoval(name, onRemove) {
      confirmRemoval(`Удалить человека «${name}»?`, 'У связанных задач очистится поле «Ответственный».',
        () => removePerson(window.localStorage, name, sectionData().people), 'Не удалось удалить человека.', onRemove);
    }

    function closeDialog(event) {
      if (draft?.form.parentElement === dialog) {
        event.preventDefault();
        leaveDraft();
      } else if (event.type === 'click') dialog.close();
    }

    dialog.addEventListener('cancel', closeDialog);
    dialog.querySelector('[data-entry-cancel]').addEventListener('click', closeDialog);
    return {
      leaveDraft,
      open,
      mountInline,
      confirmTaskRemoval,
      confirmProjectRemoval,
      confirmPersonRemoval,
      isOpen: () => dialog.open || discard.open,
    };
  };
})();
