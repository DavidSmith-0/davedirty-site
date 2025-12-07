/**
 * DAVE NOTES v2 - Professional Note-Taking Application
 * Mobile-First Design with Responsive Features
 * AWS Cloud Integration Ready
 */

const CONFIG = {
    VERSION: '2.0.0',
    STORAGE_PREFIX: 'davenotes_',
    OWNER_EMAIL: 'dave@davedirty.com',
    OWNER_PASSWORD: 'dave3232',
    DEFAULT_QUOTA_GB: 5,
    MAX_UPLOAD_MB: 20,
    ROLES: { OWNER: 'owner', ADMIN: 'admin', USER: 'user' },
    STORAGE_MODES: { LOCAL: 'local', CLOUD: 'cloud' },
    // AWS Configuration
    AWS: {
        API_ENDPOINT: 'https://ezw60mwtm3.execute-api.us-east-2.amazonaws.com/prod',
        COGNITO_USER_POOL_ID: 'us-east-2_7Ofe9wlf9',
        COGNITO_CLIENT_ID: '3dgl75bp53rnqqdtfbm0cgq2lc',
        S3_BUCKET: 'davenotes-attachments-1765104495',
        REGION: 'us-east-2'
    }
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
    viewingNote: null,
    storageMode: 'local',
    sidebarOpen: false,
    recording: { 
        active: false, 
        mediaRecorder: null, 
        chunks: [], 
        startTime: null, 
        timer: null, 
        audioContext: null, 
        analyser: null 
    }
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
    // Close FAB menu on resize
    if ($('fab-container')) {
        $('fab-container').classList.remove('open');
    }
}

