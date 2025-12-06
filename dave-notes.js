// =======================================
// DAVE NOTES - Multi-modal Notes App
// Front-end only: uses localStorage per browser
// =======================================

const DN_CONFIG = {
    STORAGE_KEYS: {
        USERS: 'daveNotes_users',
        SESSION: 'daveNotes_session',
        NOTES_PREFIX: 'daveNotes_notes_',      // + username
        SETTINGS_PREFIX: 'daveNotes_settings_' // + username
    },
    DEFAULT_USER: {
        username: 'dave',
        // Default password requested
        password: 'dave3232'
    }
};

const dnState = {
    currentUser: null,
    users: {},             // username -> {username,password,createdAt,lastActive}
    notes: [],             // current user's notes
    filter: 'all',
    view: 'grid',
    sort: 'newest',
    search: '',
    activeTag: null,
    editingNoteId: null,
    // voice
    recording: false,
    mediaRecorder: null,
    audioChunks: [],
    recordingStart: null,
    recordingTimer: null,
    audioContext: null,
    analyser: null,
    // cached DOM
    el: {}
};

// -----------------------------
// Cloud Analytics API Endpoint
// -----------------------------
const API_URL = 'https://c60aogjbwa.execute-api.us-east-2.amazonaws.com';

// Generic function to send analytics events
async function logAnalyticsEvent(eventType, userId, noteId = null) {
    try {
        await fetch(`${API_URL}/analytics`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                eventType,
                userId,
                noteId,
                timestamp: new Date().toISOString()
            })
        });
    } catch (err) {
        console.error('Analytics failed:', err);
    }
}

// -----------------------------
// Utilities
// -----------------------------
function dnId(id) { return document.getElementById(id); }

function dnNowISO() { return new Date().toISOString(); }

function dnFormatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function dnGenerateId() {
    return 'n_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function dnDebounce(fn, delay) {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), delay);
    };
}

function dnShowToast(message, type = 'info') {
    const cont = dnState.el.toastContainer;
    if (!cont) return;
    const div = document.createElement('div');
    div.className = `toast toast-${type}`;
    div.textContent = message;
    cont.appendChild(div);
    requestAnimationFrame(() => div.classList.add('show'));
    setTimeout(() => {
        div.classList.remove('show');
        setTimeout(() => div.remove(), 200);
    }, 3000);
}

// Approximate per-user storage (notes only) as % of ~5MB
function dnEstimateStorage() {
    const key = DN_CONFIG.STORAGE_KEYS.NOTES_PREFIX + dnState.currentUser.username;
    const raw = localStorage.getItem(key) || '';
    const bytes = new Blob([raw]).size;
    const max = 5 * 1024 * 1024;
    const pct = Math.min(100, Math.round(bytes / max * 100));
    return { bytes, pct };
}

// -----------------------------
// Persistence: users / session
// -----------------------------
function dnLoadUsers() {
    const raw = localStorage.getItem(DN_CONFIG.STORAGE_KEYS.USERS);
    dnState.users = raw ? JSON.parse(raw) : {};
    // Seed default Dave account if missing
    if (!dnState.users[DN_CONFIG.DEFAULT_USER.username]) {
        dnState.users[DN_CONFIG.DEFAULT_USER.username] = {
            username: DN_CONFIG.DEFAULT_USER.username,
            password: DN_CONFIG.DEFAULT_USER.password,
            createdAt: dnNowISO(),
            lastActive: dnNowISO()
        };
        dnSaveUsers();
    }
}

function dnSaveUsers() {
    localStorage.setItem(DN_CONFIG.STORAGE_KEYS.USERS, JSON.stringify(dnState.users));
}

