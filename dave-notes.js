/**
 * DAVE NOTES v2 - Professional Note-Taking Application
 * Mobile-First Design with Responsive Features
 */

const CONFIG = {
    VERSION: '2.0.0',
    STORAGE_PREFIX: 'davenotes_',
    OWNER_EMAIL: 'dave@davedirty.com',
    OWNER_PASSWORD: 'dave3232',
    DEFAULT_QUOTA_GB: 5,
    MAX_UPLOAD_MB: 20,
    ROLES: { OWNER: 'owner', ADMIN: 'admin', USER: 'user' },
    STORAGE_MODES: { LOCAL: 'local', CLOUD: 'cloud' }
};

const state = {
    user: null,
    notes: [],
    filter: 'all',
    tagFilter: null,
    view: 'grid',
    sort: 'newest',
    search: '',
    editingNote: null,
    storageMode: 'local',
    sidebarOpen: false,
    recording: { active: false, mediaRecorder: null, chunks: [], startTime: null, timer: null, audioContext: null, analyser: null }
};

const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

document.addEventListener('DOMContentLoaded', init);

function init() {
    applyTheme();
    checkSession();
    setupEventListeners();
    handleResize();
    window.addEventListener('resize', debounce(handleResize, 100));
}

function handleResize() {
    // Close sidebar on larger screens
    if (window.innerWidth > 1024 && state.sidebarOpen) {
        closeSidebar();
    }
}

function checkSession() {
    const session = localStorage.getItem(CONFIG.STORAGE_PREFIX + 'session');
    if (session) {
        const data = JSON.parse(session);
        const users = getUsers();
        if (users[data.email]) {
            state.user = { ...users[data.email], email: data.email };
            showApp();
        }
    }
}