function checkSession() {
    const session = localStorage.getItem(CONFIG.STORAGE_PREFIX + 'session');
    if (session) {
        try {
            const data = JSON.parse(session);
            const users = getUsers();
            if (users[data.email]) {
                state.user = { ...users[data.email], email: data.email };
                showApp();
            }
        } catch (e) {
            console.error('Session check failed:', e);
            localStorage.removeItem(CONFIG.STORAGE_PREFIX + 'session');
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
            e.preventDefault();
            const wrapper = e.target.closest('.input-wrapper');
            const input = wrapper.querySelector('input');
            const eyeOpen = btn.querySelector('.eye-open');
            const eyeClosed = btn.querySelector('.eye-closed');
            
            if (input.type === 'password') {
                input.type = 'text';
                eyeOpen.classList.add('hidden');
                eyeClosed.classList.remove('hidden');
            } else {
                input.type = 'password';
                eyeOpen.classList.remove('hidden');
                eyeClosed.classList.add('hidden');
            }
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
        if (!e.target.closest('#user-menu')) {
            $('user-dropdown').classList.add('hidden');
        }
    });
    
    $('btn-settings').addEventListener('click', () => { 
        closeDropdown(); 
        openPanel('settings-panel'); 
        updateSettingsPanel();
    });
    $('btn-admin').addEventListener('click', () => { 
        closeDropdown(); 
        openPanel('admin-panel'); 
        loadAdminData(); 
    });
    $('btn-logout').addEventListener('click', logout);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') { 
            e.preventDefault(); 
            $('search-input')?.focus(); 
        }
        if (e.key === 'Escape') { 
            closeAllModals(); 
            closeSidebar(); 
            closeAllPanels(); 
            closeFab();
        }
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
    $('sort-select').addEventListener('change', e => { 
        state.sort = e.target.value; 
        renderNotes(); 
    });
    
    // New note buttons
    $('new-note-btn').addEventListener('click', () => { 
        closeSidebar(); 
        openEditor(); 
    });
    if ($('empty-create-btn')) {
        $('empty-create-btn').addEventListener('click', () => openEditor());
    }
    
    // FAB
    $('fab-main').addEventListener('click', (e) => {
        e.stopPropagation();
        $('fab-container').classList.toggle('open');
    });
    
    // Close FAB when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#fab-container')) {
            closeFab();
        }
    });
    
    $$('.fab-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
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
    $('editor-tag-input').addEventListener('keypress', e => { 
        if (e.key === 'Enter') { 
            e.preventDefault(); 
            addTag(); 
        } 
    });
    
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
    $('storage-mode-select').addEventListener('change', async e => {
        state.storageMode = e.target.value;
        updateStorageModeUI();
        
        // If switching to cloud mode, sync
        if (e.target.value === 'cloud') {
            toast('Switching to cloud sync...', 'info');
            await syncNotesToCloud(); // Upload local notes
            await loadNotesFromCloud(); // Download cloud notes
        } else {
            toast('Switched to local storage', 'success');
        }
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
    // Clear errors
    $('login-error').textContent = '';
    $('register-error').textContent = '';
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
        if (users[email].status === 'disabled') { 
            showError('login-error', 'Account is disabled'); 
            return; 
        }
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
    
    if (password !== confirm) { 
        showError('register-error', 'Passwords do not match'); 
        return; 
    }
    
    if (password.length < 6) {
        showError('register-error', 'Password must be at least 6 characters');
        return;
    }
    
    const users = getUsers();
    if (users[email]) { 
        showError('register-error', 'Email already registered'); 
        return; 
    }
    
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
    if (remember) {
        localStorage.setItem(CONFIG.STORAGE_PREFIX + 'session', JSON.stringify({ email }));
    }
    
    // Update last active
    const users = getUsers();
    if (users[email]) {
        users[email].lastActiveAt = new Date().toISOString();
        saveUsers(users);
    }
    
    logActivity(email, 'Logged in');
    showApp();
}

function enterLocalMode() {
    state.user = { 
        email: 'local', 
        displayName: 'Local User', 
        role: CONFIG.ROLES.USER, 
        status: 'active',
        quotaLimitBytes: Infinity,
        usedBytes: 0
    };
    state.storageMode = 'local';
    showApp();
}

function logout() {
    if (state.user?.email !== 'local') {
        logActivity(state.user.email, 'Logged out');
    }
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
    updatePageTitle();
}

function updateUserUI() {
    const initial = (state.user.displayName || state.user.email)[0].toUpperCase();
    $('header-avatar').querySelector('span').textContent = initial;
    $('dropdown-avatar').querySelector('span').textContent = initial;
    $('dropdown-name').textContent = state.user.displayName || state.user.email;
    $('dropdown-email').textContent = state.user.email;
    
    const roleText = state.user.role.charAt(0).toUpperCase() + state.user.role.slice(1);
    $('dropdown-role').textContent = roleText;
    $('dropdown-role').className = 'user-role-badge ' + state.user.role;
    
    const isAdminOrOwner = [CONFIG.ROLES.OWNER, CONFIG.ROLES.ADMIN].includes(state.user.role);
    $('btn-admin').style.display = isAdminOrOwner ? 'flex' : 'none';
    
    $('settings-email').textContent = state.user.email;
    $('settings-role').textContent = roleText;
    $('settings-joined').textContent = state.user.createdAt ? 
        new Date(state.user.createdAt).toLocaleDateString() : '-';
}

function updateSettingsPanel() {
    // Update storage mode select
    $('storage-mode-select').value = state.storageMode;
    updateStorageUI();
}

function getUsers() { 
    return JSON.parse(localStorage.getItem(CONFIG.STORAGE_PREFIX + 'users') || '{}'); 
}

function saveUsers(users) { 
    localStorage.setItem(CONFIG.STORAGE_PREFIX + 'users', JSON.stringify(users)); 
}

function loadUserData() { 
    const notes = localStorage.getItem(CONFIG.STORAGE_PREFIX + 'notes_' + state.user.email);
    state.notes = notes ? JSON.parse(notes) : [];
}

function saveUserData() { 
    localStorage.setItem(CONFIG.STORAGE_PREFIX + 'notes_' + state.user.email, JSON.stringify(state.notes)); 
    updateStorageUI(); 
}

function logActivity(email, action) { 
    const log = JSON.parse(localStorage.getItem(CONFIG.STORAGE_PREFIX + 'activity') || '[]'); 
    log.unshift({ email, action, time: new Date().toISOString() }); 
    if (log.length > 200) log.length = 200; 
    localStorage.setItem(CONFIG.STORAGE_PREFIX + 'activity', JSON.stringify(log)); 
}

function showError(id, msg) { 
    $(id).textContent = msg; 
    setTimeout(() => $(id).textContent = '', 5000); 
}

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
    
    // Sync to cloud if in cloud mode
    if (state.storageMode === 'cloud') {
        syncNoteToCloud(note);
    }
    
    return note;
}

function updateNote(id, updates) {
    const idx = state.notes.findIndex(n => n.id === id);
    if (idx !== -1) {
        state.notes[idx] = { 
            ...state.notes[idx], 
            ...updates, 
            updatedAt: new Date().toISOString() 
        };
        saveUserData();
        renderNotes();
        toast('Note updated', 'success');
        
        // Sync to cloud if in cloud mode
        if (state.storageMode === 'cloud') {
            syncNoteToCloud(state.notes[idx]);
        }
    }
}

function deleteNote(id) {
    const note = state.notes.find(n => n.id === id);
    if (note && confirm('Delete this note? This cannot be undone.')) {
        state.notes = state.notes.filter(n => n.id !== id);
        saveUserData();
        logActivity(state.user.email, 'Deleted note');
        renderNotes();
        toast('Note deleted');
        
        // Delete from cloud if in cloud mode
        if (state.storageMode === 'cloud') {
            deleteNoteFromCloud(id);
        }
        
        return true;
    }
    return false;
}

function getFilteredNotes() {
    let notes = [...state.notes];
    
    // Apply type filter
    if (state.filter === 'text') {
        notes = notes.filter(n => n.type === 'text');
    } else if (state.filter === 'voice') {
        notes = notes.filter(n => n.type === 'voice');
    } else if (state.filter === 'files') {
        notes = notes.filter(n => n.type === 'file' || n.type === 'image');
    } else if (state.filter === 'starred') {
        notes = notes.filter(n => n.starred);
    }
    
    // Apply tag filter
    if (state.tagFilter) {
        notes = notes.filter(n => n.tags?.includes(state.tagFilter));
    }
    
    // Apply search filter
    if (state.search) {
        const q = state.search.toLowerCase();
        notes = notes.filter(n => 
            n.title?.toLowerCase().includes(q) || 
            n.content?.toLowerCase().includes(q) || 
            n.tags?.some(t => t.toLowerCase().includes(q))
        );
    }
    
    // Apply sorting
    notes.sort((a, b) => {
        switch (state.sort) {
            case 'oldest': 
                return new Date(a.createdAt) - new Date(b.createdAt);
            case 'az': 
                return (a.title || '').localeCompare(b.title || '');
            case 'za': 
                return (b.title || '').localeCompare(a.title || '');
            case 'updated': 
                return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
            default: // newest
                return new Date(b.createdAt) - new Date(a.createdAt);
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
        
        // Attach event listeners
        grid.querySelectorAll('.note-card').forEach(card => {
            card.addEventListener('click', e => {
                if (!e.target.closest('.note-star')) {
                    openViewer(card.dataset.id);
                }
            });
            
            const starBtn = card.querySelector('.note-star');
            if (starBtn) {
                starBtn.addEventListener('click', e => {
                    e.stopPropagation();
                    toggleStar(card.dataset.id);
                });
            }
        });
    }
    
    grid.className = `notes-grid${state.view === 'list' ? ' list-view' : ''}`;
    updateCounts();
    updateTags();
    $('note-count-badge').textContent = `${notes.length} note${notes.length !== 1 ? 's' : ''}`;
}

function createNoteCard(note) {
    const icons = { 
        text: '#icon-file-text', 
        voice: '#icon-mic', 
        image: '#icon-image', 
        file: '#icon-paperclip' 
    };
    
    const date = new Date(note.createdAt);
    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = date.toLocaleDateString();
    
    let preview = '';
    if (note.type === 'image' && note.mediaData) {
        preview = `<div class="note-media-preview"><img src="${note.mediaData}" class="note-media-thumb" alt=""></div>`;
    } else if (note.type === 'voice') {
        const duration = note.duration ? formatDuration(note.duration) : '';
        preview = `<p class="note-preview voice-preview">
            <svg class="voice-icon"><use href="#icon-mic"/></svg>
            ${duration ? `<span>${duration}</span>` : ''}
        </p>`;
    } else if (note.content) {
        const truncated = note.content.length > 150 ? 
            note.content.substring(0, 150) + '...' : note.content;
        preview = `<p class="note-preview">${escapeHtml(truncated)}</p>`;
    }
    
    const tags = (note.tags || []).slice(0, 3);
    const tagsHtml = tags.map(t => `<span class="note-tag">${escapeHtml(t)}</span>`).join('');
    const moreTagsHtml = note.tags && note.tags.length > 3 ? 
        `<span class="note-tag">+${note.tags.length - 3}</span>` : '';
    
    return `<div class="note-card${note.starred ? ' starred' : ''}" data-id="${note.id}">
        <div class="note-card-header">
            <span class="type-badge ${note.type}">
                <svg><use href="${icons[note.type] || icons.text}"/></svg>
                <span>${note.type}</span>
            </span>
            <button class="note-star" aria-label="Star">
                <svg><use href="${note.starred ? '#icon-star-filled' : '#icon-star'}"/></svg>
            </button>
        </div>
        <h3 class="note-title">${escapeHtml(note.title)}</h3>
        ${preview}
        <div class="note-card-footer">
            <div class="note-tags">${tagsHtml}${moreTagsHtml}</div>
            <span class="note-time" title="${dateStr}">${time}</span>
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
    
    const container = $('sidebar-tags');
    if (tags.size === 0) {
        container.innerHTML = '<p class="no-tags">No tags yet</p>';
        return;
    }
    
    container.innerHTML = Array.from(tags).map(tag => 
        `<button class="tag-chip${state.tagFilter === tag ? ' active' : ''}" data-tag="${escapeHtml(tag)}">
            ${escapeHtml(tag)}
        </button>`
    ).join('');
    
    container.querySelectorAll('.tag-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            const tag = btn.dataset.tag;
            state.tagFilter = state.tagFilter === tag ? null : tag;
            state.filter = 'all'; // Reset to all notes
            
            $$('.tag-chip').forEach(b => b.classList.remove('active'));
            $$('.nav-item').forEach(b => b.classList.remove('active'));
            
            if (state.tagFilter) {
                btn.classList.add('active');
            } else {
                $$('.nav-item[data-filter="all"]').forEach(b => b.classList.add('active'));
            }
            
            updatePageTitle();
            renderNotes();
            if (window.innerWidth <= 1024) closeSidebar();
        });
    });
}

function updatePageTitle() {
    const titles = { 
        all: 'All Notes', 
        text: 'Text Notes', 
        voice: 'Voice Notes', 
        files: 'Files & Images', 
        starred: 'Starred' 
    };
    
    let title = titles[state.filter] || 'All Notes';
    if (state.tagFilter) {
        title = `#${state.tagFilter}`;
    }
    
    $('page-title').textContent = title;
}

function toggleStar(id) {
    const note = state.notes.find(n => n.id === id);
    if (note) { 
        note.starred = !note.starred; 
        saveUserData(); 
        renderNotes(); 
        
        // Update viewer if open
        if (state.viewingNote?.id === id) {
            state.viewingNote.starred = note.starred;
            updateViewerStarButton();
        }
    }
}

// ============================================================
// NOTE VIEWER
// ============================================================
function openViewer(noteId) {
    const note = state.notes.find(n => n.id === noteId);
    if (!note) return;
    
    state.viewingNote = note;
    
    // Update type badge
    const typeBadge = $('viewer-type');
    const icons = { 
        text: '#icon-file-text', 
        voice: '#icon-mic', 
        image: '#icon-image', 
        file: '#icon-paperclip' 
    };
    typeBadge.innerHTML = `
        <svg><use href="${icons[note.type] || icons.text}"/></svg>
        <span>${note.type}</span>
    `;
    typeBadge.className = 'type-badge ' + note.type;
    
    // Update date
    $('viewer-date').textContent = formatTime(note.createdAt);
    
    // Update title
    $('viewer-title').textContent = note.title;
    
    // Update content
    const contentEl = $('viewer-content');
    const mediaEl = $('viewer-media');
    const audioEl = $('viewer-audio');
    
    contentEl.classList.toggle('hidden', !note.content);
    mediaEl.classList.add('hidden');
    audioEl.classList.add('hidden');
    
    if (note.content) {
        contentEl.textContent = note.content;
    }
    
    // Handle media
    if (note.type === 'image' && note.mediaData) {
        mediaEl.classList.remove('hidden');
        mediaEl.innerHTML = `<img src="${note.mediaData}" alt="${escapeHtml(note.title)}">`;
    } else if (note.type === 'voice' && note.audioData) {
        audioEl.classList.remove('hidden');
        const player = $('audio-player');
        player.src = note.audioData;
    }
    
    // Update tags
    const tagsContainer = $('viewer-tags');
    if (note.tags && note.tags.length > 0) {
        tagsContainer.innerHTML = note.tags.map(tag => 
            `<span class="tag-chip">${escapeHtml(tag)}</span>`
        ).join('');
    } else {
        tagsContainer.innerHTML = '';
    }
    
    // Update star button
    updateViewerStarButton();
    
    openModal('viewer-modal');
}

function updateViewerStarButton() {
    if (!state.viewingNote) return;
    const starBtn = $('viewer-star');
    const icon = starBtn.querySelector('use');
    icon.setAttribute('href', state.viewingNote.starred ? '#icon-star-filled' : '#icon-star');
    starBtn.classList.toggle('active', state.viewingNote.starred);
}

function toggleViewerStar() {
    if (!state.viewingNote) return;
    toggleStar(state.viewingNote.id);
}

function editFromViewer() {
    if (!state.viewingNote) return;
    closeModal('viewer-modal');
    setTimeout(() => openEditor(state.viewingNote), 100);
}

function deleteFromViewer() {
    if (!state.viewingNote) return;
    if (deleteNote(state.viewingNote.id)) {
        closeModal('viewer-modal');
        state.viewingNote = null;
    }
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
    const container = $('editor-tag-chips');
    container.innerHTML = tags.map(tag => 
        `<span class="tag-chip-edit">
            ${escapeHtml(tag)}
            <button type="button" class="tag-remove" data-tag="${escapeHtml(tag)}" aria-label="Remove tag">
                <svg><use href="#icon-x"/></svg>
            </button>
        </span>`
    ).join('');
    container.dataset.tags = JSON.stringify(tags);
    
    // Attach remove handlers
    container.querySelectorAll('.tag-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            const tag = btn.dataset.tag;
            const currentTags = JSON.parse(container.dataset.tags || '[]');
            const newTags = currentTags.filter(t => t !== tag);
            renderEditorTags(newTags);
        });
    });
}