function dnLoadSession() {
    const raw = localStorage.getItem(DN_CONFIG.STORAGE_KEYS.SESSION);
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function dnSaveSession(username, remember) {
    if (remember && username) {
        localStorage.setItem(
            DN_CONFIG.STORAGE_KEYS.SESSION,
            JSON.stringify({ username })
        );
    } else {
        localStorage.removeItem(DN_CONFIG.STORAGE_KEYS.SESSION);
    }
}

function dnSetCurrentUser(username, remember = false) {
    const user = dnState.users[username];
    if (!user) return;
    dnState.currentUser = user;
    user.lastActive = dnNowISO();
    dnSaveUsers();
    dnSaveSession(username, remember);
    dnLoadUserSettings();
    dnLoadNotes();
    dnInitUserUI();
}

// -----------------------------
// Persistence: notes & settings
// -----------------------------
function dnNotesKey() {
    return DN_CONFIG.STORAGE_KEYS.NOTES_PREFIX + dnState.currentUser.username;
}
function dnSettingsKey() {
    return DN_CONFIG.STORAGE_KEYS.SETTINGS_PREFIX + dnState.currentUser.username;
}

function dnLoadNotes() {
    const raw = localStorage.getItem(dnNotesKey());
    dnState.notes = raw ? JSON.parse(raw) : [];
    dnRenderAll();
}

function dnSaveNotes() {
    localStorage.setItem(dnNotesKey(), JSON.stringify(dnState.notes));
    dnRenderAll();
}

function dnLoadUserSettings() {
    const raw = localStorage.getItem(dnSettingsKey());
    const def = { theme: 'dark' };
    dnState.settings = raw ? { ...def, ...JSON.parse(raw) } : def;
    document.documentElement.setAttribute('data-theme', dnState.settings.theme);
    if (dnState.el.themeSelect) dnState.el.themeSelect.value = dnState.settings.theme;
}

function dnSaveUserSettings() {
    localStorage.setItem(dnSettingsKey(), JSON.stringify(dnState.settings));
}

// -----------------------------
// Auth UI
// -----------------------------
function dnShowLogin() {
    dnState.el.registerView.classList.add('hidden');
    dnState.el.loginView.classList.remove('hidden');
}
function dnShowRegister() {
    dnState.el.loginView.classList.add('hidden');
    dnState.el.registerView.classList.remove('hidden');
}

function dnHandleLogin(e) {
    e.preventDefault();
    const username = dnState.el.loginUsername.value.trim();
    const pw = dnState.el.loginPassword.value;
    const remember = dnState.el.rememberMe.checked;
    const user = dnState.users[username];
    if (!user || user.password !== pw) {
        dnState.el.loginError.textContent = 'Invalid username or password';
        return;
    }
    dnState.el.loginError.textContent = '';
    dnState.el.authScreen.classList.add('hidden');
    dnState.el.app.classList.remove('hidden');
    dnSetCurrentUser(username, remember);
    dnShowToast(`Welcome back, ${username}!`, 'success');

    // 🔹 Cloud analytics: user login
    logAnalyticsEvent('user_login', username);
}

function dnHandleRegister(e) {
    e.preventDefault();
    const username = dnState.el.registerUsername.value.trim();
    const pw = dnState.el.registerPassword.value;
    const pw2 = dnState.el.registerConfirm.value;
    if (username.length < 3) {
        dnState.el.registerError.textContent = 'Username must be at least 3 characters';
        return;
    }
    if (pw.length < 4) {
        dnState.el.registerError.textContent = 'Password must be at least 4 characters';
        return;
    }
    if (pw !== pw2) {
        dnState.el.registerError.textContent = 'Passwords do not match';
        return;
    }
    if (dnState.users[username]) {
        dnState.el.registerError.textContent = 'That username is already taken';
        return;
    }
    dnState.users[username] = {
        username,
        password: pw,
        createdAt: dnNowISO(),
        lastActive: dnNowISO()
    };
    dnSaveUsers();
    dnState.el.registerError.textContent = '';
    dnState.el.authScreen.classList.add('hidden');
    dnState.el.app.classList.remove('hidden');
    dnSetCurrentUser(username, true);
    dnShowToast(`Account created. Welcome, ${username}!`, 'success');

    // 🔹 Cloud analytics: new user registered
    logAnalyticsEvent('user_registered', username);
}

// -----------------------------
// Notes CRUD
// -----------------------------
function dnCreateNote({ type, title, content, tags = [], attachments = [] }) {
    const note = {
        id: dnGenerateId(),
        user: dnState.currentUser.username,
        type,
        title: title || '(Untitled)',
        content: content || '',
        tags,
        attachments,
        starred: false,
        createdAt: dnNowISO(),
        updatedAt: dnNowISO()
    };
    dnState.notes.unshift(note);
    dnSaveNotes();
    dnLogActivity('note_created', note);
    return note;
}

function dnUpdateNote(id, updates) {
    const idx = dnState.notes.findIndex(n => n.id === id);
    if (idx === -1) return;
    dnState.notes[idx] = { ...dnState.notes[idx], ...updates, updatedAt: dnNowISO() };
    dnSaveNotes();
    dnLogActivity('note_updated', dnState.notes[idx]);
}

function dnDeleteNote(id) {
    const idx = dnState.notes.findIndex(n => n.id === id);
    if (idx === -1) return;
    const note = dnState.notes[idx];
    dnState.notes.splice(idx, 1);
    dnSaveNotes();
    dnLogActivity('note_deleted', note);
}

function dnGetNote(id) {
    return dnState.notes.find(n => n.id === id) || null;
}

// -----------------------------
// Analytics (local only)
// -----------------------------
function dnLogActivity(type, note) {
    // store recent activity in localStorage for analytics panel
    const key = 'daveNotes_activity';
    const raw = localStorage.getItem(key);
    const list = raw ? JSON.parse(raw) : [];
    list.unshift({
        id: dnGenerateId(),
        type,
        user: dnState.currentUser.username,
        noteId: note.id,
        noteTitle: note.title,
        at: dnNowISO(),
        noteType: note.type
    });
    while (list.length > 50) list.pop();
    localStorage.setItem(key, JSON.stringify(list));

    // 🔹 Cloud analytics: mirror note activity
    if (dnState.currentUser) {
        try {
            logAnalyticsEvent(type, dnState.currentUser.username, note.id);
        } catch (err) {
            console.error('Cloud analytics failed in dnLogActivity:', err);
        }
    }
}

function dnOpenAnalytics() {
    dnState.el.analyticsPanel.classList.remove('hidden');
    dnRenderAnalytics();
}
function dnCloseAnalytics() {
    dnState.el.analyticsPanel.classList.add('hidden');
}

function dnRenderAnalytics() {
    const users = dnState.users;
    const usernames = Object.keys(users);
    dnState.el.statUsers.textContent = usernames.length;

    // Aggregate counts
    let totalNotes = 0, voice = 0, files = 0;
    const userSummaries = [];

    usernames.forEach(u => {
        const raw = localStorage.getItem(DN_CONFIG.STORAGE_KEYS.NOTES_PREFIX + u);
        const notes = raw ? JSON.parse(raw) : [];
        totalNotes += notes.length;
        notes.forEach(n => {
            if (n.type === 'voice') voice++;
            if (n.type === 'file' || n.type === 'image') files++;
        });
        userSummaries.push({
            username: u,
            notes: notes.length,
            lastActive: users[u].lastActive
        });
    });

    dnState.el.statNotes.textContent = totalNotes;
    dnState.el.statVoice.textContent = voice;
    dnState.el.statFiles.textContent = files;

    // User list
    dnState.el.userList.innerHTML = userSummaries
        .sort((a,b)=> (b.notes-a.notes))
        .map(u => `
        <div class="user-row">
            <div class="user-initial">${u.username[0].toUpperCase()}</div>
            <div class="user-meta">
                <div class="user-name">${u.username}</div>
                <div class="user-sub">Notes: ${u.notes}</div>
            </div>
            <div class="user-date">${u.lastActive ? dnFormatDate(u.lastActive) : ''}</div>
        </div>
        `).join('') || '<p class="muted">No users yet.</p>';

    // Activity log
    const rawAct = localStorage.getItem('daveNotes_activity');
    const acts = rawAct ? JSON.parse(rawAct) : [];
    dnState.el.activityLog.innerHTML = acts.slice(0,30).map(a => `
        <div class="activity-row">
            <span class="activity-dot"></span>
            <div class="activity-main">
                <div><strong>${a.user}</strong> ${a.type.replace('_',' ')} <span class="pill pill-${a.noteType}">${a.noteType}</span></div>
                <div class="activity-note">${a.noteTitle}</div>
            </div>
            <div class="activity-time">${dnFormatDate(a.at)}</div>
        </div>
    `).join('') || '<p class="muted">No activity yet.</p>';
}

// -----------------------------
// Rendering helpers
// -----------------------------
function dnFilteredNotes() {
    let list = [...dnState.notes];

    // filter by nav
    if (dnState.filter === 'text') {
        list = list.filter(n => n.type === 'text');
    } else if (dnState.filter === 'voice') {
        list = list.filter(n => n.type === 'voice');
    } else if (dnState.filter === 'files') {
        list = list.filter(n => n.type === 'file' || n.type === 'image');
    } else if (dnState.filter === 'starred') {
        list = list.filter(n => n.starred);
    }

    // tag filter
    if (dnState.activeTag) {
        list = list.filter(n => n.tags && n.tags.includes(dnState.activeTag));
    }

    // search
    if (dnState.search) {
        const q = dnState.search.toLowerCase();
        list = list.filter(n =>
            (n.title && n.title.toLowerCase().includes(q)) ||
            (n.content && n.content.toLowerCase().includes(q)) ||
            (n.tags || []).some(t => t.toLowerCase().includes(q))
        );
    }

    // sort
    if (dnState.sort === 'newest') {
        list.sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt));
    } else if (dnState.sort === 'oldest') {
        list.sort((a,b)=> new Date(a.createdAt) - new Date(b.createdAt));
    } else if (dnState.sort === 'az') {
        list.sort((a,b)=> (a.title||'').localeCompare(b.title||''));
    } else if (dnState.sort === 'za') {
        list.sort((a,b)=> (b.title||'').localeCompare(a.title||''));
    }

    return list;
}