function setupEventListeners() {
    // Auth
    $('login-form').addEventListener('submit', handleLogin);
    $('register-form').addEventListener('submit', handleRegister);
    $('show-register').addEventListener('click', () => toggleAuthView('register'));
    $('show-login').addEventListener('click', () => toggleAuthView('login'));
    $('local-mode-btn').addEventListener('click', enterLocalMode);
    
    // Password toggles
    $$('.password-toggle').forEach(btn => {
        btn.addEventListener('click', e => {
            const wrapper = e.target.closest('.input-wrapper');
            const input = wrapper.querySelector('input');
            input.type = input.type === 'password' ? 'text' : 'password';
        });
    });
    
    // Sidebar
    $('sidebar-toggle').addEventListener('click', toggleSidebar);
    $('sidebar-overlay').addEventListener('click', closeSidebar);
    
    // Search
    $('search-input').addEventListener('input', debounce(handleSearch, 300));
    
    // User menu
    $('user-trigger').addEventListener('click', e => {
        e.stopPropagation();
        $('user-dropdown').classList.toggle('hidden');
    });
    
    document.addEventListener('click', e => {
        if (!e.target.closest('#user-menu')) $('user-dropdown').classList.add('hidden');
    });
    
    $('btn-settings').addEventListener('click', () => { closeDropdown(); openPanel('settings-panel'); });
    $('btn-admin').addEventListener('click', () => { closeDropdown(); openPanel('admin-panel'); loadAdminData(); });
    $('btn-logout').addEventListener('click', logout);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); $('search-input')?.focus(); }
        if (e.key === 'Escape') { closeAllModals(); closeSidebar(); closeAllPanels(); }
    });
    
    // Navigation
    $$('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            state.filter = btn.dataset.filter;
            state.tagFilter = null;
            $$('.nav-item').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updatePageTitle();
            renderNotes();
            if (window.innerWidth <= 1024) closeSidebar();
        });
    });
    
    // View toggle
    $$('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.view = btn.dataset.view;
            $$('.view-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderNotes();
        });
    });
    
    // Sort
    $('sort-select').addEventListener('change', e => { state.sort = e.target.value; renderNotes(); });
    
    // New note buttons
    $('new-note-btn').addEventListener('click', () => { closeSidebar(); openEditor(); });
    if ($('empty-create-btn')) $('empty-create-btn').addEventListener('click', () => openEditor());
    
    // FAB
    $('fab-main').addEventListener('click', () => $('fab-container').classList.toggle('open'));
    $$('.fab-item').forEach(btn => {
        btn.addEventListener('click', () => {
            closeFab();
            const type = btn.dataset.type;
            if (type === 'text') openEditor();
            else if (type === 'voice') openVoiceRecorder();
            else if (type === 'image') $('image-input').click();
            else if (type === 'file') $('file-input').click();
        });
    });
    
    // File inputs
    $('file-input').addEventListener('change', handleFileUpload);
    $('image-input').addEventListener('change', handleImageUpload);
    
    // Editor modal
    $('editor-cancel').addEventListener('click', () => closeModal('editor-modal'));
    $('editor-save').addEventListener('click', saveNote);
    $('editor-content').addEventListener('input', updateCharCount);
    $('editor-tag-input').addEventListener('keypress', e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } });
    
    // Voice modal
    $('voice-close').addEventListener('click', cancelRecording);
    $('voice-cancel').addEventListener('click', cancelRecording);
    $('voice-toggle').addEventListener('click', toggleRecording);
    $('voice-save').addEventListener('click', saveVoiceNote);
    
    // Viewer modal
    $('viewer-close').addEventListener('click', () => closeModal('viewer-modal'));
    $('viewer-star').addEventListener('click', toggleViewerStar);
    $('viewer-edit').addEventListener('click', editFromViewer);
    $('viewer-delete').addEventListener('click', deleteFromViewer);
    
    // Modal backdrops
    $$('.modal-backdrop').forEach(el => el.addEventListener('click', closeAllModals));
    
    // Panels
    $('settings-close').addEventListener('click', () => closePanel('settings-panel'));
    $('admin-close').addEventListener('click', () => closePanel('admin-panel'));
    
    // Theme
    $$('.theme-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            setTheme(btn.dataset.theme);
            $$('.theme-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
    
    // Storage mode
    $('storage-mode-select').addEventListener('change', e => {
        state.storageMode = e.target.value;
        updateStorageModeUI();
    });
    
    // Data management
    $('export-btn').addEventListener('click', exportNotes);
    $('import-btn').addEventListener('click', () => $('import-file').click());
    $('import-file').addEventListener('change', importNotes);
    $('clear-data-btn').addEventListener('click', clearAllData);
}

// ============================================================
// SIDEBAR
// ============================================================
function toggleSidebar() {
    state.sidebarOpen ? closeSidebar() : openSidebar();
}

function openSidebar() {
    state.sidebarOpen = true;
    $('sidebar').classList.add('active');
    $('sidebar-overlay').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeSidebar() {
    state.sidebarOpen = false;
    $('sidebar').classList.remove('active');
    $('sidebar-overlay').classList.remove('active');
    document.body.style.overflow = '';
}

function closeDropdown() {
    $('user-dropdown').classList.add('hidden');
}

// ============================================================
// AUTH
// ============================================================
function toggleAuthView(view) {
    $('login-view').classList.toggle('hidden', view !== 'login');
    $('register-view').classList.toggle('hidden', view !== 'register');
}

function handleLogin(e) {
    e.preventDefault();
    const email = $('login-email').value.trim().toLowerCase();
    const password = $('login-password').value;
    const remember = $('remember-me').checked;
    const users = getUsers();
    
    if (email === CONFIG.OWNER_EMAIL && password === CONFIG.OWNER_PASSWORD) {
        if (!users[email]) {
            users[email] = createUserObject('Dave', CONFIG.ROLES.OWNER);
            saveUsers(users);
        }
        loginUser(email, users[email], remember);
        return;
    }
    
    if (users[email] && users[email].password === password) {
        if (users[email].status === 'disabled') { showError('login-error', 'Account is disabled'); return; }
        loginUser(email, users[email], remember);
        return;
    }
    showError('login-error', 'Invalid email or password');
}

function handleRegister(e) {
    e.preventDefault();
    const name = $('register-name').value.trim();
    const email = $('register-email').value.trim().toLowerCase();
    const password = $('register-password').value;
    const confirm = $('register-confirm').value;
    
    if (password !== confirm) { showError('register-error', 'Passwords do not match'); return; }
    const users = getUsers();
    if (users[email]) { showError('register-error', 'Email already registered'); return; }
    
    const user = createUserObject(name, CONFIG.ROLES.USER);
    user.password = password;
    users[email] = user;
    saveUsers(users);
    logActivity(email, 'Account created');
    loginUser(email, user, true);
}

function createUserObject(displayName, role) {
    return {
        displayName,
        role,
        status: 'active',
        quotaLimitBytes: role === CONFIG.ROLES.OWNER ? Infinity : CONFIG.DEFAULT_QUOTA_GB * 1024 * 1024 * 1024,
        usedBytes: 0,
        maxUploadBytes: role === CONFIG.ROLES.OWNER ? 100 * 1024 * 1024 : CONFIG.MAX_UPLOAD_MB * 1024 * 1024,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        settings: { theme: 'dark', storageMode: 'local' }
    };
}

function loginUser(email, user, remember) {
    state.user = { ...user, email };
    if (remember) localStorage.setItem(CONFIG.STORAGE_PREFIX + 'session', JSON.stringify({ email }));
    logActivity(email, 'Logged in');
    showApp();
}

function enterLocalMode() {
    state.user = { email: 'local', displayName: 'Local User', role: CONFIG.ROLES.USER, status: 'active' };
    state.storageMode = 'local';
    showApp();
}

function logout() {
    if (state.user?.email !== 'local') logActivity(state.user.email, 'Logged out');
    state.user = null;
    state.notes = [];
    localStorage.removeItem(CONFIG.STORAGE_PREFIX + 'session');
    location.reload();
}

function showApp() {
    $('auth-screen').classList.add('hidden');
    $('app').classList.remove('hidden');
    loadUserData();
    updateUserUI();
    renderNotes();
    updateStorageUI();
}

function updateUserUI() {
    const initial = (state.user.displayName || state.user.email)[0].toUpperCase();
    $('header-avatar').querySelector('span').textContent = initial;
    $('dropdown-avatar').querySelector('span').textContent = initial;
    $('dropdown-name').textContent = state.user.displayName || state.user.email;
    $('dropdown-email').textContent = state.user.email;
    $('dropdown-role').textContent = state.user.role.charAt(0).toUpperCase() + state.user.role.slice(1);
    
    const isAdminOrOwner = [CONFIG.ROLES.OWNER, CONFIG.ROLES.ADMIN].includes(state.user.role);
    $('btn-admin').style.display = isAdminOrOwner ? 'flex' : 'none';
    
    $('settings-email').textContent = state.user.email;
    $('settings-role').textContent = state.user.role;
    $('settings-joined').textContent = state.user.createdAt ? new Date(state.user.createdAt).toLocaleDateString() : '-';
}

function getUsers() { return JSON.parse(localStorage.getItem(CONFIG.STORAGE_PREFIX + 'users') || '{}'); }
function saveUsers(users) { localStorage.setItem(CONFIG.STORAGE_PREFIX + 'users', JSON.stringify(users)); }
function loadUserData() { state.notes = JSON.parse(localStorage.getItem(CONFIG.STORAGE_PREFIX + 'notes_' + state.user.email) || '[]'); }
function saveUserData() { localStorage.setItem(CONFIG.STORAGE_PREFIX + 'notes_' + state.user.email, JSON.stringify(state.notes)); updateStorageUI(); }
function logActivity(email, action) { const log = JSON.parse(localStorage.getItem(CONFIG.STORAGE_PREFIX + 'activity') || '[]'); log.unshift({ email, action, time: new Date().toISOString() }); if (log.length > 200) log.length = 200; localStorage.setItem(CONFIG.STORAGE_PREFIX + 'activity', JSON.stringify(log)); }
function showError(id, msg) { $(id).textContent = msg; setTimeout(() => $(id).textContent = '', 3000); }

// ============================================================
// NOTES CRUD
// ============================================================
function createNote(data) {
    const note = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 9),
        type: data.type || 'text',
        title: data.title || 'Untitled',
        content: data.content || '',
        tags: data.tags || [],
        starred: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...data
    };
    state.notes.unshift(note);
    saveUserData();
    logActivity(state.user.email, `Created ${note.type} note`);
    renderNotes();
    toast('Note created', 'success');
    return note;
}

