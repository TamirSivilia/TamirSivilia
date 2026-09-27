(function () {
  'use strict';

  function whatsappUrl(number, message) {
    return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
  }

  function renderList(ul, items) {
    ul.innerHTML = '';
    for (const text of items) {
      const li = document.createElement('li');
      li.textContent = text;
      ul.appendChild(li);
    }
  }

  function renderSteps(ol, items) {
    ol.innerHTML = '';
    items.forEach((text, i) => {
      const li = document.createElement('li');
      const num = document.createElement('div');
      num.className = 'step-number';
      num.textContent = String(i + 1).padStart(2, '0');
      const p = document.createElement('p');
      p.textContent = text;
      li.appendChild(num);
      li.appendChild(p);
      ol.appendChild(li);
    });
  }

  function renderFaq(container, items) {
    container.innerHTML = '';
    for (const item of items) {
      const details = document.createElement('details');
      details.className = 'faq-item';
      const summary = document.createElement('summary');
      summary.textContent = item.q;
      const p = document.createElement('p');
      p.textContent = item.a;
      details.appendChild(summary);
      details.appendChild(p);
      container.appendChild(details);
    }
  }

  function parseJsonSafe(value, fallback) {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  async function hydrate() {
    let content;
    try {
      const res = await fetch('/api/content');
      content = await res.json();
    } catch (err) {
      console.error('SOLO: failed to load content', err);
      return;
    }

    const get = (key) => (content[key] ? content[key].value : '');
    const isDraft = (key) => !content[key] || content[key].draft;

    document.querySelectorAll('[data-bind]').forEach((el) => {
      const key = el.getAttribute('data-bind');
      if (isDraft(key)) return; // never show unapproved copy publicly
      el.textContent = get(key);
    });

    document.querySelectorAll('[data-bind-list]').forEach((el) => {
      const key = el.getAttribute('data-bind-list');
      if (isDraft(key)) return;
      renderList(el, parseJsonSafe(get(key), []));
    });

    document.querySelectorAll('[data-bind-steps]').forEach((el) => {
      const key = el.getAttribute('data-bind-steps');
      if (isDraft(key)) return;
      renderSteps(el, parseJsonSafe(get(key), []));
    });

    // About / coaching sections only appear once Rotem has approved real copy
    // (is_draft cleared from /admin). Until then they stay hidden rather than
    // showing placeholder text to visitors.
    if (!isDraft('about_text') && get('about_text').trim()) {
      document.getElementById('about').hidden = false;
    }
    if (!isDraft('coaching_intro') && get('coaching_intro').trim()) {
      document.getElementById('coaching').hidden = false;
    }

    const faqItems = isDraft('faq_items') ? [] : parseJsonSafe(get('faq_items'), []);
    if (faqItems.length) {
      renderFaq(document.querySelector('[data-bind-faq]'), faqItems);
      document.getElementById('faq').hidden = false;
      document.getElementById('nav-faq').hidden = false;
    }

    const number = get('whatsapp_number');
    const instagram = get('instagram_url');
    document.querySelectorAll('[data-whatsapp]').forEach((el) => {
      const kind = el.getAttribute('data-whatsapp');
      const message = get(kind === 'coaching' ? 'whatsapp_message_coaching' : 'whatsapp_message_course');
      el.href = whatsappUrl(number, message);
    });
    if (instagram && !isDraft('instagram_url')) {
      const link = document.getElementById('footer-instagram');
      link.href = instagram;
      link.hidden = false;
    }

    setupReveal();
  }

  function setupReveal() {
    const targets = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      targets.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15 }
    );
    targets.forEach((el) => observer.observe(el));
  }

  document.addEventListener('DOMContentLoaded', hydrate);
})();