function dnRenderTagsSidebar() {
    const allTags = new Set();
    dnState.notes.forEach(n => (n.tags || []).forEach(t => allTags.add(t)));
    dnState.el.tagsList.innerHTML = Array.from(allTags).map(tag => `
        <button class="tag-chip ${dnState.activeTag === tag ? 'active' : ''}" data-tag="${tag}">${tag}</button>
    `).join('');
    dnState.el.tagsList.querySelectorAll('.tag-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            dnState.activeTag = (dnState.activeTag === btn.dataset.tag) ? null : btn.dataset.tag;
            dnRenderAll();
        });
    });
}

function dnTypeBadge(type) {
    if (type === 'voice') return '🎙️ Voice';
    if (type === 'file') return '📁 Files';
    if (type === 'image') return '🖼️ Images';
    return '📄 Text';
}

function dnRenderNotes() {
    const notes = dnFilteredNotes();
    const cont = dnState.el.notesContainer;
    const empty = dnState.el.emptyState;

    dnState.el.visibleCount.textContent = `${notes.length} note${notes.length === 1 ? '' : 's'}`;

    if (!notes.length) {
        cont.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }
    empty.classList.add('hidden');

    cont.classList.toggle('list-view', dnState.view === 'list');

    cont.innerHTML = notes.map(n => {
        const snippet = (n.content || '').slice(0, 180);
        const tagHtml = (n.tags || []).slice(0,3).map(t => `<span class="note-tag">${t}</span>`).join('');
        const hasMedia = (n.attachments || []).length;
        let mediaLabel = '';
        if (hasMedia) {
            const imgs = n.attachments.filter(a => a.kind === 'image').length;
            const files = n.attachments.filter(a => a.kind === 'file').length;
            const auds = n.attachments.filter(a => a.kind === 'audio').length;
            const parts = [];
            if (imgs) parts.push(`${imgs} image${imgs>1?'s':''}`);
            if (files) parts.push(`${files} file${files>1?'s':''}`);
            if (auds) parts.push(`${auds} audio`);
            mediaLabel = parts.join(', ');
        }

        return `
        <article class="note-card ${n.starred ? 'starred' : ''}" data-id="${n.id}">
            <div class="note-card-header">
                <div>
                    <h3 class="note-title">${n.title || '(Untitled)'}</h3>
                    <div class="note-meta">
                        <span class="type-pill">${dnTypeBadge(n.type)}</span>
                        <span class="note-date">${dnFormatDate(n.createdAt)}</span>
                    </div>
                </div>
                <button class="note-star" data-id="${n.id}" title="Star">${n.starred ? '★' : '☆'}</button>
            </div>
            <div class="note-body">
                ${snippet ? `<p class="note-snippet">${snippet}${n.content && n.content.length>180 ? '…' : ''}</p>` : ''}
                ${mediaLabel ? `<p class="note-media">${mediaLabel}</p>` : ''}
            </div>
            <div class="note-card-footer">
                <div class="note-tags-preview">${tagHtml}</div>
            </div>
        </article>`;
    }).join('');

    // Click handlers
    cont.querySelectorAll('.note-card').forEach(card => {
        const id = card.dataset.id;
        card.addEventListener('click', (e) => {
            if (e.target.closest('.note-star')) return;
            dnOpenViewer(id);
        });
    });
    cont.querySelectorAll('.note-star').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            const note = dnGetNote(id);
            if (!note) return;
            dnUpdateNote(id, { starred: !note.starred });
        });
    });
}

