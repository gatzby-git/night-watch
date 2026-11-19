(() => {
  "use strict";

  const FILES = {
    empty: "assets/room_empty.jpg",
    door: "assets/room_door.jpg",
    bed: "assets/room_bed.jpg",
    face: "assets/face_close.jpg",
    lump: "assets/room_lump.jpg",
  };

  const T = {
    creak: 18,
    hallStep: 36,
    shadow: 50,
    staticBurst: 68,
    steps: 82,
    gaze: 84,
    whispers: 104,
    eyes: 118,
    blink: 136,
    quiet: 160,
    warn: 214,
    black: 228,
    bed: 240,
    lean: 250,
    cam: 266,
    ghost: 268.4,
    scare: 274,
    down: 276.1,
    end: 276.7,
  };

  const params = new URLSearchParams(location.search);
  const SPEED = Math.max(1, Number(params.get("fast")) || 1);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const app = document.getElementById("app");
  const canvas = document.getElementById("view");
  const hud = document.getElementById("hud");
  const entry = document.getElementById("entry");
  const startBtn = document.getElementById("start");
  const replayBtn = document.getElementById("replay");
  const sigEl = document.getElementById("sig");
  const battFill = document.getElementById("battfill");
  const bpct = document.getElementById("bpct");
  const camLabel = document.getElementById("camlabel");
  const meterEl = document.getElementById("meter");
  const meterBar = meterEl.querySelector("i");
  const shushEl = document.getElementById("shush");
  const nosigEl = document.getElementById("nosig");
  const stampEl = document.getElementById("stamp");
  const videoEl = document.getElementById("selfcam");
  const hapLabel = document.querySelector("#hapwrap label");

  const media = {};
  let phase = "entry";
  let started = false;
  let paused = false;
  let clock = 0;
  let bootT = 0;
  let glitchImpulse = 0;
  let bars = 3;
  let battery = 0.46;
  let realBattery = false;
  let lastStamp = "";
  let lastCam = "镜头 1";
  let meterOn = false;
  let nosigOn = false;
  let shushOn = false;
  let sceneOverride = null;
  let scene = "empty";
  let camReady = false;
  let stream = null;
  let micSmooth = 0;
  let noiseBurst = 0;
  let analyser = null;
  let td = null;
  let ctx = null;
  let world = null;
  let intimate = null;
  let master = null;
  let droneA = null;
  let droneB = null;
  let droneGain = null;
  let staticGain = null;
  let noiseBuf = null;
  let sentinel = null;
  let orientListening = false;
  let gyroSeen = false;
  const gyro = { x: 0, y: 0 };
  const manual = { x: 0, y: 0 };
  const pan = { x: 0, y: 0 };
  let drag = null;
  const fired = new Set();
  const trace = [];
  let glError = null;
  let mode = "none";
  let gl = null;
  let prog = null;
  let loc = {};
  let ctx2 = null;
  let grainCanvas = null;
  const glTex = {};
  let drewOnce = false;

  const view = {
    scene: "empty",
    power: 0,
    brightness: 0,
    grain: 0.06,
    glitch: 0,
    flicker: 0,
    aber: 0.001,
    zoom: 1.14,
    wardrobe: 0,
    shadow: 0,
    eyes: 0,
    ghost: 0,
    mirror: 0,
    lump: 0,
    panX: 0,
    panY: 0,
    vignette: 0.85,
  };

  function freshMem() {
    return {
      figure: false,
      appearances: 0,
      away: 0,
      stare: 0,
      blinkUntil: 0,
      eyesSeen: false,
      eyesUntil: 0,
      shadowDone: false,
      shadowT: 0,
      secondBreath: 0,
      shush: false,
      shushUntil: 0,
      reacts: 0,
      nextReact: 0,
      nextBreath: 2.6,
      nextOther: 8,
      nextStep: T.steps,
      nextWhisper: T.whispers,
      nextHeart: T.black,
      bucket: -1,
      zoomPunch: 0,
      shake: 0,
      cutFlash: 0,
      camTried: false,
      endHearts: 0,
      angle: Math.random() * Math.PI * 2,
    };
  }
  let mem = freshMem();

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }
  function smoothstep(t) {
    const x = clamp(t, 0, 1);
    return x * x * (3 - 2 * x);
  }
  function h1(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }
  function spike(v) {
    glitchImpulse = Math.max(glitchImpulse, v);
  }
  function pad(n) {
    return String(n).padStart(2, "0");
  }
  function formatStamp(d) {
    return (
      d.getFullYear() +
      "-" +
      pad(d.getMonth() + 1) +
      "-" +
      pad(d.getDate()) +
      " " +
      pad(d.getHours()) +
      ":" +
      pad(d.getMinutes()) +
      ":" +
      pad(d.getSeconds())
    );
  }

  function paintScene(kind) {
    const w = 720;
    const h = 1280;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d");
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#101610");
    bg.addColorStop(0.45, "#243024");
    bg.addColorStop(1, "#070907");
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);

    g.fillStyle = "#121812";
    g.beginPath();
    g.moveTo(0, 790);
    g.lineTo(w, 760);
    g.lineTo(w, h);
    g.lineTo(0, h);
    g.fill();

    for (let i = 0; i < 80; i++) {
      g.fillStyle = "rgba(0,0,0," + (0.04 + (i % 5) * 0.015) + ")";
      g.fillRect((i * 97) % w, 180 + ((i * 53) % 520), 2, 40 + (i % 17));
    }

    g.fillStyle = "#1a1612";
    g.fillRect(28, 300, 230, 520);
    g.fillStyle = "#0c0b09";
    g.fillRect(36, 318, 100, 486);
    g.fillRect(148, 318, 100, 486);
    g.fillStyle = "#050505";
    g.fillRect(128, 326, 16, 470);

    g.fillStyle = "#231c16";
    g.fillRect(300, 250, 196, 560);
    g.fillStyle = "#000";
    g.fillRect(322, 272, 130, 516);
    g.fillStyle = "#2a241c";
    g.beginPath();
    g.moveTo(452, 272);
    g.lineTo(560, 300);
    g.lineTo(548, 760);
    g.lineTo(452, 788);
    g.fill();

    g.fillStyle = "#1c1814";
    g.fillRect(575, 560, 16, 150);
    g.fillRect(548, 700, 90, 10);
    g.fillStyle = "#2a3330";
    g.beginPath();
    g.ellipse(590, 640, 36, 22, -0.4, 0, Math.PI * 2);
    g.fill();

    g.fillStyle = "#141814";
    for (let i = 0; i < 8; i++) {
      g.globalAlpha = 0.35 + (i % 3) * 0.12;
      g.fillRect(620 + i * 12, 180, 10, 620);
    }
    g.globalAlpha = 1;

    const sheet = g.createLinearGradient(0, 820, 0, h);
    sheet.addColorStop(0, "#1c2820");
    sheet.addColorStop(1, "#0a0e0a");
    g.fillStyle = sheet;
    g.beginPath();
    g.moveTo(0, 900);
    g.quadraticCurveTo(180, 820, 360, 880);
    g.quadraticCurveTo(560, 940, 720, 860);
    g.lineTo(720, h);
    g.lineTo(0, h);
    g.fill();
    g.strokeStyle = "rgba(90,120,90,0.25)";
    g.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
      g.beginPath();
      g.moveTo(0, 960 + i * 36);
      g.bezierCurveTo(200, 930 + i * 28, 480, 1000 + i * 20, 720, 950 + i * 30);
      g.stroke();
    }

    if (kind === "door") {
      g.fillStyle = "rgba(190,210,185,0.72)";
      g.beginPath();
      g.ellipse(386, 470, 14, 20, 0, 0, Math.PI * 2);
      g.fill();
      g.fillRect(378, 490, 16, 210);
      g.fillRect(360, 520, 10, 150);
      g.fillRect(402, 520, 10, 160);
      g.strokeStyle = "rgba(8,10,8,0.85)";
      g.lineWidth = 2;
      for (let i = 0; i < 16; i++) {
        g.beginPath();
        g.moveTo(372 + i * 1.8, 448);
        g.quadraticCurveTo(370 + i * 2, 520, 366 + i * 2.1, 620);
        g.stroke();
      }
      g.fillStyle = "#e7ffd8";
      g.fillRect(378, 466, 3, 4);
      g.fillRect(390, 466, 3, 4);
    }

    if (kind === "bed") {
      g.fillStyle = "rgba(176,196,170,0.8)";
      g.beginPath();
      g.ellipse(360, 760, 70, 46, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "rgba(150,170,145,0.75)";
      g.beginPath();
      g.moveTo(250, 820);
      g.quadraticCurveTo(360, 700, 480, 830);
      g.lineTo(430, 980);
      g.quadraticCurveTo(360, 900, 290, 990);
      g.fill();
      g.strokeStyle = "#061006";
      g.lineWidth = 3;
      for (let i = 0; i < 18; i++) {
        g.beginPath();
        g.moveTo(300 + i * 6, 720);
        g.quadraticCurveTo(320 + i * 5, 800, 300 + i * 7, 900);
        g.stroke();
      }
      g.fillStyle = "#d9ffc4";
      g.beginPath();
      g.arc(338, 752, 4, 0, Math.PI * 2);
      g.arc(386, 750, 4, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "rgba(20,10,10,0.9)";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(324, 778);
      g.quadraticCurveTo(360, 798, 404, 774);
      g.stroke();
    }

    if (kind === "face") {
      g.fillStyle = "#0c100c";
      g.fillRect(0, 0, w, h);
      const skin = g.createRadialGradient(360, 560, 40, 360, 600, 420);
      skin.addColorStop(0, "#8ea892");
      skin.addColorStop(0.55, "#243028");
      skin.addColorStop(1, "#050705");
      g.fillStyle = skin;
      g.beginPath();
      g.ellipse(360, 620, 250, 300, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#071007";
      for (let i = 0; i < 40; i++) {
        g.beginPath();
        g.moveTo(160 + i * 12, 280);
        g.quadraticCurveTo(200 + i * 8, 520, 140 + i * 14, 760);
        g.lineWidth = 4;
        g.strokeStyle = "rgba(4,8,4,0.8)";
        g.stroke();
      }
      g.fillStyle = "#eaffd2";
      g.shadowColor = "#c6ff9a";
      g.shadowBlur = 18;
      g.beginPath();
      g.ellipse(280, 600, 18, 10, -0.2, 0, Math.PI * 2);
      g.ellipse(450, 596, 18, 10, 0.2, 0, Math.PI * 2);
      g.fill();
      g.shadowBlur = 0;
      g.fillStyle = "#101610";
      g.beginPath();
      g.moveTo(0, 860);
      g.quadraticCurveTo(360, 760, 720, 900);
      g.lineTo(720, h);
      g.lineTo(0, h);
      g.fill();
    }

    if (kind === "lump") {
      g.fillStyle = "rgba(0,0,0,0.45)";
      g.beginPath();
      g.ellipse(390, 1040, 180, 70, -0.2, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#1a2620";
      g.beginPath();
      g.ellipse(390, 1005, 160, 48, -0.15, 0, Math.PI * 2);
      g.fill();
    }

    if (kind === "mirror") {
      g.fillStyle = "#050805";
      g.fillRect(0, 0, w, h);
      const glow = g.createRadialGradient(360, 640, 20, 360, 660, 280);
      glow.addColorStop(0, "rgba(150,190,140,0.28)");
      glow.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = glow;
      g.fillRect(0, 0, w, h);
    }

    const vig = g.createRadialGradient(360, 620, 160, 360, 640, 760);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.78)");
    g.fillStyle = vig;
    g.fillRect(0, 0, w, h);

    const img = g.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 16) {
      const n = (Math.random() - 0.5) * 42;
      d[i] = clamp(d[i] + n, 0, 255);
      d[i + 1] = clamp(d[i + 1] + n * 1.05, 0, 255);
      d[i + 2] = clamp(d[i + 2] + n * 0.7, 0, 255);
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  function loadImages() {
    Object.keys(FILES).forEach((key) => {
      const painted = paintScene(key);
      media[key] = { el: painted, aspect: 720 / 1280, source: "paint" };
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        if (img.naturalWidth > 8) {
          media[key] = {
            el: img,
            aspect: img.naturalWidth / img.naturalHeight,
            source: "photo",
          };
        }
      };
      img.onerror = () => {};
      img.src = FILES[key];
    });
    media.mirror = { el: paintScene("mirror"), aspect: 720 / 1280, source: "paint" };
  }

  function makeGrain() {
    grainCanvas = document.createElement("canvas");
    grainCanvas.width = 180;
    grainCanvas.height = 320;
    const g = grainCanvas.getContext("2d");
    const img = g.createImageData(180, 320);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = Math.random() * 255;
      img.data[i] = n;
      img.data[i + 1] = n;
      img.data[i + 2] = n;
      img.data[i + 3] = 80;
    }
    g.putImageData(img, 0, 0);
  }

  const VERT = [
    "attribute vec2 aPos;",
    "varying vec2 vUv;",
    "void main() {",
    "  vUv = aPos * 0.5 + 0.5;",
    "  gl_Position = vec4(aPos, 0.0, 1.0);",
    "}",
  ].join("\n");

  const FRAG = [
    "precision highp float;",
    "varying vec2 vUv;",
    "uniform sampler2D uTex;",
    "uniform sampler2D uTexB;",
    "uniform vec2 uResolution;",
    "uniform float uTexAspect;",
    "uniform float uTime;",
    "uniform vec2 uPan;",
    "uniform float uZoom;",
    "uniform float uGrain;",
    "uniform float uAberration;",
    "uniform float uGlitch;",
    "uniform float uFlicker;",
    "uniform float uBrightness;",
    "uniform float uVignette;",
    "uniform float uPower;",
    "uniform float uWardrobe;",
    "uniform float uShadow;",
    "uniform float uEyes;",
    "uniform float uGhost;",
    "uniform float uMirror;",
    "uniform float uLump;",
    "float hash(vec2 p) {",
    "  vec3 p3 = fract(vec3(p.xyx) * 0.1031);",
    "  p3 += dot(p3, p3.yzx + 33.33);",
    "  return fract((p3.x + p3.y) * p3.z);",
    "}",
    "vec3 sampleAt(sampler2D tex, vec2 uv) {",
    "  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec3(0.0);",
    "  return texture2D(tex, uv).rgb;",
    "}",
    "void main() {",
    "  vec2 uv = vUv;",
    "  vec2 c = uv - 0.5;",
    "  float r2 = dot(c, c);",
    "  c *= 1.0 + 0.10 * r2;",
    "  c /= max(uZoom, 0.4);",
    "  c += vec2(uPan.x * 0.05, uPan.y * 0.032);",
    "  float screenAspect = uResolution.x / max(uResolution.y, 1.0);",
    "  float ySpan = screenAspect / max(uTexAspect, 0.1);",
    "  vec2 imgUv;",
    "  imgUv.x = c.x + 0.5;",
    "  imgUv.y = c.y / max(ySpan, 0.15) + 0.5;",
    "  float band = floor(uv.y * 86.0);",
    "  float bh = hash(vec2(band, floor(uTime * 13.0)));",
    "  if (bh > 1.0 - uGlitch * 0.5) {",
    "    imgUv.x += (bh - 0.5) * 0.055 * uGlitch;",
    "    imgUv.y += (hash(vec2(band, uTime)) - 0.5) * 0.01 * uGlitch;",
    "  }",
    "  if (imgUv.x > 0.84) imgUv.x += sin(uTime * 0.6 + imgUv.y * 7.0) * 0.0022;",
    "  vec2 sampleUv = imgUv;",
    "  if (uMirror > 0.5) sampleUv.x = 1.0 - sampleUv.x;",
    "  float ab = uAberration;",
    "  vec3 raw;",
    "  raw.r = sampleAt(uTex, sampleUv + vec2(ab, 0.0)).r;",
    "  raw.g = sampleAt(uTex, sampleUv).g;",
    "  raw.b = sampleAt(uTex, sampleUv - vec2(ab, 0.0)).b;",
    "  float l = dot(raw, vec3(0.299, 0.587, 0.114));",
    "  vec3 green = vec3(l * 0.42, l * 0.95, l * 0.38);",
    "  vec3 col = mix(raw, green, 0.48);",
    "  col = (col - 0.5) * 1.08 + 0.47;",
    "  vec2 down = vec2(imgUv.x, 1.0 - imgUv.y);",
    "  float slitW = 0.0025 + uWardrobe * 0.0055;",
    "  float inWard = step(0.40, down.y) * step(down.y, 0.62);",
    "  inWard *= step(abs(down.x - 0.172), slitW);",
    "  col *= 1.0 - inWard * 0.72;",
    "  if (uEyes > 0.5) {",
    "    float e = smoothstep(0.006, 0.0, length((down - vec2(0.172, 0.47)) * vec2(1.6, 3.4)));",
    "    e += smoothstep(0.006, 0.0, length((down - vec2(0.172, 0.495)) * vec2(1.6, 3.4)));",
    "    col += e * vec3(0.55, 1.0, 0.42);",
    "  }",
    "  if (uShadow > 0.0 && uShadow < 1.0) {",
    "    float x = mix(0.72, 0.28, uShadow);",
    "    float body = smoothstep(0.085, 0.0, abs(down.x - x));",
    "    body *= step(0.30, down.y) * step(down.y, 0.76);",
    "    col *= 1.0 - body * 0.72;",
    "    float rim = smoothstep(0.012, 0.0, abs(abs(down.x - x) - 0.04));",
    "    rim *= step(0.30, down.y) * step(down.y, 0.76);",
    "    col += rim * vec3(0.05, 0.1, 0.05);",
    "  }",
    "  if (uLump > 0.5) {",
    "    vec2 lp = down - vec2(0.52, 0.80);",
    "    float lump = smoothstep(0.20, 0.02, length(lp * vec2(1.1, 2.6)));",
    "    col *= 1.0 - lump * 0.55;",
    "  }",
    "  if (uGhost > 0.001) {",
    "    vec2 guv = (imgUv - 0.5) / (1.0 + uGhost * 0.08) + 0.5;",
    "    vec3 gh = sampleAt(uTexB, guv);",
    "    float glum = dot(gh, vec3(0.3, 0.5, 0.2));",
    "    gh = mix(gh, vec3(glum * 0.45, glum, glum * 0.4), 0.4);",
    "    col = mix(col, gh, uGhost);",
    "  }",
    "  col *= uBrightness * (1.0 - uFlicker * 0.45);",
    "  float scan = 0.5 + 0.5 * sin(gl_FragCoord.y * 1.35);",
    "  col *= 1.0 - 0.16 * scan;",
    "  float n = hash(fract(gl_FragCoord.xy * 0.1031) + fract(uTime * vec2(0.71, 0.37)));",
    "  col += (n - 0.5) * uGrain;",
    "  float dust = step(0.9988, hash(gl_FragCoord.xy + floor(uTime * 8.0)));",
    "  col += dust * 0.18;",
    "  vec2 vg = uv - 0.5;",
    "  float vig = smoothstep(0.95, 0.25, length(vg * vec2(0.9, 1.05)));",
    "  col *= mix(0.18, 1.0, pow(vig, uVignette));",
    "  float sweep = smoothstep(0.035, 0.0, fract(uv.y - uTime * 0.03));",
    "  col += sweep * 0.035;",
    "  float slitHalf = max(uPower, 0.0) * 0.52;",
    "  float dist = abs(vUv.y - 0.5);",
    "  if (dist > slitHalf) {",
    "    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);",
    "    return;",
    "  }",
    "  if (uPower < 0.995 && abs(dist - slitHalf) < 0.0035) col += vec3(0.35, 0.7, 0.32);",
    "  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);",
    "}",
  ].join("\n");

  function compile(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      glError = gl.getShaderInfoLog(sh) || "shader";
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  function initGL() {
    gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
      failIfMajorPerformanceCaveat: false,
    });
    if (!gl) return false;
    let frag = FRAG;
    let fs = compile(gl.FRAGMENT_SHADER, frag);
    if (!fs) {
      frag = FRAG.replace("precision highp float;", "precision mediump float;");
      glError = null;
      fs = compile(gl.FRAGMENT_SHADER, frag);
    }
    const vs = compile(gl.VERTEX_SHADER, VERT);
    if (!vs || !fs) {
      const ext = gl.getExtension("WEBGL_lose_context");
      if (ext) ext.loseContext();
      gl = null;
      return false;
    }
    prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.bindAttribLocation(prog, 0, "aPos");
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      glError = gl.getProgramInfoLog(prog) || "link";
      gl = null;
      return false;
    }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const names = [
      "uTex", "uTexB", "uResolution", "uTexAspect", "uTime", "uPan", "uZoom",
      "uGrain", "uAberration", "uGlitch", "uFlicker", "uBrightness", "uVignette",
      "uPower", "uWardrobe", "uShadow", "uEyes", "uGhost", "uMirror", "uLump",
    ];
    names.forEach((n) => {
      loc[n] = gl.getUniformLocation(prog, n);
    });
    gl.uniform1i(loc.uTex, 0);
    gl.uniform1i(loc.uTexB, 1);
    gl.disable(gl.DEPTH_TEST);
    return true;
  }

  function makeTex() {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 255])
    );
    tex._src = null;
    tex.aspect = 9 / 16;
    return tex;
  }

  function upload(tex, source, aspect) {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    tex._src = source;
    tex.aspect = aspect || tex.aspect;
  }

  function texFor(key) {
    const item = media[key] || media.empty;
    if (!glTex[key]) glTex[key] = makeTex();
    if (item && glTex[key]._src !== item.el) upload(glTex[key], item.el, item.aspect);
    return glTex[key];
  }

  function texVideo() {
    if (!glTex.video) glTex.video = makeTex();
    if (videoEl.readyState >= 2 && videoEl.videoWidth > 0) {
      gl.bindTexture(gl.TEXTURE_2D, glTex.video);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, videoEl);
        glTex.video.aspect = videoEl.videoWidth / videoEl.videoHeight;
      } catch (e) {}
    }
    return glTex.video;
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  function drawGL() {
    const main = view.scene === "video" ? texVideo() : texFor(view.scene === "lump" && !media.lump ? "empty" : view.scene);
    const face = texFor("face");
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, main);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, face);
    gl.uniform2f(loc.uResolution, canvas.width, canvas.height);
    gl.uniform1f(loc.uTexAspect, main.aspect || 9 / 16);
    gl.uniform1f(loc.uTime, performance.now() / 1000);
    gl.uniform2f(loc.uPan, view.panX, view.panY);
    gl.uniform1f(loc.uZoom, view.zoom);
    gl.uniform1f(loc.uGrain, view.grain);
    gl.uniform1f(loc.uAberration, view.aber);
    gl.uniform1f(loc.uGlitch, view.glitch);
    gl.uniform1f(loc.uFlicker, view.flicker);
    gl.uniform1f(loc.uBrightness, view.brightness);
    gl.uniform1f(loc.uVignette, view.vignette);
    gl.uniform1f(loc.uPower, view.power);
    gl.uniform1f(loc.uWardrobe, view.wardrobe);
    gl.uniform1f(loc.uShadow, view.shadow);
    gl.uniform1f(loc.uEyes, view.eyes);
    gl.uniform1f(loc.uGhost, view.ghost);
    gl.uniform1f(loc.uMirror, view.mirror);
    gl.uniform1f(loc.uLump, view.lump);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!drewOnce) {
      drewOnce = true;
      const err = gl.getError();
      if (err && err !== gl.NO_ERROR) glError = "gl " + err;
    }
  }

  function draw2D() {
    if (!ctx2) ctx2 = canvas.getContext("2d");
    if (!ctx2) return;
    const w = canvas.width;
    const h = canvas.height;
    const g = ctx2;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = "#000";
    g.fillRect(0, 0, w, h);
    const key = media[view.scene] ? view.scene : "empty";
    const item = media[key];
    if (item && view.brightness > 0.02 && view.power > 0.02) {
      const dw = w * Math.max(view.zoom, 1);
      const dh = dw / (item.aspect || 0.5625);
      const ox = (w - dw) / 2 + view.panX * w * 0.06;
      const oy = (h - dh) / 2 - view.panY * h * 0.04;
      g.globalAlpha = clamp(view.brightness, 0, 1) * clamp(view.power, 0, 1);
      g.drawImage(item.el, ox, oy, dw, dh);
      g.globalAlpha = 1;
    }
    if (grainCanvas) {
      g.globalAlpha = clamp(view.grain, 0, 0.5);
      g.drawImage(grainCanvas, 0, 0, w, h);
      g.globalAlpha = 1;
    }
    const rg = g.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.8);
    rg.addColorStop(0, "rgba(0,0,0,0)");
    rg.addColorStop(1, "rgba(0,0,0,0.75)");
    g.fillStyle = rg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(0,0,0,0.15)";
    for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 1);
    if (view.power < 0.995) {
      const open = view.power * h;
      g.fillStyle = "#000";
      g.fillRect(0, 0, w, (h - open) / 2);
      g.fillRect(0, (h + open) / 2, w, (h - open) / 2);
    }
  }

  function render() {
    resize();
    if (mode === "webgl") drawGL();
    else if (mode === "2d") draw2D();
  }

  function pannerAt(x, y, z) {
    const p = ctx.createPanner();
    p.panningModel = "HRTF";
    p.distanceModel = "inverse";
    p.refDistance = 0.45;
    p.maxDistance = 24;
    p.rolloffFactor = 1.15;
    if (p.positionX) {
      p.positionX.value = x;
      p.positionY.value = y;
      p.positionZ.value = z;
    } else {
      p.setPosition(x, y, z);
    }
    return p;
  }

  function envGain(t, peak, dur) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), t + Math.min(0.04, dur * 0.25));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    return g;
  }

  function burst(dur, freq, q, peak, x, y, z, bus, type) {
    if (!ctx || !noiseBuf) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type || "bandpass";
    f.frequency.setValueAtTime(Math.max(40, freq), now);
    f.Q.value = q;
    const g = envGain(now, peak, dur);
    const p = pannerAt(x, y, z);
    src.connect(f);
    f.connect(g);
    g.connect(p);
    p.connect(bus || world || master);
    src.start(now);
    src.stop(now + dur + 0.02);
  }

  function powerOn() {
    if (!ctx) return;
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(720, now);
    o.frequency.exponentialRampToValueAtTime(64, now + 0.75);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(1600, now);
    f.frequency.exponentialRampToValueAtTime(200, now + 0.75);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.06, now + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
    o.connect(f);
    f.connect(g);
    g.connect(intimate);
    o.start(now);
    o.stop(now + 0.92);
  }

  function foot(x, y, z, peak) {
    if (!ctx) return;
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(78 + Math.random() * 28, now);
    o.frequency.exponentialRampToValueAtTime(36, now + 0.1);
    const g = envGain(now, peak, 0.12);
    const p = pannerAt(x, y, z);
    o.connect(g);
    g.connect(p);
    p.connect(world);
    o.start(now);
    o.stop(now + 0.14);
    burst(0.09, 220, 0.7, peak * 0.7, x, y, z, world, "lowpass");
  }

  function breath(x, z, peak, dur) {
    if (!ctx || !noiseBuf || peak <= 0.004) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.15;
    bp.frequency.setValueAtTime(260, now);
    bp.frequency.linearRampToValueAtTime(620, now + dur * 0.42);
    bp.frequency.linearRampToValueAtTime(210, now + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(peak, now + dur * 0.46);
    g.gain.linearRampToValueAtTime(0.0001, now + dur);
    const p = pannerAt(x, 0.05, z);
    src.connect(bp);
    bp.connect(g);
    g.connect(p);
    p.connect(intimate);
    src.start(now);
    src.stop(now + dur + 0.05);
  }

  function whisper() {
    if (!ctx || !noiseBuf) return;
    const now = ctx.currentTime;
    const dur = 0.22 + Math.random() * 0.38;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 7;
    const f0 = 680 + Math.random() * 520;
    bp.frequency.setValueAtTime(f0, now);
    bp.frequency.linearRampToValueAtTime(f0 * (1.3 + Math.random() * 0.6), now + dur * 0.35);
    bp.frequency.linearRampToValueAtTime(480 + Math.random() * 280, now + dur);
    const bp2 = ctx.createBiquadFilter();
    bp2.type = "bandpass";
    bp2.Q.value = 5;
    bp2.frequency.value = 1600 + Math.random() * 900;
    const g = envGain(now, 0.045, dur);
    const ang = Math.random() * Math.PI * 2;
    const r = 0.28 + Math.random() * 0.55;
    const p = pannerAt(Math.cos(ang) * r, (Math.random() - 0.5) * 0.2, Math.sin(ang) * r);
    src.connect(bp);
    bp.connect(bp2);
    bp2.connect(g);
    g.connect(p);
    p.connect(world);
    src.start(now);
    src.stop(now + dur + 0.03);
  }

  function heart() {
    if (!ctx) return;
    const now = ctx.currentTime;
    const hit = (freq, t, peak) => {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(freq, t);
      o.frequency.exponentialRampToValueAtTime(30, t + 0.16);
      const g = ctx.createGain();
      g.gain.setValueAtTime(peak, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g);
      g.connect(intimate);
      o.start(t);
      o.stop(t + 0.2);
    };
    hit(72, now, 0.42);
    hit(50, now + 0.15, 0.24);
  }

  function scream() {
    if (!ctx || !noiseBuf) return;
    const now = ctx.currentTime;
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * 2 - 1;
      curve[i] = Math.tanh(x * 6.5);
    }
    shaper.curve = curve;
    shaper.oversample = "2x";
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, now);
    out.gain.exponentialRampToValueAtTime(0.85, now + 0.025);
    out.gain.exponentialRampToValueAtTime(0.22, now + 0.35);
    out.gain.exponentialRampToValueAtTime(0.0001, now + 1.15);
    shaper.connect(out);
    out.connect(intimate);

    const sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.setValueAtTime(130, now);
    sub.frequency.exponentialRampToValueAtTime(38, now + 0.55);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.5, now);
    sg.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
    sub.connect(sg);
    sg.connect(intimate);
    sub.start(now);
    sub.stop(now + 0.62);

    const n = ctx.createBufferSource();
    n.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 3.2;
    bp.frequency.setValueAtTime(2200, now);
    bp.frequency.exponentialRampToValueAtTime(780, now + 0.85);
    const ng = ctx.createGain();
    ng.gain.value = 0.55;
    n.connect(bp);
    bp.connect(ng);
    ng.connect(shaper);
    n.start(now);
    n.stop(now + 1.1);

    [760, 690].forEach((f0, i) => {
      const o = ctx.createOscillator();
      o.type = i ? "square" : "sawtooth";
      o.frequency.setValueAtTime(f0, now);
      o.frequency.exponentialRampToValueAtTime(160 + i * 30, now + 0.9);
      const g = ctx.createGain();
      g.gain.value = 0.18;
      o.connect(g);
      g.connect(shaper);
      o.start(now);
      o.stop(now + 1.05);
    });

    const air = ctx.createOscillator();
    air.type = "sine";
    air.frequency.setValueAtTime(1680, now);
    air.frequency.exponentialRampToValueAtTime(540, now + 0.7);
    const ag = ctx.createGain();
    ag.gain.setValueAtTime(0.12, now);
    ag.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);
    air.connect(ag);
    ag.connect(intimate);
    air.start(now);
    air.stop(now + 0.78);
  }

