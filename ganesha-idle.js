(() => {
  const clamp = value => Math.max(0, Math.min(1, value));
  const mix = (from, to, amount) => from + (to - from) * amount;
  const ease = value => {
    const t = clamp(value);
    return t * t * (3 - 2 * t);
  };
  const wave = (seconds, period) => Math.sin(seconds * 2 * Math.PI / period);

  function poseAt(seconds, greetingSeconds = null, pointerGaze = 0) {
    const time = seconds % 18;
    const greeting = greetingSeconds !== null;
    const greetingGaze = greeting
      ? ease(greetingSeconds / .13) * (1 - ease((greetingSeconds - .37) / .7))
      : 0;
    const idleGaze = ease((time - 9.05) / .32) * (1 - ease((time - 10.55) / .42));
    const pointerLook = clamp(pointerGaze);
    const gaze = Math.max(greetingGaze, idleGaze, pointerLook);
    const blink = Math.max(0, ...[1.8, 4.1, 8.6, 12.1, 16.3]
      .map(at => 1 - Math.abs(time - at) / .143));
    return {
      breath: .5 + .5 * wave(seconds - 1.17, 4.68),
      blink: greeting ? blink * (1 - gaze) : blink,
      gaze,
      headLift: 27 * pointerLook,
      leftEar: .67 * wave(seconds - .55, 3.2) * Math.pow(.5 + .5 * wave(seconds, 7.8), 2) - .36 * greetingGaze,
      rightEar: .62 * wave(seconds - 1.8, 3.8) * Math.pow(.5 + .5 * wave(seconds - 2, 7.1), 2) + .28 * greetingGaze,
      trunk: .8 * wave(seconds - .6, 5.6) + .5 * greetingGaze,
      ink: ease((time - 4.8) / 2.8) * (time < 14.4 ? 1 : 0),
      inkOpacity: 1 - ease(time - 13.4),
      hand: 1 - ease((time - 7.6) / .75),
    };
  }

  const inkStart = [531, 998];
  const strokes = [
    [0, 0], [3, -4], [7, -8], [11, -11], [15, -12], [17, -11],
    [17, -8], [15, -4], [12, 0], [11, 3], [13, 4], [17, 2],
    [23, -4], [27, -8], [30, -8], [28, -3], [27, 0],
    [31, 0], [35, -3], [40, -6], [45, -8],
  ];

  function transformPoint({ angle, x, y }, px, py) {
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    return [x + px * cosine - py * sine, y + px * sine + py * cosine];
  }

  function penPose(progress, contact) {
    const position = progress * (strokes.length - 1);
    const segment = Math.min(Math.floor(position), strokes.length - 2);
    const [ax, ay] = strokes[segment];
    const [bx, by] = strokes[segment + 1];
    const tip = [
      inkStart[0] + mix(ax, bx, position - segment),
      inkStart[1] + mix(ay, by, position - segment),
    ];
    const angle = -.045 * progress * contact;
    const [restX, restY] = transformPoint({ angle, x: 0, y: 0 }, ...inkStart);
    return {
      segment,
      tip,
      transform: {
        angle,
        x: mix(inkStart[0], tip[0], contact) - restX,
        y: mix(inkStart[1], tip[1], contact) - restY - 16 * Math.sin(Math.PI * contact),
      },
    };
  }

  if (typeof module === 'object') {
    module.exports = { poseAt, penPose, transformPoint };
    return;
  }

  const button = document.querySelector('#ganesha');
  const figure = button.querySelector('img');
  const portrait = button.querySelector('canvas');
  const planner = document.querySelector('.planner');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const drawing = portrait.getContext('2d');
  if (!drawing) return;

  const artWidth = 1159;
  const artHeight = 1358;
  const scale = portrait.width / artWidth;
  const path = svg => new Path2D(svg);

  // The front plate covers the roots of the ears. The ear sprites extend behind it.
  const leftEarCut = path('M105 360 H253 C310 372 340 402 364 445 C379 472 383 497 382 515 C379 531 390 548 399 557 C416 586 406 620 387 638 L316 675 H105 Z');
  const rightEarCut = path('M958 396 H869 C842 411 824 422 799 458 C787 474 780 500 777 514 C773 542 768 579 762 601 C761 621 749 632 737 636 L792 682 H958 Z');
  const leftEarSprite = path('M102 358 H254 C327 373 362 406 392 464 L397 506 L433 555 L410 636 L312 683 H102 Z');
  const rightEarSprite = path('M970 393 H864 C838 400 805 424 778 462 L753 515 L748 594 L719 642 L791 683 H970 Z');
  const emptyTrunk = path('M706 745 C745 755 761 704 808 706 C849 703 861 747 850 778 C824 809 783 851 706 833 Z');
  const curledTip = path('M690 737 C702 761 717 776 738 770 C760 768 774 741 790 726 C807 708 826 716 836 732 C848 749 838 762 829 765 C821 768 812 760 808 767 C795 800 768 824 731 829 C714 833 704 832 690 828 Z');
  const headCut = path('M0 0 H1159 V630 H776 C754 637 733 650 710 662 L716 691 L701 696 C696 718 696 742 704 759 C715 774 738 770 756 762 L790 791 C782 811 754 826 729 831 C700 842 664 832 644 821 C608 800 585 764 568 718 L559 690 L535 703 L529 681 C484 675 448 653 421 622 L389 612 L355 641 H0 Z');
  const neckJoin = path('M385 604 H815 V850 H385 Z');
  const neutralHand = path('M309 898 L360 847 L368 713 L431 726 L520 886 L566 940 L567 1021 L304 1021 Z');
  const writingHand = path('M381 750 Q385 737 399 740 Q410 743 415 757 L481 875 C499 882 511 899 519 916 Q527 934 520 952 L535 998 L530 1001 L507 976 Q504 971 496 973 Q483 995 467 993 C441 1006 401 1002 377 995 Q351 995 329 982 C317 954 325 918 347 897 Q361 870 412 869 L445 876 Z');

  function makeCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas.getContext('2d');
  }

  function sprite(source, [x, y, width, height], mask) {
    const ctx = makeCanvas(width, height);
    ctx.translate(-x, -y);
    ctx.clip(mask);
    ctx.drawImage(source, 0, 0);
    return { canvas: ctx.canvas, x, y };
  }

  function replaceWithPlate(ctx, plate, mask) {
    ctx.save();
    ctx.clip(mask);
    ctx.clearRect(0, 0, artWidth, artHeight);
    ctx.drawImage(plate, 0, 0);
    ctx.restore();
  }

  function blendHandPlate(ctx, plate) {
    const patch = makeCanvas(306, 342);
    patch.translate(-281, -700);
    patch.filter = 'blur(5px)';
    patch.fill(neutralHand);
    patch.filter = 'none';
    patch.globalCompositeOperation = 'source-in';
    patch.drawImage(plate, 0, 0);
    ctx.drawImage(patch.canvas, 281, 700);
  }

  function eyeFrame(atlas, source, [x, y, width, height]) {
    const ctx = makeCanvas(width, height);
    ctx.drawImage(atlas, ...source, 0, 0, width, height);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.translate(width / 2, height / 2);
    ctx.scale(width / 2, height / 2);
    const feather = ctx.createRadialGradient(0, 0, .63, 0, 0, 1);
    feather.addColorStop(0, '#fff');
    feather.addColorStop(1, '#fff0');
    ctx.fillStyle = feather;
    ctx.fillRect(-1, -1, 2, 2);
    return { canvas: ctx.canvas, x, y };
  }

  function createLayers(plate, atlas) {
    const upper = makeCanvas(artWidth, 1072);
    upper.drawImage(figure, 0, 0);
    upper.save();
    upper.globalCompositeOperation = 'destination-out';
    upper.fill(leftEarCut);
    upper.fill(rightEarCut);
    upper.restore();
    replaceWithPlate(upper, plate, emptyTrunk);
    blendHandPlate(upper, plate);

    const head = sprite(upper.canvas, [0, 0, artWidth, 850], headCut);
    const torso = makeCanvas(artWidth, upper.canvas.height);
    torso.drawImage(upper.canvas, 0, 0);
    torso.globalCompositeOperation = 'destination-out';
    torso.fill(headCut);

    const lower = makeCanvas(artWidth, artHeight - 1038);
    lower.drawImage(figure, 0, -1038);
    lower.globalCompositeOperation = 'destination-in';
    const join = lower.createLinearGradient(0, 0, 0, 28);
    join.addColorStop(0, '#fff0');
    join.addColorStop(1, '#fff');
    lower.fillStyle = join;
    lower.fillRect(0, 0, artWidth, lower.canvas.height);

    return {
      upper: upper.canvas,
      head: head.canvas,
      torso: torso.canvas,
      lower: lower.canvas,
      leftEar: sprite(figure, [102, 358, 332, 328], leftEarSprite),
      rightEar: sprite(figure, [718, 391, 255, 296], rightEarSprite),
      trunk: sprite(figure, [687, 709, 165, 129], curledTip),
      hand: sprite(figure, [310, 730, 230, 279], writingHand),
      blink: [
        eyeFrame(atlas, [885, 317, 89, 72], [466, 488, 118, 97]),
        eyeFrame(atlas, [1034, 317, 83, 76], [678, 486, 104, 100]),
      ],
      gaze: [
        eyeFrame(atlas, [242, 919, 86, 78], [465, 481, 117, 103]),
        eyeFrame(atlas, [394, 920, 81, 77], [677, 482, 103, 101]),
      ],
    };
  }

  function renderSprite({ canvas, x, y }, pivot, angle) {
    drawing.save();
    drawing.translate(...pivot);
    drawing.rotate(angle);
    drawing.drawImage(canvas, x - pivot[0], y - pivot[1]);
    drawing.restore();
  }

  function renderEyes(frames, amount) {
    if (amount < .01) return;
    drawing.save();
    drawing.globalAlpha = ease(amount);
    for (const { canvas, x, y } of frames) drawing.drawImage(canvas, x, y);
    drawing.restore();
  }

  function renderWriting({ ink, inkOpacity, hand }) {
    const { segment, tip, transform } = penPose(ink, hand);
    if (ink > 0 && inkOpacity > 0) {
      drawing.save();
      drawing.globalAlpha = inkOpacity;
      drawing.beginPath();
      drawing.moveTo(...inkStart);
      for (let i = 1; i <= segment; i++) {
        drawing.lineTo(inkStart[0] + strokes[i][0], inkStart[1] + strokes[i][1]);
      }
      drawing.lineTo(...tip);
      drawing.strokeStyle = '#59362b';
      drawing.lineCap = 'round';
      drawing.lineJoin = 'round';
      drawing.lineWidth = 3.7;
      drawing.stroke();
      drawing.restore();
    }
    const item = layers.hand;
    drawing.save();
    drawing.translate(transform.x, transform.y);
    drawing.rotate(transform.angle);
    drawing.drawImage(item.canvas, item.x, item.y);
    drawing.restore();
  }

  let layers;
  let frame = 0;
  let elapsed = 0;
  let started = 0;
  let greetingAt = null;
  let previousView = planner.dataset.view;
  let pointerOver = false;
  let pointerGazeFrom = 0;
  let pointerChangedAt = 0;

  function pointerGazeAt(now) {
    const duration = pointerOver ? 180 : 260;
    return mix(pointerGazeFrom, Number(pointerOver), ease((now - pointerChangedAt) / duration));
  }

  function setPointerLook(active) {
    if (active === pointerOver) return;
    const now = performance.now();
    pointerGazeFrom = pointerGazeAt(now);
    pointerChangedAt = now;
    pointerOver = active;
  }

  button.addEventListener('pointerenter', event => {
    if (event.pointerType === 'mouse') setPointerLook(true);
  });
  button.addEventListener('pointerleave', event => {
    if (event.pointerType === 'mouse') setPointerLook(false);
  });
  window.addEventListener('blur', () => setPointerLook(false));

  function render(seconds, greetingSeconds = null, pointerGaze = 0) {
    const pose = poseAt(seconds, greetingSeconds, pointerGaze);
    const raised = pose.headLift > .15;
    drawing.setTransform(scale, 0, 0, scale, 0, 0);
    drawing.clearRect(0, 0, artWidth, artHeight);
    drawing.save();
    drawing.translate(0, -4.8 * pose.breath);
    drawing.save();
    drawing.translate(0, -pose.headLift);
    renderSprite(layers.leftEar, [394, 553], .105 * pose.leftEar);
    renderSprite(layers.rightEar, [754, 558], -.115 * pose.rightEar);
    drawing.restore();
    if (raised) {
      // Underlap the neck with the adjacent torso texture so the joint stays covered.
      drawing.save();
      drawing.clip(neckJoin);
      drawing.clip(headCut);
      drawing.drawImage(layers.torso, 0, -pose.headLift);
      drawing.restore();
      drawing.drawImage(layers.torso, 0, 0);
    }
    drawing.save();
    drawing.translate(0, -pose.headLift);
    drawing.drawImage(raised ? layers.head : layers.upper, 0, 0);
    renderSprite(layers.trunk, [705, 797], -.17 * pose.trunk);
    renderEyes(layers.gaze, pose.gaze);
    renderEyes(layers.blink, pose.blink);
    drawing.restore();
    renderWriting(pose);
    drawing.restore();
    drawing.drawImage(layers.lower, 0, 1038);
  }

  function tick(now) {
    if (greetingAt !== null) {
      const seconds = (now - greetingAt) / 1000;
      render(elapsed, seconds, pointerGazeAt(now));
      if (seconds >= .34) return;
    } else {
      elapsed = (now - started) / 1000;
      render(elapsed, null, pointerGazeAt(now));
    }
    frame = requestAnimationFrame(tick);
  }

  function updatePlayback() {
    cancelAnimationFrame(frame);
    const view = planner.dataset.view;
    const justOpened = previousView !== 'menu' && view === 'menu';
    previousView = view;
    if (view === 'menu' || document.hidden) setPointerLook(false);
    if (reduceMotion.matches || document.hidden) {
      greetingAt = null;
      render(reduceMotion.matches ? 0 : elapsed);
    } else if (view !== 'menu') {
      greetingAt = null;
      started = performance.now() - elapsed * 1000;
      frame = requestAnimationFrame(tick);
    } else if (justOpened) {
      greetingAt = performance.now();
      frame = requestAnimationFrame(tick);
    }
  }

  async function loadArt(src) {
    const image = new Image();
    image.src = src;
    await image.decode();
    return image;
  }

  Promise.all([figure.decode(), loadArt('ganesha-underpainting.png'), loadArt('ganesha-expressions.png')])
    .then(([, plate, atlas]) => {
      layers = createLayers(plate, atlas);
      render(0);
      portrait.hidden = false;
      figure.hidden = true;
      reduceMotion.addEventListener('change', updatePlayback);
      document.addEventListener('visibilitychange', updatePlayback);
      new MutationObserver(updatePlayback).observe(planner, {
        attributes: true,
        attributeFilter: ['data-view'],
      });
      updatePlayback();
    }).catch(() => {
      portrait.hidden = true;
      figure.hidden = false;
    });
})();