function dnRenderCountsAndStorage() {
    const all = dnState.notes.length;
    const text = dnState.notes.filter(n=>n.type==='text').length;
    const voice = dnState.notes.filter(n=>n.type==='voice').length;
    const files = dnState.notes.filter(n=>n.type==='file'||n.type==='image').length;
    const starred = dnState.notes.filter(n=>n.starred).length;

    dnState.el.countAll.textContent = all;
    dnState.el.countText.textContent = text;
    dnState.el.countVoice.textContent = voice;
    dnState.el.countFiles.textContent = files;
    dnState.el.countStarred.textContent = starred;

    const { pct, bytes } = dnEstimateStorage();
    dnState.el.storagePercent.textContent = `${pct}%`;
    dnState.el.storageFill.style.width = `${pct}%`;
    dnState.el.storageDetail.textContent = `${all} note${all===1?'':'s'} • ${(bytes/1024).toFixed(1)} KB`;
}

function dnRenderAll() {
    dnRenderCountsAndStorage();
    dnRenderTagsSidebar();
    dnRenderNotes();
}

// -----------------------------
// Modals & editor
// -----------------------------
function dnOpenTextEditor(note) {
    dnState.editingNoteId = note ? note.id : null;
    dnState.el.noteTitle.value = note ? (note.title || '') : '';
    dnState.el.noteContent.value = note ? (note.content || '') : '';
    const tags = note ? (note.tags || []) : [];
    dnState.el.editorTagsList.innerHTML = tags.map(t => `<span class="tag-pill">${t}</span>`).join('');
    dnState.el.editorTagInput.value = '';
    dnUpdateCharCount();
    dnState.el.noteModal.classList.remove('hidden');
}

function dnCloseTextEditor() {
    dnState.editingNoteId = null;
    dnState.el.noteModal.classList.add('hidden');
}

function dnUpdateCharCount() {
    const len = dnState.el.noteContent.value.length;
    dnState.el.charCount.textContent = `${len} chars`;
}

function dnHandleSaveText() {
    const title = dnState.el.noteTitle.value.trim();
    const content = dnState.el.noteContent.value.trim();
    const tags = Array.from(dnState.el.editorTagsList.querySelectorAll('.tag-pill')).map(el=>el.textContent);

    if (!content && !title) {
        dnShowToast('Add a title or some content first', 'error');
        return;
    }

    if (dnState.editingNoteId) {
        dnUpdateNote(dnState.editingNoteId, { title, content, tags });
    } else {
        dnCreateNote({ type: 'text', title, content, tags });
    }
    dnCloseTextEditor();
    dnShowToast('Note saved', 'success');
}

// voice modal
function dnOpenVoiceModal() {
    dnResetVoiceModal();
    dnState.el.voiceModal.classList.remove('hidden');
}

function dnCloseVoiceModal() {
    dnStopRecordingInternal(true);
    dnState.el.voiceModal.classList.add('hidden');
}

function dnResetVoiceModal() {
    dnState.recording = false;
    dnState.audioChunks = [];
    dnState.el.recorderStatus.textContent = 'Ready to Record';
    dnState.el.recorderTime.textContent = '00:00';
    dnState.el.recorderSave.disabled = true;
    dnState.el.voiceTitle.value = '';
    dnState.el.voiceTranscript.value = '';
}

async function dnToggleRecording() {
    if (dnState.recording) {
        dnStopRecordingInternal(false);
        return;
    }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        dnState.audioChunks = [];
        dnState.mediaRecorder = new MediaRecorder(stream);
        dnState.mediaRecorder.ondataavailable = e => dnState.audioChunks.push(e.data);
        dnState.mediaRecorder.onstop = () => {
            if (!dnState.audioChunks.length) return;
            dnState.el.recorderSave.disabled = false;
        };

        // basic timer
        dnState.recordingStart = Date.now();
        dnState.recordingTimer = setInterval(()=>{
            const secs = Math.floor((Date.now()-dnState.recordingStart)/1000);
            const m = String(Math.floor(secs/60)).padStart(2,'0');
            const s = String(secs%60).padStart(2,'0');
            dnState.el.recorderTime.textContent = `${m}:${s}`;
        }, 500);

        dnState.mediaRecorder.start();
        dnState.recording = true;
        dnState.el.recorderStatus.textContent = 'Recording...';
        dnState.el.recorderToggle.textContent = '⏹';
    } catch (err) {
        console.error(err);
        dnShowToast('Unable to access microphone', 'error');
    }
}

