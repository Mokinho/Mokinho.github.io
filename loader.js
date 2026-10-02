// Page loader: a liquid-glass lens drifts over a reel of project shots while the page loads,
// then swells to fill the screen and hands over to the site. WebGL, with a plain fallback.
(() => {
  const root = document.documentElement;
  const loader = document.getElementById('preloader');
  if (!loader || !root.classList.contains('preloading')) return;

  const countEl = document.getElementById('preloaderCount');
  const thumb = document.getElementById('preloaderThumb');
  const SOURCES = ['assets/loader/l1.jpg', 'assets/loader/l2.jpg', 'assets/loader/l3.jpg',
                   'assets/loader/l4.jpg', 'assets/loader/l5.jpg', 'assets/loader/l6.jpg'];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MIN_MS = reduce ? 600 : 3400;   // long enough to see the reel
  const MAX_MS = 7000;                  // never hold the page longer than this
  const SHOT_MS = 620;                  // time per shot
  const SWAP_MS = 380;                  // swirl transition between shots
  const EXIT_MS = 1000;
  const start = performance.now();

  let pageLoaded = document.readyState === 'complete';
  if (!pageLoaded) window.addEventListener('load', () => { pageLoaded = true; }, { once: true });

  // ---------- images ----------
  const imgs = [];          // loaded HTMLImageElements in reel order
  let imgsDone = 0;
  SOURCES.forEach((src, i) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => { imgs[i] = im; imgsDone++; onImage(i); };
    im.onerror = () => { imgsDone++; };
    im.src = src;
  });
  const reel = () => imgs.filter(Boolean);

  // ---------- finish / handover ----------
  let exiting = false, exitAt = 0, finished = false;
  const beginExit = now => { if (!exiting) { exiting = true; exitAt = now; } };
  const finish = () => {
    if (finished) return;
    finished = true;
    loader.classList.add('is-done');
    root.classList.remove('preloading');
    setTimeout(() => loader.remove(), 700);
  };
  setTimeout(() => { beginExit(performance.now()); setTimeout(finish, EXIT_MS + 100); }, MAX_MS); // rAF can stall in background tabs

  // ---------- WebGL ----------
  const canvas = document.createElement('canvas');
  canvas.className = 'preloader-gl';
  let gl = null;
  if (!reduce) {
    try { gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false, alpha: false }); } catch (e) { gl = null; }
  }

  const VERT = `attribute vec2 p; varying vec2 vUv; void main(){ vUv = p*.5+.5; gl_Position = vec4(p,0.,1.); }`;
  const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uA, uB;
uniform vec2 uRes, uImgA, uImgB;
uniform float uTime, uMix, uIntro, uOut, uHasA, uHasB;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.03; a*=.5; } return v; }
mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }

// object-fit: cover
vec2 cover(vec2 uv, vec2 img){
  float rs = uRes.x/uRes.y, ri = img.x/img.y;
  vec2 sc = rs > ri ? vec2(1., ri/rs) : vec2(rs/ri, 1.);
  return (uv-.5)*sc + .5;
}
vec3 tex(sampler2D t, vec2 img, vec2 uv){ return texture2D(t, clamp(cover(uv, img), .001, .999)).rgb; }

vec3 shot(vec2 uv){
  // swirl the outgoing shot away and the incoming one in
  vec2 c = uv-.5; c.x *= uRes.x/uRes.y;
  float d = length(c);
  float tw = (1.-smoothstep(0., .9, d)) * 5.5;
  vec2 ca = rot(tw*uMix) * c;  ca.x /= uRes.x/uRes.y;
  vec2 cb = rot(-tw*(1.-uMix)) * c; cb.x /= uRes.x/uRes.y;
  vec3 a = tex(uA, uImgA, ca+.5);
  vec3 b = tex(uB, uImgB, cb+.5);
  a = mix(vec3(.02), a, uHasA); b = mix(a, b, uHasB);
  return mix(a, b, smoothstep(.15,.85,uMix));
}

