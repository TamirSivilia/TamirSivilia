(function () {
  'use strict';

  const app = document.getElementById('app');

  const CONTENT_FIELDS = [
    { key: 'brand_label', label: 'שם המותג', type: 'text' },
    { key: 'hero_headline', label: 'כותרת ראשית (הירו)', type: 'textarea' },
    { key: 'hero_sub', label: 'תת-כותרת הירו', type: 'textarea' },
    { key: 'problem_lines', label: '"מוכר לך?" — שורה בכל שדה', type: 'list' },
    { key: 'for_list', label: 'למי זה מתאים — שורה לכל פריט', type: 'list' },
    { key: 'not_for_list', label: 'למי זה פחות מתאים — שורה לכל פריט', type: 'list' },
    { key: 'course_includes', label: 'מה מקבלים בקורס — שורה לכל פריט', type: 'list' },
    { key: 'how_it_works', label: 'איך זה עובד — שורה לכל שלב', type: 'list' },
    { key: 'about_text', label: 'טקסט "מי מלמדת" (גוף ראשון, רותם)', type: 'textarea' },
    { key: 'coaching_intro', label: 'טקסט ליווי אישי', type: 'textarea' },
    { key: 'faq_items', label: 'שאלות נפוצות — כל שורה: שאלה | תשובה', type: 'faq' },
    { key: 'whatsapp_number', label: 'מספר וואטסאפ (למשל 972501234567)', type: 'text' },
    { key: 'whatsapp_message_course', label: 'הודעת וואטסאפ — קורס', type: 'text' },
    { key: 'whatsapp_message_coaching', label: 'הודעת וואטסאפ — ליווי אישי', type: 'text' },
    { key: 'instagram_url', label: 'קישור לאינסטגרם', type: 'text' },
  ];

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
    const msg = el('p', { class: 'form-msg' });
    const passwordInput = el('input', { type: 'password', id: 'password', required: 'true', autocomplete: 'current-password' });
    const form = el('form', {
      onsubmit: async (e) => {
        e.preventDefault();
        msg.textContent = '';
        const { ok, body } = await api('/api/admin/login', {
          method: 'POST',
          body: JSON.stringify({ password: passwordInput.value }),
        });
        if (ok) {
          renderApp();
        } else {
          msg.textContent = 'סיסמה שגויה. נסי שוב.';
          msg.className = 'form-msg is-error';
        }
      },
    }, [
      el('div', { class: 'field' }, [
        el('label', { for: 'password', text: 'סיסמת ניהול' }),
        passwordInput,
      ]),
      el('button', { class: 'btn btn-primary', type: 'submit', text: 'כניסה' }),
      msg,
    ]);
    app.appendChild(
      el('div', { class: 'login-shell' }, [
        el('h1', { text: 'ניהול SOLO' }),
        form,
      ])
    );
  }

  async function renderApp() {
    app.innerHTML = '';
    const header = el('header', { class: 'admin-header' }, [
      el('span', { class: 'wordmark', text: 'SOLO — ניהול' }),
      el('button', {
        class: 'btn btn-ghost btn-sm',
        onclick: async () => { await api('/api/admin/logout', { method: 'POST' }); renderLogin(); },
        text: 'התנתקות',
      }),
    ]);

    const tabsBar = el('div', { class: 'tabs', role: 'tablist' });
    const main = el('main', { class: 'admin-main' });

    const tabs = [
      { id: 'learners', label: 'מתאמנות', render: renderLearnersPanel },
      { id: 'videos', label: 'סרטונים', render: renderVideosPanel },
      { id: 'content', label: 'תוכן האתר', render: renderContentPanel },
    ];

    const panels = {};
    tabs.forEach((tab, i) => {
      const btn = el('button', {
        class: 'tab-btn', role: 'tab', 'aria-selected': i === 0 ? 'true' : 'false',
        onclick: () => selectTab(tab.id),
        text: tab.label,
      });
      tabsBar.appendChild(btn);
      const panel = el('div', { class: 'panel' + (i === 0 ? ' is-active' : ''), id: `panel-${tab.id}` });
      panels[tab.id] = { panel, btn, loaded: false, render: tab.render };
      main.appendChild(panel);
    });

    function selectTab(id) {
      for (const key of Object.keys(panels)) {
        const p = panels[key];
        p.panel.classList.toggle('is-active', key === id);
        p.btn.setAttribute('aria-selected', key === id ? 'true' : 'false');
      }
      if (!panels[id].loaded) {
        panels[id].loaded = true;
        panels[id].render(panels[id].panel);
      }
    }

    app.appendChild(header);
    app.appendChild(el('div', { class: 'container' }, [tabsBar]));
    app.appendChild(main);
    selectTab('learners');
  }

  // ---------- Learners ----------

  async function renderLearnersPanel(panel) {
    panel.innerHTML = '<p class="empty-state">טוען…</p>';

    const nameInput = el('input', { type: 'text', required: 'true', placeholder: 'שם מלא' });
    const phoneInput = el('input', { type: 'tel', required: 'true', placeholder: '05XXXXXXXX' });
    const addMsg = el('p', { class: 'form-msg' });

    const tableBody = el('tbody');
    const table = el('table', { class: 'admin-table' }, [
      el('thead', {}, [el('tr', {}, [
        el('th', { text: 'שם' }), el('th', { text: 'טלפון' }), el('th', { text: 'סטטוס' }), el('th', { text: 'פעולות' }),
      ])]),
      tableBody,
    ]);

    async function load() {
      const { ok, body } = await api('/api/admin/learners');
      if (!ok) { panel.innerHTML = '<p class="empty-state">שגיאה בטעינת הרשימה.</p>'; return; }
      tableBody.innerHTML = '';
      if (!body.length) {
        tableBody.appendChild(el('tr', {}, [el('td', { colspan: '4', class: 'empty-state', text: 'עוד אין מתאמנות. הוסיפי את הראשונה למעלה.' })]));
        return;
      }
      for (const learner of body) {
        const statusBadge = el('span', { class: `badge badge-${learner.status}`, text: learner.status === 'active' ? 'פעילה' : 'מושהית' });
        const toggleBtn = el('button', {
          class: 'btn btn-ghost btn-sm',
          onclick: async () => {
            await api(`/api/admin/learners/${learner.id}/${learner.status === 'active' ? 'pause' : 'resume'}`, { method: 'POST' });
            load();
          },
          text: learner.status === 'active' ? 'השהי גישה' : 'הפעילי מחדש',
        });
        const delBtn = el('button', {
          class: 'btn btn-danger btn-sm',
          onclick: async () => {
            if (!confirm(`למחוק את ${learner.name} לצמיתות?`)) return;
            await api(`/api/admin/learners/${learner.id}`, { method: 'DELETE' });
            load();
          },
          text: 'מחיקה',
        });
        tableBody.appendChild(el('tr', {}, [
          el('td', { text: learner.name }),
          el('td', {}, [el('bdi', { dir: 'ltr', text: learner.phone_display })]),
          el('td', {}, [statusBadge]),
          el('td', { class: 'actions' }, [toggleBtn, delBtn]),
        ]));
      }
    }

    const addForm = el('form', {
      onsubmit: async (e) => {
        e.preventDefault();
        addMsg.textContent = '';
        const { ok, body, status } = await api('/api/admin/learners', {
          method: 'POST',
          body: JSON.stringify({ name: nameInput.value, phone: phoneInput.value }),
        });
        if (ok) {
          nameInput.value = ''; phoneInput.value = '';
          addMsg.textContent = 'נוספה בהצלחה.';
          addMsg.className = 'form-msg is-ok';
          load();
        } else {
          addMsg.textContent = status === 409 ? 'המספר כבר קיים במערכת' : 'שם או מספר טלפון לא תקינים';
          addMsg.className = 'form-msg is-error';
        }
      },
    }, [
      el('div', { class: 'field' }, [el('label', { text: 'הוספת מתאמנת' }), nameInput]),
      el('div', { class: 'field' }, [el('label', { text: 'טלפון' }), phoneInput]),
      el('button', { class: 'btn btn-primary', type: 'submit', text: 'הוספה' }),
      addMsg,
    ]);

    panel.innerHTML = '';
    panel.appendChild(el('div', { class: 'card' }, [el('h2', { text: 'הוספת מתאמנת' }), addForm]));
    panel.appendChild(el('div', { class: 'card' }, [el('h2', { text: 'רשימת מתאמנות' }), table]));
    load();
  }

  // ---------- Videos ----------

  async function renderVideosPanel(panel) {
    panel.innerHTML = '<p class="empty-state">טוען…</p>';

    const kindSelect = el('select', {}, [
      el('option', { value: 'lesson', text: 'שיעור' }),
      el('option', { value: 'exercise', text: 'תרגיל' }),
    ]);
    const titleInput = el('input', { type: 'text', required: 'true', placeholder: 'כותרת' });
    const descInput = el('textarea', { placeholder: 'תיאור קצר' });
    const urlInput = el('input', { type: 'url', placeholder: 'קישור יוטיוב (אפשר להשאיר ריק בינתיים)' });
    const muscleInput = el('input', { type: 'text', placeholder: 'קבוצת שריר (לתרגילים)' });
    const orderInput = el('input', { type: 'number', value: '0' });
    const addMsg = el('p', { class: 'form-msg' });

    const tableBody = el('tbody');
    const table = el('table', { class: 'admin-table' }, [
      el('thead', {}, [el('tr', {}, [
        el('th', { text: 'סוג' }), el('th', { text: 'כותרת' }), el('th', { text: 'סטטוס' }), el('th', { text: 'פעולות' }),
      ])]),
      tableBody,
    ]);

    async function load() {
      const { ok, body } = await api('/api/admin/videos');
      if (!ok) { panel.innerHTML = '<p class="empty-state">שגיאה בטעינה.</p>'; return; }
      tableBody.innerHTML = '';
      if (!body.length) {
        tableBody.appendChild(el('tr', {}, [el('td', { colspan: '4', class: 'empty-state', text: 'עוד אין סרטונים.' })]));
        return;
      }
      for (const v of body) {
        const statusBadge = el('span', { class: `badge badge-${v.status}`, text: v.status === 'published' ? 'פורסם' : 'טיוטה' });
        const toggleBtn = el('button', {
          class: 'btn btn-ghost btn-sm',
          onclick: async () => {
            await api(`/api/admin/videos/${v.id}`, { method: 'PUT', body: JSON.stringify({ status: v.status === 'published' ? 'draft' : 'published' }) });
            load();
          },
          text: v.status === 'published' ? 'הסתרה (טיוטה)' : 'פרסום',
        });
        const delBtn = el('button', {
          class: 'btn btn-danger btn-sm',
          onclick: async () => {
            if (!confirm(`למחוק את "${v.title}"? (הסרטון עצמו לא יימחק מיוטיוב)`)) return;
            await api(`/api/admin/videos/${v.id}`, { method: 'DELETE' });
            load();
          },
          text: 'הסרה מהאתר',
        });
        tableBody.appendChild(el('tr', {}, [
          el('td', { text: v.kind === 'lesson' ? 'שיעור' : 'תרגיל' }),
          el('td', { text: v.title }),
          el('td', {}, [statusBadge]),
          el('td', { class: 'actions' }, [toggleBtn, delBtn]),
        ]));
      }
    }

    const addForm = el('form', {
      onsubmit: async (e) => {
        e.preventDefault();
        addMsg.textContent = '';
        const { ok, body, status } = await api('/api/admin/videos', {
          method: 'POST',
          body: JSON.stringify({
            kind: kindSelect.value, title: titleInput.value, description: descInput.value,
            youtube_url: urlInput.value, muscle_group: muscleInput.value, order_index: Number(orderInput.value) || 0,
          }),
        });
        if (ok) {
          titleInput.value = ''; descInput.value = ''; urlInput.value = ''; muscleInput.value = '';
          addMsg.textContent = 'נוסף כטיוטה. אפשר לפרסם מהרשימה למטה.';
          addMsg.className = 'form-msg is-ok';
          load();
        } else {
          addMsg.textContent = body && body.message ? body.message : 'בדקי את הכותרת והקישור';
          addMsg.className = 'form-msg is-error';
        }
      },
    }, [
      el('div', { class: 'field' }, [el('label', { text: 'סוג' }), kindSelect]),
      el('div', { class: 'field' }, [el('label', { text: 'כותרת' }), titleInput]),
      el('div', { class: 'field' }, [el('label', { text: 'תיאור' }), descInput]),
      el('div', { class: 'field' }, [el('label', { text: 'קישור יוטיוב' }), urlInput]),
      el('div', { class: 'field' }, [el('label', { text: 'קבוצת שריר' }), muscleInput]),
      el('div', { class: 'field' }, [el('label', { text: 'סדר הצגה' }), orderInput]),
      el('button', { class: 'btn btn-primary', type: 'submit', text: 'הוספה כטיוטה' }),
      addMsg,
    ]);

    panel.innerHTML = '';
    panel.appendChild(el('div', { class: 'card' }, [el('h2', { text: 'הוספת שיעור / תרגיל' }), addForm]));
    panel.appendChild(el('div', { class: 'card' }, [el('h2', { text: 'רשימת סרטונים' }), table]));
    load();
  }

  // ---------- Content ----------

  function valueToEditable(field, raw) {
    if (field.type === 'list') {
      try { return JSON.parse(raw).join('\n'); } catch { return ''; }
    }
    if (field.type === 'faq') {
      try { return JSON.parse(raw).map((f) => `${f.q} | ${f.a}`).join('\n'); } catch { return ''; }
    }
    return raw;
  }

  function editableToValue(field, text) {
    if (field.type === 'list') {
      return JSON.stringify(text.split('\n').map((s) => s.trim()).filter(Boolean));
    }
    if (field.type === 'faq') {
      return JSON.stringify(
        text.split('\n').map((s) => s.trim()).filter(Boolean).map((line) => {
          const [q, ...rest] = line.split('|');
          return { q: (q || '').trim(), a: rest.join('|').trim() };
        })
      );
    }
    return text;
  }

  async function renderContentPanel(panel) {
    panel.innerHTML = '<p class="empty-state">טוען…</p>';
    const { ok, body } = await api('/api/admin/content');
    if (!ok) { panel.innerHTML = '<p class="empty-state">שגיאה בטעינה.</p>'; return; }

    panel.innerHTML = '';
    for (const field of CONTENT_FIELDS) {
      const current = body[field.key] || { value: '', draft: false };
      const input = field.type === 'text'
        ? el('input', { type: 'text', value: current.value })
        : el('textarea', { text: valueToEditable(field, current.value) });
      if (field.type === 'text') input.value = current.value;

      const draftCheckbox = el('input', { type: 'checkbox' });
      draftCheckbox.checked = current.draft;

      const msg = el('p', { class: 'form-msg' });

      const form = el('form', {
        onsubmit: async (e) => {
          e.preventDefault();
          const value = editableToValue(field, input.value);
          const { ok } = await api(`/api/admin/content/${field.key}`, {
            method: 'PUT',
            body: JSON.stringify({ value, draft: draftCheckbox.checked }),
          });
          msg.textContent = ok ? 'נשמר.' : 'שגיאה בשמירה.';
          msg.className = 'form-msg ' + (ok ? 'is-ok' : 'is-error');
        },
      }, [
        el('div', { class: 'field' }, [
          el('label', { text: field.label }),
          input,
        ]),
        el('div', { class: 'field-row' }, [
          draftCheckbox,
          el('label', { text: 'טיוטה — לא להציג באתר הציבורי' }),
        ]),
        el('button', { class: 'btn btn-primary btn-sm', type: 'submit', text: 'שמירה' }),
        msg,
      ]);

      panel.appendChild(el('div', { class: 'card' }, [form]));
    }
  }

  // ---------- Boot ----------

  (async function init() {
    const { ok } = await api('/api/admin/me');
    if (ok) renderApp();
    else renderLogin();
  })();
})();