function dnStopRecordingInternal(cancel) {
    if (!dnState.mediaRecorder) return;
    try {
        dnState.mediaRecorder.stream.getTracks().forEach(t=>t.stop());
        if (dnState.mediaRecorder.state !== 'inactive') dnState.mediaRecorder.stop();
    } catch {}
    clearInterval(dnState.recordingTimer);
    dnState.recording = false;
    dnState.el.recorderToggle.textContent = '🎙️';
    if (cancel) {
        dnState.audioChunks = [];
        dnState.el.recorderSave.disabled = true;
        dnState.el.recorderStatus.textContent = 'Ready to Record';
    } else {
        dnState.el.recorderStatus.textContent = 'Recording complete';
    }
}

async function dnHandleSaveVoice() {
    if (!dnState.audioChunks.length) {
        dnShowToast('Record something first', 'error');
        return;
    }
    const blob = new Blob(dnState.audioChunks, { type: 'audio/webm' });
    const reader = new FileReader();
    reader.onloadend = () => {
        const dataUrl = reader.result;
        const title = dnState.el.voiceTitle.value.trim() || 'Voice note';
        const content = dnState.el.voiceTranscript.value.trim();
        dnCreateNote({
            type: 'voice',
            title,
            content,
            attachments: [{
                kind: 'audio',
                name: title + '.webm',
                mime: 'audio/webm',
                dataUrl
            }]
        });
        dnCloseVoiceModal();
        dnShowToast('Voice note saved', 'success');
    };
    reader.readAsDataURL(blob);
}

// Viewer
function dnOpenViewer(id) {
    const note = dnGetNote(id);
    if (!note) return;
    dnState.el.viewerTitle.textContent = note.title || '(Untitled)';
    dnState.el.viewerDate.textContent = dnFormatDate(note.createdAt);
    dnState.el.viewerType.textContent = dnTypeBadge(note.type);
    dnState.el.viewerContent.innerHTML = note.content ? `<p>${note.content.replace(/\n/g,'<br>')}</p>` : '';
    dnState.el.viewerTags.innerHTML = (note.tags||[]).map(t=>`<span class="note-tag">${t}</span>`).join('');
    dnState.el.viewerStar.textContent = note.starred ? '★' : '☆';
    dnState.el.viewerStar.dataset.id = note.id;
    dnState.el.viewerEdit.dataset.id = note.id;
    dnState.el.viewerDelete.dataset.id = note.id;

    // media
    const media = note.attachments || [];
    const imgWrap = dnState.el.viewerMedia;
    const audioWrap = dnState.el.viewerAudio;
    imgWrap.innerHTML = '';
    audioWrap.classList.add('hidden');
    imgWrap.classList.add('hidden');

    const imgs = media.filter(a=>a.kind==='image');
    if (imgs.length) {
        imgWrap.classList.remove('hidden');
        imgs.forEach(img => {
            const el = document.createElement('img');
            el.src = img.dataUrl;
            el.alt = img.name;
            imgWrap.appendChild(el);
        });
    }
    const aud = media.find(a=>a.kind==='audio');
    if (aud) {
        audioWrap.classList.remove('hidden');
        dnState.el.audioPlayer.src = aud.dataUrl;
    }

    dnState.el.viewModal.classList.remove('hidden');
}

function dnCloseViewer() {
    dnState.el.viewModal.classList.add('hidden');
}

// -----------------------------
// File & image uploads
// -----------------------------
function dnHandleFileUpload(files, type) {
    if (!files || !files.length) return;
    const attachments = [];
    const isImage = type === 'image';

    let remaining = files.length;
    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
            attachments.push({
                kind: isImage ? 'image' : 'file',
                name: file.name,
                mime: file.type,
                size: file.size,
                dataUrl: reader.result
            });
            remaining--;
            if (!remaining) {
                const title = files.length === 1 ? files[0].name : `${files.length} ${isImage ? 'images' : 'files'}`;
                dnCreateNote({
                    type: isImage ? 'image' : 'file',
                    title,
                    content: '',
                    attachments
                });
                dnShowToast(`${files.length} ${isImage ? 'image(s)' : 'file(s)'} saved`, 'success');
            }
        };
        reader.readAsDataURL(file);
    });
}

// -----------------------------
// AI helper (local, not real AI)
// -----------------------------
function dnOpenAi() { dnState.el.aiPanel.classList.remove('hidden'); }
function dnCloseAi() { dnState.el.aiPanel.classList.add('hidden'); }