function addTag() {
    const input = $('editor-tag-input');
    const tag = input.value.trim().toLowerCase();
    
    if (!tag) return;
    
    const container = $('editor-tag-chips');
    const tags = JSON.parse(container.dataset.tags || '[]');
    
    if (!tags.includes(tag)) { 
        tags.push(tag); 
        renderEditorTags(tags); 
    }
    
    input.value = '';
}

function updateCharCount() {
    const count = $('editor-content').value.length;
    const words = $('editor-content').value.trim() ? 
        $('editor-content').value.trim().split(/\s+/).length : 0;
    $('char-count').textContent = `${count} characters · ${words} words`;
}

function saveNote() {
    const title = $('editor-title').value.trim() || 'Untitled';
    const content = $('editor-content').value.trim();
    const tags = JSON.parse($('editor-tag-chips').dataset.tags || '[]');
    
    if (!content && !state.editingNote) {
        toast('Please add some content', 'error');
        return;
    }
    
    if (state.editingNote) {
        updateNote(state.editingNote.id, { title, content, tags });
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
    // Reset state
    state.recording.active = false;
    state.recording.chunks = [];
    state.recording.startTime = null;
    
    openModal('voice-modal');
    $('voice-status').textContent = 'Ready to record';
    $('voice-timer').textContent = '00:00';
    $('voice-save').disabled = true;
    $('voice-details').classList.add('hidden');
    $('voice-title').value = '';
    $('voice-notes').value = '';
    
    // Reset button states
    const toggleBtn = $('voice-toggle');
    toggleBtn.classList.remove('recording');
    toggleBtn.querySelector('.rec-icon').classList.remove('hidden');
    toggleBtn.querySelector('.stop-icon').classList.add('hidden');
    
    // Clear canvas
    const canvas = $('voice-canvas');
    const ctx = canvas.getContext('2d');
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg-elevated').trim();
    ctx.fillStyle = bg || '#19191c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
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
            
            state.recording.mediaRecorder.ondataavailable = e => {
                if (e.data.size > 0) {
                    state.recording.chunks.push(e.data);
                }
            };
            
            state.recording.mediaRecorder.onstop = () => {
                $('voice-status').textContent = 'Recording complete';
                $('voice-save').disabled = false;
                $('voice-details').classList.remove('hidden');
                
                const toggleBtn = $('voice-toggle');
                toggleBtn.classList.remove('recording');
                toggleBtn.querySelector('.rec-icon').classList.remove('hidden');
                toggleBtn.querySelector('.stop-icon').classList.add('hidden');
                
                // Focus on title input
                setTimeout(() => $('voice-title').focus(), 100);
            };
            
            state.recording.mediaRecorder.start();
            state.recording.active = true;
            state.recording.startTime = Date.now();
            
            $('voice-status').textContent = 'Recording...';
            const toggleBtn = $('voice-toggle');
            toggleBtn.classList.add('recording');
            toggleBtn.querySelector('.rec-icon').classList.add('hidden');
            toggleBtn.querySelector('.stop-icon').classList.remove('hidden');
            
            updateRecordingTimer();
            state.recording.timer = setInterval(updateRecordingTimer, 1000);
            visualizeAudio();
            
        } catch (err) {
            console.error('Microphone access error:', err);
            toast('Cannot access microphone. Please allow microphone access.', 'error');
        }
    }
}

