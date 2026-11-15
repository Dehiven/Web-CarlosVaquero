(() => {
  'use strict';

  const { gsap, ScrollTrigger, SplitText, Lenis } = window;
  if (!gsap || !ScrollTrigger || !SplitText) {
    document.documentElement.classList.add('no-motion');
    return;
  }
  gsap.registerPlugin(ScrollTrigger, SplitText);

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) document.documentElement.classList.add('no-motion');

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const cssVar = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const isO = text => /^[oO]$/.test(text);
  const markO = chars => chars.forEach(c => isO(c.textContent) && c.classList.add('playfair-o'));

  let refreshTimer = 0;
  const scheduleRefresh = () => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => ScrollTrigger.refresh(), 100);
  };

  /* Smooth scroll */
  let lenis = null;
  function initSmoothScroll() {
    if (reduced || !Lenis) return;
    lenis = new Lenis({ lerp: .1, wheelMultiplier: 1 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(time => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  const scrollToHash = hash => {
    const target = hash === '#top' ? 0 : $(hash);
    if (target === null) return;
    if (lenis) lenis.scrollTo(target, { duration: 1.6 });
    else if (target === 0) scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    else target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
  };

  /* Letras "O" en serif cursiva en los titulares que no se parten con SplitText */
  function wrapLetterO() {
    const wrap = node => {
      if (node.nodeType === Node.TEXT_NODE) {
        if (!/[oO]/.test(node.nodeValue)) return;
        const frag = document.createDocumentFragment();
        node.nodeValue.split(/([oO])/).forEach(part => {
          if (!part) return;
          if (isO(part)) {
            const span = document.createElement('span');
            span.className = 'playfair-o';
            span.textContent = part;
            frag.append(span);
          } else frag.append(document.createTextNode(part));
        });
        node.replaceWith(frag);
      } else if (node.nodeType === Node.ELEMENT_NODE && !node.matches('.playfair-o, svg')) {
        [...node.childNodes].forEach(wrap);
      }
    };
    $$('h1, h2, h3, .marquee-text').forEach(el => {
      if (!el.matches('[data-stagger-char], [data-gradient-wave]') && !el.querySelector('[data-stagger-char]')) wrap(el);
    });
  }

  /* El nombre del hero ocupa siempre todo el ancho */
  function fitHeroName() {
    const title = $('.hero-title'), name = $('.hero-name');
    if (!title || !name) return;
    title.style.fontSize = '';
    const base = parseFloat(getComputedStyle(title).fontSize);
    const ratio = title.clientWidth / name.offsetWidth * .99; // margen: el texto no escala 100% lineal
    const vw = innerWidth / 100;
    title.style.fontSize = `${gsap.utils.clamp(6 * vw, 20 * vw, base * ratio)}px`;
  }

  /* Carga inicial */
  function initPageLoader() {
    const element = $('.seq-photo'), aura = $('.seq-aura'), nav = $('#nav');
    if (reduced) return;
    gsap.timeline({ onComplete: scheduleRefresh })
      .fromTo(element, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.6, ease: 'expo.inOut' }, 0)
      .fromTo(aura, { autoAlpha: 0, scale: .8 }, { autoAlpha: 1, scale: 1, duration: 2.4, ease: 'expo.out' }, .9)
      .fromTo(nav, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1, ease: 'expo.inOut' }, 1);
  }

  /* La tarjeta de la foto se encoge al hacer scroll */
  function initSequenceResize() {
    if (reduced) return;
    const wrap = $('.hero-about'), element = $('.seq-element'), img = $('.seq-element img');
    gsap.matchMedia().add({ mobile: '(max-width: 767px)', desktop: '(min-width: 768px)' }, ctx => {
      const { mobile } = ctx.conditions;
      const st = { trigger: wrap, start: 'top top', end: 'bottom top', scrub: true, invalidateOnRefresh: true };
      gsap.fromTo(element,
        { width: mobile ? '60vw' : '35vw', height: mobile ? '50vh' : '100vh' },
        { width: mobile ? '90vw' : '25vw', height: mobile ? '70vh' : '65vh', ease: 'none', scrollTrigger: st });
      gsap.fromTo(img, { scale: 1.12 }, { scale: 1, ease: 'none', scrollTrigger: { ...st } });
    });
  }

  /* Letras que suben con máscara */
  function initStaggerChar() {
    $$('[data-stagger-char]').forEach(el => {
      const lineMode = el.dataset.staggerChar === 'line';
      SplitText.create(el, {
        type: lineMode ? 'lines' : 'lines, chars',
        mask: 'lines',
        autoSplit: true,
        linesClass: 'split-line',
        onSplit(self) {
          if (!lineMode) markO(self.chars);
          gsap.set(el, { visibility: 'visible' });
          if (reduced) return;
          return gsap.timeline({
            scrollTrigger: {
              trigger: el,
              start: el.dataset.start || 'top 85%',
              toggleActions: 'restart none none reset'
            }
          }).fromTo(lineMode ? self.lines : self.chars, { yPercent: 120 }, {
            yPercent: 0, duration: 1, ease: 'power4.out',
            stagger: lineMode ? .12 : .07
          }, parseFloat(el.dataset.delay) || 0);
        }
      });
    });
  }

  /* Titular que se ilumina letra a letra con el scroll */
  function initGradientWave() {
    $$('[data-gradient-wave]').forEach(el => {
      SplitText.create(el, {
        type: 'words, chars',
        autoSplit: true,
        onSplit(self) {
          markO(self.chars);
          if (reduced) return;
          const chars = self.chars;
          const dim = 'rgba(227, 232, 240, .18)', wave = cssVar('--accent'), lit = getComputedStyle(el).color;
          let count = 0;
          gsap.set(chars, { color: dim });

          const paint = (next, instant) => {
            if (instant) {
              chars.forEach((c, i) => { gsap.killTweensOf(c); gsap.set(c, { color: i < next ? lit : dim }); });
            } else if (next > count) {
              for (let i = count; i < next; i++) {
                gsap.killTweensOf(chars[i]);
                gsap.timeline()
                  .to(chars[i], { color: wave, duration: .12, ease: 'power2.out' })
                  .to(chars[i], { color: lit, duration: .28, ease: 'power2.in' });
              }
            } else {
              for (let i = next; i < count; i++) {
                gsap.killTweensOf(chars[i]);
                gsap.to(chars[i], { color: dim, duration: .2, ease: 'none' });
              }
            }
            count = next;
          };

          const state = { p: 0 };
          return gsap.to(state, {
            p: 1, ease: 'none',
            onUpdate: () => paint(Math.round(state.p * chars.length), false),
            scrollTrigger: {
              trigger: el, start: 'top 90%', end: 'center 40%', scrub: .1,
              onRefresh: self => paint(Math.round(self.progress * chars.length), true)
            }
          });
        }
      });
    });
  }

  /* Líneas que se dibujan */
  function initLineReveal() {
    if (reduced) return;
    $$('.line').forEach(line => {
      gsap.fromTo(line, { scaleX: 0 }, {
        scaleX: 1, duration: 1.6, ease: 'expo.inOut',
        scrollTrigger: { trigger: line, start: 'top 95%', toggleActions: 'restart none none reset' }
      });
    });
  }

  /* Bloques que aparecen en cascada */
  function initRevealGroups() {
    if (reduced) return;
    $$('[data-reveal-group]').forEach(group => {
      const targets = group.children.length ? [...group.children] : [group];
      gsap.timeline({
        scrollTrigger: { trigger: group, start: 'top 80%', toggleActions: 'restart none none reset' }
      }).fromTo(targets, { y: '2em', autoAlpha: 0 }, {
        y: 0, autoAlpha: 1, duration: .8, ease: 'power4.inOut', stagger: .1
      });
    });
  }

  /* Reloj en directo */
  function initClocks() {
    const clocks = $$('[data-timezone]').map(el => ({
      el,
      fmt: new Intl.DateTimeFormat('es-ES', { timeZone: el.dataset.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    }));
    if (!clocks.length) return;
    const tick = () => {
      const now = new Date();
      clocks.forEach(({ el, fmt }) => { el.textContent = `${el.dataset.timezoneLabel || ''} ${fmt.format(now)}`.trim(); });
      setTimeout(tick, 60000 - Date.now() % 60000 + 20);
    };
    tick();
  }

  /* La barra de navegación empieza abajo y sube con el scroll */
  function initNavReveal() {
    const nav = $('#nav');
    let height = nav.offsetHeight, frame = 0;
    const update = () => {
      frame = 0;
      nav.style.transform = `translateY(${Math.max(0, innerHeight - height - scrollY)}px)`;
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    new ResizeObserver(() => { height = nav.offsetHeight; schedule(); }).observe(nav);
    addEventListener('scroll', schedule, { passive: true });
    addEventListener('resize', schedule, { passive: true });
    update();
  }

  /* Hover con letras que ruedan */
  function initStaggerLinks() {
    if (reduced) return;
    $$('[data-link-stagger]').forEach(link => {
      const label = link.textContent.trim();
      if (!label || link.children.length) return;
      const layer = cls => {
        const span = document.createElement('span');
        span.className = `stagger-link__layer ${cls}`;
        [...label].forEach(ch => {
          const c = document.createElement('span');
          c.className = `stagger-link__char${isO(ch) ? ' playfair-o' : ''}`;
          c.textContent = ch === ' ' ? ' ' : ch;
          span.append(c);
        });
        return span;
      };
      const inner = document.createElement('span');
      inner.className = 'stagger-link__inner';
      inner.setAttribute('aria-hidden', 'true');
      const current = layer('stagger-link__layer--current'), hover = layer('stagger-link__layer--hover');
      inner.append(current, hover);
      if (!link.hasAttribute('aria-label')) link.setAttribute('aria-label', label);
      link.replaceChildren(inner);

      gsap.set(hover.children, { yPercent: 110 });
      const tl = gsap.timeline({ paused: true, defaults: { duration: .45, ease: 'power3.inOut', stagger: .018 } })
        .to(current.children, { yPercent: -110 }, 0)
        .to(hover.children, { yPercent: 0 }, .04);
      link.addEventListener('pointerenter', () => tl.play());
      link.addEventListener('pointerleave', () => tl.reverse());
      link.addEventListener('focus', () => tl.play());
      link.addEventListener('blur', () => tl.reverse());
    });
  }

  /* Menú */
  function initMenu() {
    const trigger = $('.nav-button.is-menu'), menu = $('#menu'), page = $('.page-wrapper');
    const dots = $$('.menu-dot', trigger), links = $$('.menu-link', menu);
    const d = 5;
    const plus = [[0, -d], [d, 0], [0, d], [-d, 0]];
    const cross = [[-d, -d], [d, -d], [d, d], [-d, d]];
    let open = false, pendingHash = null;

    gsap.set(dots.slice(0, 4), { x: i => plus[i][0], y: i => plus[i][1] });
    gsap.set(dots[4], { scale: 0 });
    gsap.set(menu, { autoAlpha: 0, y: '-2rem' });
    gsap.set(links, { autoAlpha: 0, yPercent: 60 });
    menu.inert = true;

    const iconTl = gsap.timeline({ paused: true })
      .to(dots.slice(0, 4), { x: 0, y: 0, scale: .8, duration: .22, ease: 'power3.in' })
      .to(dots[4], { scale: 1, duration: .08, ease: 'power2.out' }, .18)
      .to(dots.slice(0, 4), { x: i => cross[i][0], y: i => cross[i][1], scale: 1, duration: .34, ease: 'back.out(1.4)' }, .22);

    const menuTl = gsap.timeline({
      paused: true,
      onReverseComplete() {
        gsap.set(menu, { display: 'none' });
        lenis?.start();
        if (pendingHash) { scrollToHash(pendingHash); pendingHash = null; }
      }
    })
      .to(page, { y: '5rem', duration: 1.05, ease: 'power3.inOut' }, 0)
      .to(menu, { autoAlpha: 1, y: 0, duration: .85, ease: 'power4.out' }, .18)
      .to(links, { autoAlpha: 1, yPercent: 0, duration: .65, stagger: .06, ease: 'power4.out' }, .75);

    const setOpen = value => {
      open = value;
      trigger.setAttribute('aria-expanded', String(open));
      menu.inert = !open;
      if (open) {
        lenis?.stop();
        gsap.set(menu, { display: 'flex' });
        iconTl.play(); menuTl.play();
        if (reduced) { iconTl.progress(1); menuTl.progress(1); }
      } else {
        iconTl.reverse(); menuTl.reverse();
        if (reduced) { iconTl.progress(0); menuTl.progress(0); }
      }
    };

    trigger.addEventListener('click', () => setOpen(!open));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && open) { setOpen(false); trigger.focus({ preventScroll: true }); }
    });
    links.forEach(link => link.addEventListener('click', e => {
      e.preventDefault();
      pendingHash = link.getAttribute('href');
      setOpen(false);
    }));
  }

  /* Anclas internas con scroll suave */
  function initAnchors() {
    document.addEventListener('click', e => {
      const a = e.target.closest('a[href^="#"]');
      if (!a || a.closest('#menu') || a.getAttribute('href') === '#') return;
      e.preventDefault();
      scrollToHash(a.getAttribute('href'));
    });
  }

  /* Cursor con estela */
  function initCursor() {
    const dot = $('[data-cursor-dot]'), canvas = $('[data-cursor-canvas]');
    if (!dot || !canvas || reduced || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const ctx = canvas.getContext('2d');
    const rgb = '29, 91, 255';
    const life = 250;
    let trail = [], thickness = 2, running = false, inside = false, moving = false;

    gsap.set(dot, { xPercent: -50, yPercent: -50 });
    const xTo = gsap.quickTo(dot, 'x', { duration: .25, ease: 'power3' });
    const yTo = gsap.quickTo(dot, 'y', { duration: .25, ease: 'power3' });

    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
      canvas.style.width = `${innerWidth}px`; canvas.style.height = `${innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      trail = [];
    };

    const draw = () => {
      const now = performance.now();
      if (inside && moving) {
        const x = +gsap.getProperty(dot, 'x'), y = +gsap.getProperty(dot, 'y');
        const last = trail[trail.length - 1];
        if (!last || Math.hypot(x - last.x, y - last.y) > .3) trail.push({ x, y, t: now });
        moving = xTo.tween.isActive() || yTo.tween.isActive();
      }
      trail = trail.filter(p => now - p.t < life);
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      ctx.shadowColor = `rgba(${rgb}, .75)`;
      ctx.shadowBlur = 40;
      for (let i = 1; i < trail.length - 1; i++) {
        const a = trail[i - 1], b = trail[i], c = trail[i + 1];
        const speed = Math.hypot(b.x - a.x, b.y - a.y) / Math.max(1, b.t - a.t);
        const target = 16 - gsap.utils.clamp(0, 1, (speed - .08) / 2.72) * 14;
        const alpha = (1 - (now - b.t) / life) ** 2;
        thickness += (target - thickness) * .5;
        ctx.beginPath();
        ctx.moveTo((a.x + b.x) / 2, (a.y + b.y) / 2);
        ctx.quadraticCurveTo(b.x, b.y, (b.x + c.x) / 2, (b.y + c.y) / 2);
        ctx.lineWidth = thickness;
        ctx.strokeStyle = `rgba(${rgb}, ${alpha})`;
        ctx.stroke();
      }
      if (!trail.length && !moving) { gsap.ticker.remove(draw); running = false; }
    };

    addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      if (!inside) { xTo(e.clientX, e.clientX); yTo(e.clientY, e.clientY); }
      inside = moving = true;
      dot.style.opacity = 1;
      xTo(e.clientX); yTo(e.clientY);
      if (!running) { gsap.ticker.add(draw); running = true; }
    }, { passive: true });
    document.addEventListener('mouseover', e => {
      const link = e.target.closest?.('a, button');
      if (link && !link.contains(e.relatedTarget)) dot.classList.add('is-link');
    });
    document.addEventListener('mouseout', e => {
      const link = e.target.closest?.('a, button');
      if (link && !link.contains(e.relatedTarget)) dot.classList.remove('is-link');
    });
    const leave = () => { inside = moving = false; dot.style.opacity = 0; };
    document.addEventListener('mouseleave', leave);
    addEventListener('blur', leave);
    addEventListener('resize', resize, { passive: true });
    resize();
  }

  /* Marquee del footer: invierte el sentido según el scroll */
  function initMarquee() {
    $$('[data-marquee]').forEach(marquee => {
      const track = $('.marquee-track', marquee), first = $('.marquee-item', marquee);
      if (reduced) return;
      const width = first.offsetWidth;
      const copies = Math.max(2, Math.ceil(innerWidth * 1.5 / width));
      for (let i = 0; i < copies; i++) track.append(first.cloneNode(true));
      const items = $$('.marquee-item', track);
      const speed = parseFloat(marquee.dataset.marqueeSpeed) || 20;
      const shift = parseFloat(marquee.dataset.marqueeScroll) || 0;

      const loop = gsap.to(items, { xPercent: -100, duration: speed * width / innerWidth, ease: 'none', repeat: -1 });
      ScrollTrigger.create({
        trigger: marquee, start: 'top bottom', end: 'bottom top',
        onToggle: self => loop.paused(!self.isActive),
        onUpdate: self => gsap.to(loop, { timeScale: self.direction === 1 ? 1 : -1, duration: .4, overwrite: true })
      });
      gsap.fromTo(track, { x: `${shift}vw` }, {
        x: `${-shift}vw`, ease: 'none',
        scrollTrigger: { trigger: marquee, start: 'top bottom', end: 'bottom top', scrub: true }
      });
    });
  }

  /* Degradado del footer */
  function initFooterGradient() {
    const gradient = $('.footer-gradient');
    if (!gradient || reduced) return;
    gsap.from(gradient, {
      xPercent: -30, yPercent: 20, scale: .85, opacity: .6, ease: 'none',
      scrollTrigger: { trigger: '.footer-base', start: 'top bottom', end: 'bottom bottom', scrub: 1.2 }
    });
  }

  /* Carrusel de trabajos con lente de cristal (WebGL) */
  /* Esfera de cosas que me mueven: arrastrar para girar, con inercia */
  function initStuff() {
    const root = $('[data-stuff]');
    if (!root) return;
    const sphere = $('.stuff-sphere', root), caption = $('[data-stuff-caption]', root);
    // Repite los referentes hasta llenar la esfera; las copias son decorativas para lectores de pantalla
    const originals = $$('[data-stuff-item]', root);
    for (let i = originals.length; i < Math.max(20, originals.length); i++) {
      const copy = originals[i % originals.length].cloneNode(true);
      copy.setAttribute('aria-hidden', 'true');
      $('button', copy).tabIndex = -1;
      sphere.append(copy);
    }
    const items = $$('[data-stuff-item]', root);
    const n = items.length, golden = Math.PI * (3 - Math.sqrt(5));
    // Puntos repartidos uniformemente en la esfera (espiral de Fibonacci)
    const pts = items.map((_, i) => {
      const y = 1 - (i + .5) / n * 2, r = Math.sqrt(1 - y * y), t = i * golden;
      return [Math.cos(t) * r, y, Math.sin(t) * r];
    });
    // Barajado fijo: con i % referentes las copias caían en fila; así se reparten por toda la esfera
    let seed = 7;
    for (let i = n - 1; i > 0; i--) {
      seed = (seed * 16807) % 2147483647;
      const j = seed % (i + 1);
      [pts[i], pts[j]] = [pts[j], pts[i]];
    }
    const idle = reduced ? 0 : .0016;
    let rx = -.25, ry = 0, vx = 0, vy = idle, w = 0, h = 0, R = 0, Ry = 0, sizes = [];
    let drag = null, visible = false, raf = 0;

    const measure = () => {
      w = root.clientWidth; h = root.clientHeight;
      sizes = items.map(el => [el.offsetWidth, el.offsetHeight]);
      // Radio para que ni el elemento más ancho (a escala máxima 1.05) se salga por los lados
      const maxW = Math.max(...sizes.map(s => s[0]));
      R = Math.max(80, Math.min(w * .36, (w - maxW * 1.05) / 2 - 8, h * .36));
      Ry = Math.min(h * .36, R * 1.6); // en móvil (estrecho) se estira en vertical para usar la altura
    };
    const render = () => {
      const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry);
      pts.forEach(([x, y, z], i) => {
        const x1 = x * cy + z * sy, z1 = z * cy - x * sy;
        const y2 = y * cx - z1 * sx, z2 = y * sx + z1 * cx;
        const d = (z2 + 1) / 2; // 0 = detrás, 1 = delante
        const el = items[i], [iw, ih] = sizes[i];
        el.style.transform = `translate3d(${w / 2 + x1 * R - iw / 2}px, ${h / 2 + y2 * Ry - ih / 2}px, 0) scale(${.45 + .6 * d})`;
        el.style.opacity = (.18 + .82 * d * d).toFixed(3);
        el.style.zIndex = Math.round(d * 100);
      });
    };
    const tick = () => {
      raf = 0;
      if (!drag) {
        ry += vy; rx += vx;
        vy += (idle - vy) * .04; vx *= .95; // la inercia se apaga hacia el giro lento
      }
      render();
      if (visible && (drag || Math.abs(vy) > 1e-5 || Math.abs(vx) > 1e-5)) raf = requestAnimationFrame(tick);
    };
    const play = () => { if (!raf) raf = requestAnimationFrame(tick); };

    let moved = 0;
    root.addEventListener('pointerdown', e => {
      if (e.button) return;
      drag = { x: e.clientX, y: e.clientY, t: performance.now() };
      moved = 0; vx = vy = 0;
      root.classList.add('is-dragging');
      play();
    });
    addEventListener('pointermove', e => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      const now = performance.now(), dt = Math.max(16, now - drag.t);
      moved += Math.abs(dx) + Math.abs(dy);
      ry += dx * .006; rx -= dy * .006;
      vy = dx * .006 * 16 / dt; vx = -dy * .006 * 16 / dt;
      Object.assign(drag, { x: e.clientX, y: e.clientY, t: now });
    });
    const end = () => { if (!drag) return; drag = null; root.classList.remove('is-dragging'); play(); };
    addEventListener('pointerup', end);
    addEventListener('pointercancel', end);
    // Un arrastre no debe abrir la ficha al soltar encima de una imagen
    root.addEventListener('click', e => { if (moved > 6) { e.preventDefault(); e.stopPropagation(); } }, true);

    // Ficha de detalle
    const dialog = $('[data-stuff-dialog]'), media = $('[data-stuff-media]'), body = $('[data-stuff-body]');
    root.addEventListener('click', e => {
      const li = e.target.closest('[data-stuff-item]');
      if (!li || !dialog) return;
      const img = $('img', li);
      media.replaceChildren(img ? Object.assign(img.cloneNode(), { loading: 'eager' }) : Object.assign(document.createElement('span'), { className: 'stuff-dialog__name', textContent: $('.stuff-btn', li).getAttribute('aria-label') }));
      body.replaceChildren($('.stuff-detail', li).content.cloneNode(true));
      dialog.showModal();
      lenis?.stop();
    });
    dialog?.addEventListener('close', () => lenis?.start());
    dialog?.addEventListener('click', e => { if (e.target === dialog || e.target.closest('[data-stuff-close]')) dialog.close(); });

    // Teclado: flechas giran
    root.addEventListener('keydown', e => {
      const k = { ArrowLeft: [0, -.06], ArrowRight: [0, .06], ArrowUp: [.06, 0], ArrowDown: [-.06, 0] }[e.key];
      if (!k) return;
      e.preventDefault(); vx += k[0] * .5; vy += k[1] * .5; play();
    });

    // Etiqueta del elemento bajo el cursor / tocado
    const base = caption.textContent;
    items.forEach(el => {
      const label = el.dataset.label;
      if (!label) return;
      el.addEventListener('pointerenter', () => { caption.textContent = label; });
      el.addEventListener('pointerleave', () => { caption.textContent = base; });
    });

    new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) play(); }).observe(root);
    addEventListener('resize', () => { measure(); render(); });
    $$('img', root).forEach(img => img.complete || img.addEventListener('load', () => { measure(); render(); }, { once: true }));
    root.classList.add('is-ready');
    measure();
    render();
  }

  async function initCarousel() {
    const root = $('[data-carousel]');
    if (!root || reduced) return;

    let THREE;
    try { THREE = await import('https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js'); }
    catch (err) { console.warn('[Carrusel] Three.js no cargó; se muestra la lista.', err); return; }

    const canvas = $('[data-carousel-canvas]', root);
    const items = $$('[data-carousel-item]', root);
    const caption = $('[data-carousel-caption]', root);
    const counter = $('[data-carousel-counter]', root);
    const total = items.length;

    let renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); }
    catch (err) { console.warn('[Carrusel] Sin WebGL; se muestra la lista.', err); return; }
    root.classList.add('is-gl');

    const GAP = 40, HEIGHT = .6, MAX_W = .78, FRICTION = .865;
    let W = root.clientWidth, H = root.clientHeight, panelH = 1;
    const dpr = () => Math.min(devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr());
    renderer.setSize(W, H, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, -10, 10);
    const rt = new THREE.WebGLRenderTarget(W * dpr(), H * dpr(), { type: THREE.HalfFloatType });

    const sources = items.map(item => ({ img: $('img', item), aspect: 1.6, tex: null }));
    const geometry = new THREE.PlaneGeometry(1, 1);
    const pool = [];
    for (let copy = -1; copy <= 1; copy++) {
      sources.forEach((_, i) => {
        const mat = new THREE.MeshBasicMaterial({ color: 0x1a1d29 });
        const mesh = new THREE.Mesh(geometry, mat);
        scene.add(mesh);
        pool.push({ mesh, mat, i, copy });
      });
    }

    let offsets = [], loopW = 1;
    const measure = () => {
      const widest = Math.max(...sources.map(s => s.aspect));
      panelH = Math.min(H * HEIGHT, W * MAX_W / widest);
      let acc = 0;
      offsets = sources.map(s => { const o = acc; acc += s.aspect * panelH + GAP; return o; });
      loopW = acc;
    };
    const slotCenter = i => offsets[i] + sources[i].aspect * panelH / 2;
    const centerFor = index => {
      const loop = Math.floor(index / total), i = ((index % total) + total) % total;
      return slotCenter(i) + loop * loopW;
    };
    const nearest = value => {
      let best = 0, dist = Infinity;
      for (let i = 0; i < total; i++) {
        const k = Math.round((value - slotCenter(i)) / loopW);
        const dd = Math.abs(slotCenter(i) + k * loopW - value);
        if (dd < dist) { dist = dd; best = i + k * total; }
      }
      return best;
    };
    const wrapIndex = index => ((index % total) + total) % total;

    measure();
    let scroll = centerFor(0), target = scroll, velocity = 0, prev = scroll, energy = 0;
    let lastInput = performance.now(), snapped = true, active = -1;

    const loadTexture = (src, i) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => {
        const anchor = nearest(scroll);
        sources[i].aspect = image.naturalWidth / image.naturalHeight || 1.6;
        const h = Math.min(image.naturalHeight || 1000, Math.round(H * HEIGHT * dpr() * 1.5));
        const c = document.createElement('canvas');
        c.height = h; c.width = Math.round(h * sources[i].aspect);
        c.getContext('2d').drawImage(image, 0, 0, c.width, c.height);
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
        sources[i].tex = tex;
        measure();
        scroll = target = prev = centerFor(anchor);
      };
      image.src = src;
    };
    sources.forEach((s, i) => loadTexture(s.img.currentSrc || s.img.src, i));

    const lensUniforms = {
      uScene: { value: rt.texture },
      uRes: { value: new THREE.Vector2(W, H) },
      uLens: { value: new THREE.Vector2(W * .6, W) },
      uTime: { value: 0 },
      uBg: { value: new THREE.Color(cssVar('--black')) },
      uRing: { value: new THREE.Color(cssVar('--teal-bright')) }
    };
    const lens = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: lensUniforms,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D uScene;
        uniform vec2 uRes, uLens;
        uniform float uTime;
        uniform vec3 uBg, uRing;

        vec4 sampleScene(vec2 uv) { return texture2D(uScene, clamp(uv, 0.0, 1.0)); }

        void main() {
          vec2 px = (vUv - 0.5) * uRes;
          vec2 q = px / uLens;
          float d = length(q);
          float ang = atan(q.y, q.x);
          vec4 base = sampleScene(vUv);

          // Lente: magnifica hacia el centro, ondula y separa colores en el borde
          float rim = smoothstep(0.58, 1.0, d);
          vec2 dir = normalize(px + 1e-5);
          vec2 tangent = vec2(-dir.y, dir.x);
          float wave = sin(ang * 2.0) * 0.55 + sin(ang + uTime * 0.4) * 0.25;
          vec2 lensPx = px * (1.0 - 0.12 * d * d) + tangent * wave * rim * 0.3 * uLens.x * 0.12;
          vec2 uv = lensPx / uRes + 0.5;
          vec2 split = (vUv - 0.5) * 0.044 * smoothstep(0.55, 1.0, d);
          vec4 r = sampleScene(uv - split), g = sampleScene(uv), b = sampleScene(uv + split);
          vec4 lensCol = vec4(r.r, g.g, b.b, max(max(r.a, g.a), b.a));

          float mask = 1.0 - smoothstep(0.93, 1.0, d);
          vec4 col = mix(base, lensCol, mask);
          vec3 rgb = mix(uBg, col.rgb, col.a);

          // Anillo de luz con brillo que recorre el borde
          float ringD = d * 0.5 - 0.49;
          float ring = exp(-pow(ringD / 0.01, 2.0));
          float aura = exp(-pow(ringD / 0.06, 2.0)) * 0.28;
          float shimmer = sin(ang * 12.0 + uTime * 3.5) * 0.12 + 0.88;
          rgb += uRing * (ring * shimmer * 0.42 + aura * 0.24);
          rgb += vec3(exp(-pow((d * 0.5 - 0.488) / 0.003, 2.0)));

          gl_FragColor = vec4(rgb, 1.0);
          #include <colorspace_fragment>
        }
      `
    }));
    const lensScene = new THREE.Scene();
    lensScene.add(lens);
    const lensCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    let rects = [], centered = null;
    const layout = () => {
      rects = []; centered = null;
      let bestDist = Infinity;
      const shrink = 1 - .25 * energy;
      pool.forEach(p => {
        const s = sources[p.i];
        let x = slotCenter(p.i) - scroll;
        x = ((x % loopW) + loopW * 1.5) % loopW - loopW / 2 + p.copy * loopW;
        const w = s.aspect * panelH * shrink, h = panelH * shrink;
        const visible = Math.abs(x) < W / 2 + w / 2;
        p.mesh.visible = visible;
        if (!visible) return;
        if (s.tex && p.mat.map !== s.tex) { p.mat.map = s.tex; p.mat.color.set(0xffffff); p.mat.needsUpdate = true; }
        p.mesh.position.set(x, 0, 0);
        p.mesh.scale.set(w, h, 1);
        const rect = { left: x + W / 2 - w / 2, right: x + W / 2 + w / 2, top: H / 2 - h / 2, bottom: H / 2 + h / 2, x, i: p.i, p };
        rects.push(rect);
        if (Math.abs(x) < bestDist) { bestDist = Math.abs(x); centered = rect; }
      });
    };

    const showActive = i => {
      counter.textContent = `${String(i + 1).padStart(2, '0')}/${String(total).padStart(2, '0')}`;
      const content = $('[data-carousel-content]', items[i]);
      caption.replaceChildren(content.cloneNode(true));
      gsap.fromTo(caption, { yPercent: 25, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: .4, ease: 'power3.out', overwrite: true });
    };

    const goTo = index => { velocity = 0; target = centerFor(index); snapped = true; lastInput = performance.now(); };
    const hit = (cx, cy) => {
      const b = canvas.getBoundingClientRect();
      const x = cx - b.left, y = cy - b.top;
      return rects.find(r => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) || null;
    };
    const open = (i, e) => {
      const link = items[i];
      if (!link.href || link.getAttribute('href') === '#') return;
      if (e?.metaKey || e?.ctrlKey) window.open(link.href, '_blank', 'noopener');
      else link.click();
    };

    let dragging = false, pointerId = null, lastX = 0, dragDist = 0, dragVel = 0, moveT = 0, suppress = false, pType = 'mouse';
    const setPointer = v => { if (root.dataset.pointer !== v) root.dataset.pointer = v; };

    canvas.addEventListener('wheel', e => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || e.ctrlKey) return;
      e.preventDefault();
      target += e.deltaX * (e.deltaMode === 1 ? 16 : 1) * 1.4;
      lastInput = performance.now(); snapped = false;
    }, { passive: false });

    canvas.addEventListener('pointerdown', e => {
      if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
      dragging = true; pointerId = e.pointerId; pType = e.pointerType;
      canvas.setPointerCapture(e.pointerId);
      lastX = e.clientX; dragDist = 0; dragVel = 0; velocity = 0;
      moveT = lastInput = performance.now(); snapped = false; suppress = false;
      setPointer('grabbing');
    });
    canvas.addEventListener('pointermove', e => {
      if (dragging && e.pointerId === pointerId) {
        const sens = pType === 'mouse' ? 1.6 : 1;
        const dx = e.clientX - lastX;
        lastX = e.clientX; dragDist += Math.abs(dx);
        target -= dx * sens;
        const now = performance.now(), dt = Math.max(1, now - moveT) / (1000 / 60);
        dragVel = dragVel * .6 + (-dx * sens / dt) * .4;
        moveT = lastInput = now;
      } else if (e.pointerType === 'mouse') setPointer(hit(e.clientX, e.clientY) ? 'grab' : '');
    });
    const release = e => {
      if (!dragging || (e && e.pointerId !== pointerId)) return;
      dragging = false;
      const cancelled = e && e.type !== 'pointerup';
      velocity = cancelled || performance.now() - moveT > 90 ? 0 : dragVel;
      suppress = cancelled || dragDist > (pType === 'mouse' ? 6 : 12);
      lastInput = performance.now(); snapped = false;
      setPointer(e && pType === 'mouse' && hit(e.clientX, e.clientY) ? 'grab' : '');
    };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    canvas.addEventListener('pointerleave', () => { if (!dragging) setPointer(''); });
    canvas.addEventListener('click', e => {
      if (suppress) { suppress = false; return; }
      const r = hit(e.clientX, e.clientY);
      if (!r) return;
      if (centered && r.p === centered.p) open(r.i, e);
      else goTo(nearest(scroll + r.x));
    });
    root.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') { e.preventDefault(); goTo(nearest(scroll) + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(nearest(scroll) - 1); }
      else if (e.key === 'Enter') open(wrapIndex(nearest(scroll)), e);
    });

    ScrollTrigger.create({
      trigger: root, start: 'top 80%',
      onEnter: self => { goTo(nearest(scroll) + 1); self.kill(); }
    });

    let raf = 0, last = 0, inView = false;
    const tick = now => {
      raf = 0;
      if (!inView || document.hidden) return;
      const dt = last ? Math.min((now - last) / (1000 / 60), 3) : 1;
      last = now;

      if (!dragging) {
        const decay = Math.pow(FRICTION, dt);
        target += velocity * (1 - decay) / (1 - FRICTION);
        velocity *= decay;
        if (Math.abs(velocity) < .05) velocity = 0;
        if (!snapped && Math.abs(velocity) < .5 && performance.now() - lastInput > 120) {
          velocity = 0; target = centerFor(nearest(scroll)); snapped = true;
        }
      }
      const follow = dragging && pType !== 'mouse' ? .22 : snapped ? .05 : .09;
      scroll += (target - scroll) * (1 - Math.pow(1 - follow, dt));

      const current = wrapIndex(nearest(scroll));
      if (current !== active) { active = current; showActive(current); }

      const speed = Math.min(1, Math.abs(scroll - prev) / Math.max(.01, dt) / 60);
      prev = scroll;
      energy += (speed - energy) * (1 - Math.pow(1 - (speed > energy ? .25 : .06), dt));

      layout();
      lensUniforms.uTime.value = now * .001;
      renderer.setRenderTarget(rt);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(lensScene, lensCam);
      raf = requestAnimationFrame(tick);
    };
    const sync = () => {
      cancelAnimationFrame(raf); raf = 0; last = 0;
      if (inView && !document.hidden) raf = requestAnimationFrame(tick);
    };
    new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; sync(); }).observe(root);
    document.addEventListener('visibilitychange', sync);

    new ResizeObserver(() => {
      const w = root.clientWidth, h = root.clientHeight;
      if (!w || !h || (w === W && h === H)) return;
      const anchor = nearest(scroll);
      W = w; H = h;
      renderer.setPixelRatio(dpr());
      renderer.setSize(W, H, false);
      Object.assign(camera, { left: -W / 2, right: W / 2, top: H / 2, bottom: -H / 2 });
      camera.updateProjectionMatrix();
      rt.setSize(W * dpr(), H * dpr());
      lensUniforms.uRes.value.set(W, H);
      lensUniforms.uLens.value.set(W * (W < 768 ? .7 : .6), W);
      measure();
      scroll = target = prev = centerFor(anchor);
    }).observe(root);

    lensUniforms.uLens.value.set(W * (W < 768 ? .7 : .6), W);
    scheduleRefresh();
  }

  function init() {
    initSmoothScroll();
    wrapLetterO();
    initPageLoader();
    initSequenceResize();
    initStaggerChar();
    fitHeroName(); // después de partir en letras: el split pierde kerning y ensancha el nombre
    initGradientWave();
    initLineReveal();
    initRevealGroups();
    initClocks();
    initNavReveal();
    initStaggerLinks();
    initMenu();
    initAnchors();
    initCursor();
    initMarquee();
    initFooterGradient();
    initStuff();
    initCarousel();

    let resizeTimer = 0;
    addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { fitHeroName(); scheduleRefresh(); }, 150);
    });
  }

  document.fonts.ready.then(init);
})();