function dnHandleAiSend() {
    const input = dnState.el.aiInput.value.trim();
    if (!input) return;
    const box = dnState.el.aiMessages;
    const addMsg = (role, text) => {
        const div = document.createElement('div');
        div.className = `ai-msg ai-${role}`;
        div.textContent = text;
        box.appendChild(div);
        box.scrollTop = box.scrollHeight;
    };
    addMsg('user', input);

    // naive local "AI"
    const q = input.toLowerCase();
    let reply = '';
    if (q.includes('summarize') || q.includes('summary')) {
        const total = dnState.notes.length;
        const today = new Date();
        const recent = dnState.notes.filter(n => (today - new Date(n.createdAt)) < 24*60*60*1000).length;
        const topTagCounts = {};
        dnState.notes.forEach(n => (n.tags||[]).forEach(t=>{topTagCounts[t]=(topTagCounts[t]||0)+1;}));
        const topTags = Object.entries(topTagCounts).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([t,c])=>`${t} (${c})`).join(', ');
        reply = `You have ${total} note${total===1?'':'s'} in total. ${recent} of them were created in the last 24 hours. Top tags: ${topTags || 'none yet'}.`;
    } else if (q.startsWith('find') || q.includes('about')) {
        const notes = dnFilteredNotes().filter(n =>
            (n.title && n.title.toLowerCase().includes(q)) ||
            (n.content && n.content.toLowerCase().includes(q))
        ).slice(0,5);
        if (!notes.length) {
            reply = `I couldn't find any notes matching "${input}". Try a different phrase or tag.`;
        } else {
            reply = 'Here are a few matching notes:\n' +
                notes.map(n=>`• ${n.title || '(Untitled)'} – ${dnFormatDate(n.createdAt)}`).join('\n');
        }
    } else {
        reply = `I'm a lightweight offline helper. Try things like "summarize my notes" or "find notes about deployment".`;
    }
    setTimeout(()=> addMsg('bot', reply), 200);
    dnState.el.aiInput.value = '';
}

// -----------------------------
// Header / sidebar / view controls
// -----------------------------
function dnToggleSidebar() {
    dnState.el.sidebar.classList.toggle('collapsed');
}

function dnSetFilter(filter) {
    dnState.filter = filter;
    dnState.el.viewTitle.textContent =
        filter === 'text' ? 'Text Notes' :
        filter === 'voice' ? 'Voice Notes' :
        filter === 'files' ? 'Files & Images' :
        filter === 'starred' ? 'Starred Notes' : 'All Notes';
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    dnRenderAll();
}

function dnSetView(view) {
    dnState.view = view;
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });
    dnRenderNotes();
}

function dnSetSort(value) {
    dnState.sort = value;
    dnRenderNotes();
}

function dnHandleSearchInput(e) {
    dnState.search = e.target.value;
    dnRenderNotes();
}

// -----------------------------
// Export / import / clear
// -----------------------------
function dnExportNotes() {
    const data = {
        user: dnState.currentUser.username,
        exportedAt: dnNowISO(),
        notes: dnState.notes
    };
    const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dave-notes-${dnState.currentUser.username}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function dnHandleImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const data = JSON.parse(reader.result);
            if (!Array.isArray(data.notes)) throw new Error('Invalid file');
            dnState.notes = data.notes;
            dnSaveNotes();
            dnShowToast('Notes imported', 'success');
        } catch {
            dnShowToast('Invalid import file', 'error');
        }
    };
    reader.readAsText(file);
}

function dnClearMyData() {
    if (!confirm('This will delete all your notes on this device. Continue?')) return;
    localStorage.removeItem(dnNotesKey());
    dnState.notes = [];
    dnRenderAll();
    dnShowToast('Your notes were cleared', 'success');
}

// -----------------------------
// User menu / logout
// -----------------------------
function dnToggleUserMenu() {
    dnState.el.userDropdown.classList.toggle('hidden');
}

function dnInitUserUI() {
    // avatar letters
    const initial = dnState.currentUser.username[0].toUpperCase();
    dnState.el.userAvatar.textContent = initial;
    dnState.el.dropdownAvatar.textContent = initial;
    dnState.el.userName.textContent = dnState.currentUser.username;
    dnState.el.dropdownName.textContent = dnState.currentUser.username;
    dnRenderAll();
}

function dnLogout() {
    // 🔹 Cloud analytics: user logout
    if (dnState.currentUser) {
        logAnalyticsEvent('user_logout', dnState.currentUser.username);
    }

    dnSaveSession(null, false);
    // but keep other users
    dnState.currentUser = null;
    dnState.notes = [];
    dnState.el.app.classList.add('hidden');
    dnState.el.authScreen.classList.remove('hidden');
}

// -----------------------------
// Keyboard shortcuts
// -----------------------------
function dnHandleKeydown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        dnState.el.searchInput.focus();
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        dnOpenTextEditor();
    }
}

