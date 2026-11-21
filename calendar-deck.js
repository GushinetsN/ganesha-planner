(() => {
  const storageKey = 'ganesha-planner.day-card';

  function localDeckDate(now = new Date()) {
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
  }

  function readDayCard(storage, date, fallback) {
    let saved;
    try {
      saved = JSON.parse(storage?.getItem(storageKey) ?? 'null');
    } catch {
      // A blocked storage or invalid record must not prevent drawing a card.
    }
    if (saved?.date === date && typeof saved.id === 'string') return saved;
    return fallback?.date === date ? fallback : null;
  }

  function saveDayCard(storage, date, id) {
    const choice = { date, id };
    try {
      storage?.setItem(storageKey, JSON.stringify(choice));
    } catch {
      // The choice is still available in this tab until midnight.
    }
    return choice;
  }

  if (typeof module === 'object' && module.exports) {
    module.exports = { localDeckDate, readDayCard, saveDayCard };
    return;
  }

  const deck = document.querySelector('.calendar-deck');
  const note = deck.closest('.calendar-message');
  const slots = Array.from(deck.querySelectorAll('button'));
  const daily = note.querySelector('.deck-daily-card');
  const thumbnail = daily.querySelector('img');
  const status = document.querySelector('#deck-status');
  const dialog = document.querySelector('#deck-dialog');
  const viewer = document.querySelector('#deck-viewer');
  const picture = viewer.querySelector('.deck-picture');
  const viewStatus = document.querySelector('#deck-view-status');
  const description = document.querySelector('#deck-description');
  const title = document.querySelector('#deck-card-title');
  const story = document.querySelector('#deck-card-story');
  const artworkRoot = new URL('metaphor-cards/', document.baseURI);

  let storage;
  try {
    storage = window.localStorage;
  } catch {
    // Reading the storage property itself can fail in restricted browsers.
  }
  let cards;
  let deckRequest;
  let localChoice;
  let loading = false;
  let resetTimer;

  const artworkUrl = card => new URL(card.artwork, artworkRoot).href;

  function loadDeck() {
    return deckRequest ??= fetch(new URL('cards.json?v=story-review', artworkRoot))
      .then(response => {
        if (!response.ok) throw new Error('Deck is unavailable');
        return response.json();
      })
      .then(data => { cards = data; })
      .finally(() => { deckRequest = undefined; });
  }

  function showLoadError() {
    status.textContent = 'Колода не загрузилась. Нажмите на карту ещё раз.';
    status.hidden = false;
  }

  function paintDay(date = localDeckDate()) {
    const record = readDayCard(storage, date, localChoice);
    const current = cards?.find(card => card.id === record?.id);
    deck.hidden = Boolean(current);
    daily.hidden = !current;
    if (current && daily.dataset.card !== current.id) {
      thumbnail.src = artworkUrl(current);
      daily.dataset.card = current.id;
      daily.setAttribute('aria-label', `Открыть карту дня «${current.title}»`);
    }
    return current;
  }

  async function refreshDay() {
    try {
      if (!cards && readDayCard(storage, localDeckDate(), localChoice)) await loadDeck();
      paintDay();
      status.hidden = true;
    } catch {
      showLoadError();
    }
  }

  function watchMidnight() {
    clearTimeout(resetTimer);
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    resetTimer = setTimeout(watchMidnight, midnight - now);
    refreshDay();
  }

  function setDescription(open) {
    description.hidden = !open;
    viewer.setAttribute('aria-expanded', String(open));
    viewer.setAttribute('aria-label', (open ? 'Вернуться к иллюстрации «' : 'Показать описание карты «') + title.textContent + '»');
    if (open) viewer.setAttribute('aria-describedby', story.id);
    else viewer.removeAttribute('aria-describedby');
  }

  async function showCard(card, newlyDrawn) {
    const image = new Image();
    image.alt = '';
    image.src = artworkUrl(card);
    picture.replaceChildren(image);
    title.textContent = card.title;
    story.textContent = card.myth;
    setDescription(false);
    viewer.dataset.revealed = 'false';
    viewer.dataset.flip = String(newlyDrawn);
    viewStatus.textContent = 'Открываю карту…';
    // Keep focus restoration consistent on touch devices and in browsers that do not focus clicked buttons.
    daily.focus({ preventScroll: true });
    dialog.showModal();

    try {
      await image.decode();
    } catch {
      if (dialog.open && picture.firstChild === image) {
        viewStatus.textContent = 'Рисунок не загрузился. Нажмите на карту, чтобы прочитать историю.';
      }
      return;
    }
    if (!dialog.open || picture.firstChild !== image) return;
    viewStatus.textContent = '';
    viewer.dataset.revealed = 'true';
  }

  note.addEventListener('click', async event => {
    const trigger = event.target.closest('button');
    const slotIndex = slots.indexOf(trigger);
    if ((slotIndex < 0 && trigger !== daily) || loading || dialog.open) return;
    loading = true;
    status.hidden = true;

    try {
      if (!cards) await loadDeck();
    } catch {
      showLoadError();
      return;
    } finally {
      loading = false;
    }

    if (note.closest('[hidden], [inert]')) return;
    const date = localDeckDate();
    const alreadyDrawn = paintDay(date);
    if (alreadyDrawn) {
      showCard(alreadyDrawn, false);
    } else if (slotIndex >= 0) {
      const remaining = [...cards];
      const hand = slots.map(() => remaining.splice(Math.floor(Math.random() * remaining.length), 1)[0]);
      const chosen = hand[slotIndex];
      localChoice = saveDayCard(storage, date, chosen.id);
      paintDay(date);
      showCard(chosen, true);
    }
  });

  viewer.addEventListener('click', () => {
    setDescription(description.hidden);
  });

  window.addEventListener('storage', event => {
    if (event.key === storageKey || event.key === null) refreshDay();
  });
  window.addEventListener('focus', watchMidnight);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) watchMidnight();
  });
  watchMidnight();
})();
