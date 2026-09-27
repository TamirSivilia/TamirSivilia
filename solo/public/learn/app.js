(function () {
  'use strict';

  const app = document.getElementById('app');

  async function api(path, options = {}) {
    const res = await fetch(path, {
      credentials: 'include',
      headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
      ...options,
    });
    let body = null;
    try { body = await res.json(); } catch { /* no body */ }
    return { ok: res.ok, status: res.status, body };
  }

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'text') node.textContent = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v);
    }
    for (const child of [].concat(children)) {
      if (child) node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    }
    return node;
  }

  async function renderLogin() {
    app.innerHTML = '';
    let stage = 'phone';
    let phone = '';

    const msg = el('p', { class: 'form-msg' });
    const shell = el('div', { class: 'login-shell' }, [el('h1', { text: 'האזור האישי' })]);

    function draw() {
      const wrap = shell.querySelector('.field-wrap');
      if (wrap) wrap.remove();
      const container = el('div', { class: 'field-wrap' });

      if (stage === 'phone') {
        const phoneInput = el('input', { type: 'tel', placeholder: '05XXXXXXXX', required: 'true', autocomplete: 'tel' });
        container.appendChild(el('form', {
          onsubmit: async (e) => {
            e.preventDefault();
            phone = phoneInput.value;
            msg.textContent = '';
            const { ok, body } = await api('/api/learner/request-code', { method: 'POST', body: JSON.stringify({ phone }) });
            if (!ok) {
              msg.textContent = body && body.error === 'too_many_requests' ? 'יותר מדי ניסיונות, נסי שוב בעוד דקה' : 'שגיאה, נסי שוב';
              msg.className = 'form-msg is-error';
              return;
            }
            stage = 'code';
            msg.textContent = body && body.dev_code
              ? `מצב פיתוח: הקוד הוא ${body.dev_code} (עדיין אין חיבור אמיתי לשליחת SMS)`
              : 'אם המספר רשום במערכת, נשלח קוד. אפשר גם לבקש את הקוד ישירות מרותם.';
            msg.className = 'form-msg is-ok';
            draw();
          },
        }, [
          el('div', { class: 'field' }, [el('label', { text: 'מספר טלפון' }), phoneInput]),
          el('button', { class: 'btn btn-primary', type: 'submit', text: 'שליחת קוד' }),
        ]));
      } else {
        const codeInput = el('input', { type: 'tel', inputmode: 'numeric', maxlength: '6', placeholder: '000000', required: 'true' });
        container.appendChild(el('form', {
          onsubmit: async (e) => {
            e.preventDefault();
            const { ok } = await api('/api/learner/verify', { method: 'POST', body: JSON.stringify({ phone, code: codeInput.value }) });
            if (ok) { renderApp(); return; }
            msg.textContent = 'קוד שגוי או שפג תוקפו';
            msg.className = 'form-msg is-error';
          },
        }, [
          el('div', { class: 'field' }, [el('label', { text: 'קוד כניסה' }), codeInput]),
          el('button', { class: 'btn btn-primary', type: 'submit', text: 'כניסה' }),
          el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => { stage = 'phone'; msg.textContent = ''; draw(); }, text: 'שליחת קוד חדש' }),
        ]));
      }
      shell.appendChild(container);
    }

    draw();
    shell.appendChild(msg);
    app.appendChild(shell);
  }

  async function renderApp() {
    app.innerHTML = '';
    const { ok: meOk, body: me } = await api('/api/learner/me');
    if (!meOk) return renderLogin();

    const header = el('header', { class: 'admin-header' }, [
      el('span', { class: 'wordmark', text: `שלום, ${me.name}` }),
      el('button', {
        class: 'btn btn-ghost btn-sm',
        onclick: async () => { await api('/api/learner/logout', { method: 'POST' }); renderLogin(); },
        text: 'התנתקות',
      }),
    ]);

    const tabsBar = el('div', { class: 'tabs', role: 'tablist' });
    const main = el('main', { class: 'admin-main' });
    const tabs = [
      { id: 'lessons', label: 'שיעורים', render: renderLessonsPanel },
      { id: 'exercises', label: 'מאגר תרגילים', render: renderExercisesPanel },
      { id: 'log', label: 'יומן אימונים', render: renderLogPanel },
    ];
    const panels = {};
    tabs.forEach((tab, i) => {
      const btn = el('button', { class: 'tab-btn', role: 'tab', 'aria-selected': i === 0 ? 'true' : 'false', onclick: () => selectTab(tab.id), text: tab.label });
      tabsBar.appendChild(btn);
      const panel = el('div', { class: 'panel' + (i === 0 ? ' is-active' : ''), id: `panel-${tab.id}` });
      panels[tab.id] = { panel, btn, loaded: false, render: tab.render };
      main.appendChild(panel);
    });
    function selectTab(id) {
      for (const key of Object.keys(panels)) {
        panels[key].panel.classList.toggle('is-active', key === id);
        panels[key].btn.setAttribute('aria-selected', key === id ? 'true' : 'false');
      }
      if (!panels[id].loaded) { panels[id].loaded = true; panels[id].render(panels[id].panel); }
    }

    app.appendChild(header);
    app.appendChild(el('div', { class: 'container' }, [tabsBar]));
    app.appendChild(main);
    selectTab('lessons');
  }

  async function renderLessonsPanel(panel) {
    panel.innerHTML = '<p class="empty-state">טוען…</p>';
    const { ok, body } = await api('/api/learner/lessons');
    if (!ok) { panel.innerHTML = '<p class="empty-state">שגיאה בטעינה.</p>'; return; }
    panel.innerHTML = '';
    if (!body.length) {
      panel.appendChild(el('p', { class: 'empty-state', text: 'עוד אין שיעורים זמינים. יעדכנו אותך כשיתפרסם הראשון.' }));
      return;
    }
    const card = el('div', { class: 'card' });
    for (const lesson of body) {
      const checkbox = el('button', {
        class: 'lesson-checkbox' + (lesson.completed ? ' is-done' : ''),
        'aria-label': lesson.completed ? 'הושלם' : 'סמני כהושלם',
        onclick: async () => {
          await api(`/api/learner/lessons/${lesson.id}/complete`, { method: 'POST' });
          checkbox.classList.add('is-done');
          checkbox.textContent = '✓';
        },
        text: lesson.completed ? '✓' : '',
      });
      const body_ = el('div', { class: 'lesson-body' }, [
        el('h3', { text: lesson.title }),
        lesson.description ? el('p', { text: lesson.description }) : null,
      ]);
      if (lesson.embed_url) {
        body_.appendChild(el('div', { class: 'lesson-embed' }, [
          el('iframe', { src: lesson.embed_url, title: lesson.title, allowfullscreen: 'true', loading: 'lazy' }),
        ]));
      }
      card.appendChild(el('div', { class: 'lesson-item' }, [checkbox, body_]));
    }
    panel.appendChild(card);
  }

  async function renderExercisesPanel(panel) {
    panel.innerHTML = '<p class="empty-state">טוען…</p>';
    const { ok, body } = await api('/api/learner/exercises');
    if (!ok) { panel.innerHTML = '<p class="empty-state">שגיאה בטעינה.</p>'; return; }
    panel.innerHTML = '';
    if (!body.length) {
      panel.appendChild(el('p', { class: 'empty-state', text: 'מאגר התרגילים עוד ריק. בקרוב יתווספו תרגילים.' }));
      return;
    }
    const groups = ['הכול', ...new Set(body.map((e) => e.muscle_group).filter(Boolean))];
    let active = 'הכול';
    const filterBar = el('div', { class: 'muscle-filters' });
    const list = el('div', { class: 'card' });

    function drawList() {
      list.innerHTML = '';
      const items = active === 'הכול' ? body : body.filter((e) => e.muscle_group === active);
      for (const ex of items) {
        const bodyEl = el('div', { class: 'lesson-body' }, [
          el('h3', { text: ex.title }),
          ex.description ? el('p', { text: ex.description }) : null,
        ]);
        if (ex.embed_url) {
          bodyEl.appendChild(el('div', { class: 'lesson-embed' }, [
            el('iframe', { src: ex.embed_url, title: ex.title, allowfullscreen: 'true', loading: 'lazy' }),
          ]));
        }
        list.appendChild(el('div', { class: 'lesson-item' }, [bodyEl]));
      }
    }

    for (const g of groups) {
      filterBar.appendChild(el('button', {
        class: 'muscle-filter', 'aria-pressed': g === active ? 'true' : 'false',
        onclick: (e) => {
          active = g;
          filterBar.querySelectorAll('.muscle-filter').forEach((b) => b.setAttribute('aria-pressed', 'false'));
          e.target.setAttribute('aria-pressed', 'true');
          drawList();
        },
        text: g,
      }));
    }
    drawList();
    panel.appendChild(filterBar);
    panel.appendChild(list);
  }

  async function renderLogPanel(panel) {
    panel.innerHTML = '<p class="empty-state">טוען…</p>';

    const dateInput = el('input', { type: 'date' });
    const notesInput = el('textarea', { placeholder: 'מה עשית באימון, איך הרגשת, מה להעלות בפעם הבאה…' });
    const msg = el('p', { class: 'form-msg' });
    const list = el('div', { class: 'card' });

    async function load() {
      const { ok, body } = await api('/api/learner/log');
      list.innerHTML = '';
      if (!ok || !body.length) {
        list.appendChild(el('p', { class: 'empty-state', text: 'עוד אין אימונים ביומן. הוסיפי את הראשון אחרי האימון הבא.' }));
        return;
      }
      for (const entry of body) {
        list.appendChild(el('div', { class: 'log-entry' }, [
          el('span', { class: 'log-date', text: entry.entry_date }),
          el('span', { class: 'log-notes', text: entry.notes }),
          el('button', {
            class: 'btn btn-ghost btn-sm', onclick: async () => { await api(`/api/learner/log/${entry.id}`, { method: 'DELETE' }); load(); },
            text: 'מחיקה',
          }),
        ]));
      }
    }

    const form = el('form', {
      onsubmit: async (e) => {
        e.preventDefault();
        const { ok } = await api('/api/learner/log', { method: 'POST', body: JSON.stringify({ entry_date: dateInput.value, notes: notesInput.value }) });
        if (ok) {
          notesInput.value = '';
          msg.textContent = 'נשמר.';
          msg.className = 'form-msg is-ok';
          load();
        } else {
          msg.textContent = 'יש למלא תאריך והערה.';
          msg.className = 'form-msg is-error';
        }
      },
    }, [
      el('div', { class: 'field' }, [el('label', { text: 'תאריך' }), dateInput]),
      el('div', { class: 'field' }, [el('label', { text: 'הערות' }), notesInput]),
      el('button', { class: 'btn btn-primary', type: 'submit', text: 'שמירה' }),
      msg,
    ]);

    panel.innerHTML = '';
    panel.appendChild(el('div', { class: 'card' }, [el('h2', { text: 'רישום אימון חדש' }), form]));
    panel.appendChild(el('a', { class: 'btn btn-ghost btn-sm', href: '/api/learner/log/export.csv', text: 'ייצוא ל-CSV', style: 'margin-block-end:1rem;display:inline-flex' }));
    panel.appendChild(list);
    load();
  }

  (async function init() {
    const { ok } = await api('/api/learner/me');
    if (ok) renderApp();
    else renderLogin();
  })();
})();