// -----------------------------
// Init
// -----------------------------
function dnCacheElements() {
    dnState.el.authScreen = dnId('auth-screen');
    dnState.el.loginView = dnId('login-view');
    dnState.el.registerView = dnId('register-view');
    dnState.el.loginForm = dnId('login-form');
    dnState.el.registerForm = dnId('register-form');
    dnState.el.loginUsername = dnId('login-username');
    dnState.el.loginPassword = dnId('login-password');
    dnState.el.rememberMe = dnId('remember-me');
    dnState.el.loginError = dnId('login-error');
    dnState.el.registerUsername = dnId('register-username');
    dnState.el.registerPassword = dnId('register-password');
    dnState.el.registerConfirm = dnId('register-confirm');
    dnState.el.registerError = dnId('register-error');
    dnState.el.showRegister = dnId('show-register');
    dnState.el.showLogin = dnId('show-login');

    dnState.el.app = dnId('app');
    dnState.el.sidebarToggle = dnId('sidebar-toggle');
    dnState.el.sidebar = dnId('sidebar');

    dnState.el.newNoteBtn = dnId('new-note-btn');
    dnState.el.searchInput = dnId('search-input');
    dnState.el.viewTitle = dnId('view-title');
    dnState.el.visibleCount = dnId('visible-count');
    dnState.el.sortSelect = dnId('sort-select');

    dnState.el.notesContainer = dnId('notes-container');
    dnState.el.emptyState = dnId('empty-state');

    dnState.el.countAll = dnId('count-all');
    dnState.el.countText = dnId('count-text');
    dnState.el.countVoice = dnId('count-voice');
    dnState.el.countFiles = dnId('count-files');
    dnState.el.countStarred = dnId('count-starred');

    dnState.el.tagsList = dnId('tags-list');
    dnState.el.storagePercent = dnId('storage-percent');
    dnState.el.storageFill = dnId('storage-fill');
    dnState.el.storageDetail = dnId('storage-detail');

    // FAB & inputs
    dnState.el.fabMain = dnId('fab-main');
    dnState.el.fabContainer = dnId('fab-container');
    dnState.el.fabText = dnId('fab-text');
    dnState.el.fabVoice = dnId('fab-voice');
    dnState.el.fabUpload = dnId('fab-upload');
    dnState.el.fabImage = dnId('fab-image');
    dnState.el.fileInput = dnId('file-input');
    dnState.el.imageInput = dnId('image-input');

    // Text editor
    dnState.el.noteModal = dnId('note-modal');
    dnState.el.noteTitle = dnId('note-title');
    dnState.el.noteContent = dnId('note-content');
    dnState.el.editorTagsList = dnId('editor-tags-list');
    dnState.el.editorTagInput = dnId('editor-tag-input');
    dnState.el.saveNote = dnId('save-note');
    dnState.el.cancelNote = dnId('cancel-note');
    dnState.el.charCount = dnId('char-count');

    // Voice modal
    dnState.el.voiceModal = dnId('voice-modal');
    dnState.el.recorderStatus = dnId('recorder-status');
    dnState.el.recorderTime = dnId('recorder-time');
    dnState.el.recorderToggle = dnId('recorder-toggle');
    dnState.el.recorderCancel = dnId('recorder-cancel');
    dnState.el.recorderSave = dnId('recorder-save');
    dnState.el.voiceTitle = dnId('voice-title');
    dnState.el.voiceTranscript = dnId('voice-transcript');

    // Viewer
    dnState.el.viewModal = dnId('view-modal');
    dnState.el.closeViewer = dnId('close-viewer');
    dnState.el.viewerStar = dnId('viewer-star');
    dnState.el.viewerEdit = dnId('viewer-edit');
    dnState.el.viewerDelete = dnId('viewer-delete');
    dnState.el.viewerType = dnId('viewer-type');
    dnState.el.viewerDate = dnId('viewer-date');
    dnState.el.viewerTitle = dnId('viewer-title');
    dnState.el.viewerContent = dnId('viewer-content');
    dnState.el.viewerMedia = dnId('viewer-media');
    dnState.el.viewerAudio = dnId('viewer-audio');
    dnState.el.audioPlayer = dnId('audio-player');
    dnState.el.viewerTags = dnId('viewer-tags');

    // AI & settings & analytics
    dnState.el.aiPanel = dnId('ai-panel');
    dnState.el.aiMessages = dnId('ai-messages');
    dnState.el.aiInput = dnId('ai-input');
    dnState.el.aiSend = dnId('ai-send');
    dnState.el.aiBtn = dnId('ai-btn');
    dnState.el.closeAi = dnId('close-ai');

    dnState.el.settingsPanel = dnId('settings-panel');
    dnState.el.closeSettings = dnId('close-settings');
    dnState.el.themeSelect = dnId('theme-select');
    dnState.el.exportBtn = dnId('export-btn');
    dnState.el.importBtn = dnId('import-btn');
    dnState.el.importInput = dnId('import-input');
    dnState.el.clearBtn = dnId('clear-btn');

    dnState.el.analyticsPanel = dnId('analytics-panel');
    dnState.el.analyticsBtn = dnId('analytics-btn');
    dnState.el.closeAnalytics = dnId('close-analytics');
    dnState.el.statUsers = dnId('stat-users');
    dnState.el.statNotes = dnId('stat-notes');
    dnState.el.statVoice = dnId('stat-voice');
    dnState.el.statFiles = dnId('stat-files');
    dnState.el.userList = dnId('user-list');
    dnState.el.activityLog = dnId('activity-log');

    // user dropdown
    dnState.el.userBtn = dnId('user-btn');
    dnState.el.userDropdown = dnId('user-dropdown');
    dnState.el.userAvatar = dnId('user-avatar');
    dnState.el.userName = dnId('user-name');
    dnState.el.dropdownAvatar = dnId('dropdown-avatar');
    dnState.el.dropdownName = dnId('dropdown-name');
    dnState.el.logoutBtn = dnId('logout-btn');

    // toast
    dnState.el.toastContainer = dnId('toast-container');
}