function stopRecording() {
    if (state.recording.mediaRecorder && state.recording.active) {
        state.recording.mediaRecorder.stop();
        state.recording.mediaRecorder.stream.getTracks().forEach(t => t.stop());
        clearInterval(state.recording.timer);
        state.recording.active = false;
        if (state.recording.audioContext) {
            state.recording.audioContext.close();
        }
    }
}

function cancelRecording() {
    stopRecording();
    state.recording.chunks = [];
    closeModal('voice-modal');
}

function saveVoiceNote() {
    if (state.recording.chunks.length === 0) {
        toast('No recording found', 'error');
        return;
    }
    
    const blob = new Blob(state.recording.chunks, { type: 'audio/webm' });
    const reader = new FileReader();
    
    reader.onload = () => {
        const duration = Math.floor((Date.now() - state.recording.startTime) / 1000);
        const title = $('voice-title').value.trim() || 
            `Voice Note ${new Date().toLocaleDateString()}`;
        
        createNote({
            type: 'voice',
            title: title,
            content: $('voice-notes').value.trim(),
            audioData: reader.result,
            duration: duration
        });
        
        state.recording.chunks = [];
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
            const barHeight = (dataArray[i] / 255) * canvas.height * 0.8;
            const hue = 220 + (i / bufferLength) * 40;
            ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;
            ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
            x += barWidth + 1;
        }
    }
    
    draw();
}