function updateNote(id, updates) {
    const idx = state.notes.findIndex(n => n.id === id);
    if (idx !== -1) {
        state.notes[idx] = { ...state.notes[idx], ...updates, updatedAt: new Date().toISOString() };
        saveUserData();
        renderNotes();
    }
}

function deleteNote(id) {
    state.notes = state.notes.filter(n => n.id !== id);
    saveUserData();
    logActivity(state.user.email, 'Deleted note');
    renderNotes();
    toast('Note deleted');
}

function getFilteredNotes() {
    let notes = [...state.notes];
    if (state.filter === 'text') notes = notes.filter(n => n.type === 'text');
    else if (state.filter === 'voice') notes = notes.filter(n => n.type === 'voice');
    else if (state.filter === 'files') notes = notes.filter(n => n.type === 'file' || n.type === 'image');
    else if (state.filter === 'starred') notes = notes.filter(n => n.starred);
    
    if (state.tagFilter) notes = notes.filter(n => n.tags?.includes(state.tagFilter));
    
    if (state.search) {
        const q = state.search.toLowerCase();
        notes = notes.filter(n => n.title?.toLowerCase().includes(q) || n.content?.toLowerCase().includes(q) || n.tags?.some(t => t.toLowerCase().includes(q)));
    }
    
    notes.sort((a, b) => {
        switch (state.sort) {
            case 'oldest': return new Date(a.createdAt) - new Date(b.createdAt);
            case 'az': return (a.title || '').localeCompare(b.title || '');
            case 'za': return (b.title || '').localeCompare(a.title || '');
            case 'updated': return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
            default: return new Date(b.createdAt) - new Date(a.createdAt);
        }
    });
    return notes;
}