function dnBindEvents() {
    dnState.el.showRegister.addEventListener('click', dnShowRegister);
    dnState.el.showLogin.addEventListener('click', dnShowLogin);
    dnState.el.loginForm.addEventListener('submit', dnHandleLogin);
    dnState.el.registerForm.addEventListener('submit', dnHandleRegister);

    dnState.el.sidebarToggle.addEventListener('click', dnToggleSidebar);
    dnState.el.newNoteBtn.addEventListener('click', ()=> dnOpenTextEditor());
    dnState.el.searchInput.addEventListener('input', dnDebounce(dnHandleSearchInput, 200));
    dnState.el.sortSelect.addEventListener('change', e => dnSetSort(e.target.value));

    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', ()=> dnSetView(btn.dataset.view));
    });
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', ()=> dnSetFilter(btn.dataset.filter));
    });

    // FAB
    dnState.el.fabMain.addEventListener('click', () => {
        dnState.el.fabContainer.classList.toggle('open');
    });
    dnState.el.fabText.addEventListener('click', ()=> { dnOpenTextEditor(); dnState.el.fabContainer.classList.remove('open'); });
    dnState.el.fabVoice.addEventListener('click', ()=> { dnOpenVoiceModal(); dnState.el.fabContainer.classList.remove('open'); });
    dnState.el.fabUpload.addEventListener('click', ()=> dnState.el.fileInput.click());
    dnState.el.fabImage.addEventListener('click', ()=> dnState.el.imageInput.click());
    dnState.el.fileInput.addEventListener('change', e => dnHandleFileUpload(e.target.files, 'file'));
    dnState.el.imageInput.addEventListener('change', e => dnHandleFileUpload(e.target.files, 'image'));

    // text editor
    dnState.el.noteContent.addEventListener('input', dnUpdateCharCount);
    dnState.el.editorTagInput.addEventListener('keydown', (e)=>{
        if (e.key === 'Enter') {
            e.preventDefault();
            const val = dnState.el.editorTagInput.value.trim();
            if (!val) return;
            const span = document.createElement('span');
            span.className = 'tag-pill';
            span.textContent = val;
            span.addEventListener('click', ()=> span.remove());
            dnState.el.editorTagsList.appendChild(span);
            dnState.el.editorTagInput.value = '';
        }
    });
    dnState.el.saveNote.addEventListener('click', dnHandleSaveText);
    dnState.el.cancelNote.addEventListener('click', dnCloseTextEditor);
    dnState.el.noteModal.querySelector('.modal-backdrop').addEventListener('click', dnCloseTextEditor);

    // voice modal
    dnState.el.recorderToggle.addEventListener('click', dnToggleRecording);
    dnState.el.recorderCancel.addEventListener('click', ()=> { dnCloseVoiceModal(); });
    dnState.el.recorderSave.addEventListener('click', dnHandleSaveVoice);
    dnState.el.voiceModal.querySelector('.modal-backdrop').addEventListener('click', dnCloseVoiceModal);

    // viewer
    dnState.el.closeViewer.addEventListener('click', dnCloseViewer);
    dnState.el.viewModal.querySelector('.modal-backdrop').addEventListener('click', dnCloseViewer);
    dnState.el.viewerStar.addEventListener('click', ()=>{
        const id = dnState.el.viewerStar.dataset.id;
        const note = dnGetNote(id);
        if (!note) return;
        dnUpdateNote(id, { starred: !note.starred });
        dnState.el.viewerStar.textContent = !note.starred ? '★' : '☆';
    });
    dnState.el.viewerEdit.addEventListener('click', ()=>{
        const id = dnState.el.viewerEdit.dataset.id;
        const note = dnGetNote(id);
        if (!note) return;
        dnOpenTextEditor(note);
        dnCloseViewer();
    });
    dnState.el.viewerDelete.addEventListener('click', ()=>{
        const id = dnState.el.viewerDelete.dataset.id;
        if (!confirm('Delete this note?')) return;
        dnDeleteNote(id);
        dnCloseViewer();
    });

    // AI & settings & analytics
    dnState.el.aiBtn.addEventListener('click', dnOpenAi);
    dnState.el.closeAi.addEventListener('click', dnCloseAi);
    dnState.el.aiSend.addEventListener('click', dnHandleAiSend);
    dnState.el.aiInput.addEventListener('keydown', e => { if (e.key === 'Enter') dnHandleAiSend(); });
    document.querySelectorAll('.suggestion-btn').forEach(btn => {
        btn.addEventListener('click', ()=>{
            dnState.el.aiInput.value = btn.textContent.replace(/"/g,'');
            dnHandleAiSend();
        });
    });

    dnState.el.themeSelect.addEventListener('change', e => {
        dnState.settings.theme = e.target.value;
        document.documentElement.setAttribute('data-theme', dnState.settings.theme);
        dnSaveUserSettings();
    });
    dnState.el.exportBtn.addEventListener('click', dnExportNotes);
    dnState.el.importBtn.addEventListener('click', ()=> dnState.el.importInput.click());
    dnState.el.importInput.addEventListener('change', dnHandleImportFile);
    dnState.el.clearBtn.addEventListener('click', dnClearMyData);

    dnState.el.analyticsBtn.addEventListener('click', dnOpenAnalytics);
    dnState.el.closeAnalytics.addEventListener('click', dnCloseAnalytics);

    // user dropdown & logout
    dnState.el.userBtn.addEventListener('click', dnToggleUserMenu);
    dnState.el.logoutBtn.addEventListener('click', dnLogout);
    document.addEventListener('click', (e)=>{
        if (!dnState.el.userDropdown) return;
        if (!e.target.closest('.user-menu') &&
            !dnState.el.userDropdown.classList.contains('hidden')) {
            dnState.el.userDropdown.classList.add('hidden');
        }
    });

    document.addEventListener('keydown', dnHandleKeydown);
}

function dnInit() {
    dnCacheElements();
    dnLoadUsers();

    // auto-login if session present
    const session = dnLoadSession();
    if (session && session.username && dnState.users[session.username]) {
        dnState.el.authScreen.classList.add('hidden');
        dnState.el.app.classList.remove('hidden');
        dnSetCurrentUser(session.username, true);
    } else {
        dnState.el.authScreen.classList.remove('hidden');
        dnState.el.app.classList.add('hidden');
    }

    dnBindEvents();
}

document.addEventListener('DOMContentLoaded', dnInit);