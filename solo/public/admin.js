(function () {
  'use strict';

  const api = async (url, options = {}) => {
    const res = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  };

  const el = (id) => document.getElementById(id);

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function showApp() {
    el('login-view').hidden = true;
    el('app-view').hidden = false;
    el('logout-btn').hidden = false;
    loadTrainees();
    loadLessons();
    loadLanding();
  }

  function showLogin() {
    el('login-view').hidden = false;
    el('app-view').hidden = true;
    el('logout-btn').hidden = true;
  }

  // ---- auth ----

  el('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const note = el('login-note');
    note.textContent = '';
    note.classList.remove('is-error');
    const username = el('username-input').value.trim();
    const password = el('password-input').value;
    const { ok, data } = await api('/api/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (!ok) {
      note.textContent = data.message || 'פרטי כניסה שגויים.';
      note.classList.add('is-error');
      return;
    }
    if (data.twoFactor) {
      el('twofa-form').hidden = false;
      el('twofa-note').textContent = data.devCode ? `מצב בדיקה: הקוד הוא ${data.devCode}` : 'קוד נשלח בהודעת SMS.';
    } else {
      showApp();
    }
  });

  el('twofa-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const note = el('twofa-note');
    const code = el('twofa-input').value.trim();
    const { ok } = await api('/api/admin/auth/verify-2fa', { method: 'POST', body: JSON.stringify({ code }) });
    if (!ok) {
      note.textContent = 'קוד שגוי.';
      note.classList.add('is-error');
      return;
    }
    showApp();
  });

  el('logout-btn').addEventListener('click', async () => {
    await api('/api/admin/auth/logout', { method: 'POST' });
    showLogin();
  });

  // ---- tabs ----

  document.querySelectorAll('.app-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.app-tab').forEach((t) => t.classList.remove('is-active'));
      document.querySelectorAll('.app-panel').forEach((p) => p.classList.remove('is-active'));
      tab.classList.add('is-active');
      el(`panel-${tab.dataset.tab}`).classList.add('is-active');
    });
  });

  // ---- trainees ----

  el('trainee-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const note = el('trainee-note');
    note.textContent = '';
    note.classList.remove('is-error');
    const name = el('tf-name').value.trim();
    const phone = el('tf-phone').value.trim();
    const { ok, data } = await api('/api/admin/trainees', { method: 'POST', body: JSON.stringify({ name, phone }) });
    if (!ok) {
      note.textContent = data.error === 'phone_already_exists' ? 'המספר הזה כבר קיים במערכת.' : 'שמירה נכשלה.';
      note.classList.add('is-error');
      return;
    }
    e.target.reset();
    note.textContent = 'נוספה בהצלחה.';
    loadTrainees();
  });

  async function loadTrainees() {
    const { ok, data } = await api('/api/admin/trainees');
    if (!ok) return;
    const wrap = el('trainees-list');
    if (data.trainees.length === 0) {
      wrap.innerHTML = '<p class="empty-note">עדיין אין מתאמנות.</p>';
      return;
    }
    wrap.innerHTML = `
      <table class="admin-table">
        <thead><tr><th>שם</th><th>טלפון</th><th>סטטוס</th><th></th></tr></thead>
        <tbody>
          ${data.trainees
            .map(
              (t) => `
            <tr>
              <td>${escapeHtml(t.name)}</td>
              <td dir="ltr">${escapeHtml(t.phone)}</td>
              <td><span class="status-pill status-pill--${t.status}">${t.status === 'active' ? 'פעילה' : 'מושהית'}</span></td>
              <td>
                <button class="row-btn" data-id="${t.id}" data-status="${t.status === 'active' ? 'paused' : 'active'}">
                  ${t.status === 'active' ? 'השהיה' : 'חידוש גישה'}
                </button>
              </td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
    `;
    wrap.querySelectorAll('.row-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await api(`/api/admin/trainees/${btn.dataset.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: btn.dataset.status }),
        });
        loadTrainees();
      });
    });
  }

  // ---- lessons ----

  const lessonForm = el('lesson-form');

  lessonForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const note = el('lesson-note');
    note.textContent = '';
    note.classList.remove('is-error');
    const id = el('lf-id').value;
    const body = {
      title: el('lf-title').value.trim(),
      muscle_group: el('lf-muscle').value.trim(),
      description: el('lf-desc').value.trim(),
      youtube_url: el('lf-url').value.trim(),
      sort_order: Number(el('lf-order').value) || 0,
      status: el('lf-status').value,
    };
    const { ok, data } = id
      ? await api(`/api/admin/lessons/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
      : await api('/api/admin/lessons', { method: 'POST', body: JSON.stringify(body) });
    if (!ok) {
      note.textContent = data.error === 'invalid_youtube_url' ? 'קישור YouTube לא תקין.' : 'שמירה נכשלה.';
      note.classList.add('is-error');
      return;
    }
    resetLessonForm();
    loadLessons();
  });

  el('lf-cancel').addEventListener('click', resetLessonForm);

  function resetLessonForm() {
    lessonForm.reset();
    el('lf-id').value = '';
    el('lf-order').value = 0;
    el('lf-submit').textContent = 'הוספת שיעור';
    el('lf-cancel').hidden = true;
  }

  async function loadLessons() {
    const { ok, data } = await api('/api/admin/lessons');
    if (!ok) return;
    const wrap = el('lessons-admin-list');
    wrap.innerHTML = '';
    data.lessons.forEach((lesson) => {
      const card = document.createElement('div');
      card.className = 'lesson-card admin-lesson-card';
      card.innerHTML = `
        <div>
          <p class="lesson-card__group">${escapeHtml(lesson.muscle_group || '—')} · #${lesson.sort_order}</p>
          <p class="lesson-card__title">${escapeHtml(lesson.title)}</p>
          <span class="status-pill status-pill--${lesson.status}">${lesson.status === 'published' ? 'מפורסם' : 'טיוטה'}</span>
        </div>
        <div>
          <button class="row-btn" data-action="edit">עריכה</button>
          <button class="row-btn" data-action="toggle">${lesson.status === 'published' ? 'הסרה לטיוטה' : 'פרסום'}</button>
          <button class="row-btn row-btn--danger" data-action="delete">מחיקה</button>
        </div>
      `;
      card.querySelector('[data-action="edit"]').addEventListener('click', () => {
        el('lf-id').value = lesson.id;
        el('lf-title').value = lesson.title;
        el('lf-muscle').value = lesson.muscle_group;
        el('lf-desc').value = lesson.description;
        el('lf-url').value = lesson.youtube_url;
        el('lf-order').value = lesson.sort_order;
        el('lf-status').value = lesson.status;
        el('lf-submit').textContent = 'עדכון שיעור';
        el('lf-cancel').hidden = false;
        lessonForm.scrollIntoView({ behavior: 'smooth' });
      });
      card.querySelector('[data-action="toggle"]').addEventListener('click', async () => {
        await api(`/api/admin/lessons/${lesson.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: lesson.status === 'published' ? 'draft' : 'published' }),
        });
        loadLessons();
      });
      card.querySelector('[data-action="delete"]').addEventListener('click', async () => {
        if (!confirm('למחוק את השיעור מהאתר? הסרטון עצמו לא יימחק מיוטיוב.')) return;
        await api(`/api/admin/lessons/${lesson.id}`, { method: 'DELETE' });
        loadLessons();
      });
      wrap.appendChild(card);
    });
  }

  // ---- landing content ----

  const LANDING_FIELDS = [
    { key: 'hero_title', label: 'כותרת ראשית', textarea: true },
    { key: 'hero_subtitle', label: 'פתיח מתחת לכותרת', textarea: true },
    { key: 'tagline', label: 'המשפט המרכזי (מופיע כמה פעמים באתר)', textarea: true },
    { key: 'about_text', label: 'טקסט אודות', textarea: true },
    { key: 'course_name', label: 'שם הקורס (מופיע באזור המתאמנות)' },
    { key: 'whatsapp_number', label: 'מספר WhatsApp (בפורמט 972...)' },
    { key: 'instagram_url', label: 'קישור לאינסטגרם' },
    { key: 'hero_image_url', label: 'קישור לתמונת פתיחה (אופציונלי)' },
    { key: 'personal_image_url', label: 'קישור לתמונה אישית (אופציונלי)' },
  ];

  async function loadLanding() {
    const { ok, data } = await api('/api/admin/landing');
    if (!ok) return;
    const form = el('landing-form');
    form.innerHTML = LANDING_FIELDS.map(
      (f) => `
      <div>
        <label for="lc-${f.key}">${f.label}</label>
        ${
          f.textarea
            ? `<textarea id="lc-${f.key}">${escapeHtml(data.content[f.key] || '')}</textarea>`
            : `<input id="lc-${f.key}" value="${escapeHtml(data.content[f.key] || '')}" />`
        }
      </div>`
    ).join('');
  }

  el('landing-save').addEventListener('click', async () => {
    const note = el('landing-note');
    note.textContent = '';
    const body = {};
    LANDING_FIELDS.forEach((f) => {
      body[f.key] = el(`lc-${f.key}`).value;
    });
    const { ok } = await api('/api/admin/landing', { method: 'PATCH', body: JSON.stringify(body) });
    note.textContent = ok ? 'נשמר בהצלחה.' : 'השמירה נכשלה.';
    note.classList.toggle('is-error', !ok);
  });

  // ---- init ----

  (async () => {
    const { ok } = await api('/api/admin/me');
    if (ok) showApp();
    else showLogin();
  })();
})();
