(() => {
  'use strict';

  // Perf gate: cap animation framerate to ~30fps on low-end devices (all rAF loops go through this)
  const __nativeRAF = window.requestAnimationFrame.bind(window);
  const __isLowEnd = (navigator.hardwareConcurrency || 8) <= 4;
  let __lastRAFTime = 0;
  const requestAnimationFrame = (cb) => {
    if (!__isLowEnd) return __nativeRAF(cb);
    const tick = (now) => {
      if (now - __lastRAFTime >= 32) { __lastRAFTime = now; cb(now); }
      else __nativeRAF(tick);
    };
    return __nativeRAF(tick);
  };

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isFinePointer = window.matchMedia('(pointer: fine)').matches;
  const page = document.body.dataset.page || 'home';

  /* =========================================================
   * Page transition
   * ========================================================= */
  function ensureTransition() {
    let el = document.querySelector('.page-transition');
    if (!el) {
      el = document.createElement('div');
      el.className = 'page-transition';
      document.body.prepend(el);
    }
    return el;
  }

  function playEnter() {
    const overlay = ensureTransition();
    if (prefersReduced || typeof gsap === 'undefined') {
      gsap?.set(overlay, { scaleY: 0 });
      return;
    }
    gsap.set(overlay, { scaleY: 1, transformOrigin: 'top' });
    gsap.to(overlay, {
      scaleY: 0,
      duration: 0.8,
      ease: 'power4.inOut',
      onComplete: () => overlay.classList.remove('is-covering'),
    });
  }

  function navigateTo(href) {
    if (prefersReduced || typeof gsap === 'undefined') {
      window.location.href = href;
      return;
    }
    const overlay = ensureTransition();
    overlay.classList.add('is-covering');
    gsap.set(overlay, { scaleY: 0, transformOrigin: 'bottom' });
    gsap.to(overlay, {
      scaleY: 1,
      duration: 0.65,
      ease: 'power4.inOut',
      onComplete: () => {
        window.location.href = href;
      },
    });
  }

  function initNavLinks() {
    document.querySelectorAll('a[href]').forEach((link) => {
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto:')) return;
      if (link.target === '_blank') return;
      if (!/\.html($|\?)/.test(href)) return;

      link.addEventListener('click', (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        navigateTo(href);
      });
    });
  }

  /* =========================================================
   * Navbar hide on scroll down / show on scroll up
   * ========================================================= */
  function initNavAutoHide() {
    const nav = document.getElementById('cyber-nav');
    if (!nav) return;

    let lastY = 0;
    let ticking = false;

    const update = (y) => {
      if (y > lastY && y > 80) nav.classList.add('is-hidden');
      else nav.classList.remove('is-hidden');
      lastY = y;
      ticking = false;
    };

    const onScroll = (y) => {
      if (!ticking) {
        requestAnimationFrame(() => update(y));
        ticking = true;
      }
    };

    if (window.__lenis) {
      window.__lenis.on('scroll', ({ scroll }) => onScroll(scroll));
    } else {
      window.addEventListener('scroll', () => onScroll(window.scrollY), { passive: true });
    }

    const toggle = document.getElementById('mobile-toggle');
    const links = document.getElementById('nav-links');
    if (toggle && links) {
      const setOpen = (open) => {
        links.classList.toggle('is-open', open);
        toggle.setAttribute('aria-expanded', String(open));
        // keep the bar visible while the menu is open
        if (open) nav.classList.remove('is-hidden');
      };

      toggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        setOpen(!links.classList.contains('is-open'));
      });

      // pointerup fallback for devices where click is swallowed
      toggle.addEventListener('pointerup', (e) => {
        if (e.pointerType === 'mouse') return;
        e.preventDefault();
        setOpen(!links.classList.contains('is-open'));
      });

      links.querySelectorAll('a').forEach((a) => {
        a.addEventListener('click', () => setOpen(false));
      });

      // close on outside tap
      document.addEventListener('pointerdown', (e) => {
        if (!links.classList.contains('is-open')) return;
        if (nav.contains(e.target)) return;
        setOpen(false);
      }, { passive: true });
    }
  }

  /* =========================================================
   * Custom cursor
   * ========================================================= */
  function initCursor() {
    const dot = document.getElementById('cursor-dot');
    const ring = document.getElementById('cursor-ring');
    if (!isFinePointer || !dot || !ring || prefersReduced || typeof gsap === 'undefined') return;

    document.body.classList.add('has-custom-cursor');
    gsap.set([dot, ring], { opacity: 1, xPercent: -50, yPercent: -50 });

    const xDot = gsap.quickTo(dot, 'x', { duration: 0.12, ease: 'power3.out' });
    const yDot = gsap.quickTo(dot, 'y', { duration: 0.12, ease: 'power3.out' });
    const xRing = gsap.quickTo(ring, 'x', { duration: 0.42, ease: 'power3.out' });
    const yRing = gsap.quickTo(ring, 'y', { duration: 0.42, ease: 'power3.out' });
    const scaleRing = gsap.quickTo(ring, 'scale', { duration: 0.35, ease: 'power2.out' });

    window.addEventListener('mousemove', (e) => {
      xDot(e.clientX);
      yDot(e.clientY);
      xRing(e.clientX);
      yRing(e.clientY);
    });

    document.addEventListener('mouseleave', () => gsap.to([dot, ring], { opacity: 0, duration: 0.2 }));
    document.addEventListener('mouseenter', () => gsap.to([dot, ring], { opacity: 1, duration: 0.2 }));

    document.querySelectorAll('a, button, .holo-card, input, textarea, [data-cursor="hover"]').forEach((el) => {
      el.addEventListener('mouseenter', () => {
        scaleRing(2.35);
        ring.classList.add('is-hover');
      });
      el.addEventListener('mouseleave', () => {
        scaleRing(1);
        ring.classList.remove('is-hover');
      });
    });
  }

  /* =========================================================
   * Lenis
   * ========================================================= */
  function initLenis() {
    if (prefersReduced || typeof Lenis === 'undefined') return null;

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      // Keep native touch scrolling on phones: Lenis' touch interception
      // swallows taps on fixed elements such as the mobile nav toggle.
      syncTouch: false,
    });

    window.__lenis = lenis;
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    return lenis;
  }

  /* =========================================================
   * Magnetic button
   * ========================================================= */
  function initMagnetic() {
    if (!isFinePointer || prefersReduced) return;

    document.querySelectorAll('.btn-magnetic').forEach((btn) => {
      btn.addEventListener('mousemove', (e) => {
        const r = btn.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        gsap.to(btn, { x: x * 0.35, y: y * 0.35, duration: 0.35, ease: 'power3.out' });
      });
      btn.addEventListener('mouseleave', () => {
        gsap.to(btn, { x: 0, y: 0, duration: 0.65, ease: 'elastic.out(1, 0.4)' });
      });
    });
  }

  /* =========================================================
   * Particle canvas
   * ========================================================= */
  function initParticles() {
    const canvas = document.getElementById('particle-canvas');
    const hero = document.getElementById('hero');
    if (!canvas || !hero) return;

    const ctx = canvas.getContext('2d');
    let w = 0;
    let h = 0;
    let dpr = 1;
    let particles = [];
    const mouse = { x: -9999, y: -9999 };
    const count = prefersReduced ? 24 : (window.innerWidth < 768 ? 30 : 55);

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = hero.clientWidth;
      h = hero.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function spawn() {
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        ox: 0,
        oy: 0,
        r: Math.random() * 1.5 + 0.4,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        a: Math.random() * 0.55 + 0.2,
      }));
      particles.forEach((p) => {
        p.ox = p.x;
        p.oy = p.y;
      });
    }

    function frame() {
      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        if (dist < 130) {
          const force = ((130 - dist) / 130) * 4.2;
          p.x += (dx / dist) * force;
          p.y += (dy / dist) * force;
        } else {
          p.x += (p.ox - p.x) * 0.02 + p.vx;
          p.y += (p.oy - p.y) * 0.02 + p.vy;
        }

        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 212, 255, ${p.a})`;
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const ddx = p.x - q.x;
          const ddy = p.y - q.y;
          const d = Math.sqrt(ddx * ddx + ddy * ddy);
          if (d < 90) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = `rgba(178, 75, 255, ${0.14 * (1 - d / 90)})`;
            ctx.lineWidth = 0.7;
            ctx.stroke();
          }
        }
      }

      if (!prefersReduced) requestAnimationFrame(frame);
    }

    resize();
    spawn();
    frame();

    window.addEventListener('resize', () => {
      resize();
      spawn();
    });

    hero.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    });
    hero.addEventListener('mouseleave', () => {
      mouse.x = -9999;
      mouse.y = -9999;
    });
  }

  /* =========================================================
   * Home: preloader + hero
   * ========================================================= */
  function runPreloader(onDone) {
    const preloader = document.getElementById('preloader');
    if (!preloader) {
      onDone();
      return;
    }

    if (prefersReduced) {
      preloader.remove();
      onDone();
      return;
    }

    const percentEl = document.getElementById('charge-percent');
    const barEl = document.getElementById('charge-bar-fill');
    const statusEl = document.getElementById('charge-status');
    const freqEl = document.getElementById('charge-freq');
    const top = document.getElementById('preloader-top');
    const bottom = document.getElementById('preloader-bottom');

    window.__lenis?.stop();
    document.body.style.overflow = 'hidden';

    const stages = [
      { at: 0, text: 'INITIALIZING POWER CORE...', freq: '1.2' },
      { at: 24, text: 'CHARGING QUANTUM CAPACITORS...', freq: '2.6' },
      { at: 52, text: 'SYNCHRONIZING NEURAL INTERFACE...', freq: '4.8' },
      { at: 78, text: 'OVERCLOCKING ENERGY MATRIX...', freq: '6.5' },
      { at: 94, text: 'STABILIZING POWER LEVEL: 100%...', freq: '8.4' },
    ];

    const startTime = performance.now();
    const duration = 1200;

    function frame(now) {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      const eased = t < 0.6 ? Math.pow(t / 0.6, 1.4) * 0.65 : 0.65 + Math.pow((t - 0.6) / 0.4, 0.9) * 0.35;
      const progress = Math.min(100, Math.floor(eased * 100));

      if (percentEl) percentEl.textContent = String(progress);
      if (barEl) barEl.style.width = `${progress}%`;

      for (let s = stages.length - 1; s >= 0; s--) {
        if (progress >= stages[s].at) {
          if (statusEl && statusEl.textContent !== stages[s].text) {
            statusEl.textContent = stages[s].text;
          }
          if (freqEl) freqEl.textContent = stages[s].freq;
          break;
        }
      }

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        if (percentEl) percentEl.textContent = '100';
        if (barEl) barEl.style.width = '100%';
        if (statusEl) statusEl.textContent = 'SYSTEM OVERDRIVE // CHARGE COMPLETE';
        if (freqEl) freqEl.textContent = '9.8';
        preloader.classList.add('is-charged');

        setTimeout(() => {
          preloader.classList.add('is-done');
          const tl = gsap.timeline({
            onComplete: () => {
              preloader.remove();
              document.body.style.overflow = '';
              window.__lenis?.start();
              onDone();
            },
          });
          tl.to('.preloader-charge-hud', { scale: 0.9, opacity: 0, duration: 0.4, ease: 'power2.in' }, 0)
            .to(top, { yPercent: -100, duration: 0.95, ease: 'power4.inOut' }, 0.15)
            .to(bottom, { yPercent: 100, duration: 0.95, ease: 'power4.inOut' }, 0.15);
        }, 320);
      }
    }

    requestAnimationFrame(frame);
  }

  function initHomeHeroIntro() {
    const name = document.querySelector('.hero-name');
    if (name) {
      name.classList.add('glitch');
      gsap.set(name, { opacity: 1 });
      const chars = name.querySelectorAll('.hero-char');
      if (chars.length) {
        gsap.fromTo(
          chars,
          { opacity: 0, y: 28, scale: 0.8, rotateX: -35 },
          { opacity: 1, y: 0, scale: 1, rotateX: 0, duration: 0.75, stagger: 0.05, ease: 'back.out(1.6)', delay: 0.08 }
        );
      }
    }

    gsap.fromTo('.hero-kicker', { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out', delay: 0.15 });

    const rolesEl = document.getElementById('hero-roles');
    const roles = [
      'Frontend Developer',
      'Fullstack Engineer (Laravel & Express)',
      'React & JavaScript Specialist',
      'Python & Database Architecture'
    ];
    let roleIndex = 0;

    gsap.to(rolesEl, { opacity: 1, duration: 0.6, delay: 0.45 });
    gsap.fromTo('.cta-wrap', { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.75, delay: 0.7, ease: 'power3.out' });

    function cycleRoles() {
      if (!rolesEl) return;
      const scrollPos = window.scrollY || (window.__lenis ? window.__lenis.scroll : 0);
      if (scrollPos > 30) return;

      const currentSpan = rolesEl.querySelector('.role-active');
      if (!currentSpan) return;

      gsap.to(currentSpan, {
        opacity: 0,
        y: -8,
        duration: 0.3,
        ease: 'power2.in',
        onComplete: () => {
          const currentScroll = window.scrollY || (window.__lenis ? window.__lenis.scroll : 0);
          if (currentScroll > 30) return;

          roleIndex = (roleIndex + 1) % roles.length;
          rolesEl.innerHTML = `<span class="role-active" style="display:inline-block; opacity:0; transform:translateY(8px);">${roles[roleIndex]}</span>`;
          const nextSpan = rolesEl.querySelector('.role-active');
          if (nextSpan) {
            gsap.to(nextSpan, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' });
          }
        },
      });
    }

    if (rolesEl) {
      rolesEl.innerHTML = `<span class="role-active" style="display:inline-block;">${roles[0]}</span>`;
      if (!prefersReduced) setInterval(cycleRoles, 2400);
    }
  }

  /* =========================================================
 * Interactive Hero Title (BINTANG Cursor Interaction)
 * ========================================================= */
  function initHeroInteractiveTitle() {
    const heroName = document.getElementById('hero-name');
    const hero = document.getElementById('hero');
    if (!heroName || !hero || typeof gsap === 'undefined') return;

    const track = document.getElementById('hero-name-track');
    const spotlight = document.getElementById('hero-name-spotlight');
    const sparksCanvas = document.getElementById('hero-sparks-canvas');
    const ring = document.getElementById('cursor-ring');
    const dot = document.getElementById('cursor-dot');
    const chars = Array.from(heroName.querySelectorAll('.hero-char'));

    if (!track || !chars.length) return;

    // Character state objects
    const charObjects = chars.map((charEl, idx) => {
      const innerEl = charEl.querySelector('.hero-char-inner') || charEl;
      const originalChar = charEl.getAttribute('data-char') || innerEl.textContent.trim() || '';
      return {
        el: charEl,
        innerEl: innerEl,
        char: originalChar,
        idx: idx,
        isScrambling: false,
        qX: gsap.quickTo(charEl, 'x', { duration: 0.18, ease: 'power2.out' }),
        qY: gsap.quickTo(charEl, 'y', { duration: 0.18, ease: 'power2.out' }),
        qZ: gsap.quickTo(charEl, 'z', { duration: 0.18, ease: 'power2.out' }),
        qScale: gsap.quickTo(charEl, 'scale', { duration: 0.18, ease: 'power2.out' }),
        qRot: gsap.quickTo(charEl, 'rotation', { duration: 0.18, ease: 'power2.out' }),
      };
    });

    // 3D Tilt quickTo setters for the entire word track
    const tiltX = gsap.quickTo(track, 'rotationX', { duration: 0.35, ease: 'power2.out' });
    const tiltY = gsap.quickTo(track, 'rotationY', { duration: 0.35, ease: 'power2.out' });

    // Cyber Scramble function
    const glyphs = '01XZΔΨλ#?!><$%*97⚡Ø◈✦';
    function scrambleChar(co, force) {
      if (co.isScrambling && !force) return;
      co.isScrambling = true;

      co.el.classList.add('is-scrambling');
      let step = 0;
      const maxSteps = 7 + Math.floor(Math.random() * 4);

      const interval = setInterval(() => {
        step++;
        if (step >= maxSteps) {
          clearInterval(interval);
          co.innerEl.textContent = co.char;
          co.el.classList.remove('is-scrambling');
          co.el.classList.add('is-locked');
          setTimeout(() => {
            co.el.classList.remove('is-locked');
            co.isScrambling = false;
          }, 380);
        } else {
          co.innerEl.textContent = glyphs[Math.floor(Math.random() * glyphs.length)];
        }
      }, 30);
    }

    // Sparks Canvas system
    let ctx = null;
    let sparks = [];
    let isCanvasActive = false;
    let canvasW = 0;
    let canvasH = 0;

    if (sparksCanvas) {
      ctx = sparksCanvas.getContext('2d');
      function resizeSparks() {
        if (!sparksCanvas) return;
        const rect = sparksCanvas.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvasW = rect.width;
        canvasH = rect.height;
        sparksCanvas.width = canvasW * dpr;
        sparksCanvas.height = canvasH * dpr;
        if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      resizeSparks();
      window.addEventListener('resize', resizeSparks);
    }

    function spawnSparksAt(x, y, count) {
      if (!ctx || prefersReduced) return;
      if (canvasW === 0 || canvasH === 0) resizeSparks();
      const colors = ['#00d4ff', '#b24bff', '#ffffff', '#39ff8e'];
      const num = count || 2;
      for (let i = 0; i < num; i++) {
        if (sparks.length > 50) break;
        sparks.push({
          x: x + (Math.random() - 0.5) * 16,
          y: y + (Math.random() - 0.5) * 12,
          vx: (Math.random() - 0.5) * 4.5,
          vy: -Math.random() * 3.8 - 1.2,
          size: Math.random() * 2.8 + 1.2,
          color: colors[Math.floor(Math.random() * colors.length)],
          life: 1.0,
          decay: Math.random() * 0.035 + 0.025,
          rot: Math.random() * Math.PI * 2,
          vrot: (Math.random() - 0.5) * 0.28,
          isDiamond: Math.random() > 0.4,
        });
      }
      if (!isCanvasActive) {
        isCanvasActive = true;
        requestAnimationFrame(renderSparks);
      }
    }

    function burstSparks(centerX, centerY, count) {
      if (!ctx || prefersReduced) return;
      if (canvasW === 0 || canvasH === 0) resizeSparks();
      const colors = ['#00d4ff', '#b24bff', '#ffffff', '#39ff8e'];
      const num = count || 30;
      for (let i = 0; i < num; i++) {
        const angle = (Math.PI * 2 * i) / num + (Math.random() - 0.5) * 0.3;
        const speed = Math.random() * 5.5 + 2.5;
        sparks.push({
          x: centerX,
          y: centerY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: Math.random() * 3.5 + 1.5,
          color: colors[Math.floor(Math.random() * colors.length)],
          life: 1.0,
          decay: Math.random() * 0.03 + 0.02,
          rot: Math.random() * Math.PI * 2,
          vrot: (Math.random() - 0.5) * 0.35,
          isDiamond: Math.random() > 0.4,
        });
      }
      if (!isCanvasActive) {
        isCanvasActive = true;
        requestAnimationFrame(renderSparks);
      }
    }

    function renderSparks() {
      if (!ctx) return;
      ctx.clearRect(0, 0, canvasW, canvasH);

      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08;
        p.rot += p.vrot;
        p.life -= p.decay;

        if (p.life <= 0) {
          sparks.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;

        if (p.isDiamond) {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        } else {
          const half = p.size / 2;
          ctx.fillRect(-half, -1, p.size, 2);
          ctx.fillRect(-1, -half, 2, p.size);
        }
        ctx.restore();
      }

      if (sparks.length > 0) {
        requestAnimationFrame(renderSparks);
      } else {
        isCanvasActive = false;
        ctx.clearRect(0, 0, canvasW, canvasH);
      }
    }

    // Reset all characters smoothly
    function resetAllChars() {
      charObjects.forEach((co) => {
        gsap.to(co.el, {
          x: 0,
          y: 0,
          z: 0,
          scale: 1,
          rotation: 0,
          duration: 0.65,
          ease: 'elastic.out(1, 0.45)',
          overwrite: 'auto',
        });
        co.innerEl.style.textShadow = '';
        co.innerEl.style.color = '';
      });
      tiltX(0);
      tiltY(0);
      heroName.classList.remove('is-hovered');
      if (ring) ring.classList.remove('is-hero-target');
      if (dot) dot.classList.remove('is-hero-target');
    }

    // Mouse movement handler
    let isHoveringName = false;

    function handleMouseMove(e) {
      if (prefersReduced) return;
      const scrollPos = window.scrollY || (window.__lenis ? window.__lenis.scroll : 0);
      if (scrollPos > 80) {
        if (isHoveringName) resetAllChars();
        return;
      }

      const nameRect = heroName.getBoundingClientRect();
      const nearDistX = Math.max(nameRect.left - 100, Math.min(e.clientX, nameRect.right + 100));
      const nearDistY = Math.max(nameRect.top - 60, Math.min(e.clientY, nameRect.bottom + 60));
      const distToHeroName = Math.hypot(e.clientX - nearDistX, e.clientY - nearDistY);

      if (distToHeroName > 0) {
        if (isHoveringName) {
          isHoveringName = false;
          resetAllChars();
        }
        return;
      }

      // Inside hero name interactive zone
      if (!isHoveringName) {
        isHoveringName = true;
        heroName.classList.add('is-hovered');
        if (ring) ring.classList.add('is-hero-target');
        if (dot) dot.classList.add('is-hero-target');
      }

      // Update spotlight position
      const spotX = e.clientX - nameRect.left;
      const spotY = e.clientY - nameRect.top;
      heroName.style.setProperty('--spot-x', `${spotX}px`);
      heroName.style.setProperty('--spot-y', `${spotY}px`);

      // 3D tilt on track
      const relNormX = (e.clientX - (nameRect.left + nameRect.width / 2)) / (nameRect.width / 2);
      const relNormY = (e.clientY - (nameRect.top + nameRect.height / 2)) / (nameRect.height / 2);
      tiltY(relNormX * 12);
      tiltX(-relNormY * 10);

      // Spawn cyber sparks if canvas exists
      if (sparksCanvas) {
        const cRect = sparksCanvas.getBoundingClientRect();
        const sparkLocalX = e.clientX - cRect.left;
        const sparkLocalY = e.clientY - cRect.top;
        spawnSparksAt(sparkLocalX, sparkLocalY, 1);
      }

      // Magnetic ripple on characters
      const radius = 170;
      charObjects.forEach((co) => {
        const cRect = co.el.getBoundingClientRect();
        const charCenterX = cRect.left + cRect.width / 2;
        const charCenterY = cRect.top + cRect.height / 2;

        const dx = e.clientX - charCenterX;
        const dy = e.clientY - charCenterY;
        const dist = Math.hypot(dx, dy);

        if (dist < radius) {
          const norm = 1 - dist / radius;
          const power = Math.pow(norm, 1.8);

          const liftY = -power * 24;
          const pushX = (dx < 0 ? 1 : -1) * Math.min(Math.abs(dx), 25) * power * 0.35;
          const scale = 1 + power * 0.28;
          const z = power * 45;
          const rot = -dx * 0.08 * power;

          co.qX(pushX);
          co.qY(liftY);
          co.qZ(z);
          co.qScale(scale);
          co.qRot(rot);

          // Glow bloom
          co.innerEl.style.textShadow = `
            0 0 ${8 * power}px #ffffff,
            0 0 ${22 * power}px var(--neon-blue),
            0 0 ${45 * power}px var(--neon-purple),
            0 0 ${75 * power}px rgba(0, 212, 255, 0.5)
          `;
          co.innerEl.style.color = power > 0.5 ? '#ffffff' : '';

          // Trigger scramble if cursor directly sweeps over the character
          if (dist < 42 && !co.isScrambling) {
            scrambleChar(co);
          }
        } else {
          co.qX(0);
          co.qY(0);
          co.qZ(0);
          co.qScale(1);
          co.qRot(0);
          co.innerEl.style.textShadow = '';
          co.innerEl.style.color = '';
        }
      });
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    document.addEventListener('mouseleave', () => {
      isHoveringName = false;
      resetAllChars();
    });

    // Reset when scrolling away
    window.addEventListener('scroll', () => {
      const scrollPos = window.scrollY || (window.__lenis ? window.__lenis.scroll : 0);
      if (scrollPos > 80 && isHoveringName) {
        isHoveringName = false;
        resetAllChars();
      }
    }, { passive: true });

    // Click Shockwave Burst
    heroName.addEventListener('click', () => {
      charObjects.forEach((co, idx) => {
        setTimeout(() => scrambleChar(co, true), idx * 40);
      });

      if (sparksCanvas) {
        const cRect = sparksCanvas.getBoundingClientRect();
        const nRect = heroName.getBoundingClientRect();
        const cx = nRect.left + nRect.width / 2 - cRect.left;
        const cy = nRect.top + nRect.height / 2 - cRect.top;
        burstSparks(cx, cy, 32);
      }

      gsap.fromTo(track,
        { scale: 0.92 },
        { scale: 1, duration: 0.5, ease: 'elastic.out(1.2, 0.35)' }
      );
    });
  }

  /* ---------- Cinematic scroll chapters ---------- */
  function initHeroBlastOff() {
    const hero = document.getElementById('hero');
    const content = document.getElementById('hero-content');
    const name = document.getElementById('hero-name');
    const cta = document.getElementById('cta-wrap');
    const kicker = document.getElementById('hero-kicker');
    const roles = document.getElementById('hero-roles');
    const veil = document.getElementById('hero-blast-veil');
    if (!hero || !content) return;

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: hero,
        start: 'top top',
        end: '+=160%',
        pin: true,
        scrub: 1,
        anticipatePin: 1,
        onLeaveBack: () => {
          gsap.set([kicker, roles, cta], { opacity: 1, y: 0, pointerEvents: 'auto' });
        },
      },
    });

    tl.fromTo([kicker, roles], { opacity: 1, y: 0, pointerEvents: 'auto' }, { opacity: 0, y: -40, pointerEvents: 'none', ease: 'none', duration: 0.25, immediateRender: false }, 0)
      .to(name, { scale: 20, yPercent: -8, ease: 'power1.in', duration: 1 }, 0)
      .fromTo(cta, { opacity: 1, y: 0, pointerEvents: 'auto' }, { opacity: 0, y: 50, pointerEvents: 'none', ease: 'power1.out', duration: 0.3, immediateRender: false }, 0)
      .to(veil, { opacity: 1, ease: 'power1.in', duration: 0.55 }, 0.45)
      .to(content, { opacity: 0, duration: 0.2 }, 0.85);
  }

  function initSignal() {
    gsap.from('.home-strip-inner > *', {
      scrollTrigger: { trigger: '#signal', start: 'top 78%' },
      y: 40,
      opacity: 0,
      duration: 0.9,
      stagger: 0.12,
      ease: 'power3.out',
    });
  }

  function initMantra() {
    const section = document.getElementById('mantra');
    const o = document.getElementById('expand-o');
    const cover = document.getElementById('mantra-cover');
    const flows = document.querySelectorAll('#mantra-live .mantra-flow');
    if (!section || !o) return;

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: '+=220%',
        pin: true,
        scrub: 1,
        anticipatePin: 1,
      },
    });

    tl.fromTo(
      flows,
      { opacity: 0.35, y: 40 },
      { opacity: 1, y: 0, ease: 'none', duration: 0.35 },
      0
    )
      .to(o, { scale: 1.15, ease: 'none', duration: 0.25 }, 0.2)
      .to(
        o,
        {
          scale: 80,
          ease: 'power1.in',
          duration: 0.75,
        },
        0.45
      )
      .to(
        flows,
        { opacity: 0, filter: 'blur(8px)', ease: 'none', duration: 0.35 },
        0.55
      )
      .to(cover, { opacity: 1, ease: 'none', duration: 0.3 }, 0.68)
      .to(cover, { backgroundColor: '#000000', duration: 0.25 }, 0.88);
  }

  function initDecryption() {
    const section = document.getElementById('decrypt');
    const textEl = document.getElementById('decrypt-text');
    const grid = document.getElementById('topo-grid');
    if (!section || !textEl || typeof SplitType === 'undefined') return;

    const original = textEl.textContent;
    const split = new SplitType(textEl, { types: 'chars' });
    const chars = split.chars || [];
    const glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%*&<>/\\';

    chars.forEach((ch) => {
      if (!ch.textContent.trim()) ch.classList.add('is-space');
      ch.dataset.final = ch.textContent;
      gsap.set(ch, { opacity: 0.08 });
    });

    ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: '+=180%',
      pin: true,
      scrub: 1,
      anticipatePin: 1,
      onUpdate: (self) => {
        const p = self.progress;
        gsap.set(grid, { opacity: Math.min(1, p * 1.6) });

        chars.forEach((ch, i) => {
          if (ch.classList.contains('is-space')) {
            ch.style.opacity = '1';
            return;
          }
          const threshold = i / Math.max(chars.length - 1, 1);
          const local = (p - threshold * 0.72) / 0.28;

          if (local < 0) {
            ch.textContent = glyphs[Math.floor(Math.random() * glyphs.length)];
            ch.style.opacity = '0.15';
            ch.style.filter = 'blur(2px)';
          } else if (local < 0.65) {
            ch.textContent = glyphs[Math.floor(Math.random() * glyphs.length)];
            ch.style.opacity = String(0.35 + local * 0.5);
            ch.style.filter = 'blur(1px)';
          } else {
            ch.textContent = ch.dataset.final || '';
            ch.style.opacity = '1';
            ch.style.filter = 'blur(0px)';
          }
        });
      },
    });

    // Keep original accessible for screen readers
    textEl.setAttribute('aria-label', original.trim());
  }

  function initArsenal() {
    const section = document.getElementById('arsenal');
    const track = document.getElementById('arsenal-track');
    if (!section || !track) return;

    const getScroll = () => Math.max(0, track.scrollWidth - window.innerWidth);

    gsap.to(track, {
      x: () => -getScroll(),
      ease: 'none',
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: () => `+=${getScroll() + window.innerHeight * 0.35}`,
        pin: true,
        scrub: 1,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      },
    });

    if (!isFinePointer || prefersReduced) return;

    document.querySelectorAll('.arsenal-panel').forEach((panel) => {
      const glass = panel.querySelector('.arsenal-glass');
      const glare = panel.querySelector('.arsenal-glare');
      if (!glass) return;

      panel.addEventListener('mousemove', (e) => {
        const rect = panel.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width;
        const py = (e.clientY - rect.top) / rect.height;
        glass.style.transform = `rotateX(${(0.5 - py) * 12}deg) rotateY(${(px - 0.5) * 16}deg)`;
        if (glare) {
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          glare.style.opacity = '1';
          glare.style.setProperty('--mouse-x', `${x}px`);
          glare.style.setProperty('--mouse-y', `${y}px`);
        }
      });

      panel.addEventListener('mouseleave', () => {
        glass.style.transform = 'rotateX(0deg) rotateY(0deg)';
        if (glare) {
          glare.style.opacity = '0';
        }
      });
    });
  }

  function initSystemCore() {
    const orbit = document.getElementById('core-orbit');
    if (!orbit) return;

    const nodes = Array.from(orbit.querySelectorAll('[data-orbit]'));
    const home = nodes.map((_, i) => {
      const angle = (Math.PI * 2 * i) / nodes.length - Math.PI / 2;
      const radius = Math.min(orbit.clientWidth, orbit.clientHeight) * 0.34;
      return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
    });

    nodes.forEach((node, i) => {
      gsap.set(node, { x: home[i].x, y: home[i].y, xPercent: -50, yPercent: -50 });
    });

    gsap.from(nodes, {
      scrollTrigger: { trigger: '#core', start: 'top 70%' },
      scale: 0.4,
      opacity: 0,
      duration: 0.9,
      stagger: 0.08,
      ease: 'power3.out',
    });

    if (!isFinePointer || prefersReduced) return;

    const mouse = { x: 0, y: 0 };
    let active = false;

    orbit.addEventListener('mouseenter', () => {
      active = true;
    });
    orbit.addEventListener('mouseleave', () => {
      active = false;
      nodes.forEach((node, i) => {
        gsap.to(node, { x: home[i].x, y: home[i].y, duration: 0.9, ease: 'elastic.out(1, 0.55)' });
      });
    });
    orbit.addEventListener('mousemove', (e) => {
      const rect = orbit.getBoundingClientRect();
      mouse.x = e.clientX - rect.left - rect.width / 2;
      mouse.y = e.clientY - rect.top - rect.height / 2;
    });

    gsap.ticker.add(() => {
      if (!active) return;
      nodes.forEach((node, i) => {
        const hx = home[i].x;
        const hy = home[i].y;
        const dx = hx - mouse.x;
        const dy = hy - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const influence = 160;
        let tx = hx;
        let ty = hy;
        if (dist < influence) {
          const force = ((influence - dist) / influence) * 70;
          tx = hx + (dx / dist) * force;
          ty = hy + (dy / dist) * force;
        }
        gsap.to(node, { x: tx, y: ty, duration: 0.35, ease: 'power2.out', overwrite: 'auto' });
      });
    });

    window.addEventListener('resize', () => {
      const r = Math.min(orbit.clientWidth, orbit.clientHeight) * 0.34;
      nodes.forEach((_, i) => {
        const angle = (Math.PI * 2 * i) / nodes.length - Math.PI / 2;
        home[i].x = Math.cos(angle) * r;
        home[i].y = Math.sin(angle) * r;
      });
    });
  }

  function initDataStream() {
    const section = document.getElementById('data-stream');
    const canvas = document.getElementById('stream-canvas');
    const veil = document.getElementById('stream-veil');
    const content = document.getElementById('stream-content');
    const percentEl = document.getElementById('stream-percent');
    const barEl = document.getElementById('stream-bar');
    const statusEl = document.getElementById('stream-status');
    const titleEl = section?.querySelector('.stream-title');
    if (!section || !canvas) return;

    const ctx = canvas.getContext('2d');
    let w = 0;
    let h = 0;
    let dpr = 1;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = section.clientWidth;
      h = section.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    const chars = '0101010101ABCDEF9876543210XYZ<>[]{}/*+=~_';
    const fontSize = 14;
    let columns = 0;
    let drops = [];

    function initDrops() {
      columns = Math.floor(w / fontSize);
      drops = Array.from({ length: columns }, () => Math.floor(Math.random() * -60));
    }

    resize();
    initDrops();

    window.addEventListener('resize', () => {
      resize();
      initDrops();
    });

    function draw() {
      ctx.fillStyle = 'rgba(3, 4, 10, 0.2)';
      ctx.fillRect(0, 0, w, h);

      ctx.font = `${fontSize}px 'JetBrains Mono', monospace`;

      for (let i = 0; i < drops.length; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;

        if (Math.random() > 0.88) {
          ctx.fillStyle = 'rgba(0, 212, 255, 0.9)';
          ctx.shadowColor = 'rgba(0, 212, 255, 0.7)';
          ctx.shadowBlur = 8;
        } else {
          ctx.fillStyle = 'rgba(55, 65, 85, 0.45)';
          ctx.shadowBlur = 0;
        }

        ctx.fillText(char, x, y);

        if (y > h && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i] += 1.6;
      }

      if (!prefersReduced) requestAnimationFrame(draw);
    }

    if (!prefersReduced) draw();

    // Cinematic 3-Phase ScrollTrigger: Entry -> Processing -> Exit
    const counterObj = { val: 0 };

    const updateMetrics = (v) => {
      const rounded = Math.min(100, Math.floor(v));
      if (percentEl) percentEl.textContent = String(rounded);
      if (barEl) barEl.style.width = `${rounded}%`;
      if (statusEl) {
        if (rounded >= 100) {
          statusEl.textContent = 'System Optimized. No Bottlenecks.';
          statusEl.classList.add('is-optimized');
        } else if (rounded >= 70) {
          statusEl.textContent = `Compiling execution tree: ${rounded}%`;
          statusEl.classList.remove('is-optimized');
        } else if (rounded >= 35) {
          statusEl.textContent = `Eliminating latency spikes: ${rounded}%`;
          statusEl.classList.remove('is-optimized');
        } else {
          statusEl.textContent = `Optimizing throughput: ${rounded}%`;
          statusEl.classList.remove('is-optimized');
        }
      }
    };

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: '+=240%',
        pin: true,
        scrub: 1,
        anticipatePin: 1,
        onLeaveBack: () => {
          updateMetrics(0);
          if (veil) gsap.set(veil, { opacity: 1 });
          if (content) gsap.set(content, { opacity: 0, scale: 0.88, y: 35 });
          if (canvas) gsap.set(canvas, { opacity: 0 });
        },
      },
    });

    // Phase 1: Entry Transition (0.00 -> 0.18)
    tl.fromTo(veil, { opacity: 1 }, { opacity: 0, ease: 'power2.out', duration: 0.18 }, 0)
      .fromTo(
        content,
        { opacity: 0, scale: 0.88, y: 35, filter: 'blur(10px)' },
        { opacity: 1, scale: 1, y: 0, filter: 'blur(0px)', ease: 'power2.out', duration: 0.18 },
        0
      )
      .fromTo(canvas, { opacity: 0 }, { opacity: 0.85, ease: 'power1.out', duration: 0.18 }, 0)

      // Phase 2: Processing & Calculation Sequence (0.20 -> 0.74)
      .to(
        counterObj,
        {
          val: 100,
          ease: 'power2.inOut',
          duration: 0.54,
          onUpdate: () => updateMetrics(counterObj.val),
        },
        0.2
      )
      .to(titleEl, { letterSpacing: '0.12em', duration: 0.54, ease: 'none' }, 0.2)

      // Phase 3: Hold at 100% (0.74 -> 0.82) natural hold

      // Phase 4: Exit Transition (0.82 -> 1.00)
      .to(
        content,
        { opacity: 0, scale: 1.06, y: -45, filter: 'blur(8px)', ease: 'power2.in', duration: 0.18 },
        0.82
      )
      .to(veil, { opacity: 1, ease: 'power2.in', duration: 0.18 }, 0.82)
      .to(canvas, { opacity: 0, ease: 'power2.in', duration: 0.18 }, 0.82);
  }

  function initNeuralTimeline() {
    const section = document.getElementById('neural-timeline');
    const beam = document.getElementById('timeline-beam');
    if (!section || !beam) return;

    gsap.fromTo(
      beam,
      { scaleY: 0, transformOrigin: 'top center' },
      {
        scaleY: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top 65%',
          end: 'bottom 75%',
          scrub: 0.6,
        },
      }
    );

    const items = section.querySelectorAll('.timeline-item');
    items.forEach((item) => {
      const isLeft = item.classList.contains('timeline-left');
      const dot = item.querySelector('.timeline-node-dot');
      const card = item.querySelector('.timeline-card');

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: item,
          start: 'top 75%',
          toggleActions: 'play reverse play reverse',
        },
      });

      tl.to(dot, { scale: 1.3, duration: 0.35, ease: 'back.out(2)' }, 0)
        .fromTo(
          card,
          { opacity: 0, x: isLeft ? -50 : 50 },
          { opacity: 1, x: 0, duration: 0.7, ease: 'power3.out' },
          0.1
        );
    });
  }

  /* =========================================================
   * 04 — THE OMNISCIENT TEXT
   * (stacked giant text → unravel → convergence + flashbang)
   * ========================================================= */
  function initOmniscientText() {
    const section = document.getElementById('omniscient-text');
    const labelEl = document.getElementById('omni-label');
    const lines = gsap.utils.toArray('.omni-line');
    const revealEl = document.getElementById('omni-reveal');
    const flashEl = document.getElementById('omni-flashbang');
    if (!section || !lines.length || !revealEl || !flashEl) return;

    /* ---- 1. Split the giant phrases into chars ---- */
    let chars = [];
    if (typeof SplitType !== 'undefined') {
      const split = new SplitType(lines, { types: 'chars,words' });
      chars = split.chars || [];
    }
    if (!chars.length) chars = lines;

    /* ---- 2. Readable stacked layout — each phrase on its own row ---- */
    const layout = [
      { x: -4, rotation: -1.5 },
      { x: 4, rotation: 1.5 },
      { x: 0, rotation: 0 },
    ];

    const applyLayout = () => {
      lines.forEach((line, i) => {
        const conf = layout[i % layout.length];
        gsap.set(line, {
          x: `${conf.x}vw`,
          y: 0,
          rotation: conf.rotation,
          scale: 1,
          opacity: 1,
        });
      });
    };
    applyLayout();

    /* ---- 3. Precomputed flight vectors per char (scrub-stable) ---- */
    const flights = chars.map(() => ({
      x: gsap.utils.random(28, 85) * (Math.random() > 0.5 ? 1 : -1),
      y: gsap.utils.random(30, 90) * (Math.random() > 0.5 ? 1 : -1),
      z: gsap.utils.random(-500, 500),
      rx: gsap.utils.random(-120, 120),
      ry: gsap.utils.random(-120, 120),
      rot: gsap.utils.random(-220, 220),
    }));

    /* ---- 4. Initial states ---- */
    gsap.set(chars, { opacity: 0, transformPerspective: 700 });
    gsap.set(revealEl, { xPercent: -50, yPercent: -50, opacity: 0, scale: 0.94, filter: 'blur(12px)' });
    gsap.set(flashEl, { opacity: 0 });
    if (labelEl) gsap.set(labelEl, { opacity: 0, y: 14 });

    /* ---- 5. Master scrubbed timeline (400vh) ---- */
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: '+=400%',
        pin: true,
        scrub: 1,
        anticipatePin: 1,
        onLeaveBack: () => {
          applyLayout();
          gsap.set(chars, { opacity: 0, x: 0, y: 0, z: 0, rotationX: 0, rotationY: 0, rotation: 0, scale: 1 });
          gsap.set(revealEl, { opacity: 0, scale: 0.94, filter: 'blur(12px)' });
          gsap.set(flashEl, { opacity: 0 });
          if (labelEl) gsap.set(labelEl, { opacity: 0, y: 14 });
        },
      },
    });

    /* =============================================
       PHASE 1 : 0.00 → 0.12 — CHAOS
       Giant letters slam into a random overlapping pile
    =============================================== */
    if (labelEl) {
      tl.to(labelEl, { opacity: 0.7, y: 0, ease: 'power2.out', duration: 0.05 }, 0);
    }

    tl.fromTo(
      chars,
      { opacity: 0, scale: 1.8, z: 260 },
      {
        opacity: 1,
        scale: 1,
        z: 0,
        ease: 'power3.out',
        duration: 0.08,
        stagger: { each: 0.0008, from: 'random' },
      },
      0
    );

    /* =============================================
       PHASE 2 : 0.12 → 0.52 — UNRAVEL
       Chars explode away in random XYZ vectors
    =============================================== */
    tl.to(
      chars,
      {
        x: (i) => `${flights[i].x}vw`,
        y: (i) => `${flights[i].y}vh`,
        z: (i) => flights[i].z,
        rotationX: (i) => flights[i].rx,
        rotationY: (i) => flights[i].ry,
        rotation: (i) => flights[i].rot,
        opacity: 0,
        ease: 'power2.in',
        duration: 0.3,
        stagger: { each: 0.0018, from: 'random' },
      },
      0.12
    );

    /* Blood-red neon text fades in slowly inside the emptied center */
    tl.to(
      revealEl,
      { opacity: 1, scale: 1, filter: 'blur(0px)', ease: 'power1.inOut', duration: 0.34 },
      0.16
    );

    /* =============================================
       PHASE 3 : 0.60 → 0.87 — CONVERGENCE
       Brutal suck-back: letters return and swallow the red sentence
    =============================================== */
    tl.to(
      chars,
      {
        x: 0,
        y: 0,
        z: 0,
        rotationX: 0,
        rotationY: 0,
        rotation: 0,
        opacity: 1,
        ease: 'power4.in',
        duration: 0.2,
        stagger: { each: 0.0012, from: 'random' },
      },
      0.6
    );

    tl.to(
      revealEl,
      { opacity: 0, scale: 0.08, filter: 'blur(14px)', ease: 'power3.in', duration: 0.16 },
      0.68
    );

    /* The reformed block charges for a split second */
    tl.to(
      lines,
      { scale: 1.1, ease: 'power2.in', duration: 0.05 },
      0.84
    );

    /* =============================================
       FLASHBANG : 0.90 → 1.00
       White screen-wipe, then reset to pitch black
    =============================================== */
    if (labelEl) {
      tl.to(labelEl, { opacity: 0, y: -10, ease: 'power2.in', duration: 0.04 }, 0.88);
    }

    tl.to(flashEl, { opacity: 1, ease: 'power2.in', duration: 0.035 }, 0.9)
      .set(chars, { opacity: 0 }, 0.945)
      .set(lines, { opacity: 0 }, 0.945)
      .set(revealEl, { opacity: 0 }, 0.945)
      .to(flashEl, { opacity: 0, ease: 'power1.out', duration: 0.05 }, 0.95);
  }

  function initVoid() {
    const reveal = document.querySelector('.void-reveal');
    const laser = document.getElementById('void-laser');
    const cta = document.getElementById('void-cta');
    if (!reveal || !laser || !cta) return;

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: reveal,
        start: 'top top',
        end: '+=140%',
        pin: true,
        scrub: 1,
        anticipatePin: 1,
      },
    });

    tl.fromTo(laser, { width: 0, opacity: 0 }, { width: '120vw', opacity: 1, ease: 'none', duration: 0.45 }, 0)
      .to(cta, { opacity: 1, clipPath: 'inset(0% 0% 0% 0%)', ease: 'none', duration: 0.4 }, 0.35)
      .to(laser, { opacity: 0.35, duration: 0.2 }, 0.55);
  }

  /* =========================================================
   * 03 — THE GRID / SYSTEM METRICS
   * ========================================================= */
  function initTheGrid() {
    const section = document.getElementById('the-grid');
    const canvas = document.getElementById('grid-bg-canvas');
    const layers = [
      document.getElementById('grid-layer-0'),
      document.getElementById('grid-layer-1'),
      document.getElementById('grid-layer-2'),
    ];
    const labelEl = document.getElementById('grid-progress-label');
    if (!section || layers.some((l) => !l)) return;

    /* ----- Flickering grid canvas background ----- */
    if (canvas) {
      const ctx = canvas.getContext('2d');
      let w, h;
      const resize = () => {
        w = canvas.width = section.clientWidth;
        h = canvas.height = section.clientHeight;
      };
      resize();
      window.addEventListener('resize', resize, { passive: true });

      const CELL = 60;
      const cells = [];
      const buildCells = () => {
        cells.length = 0;
        for (let x = 0; x < w; x += CELL) {
          for (let y = 0; y < h; y += CELL) {
            cells.push({ x, y, alpha: Math.random() * 0.08, timer: Math.random() * 120 });
          }
        }
      };
      buildCells();

      const drawGrid = () => {
        ctx.clearRect(0, 0, w, h);
        ctx.strokeStyle = '#00d4ff';
        ctx.lineWidth = 0.5;
        cells.forEach((c) => {
          c.timer--;
          if (c.timer <= 0) {
            c.alpha = Math.random() * 0.14;
            c.timer = 40 + Math.random() * 160;
          }
          ctx.globalAlpha = c.alpha;
          ctx.strokeRect(c.x, c.y, CELL, CELL);
        });
        ctx.globalAlpha = 1;
        if (!prefersReduced) requestAnimationFrame(drawGrid);
      };
      if (!prefersReduced) drawGrid();
    }

    const labels = ['Dive into the data layer', '01 — LOGIC', '02 — AUTOMATION', '03 — PREDICTION'];

    /* ----- Set initial states ----- */
    // Layer 0 visible, 1&2 hidden below
    gsap.set(layers[0], { opacity: 1, scale: 0.7 });
    gsap.set([layers[1], layers[2]], { opacity: 0, scale: 0.5, y: 80 });

    const masterTl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: '+=320%',
        pin: true,
        scrub: 1,
        anticipatePin: 1,
        onUpdate: (self) => {
          const p = self.progress;
          const idx = p < 0.05 ? 0 : p < 0.42 ? 1 : p < 0.72 ? 2 : 3;
          if (labelEl && labelEl.textContent !== labels[idx]) {
            labelEl.textContent = labels[idx];
          }
        },
        onLeaveBack: () => {
          gsap.set(layers[0], { opacity: 1, scale: 0.7, x: 0 });
          gsap.set([layers[1], layers[2]], { opacity: 0, scale: 0.5, y: 80, x: 0 });
          if (labelEl) labelEl.textContent = labels[0];
        },
      },
    });

    // Phase 1: Layer 0 slams in large (0 → 0.15)
    masterTl.to(layers[0], { scale: 1.4, ease: 'power2.out', duration: 0.15 }, 0)
      // Phase 2: Layer 0 splits apart (0.15 → 0.38) — num goes left, word goes right
      .to(layers[0].querySelector('.grid-num'), { x: '-55vw', opacity: 0, ease: 'power3.in', duration: 0.23 }, 0.15)
      .to(layers[0].querySelector('.grid-word'), { x: '55vw', opacity: 0, ease: 'power3.in', duration: 0.23 }, 0.15)

      // Phase 3: Layer 1 enters from below (0.32 → 0.50)
      .to(layers[1], { opacity: 1, scale: 0.8, y: 0, ease: 'power2.out', duration: 0.2 }, 0.33)
      .to(layers[1], { scale: 1.4, ease: 'power2.out', duration: 0.15 }, 0.50)
      // Layer 1 splits (0.50 → 0.65)
      .to(layers[1].querySelector('.grid-num'), { x: '-55vw', opacity: 0, ease: 'power3.in', duration: 0.18 }, 0.50)
      .to(layers[1].querySelector('.grid-word'), { x: '55vw', opacity: 0, ease: 'power3.in', duration: 0.18 }, 0.50)

      // Phase 4: Layer 2 enters (0.62 → 0.78)
      .to(layers[2], { opacity: 1, scale: 0.8, y: 0, ease: 'power2.out', duration: 0.18 }, 0.63)
      .to(layers[2], { scale: 1, ease: 'power2.out', duration: 0.15 }, 0.78)

      // Phase 5: Hold + Fade out (0.88 → 1.0)
      .to(layers[2], { opacity: 0, scale: 0.85, filter: 'blur(6px)', ease: 'power2.in', duration: 0.14 }, 0.87);
  }

  /* =========================================================
   * 04 — CORE PHILOSOPHY (pinned kinetic text + glass card)
   * ========================================================= */
  function initCorePhilosophy() {
    const section = document.getElementById('core-philosophy');
    const pin = document.getElementById('philo-pin');
    const row1 = document.getElementById('philo-row-1');
    const row2 = document.getElementById('philo-row-2');
    const row3 = document.getElementById('philo-row-3');
    const card = section?.querySelector('.philo-glass-card');
    if (!section || !row1 || !row2 || !row3) return;

    /* --- Initial card state --- */
    if (card) gsap.set(card, { opacity: 0, scale: 0.88, y: 50 });

    /* --- Row initial offsets (slightly off-screen) --- */
    gsap.set(row1, { xPercent: -30 });
    gsap.set(row2, { xPercent: 30 });
    gsap.set(row3, { xPercent: -30 });

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: '+=300%',
        pin: true,
        scrub: 1.2,
        anticipatePin: 1,
      },
    });

    // Kinetic rows sweep (runs throughout 0 → 1)
    tl.to(row1, { xPercent: 10, ease: 'none', duration: 1 }, 0)
      .to(row2, { xPercent: -10, ease: 'none', duration: 1 }, 0)
      .to(row3, { xPercent: 10, ease: 'none', duration: 1 }, 0);

    // Card fade-in at the middle (0.35 → 0.55)
    if (card) {
      tl.to(card, { opacity: 1, scale: 1, y: 0, ease: 'power2.out', duration: 0.18 }, 0.35)
        // Card fade-out at exit (0.82 → 1.0)
        .to(card, { opacity: 0, scale: 0.94, y: -40, filter: 'blur(8px)', ease: 'power2.in', duration: 0.16 }, 0.83);
    }
  }

  /* =========================================================
   * 05 — THE SINGULARITY
   * (implosion → light block → shatter → philosophy → void)
   * ========================================================= */
  function initSingularity() {
    const section = document.getElementById('the-singularity');
    const fragField = document.getElementById('sng-fragment-field');
    const flashCore = document.getElementById('sng-flash-core');
    const flashRing = document.getElementById('sng-flash-ring');
    const shatterField = document.getElementById('sng-shatter-field');
    const labelEl = document.getElementById('sng-label');
    const quoteEl = document.getElementById('sng-quote');
    if (!section || !fragField || !flashCore || !shatterField || !quoteEl) return;

    /* ---- 1. Code shard pool — hundreds of fragments in the void ---- */
    const TOKENS = [
      'React.useState', 'express()', 'Route::get', 'useEffect', 'SELECT *',
      'PostgreSQL', 'MySQL', 'Python', 'def main():', 'async/await',
      'Laravel', 'Tailwind', 'REST API', 'JSON.stringify', 'req, res',
      'Eloquent::all', 'props.children', 'Component', 'fetch()', 'Promise.all',
      'middleware', 'schema.sql', 'jwt.sign', 'useState()', 'Router()',
      '<div>', 'Controller', 'migration.up', 'try/catch', 'const [data]',
    ];

    const FRAG_COUNT = window.innerWidth < 720 ? 50 : 90;
    const frags = [];

    for (let i = 0; i < FRAG_COUNT; i++) {
      const el = document.createElement('span');
      el.className = 'code-shard';
      el.textContent = TOKENS[i % TOKENS.length];
      const sx = (Math.random() - 0.5) * 1.9 * window.innerWidth;
      const sy = (Math.random() - 0.5) * 1.9 * window.innerHeight;
      gsap.set(el, {
        left: '50%',
        top: '50%',
        xPercent: -50,
        yPercent: -50,
        x: sx,
        y: sy,
        opacity: 0,
        scale: 0.35 + Math.random() * 0.75,
        rotation: (Math.random() - 0.5) * 70,
      });
      fragField.appendChild(el);
      frags.push({ el, sx, sy });
    }

    /* ---- 2. Shatter debris ---- */
    const SHARD_COUNT = 60;
    const shards = [];
    for (let i = 0; i < SHARD_COUNT; i++) {
      const shard = document.createElement('div');
      shard.className = 'sng-shard';
      shatterField.appendChild(shard);
      shards.push({
        el: shard,
        angle: (i / SHARD_COUNT) * 360,
        dist: 28 + Math.random() * 60,
      });
    }

    const fragEls = frags.map((f) => f.el);
    const shardEls = shards.map((s) => s.el);
    gsap.set(shardEls, { opacity: 0, x: 0, y: 0, scale: 0.1 });

    /* ---- 3. SplitType the philosophy quote (fade-up per char) ---- */
    quoteEl.style.color = 'rgba(255, 255, 255, 0.88)';
    let chars = [];
    if (typeof SplitType !== 'undefined') {
      const split = new SplitType(quoteEl, { types: 'chars,words' });
      chars = split.chars || [];
    }
    gsap.set(chars, { opacity: 0, y: 22 });
    if (labelEl) gsap.set(labelEl, { opacity: 0, y: 12 });

    /* ---- 4. Master scrubbed timeline (300vh) ---- */
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: '+=300%',
        pin: true,
        scrub: 1,
        anticipatePin: 1,
        onLeaveBack: () => {
          frags.forEach(({ el, sx, sy }) => {
            gsap.set(el, {
              x: sx,
              y: sy,
              opacity: 0,
              scale: 0.35 + Math.random() * 0.6,
              rotation: (Math.random() - 0.5) * 70,
            });
          });
          gsap.set(flashCore, { opacity: 0, scale: 1, boxShadow: '0 0 0px 0px rgba(255,255,255,0)' });
          if (flashRing) gsap.set(flashRing, { opacity: 0, scale: 0 });
          gsap.set(shardEls, { opacity: 0, x: 0, y: 0, scale: 0.1 });
          gsap.set(chars, { opacity: 0, y: 22 });
          if (labelEl) gsap.set(labelEl, { opacity: 0, y: 12 });
        },
      },
    });

    /* =============================================
       PHASE 1a : 0.00 → 0.08 — shards materialize, scattered
    =============================================== */
    tl.to(
      fragEls,
      {
        opacity: 1,
        scale: 1,
        ease: 'power2.out',
        duration: 0.08,
        stagger: { each: 0.0006, from: 'random' },
      },
      0
    );

    /* =============================================
       PHASE 1b : 0.08 → 0.38 — BRUTAL IMPLOSION
       Every shard is sucked into the exact center
    =============================================== */
    tl.to(
      fragEls,
      {
        x: 0,
        y: 0,
        scale: 0.06,
        rotation: 0,
        opacity: 0.7,
        ease: 'power3.in',
        duration: 0.3,
        stagger: { each: 0.0008, from: 'random' },
      },
      0.08
    );

    /* =============================================
       PHASE 1c : 0.34 → 0.46 — CONVERGENCE
       The mass detonates into a blinding light block
    =============================================== */
    tl.to(
      flashCore,
      {
        opacity: 1,
        scale: 7,
        boxShadow:
          '0 0 90px 55px rgba(255, 255, 255, 0.95), 0 0 220px 140px rgba(0, 212, 255, 0.55)',
        ease: 'power4.out',
        duration: 0.12,
      },
      0.34
    )
      .to(fragEls, { opacity: 0, ease: 'power1.in', duration: 0.06 }, 0.38)
      .to(flashRing, { opacity: 0.85, scale: 4.5, ease: 'power3.out', duration: 0.1 }, 0.38);

    /* =============================================
       PHASE 2a : 0.48 → 0.62 — SHATTER
       The light block breaks apart and vanishes outward
    =============================================== */
    tl.to(
      flashCore,
      {
        scale: 32,
        opacity: 0,
        boxShadow: '0 0 0px 0px rgba(255, 255, 255, 0)',
        ease: 'power1.in',
        duration: 0.09,
      },
      0.48
    ).to(flashRing, { opacity: 0, scale: 14, ease: 'power2.in', duration: 0.1 }, 0.48);

    shards.forEach(({ el, angle, dist }) => {
      const rad = (angle * Math.PI) / 180;
      tl.fromTo(
        el,
        { opacity: 0, x: 0, y: 0, scale: 0.1, rotation: angle },
        {
          opacity: 0.9,
          x: `${Math.cos(rad) * dist}vw`,
          y: `${Math.sin(rad) * dist}vh`,
          scale: 1,
          rotation: angle + gsap.utils.random(-90, 90),
          ease: 'power4.out',
          duration: 0.14,
        },
        0.48
      );
    });

    tl.to(shardEls, { opacity: 0, ease: 'power2.in', duration: 0.1 }, 0.58);

    /* =============================================
       PHASE 2b : 0.56 → 0.83 — PHILOSOPHY REVEAL
       The new text rises from behind the wreckage
    =============================================== */
    if (labelEl) {
      tl.to(labelEl, { opacity: 0.75, y: 0, ease: 'power2.out', duration: 0.08 }, 0.56);
    }

    if (chars.length) {
      tl.to(
        chars,
        {
          opacity: 1,
          y: 0,
          ease: 'power3.out',
          duration: 0.18,
          stagger: { each: 0.0005, from: 'start' },
        },
        0.6
      );
    } else {
      tl.to(quoteEl, { opacity: 1, y: 0, ease: 'power3.out', duration: 0.18 }, 0.6);
    }

    /* =============================================
       PHASE 3 : 0.85 → 0.99 — FADE TO VOID
       Text drifts up and dissolves into darkness
    =============================================== */
    if (chars.length) {
      tl.to(
        chars,
        {
          opacity: 0,
          y: -30,
          filter: 'blur(6px)',
          ease: 'power2.in',
          duration: 0.1,
          stagger: { each: 0.0003, from: 'end' },
        },
        0.85
      );
    } else {
      tl.to(quoteEl, { opacity: 0, y: -30, filter: 'blur(6px)', ease: 'power2.in', duration: 0.1 }, 0.85);
    }

    if (labelEl) {
      tl.to(labelEl, { opacity: 0, y: -20, ease: 'power2.in', duration: 0.1 }, 0.86);
    }
  }

  function initCinematicHome() {
    if (prefersReduced) {
      initSignal();
      return;
    }
    initHeroBlastOff();
    initSignal();
    initMantra();
    initTheGrid();
    initCorePhilosophy();
    initDecryption();
    initArsenal();
    initSystemCore();
    initDataStream();
    initNeuralTimeline();
    initOmniscientText();
    initSingularity();
    initVoid();
    requestAnimationFrame(() => ScrollTrigger.refresh());
  }

  function initHome() {
    initParticles();
    initMagnetic();
    initHeroInteractiveTitle();
    runPreloader(() => {
      initHomeHeroIntro();
      initCinematicHome();
    });
  }



  /* =========================================================
   * Projects: holographic tilt + stagger
   * ========================================================= */
  /* =========================================================
   * Projects: list layout + floating preview
   * ========================================================= */
  function initProjects() {
    const rows = gsap.utils.toArray('.project-row');
    const preview = document.getElementById('project-preview');
    const previewMockup = document.getElementById('preview-mockup');
    const previewLabel = document.getElementById('preview-label');

    // ── Stagger-in entrance ──
    if (rows.length) {
      gsap.to(rows, {
        opacity: 1,
        y: 0,
        duration: 0.75,
        stagger: 0.09,
        ease: 'power3.out',
        delay: 0.2,
      });
    }

    // ── Filter tabs ──
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        filterBtns.forEach((b) => {
          b.classList.remove('is-active');
          b.setAttribute('aria-selected', 'false');
        });
        btn.classList.add('is-active');
        btn.setAttribute('aria-selected', 'true');
        const filter = btn.dataset.filter;
        rows.forEach((row) => {
          const tags = row.dataset.filterTags || 'all';
          if (filter === 'all' || tags.includes(filter)) {
            row.classList.remove('is-hidden');
            gsap.fromTo(row, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' });
          } else {
            row.classList.add('is-hidden');
          }
        });
      });
    });

    // ── Floating preview (fine pointer only) ──
    if (!preview || !isFinePointer || prefersReduced) return;

    // GSAP quickTo for butter-smooth follow
    const moveX = gsap.quickTo(preview, 'x', { duration: 0.4, ease: 'power3.out' });
    const moveY = gsap.quickTo(preview, 'y', { duration: 0.4, ease: 'power3.out' });

    rows.forEach((row) => {
      row.addEventListener('mouseenter', () => {
        const accent = row.dataset.previewColor || '#00d4ff';
        const label = row.dataset.previewLabel || '';

        if (previewMockup) {
          previewMockup.style.setProperty('--preview-accent', accent + '1a');
        }
        if (previewLabel) {
          previewLabel.textContent = label;
          previewLabel.style.color = accent;
        }
        preview.style.boxShadow = '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px ' + accent + '44';
        preview.classList.add('is-visible');
      }, { passive: true });

      row.addEventListener('mouseleave', () => {
        preview.classList.remove('is-visible');
      }, { passive: true });

      row.addEventListener('mousemove', (e) => {
        const offsetX = 28;
        const offsetY = -180;
        const vw = window.innerWidth;
        const previewW = 320;
        let x = e.clientX + offsetX;
        if (x + previewW > vw - 20) {
          x = e.clientX - previewW - offsetX;
        }
        const y = e.clientY + offsetY;
        moveX(x);
        moveY(y);
      }, { passive: true });
    });
  }

  /* =========================================================
   * About: terminal typing + radar already CSS-animated
   * ========================================================= */
  /* =========================================================
   * Detail page scroll-to-next
   * ========================================================= */
  function initDetailScrollNext() {
    if (document.body.dataset.page !== 'project-detail') return;
    const currentPath = window.location.pathname;
    const nextMap = {
      'project-valorant.html': 'project-dispora.html',
      'project-dispora.html': 'project-ticketing.html',
      'project-ticketing.html': 'project-valorant.html',
    };
    const next = nextMap[currentPath.split('/').pop()] || null;
    if (!next) return;

    let navigated = false;
    let chargePct = 0;
    let lastScrollY = -1;
    let accumulatedDelta = 0;
    let mouseX = -1;
    let mouseY = -1;

    // ---- Static charge box: created ONCE, permanently visible at the bottom ----
    const chargeEl = document.createElement('div');
    chargeEl.id = 'scroll-charge-box';
    chargeEl.innerHTML = '<div style="text-align:center; padding: 6px 24px;">'
      + '<div style="font-size: 20px; letter-spacing: 0.08em; font-family: Orbitron, sans-serif; color: #fff; line-height: 1.2;">Revealing next project <span style="color:#00d4ff;">↗</span></div>'
      + '<div id="charge-segments" style="margin: 12px auto 8px; display: flex; gap: 4px; justify-content: center; align-items: center; height: 6px;">'
      + Array.from({ length: 10 }, (_, i) => `<div data-seg="${i}" style="width: 26px; height: 6px; background: #00d4ff; border-radius: 1px; opacity: 0.15; transition: opacity 0.15s;"></div>`).join('')
      + '</div>'
      + '<div id="charge-caption" style="font-family: Share Tech Mono, monospace; font-size: 10px; letter-spacing: 0.2em; color: #aaa;">SCROLL DOWN TO CHARGE ↓</div>'
      + '</div>';
    chargeEl.style.cssText = [
      'position: relative', 'display: block', 'width: 100%', 'margin-top: 40px',
      'background: rgba(6,8,14,0.92)',
      'border-top: 1px solid rgba(0,212,255,0.18)', 'padding: 56px 24px 64px',
      'color: #fff', 'font-family: Share Tech Mono, monospace', 'font-size: 11px', 'letter-spacing: 0.12em',
      'text-align: center', 'box-sizing: border-box',
    ].join('; ') + ';';
    const pageFooter = document.querySelector('.site-footer');
    if (pageFooter && pageFooter.parentNode) {
      pageFooter.parentNode.insertBefore(chargeEl, pageFooter);
    } else {
      document.body.appendChild(chargeEl);
    }

    const segEls = Array.from(chargeEl.querySelectorAll('[data-seg]'));
    const captionEl = chargeEl.querySelector('#charge-caption');

    const updateCharge = (pct) => {
      chargePct = Math.max(0, Math.min(100, pct));
      const active = Math.floor((chargePct / 100) * segEls.length + 0.0001);
      segEls.forEach((seg, i) => { seg.style.opacity = i < active ? '1' : '0.15'; });
      if (captionEl) {
        captionEl.textContent = chargePct >= 100
          ? 'RELEASED → NEXT PROJECT'
          : 'SCROLL DOWN TO CHARGE ↓';
      }
    };

    // Hover detection from raw pointer coordinates — immune to enter/leave edge cases
    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    }, { passive: true });

    const isOverCharge = () => {
      if (mouseX < 0 || mouseY < 0) return false;
      const r = chargeEl.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      // The box may be taller than the remaining viewport: clamp to the visible part,
      // and treat "pointer anywhere in the bottom half of the screen" as engaging with it.
      const top = Math.max(r.top, window.innerHeight * 0.5);
      const bottom = Math.min(r.bottom, window.innerHeight);
      if (bottom <= top) return false;
      return mouseX >= r.left && mouseX <= r.right && mouseY >= top && mouseY <= bottom;
    };

    // Touch devices have no hover: engaging with the box means it is on screen
    const isOverChargeTouch = () => {
      const r = chargeEl.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      return r.top < window.innerHeight && r.bottom > 0;
    };

    const hoverOk = () => (isFinePointer ? isOverCharge() : isOverChargeTouch());

    /* Charge logic
     * - Only DOWNWARD scroll increases the charge.
     * - UPWARD scroll (or scrolling away from the bottom) drains it.
     * - The "near bottom" requirement is dropped for the charge itself; instead the
     *   page must be at the very bottom OR the pointer must be over the box.
     */
    const updateChargeState = (scrollTop) => {
      const prev = lastScrollY;
      lastScrollY = scrollTop;

      if (navigated) return;

      const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const atBottom = docHeight <= 0 ? true : scrollTop >= docHeight - 8;

      const delta = prev >= 0 ? scrollTop - prev : 0;

      if (delta > 0) {
        // DOWNWARD: accumulate scroll distance, charge when threshold reached
        accumulatedDelta += delta;
        const threshold = 24; // px of downward scroll needed per charge tick
        if (hoverOk() && accumulatedDelta >= threshold) {
          const ticks = Math.floor(accumulatedDelta / threshold);
          accumulatedDelta -= ticks * threshold;
          updateCharge(chargePct + ticks * 4);
          if (chargePct >= 100) {
            navigated = true;
            if (captionEl) captionEl.textContent = 'RELEASED → NEXT PROJECT';
            setTimeout(() => navigateTo(next), 350);
          }
        } else if (!atBottom && !hoverOk()) {
          // scrolling down but not over box and not at bottom -> drain
          accumulatedDelta = 0;
          updateCharge(chargePct - 4);
        }
      } else if (delta < 0) {
        // UPWARD: always drains
        accumulatedDelta = 0;
        updateCharge(chargePct - 4);
      } else if (!atBottom && !hoverOk()) {
        accumulatedDelta = 0;
        updateCharge(chargePct - 4);
      }
    };

    const onScroll = () => {
      updateChargeState(window.scrollY || (window.__lenis ? window.__lenis.scroll : 0));
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    if (window.__lenis) {
      window.__lenis.on('scroll', ({ scroll }) => updateChargeState(scroll));
    }

    /* Wheel events fire EVEN when the page can't scroll further (at the bottom).
     * This is the key fix: when the page is stuck at the bottom and the user keeps
     * scrolling down, scroll events stop firing but wheel events keep coming.
     * We use deltaY > 0 = downward = charge up, deltaY < 0 = upward = drain.
     */
    const WHEEL_THRESHOLD = 8; // px of wheel delta per charge tick
    let wheelAccum = 0;
    window.addEventListener('wheel', (e) => {
      if (navigated) return;
      const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const st = window.scrollY || (window.__lenis ? window.__lenis.scroll : 0);
      const atBottom = docHeight <= 0 ? true : st >= docHeight - 24;

      if (e.deltaY > 0) {
        // DOWNWARD wheel
        if (hoverOk()) {
          wheelAccum += e.deltaY;
          if (wheelAccum >= WHEEL_THRESHOLD) {
            const ticks = Math.floor(wheelAccum / WHEEL_THRESHOLD);
            wheelAccum -= ticks * WHEEL_THRESHOLD;
            updateCharge(chargePct + ticks * 5);
            if (chargePct >= 100) {
              navigated = true;
              if (captionEl) captionEl.textContent = 'RELEASED → NEXT PROJECT';
              setTimeout(() => navigateTo(next), 350);
            }
          }
        } else if (!atBottom) {
          wheelAccum = 0;
          updateCharge(chargePct - 5);
        }
      } else if (e.deltaY < 0) {
        // UPWARD wheel — drain
        wheelAccum = 0;
        updateCharge(chargePct - 5);
      }
    }, { passive: true });

    /* Touch fallback: on touch devices, trackwheel-like gestures at the bottom
     * via touchmove delta when the page is at the bottom.
     */
    if (!isFinePointer) {
      let touchStartY = 0;
      window.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY;
      }, { passive: true });
      window.addEventListener('touchmove', (e) => {
        if (navigated) return;
        const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrollTop = window.scrollY || (window.__lenis ? window.__lenis.scroll : 0);
        const atBottom = docHeight <= 0 ? true : scrollTop >= docHeight - 8;
        if (!atBottom) return;
        const dy = touchStartY - e.touches[0].clientY; // positive = downward
        if (dy > 0) {
          wheelAccum += dy;
          if (wheelAccum >= WHEEL_THRESHOLD * 2) {
            const ticks = Math.floor(wheelAccum / (WHEEL_THRESHOLD * 2));
            wheelAccum -= ticks * (WHEEL_THRESHOLD * 2);
            updateCharge(chargePct + ticks * 5);
            if (chargePct >= 100) {
              navigated = true;
              if (captionEl) captionEl.textContent = 'RELEASED → NEXT PROJECT';
              setTimeout(() => navigateTo(next), 350);
            }
          }
          touchStartY = e.touches[0].clientY;
        } else if (dy < 0) {
          wheelAccum = 0;
          updateCharge(chargePct - 5);
        }
      }, { passive: true });
    }
  }

  function initAbout() {
    const body = document.getElementById('about-terminal');
    const profileCard = document.querySelector('.profile-card');

    if (profileCard && typeof gsap !== 'undefined') {
      gsap.fromTo(
        profileCard,
        { opacity: 0, y: 35, scale: 0.96 },
        { opacity: 1, y: 0, scale: 1, duration: 0.85, ease: 'power3.out', delay: 0.2 }
      );

      if (isFinePointer && !prefersReduced) {
        profileCard.addEventListener('mousemove', (e) => {
          const rect = profileCard.getBoundingClientRect();
          const px = (e.clientX - rect.left) / rect.width;
          const py = (e.clientY - rect.top) / rect.height;
          profileCard.style.transform = `perspective(1000px) rotateX(${(0.5 - py) * 9}deg) rotateY(${(px - 0.5) * 11}deg)`;
        });
        profileCard.addEventListener('mouseleave', () => {
          profileCard.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
        });
      }
    }

    if (!body) return;

    const lines = [
      { text: '> whoami', dim: true },
      { text: 'bintangilhamkurniawan@gmail.com — Frontend & Fullstack Developer' },
      { text: '> cat background.md', dim: true },
      {
        text: 'Pengembang web yang berfokus pada frontend modern dengan React serta kapabilitas fullstack menggunakan Express.js dan Laravel framework. Menguasai JavaScript, Python, dan arsitektur database MySQL & PostgreSQL.',
      },
      { text: '> ls ./skills', dim: true },
      { text: 'React  ·  JavaScript  ·  Express.js  ·  Laravel  ·  Python  ·  PostgreSQL  ·  MySQL  ·  Tailwind' },
      { text: '> status', dim: true },
      { text: 'ONLINE — ready to collaborate_' },
    ];

    body.textContent = '';
    let lineIndex = 0;
    let charIndex = 0;
    let current = '';

    function tick() {
      if (lineIndex >= lines.length) return;

      const line = lines[lineIndex];
      if (charIndex === 0) {
        const span = document.createElement('div');
        if (line.dim) span.className = 'line-dim';
        span.dataset.line = String(lineIndex);
        body.appendChild(span);
      }

      const span = body.querySelector(`[data-line="${lineIndex}"]`);
      current = line.text.slice(0, charIndex + 1);
      if (span) span.textContent = current;
      charIndex += 1;

      if (charIndex >= line.text.length) {
        lineIndex += 1;
        charIndex = 0;
        setTimeout(tick, prefersReduced ? 0 : 280);
      } else {
        setTimeout(tick, prefersReduced ? 0 : 16 + Math.random() * 28);
      }
    }

    setTimeout(tick, 400);

    gsap.from('.radar-section > *', {
      scrollTrigger: { trigger: '.radar-section', start: 'top 80%' },
      y: 50,
      opacity: 0,
      duration: 1,
      stagger: 0.15,
      ease: 'power3.out',
    });
  }

  /* =========================================================
   * Contact
   * ========================================================= */
  function initContact() {
    document.querySelectorAll('.cmd-input-row').forEach((row) => {
      const input = row.querySelector('.cmd-input');
      if (!input) return;
      const sync = () => row.classList.toggle('has-value', Boolean(input.value.trim()));
      input.addEventListener('input', sync);
      input.addEventListener('blur', sync);
    });

    const form = document.getElementById('cmd-form');
    const status = document.getElementById('form-status');
    const btn = document.getElementById('btn-transmit');

    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = form.name.value.trim();
      if (!name) return;

      btn?.classList.add('is-firing');
      setTimeout(() => btn?.classList.remove('is-firing'), 600);

      if (status) {
        status.textContent = `> ACK ${name.toUpperCase().replace(/\s+/g, '_')} — transmission queued (frontend demo)`;
      }
      form.reset();
      form.querySelectorAll('.cmd-input-row').forEach((row) => row.classList.remove('has-value'));
    });

    gsap.from('.contact-wrap > *', {
      y: 36,
      opacity: 0,
      duration: 0.85,
      stagger: 0.1,
      ease: 'power3.out',
      delay: 0.25,
    });
  }

  /* =========================================================
   * Boot
   * ========================================================= */
  function boot() {
    if (typeof gsap === 'undefined') return;
    gsap.registerPlugin(ScrollTrigger);

    playEnter();
    initNavLinks();
    initLenis();
    initNavAutoHide();
    initCursor();

    const year = document.getElementById('year');
    if (year) year.textContent = String(new Date().getFullYear());

    switch (page) {
      case 'home':
        initHome();
        break;
      case 'projects':
        initProjects();
        break;
      case 'about':
        initAbout();
        break;
      case 'contact':
        initContact();
        break;
      case 'project-detail':
        initDetailScrollNext();
        break;
      default:
        break;
    }

    window.addEventListener('load', () => ScrollTrigger.refresh());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