// ============================================================
// FILE HANDLING
// ============================================================
function handleFileUpload(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    
    files.forEach(file => {
        // Check file size
        const maxSize = state.user.maxUploadBytes || CONFIG.MAX_UPLOAD_MB * 1024 * 1024;
        if (file.size > maxSize) {
            toast(`File ${file.name} is too large (max ${formatBytes(maxSize)})`, 'error');
            return;
        }
        
        const attachment = { 
            name: file.name, 
            size: file.size, 
            type: file.type 
        };
        
        createNote({
            type: 'file',
            title: file.name || 'File',
            content: '',
            attachments: [attachment]
        });
    });
    
    e.target.value = '';
}

function handleImageUpload(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    
    files.forEach(file => {
        // Check file size
        const maxSize = state.user.maxUploadBytes || CONFIG.MAX_UPLOAD_MB * 1024 * 1024;
        if (file.size > maxSize) {
            toast(`Image ${file.name} is too large (max ${formatBytes(maxSize)})`, 'error');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result;
            const attachment = { 
                name: file.name, 
                size: file.size, 
                type: file.type 
            };
            
            createNote({
                type: 'image',
                title: file.name || 'Image',
                content: '',
                attachments: [attachment],
                mediaData: dataUrl
            });
        };
        reader.readAsDataURL(file);
    });
    
    e.target.value = '';
}

// ============================================================
// EXPORT / IMPORT
// ============================================================
function exportNotes() {
    const data = {
        version: CONFIG.VERSION,
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
    
    toast(`Exported ${state.notes.length} notes`, 'success');
    logActivity(state.user.email, 'Exported notes');
}

function importNotes(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const data = JSON.parse(reader.result);
            
            if (!data.notes || !Array.isArray(data.notes)) {
                toast('Invalid file format', 'error');
                return;
            }
            
            const importedCount = data.notes.length;
            state.notes = [...data.notes, ...state.notes];
            saveUserData();
            renderNotes();
            
            toast(`Imported ${importedCount} notes`, 'success');
            logActivity(state.user.email, `Imported ${importedCount} notes`);
            
        } catch (err) {
            console.error('Import error:', err);
            toast('Invalid file format', 'error');
        }
    };
    
    reader.readAsText(file);
    e.target.value = '';
}