function renderNotes() {
    const notes = getFilteredNotes();
    const grid = $('notes-grid');
    const empty = $('empty-state');
    
    if (notes.length === 0) {
        grid.innerHTML = '';
        empty.classList.remove('hidden');
    } else {
        empty.classList.add('hidden');
        grid.innerHTML = notes.map(note => createNoteCard(note)).join('');
        grid.querySelectorAll('.note-card').forEach(card => {
            card.addEventListener('click', e => {
                if (!e.target.closest('.note-star')) openViewer(card.dataset.id);
            });
            card.querySelector('.note-star').addEventListener('click', e => {
                e.stopPropagation();
                toggleStar(card.dataset.id);
            });
        });
    }
    
    grid.className = `notes-grid${state.view === 'list' ? ' list-view' : ''}`;
    updateCounts();
    updateTags();
    $('note-count-badge').textContent = `${notes.length} note${notes.length !== 1 ? 's' : ''}`;
}

function createNoteCard(note) {
    const icons = { text: '#icon-file-text', voice: '#icon-mic', image: '#icon-image', file: '#icon-paperclip' };
    const time = new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    let preview = '';
    if (note.type === 'image' && note.mediaData) preview = `<img src="${note.mediaData}" class="note-media-thumb" alt="">`;
    else if (note.content) preview = `<p class="note-preview">${escapeHtml(note.content)}</p>`;
    
    return `<div class="note-card${note.starred ? ' starred' : ''}" data-id="${note.id}">
        <div class="note-card-header">
            <span class="type-badge ${note.type}"><svg><use href="${icons[note.type] || icons.text}"/></svg><span>${note.type}</span></span>
            <button class="note-star" aria-label="Star"><svg><use href="${note.starred ? '#icon-star-filled' : '#icon-star'}"/></svg></button>
        </div>
        <h3 class="note-title">${escapeHtml(note.title)}</h3>
        ${preview}
        <div class="note-card-footer">
            <div class="note-tags">${(note.tags || []).slice(0, 3).map(t => `<span class="note-tag">${t}</span>`).join('')}</div>
            <span class="note-time">${time}</span>
        </div>
    </div>`;
}

function updateCounts() {
    $('count-all').textContent = state.notes.length;
    $('count-text').textContent = state.notes.filter(n => n.type === 'text').length;
    $('count-voice').textContent = state.notes.filter(n => n.type === 'voice').length;
    $('count-files').textContent = state.notes.filter(n => n.type === 'file' || n.type === 'image').length;
    $('count-starred').textContent = state.notes.filter(n => n.starred).length;
}

function updateTags() {
    const tags = new Set();
    state.notes.forEach(n => (n.tags || []).forEach(t => tags.add(t)));
    $('sidebar-tags').innerHTML = Array.from(tags).map(tag => `<button class="tag-chip${state.tagFilter === tag ? ' active' : ''}" data-tag="${tag}">${tag}</button>`).join('');
    $('sidebar-tags').querySelectorAll('.tag-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            state.tagFilter = state.tagFilter === btn.dataset.tag ? null : btn.dataset.tag;
            $$('.tag-chip').forEach(b => b.classList.remove('active'));
            if (state.tagFilter) btn.classList.add('active');
            renderNotes();
            if (window.innerWidth <= 1024) closeSidebar();
        });
    });
}

