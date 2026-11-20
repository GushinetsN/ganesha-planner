(() => {
  const edge = 12;

  function positionNearPointer(point, card, viewport) {
    return {
      left: Math.max(edge, Math.min(point.x, viewport.width - card.width - edge)),
      top: Math.max(edge, Math.min(point.y, viewport.height - card.height - edge)),
    };
  }

  if (typeof module === 'object') {
    module.exports = { positionNearPointer };
    return;
  }

  const formatDate = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });

  window.printPlannerTags = (list, values, onTag) => {
    list.replaceChildren();
    for (const value of values ?? []) {
      const tag = value.trim().replace(/^#+\s*/, '');
      if (!tag) continue;
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'planner-tag';
      button.textContent = '#' + tag;
      button.setAttribute('aria-label', 'Отобрать по метке ' + tag);
      button.addEventListener('click', () => onTag(tag));
      item.append(button);
      list.append(item);
    }
    list.closest('.task-labels').hidden = !list.children.length;
  };

  window.createPlannerTaskCard = (planner, ganesha, onEdit, onTag) => {
    const dialog = planner.querySelector('#task-card');
    const closeButton = dialog.querySelector('.task-close');
    const editButton = dialog.querySelector('.task-edit');
    const title = dialog.querySelector('#task-title');
    const time = dialog.querySelector('time');
    const undated = dialog.querySelector('.task-undated');
    const owner = dialog.querySelector('#task-owner');
    const project = dialog.querySelector('#task-project');
    const description = dialog.querySelector('#task-description');
    const tags = dialog.querySelector('#task-tags');
    let source;
    let openingPoint;
    let activeTask;
    let backdropPressed = false;

    function isBackdrop(event) {
      if (event.target !== dialog) return false;
      const { left, right, top, bottom } = dialog.getBoundingClientRect();
      return event.clientX < left || event.clientX >= right ||
        event.clientY < top || event.clientY >= bottom;
    }

    function position() {
      const viewport = document.documentElement;
      if (openingPoint) {
        const position = positionNearPointer(openingPoint,
          { width: dialog.offsetWidth, height: dialog.offsetHeight },
          { width: viewport.clientWidth, height: viewport.clientHeight });
        dialog.style.setProperty('--task-left', `${position.left}px`);
        dialog.style.setProperty('--task-top', `${position.top}px`);
        return;
      }
      const right = planner.getBoundingClientRect().right;
      const bottom = ganesha.getBoundingClientRect().bottom;
      dialog.style.setProperty('--task-right', Math.max(edge, viewport.clientWidth - right) + 'px');
      dialog.style.setProperty('--task-bottom', Math.max(edge, viewport.clientHeight - bottom) + 'px');
    }

    function open(task, trigger, back, point) {
      activeTask = task;
      source = trigger;
      openingPoint = point;
      dialog.toggleAttribute('data-near-pointer', Boolean(point));
      closeButton.setAttribute('aria-description', back);
      title.textContent = task.title;
      time.hidden = !task.date;
      undated.hidden = Boolean(task.date);
      if (task.date) {
        time.dateTime = task.time ? task.date + 'T' + task.time : task.date;
        const date = formatDate.format(new Date(task.date)).replace(/\sг\.$/u, '');
        time.textContent = task.time ? date + ' · ' + task.time : date;
      }
      owner.textContent = task.owner || 'Не назначен';
      project.textContent = task.project || 'Без проекта';
      description.textContent = task.description ?? '';
      description.parentElement.hidden = !task.description;
      window.printPlannerTags(tags, task.tags, tag => {
        source = undefined;
        dialog.close();
        onTag(tag, task);
      });
      dialog.showModal();
      position();
      dialog.scrollTop = 0;
    }

    closeButton.addEventListener('click', () => dialog.close());
    editButton.addEventListener('click', () => {
      const task = activeTask;
      source = undefined;
      dialog.close();
      onEdit(task);
    });
    dialog.addEventListener('pointerdown', event => {
      backdropPressed = isBackdrop(event);
    });
    dialog.addEventListener('click', event => {
      if (backdropPressed && isBackdrop(event)) dialog.close();
      backdropPressed = false;
    });
    dialog.addEventListener('close', () => {
      source?.focus({ preventScroll: true });
      source = openingPoint = activeTask = undefined;
      backdropPressed = false;
    });
    window.addEventListener('resize', () => {
      if (dialog.open) requestAnimationFrame(() => { if (dialog.open) position(); });
    });

    return { open, isOpen: () => dialog.open };
  };
})();
