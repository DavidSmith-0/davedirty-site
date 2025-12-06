// DAVE NOTES - Complete Application
// Multi-user, Voice Notes, File Uploads, Analytics

const CONFIG = {
    ADMIN_USER: 'dave',
    ADMIN_PASS: 'dave3232',
    STORAGE_PREFIX: 'davenotes_',
    MAX_FILE_SIZE: 5 * 1024 * 1024
};

const state = {
    currentUser: null,
    notes: [],
    filter: 'all',
    tagFilter: null,
    view: 'grid',
    sort: 'newest',
    search: '',
    editingNote: null,
    recording: { active: false, mediaRecorder: null, chunks: [], startTime: null, timer: null, audioContext: null, analyser: null }
};

const $ = id => document.getElementById(id);

document.addEventListener('DOMContentLoaded', init);

function init() {
    checkAutoLogin();
    setupEventListeners();
    applyTheme();
}

function checkAutoLogin() {
    const saved = localStorage.getItem(CONFIG.STORAGE_PREFIX + 'session');
    if (saved) {
        const session = JSON.parse(saved);
        if (session.remember) {
            state.currentUser = session.username;
            showApp();
        }
    }
}

function setupEventListeners() {
    $('login-form').addEventListener('submit', handleLogin);
    $('register-form').addEventListener('submit', handleRegister);
    $('show-register').addEventListener('click', () => { $('login-view').classList.add('hidden'); $('register-view').classList.remove('hidden'); });
    $('show-login').addEventListener('click', () => { $('register-view').classList.add('hidden'); $('login-view').classList.remove('hidden'); });
    
    $('sidebar-toggle').addEventListener('click', toggleSidebar);
    $('search-input').addEventListener('input', debounce(e => { state.search = e.target.value; renderNotes(); }, 300));
    $('ai-btn').addEventListener('click', toggleAI);
    $('user-btn').addEventListener('click', () => $('user-dropdown').classList.toggle('hidden'));
    $('logout-btn').addEventListener('click', logout);
    $('settings-btn').addEventListener('click', () => { closeAllPanels(); $('settings-panel').classList.toggle('hidden'); });
    $('analytics-btn').addEventListener('click', () => { closeAllPanels(); $('analytics-panel').classList.toggle('hidden'); loadAnalytics(); });
    
    document.addEventListener('click', e => {
        if (!e.target.closest('.user-menu')) $('user-dropdown').classList.add('hidden');
    });
    
    document.addEventListener('keydown', e => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); $('search-input').focus(); }
        if (e.key === 'Escape') closeAllModals();
    });
    
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            state.filter = btn.dataset.filter;
            state.tagFilter = null;
            document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updateViewTitle();
            renderNotes();
        });
    });
    
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.view = btn.dataset.view;
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderNotes();
        });
    });
    
    $('sort-select').addEventListener('change', e => { state.sort = e.target.value; renderNotes(); });
    
    $('fab-main').addEventListener('click', () => $('fab-container').classList.toggle('open'));
    $('fab-text').addEventListener('click', () => { closeFab(); openNoteEditor(); });
    $('fab-voice').addEventListener('click', () => { closeFab(); openVoiceRecorder(); });
    $('fab-upload').addEventListener('click', () => { closeFab(); $('file-input').click(); });
    $('fab-image').addEventListener('click', () => { closeFab(); $('image-input').click(); });
    $('new-note-btn').addEventListener('click', openNoteEditor);
    
    $('file-input').addEventListener('change', handleFileUpload);
    $('image-input').addEventListener('change', handleImageUpload);
    
    $('save-note').addEventListener('click', saveNote);
    $('cancel-note').addEventListener('click', () => $('note-modal').classList.add('hidden'));
    $('note-content').addEventListener('input', () => $('char-count').textContent = $('note-content').value.length + ' chars');
    $('editor-tag-input').addEventListener('keypress', e => { if (e.key === 'Enter') { e.preventDefault(); addEditorTag(); } });
    document.querySelectorAll('.modal-backdrop').forEach(el => el.addEventListener('click', closeAllModals));
    
    $('recorder-toggle').addEventListener('click', toggleRecording);
    $('recorder-cancel').addEventListener('click', cancelRecording);
    $('recorder-save').addEventListener('click', saveVoiceNote);
    
    $('close-viewer').addEventListener('click', () => $('view-modal').classList.add('hidden'));
    $('viewer-star').addEventListener('click', toggleViewerStar);
    $('viewer-edit').addEventListener('click', editViewerNote);
    $('viewer-delete').addEventListener('click', deleteViewerNote);
    
    $('close-ai').addEventListener('click', () => $('ai-panel').classList.add('hidden'));
    $('ai-send').addEventListener('click', sendAIMessage);
    $('ai-input').addEventListener('keypress', e => { if (e.key === 'Enter') sendAIMessage(); });
    document.querySelectorAll('.suggestion-btn').forEach(btn => {
        btn.addEventListener('click', () => { $('ai-input').value = btn.textContent.replace(/"/g, ''); sendAIMessage(); });
    });
    
    $('close-settings').addEventListener('click', () => $('settings-panel').classList.add('hidden'));
    $('theme-select').addEventListener('change', e => { localStorage.setItem(CONFIG.STORAGE_PREFIX + 'theme', e.target.value); applyTheme(); });
    $('export-btn').addEventListener('click', exportNotes);
    $('import-btn').addEventListener('click', () => $('import-input').click());
    $('import-input').addEventListener('change', importNotes);
    $('clear-btn').addEventListener('click', clearUserData);
    
    $('close-analytics').addEventListener('click', () => $('analytics-panel').classList.add('hidden'));
}

function handleLogin(e) {
    e.preventDefault();
    const username = $('login-username').value.trim().toLowerCase();
    const password = $('login-password').value;
    const remember = $('remember-me').checked;
    
    const users = getUsers();
    const user = users[username];
    
    if (user && user.password === password) {
        loginUser(username, remember);
    } else if (username === CONFIG.ADMIN_USER && password === CONFIG.ADMIN_PASS) {
        if (!users[username]) {
            users[username] = { password, createdAt: new Date().toISOString(), isAdmin: true };
            saveUsers(users);
        }
        loginUser(username, remember);
    } else {
        $('login-error').textContent = 'Invalid username or password';
    }
}

function handleRegister(e) {
    e.preventDefault();
    const username = $('register-username').value.trim().toLowerCase();
    const password = $('register-password').value;
    const confirm = $('register-confirm').value;
    
    if (password !== confirm) { $('register-error').textContent = 'Passwords do not match'; return; }
    
    const users = getUsers();
    if (users[username]) { $('register-error').textContent = 'Username already exists'; return; }
    
    users[username] = { password, createdAt: new Date().toISOString(), isAdmin: false };
    saveUsers(users);
    logActivity(username, 'Account created');
    loginUser(username, true);
}

function loginUser(username, remember) {
    state.currentUser = username;
    localStorage.setItem(CONFIG.STORAGE_PREFIX + 'session', JSON.stringify({ username, remember }));
    logActivity(username, 'Logged in');
    showApp();
}

function logout() {
    logActivity(state.currentUser, 'Logged out');
    state.currentUser = null;
    localStorage.removeItem(CONFIG.STORAGE_PREFIX + 'session');
    location.reload();
}

function showApp() {
    $('auth-screen').classList.add('hidden');
    $('app').classList.remove('hidden');
    loadUserData();
    updateUserUI();
    renderNotes();
}

function updateUserUI() {
    const initial = state.currentUser.charAt(0).toUpperCase();
    $('user-avatar').textContent = initial;
    $('dropdown-avatar').textContent = initial;
    $('user-name').textContent = state.currentUser;
    $('dropdown-name').textContent = state.currentUser;
    
    const users = getUsers();
    const isAdmin = users[state.currentUser]?.isAdmin || state.currentUser === CONFIG.ADMIN_USER;
    $('dropdown-role').textContent = isAdmin ? 'Admin' : 'Member';
    $('analytics-btn').style.display = isAdmin ? 'flex' : 'none';
}

function getUsers() { return JSON.parse(localStorage.getItem(CONFIG.STORAGE_PREFIX + 'users') || '{}'); }
function saveUsers(users) { localStorage.setItem(CONFIG.STORAGE_PREFIX + 'users', JSON.stringify(users)); }
function loadUserData() { const data = localStorage.getItem(CONFIG.STORAGE_PREFIX + 'notes_' + state.currentUser); state.notes = data ? JSON.parse(data) : []; }
function saveUserData() { localStorage.setItem(CONFIG.STORAGE_PREFIX + 'notes_' + state.currentUser, JSON.stringify(state.notes)); updateStorage(); }
function logActivity(username, action) {
    const log = JSON.parse(localStorage.getItem(CONFIG.STORAGE_PREFIX + 'activity') || '[]');
    log.unshift({ username, action, time: new Date().toISOString() });
    if (log.length > 100) log.pop();
    localStorage.setItem(CONFIG.STORAGE_PREFIX + 'activity', JSON.stringify(log));
}

function createNote(data) {
    const note = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2),
        type: data.type || 'text',
        title: data.title || 'Untitled',
        content: data.content || '',
        tags: data.tags || [],
        starred: false,
        createdAt: new Date().toISOString(),
        ...data
    };
    state.notes.unshift(note);
    saveUserData();
    logActivity(state.currentUser, `Created ${note.type} note`);
    renderNotes();
    toast('Note saved!', 'success');
    return note;
}