function updatePageTitle() {
    const titles = { all: 'All Notes', text: 'Text Notes', voice: 'Voice Notes', files: 'Files & Images', starred: 'Starred' };
    $('page-title').textContent = titles[state.filter] || 'All Notes';
}

function toggleStar(id) {
    const note = state.notes.find(n => n.id === id);
    if (note) { note.starred = !note.starred; saveUserData(); renderNotes(); }
}

// ============================================================
// EDITOR
// ============================================================
function openEditor(note = null) {
    state.editingNote = note;
    $('editor-title').value = note?.title || '';
    $('editor-content').value = note?.content || '';
    updateCharCount();
    renderEditorTags(note?.tags || []);
    openModal('editor-modal');
    setTimeout(() => $('editor-title').focus(), 100);
}

function renderEditorTags(tags) {
    $('editor-tag-chips').innerHTML = tags.map(tag => `<span class="tag-chip-edit">${tag}<button type="button" onclick="removeTag('${tag}')"><svg><use href="#icon-x"/></svg></button></span>`).join('');
    $('editor-tag-chips').dataset.tags = JSON.stringify(tags);
}

window.removeTag = function(tag) {
    const tags = JSON.parse($('editor-tag-chips').dataset.tags || '[]').filter(t => t !== tag);
    renderEditorTags(tags);
};

function addTag() {
    const input = $('editor-tag-input');
    const tag = input.value.trim().toLowerCase();
    if (tag) {
        const tags = JSON.parse($('editor-tag-chips').dataset.tags || '[]');
        if (!tags.includes(tag)) { tags.push(tag); renderEditorTags(tags); }
        input.value = '';
    }
}

function updateCharCount() {
    $('char-count').textContent = `${$('editor-content').value.length} chars`;
}

function saveNote() {
    const title = $('editor-title').value.trim() || 'Untitled';
    const content = $('editor-content').value;
    const tags = JSON.parse($('editor-tag-chips').dataset.tags || '[]');
    
    if (state.editingNote) {
        updateNote(state.editingNote.id, { title, content, tags });
        toast('Note updated', 'success');
    } else {
        createNote({ type: 'text', title, content, tags });
    }
    closeModal('editor-modal');
    state.editingNote = null;
}

// ============================================================
// VOICE RECORDER
// ============================================================
function openVoiceRecorder() {
    openModal('voice-modal');
    $('voice-status').textContent = 'Ready to record';
    $('voice-timer').textContent = '00:00';
    $('voice-save').disabled = true;
    $('voice-details').classList.add('hidden');
    $('voice-title').value = '';
    $('voice-notes').value = '';
}

async function toggleRecording() {
    if (state.recording.active) {
        stopRecording();
    } else {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            state.recording.chunks = [];
            state.recording.mediaRecorder = new MediaRecorder(stream);
            state.recording.audioContext = new AudioContext();
            state.recording.analyser = state.recording.audioContext.createAnalyser();
            const source = state.recording.audioContext.createMediaStreamSource(stream);
            source.connect(state.recording.analyser);
            state.recording.analyser.fftSize = 256;
            
            state.recording.mediaRecorder.ondataavailable = e => state.recording.chunks.push(e.data);
            state.recording.mediaRecorder.onstop = () => {
                $('voice-status').textContent = 'Recording complete';
                $('voice-save').disabled = false;
                $('voice-details').classList.remove('hidden');
                $('voice-toggle').classList.remove('recording');
                $('voice-toggle').querySelector('.rec-icon').classList.remove('hidden');
                $('voice-toggle').querySelector('.stop-icon').classList.add('hidden');
            };
            
            state.recording.mediaRecorder.start();
            state.recording.active = true;
            state.recording.startTime = Date.now();
            
            $('voice-status').textContent = 'Recording...';
            $('voice-toggle').classList.add('recording');
            $('voice-toggle').querySelector('.rec-icon').classList.add('hidden');
            $('voice-toggle').querySelector('.stop-icon').classList.remove('hidden');
            
            updateRecordingTimer();
            state.recording.timer = setInterval(updateRecordingTimer, 1000);
            visualizeAudio();
        } catch (err) {
            toast('Cannot access microphone', 'error');
        }
    }
}

