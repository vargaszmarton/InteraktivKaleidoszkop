(() => {
  const canvas = document.getElementById('kaleidoscope');
  const video = document.getElementById('camera');
  const ctx = canvas.getContext('2d', { alpha: false });
  const source = document.createElement('canvas');
  const src = source.getContext('2d');
  source.width = source.height = 900;

  const TAU = Math.PI * 2;
  const segments = 16;
  const sector = TAU / segments;
  const hues = [332, 284, 205, 178, 43, 16];
  const motes = Array.from({ length: 34 }, (_, i) => ({
    phase: i * 2.39996,
    orbit: 72 + ((i * 137) % 310),
    size: 20 + ((i * 53) % 70),
    speed: .13 + ((i * 17) % 13) / 100,
    hue: hues[i % hues.length],
  }));

  let width = 0;
  let height = 0;
  let scale = 1;
  let pointerUntil = 0;
  let lastFrame = -1;
  let landmarker;
  let stream;
  let cameraReady = false;
  const target = { x: 0, y: 0, twist: 0, zoom: 1 };
  const motion = { x: 0, y: 0, twist: 0, zoom: 1 };

  function resize() {
    scale = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
  }

  function movePointer(clientX, clientY) {
    pointerUntil = performance.now() + 2200;
    target.x = (clientX / width - .5) * 2;
    target.y = (clientY / height - .5) * 2;
    target.twist = target.x * .45;
    target.zoom = 1 + Math.abs(target.y) * .18;
  }

  canvas.addEventListener('pointermove', event => movePointer(event.clientX, event.clientY));
  canvas.addEventListener('pointerdown', event => movePointer(event.clientX, event.clientY));
  window.addEventListener('resize', resize);
  window.addEventListener('pagehide', () => stream?.getTracks().forEach(track => track.stop()));
  resize();

  function drawSource(time) {
    const s = source.width;
    const wash = src.createRadialGradient(s * .46, s * .43, 20, s * .5, s * .5, s * .72);
    wash.addColorStop(0, '#26133d');
    wash.addColorStop(.48, '#101537');
    wash.addColorStop(1, '#08091d');
    src.fillStyle = wash;
    src.fillRect(0, 0, s, s);
    src.save();
    src.translate(s / 2, s / 2);
    src.globalCompositeOperation = 'screen';

    for (const mote of motes) {
      const a = mote.phase + time * mote.speed;
      const x = Math.cos(a) * mote.orbit + Math.sin(time * .23 + mote.phase) * 42;
      const y = Math.sin(a * 1.37) * mote.orbit + Math.cos(time * .17 + mote.phase) * 42;
      const radius = mote.size * (1 + Math.sin(time * .9 + mote.phase) * .18);
      const glow = src.createRadialGradient(x, y, 1, x, y, radius * 2.5);
      glow.addColorStop(0, `hsla(${mote.hue}, 100%, 70%, .7)`);
      glow.addColorStop(.24, `hsla(${mote.hue}, 96%, 50%, .23)`);
      glow.addColorStop(1, `hsla(${mote.hue}, 100%, 45%, 0)`);
      src.fillStyle = glow;
      src.beginPath();
      src.arc(x, y, radius * 2.5, 0, TAU);
      src.fill();
      src.save();
      src.translate(x, y);
      src.rotate(a * 2);
      src.strokeStyle = `hsla(${mote.hue}, 100%, 72%, .78)`;
      src.lineWidth = 1.4;
      src.beginPath();
      src.ellipse(0, 0, radius * 1.35, radius * .35, 0, 0, TAU);
      src.stroke();
      src.restore();
    }

    for (let i = 0; i < 42; i++) {
      const a = i * 2.39996 + time * .05;
      const r = 30 + (i * 97) % 410;
      src.fillStyle = `hsla(${hues[i % hues.length]}, 100%, 85%, ${.26 + (i % 4) * .13})`;
      src.beginPath();
      src.arc(Math.cos(a) * r, Math.sin(a) * r, i % 7 === 0 ? 2.5 : 1.2, 0, TAU);
      src.fill();
    }
    src.restore();
  }

  function draw(now) {
    const time = now * .001;
    detectHand(now);
    for (const key of ['x', 'y', 'twist', 'zoom']) motion[key] += (target[key] - motion[key]) * .065;
    drawSource(time);

    const radius = Math.hypot(width, height) * .64 + 8;
    const side = source.width * Math.max(1, radius / 420) * motion.zoom;
    ctx.fillStyle = '#09051a';
    ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate(motion.twist + time * .018);
    for (let i = 0; i < segments; i++) {
      ctx.save();
      ctx.rotate(i * sector);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, -sector / 2 - .002, sector / 2 + .002);
      ctx.closePath();
      ctx.clip();
      if (i % 2) ctx.scale(1, -1);
      const driftX = motion.x * 170 + Math.sin(time * .16) * 44;
      const driftY = motion.y * 170 + Math.cos(time * .13) * 44;
      ctx.drawImage(source, -side / 2 + driftX, -side / 2 + driftY, side, side);
      ctx.restore();
    }
    ctx.restore();

    const vignette = ctx.createRadialGradient(width / 2, height / 2, radius * .1, width / 2, height / 2, radius * 1.1);
    vignette.addColorStop(0, 'rgba(4, 3, 16, 0)');
    vignette.addColorStop(.72, 'rgba(4, 3, 16, .09)');
    vignette.addColorStop(1, 'rgba(4, 3, 16, .7)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
    requestAnimationFrame(draw);
  }

  function detectHand(now) {
    if (!cameraReady || !landmarker || video.readyState < 2 || video.currentTime === lastFrame) return;
    lastFrame = video.currentTime;
    try {
      const hands = landmarker.detectForVideo(video, now).landmarks;
      if (!hands.length || now < pointerUntil) return;
      const hand = hands[0];
      const tip = hand[8];
      const thumb = hand[4];
      const wrist = hand[0];
      target.x = (0.5 - tip.x) * 2; // Mirror the front camera naturally.
      target.y = (tip.y - .5) * 2;
      target.twist = Math.atan2(tip.y - wrist.y, tip.x - wrist.x) * .28;
      target.zoom = 1 + Math.min(Math.hypot(tip.x - thumb.x, tip.y - thumb.y), .45) * .65;
    } catch (_) {
      cameraReady = false;
    }
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) return;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      video.srcObject = stream;
      await video.play();

      const { FilesetResolver, HandLandmarker } = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/+esm');
      const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm');
      const options = {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: 1,
        minTrackingConfidence: .5,
      };
      try {
        landmarker = await HandLandmarker.createFromOptions(vision, options);
      } catch (_) {
        options.baseOptions.delegate = 'CPU';
        landmarker = await HandLandmarker.createFromOptions(vision, options);
      }
      cameraReady = true;
    } catch (_) {
      // Mouse and touch remain available if permission, camera, or model loading fails.
      stream?.getTracks().forEach(track => track.stop());
    }
  }

  requestAnimationFrame(draw);
  startCamera();
})();
