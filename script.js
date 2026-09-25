(() => {
  const canvas = document.getElementById('kaleidoscope');
  const video = document.getElementById('camera');
  const ctx = canvas.getContext('2d', { alpha: false });
  const texture = document.createElement('canvas');
  const ink = texture.getContext('2d');
  texture.width = texture.height = 512;
  const colors = ['#f05492', '#e8ad59', '#5ad6ce', '#7f89ec', '#b777de'];
  let seed = 48391;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const state = { x: 0, y: 0, zoom: 1 };
  let width, height, resolution, side, triangleHeight;
  let pointerUntil = 0, lastFrame = -1, lastDetection = 0;
  let landmarker, stream, cameraReady = false;

  function paintTexture() {
    const background = ink.createLinearGradient(0, 0, 512, 512);
    background.addColorStop(0, '#17152e');
    background.addColorStop(.5, '#111d32');
    background.addColorStop(1, '#271334');
    ink.fillStyle = background;
    ink.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 38; i++) {
      const x = random() * 512, y = random() * 512;
      const radius = 18 + random() * 58;
      const color = colors[i % colors.length];
      const glow = ink.createRadialGradient(x, y, 0, x, y, radius * 2);
      glow.addColorStop(0, `${color}bb`);
      glow.addColorStop(.3, `${color}55`);
      glow.addColorStop(1, `${color}00`);
      ink.fillStyle = glow;
      ink.beginPath();
      ink.arc(x, y, radius * 2, 0, Math.PI * 2);
      ink.fill();
      ink.save();
      ink.translate(x, y);
      ink.rotate(random() * Math.PI * 2);
      ink.strokeStyle = `${color}cc`;
      ink.lineWidth = 1.5 + random() * 2;
      ink.beginPath();
      ink.ellipse(0, 0, radius * (.55 + random() * .55), radius * (.16 + random() * .18), 0, 0, Math.PI * 2);
      ink.stroke();
      ink.restore();
    }
    for (let i = 0; i < 85; i++) {
      ink.fillStyle = `${colors[i % colors.length]}88`;
      ink.beginPath();
      ink.arc(random() * 512, random() * 512, i % 7 === 0 ? 2.2 : .9, 0, Math.PI * 2);
      ink.fill();
    }
  }

  function vertex(row, column) {
    return {
      x: (column + (row & 1) * .5) * side - side * .23,
      y: row * triangleHeight - triangleHeight * .3,
      slot: ((column + (row & 1) * 2) % 3 + 3) % 3,
    };
  }

  function triangle(p, q, r, crop) {
    const corners = [];
    for (const point of [p, q, r]) corners[point.slot] = point;
    const [a, b, c] = corners;
    const centerX = (p.x + q.x + r.x) / 3;
    const centerY = (p.y + q.y + r.y) / 3;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(centerX + (p.x - centerX) * 1.006, centerY + (p.y - centerY) * 1.006);
    ctx.lineTo(centerX + (q.x - centerX) * 1.006, centerY + (q.y - centerY) * 1.006);
    ctx.lineTo(centerX + (r.x - centerX) * 1.006, centerY + (r.y - centerY) * 1.006);
    ctx.closePath();
    ctx.clip();
    const ma = (b.x - a.x) / side, mb = (b.y - a.y) / side;
    const mc = (c.x - a.x - ma * side / 2) / triangleHeight;
    const md = (c.y - a.y - mb * side / 2) / triangleHeight;
    ctx.transform(ma, mb, mc, md, a.x, a.y);
    ctx.drawImage(texture, crop.x - 2, crop.y - 2, crop.w + 4, crop.h + 4, -2, -2, side + 4, triangleHeight + 4);
    ctx.restore();
  }

  function render() {
    ctx.setTransform(resolution, 0, 0, resolution, 0, 0);
    ctx.fillStyle = '#11182c';
    ctx.fillRect(0, 0, width, height);
    const w = 250 / state.zoom, h = w * Math.sqrt(3) / 2;
    const crop = {
      x: Math.max(0, Math.min(512 - w, (512 - w) / 2 + state.x * 105)),
      y: Math.max(0, Math.min(512 - h, (512 - h) / 2 + state.y * 105)),
      w, h,
    };
    const rows = Math.ceil(height / triangleHeight) + 3;
    const columns = Math.ceil(width / side) + 3;
    for (let row = -1; row < rows; row++) {
      for (let column = -1; column < columns; column++) {
        const a = vertex(row, column), b = vertex(row, column + 1);
        const c = vertex(row + 1, column), d = vertex(row + 1, column + 1);
        if (row & 1) {
          triangle(a, b, d, crop);
          triangle(a, c, d, crop);
        } else {
          triangle(a, b, c, crop);
          triangle(b, c, d, crop);
        }
      }
    }
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    resolution = Math.min(1, Math.sqrt(1100000 / (width * height)));
    canvas.width = Math.max(1, Math.round(width * resolution));
    canvas.height = Math.max(1, Math.round(height * resolution));
    side = Math.max(160, Math.min(240, width * .22));
    triangleHeight = side * Math.sqrt(3) / 2;
    render();
  }

  function movePointer(x, y) {
    pointerUntil = performance.now() + 3000;
    state.x = (x / width - .5) * 2;
    state.y = (y / height - .5) * 2;
    render();
  }
  canvas.addEventListener('pointermove', event => movePointer(event.clientX, event.clientY));
  canvas.addEventListener('pointerdown', event => movePointer(event.clientX, event.clientY));
  window.addEventListener('resize', resize);
  window.addEventListener('pagehide', () => stream?.getTracks().forEach(track => track.stop()));

  function trackHands(now) {
    if (!cameraReady) return;
    requestAnimationFrame(trackHands);
    if (now - lastDetection < 90 || video.readyState < 2 || video.currentTime === lastFrame) return;
    lastDetection = now;
    lastFrame = video.currentTime;
    try {
      const hands = landmarker.detectForVideo(video, now).landmarks;
      if (!hands.length || now < pointerUntil) return;
      const tip = hands[0][8], thumb = hands[0][4];
      const next = {
        x: (0.5 - tip.x) * 2,
        y: (tip.y - .5) * 2,
        zoom: 1 + Math.min(Math.hypot(tip.x - thumb.x, tip.y - thumb.y), .45) * .45,
      };
      let changed = false;
      for (const key of Object.keys(next)) {
        if (Math.abs(next[key] - state[key]) > (key === 'zoom' ? .025 : .035)) {
          state[key] += (next[key] - state[key]) * .55;
          changed = true;
        }
      }
      if (changed) render();
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
        runningMode: 'VIDEO', numHands: 1, minTrackingConfidence: .5,
      };
      try {
        landmarker = await HandLandmarker.createFromOptions(vision, options);
      } catch (_) {
        options.baseOptions.delegate = 'CPU';
        landmarker = await HandLandmarker.createFromOptions(vision, options);
      }
      cameraReady = true;
      requestAnimationFrame(trackHands);
    } catch (_) {
      stream?.getTracks().forEach(track => track.stop());
    }
  }

  paintTexture();
  resize();
  startCamera();
})();