function stopRecording() {
    if (state.recording.mediaRecorder && state.recording.active) {
        state.recording.mediaRecorder.stop();
        state.recording.mediaRecorder.stream.getTracks().forEach(t => t.stop());
        clearInterval(state.recording.timer);
        state.recording.active = false;
        if (state.recording.audioContext) state.recording.audioContext.close();
    }
}

function cancelRecording() {
    stopRecording();
    state.recording.chunks = [];
    closeModal('voice-modal');
}

function saveVoiceNote() {
    const blob = new Blob(state.recording.chunks, { type: 'audio/webm' });
    const reader = new FileReader();
    reader.onload = () => {
        createNote({
            type: 'voice',
            title: $('voice-title').value.trim() || `Voice Note ${new Date().toLocaleDateString()}`,
            content: $('voice-notes').value,
            audioData: reader.result,
            duration: Math.floor((Date.now() - state.recording.startTime) / 1000)
        });
        closeModal('voice-modal');
    };
    reader.readAsDataURL(blob);
}

function updateRecordingTimer() {
    const elapsed = Math.floor((Date.now() - state.recording.startTime) / 1000);
    const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const secs = (elapsed % 60).toString().padStart(2, '0');
    $('voice-timer').textContent = `${mins}:${secs}`;
}

function visualizeAudio() {
    const canvas = $('voice-canvas');
    const ctx = canvas.getContext('2d');
    const analyser = state.recording.analyser;
    if (!analyser) return;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    
    function draw() {
        if (!state.recording.active) return;
        requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);
        const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg-elevated').trim();
        ctx.fillStyle = bg || '#19191c';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const barWidth = (canvas.width / bufferLength) * 2.5;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
            const barHeight = (dataArray[i] / 255) * canvas.height;
            ctx.fillStyle = `hsl(${220 + (i / bufferLength) * 40}, 70%, 60%)`;
            ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
            x += barWidth + 1;
        }
    }
    draw();
}

// ============================================================
// EXPORT / IMPORT
// ============================================================
function exportNotes() {
    const data = {
        date: new Date().toISOString(),
        user: state.user?.email,
        notes: state.notes
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `davenotes-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Notes exported', 'success');
}

function importNotes(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const data = JSON.parse(reader.result);
            if (data.notes && Array.isArray(data.notes)) {
                state.notes = [...data.notes, ...state.notes];
                saveUserData();
                renderNotes();
                toast(`Imported ${data.notes.length} notes`, 'success');
            }
        } catch { toast('Invalid file format', 'error'); }
    };
    reader.readAsText(file);
    e.target.value = '';
}

function clearAllData() {
    if (confirm('Delete ALL your notes? This cannot be undone.')) {
        state.notes = [];
        saveUserData();
        renderNotes();
        toast('All data cleared');
    }
}

// ============================================================
// THEME
// ============================================================
function applyTheme() {
    const theme = localStorage.getItem(CONFIG.STORAGE_PREFIX + 'theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    $$('.theme-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.theme === theme));
}

function setTheme(theme) {
    localStorage.setItem(CONFIG.STORAGE_PREFIX + 'theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
}

// ============================================================
// UI HELPERS
// ============================================================
function closeFab() {
    $('fab-container').classList.remove('open');
}

function openModal(id) {
    $(id).classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal(id) {
    $(id).classList.remove('active');
    document.body.style.overflow = '';
}

function closeAllModals() {
    $$('.modal.active').forEach(m => m.classList.remove('active'));
    document.body.style.overflow = '';
}

function openPanel(id) {
    closeAllPanels();
    $(id).classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closePanel(id) {
    $(id).classList.remove('active');
    document.body.style.overflow = '';
}

function closeAllPanels() {
    $$('.panel.active').forEach(p => p.classList.remove('active'));
    document.body.style.overflow = '';
}

function toast(message, type = 'success') {
    const icon = type === 'success' ? '#icon-check' : '#icon-alert-circle';
    const div = document.createElement('div');
    div.className = `toast ${type}`;
    div.innerHTML = `<svg><use href="${icon}"/></svg><span>${message}</span>`;
    $('toast-container').appendChild(div);
    setTimeout(() => div.remove(), 3000);
}

// ============================================================
// UTILITIES
// ============================================================
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    if (bytes === Infinity) return 'Unlimited';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatTime(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diff = now - date;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    return date.toLocaleDateString();
}

function debounce(fn, delay) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), delay);
    };
}
