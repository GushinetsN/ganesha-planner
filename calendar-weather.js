(() => {
  const seasons = {
    autumn: { row: 0, scale: 1.83, turn: 112 },
    winter: { row: 1, scale: 1, turn: 70 },
    spring: { row: 2, scale: 1, turn: 88 },
    summer: { row: 3, scale: 1, turn: 28 },
  };
  const sizes = [35, 47, 27];
  const wind = [
    { at: 0, x: 0, y: 0, opacity: 0 },
    { at: .19, x: .16, y: .21, opacity: .48, bank: .6 },
    { at: .48, x: .52, y: .46, opacity: .73, bank: 1 },
    { at: .82, x: .78, y: .8, opacity: .54, bank: -.55 },
    { at: 1, x: 1, y: 1, opacity: 0 },
  ];
  const moth = [
    { at: 0, x: 0, y: 0, opacity: 0, easing: 'ease-out' },
    { at: .18, x: .42, y: .25, opacity: .65, bank: .4 },
    { at: .34, x: .92, y: .29, opacity: .73, bank: 1, easing: 'ease-in-out' },
    { at: .46, x: .42, y: .24, opacity: .73, bank: -.7, easing: 'ease-out' },
    { at: .62, x: -.3, y: .58, opacity: .71, bank: -1 },
    { at: .76, x: .19, y: .63, opacity: .66, bank: .6, easing: 'ease-in' },
    { at: .88, x: .68, y: .82, opacity: .57, bank: .35 },
    { at: 1, x: 1, y: 1, opacity: 0 },
  ];

  function createFlightPlan(season, random = Math.random) {
    const between = (min, max) => min + (max - min) * random();
    const direction = random() < .5 ? 1 : -1;
    const count = random() < .63 ? 2 : 3;
    const first = Math.floor(between(0, 3));
    const { scale, turn } = seasons[season];
    const insect = season === 'summer';
    const particles = Array.from({ length: count }, (_, index) => {
      const variant = (first + index) % 3;
      const fromX = between(-4, 4);
      const fromY = insect ? between(92, 110) : between(-21, -3);
      const toY = insect ? between(-18, 4) : between(97, 119);
      const far = between(-43, -22);
      const near = between(12, 32);
      const approaching = random() < .57;
      return {
        variant,
        delay: Math.round(index * between(440, 760)),
        duration: Math.round(between(2600, 4200) + index * 160),
        size: Math.round(sizes[index] * scale * between(.91, 1.12)),
        lane: 27 + 23 * variant + between(-8, 8),
        fromX,
        toX: fromX + direction * between(5, insect ? 12 : 18),
        fromY,
        toY,
        sway: between(-4, 4),
        angle: between(-63, 72) + index * 17,
        spin: direction * turn * between(.62, 1.44),
        pitch: between(25, 52) * direction,
        yaw: between(-42, 42),
        fromDepth: approaching ? far : near,
        toDepth: approaching ? near : far,
        waypoints: insect ? moth : wind,
        wingbeat: insect ? Math.round(between(85, 138)) : undefined,
      };
    });
    return { particles, rest: Math.round(between(3100, 7000)) };
  }

  if (typeof module === 'object') {
    module.exports = { createFlightPlan };
    return;
  }

  const interpolate = (start, end, progress) => start + (end - start) * progress;

  function frame(particle, { at, x, y, opacity, bank = 0, easing = 'linear' }) {
    const left = interpolate(particle.fromX, particle.toX, x) + particle.sway * bank;
    const top = interpolate(particle.fromY, particle.toY, y);
    const depth = interpolate(particle.fromDepth, particle.toDepth, at);
    const pitch = particle.pitch * (1 - 2 * at) - bank * 13;
    const yaw = particle.yaw * (2 * at - 1) + bank * 13;
    const roll = particle.angle + particle.spin * y + bank * 15;
    return {
      left: `calc(${particle.lane}% + ${left}px)`, top: `${top}%`,
      transform: `translate(-50%, -50%) perspective(240px) translateZ(${depth}px) rotateX(${pitch}deg) rotateY(${yaw}deg) rotateZ(${roll}deg)`,
      opacity, offset: at, easing,
    };
  }

  window.createCalendarWeather = layer => {
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    let season = '';
    let timer;

    function fly(particle, row) {
      const sprite = document.createElement('span');
      sprite.className = 'weather-particle';
      sprite.style.width = `${particle.size}px`;
      const texture = document.createElement('span');
      texture.className = 'weather-texture';
      texture.style.backgroundPosition = `${particle.variant * 50}% ${row * 100 / 3}%`;
      if (particle.wingbeat) {
        texture.classList.add('weather-moth');
        texture.style.setProperty('--wingbeat', `${particle.wingbeat}ms`);
      }
      sprite.append(texture);
      layer.append(sprite);

      const { duration, delay, waypoints } = particle;
      const flight = sprite.animate(waypoints.map(point => frame(particle, point)), {
        duration, delay, easing: particle.wingbeat ? 'linear' : 'ease-in-out', fill: 'both',
      });
      const remove = () => sprite.remove();
      flight.finished.then(remove, remove);
    }

    function breeze() {
      const { particles, rest } = createFlightPlan(season);
      for (const particle of particles) fly(particle, seasons[season].row);
      const last = Math.max(...particles.map(({ delay, duration }) => delay + duration));
      timer = setTimeout(breeze, last + rest);
    }

    function restart() {
      clearTimeout(timer);
      for (const animation of layer.getAnimations({ subtree: true })) animation.cancel();
      layer.replaceChildren();
      if (season && !document.hidden && !reducedMotion.matches) {
        timer = setTimeout(breeze, 700 + Math.random() * 650);
      }
    }

    reducedMotion.addEventListener('change', restart);
    document.addEventListener('visibilitychange', restart);
    return {
      setSeason(next) {
        if (next === season) return;
        season = next;
        restart();
      },
    };
  };
})();