void main(){
  float asp = uRes.x/uRes.y;
  vec2 uv = vUv;
  vec2 p = (uv-.5)*vec2(asp,1.);
  float r = length(p), ang = atan(p.y,p.x);
  float t = uTime;

  // wobbling glass blob in the middle; it swells to fill the screen on exit
  float R = .30 + .045*sin(3.*ang + t*1.4) + .03*sin(5.*ang - t*2.2) + .05*(fbm(vec2(ang*1.2, t*.6))-.5);
  R *= mix(.25, 1., smoothstep(0.,1.,uIntro));
  R += uOut*uOut*2.2;
  float sd = r - R;                                   // <0 inside the lens
  float rim = exp(-pow(sd/.028, 2.));                 // glassy edge
  float inside = 1.-smoothstep(-.01,.01,sd);

  // refraction: magnify + twist inside, strong bend across the rim, mild bulge outside
  vec2 dir = r > 0. ? p/r : vec2(0.);
  vec2 q = p;
  q = mix(q, rot(.35*sin(t*.7) + .6*(1.-r/max(R,.001)))*q*.72, inside);
  q -= dir*rim*.05;
  q *= mix(1., 1.-.18*smoothstep(0.,1.2,r), 1.-inside);   // outside fisheye
  vec2 suv = q/vec2(asp,1.)+.5;

  // chromatic split near the rim + radial zoom blur outside the lens
  float ab = .002 + rim*.007;
  vec3 col = vec3(0.);
  float blur = (1.-inside)*.06*smoothstep(0.,.6,sd);
  for(int i=0;i<6;i++){
    float k = float(i)/5.;
    vec2 o = (suv-.5)*(1.-blur*k)+.5;
    col.r += shot(o + dir*ab).r;
    col.g += shot(o).g;
    col.b += shot(o - dir*ab).b;
  }
  col /= 6.;

  // grade: darker outside, glint on the rim, orange haze
  col *= mix(.38, .95, inside);
  col += rim*vec3(1.,.55,.3)*.16;
  float spec = pow(max(0., dot(dir, normalize(vec2(-.6,.8)))), 6.)*rim;
  col += spec*.3;
  col = mix(col, col*vec3(1.05,.86,.78), .25);

  // intro: smoky light before the shots arrive
  float smoke = fbm(p*2.2 + vec2(0., -t*.35)) * (1.-smoothstep(0.,.9,r));
  vec3 haze = vec3(.91,.31,.01)*smoke*.55 + vec3(.9,.95,1.)*pow(smoke,3.)*.4;
  col = mix(haze, col, smoothstep(.2,1.,uIntro));

  // vignette + fade to the site colour on exit
  col *= 1. - .55*smoothstep(.45, 1.15, r);
  col = mix(col, vec3(0.), smoothstep(.55, 1., uOut));
  gl_FragColor = vec4(col, 1.);
}`;

  let prog, U = {}, texA, texB, sizeA = [1, 1], sizeB = [1, 1];
  const hasA = { v: 0 }, hasB = { v: 0 };
  const makeTex = () => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([5, 5, 5, 255]));
    return t;
  };
  const upload = (t, im) => { gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im); };

  if (gl) {
    try {
      const sh = (type, src) => {
        const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      };
      prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'p');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      ['uA', 'uB', 'uRes', 'uImgA', 'uImgB', 'uTime', 'uMix', 'uIntro', 'uOut', 'uHasA', 'uHasB']
        .forEach(n => { U[n] = gl.getUniformLocation(prog, n); });
      texA = makeTex(); texB = makeTex();
      gl.uniform1i(U.uA, 0); gl.uniform1i(U.uB, 1);
      loader.prepend(canvas);
      loader.classList.add('has-gl');
    } catch (e) { gl = null; }
  }

  const resize = () => {
    if (!gl) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
  };
  resize();
  window.addEventListener('resize', resize);

  // ---------- reel state ----------
  let cur = -1, next = -1, swapAt = 0, lastShot = 0;
  function onImage() {
    if (cur === -1 && reel().length) {
      cur = 0;
      const im = reel()[0];
      if (gl) { upload(texA, im); sizeA = [im.naturalWidth, im.naturalHeight]; hasA.v = 1; }
      thumb.src = im.src;
      lastShot = performance.now();
    }
  }

  // ---------- loop ----------
  let shown = 0, introAt = 0;
  const frame = now => {
    if (finished) return;
    const t = now - start;
    const list = reel();

    // progress: images + page load, eased; held under 100 until the minimum reel time has played
    const real = (imgsDone / SOURCES.length) * 0.6 + (pageLoaded ? 0.4 : 0);
    const timeCap = Math.min(1, t / MIN_MS);
    const target = exiting ? 100 : Math.min(real, timeCap) * 100;
    shown += (target - shown) * (exiting ? 0.25 : 0.08);
    if (target >= 100 && shown > 99.4) shown = 100;
    countEl.textContent = String(Math.floor(shown));
    if (shown >= 100) beginExit(now);

    // advance the reel
    if (cur !== -1 && list.length > 1 && next === -1 && now - lastShot > SHOT_MS && !exiting) {
      next = (cur + 1) % list.length;
      swapAt = now;
      const im = list[next];
      if (gl) { upload(texB, im); sizeB = [im.naturalWidth, im.naturalHeight]; hasB.v = 1; }
    }
    let mix = 0;
    if (next !== -1) {
      mix = Math.min(1, (now - swapAt) / SWAP_MS);
      if (mix > .5 && thumb.dataset.i !== String(next)) { thumb.src = list[next].src; thumb.dataset.i = String(next); }
      if (mix >= 1) {
        // promote B to A
        [texA, texB] = [texB, texA]; sizeA = sizeB; cur = next; next = -1; mix = 0; lastShot = now;
      }
    }

    if (cur !== -1 && !introAt) introAt = now;
    const intro = introAt ? Math.min(1, (now - introAt) / 700) : 0;
    const out = exiting ? Math.min(1, (now - exitAt) / EXIT_MS) : 0;
    loader.style.setProperty('--out', out.toFixed(3));

    if (gl) {
      resize();
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texA);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texB);
      gl.uniform2f(U.uRes, canvas.width, canvas.height);
      gl.uniform2f(U.uImgA, sizeA[0], sizeA[1]);
      gl.uniform2f(U.uImgB, sizeB[0], sizeB[1]);
      gl.uniform1f(U.uTime, t / 1000);
      gl.uniform1f(U.uMix, mix);
      gl.uniform1f(U.uIntro, intro);
      gl.uniform1f(U.uOut, out);
      gl.uniform1f(U.uHasA, hasA.v);
      gl.uniform1f(U.uHasB, next !== -1 ? 1 : 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    if (out >= 1) return finish();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
})();