function creak() {
  burst(0.55, 480, 12, 0.07, -1.35, 0.2, -0.7, world, "bandpass");
    if (!ctx) return;
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(168, now);
    o.frequency.exponentialRampToValueAtTime(90, now + 0.4);
    const g = envGain(now, 0.05, 0.42);
    const p = pannerAt(-1.2, 0.1, -0.6);
    o.connect(g);
    g.connect(p);
    p.connect(world);
    o.start(now);
    o.stop(now + 0.45);
  }

function rustle() {
  burst(0.7, 900, 0.6, 0.05, 0.55, -0.2, -1.8, world, "bandpass");
}

  function setupAudio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      if (!ctx) {
        ctx = new AC();
        const silent = ctx.createBuffer(1, 1, ctx.sampleRate);
        const ping = ctx.createBufferSource();
        ping.buffer = silent;
        ping.connect(ctx.destination);
        ping.start(0);
        master = ctx.createGain();
        master.gain.setValueAtTime(0.0001, ctx.currentTime);
        master.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 1.7);
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.knee.value = 12;
        comp.ratio.value = 9;
        comp.attack.value = 0.004;
        comp.release.value = 0.24;
        world = ctx.createGain();
        intimate = ctx.createGain();
        world.connect(master);
        intimate.connect(master);
        master.connect(comp);
        comp.connect(ctx.destination);
        const L = ctx.listener;
        if (L.forwardZ) {
          L.positionX.value = 0;
          L.positionY.value = 0;
          L.positionZ.value = 0;
          L.forwardX.value = 0;
          L.forwardY.value = 0;
          L.forwardZ.value = -1;
          L.upX.value = 0;
          L.upY.value = 1;
          L.upZ.value = 0;
        } else if (L.setOrientation) {
          L.setPosition(0, 0, 0);
          L.setOrientation(0, 0, -1, 0, 1, 0);
        }
        const len = ctx.sampleRate * 2;
        noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

        droneA = ctx.createOscillator();
        droneB = ctx.createOscillator();
        droneA.type = "sine";
        droneB.type = "sine";
        droneA.frequency.value = 46;
        droneB.frequency.value = 46.45;
        const sub = ctx.createOscillator();
        sub.type = "sine";
        sub.frequency.value = 23;
        droneGain = ctx.createGain();
        droneGain.gain.value = 0;
        droneA.connect(droneGain);
        droneB.connect(droneGain);
        sub.connect(droneGain);
        droneGain.connect(world);
        droneA.start();
        droneB.start();
        sub.start();

        const hiss = ctx.createBufferSource();
        hiss.buffer = noiseBuf;
        hiss.loop = true;
        const hp = ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 1800;
        const hg = ctx.createGain();
        hg.gain.value = 0.012;
        hiss.connect(hp);
        hp.connect(hg);
        hg.connect(intimate);
        hiss.start();

        const st = ctx.createBufferSource();
        st.buffer = noiseBuf;
        st.loop = true;
        const shp = ctx.createBiquadFilter();
        shp.type = "highpass";
        shp.frequency.value = 1200;
        staticGain = ctx.createGain();
        staticGain.gain.value = 0;
        st.connect(shp);
        shp.connect(staticGain);
        staticGain.connect(world);
        st.start();
      }
      ctx.resume().catch(() => {});
      const keep = new Audio("assets/silence.wav");
      keep.loop = true;
      keep.volume = 0.02;
      keep.play().catch(() => {});
    } catch (e) {
      ctx = null;
    }
  }

  function followAudio() {
    if (!ctx || !droneGain || !world) return;
    const now = ctx.currentTime;
    const progT = clamp(clock / T.scare, 0, 1);
    droneA.frequency.setTargetAtTime(46 - progT * 7, now, 0.8);
    droneB.frequency.setTargetAtTime(46.4 + progT * 1.4, now, 0.8);
    let dg = 0.055;
    if (phase === "blackout" || phase === "scare") dg = 0.0;
    else if (phase === "bed") dg = 0.02;
    else if (phase === "end") dg = 0.012;
    else if (phase === "boot") dg = 0.03;
    droneGain.gain.setTargetAtTime(dg, now, 0.4);
    let w = 1;
    if (phase === "blackout" || phase === "scare") w = 0.0001;
    else if (clock > T.black - 1.35 && clock < T.black) w = 0.0001;
    else if (clock > T.scare - 1.05 && clock < T.scare) w = 0.02;
    else if (phase === "bed") w = 0.12;
    else if (phase === "end") w = 0.05;
    world.gain.setTargetAtTime(w, now, 0.18);
    let st = 0;
    if (phase === "warn") st = ((clock - T.warn) / (T.black - T.warn)) * 0.05;
    if (staticGain) staticGain.gain.setTargetAtTime(st, now, 0.2);
  }

  function haptic(count, gap) {
    const step = gap || 70;
    let i = 0;
    const tick = () => {
      if (hapLabel) hapLabel.click();
      i += 1;
      if (i < count) setTimeout(tick, step);
    };
    tick();
    if (navigator.vibrate) {
      const pattern = [];
      for (let k = 0; k < count; k++) pattern.push(16, Math.max(0, step - 16));
      navigator.vibrate(pattern);
    }
  }

  function noteNoise(amount) {
    noiseBurst = Math.max(noiseBurst, amount);
  }

  const shots = [
    { id: "creak", t: T.creak, fn: creak },
    { id: "hall", t: T.hallStep, fn() { foot(0.5, -0.45, -2.35, 0.2); } },
    {
      id: "static",
      t: T.staticBurst,
      fn() {
        spike(0.72);
        burst(0.22, 2400, 0.4, 0.08, 0, 0, -0.4, world, "highpass");
      },
    },
    {
      id: "scare",
      t: T.scare,
      fn() {
        scream();
        haptic(12, 42);
        mem.shake = reduce ? 0.45 : 1;
      },
    },
  ];

  function runShots() {
    for (let i = 0; i < shots.length; i++) {
      const s = shots[i];
      if (!fired.has(s.id) && clock >= s.t) {
        fired.add(s.id);
        s.fn();
      }
    }
  }

  function derivePhase() {
    if (clock >= T.end) phase = "end";
    else if (clock >= T.scare) phase = "scare";
    else if (clock >= T.cam) phase = "cam";
    else if (clock >= T.bed) phase = "bed";
    else if (clock >= T.black) phase = "blackout";
    else if (clock >= T.warn) phase = "warn";
    else if (clock >= T.quiet) phase = "quiet";
    else phase = "live";
  }

  function levelNow() {
    return Math.max(micSmooth, noiseBurst);
  }

  function updateGaze(dt) {
    if (mem.blinkUntil) {
      if (clock > mem.blinkUntil) {
        mem.figure = false;
        mem.blinkUntil = 0;
        mem.cutFlash = 0.06;
      }
      return;
    }
    if (clock < T.gaze || clock >= T.warn || mem.appearances >= 3) return;
    const away = pan.x < -0.34 || pan.x > 0.42;
    const home = Math.abs(pan.x) < 0.2;
    if (mem.figure) {
      if (home) mem.stare += dt;
      else mem.stare = 0;
      if (mem.stare > 2.15) {
        mem.figure = false;
        mem.stare = 0;
        mem.away = 0;
        mem.cutFlash = 0.08;
        spike(0.55);
        breath(0.25, 0.18, 0.07, 1.15);
      }
    } else if (away) {
      mem.away += dt;
    } else if (home) {
      if (mem.away > 1.42) {
        mem.figure = true;
        mem.appearances += 1;
        mem.away = 0;
        mem.cutFlash = 0.09;
        spike(0.88);
        foot(0.35, -0.3, -1.55, 0.26);
        breath(0.4, -1.2, 0.06, 1.4);
        haptic(1, 40);
      } else {
        mem.away = 0;
      }
    }
  }

  function updateMic(dt) {
    if (analyser && td) {
      analyser.getByteTimeDomainData(td);
      let sum = 0;
      for (let i = 0; i < td.length; i++) {
        const v = (td[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / td.length);
      micSmooth += (rms - micSmooth) * Math.min(1, dt * 8);
    }
    noiseBurst = Math.max(0, noiseBurst - dt * 0.5);
    const loud = levelNow();
    if (clock >= T.quiet && clock < T.black) {
      if (loud < 0.03) mem.secondBreath = Math.min(1, mem.secondBreath + dt * 0.05);
      else mem.secondBreath = Math.max(0, mem.secondBreath - dt * 0.45);
    } else if (clock >= T.black && clock < T.cam) {
      mem.secondBreath = 1;
    } else if (phase === "end") {
      mem.secondBreath = 0.2;
    }
    if (!mem.shush && mem.secondBreath > 0.22 && clock >= T.quiet && clock < T.black) {
      mem.shush = true;
      mem.shushUntil = clock + 3.8;
    }
    if (clock >= T.quiet && clock < T.black && loud > 0.09 && clock >= mem.nextReact) {
      mem.reacts += 1;
      mem.nextReact = clock + 5.2;
      mem.secondBreath = 0;
      mem.zoomPunch = Math.min(0.24, mem.zoomPunch + 0.12);
      spike(0.7 + mem.reacts * 0.1);
      foot(0.05, -0.35, -0.95, 0.3 + mem.reacts * 0.05);
      haptic(2, 90);
      if (mem.reacts >= 2 && clock < T.warn) {
        clock = T.warn - 0.15;
        spike(1);
      }
    }
  }

  function updateAudioEvents() {
    if (clock > 1.2 && clock < T.black - 1.3 && clock >= mem.nextBreath) {
      const g = 0.03 * (1 - mem.secondBreath * 0.8);
      breath(0.05, -0.85, g, 3.2);
      mem.nextBreath = clock + 5.1 + h1(clock) * 0.8;
    }
    const other =
      clock >= T.black && clock < T.cam
        ? clock < T.bed
          ? 0.16
          : 0.1
        : mem.secondBreath > 0.08 && clock < T.black
          ? 0.025 + mem.secondBreath * 0.11
          : phase === "end"
            ? 0.035
            : 0;
    if (other > 0.01 && clock >= mem.nextOther) {
      const close = clock >= T.black ? 0.12 : 0.62 - mem.secondBreath * 0.45;
      const ear = clock >= T.black ? 0.12 : 0.58 * (1 - mem.secondBreath * 0.4);
      breath(ear, close, other, clock >= T.black ? 2.35 : 2.7);
      mem.nextOther = clock + (clock >= T.bed ? 3.3 : 4.5) + h1(clock + 4) * 0.7;
    }
    if (clock >= T.steps && clock < T.black - 1.4 && !mem.figure && clock >= mem.nextStep) {
      const closeness = clamp((clock - T.steps) / (T.black - T.steps), 0, 1);
      const radius = (mem.appearances >= 2 ? 2.3 : 3.05) - closeness * 2.05;
      const ang = mem.angle;
      foot(Math.cos(ang) * radius, -0.5, Math.sin(ang) * radius, 0.11 + closeness * 0.15);
      mem.angle = ang + 0.66 + h1(clock) * 0.4;
      mem.nextStep = clock + (1.72 - closeness * 0.82) * (0.84 + h1(clock + 2) * 0.36);
    }
    if (clock >= T.whispers && clock < T.black - 1.6 && clock >= mem.nextWhisper) {
      whisper();
      mem.nextWhisper = clock + 5.5 + h1(clock * 1.7) * 7.5;
    }
    if (clock >= T.black && clock < T.cam && clock >= mem.nextHeart) {
      heart();
      haptic(1, 50);
      mem.nextHeart = clock + (clock < T.bed ? 0.94 : 1.16);
    }
    if (phase === "end" && mem.endHearts < 2 && clock >= mem.nextHeart) {
      mem.endHearts += 1;
      heart();
      haptic(1, 70);
      mem.nextHeart = clock + 1.35;
    }
  }

  function fillView(dt) {
    derivePhase();
    let nextScene = "empty";
    if (mem.figure && clock < T.black) nextScene = "door";
    if (clock >= T.bed && clock < T.cam) nextScene = "bed";
    if (clock >= T.cam && clock < T.scare) nextScene = stream && videoEl.readyState >= 2 ? "video" : "mirror";
    if (clock >= T.scare && clock < T.end) nextScene = "face";
    if (clock >= T.end) nextScene = media.lump ? "lump" : "empty";
    if (sceneOverride) nextScene = sceneOverride;
    scene = nextScene;

    glitchImpulse *= Math.exp(-dt * 2.6);
    let ambient = 0.04;
    if (phase === "warn") ambient = 0.1 + ((clock - T.warn) / (T.black - T.warn)) * 0.78;
    if (phase === "cam") ambient = 0.14;
    if (phase === "scare") {
      const age = clock - T.scare;
      ambient = age < 0.14 ? 1 : age < 0.32 ? 0.4 : 0.16;
    }
    view.glitch = Math.max(glitchImpulse, ambient);
    if (reduce) view.glitch *= 0.45;

    view.flicker = h1(Math.floor(clock * 17)) > (phase === "warn" || phase === "scare" ? 0.7 : 0.972) ? 1 : 0;
    view.brightness = 1;
    if (phase === "blackout") view.brightness = h1(Math.floor(clock * 9)) > 0.972 ? 0.1 : 0;
    if (phase === "scare" && clock < T.scare + 0.07) view.brightness = 1.45;
    if (phase === "end") view.brightness = 0.9;
    if (mem.cutFlash > 0) {
      view.brightness *= 0.35;
      mem.cutFlash -= dt;
    }

    view.power = 1;
    if (clock >= T.down && clock < T.end) view.power = 1 - (clock - T.down) / (T.end - T.down);
    else if (clock >= T.end) view.power = clamp((clock - T.end) / 1.2, 0, 1);

    view.scene = scene;
    const scareAge = clock - T.scare;
    view.grain = phase === "blackout" ? 0.16 : phase === "scare" ? (scareAge < 0.14 ? 0.22 : 0.1) : phase === "end" ? 0.08 : 0.09;
    view.aber = phase === "scare" ? (scareAge < 0.16 ? 0.009 : 0.0032) : 0.0012 + view.glitch * 0.008;
    view.vignette = 0.82;
    view.zoom = 1.14 + Math.sin(clock * 0.5) * 0.006;
    if (clock >= T.lean && clock < T.lean + 1.15 && phase === "bed") {
      view.zoom += Math.sin(((clock - T.lean) / 1.15) * Math.PI) * 0.1;
    }
    if (phase === "scare") {
      const k = clamp((clock - T.scare) / 0.14, 0, 1);
      view.zoom = 1.16 + 0.2 * (1 - Math.pow(1 - k, 3));
    }
    view.zoom += mem.zoomPunch;
    mem.zoomPunch *= Math.exp(-dt * 2.2);

    const showWard = scene === "empty";
    view.wardrobe = showWard ? clamp((clock - T.creak) / 16, 0, 1) : 0;
    view.shadow = scene === "empty" && mem.shadowT ? (() => {
      const p = (clock - mem.shadowT) / 2.5;
      return p > 0 && p < 1 ? p : 0;
    })() : 0;
    view.eyes = scene === "empty" && clock < mem.eyesUntil ? 1 : 0;
    view.ghost = 0;
    if (clock >= T.ghost && clock < T.scare) view.ghost = clamp((clock - T.ghost) / (T.scare - T.ghost), 0, 0.84);
    view.mirror = scene === "video" ? 1 : 0;
    view.lump = scene === "lump" && media.lump && media.lump.source !== "photo" ? 1 : 0;

    mem.shake *= Math.exp(-dt * (reduce ? 8 : 4.5));
    const amp = mem.shake * (reduce ? 0.04 : 0.09);
    const sway = phase === "scare" || phase === "blackout" ? 0 : 1;
    const t = performance.now() / 1000;
    view.panX = pan.x + Math.sin(t * 0.17) * 0.025 * sway + (h1(t * 40) - 0.5) * amp;
    view.panY = pan.y + Math.cos(t * 0.13) * 0.015 * sway + (h1(t * 33) - 0.5) * amp * 0.7;

    if (phase === "warn") {
      const k = (clock - T.warn) / (T.black - T.warn);
      const r = h1(Math.floor(clock * 7));
      bars = k > 0.72 ? (r > 0.5 ? 0 : 1) : r > 0.66 ? 1 : r > 0.33 ? 2 : 3;
    } else if (phase === "blackout" || phase === "scare") bars = 0;
    else if (phase === "bed") bars = 1;
    else if (phase === "cam" || phase === "end") bars = 2;
    else bars = 3;
  }

  function update(dt) {
    if (phase === "boot") {
      bootT += dt;
      view.scene = "empty";
      view.power = smoothstep(bootT / 1.05);
      view.brightness = 0.92;
      view.grain = 0.12;
      view.glitch = bootT < 0.25 ? 0.45 : 0.05;
      view.zoom = 1.14;
      view.wardrobe = 0;
      view.shadow = 0;
      view.eyes = 0;
      view.ghost = 0;
      view.mirror = 0;
      view.lump = 0;
      view.aber = 0.002;
      view.flicker = 0;
      view.vignette = 0.8;
      view.panX = manual.x;
      view.panY = manual.y;
      scene = "empty";
      if (bootT > 1.16) {
        phase = "live";
        clock = 0;
      }
      if (app.dataset.phase !== "boot") app.dataset.phase = "boot";
      followAudio();
      return;
    }

    clock += dt;
    const tx = gyroSeen ? clamp(gyro.x * 0.9 + manual.x, -1, 1) : manual.x;
    const ty = gyroSeen ? clamp(gyro.y * 0.75 + manual.y, -1, 1) : manual.y;
    const k = 1 - Math.exp(-dt * 8);
    pan.x += (tx - pan.x) * k;
    pan.y += (ty - pan.y) * k;

    if (!mem.shadowDone && clock >= T.shadow && clock < T.quiet) {
      if (Math.abs(pan.x) > 0.3 || clock > T.shadow + 18) {
        mem.shadowDone = true;
        mem.shadowT = clock;
        rustle();
      }
    }
    if (!mem.eyesSeen && clock > T.eyes && clock < T.quiet && pan.x < -0.22) {
      mem.eyesSeen = true;
      mem.eyesUntil = clock + 0.4;
      burst(0.04, 3200, 4, 0.04, -0.8, 0.1, -0.4, intimate, "bandpass");
      spike(0.28);
    }
    if (!fired.has("blink") && clock >= T.blink && mem.appearances === 0 && clock < T.quiet) {
      fired.add("blink");
      mem.figure = true;
      mem.blinkUntil = clock + 0.34;
      spike(1);
      foot(0.4, -0.2, -1.8, 0.18);
    }

    updateGaze(dt);
    updateMic(dt);
    runShots();
    updateAudioEvents();

    if (clock >= T.cam && !mem.camTried) {
      mem.camTried = true;
      openCam();
    }
    if (clock >= T.scare && stream) stopCam();

    const bucket = Math.floor(clock);
    if (bucket !== mem.bucket) {
      mem.bucket = bucket;
      if (clock > 11 && clock < T.black - 2.2 && h1(bucket) > 0.8) {
        spike(0.16 + h1(bucket + 3) * 0.3);
        if (h1(bucket + 8) > 0.55) burst(0.035, 2800, 2, 0.035, (h1(bucket) - 0.5) * 1.4, 0, -0.5, world, "highpass");
      }
    }

    fillView(dt);
    if (app.dataset.phase !== phase) {
      app.dataset.phase = phase;
      trace.push(phase);
      if (trace.length > 24) trace.shift();
    }
    followAudio();
  }

  function syncHud() {
    const stamp = formatStamp(new Date());
    if (stamp !== lastStamp) {
      lastStamp = stamp;
      stampEl.textContent = stamp;
    }
    const label = phase === "cam" ? "镜头 2" : "镜头 1";
    if (label !== lastCam) {
      lastCam = label;
      camLabel.textContent = label;
    }
    if (sigEl.dataset.level !== String(bars)) sigEl.dataset.level = String(bars);
    if (!realBattery) battery = Math.max(0.31, battery - 0.0000015);
    const pct = Math.round(battery * 100);
    const pctText = pct + "%";
    if (bpct.textContent !== pctText) bpct.textContent = pctText;
    battFill.style.width = pct + "%";
    const showMeter = phase === "quiet" || phase === "warn";
    if (showMeter !== meterOn) {
      meterOn = showMeter;
      meterEl.hidden = !showMeter;
    }
    if (showMeter) {
      const pulse = mem.secondBreath * (0.22 + 0.78 * Math.abs(Math.sin(clock * 2.05)));
      const m = clamp(Math.max(micSmooth * 7.5, noiseBurst, pulse), 0.04, 1);
      meterBar.style.transform = "scaleX(" + m.toFixed(3) + ")";
    }
    const showNo = clock >= T.black && clock < T.black + 3.4;
    if (showNo !== nosigOn) {
      nosigOn = showNo;
      nosigEl.classList.toggle("show", showNo);
    }
    const showSh = mem.shush && clock < mem.shushUntil && phase !== "blackout";
    if (showSh !== shushOn) {
      shushOn = showSh;
      shushEl.classList.toggle("show", showSh);
    }
  }

  function onOrient(e) {
    if (e.gamma == null || e.beta == null) return;
    gyroSeen = true;
    gyro.x = clamp(e.gamma / 24, -1, 1);
    gyro.y = clamp(((e.beta || 0) - 58) / 32, -1, 1);
  }

  function listenOrient() {
    if (orientListening) return;
    orientListening = true;
    window.addEventListener("deviceorientation", onOrient);
  }

  function requestMotion() {
    const D = window.DeviceOrientationEvent;
    if (D && typeof D.requestPermission === "function") {
      return D.requestPermission()
        .then((state) => {
          gyroSeen = false;
          return state;
        })
        .catch(() => {});
    }
    return Promise.resolve("granted");
  }

  function openMic() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !ctx) return;
    navigator.mediaDevices
      .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false })
      .then((s) => {
        if (!ctx) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        const src = ctx.createMediaStreamSource(s);
        analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.7;
        src.connect(analyser);
        td = new Uint8Array(analyser.fftSize);
      })
      .catch(() => {});
  }

  function primeCam() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((s) => {
        s.getTracks().forEach((t) => t.stop());
      })
      .catch(() => {});
  }