function clearAllData() {
    const count = state.notes.length;
    if (confirm(`Delete ALL ${count} notes? This cannot be undone.`)) {
        state.notes = [];
        saveUserData();
        renderNotes();
        toast('All data cleared');
        logActivity(state.user.email, 'Cleared all notes');
    }
}

// ============================================================
// ADMIN PANEL
// ============================================================
function loadAdminData() {
    if (![CONFIG.ROLES.OWNER, CONFIG.ROLES.ADMIN].includes(state.user?.role)) {
        toast('Access denied', 'error');
        closePanel('admin-panel');
        return;
    }
    
    const users = getUsers();
    const activity = JSON.parse(localStorage.getItem(CONFIG.STORAGE_PREFIX + 'activity') || '[]');
    
    // Calculate stats
    const totalUsers = Object.keys(users).length;
    const activeUsers = Object.values(users).filter(u => {
        if (!u.lastActiveAt) return false;
        const lastActive = new Date(u.lastActiveAt);
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return lastActive > dayAgo;
    }).length;
    
    let totalNotes = 0;
    let totalStorage = 0;
    const noteTypes = { text: 0, voice: 0, image: 0, file: 0 };
    
    Object.keys(users).forEach(email => {
        const userNotes = JSON.parse(
            localStorage.getItem(CONFIG.STORAGE_PREFIX + 'notes_' + email) || '[]'
        );
        totalNotes += userNotes.length;
        
        userNotes.forEach(note => {
            noteTypes[note.type] = (noteTypes[note.type] || 0) + 1;
        });
        
        totalStorage += users[email].usedBytes || 0;
    });
    
    // Update stats
    $('admin-total-users').textContent = totalUsers;
    $('admin-active-users').textContent = activeUsers;
    $('admin-total-notes').textContent = totalNotes;
    $('admin-storage-used').textContent = formatBytes(totalStorage);
    
    // Render note types chart
    renderNoteTypesChart(noteTypes);
    
    // Render users table
    renderUsersTable(users);
    
    // Render activity log
    renderActivityLog(activity.slice(0, 20));
}

function renderNoteTypesChart(noteTypes) {
    const container = $('chart-types');
    const total = Object.values(noteTypes).reduce((sum, val) => sum + val, 0);
    
    if (total === 0) {
        container.innerHTML = '<p class="empty-chart">No notes yet</p>';
        return;
    }
    
    const colors = {
        text: '#3b82f6',
        voice: '#8b5cf6',
        image: '#ec4899',
        file: '#f59e0b'
    };
    
    container.innerHTML = Object.entries(noteTypes)
        .filter(([, count]) => count > 0)
        .map(([type, count]) => {
            const percent = (count / total * 100).toFixed(1);
            return `
                <div class="chart-bar">
                    <div class="chart-label">
                        <span>${type}</span>
                        <span>${count} (${percent}%)</span>
                    </div>
                    <div class="chart-fill-bg">
                        <div class="chart-fill" style="width: ${percent}%; background: ${colors[type]}"></div>
                    </div>
                </div>
            `;
        }).join('');
}