function updateNote(id, updates) {
    const idx = state.notes.findIndex(n => n.id === id);
    if (idx !== -1) { state.notes[idx] = { ...state.notes[idx], ...updates }; saveUserData(); renderNotes(); }
}

function deleteNote(id) {
    state.notes = state.notes.filter(n => n.id !== id);
    saveUserData();
    logActivity(state.currentUser, 'Deleted note');
    renderNotes();
    toast('Note deleted');
}

function getFilteredNotes() {
    let notes = [...state.notes];
    if (state.filter === 'text') notes = notes.filter(n => n.type === 'text');
    else if (state.filter === 'voice') notes = notes.filter(n => n.type === 'voice');
    else if (state.filter === 'files') notes = notes.filter(n => n.type === 'file' || n.type === 'image');
    else if (state.filter === 'starred') notes = notes.filter(n => n.starred);
    if (state.tagFilter) notes = notes.filter(n => n.tags.includes(state.tagFilter));
    if (state.search) {
        const q = state.search.toLowerCase();
        notes = notes.filter(n => n.title.toLowerCase().includes(q) || (n.content && n.content.toLowerCase().includes(q)) || n.tags.some(t => t.toLowerCase().includes(q)));
    }
    notes.sort((a, b) => {
        if (state.sort === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
        if (state.sort === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
        if (state.sort === 'az') return a.title.localeCompare(b.title);
        if (state.sort === 'za') return b.title.localeCompare(a.title);
        return 0;
    });
    return notes;
}

function renderNotes() {
    const notes = getFilteredNotes();
    const container = $('notes-container');
    if (notes.length === 0) {
        container.innerHTML = '';
        $('empty-state').classList.remove('hidden');
    } else {
        $('empty-state').classList.add('hidden');
        container.innerHTML = notes.map(note => createNoteCard(note)).join('');
        container.querySelectorAll('.note-card').forEach(card => {
            card.addEventListener('click', e => { if (!e.target.closest('.note-star')) openNoteViewer(card.dataset.id); });
            card.querySelector('.note-star').addEventListener('click', e => { e.stopPropagation(); toggleStar(card.dataset.id); });
        });
    }
    container.className = state.view === 'list' ? 'notes-grid list-view' : 'notes-grid';
    updateCounts();
    updateTags();
    $('visible-count').textContent = notes.length + ' note' + (notes.length !== 1 ? 's' : '');
}

function createNoteCard(note) {
    const time = new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const typeIcon = { text: '📄', voice: '🎙️', file: '📎', image: '🖼️' }[note.type] || '📄';
    const typeClass = { text: 'text', voice: 'voice', file: 'file', image: 'file' }[note.type] || 'text';
    let preview = '';
    if (note.type === 'image' && note.mediaData) preview = `<img src="${note.mediaData}" class="note-media-preview" alt="">`;
    else if (note.content) preview = `<p class="note-preview">${escapeHtml(note.content)}</p>`;
    return `
        <div class="note-card ${note.starred ? 'starred' : ''}" data-id="${note.id}">
            <div class="note-card-header">
                <span class="note-type ${typeClass}">${typeIcon} ${note.type}</span>
                <button class="note-star">${note.starred ? '★' : '☆'}</button>
            </div>
            <h3 class="note-title">${escapeHtml(note.title)}</h3>
            ${preview}
            <div class="note-card-footer">
                <div class="note-tags-row">${note.tags.slice(0, 3).map(t => `<span class="note-tag">${t}</span>`).join('')}</div>
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
    state.notes.forEach(n => n.tags.forEach(t => tags.add(t)));
    $('tags-list').innerHTML = Array.from(tags).map(tag => `<button class="tag-chip ${state.tagFilter === tag ? 'active' : ''}" data-tag="${tag}">${tag}</button>`).join('');
    $('tags-list').querySelectorAll('.tag-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            state.tagFilter = state.tagFilter === btn.dataset.tag ? null : btn.dataset.tag;
            document.querySelectorAll('.tag-chip').forEach(b => b.classList.remove('active'));
            if (state.tagFilter) btn.classList.add('active');
            renderNotes();
        });
    });
}

function updateStorage() {
    const data = localStorage.getItem(CONFIG.STORAGE_PREFIX + 'notes_' + state.currentUser) || '';
    const bytes = new Blob([data]).size;
    const kb = (bytes / 1024).toFixed(1);
    const percent = Math.min((bytes / (5 * 1024 * 1024)) * 100, 100).toFixed(0);
    $('storage-percent').textContent = percent + '%';
    $('storage-fill').style.width = percent + '%';
    $('storage-detail').textContent = state.notes.length + ' notes • ' + kb + ' KB';
}

function updateViewTitle() {
    const titles = { all: 'All Notes', text: 'Text Notes', voice: 'Voice Notes', files: 'Files & Images', starred: 'Starred' };
    $('view-title').textContent = titles[state.filter] || 'All Notes';
}

function toggleStar(id) {
    const note = state.notes.find(n => n.id === id);
    if (note) { note.starred = !note.starred; saveUserData(); renderNotes(); }
}

function openNoteEditor(note = null) {
    state.editingNote = note;
    $('note-title').value = note ? note.title : '';
    $('note-content').value = note ? note.content : '';
    $('char-count').textContent = (note ? note.content.length : 0) + ' chars';
    renderEditorTags(note ? note.tags : []);
    $('note-modal').classList.remove('hidden');
    $('note-title').focus();
}

function renderEditorTags(tags) {
    $('editor-tags-list').innerHTML = tags.map(tag => `<span class="editor-tag">${tag}<button onclick="removeEditorTag('${tag}')">×</button></span>`).join('');
    $('editor-tags-list').dataset.tags = JSON.stringify(tags);
}

window.removeEditorTag = function(tag) {
    const tags = JSON.parse($('editor-tags-list').dataset.tags || '[]').filter(t => t !== tag);
    renderEditorTags(tags);
};

function addEditorTag() {
    const input = $('editor-tag-input');
    const tag = input.value.trim().toLowerCase();
    if (tag) {
        const tags = JSON.parse($('editor-tags-list').dataset.tags || '[]');
        if (!tags.includes(tag)) { tags.push(tag); renderEditorTags(tags); }
        input.value = '';
    }
}

function saveNote() {
    const title = $('note-title').value.trim() || 'Untitled';
    const content = $('note-content').value;
    const tags = JSON.parse($('editor-tags-list').dataset.tags || '[]');
    if (state.editingNote) { updateNote(state.editingNote.id, { title, content, tags }); toast('Note updated!', 'success'); }
    else { createNote({ type: 'text', title, content, tags }); }
    $('note-modal').classList.add('hidden');
    state.editingNote = null;
}

function openVoiceRecorder() {
    $('voice-modal').classList.remove('hidden');
    $('recorder-status').textContent = 'Ready to Record';
    $('recorder-time').textContent = '00:00';
    $('recorder-save').disabled = true;
    $('transcript-section').classList.add('hidden');
    $('voice-title').value = '';
    $('voice-transcript').value = '';
}

async function toggleRecording() {
    if (state.recording.active) { stopRecording(); }
    else {
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
                $('recorder-status').textContent = 'Recording Complete';
                $('recorder-save').disabled = false;
                $('transcript-section').classList.remove('hidden');
                $('recorder-toggle').classList.remove('recording');
                $('recorder-toggle').textContent = '🎙️';
            };
            state.recording.mediaRecorder.start();
            state.recording.active = true;
            state.recording.startTime = Date.now();
            $('recorder-status').textContent = 'Recording...';
            $('recorder-toggle').classList.add('recording');
            $('recorder-toggle').textContent = '⏹️';
            updateRecordingTime();
            state.recording.timer = setInterval(updateRecordingTime, 1000);
            visualizeAudio();
        } catch (err) { toast('Cannot access microphone', 'error'); }
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

function cancelRecording() { stopRecording(); state.recording.chunks = []; $('voice-modal').classList.add('hidden'); }

function saveVoiceNote() {
    const blob = new Blob(state.recording.chunks, { type: 'audio/webm' });
    const reader = new FileReader();
    reader.onload = () => {
        createNote({
            type: 'voice',
            title: $('voice-title').value.trim() || `Voice Note ${new Date().toLocaleDateString()}`,
            content: $('voice-transcript').value,
            audioData: reader.result,
            duration: Math.floor((Date.now() - state.recording.startTime) / 1000)
        });
        $('voice-modal').classList.add('hidden');
    };
    reader.readAsDataURL(blob);
}

function updateRecordingTime() {
    const elapsed = Math.floor((Date.now() - state.recording.startTime) / 1000);
    $('recorder-time').textContent = `${Math.floor(elapsed / 60).toString().padStart(2, '0')}:${(elapsed % 60).toString().padStart(2, '0')}`;
}

function visualizeAudio() {
    const canvas = $('audio-canvas');
    const ctx = canvas.getContext('2d');
    const analyser = state.recording.analyser;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    function draw() {
        if (!state.recording.active) return;
        requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);
        ctx.fillStyle = '#18181b';
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

function handleFileUpload(e) {
    Array.from(e.target.files).forEach(file => {
        if (file.size > CONFIG.MAX_FILE_SIZE) { toast(`${file.name} too large`, 'error'); return; }
        createNote({ type: 'file', title: file.name, content: `File: ${file.name}\nSize: ${(file.size / 1024).toFixed(1)} KB`, fileName: file.name, fileSize: file.size });
    });
    e.target.value = '';
}

function handleImageUpload(e) {
    Array.from(e.target.files).forEach(file => {
        if (file.size > CONFIG.MAX_FILE_SIZE) { toast(`${file.name} too large`, 'error'); return; }
        const reader = new FileReader();
        reader.onload = () => { createNote({ type: 'image', title: file.name, content: '', mediaData: reader.result, fileName: file.name }); };
        reader.readAsDataURL(file);
    });
    e.target.value = '';
}

function openNoteViewer(id) {
    const note = state.notes.find(n => n.id === id);
    if (!note) return;
    state.editingNote = note;
    $('viewer-type').textContent = note.type.charAt(0).toUpperCase() + note.type.slice(1);
    $('viewer-date').textContent = new Date(note.createdAt).toLocaleString();
    $('viewer-title').textContent = note.title;
    $('viewer-content').textContent = note.content || '';
    $('viewer-star').textContent = note.starred ? '★' : '☆';
    $('viewer-star').style.color = note.starred ? 'var(--warning)' : '';
    $('viewer-media').classList.add('hidden');
    $('viewer-audio').classList.add('hidden');
    if (note.type === 'image' && note.mediaData) { $('viewer-media').innerHTML = `<img src="${note.mediaData}" alt="">`; $('viewer-media').classList.remove('hidden'); }
    if (note.type === 'voice' && note.audioData) { $('audio-player').src = note.audioData; $('viewer-audio').classList.remove('hidden'); }
    $('viewer-tags').innerHTML = note.tags.map(t => `<span class="note-tag">${t}</span>`).join('');
    $('view-modal').classList.remove('hidden');
}

function toggleViewerStar() { if (state.editingNote) { toggleStar(state.editingNote.id); $('viewer-star').textContent = state.editingNote.starred ? '★' : '☆'; $('viewer-star').style.color = state.editingNote.starred ? 'var(--warning)' : ''; } }
function editViewerNote() { if (state.editingNote && state.editingNote.type === 'text') { $('view-modal').classList.add('hidden'); openNoteEditor(state.editingNote); } else { toast('Only text notes can be edited'); } }
function deleteViewerNote() { if (state.editingNote && confirm('Delete this note?')) { deleteNote(state.editingNote.id); $('view-modal').classList.add('hidden'); } }

function toggleAI() { closeAllPanels(); $('ai-panel').classList.toggle('hidden'); }
function sendAIMessage() {
    const input = $('ai-input');
    const message = input.value.trim();
    if (!message) return;
    addAIMessage(message, 'user');
    input.value = '';
    const welcome = $('ai-messages').querySelector('.ai-welcome');
    if (welcome) welcome.remove();
    setTimeout(() => { addAIMessage(processAIQuery(message), 'assistant'); }, 500);
}
function addAIMessage(text, role) {
    const div = document.createElement('div');
    div.className = `ai-message ${role}`;
    div.textContent = text;
    $('ai-messages').appendChild(div);
    $('ai-messages').scrollTop = $('ai-messages').scrollHeight;
}
function processAIQuery(query) {
    const q = query.toLowerCase();
    if (q.includes('find') || q.includes('search') || q.includes('look')) {
        const words = q.split(/\s+/).filter(w => w.length > 3 && !['find', 'search', 'look', 'notes', 'about', 'the'].includes(w));
        const matches = state.notes.filter(n => words.some(w => n.title.toLowerCase().includes(w) || (n.content && n.content.toLowerCase().includes(w))));
        if (matches.length > 0) return `Found ${matches.length} note(s):\n\n${matches.slice(0, 5).map(n => `• "${n.title}"`).join('\n')}`;
        return "No notes found.";
    }
    if (q.includes('summarize') || q.includes('summary')) return `You have ${state.notes.length} notes:\n• ${state.notes.filter(n => n.type === 'text').length} text\n• ${state.notes.filter(n => n.type === 'voice').length} voice\n• ${state.notes.filter(n => n.type === 'image' || n.type === 'file').length} files\n• ${state.notes.filter(n => n.starred).length} starred`;
    if (q.includes('what did i') || q.includes('recent')) {
        const recent = state.notes.slice(0, 5);
        if (recent.length === 0) return "No notes yet.";
        return `Recent notes:\n\n${recent.map(n => `• "${n.title}" (${n.type})`).join('\n')}`;
    }
    return "Try:\n• \"Find notes about...\"\n• \"Summarize my notes\"\n• \"What did I write?\"";
}

function applyTheme() {
    const theme = localStorage.getItem(CONFIG.STORAGE_PREFIX + 'theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    if ($('theme-select')) $('theme-select').value = theme;
}
function exportNotes() {
    const data = { exportDate: new Date().toISOString(), username: state.currentUser, notes: state.notes };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `dave-notes-${state.currentUser}-${new Date().toISOString().split('T')[0]}.json`;
    a.click(); toast('Exported!', 'success');
}
function importNotes(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const data = JSON.parse(reader.result);
            if (data.notes) { state.notes = [...data.notes, ...state.notes]; saveUserData(); renderNotes(); toast(`Imported ${data.notes.length} notes!`, 'success'); }
        } catch { toast('Invalid file', 'error'); }
    };
    reader.readAsText(file); e.target.value = '';
}
function clearUserData() { if (confirm('Delete ALL your notes?')) { state.notes = []; saveUserData(); renderNotes(); toast('Data cleared'); } }

function loadAnalytics() {
    const users = getUsers();
    const userList = Object.keys(users);
    let totalNotes = 0, totalVoice = 0, totalFiles = 0;
    userList.forEach(username => {
        const data = localStorage.getItem(CONFIG.STORAGE_PREFIX + 'notes_' + username);
        const notes = data ? JSON.parse(data) : [];
        totalNotes += notes.length;
        totalVoice += notes.filter(n => n.type === 'voice').length;
        totalFiles += notes.filter(n => n.type === 'file' || n.type === 'image').length;
    });
    $('stat-users').textContent = userList.length;
    $('stat-notes').textContent = totalNotes;
    $('stat-voice').textContent = totalVoice;
    $('stat-files').textContent = totalFiles;
    $('user-list').innerHTML = userList.map(username => {
        const data = localStorage.getItem(CONFIG.STORAGE_PREFIX + 'notes_' + username);
        const notes = data ? JSON.parse(data) : [];
        const user = users[username];
        return `<div class="user-item"><div class="user-avatar">${username.charAt(0).toUpperCase()}</div><div class="user-item-info"><div class="user-item-name">${username}${user.isAdmin ? ' (Admin)' : ''}</div><div class="user-item-stats">${notes.length} notes</div></div></div>`;
    }).join('');
    const activity = JSON.parse(localStorage.getItem(CONFIG.STORAGE_PREFIX + 'activity') || '[]');
    $('activity-log').innerHTML = activity.slice(0, 20).map(item => `<div class="activity-item"><strong>${item.username}</strong> ${item.action}<span class="activity-time">${new Date(item.time).toLocaleString()}</span></div>`).join('');
}

function toggleSidebar() { $('sidebar').classList.toggle('collapsed'); }
function closeFab() { $('fab-container').classList.remove('open'); }
function closeAllModals() { $('note-modal').classList.add('hidden'); $('voice-modal').classList.add('hidden'); $('view-modal').classList.add('hidden'); }
function closeAllPanels() { $('ai-panel').classList.add('hidden'); $('settings-panel').classList.add('hidden'); $('analytics-panel').classList.add('hidden'); }
function escapeHtml(text) { const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }
function debounce(fn, delay) { let timeout; return (...args) => { clearTimeout(timeout); timeout = setTimeout(() => fn(...args), delay); }; }
function toast(message, type = 'success') { const div = document.createElement('div'); div.className = `toast ${type}`; div.textContent = message; $('toast-container').appendChild(div); setTimeout(() => div.remove(), 3000); }
