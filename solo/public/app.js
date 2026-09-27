(function () {
  'use strict';

  function buildWhatsAppUrl(phone, message) {
    const clean = String(phone || '').replace(/[^\d]/g, '');
    const text = encodeURIComponent(message || '');
    return `https://wa.me/${clean}${text ? `?text=${text}` : ''}`;
  }

  function applyContent(content) {
    document.querySelectorAll('[data-key]').forEach((el) => {
      const key = el.getAttribute('data-key');
      if (content[key] === undefined) return;
      el.innerHTML = content[key].replace(/\n/g, '<br />');
    });

    document.querySelectorAll('[data-img-key]').forEach((el) => {
      const key = el.getAttribute('data-img-key');
      if (content[key]) el.src = content[key];
    });

    const phone = content.whatsapp_number || '972526052935';
    const message = 'היי רותם, אני רוצה לשמוע פרטים על הקורס של SOLO';
    document.querySelectorAll('#header-whatsapp, #hero-whatsapp, #join-whatsapp, #footer-whatsapp').forEach((el) => {
      el.href = buildWhatsAppUrl(phone, message);
    });

    if (content.instagram_url) {
      const ig = document.getElementById('footer-instagram');
      if (ig) ig.href = content.instagram_url;
    }
  }

  function hydrateContent() {
    fetch('/api/landing')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && data.content) applyContent(data.content);
      })
      .catch(() => {
        // Static HTML already carries real copy — page stays correct offline.
      });
  }

  function setupNavToggle() {
    const toggle = document.getElementById('nav-toggle');
    const nav = document.getElementById('main-nav');
    if (!toggle || !nav) return;
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    nav.querySelectorAll('a').forEach((a) =>
      a.addEventListener('click', () => {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      })
    );
  }

  function setupReveal() {
    const items = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );
    items.forEach((el) => observer.observe(el));
  }

  document.addEventListener('DOMContentLoaded', () => {
    hydrateContent();
    setupNavToggle();
    setupReveal();
  });
})();
