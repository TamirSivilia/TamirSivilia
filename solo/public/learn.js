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

  function showApp() {
    el('login-view').hidden = true;
    el('app-view').hidden = false;
    el('logout-btn').hidden = false;
    loadLessons();
    loadExercises();
    loadProgress();
  }

  function showLogin() {
    el('login-view').hidden = false;
    el('app-view').hidden = true;
    el('logout-btn').hidden = true;
  }

  // ---- auth ----

  let pendingPhone = '';

  el('phone-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const note = el('phone-note');
    note.textContent = '';
    note.classList.remove('is-error');
    const phone = el('phone-input').value.trim();
    const { ok, data } = await api('/api/trainee/auth/request-code', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
    if (!ok) {
      note.textContent =
        data.error === 'trainee_not_found'
          ? 'המספר לא נמצא במערכת. פני לרותם כדי להצטרף.'
          : data.error === 'access_paused'
          ? 'הגישה שלך מושהית כרגע. פני לרותם.'
          : data.message || 'שליחת הקוד נכשלה, נסי שוב.';
      note.classList.add('is-error');
      return;
    }
    pendingPhone = phone;
    el('code-form').hidden = false;
    note.textContent = data.devCode ? `מצב בדיקה: הקוד הוא ${data.devCode}` : 'קוד נשלח בהודעת SMS.';
  });

  el('code-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const note = el('code-note');
    note.textContent = '';
    note.classList.remove('is-error');
    const code = el('code-input').value.trim();
    const { ok, data } = await api('/api/trainee/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ phone: pendingPhone, code }),
    });
    if (!ok) {
      note.textContent = 'קוד שגוי או שפג תוקפו.';
      note.classList.add('is-error');
      return;
    }
    showApp();
  });

  el('logout-btn').addEventListener('click', async () => {
    await api('/api/trainee/auth/logout', { method: 'POST' });
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

  // ---- lessons ----

  async function loadLessons() {
    const { ok, data } = await api('/api/trainee/lessons');
    if (!ok) return;
    const list = el('lessons-list');
    list.innerHTML = '';
    el('lessons-empty').hidden = data.lessons.length > 0;
    data.lessons.forEach((lesson) => {
      const card = document.createElement('div');
      card.className = 'lesson-card';
      card.innerHTML = `
        <div>
          ${lesson.muscle_group ? `<p class="lesson-card__group">${escapeHtml(lesson.muscle_group)}</p>` : ''}
          <p class="lesson-card__title">${escapeHtml(lesson.title)}</p>
          ${lesson.description ? `<p class="lesson-card__desc">${escapeHtml(lesson.description)}</p>` : ''}
          ${lesson.youtube_url ? `<a href="${escapeAttr(lesson.youtube_url)}" target="_blank" rel="noopener">צפייה בסרטון ↗</a>` : ''}
        </div>
        <button class="lesson-card__check ${lesson.completed ? 'is-done' : ''}" data-id="${lesson.id}" data-done="${lesson.completed ? '1' : '0'}">
          ${lesson.completed ? 'הושלם ✓' : 'סימון כהושלם'}
        </button>
      `;
      list.appendChild(card);
    });
    list.querySelectorAll('.lesson-card__check').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const done = btn.dataset.done === '1';
        await api(`/api/trainee/lessons/${id}/complete`, { method: done ? 'DELETE' : 'POST' });
        loadLessons();
      });
    });
  }

  // ---- exercises ----

  async function loadExercises() {
    const { ok, data } = await api('/api/trainee/exercises');
    if (!ok) return;
    const groups = {};
    data.exercises.forEach((ex) => {
      groups[ex.muscle_group] = groups[ex.muscle_group] || [];
      groups[ex.muscle_group].push(ex);
    });
    const container = el('exercises-list');
    container.innerHTML = '';
    Object.entries(groups).forEach(([group, items]) => {
      const block = document.createElement('div');
      block.className = 'exercise-group';
      block.innerHTML = `<h3>${escapeHtml(group)}</h3><ul>${items
        .map((i) => `<li>${escapeHtml(i.name)}</li>`)
        .join('')}</ul>`;
      container.appendChild(block);
    });
  }

  // ---- progress ----

  el('progress-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      entry_date: el('pf-date').value,
      exercise: el('pf-exercise').value.trim(),
      sets: el('pf-sets').value ? Number(el('pf-sets').value) : null,
      reps: el('pf-reps').value ? Number(el('pf-reps').value) : null,
      weight: el('pf-weight').value ? Number(el('pf-weight').value) : null,
      notes: el('pf-notes').value.trim(),
    };
    const { ok } = await api('/api/trainee/progress', { method: 'POST', body: JSON.stringify(body) });
    if (ok) {
      e.target.reset();
      loadProgress();
    }
  });

  async function loadProgress() {
    const { ok, data } = await api('/api/trainee/progress');
    if (!ok) return;
    const tbody = el('progress-tbody');
    tbody.innerHTML = '';
    el('progress-empty').hidden = data.entries.length > 0;
    data.entries.forEach((entry) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(entry.entry_date)}</td>
        <td>${escapeHtml(entry.exercise)}</td>
        <td>${entry.sets ?? ''}</td>
        <td>${entry.reps ?? ''}</td>
        <td>${entry.weight ?? ''}</td>
        <td>${escapeHtml(entry.notes || '')}</td>
        <td><button class="row-delete" data-id="${entry.id}">מחיקה</button></td>
      `;
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll('.row-delete').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await api(`/api/trainee/progress/${btn.dataset.id}`, { method: 'DELETE' });
        loadProgress();
      });
    });
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function escapeAttr(str) {
    return escapeHtml(str);
  }

  // ---- init ----

  (async () => {
    const { ok } = await api('/api/trainee/me');
    if (ok) showApp();
    else showLogin();
  })();
})();