function openCam() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
  navigator.mediaDevices
    .getUserMedia({
      video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 1280 } },
      audio: false,
    })
    .then((s) => {
      if (clock >= T.scare) {
        s.getTracks().forEach((t) => t.stop());
        return null;
      }
      stream = s;
      videoEl.srcObject = s;
      camReady = true;
      return videoEl.play().catch(() => {});
    })
    .catch(() => {
      camReady = false;
      if (stream) stopCam();
    });
}

  function stopCam() {
    camReady = false;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    videoEl.srcObject = null;
  }

  function wake() {
    if (!navigator.wakeLock) return;
    navigator.wakeLock.request("screen").then((s) => {
      sentinel = s;
    }).catch(() => {});
  }


  function begin() {
    phase = "boot";
    bootT = 0;
    clock = 0;
    app.dataset.phase = "boot";
    hud.hidden = false;
    entry.classList.add("gone");
    powerOn();
    trace.push("boot");
  }

  function replay() {
    stopCam();
    if (navigator.vibrate) navigator.vibrate(0);
    fired.clear();
    mem = freshMem();
    clock = 0;
    bootT = 0;
    pan.x = pan.y = manual.x = manual.y = 0;
    glitchImpulse = 0;
    sceneOverride = null;
    camReady = false;
    shushOn = false;
    nosigOn = false;
    shushEl.classList.remove("show");
    nosigEl.classList.remove("show");
    camLabel.textContent = "镜头 1";
    lastCam = "镜头 1";
    phase = "boot";
    app.dataset.phase = "boot";
    powerOn();
  }

  startBtn.addEventListener("click", () => {
    if (started) return;
    started = true;
    setupAudio();
    listenOrient();
    const motion = requestMotion();
    openMic();
    primeCam();
    wake();
    const go = () => {
      if (phase !== "entry") return;
      begin();
    };
    Promise.race([
      Promise.resolve(motion).catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 1600)),
    ]).then(go);
  });

  replayBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    replay();
  });

  app.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button")) return;
    drag = { x: e.clientX, y: e.clientY, ox: manual.x, oy: manual.y, moved: 0 };
  });
  window.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    manual.x = clamp(drag.ox - dx / (window.innerWidth * 0.46), -1, 1);
    manual.y = clamp(drag.oy + dy / (window.innerHeight * 0.72), -1, 1);
  });
  window.addEventListener("pointerup", () => {
    if (drag && drag.moved < 14 && (phase === "quiet" || phase === "warn")) noteNoise(0.24);
    drag = null;
  });
  window.addEventListener("pointercancel", () => {
    drag = null;
  });

  window.addEventListener("keydown", (e) => {
    if (phase === "entry") return;
    if (e.key === "ArrowLeft") manual.x = clamp(manual.x - 0.18, -1, 1);
    if (e.key === "ArrowRight") manual.x = clamp(manual.x + 0.18, -1, 1);
    if (e.key === "ArrowUp") manual.y = clamp(manual.y + 0.18, -1, 1);
    if (e.key === "ArrowDown") manual.y = clamp(manual.y - 0.18, -1, 1);
  });

  document.addEventListener("touchmove", (e) => {
    if (e.cancelable) e.preventDefault();
  }, { passive: false });
  document.addEventListener("contextmenu", (e) => e.preventDefault());
  document.addEventListener("gesturestart", (e) => e.preventDefault());
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      paused = true;
      if (ctx) ctx.suspend().catch(() => {});
    } else {
      paused = false;
      if (ctx && phase !== "entry") ctx.resume().catch(() => {});
      if (phase !== "entry") wake();
    }
  });

  let last = performance.now();
  function frame(now) {
    const real = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    const dt = real * SPEED;
    if (!paused && phase !== "entry") update(dt);
    else if (phase === "entry") {
      view.power = 0;
      view.brightness = 0;
      view.grain = 0.07;
      view.glitch = 0.02;
      view.scene = "empty";
      view.zoom = 1.14;
    }
    if (phase !== "entry") syncHud();
    render();
    requestAnimationFrame(frame);
  }

  function assetReport() {
    const out = {};
    Object.keys(media).forEach((k) => {
      out[k] = media[k].source;
    });
    return out;
  }

  window.__night = {
    get state() {
      return {
        phase,
        clock: Math.round(clock * 10) / 10,
        scene,
        panX: +pan.x.toFixed(2),
        panY: +pan.y.toFixed(2),
        figure: mem.figure,
        appearances: mem.appearances,
        secondBreath: +mem.secondBreath.toFixed(2),
        bars,
        camReady,
        trace: trace.slice(),
        assets: assetReport(),
        glError,
        mode,
      };
    },
    start() {
      startBtn.click();
    },
    seek(t) {
      if (phase === "entry" || phase === "boot") {
        started = true;
        phase = "live";
        hud.hidden = false;
        entry.classList.add("gone");
      }
      clock = Math.max(0, t);
      shots.forEach((s) => {
        if (s.t <= clock) fired.add(s.id);
      });
      if (clock >= T.blink) fired.add("blink");
      mem.nextStep = Math.max(T.steps, clock + 0.4);
      mem.nextBreath = clock + 1;
      mem.nextOther = clock + 1.3;
      mem.nextWhisper = Math.max(T.whispers, clock + 1);
      mem.nextHeart = clock + 0.8;
      mem.nextReact = clock + 1;
      if (clock >= T.cam) mem.camTried = true;
      fillView(0.016);
      app.dataset.phase = phase;
    },
    panTo(x, y) {
      manual.x = x;
      manual.y = y;
      pan.x = x;
      pan.y = y;
      gyroSeen = false;
    },
    reveal(name) {
      sceneOverride = name;
    },
    clearReveal() {
      sceneOverride = null;
    },
  };

  makeGrain();
  loadImages();
  try {
    mode = initGL() ? "webgl" : "2d";
  } catch (e) {
    glError = String(e && e.message ? e.message : e);
    mode = "2d";
  }
  if (mode === "2d" && !ctx2) ctx2 = canvas.getContext("2d");
  listenOrient();
  requestAnimationFrame(frame);
})();
