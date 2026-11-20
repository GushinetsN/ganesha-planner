(() => {
  const tau = 2 * Math.PI;
  const gold = '#a28358';
  const paleGold = '#cbb38b';
  const cream = '#fff4d9';
  const jade = '#688b76';

  function canvasFor(selector) {
    const canvas = document.querySelector(selector);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.setTransform(canvas.width / 512, 0, 0, canvas.height / 512, canvas.width / 2, canvas.height / 2);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
    }
    return ctx;
  }

  function circle(ctx, radius, { fill, stroke, width = 1 } = {}) {
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, tau);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.lineWidth = width;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }

  function eachRay(ctx, count, offset, draw) {
    for (let index = 0; index < count; index++) {
      ctx.save();
      ctx.rotate((index + offset) * tau / count);
      draw(index);
      ctx.restore();
    }
  }

  function leaf(ctx, root, tip, spread, fill, stroke = gold, width = 1) {
    const depth = tip - root;
    ctx.beginPath();
    ctx.moveTo(0, -root);
    ctx.bezierCurveTo(-spread * .9, -root - depth * .2, -spread, -tip + depth * .32, 0, -tip);
    ctx.bezierCurveTo(spread, -tip + depth * .32, spread * .9, -root - depth * .2, 0, -root);
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function engrave(ctx, root, tip, spread) {
    const depth = tip - root;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.scale(side, 1);
      ctx.beginPath();
      ctx.moveTo(0, -root - 5);
      ctx.bezierCurveTo(spread * .65, -root - depth * .35, spread * .65, -root - depth * .65, spread * .29, -root - depth * .69);
      ctx.bezierCurveTo(-spread * .01, -root - depth * .75, -spread * .05, -root - depth * .5, spread * .23, -root - depth * .55);
      ctx.strokeStyle = gold;
      ctx.lineWidth = .85;
      ctx.stroke();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.moveTo(0, -root - 7);
    ctx.quadraticCurveTo(0, -root - depth * .68, 0, -tip + 7);
    ctx.strokeStyle = paleGold;
    ctx.lineWidth = .72;
    ctx.stroke();
  }

  function bead(ctx, y, radius, fill) {
    ctx.beginPath();
    ctx.arc(0, -y, radius, 0, tau);
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function star(ctx, points, outer, inner, fill, line = gold) {
    ctx.beginPath();
    for (let index = 0; index < 2 * points; index++) {
      const radius = index % 2 === 0 ? outer : inner;
      const angle = Math.PI * index / points - Math.PI / 2;
      const x = radius * Math.cos(angle);
      const y = radius * Math.sin(angle);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.strokeStyle = line;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function inscriptionSpace(ctx) {
    ctx.translate(0, -156.7);
    ctx.save();
    ctx.scale(1.08, 1);
    ctx.globalCompositeOperation = 'destination-out';
    const fade = ctx.createRadialGradient(0, 0, 20, 0, 0, 59);
    fade.addColorStop(0, '#000');
    fade.addColorStop(.44, '#000f');
    fade.addColorStop(.74, '#0008');
    fade.addColorStop(1, '#0000');
    ctx.fillStyle = fade;
    ctx.fillRect(-59, -59, 118, 118);
    ctx.restore();
    ctx.lineWidth = .9;
    ctx.strokeStyle = '#a88b600d';
    ctx.stroke(new Path2D('M-35 -34 Q-16 -38 0 -50 Q16 -38 35 -34 M-34 34 Q-16 38 0 49 Q16 38 34 34'));
  }

  function rim(ctx, slots = []) {
    const petals = 16;
    eachRay(ctx, petals, .5, index => {
      const pearl = index % 2 === 0 ? '#dce1c830' : '#eadfc02b';
      leaf(ctx, 144, 230, 26, pearl, paleGold, .95);
      leaf(ctx, 149, 222, 19, null, gold, .67);
      leaf(ctx, 162, 211, 10, '#fcf1d32e', paleGold, .67);
      bead(ctx, 218, 1.35, paleGold);
    });
    eachRay(ctx, petals, 0, index => {
      const enamel = ctx.createLinearGradient(0, -246, 0, -157);
      enamel.addColorStop(0, '#fff4d979');
      const tinted = index % 4 === 0;
      enamel.addColorStop(.56, tinted ? '#eed4b438' : '#f1e5c544');
      enamel.addColorStop(1, '#beaa7515');
      leaf(ctx, 147, 249, 34, enamel, gold, 1.12);
      leaf(ctx, 153, 242, 29, null, '#fff7dbb5', 1.4);
      leaf(ctx, 160, 233, 22, null, gold, .75);
      engrave(ctx, 160, 233, 23);
      bead(ctx, 238, 1.6, gold);
    });

    const paper = ctx.createRadialGradient(-32, -42, 60, 0, 0, 185);
    paper.addColorStop(0, '#faf0d534');
    paper.addColorStop(.8, '#eee1b948');
    paper.addColorStop(1, '#c7ae7d3d');
    circle(ctx, 176, { fill: paper, stroke: gold, width: 1.12 });
    circle(ctx, 173.2, { stroke: '#fff8deae', width: 1.4 });
    circle(ctx, 168, { stroke: gold, width: .77 });
    circle(ctx, 151, { stroke: '#b49770', width: .85 });
    circle(ctx, 146, { stroke: '#fcf2d2a8', width: 1.1 });
    eachRay(ctx, 96, .5, i => {
      bead(ctx, 163, i % 2 === 0 ? 1.65 : .95, i % 2 === 0 ? gold : '#f6edcc');
    });

    eachRay(ctx, petals, .5, () => {
      leaf(ctx, 91, 144, 18, '#e5dfbd23', paleGold, .88);
      leaf(ctx, 95, 139, 10, null, gold, .7);
      bead(ctx, 132, 1.05, gold);
    });
    for (const angle of slots) {
      ctx.save();
      ctx.rotate(angle * tau / 360);
      inscriptionSpace(ctx);
      ctx.restore();
    }
  }

  function inlay(ctx) {
    ctx.scale(.88, .88);
    ctx.save();
    ctx.shadowColor = '#5d633a25';
    ctx.shadowOffsetY = 2;
    ctx.shadowBlur = 4;
    const wash = ctx.createRadialGradient(-37, -44, 5, 0, 0, 127);
    wash.addColorStop(0, '#f6ecd162');
    wash.addColorStop(.63, '#dce2c571');
    wash.addColorStop(1, '#b3bb9a70');
    circle(ctx, 120, { fill: wash, stroke: gold, width: 1.1 });
    ctx.restore();
    circle(ctx, 115.8, { stroke: '#fcf3d5', width: 2.2 });
    circle(ctx, 111, { stroke: gold, width: .9 });
    eachRay(ctx, 56, 0, () => bead(ctx, 106, 1.45, '#a18050'));
    circle(ctx, 101, { stroke: paleGold });
    star(ctx, 16, 99, 88, '#f1e3bc72');
    star(ctx, 16, 93, 82, null, '#fcf1ce');
    eachRay(ctx, 12, .5, () => {
      leaf(ctx, 44, 87, 24, '#abc0a678', gold, .8);
      leaf(ctx, 50, 80, 15, '#e0e3c355', '#86926b', .7);
      bead(ctx, 73, 1.4, gold);
    });
    eachRay(ctx, 12, 0, index => {
      leaf(ctx, 40, 94, 19, index % 3 === 0 ? '#f4ddbd85' : '#f7e9c871', gold, .84);
      leaf(ctx, 50, 84, 10, null, paleGold, .9);
      bead(ctx, 85, 1.4, gold);
    });
  }

  function heart(ctx) {
    ctx.scale(.83, .83);
    ctx.save();
    ctx.shadowBlur = 4;
    ctx.shadowColor = '#594a2d36';
    ctx.shadowOffsetY = 2;
    circle(ctx, 49, { fill: '#c79c65', stroke: gold });
    ctx.restore();
    const center = ctx.createRadialGradient(-13, -18, 4, 0, 0, 45);
    center.addColorStop(0, '#fff5d6');
    center.addColorStop(.78, '#f1d8a2');
    center.addColorStop(1, '#c59c59');
    circle(ctx, 45, { fill: center, stroke: '#fff0ce', width: 2 });
    circle(ctx, 41, { stroke: gold, width: 1.2 });
    eachRay(ctx, 24, 0, () => bead(ctx, 37.6, 1.2, '#9b723d'));
    star(ctx, 8, 34, 23, '#71947c', '#52765f');
    star(ctx, 8, 27, 19, '#e5dbc0', '#f9efce');
    eachRay(ctx, 8, 0, () => leaf(ctx, 4, 22, 8, cream, gold, .8));
    circle(ctx, 7, { fill: jade, stroke: '#f7e5ab', width: 1.3 });
    circle(ctx, 3, { fill: cream });
  }

  const backdropContext = canvasFor('.ganesha-backdrop');
  const rimContext = canvasFor('.mandala-rim');
  const inlayContext = canvasFor('.mandala-inlay');
  const heartContext = canvasFor('.mandala-heart');
  if (backdropContext) {
    rim(backdropContext);
    backdropContext.save();
    inlay(backdropContext);
    backdropContext.restore();
    heart(backdropContext);
  }
  if (rimContext) rim(rimContext, Array.from(document.querySelectorAll('.mandala-slot'), slot => Number(slot.dataset.angle)));
  if (inlayContext) inlay(inlayContext);
  if (heartContext) heart(heartContext);
})();