function renderUsersTable(users) {
    const tbody = $('users-table-body');
    
    const userArray = Object.entries(users).map(([email, user]) => ({ email, ...user }));
    
    tbody.innerHTML = userArray.map(user => {
        const userNotes = JSON.parse(
            localStorage.getItem(CONFIG.STORAGE_PREFIX + 'notes_' + user.email) || '[]'
        );
        const noteCount = userNotes.length;
        const storage = formatBytes(user.usedBytes || 0);
        const statusClass = user.status === 'active' ? 'success' : 'danger';
        
        return `
            <tr>
                <td>
                    <div class="user-cell">
                        <div class="user-avatar small">
                            <span>${(user.displayName || user.email)[0].toUpperCase()}</span>
                        </div>
                        <div class="user-info">
                            <div class="user-name">${escapeHtml(user.displayName || user.email)}</div>
                            <div class="user-email">${escapeHtml(user.email)}</div>
                        </div>
                    </div>
                </td>
                <td><span class="role-badge ${user.role}">${user.role}</span></td>
                <td>${noteCount}</td>
                <td>${storage}</td>
                <td><span class="status-badge ${statusClass}">${user.status}</span></td>
                <td>
                    <div class="table-actions">
                        <button class="btn-icon btn-icon-sm" onclick="viewUser('${escapeHtml(user.email)}')" aria-label="View">
                            <svg><use href="#icon-eye"/></svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function renderActivityLog(activities) {
    const container = $('activity-list');
    
    if (activities.length === 0) {
        container.innerHTML = '<p class="empty-activity">No recent activity</p>';
        return;
    }
    
    container.innerHTML = activities.map(act => {
        const time = formatTime(act.time);
        const icon = getActivityIcon(act.action);
        
        return `
            <div class="activity-item">
                <div class="activity-icon">
                    <svg><use href="${icon}"/></svg>
                </div>
                <div class="activity-content">
                    <div class="activity-text">
                        <strong>${escapeHtml(act.email)}</strong> ${escapeHtml(act.action)}
                    </div>
                    <div class="activity-time">${time}</div>
                </div>
            </div>
        `;
    }).join('');
}

function getActivityIcon(action) {
    const lower = action.toLowerCase();
    if (lower.includes('created')) return '#icon-plus';
    if (lower.includes('deleted')) return '#icon-trash';
    if (lower.includes('logged in')) return '#icon-log-out';
    if (lower.includes('logged out')) return '#icon-log-out';
    if (lower.includes('exported')) return '#icon-download';
    if (lower.includes('imported')) return '#icon-upload';
    return '#icon-activity';
}

window.viewUser = function(email) {
    toast('User details view not yet implemented', 'info');
};

// ============================================================
// THEME
// ============================================================
function applyTheme() {
    const theme = localStorage.getItem(CONFIG.STORAGE_PREFIX + 'theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    $$('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === theme);
    });
}

function setTheme(theme) {
    localStorage.setItem(CONFIG.STORAGE_PREFIX + 'theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    toast(`Switched to ${theme} mode`, 'success');
}

// ============================================================
// SEARCH
// ============================================================
function handleSearch(e) {
    state.search = e.target.value.trim().toLowerCase();
    renderNotes();
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
    const icons = {
        success: '#icon-check',
        error: '#icon-alert-circle',
        info: '#icon-info'
    };
    const icon = icons[type] || icons.success;
    
    const div = document.createElement('div');
    div.className = `toast ${type}`;
    div.innerHTML = `<svg><use href="${icon}"/></svg><span>${escapeHtml(message)}</span>`;
    
    $('toast-container').appendChild(div);
    
    setTimeout(() => {
        div.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => div.remove(), 300);
    }, 3000);
}

// ============================================================
// STORAGE
// ============================================================
function computeUsedBytes() {
    if (!state.user || state.storageMode === 'local') return 0;
    
    let total = 0;
    state.notes.forEach(note => {
        // Count attachments
        if (Array.isArray(note.attachments)) {
            note.attachments.forEach(att => {
                if (typeof att.size === 'number') {
                    total += att.size;
                }
            });
        }
        
        // Count text content
        if (note.type === 'text' && note.content) {
            total += new Blob([note.content]).size;
        }
        
        // Count audio data
        if (note.type === 'voice' && note.audioData) {
            // Rough estimate from base64
            total += Math.floor(note.audioData.length * 0.75);
        }
        
        // Count image data
        if (note.type === 'image' && note.mediaData) {
            total += Math.floor(note.mediaData.length * 0.75);
        }
    });
    
    return total;
}

function updateStorageUI() {
    if (!state.user) return;
    
    let used = (state.storageMode === 'local') ? 0 : computeUsedBytes();
    
    // Update user object
    if (state.user.email && state.user.email !== 'local') {
        const users = getUsers();
        if (users[state.user.email]) {
            users[state.user.email].usedBytes = used;
            saveUsers(users);
        }
        state.user.usedBytes = used;
    }
    
    const quota = state.user.quotaLimitBytes;
    let percent = 0;
    
    if (state.storageMode === 'cloud' && quota && quota !== Infinity) {
        percent = Math.min(100, Math.round((used / quota) * 100));
    }
    
    // Update mini indicator
    $('storage-mini-fill').style.width = percent + '%';
    $('storage-mini-text').textContent = percent + '%';
    
    // Update sidebar card
    $('storage-fill').style.width = percent + '%';
    $('storage-percent').textContent = percent + '%';
    $('storage-used').textContent = formatBytes(used);
    
    const limitText = (quota === Infinity || state.storageMode === 'local') ?
        'Unlimited' : formatBytes(quota);
    $('storage-limit').textContent =
        (state.storageMode === 'local') ? '' : ' / ' + limitText;
    
    // Update settings panel
    $('settings-storage-used').textContent = formatBytes(used);
    $('settings-storage-quota').textContent = limitText;
}

function updateStorageModeUI() {
    $('storage-mode-select').value = state.storageMode;
    
    const badge = $('storage-mode-badge');
    const useEl = badge.querySelector('svg use');
    const textEl = badge.querySelector('span');
    
    // Update badge
    if (state.storageMode === 'local') {
        useEl.setAttribute('href', '#icon-cloud-off');
        textEl.textContent = 'Local Only';
        badge.classList.add('local');
    } else {
        useEl.setAttribute('href', '#icon-cloud');
        textEl.textContent = 'Cloud Sync';
        badge.classList.remove('local');
    }
    
    // Show/hide cloud sync controls
    const cloudControls = $('cloud-sync-controls');
    if (cloudControls) {
        cloudControls.style.display = state.storageMode === 'cloud' ? 'block' : 'none';
    }
    
    updateStorageUI();
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
    if (diff < 604800000) return Math.floor(diff / 86400000) + 'd ago';
    
    return date.toLocaleDateString();
}

function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function debounce(fn, delay) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), delay);
    };
}

// ============================================================
// AWS CLOUD INTEGRATION (Ready for implementation)
// ============================================================

/**
 * Initialize AWS services when cloud mode is enabled
 * This function should be called when user switches to cloud mode
 */
async function initCloudServices() {
    if (!CONFIG.AWS.API_ENDPOINT) {
        console.warn('AWS not configured');
        return false;
    }
    
    // TODO: Initialize AWS Cognito for authentication
    // TODO: Set up DynamoDB connection for notes storage
    // TODO: Configure S3 for file attachments
    
    return true;
}

/**
 * Load notes from cloud
 */
async function loadNotesFromCloud() {
    if (!CONFIG.AWS.API_ENDPOINT || !state.user) return 0;
    
    try {
        const response = await fetch(`${CONFIG.AWS.API_ENDPOINT}/notes?userId=${state.user.email}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load notes from cloud');
        }
        
        const data = await response.json();
        
        if (data.notes && Array.isArray(data.notes)) {
            // Convert cloud notes to local format
            const cloudNotes = data.notes.map(note => ({
                id: note.noteId,
                type: note.type,
                title: note.title,
                content: note.content,
                tags: note.tags || [],
                starred: note.starred || false,
                createdAt: note.createdAt,
                updatedAt: note.updatedAt,
                audioData: note.audioData,
                imageData: note.imageData,
                attachments: note.attachments
            }));
            
            // Merge with local notes (prefer cloud version)
            const cloudNoteIds = new Set(cloudNotes.map(n => n.id));
            const localOnlyNotes = state.notes.filter(n => !cloudNoteIds.has(n.id));
            
            state.notes = [...cloudNotes, ...localOnlyNotes]
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            
            renderNotes();
            console.log(`Loaded ${cloudNotes.length} notes from cloud`);
            return cloudNotes.length;
        }
        
        return 0;
    } catch (error) {
        console.error('Failed to load notes from cloud:', error);
        toast('Failed to sync from cloud', 'error');
        return 0;
    }
}

/**
 * Refresh notes from cloud (pull latest)
 */
async function refreshFromCloud() {
    if (state.storageMode !== 'cloud' || !CONFIG.AWS.API_ENDPOINT) {
        toast('Cloud sync not enabled', 'warning');
        return;
    }
    
    toast('Refreshing from cloud...', 'info');
    const count = await loadNotesFromCloud();
    
    if (count > 0) {
        toast(`Loaded ${count} notes from cloud`, 'success');
    } else {
        toast('Already up to date', 'info');
    }
}

/**
 * Delete note from cloud
 */
async function deleteNoteFromCloud(noteId) {
    if (state.storageMode !== 'cloud' || !CONFIG.AWS.API_ENDPOINT) return;
    
    try {
        const response = await fetch(`${CONFIG.AWS.API_ENDPOINT}/notes/${noteId}?userId=${state.user.email}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete note from cloud');
        }
        
        console.log('Note deleted from cloud:', noteId);
        return true;
    } catch (error) {
        console.error('Failed to delete note from cloud:', error);
        return false;
    }
}

/**
 * Sync a single note to DynamoDB
 */
async function syncNoteToCloud(note) {
    if (state.storageMode !== 'cloud' || !CONFIG.AWS.API_ENDPOINT) return;
    
    try {
        const response = await fetch(`${CONFIG.AWS.API_ENDPOINT}/notes?userId=${state.user.email}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                noteId: note.id,
                type: note.type,
                title: note.title,
                content: note.content,
                tags: note.tags,
                starred: note.starred,
                createdAt: note.createdAt,
                updatedAt: note.updatedAt,
                audioData: note.audioData,
                imageData: note.imageData,
                attachments: note.attachments
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to sync note');
        }
        
        console.log('Note synced to cloud:', note.id);
    } catch (error) {
        console.error('Cloud sync error:', error);
        toast('Failed to sync to cloud', 'error');
    }
}

/**
 * Sync all notes to cloud (used when switching to cloud mode)
 */
async function syncNotesToCloud() {
    if (state.storageMode !== 'cloud' || !CONFIG.AWS.API_ENDPOINT) return;
    
    try {
        toast('Syncing notes to cloud...', 'info');
        
        for (const note of state.notes) {
            await syncNoteToCloud(note);
        }
        
        toast('All notes synced to cloud', 'success');
    } catch (error) {
        console.error('Cloud sync error:', error);
        toast('Cloud sync failed', 'error');
    }
}

/**
 * Upload attachment to S3
 */
async function uploadToS3(file) {
    if (!CONFIG.AWS.S3_BUCKET) return null;
    
    try {
        // TODO: Implement S3 upload
        // const formData = new FormData();
        // formData.append('file', file);
        // const response = await fetch(`${CONFIG.AWS.API_ENDPOINT}/upload`, {
        //     method: 'POST',
        //     body: formData
        // });
        
        console.log('S3 upload ready for implementation');
        return null;
    } catch (error) {
        console.error('S3 upload error:', error);
        return null;
    }
}
