// ====================================
// VOICE NOTES - Application Logic
// ====================================

// Configuration
const CONFIG = {
    // Change this to your own password
    ACCESS_CODE: 'voicenotes2024',
    
    // API endpoints (update these when you deploy Lambda functions)
    API_BASE_URL: 'https://YOUR-API-ID.execute-api.us-east-2.amazonaws.com',
    
    // Local storage keys
    STORAGE_KEYS: {
        NOTES: 'voicenotes_notes',
        SETTINGS: 'voicenotes_settings',
        AUTH: 'voicenotes_auth'
    },
    
    // Settings defaults
    DEFAULTS: {
        theme: 'dark',
        autoTranscribe: true,
        soundEffects: true
    }
};

// ====================================
// State Management
// ====================================

const state = {
    notes: [],
    currentFilter: 'all',
    currentTag: null,
    currentView: 'grid',
    currentSort: 'newest',
    searchQuery: '',
    isRecording: false,
    currentNote: null,
    settings: { ...CONFIG.DEFAULTS },
    mediaRecorder: null,
    audioChunks: [],
    recordingStartTime: null,
    recordingTimer: null,
    audioContext: null,
    analyser: null
};

// ====================================
// DOM Elements
// ====================================

const elements = {};

function cacheElements() {
    // Auth
    elements.authGate = document.getElementById('auth-gate');
    elements.authForm = document.getElementById('auth-form');
    elements.authPassword = document.getElementById('auth-password');
    elements.authError = document.getElementById('auth-error');
    
    // App
    elements.app = document.getElementById('app');
    
    // Header
    elements.menuToggle = document.getElementById('menu-toggle');
    elements.searchInput = document.getElementById('search-input');
    elements.aiAssistantBtn = document.getElementById('ai-assistant-btn');
    elements.settingsBtn = document.getElementById('settings-btn');
    
    // Sidebar
    elements.sidebar = document.getElementById('sidebar');
    elements.tagsList = document.getElementById('tags-list');
    
    // Counts
    elements.countAll = document.getElementById('count-all');
    elements.countToday = document.getElementById('count-today');
    elements.countWeek = document.getElementById('count-week');
    elements.countStarred = document.getElementById('count-starred');
    elements.totalNotes = document.getElementById('total-notes');
    elements.totalDuration = document.getElementById('total-duration');
    
    // Notes area
    elements.notesContainer = document.getElementById('notes-container');
    elements.emptyState = document.getElementById('empty-state');
    elements.sortSelect = document.getElementById('sort-select');
    
    // Record
    elements.recordBtn = document.getElementById('record-btn');
    
    // Recording Modal
    elements.recordingModal = document.getElementById('recording-modal');
    elements.recordingTime = document.getElementById('recording-time');
    elements.audioVisualizer = document.getElementById('audio-visualizer');
    elements.cancelRecording = document.getElementById('cancel-recording');
    elements.stopRecording = document.getElementById('stop-recording');
    
    // Note Modal
    elements.noteModal = document.getElementById('note-modal');
    elements.closeNoteModal = document.getElementById('close-note-modal');
    elements.starNote = document.getElementById('star-note');
    elements.editNote = document.getElementById('edit-note');
    elements.deleteNote = document.getElementById('delete-note');
    elements.noteDate = document.getElementById('note-date');
    elements.noteDuration = document.getElementById('note-duration');
    elements.noteTranscript = document.getElementById('note-transcript');
    elements.noteTags = document.getElementById('note-tags');
    elements.addTagInput = document.getElementById('add-tag-input');
    elements.addTagBtn = document.getElementById('add-tag-btn');
    
    // AI Panel
    elements.aiPanel = document.getElementById('ai-panel');
    elements.closeAiPanel = document.getElementById('close-ai-panel');
    elements.aiChat = document.getElementById('ai-chat');
    elements.aiInput = document.getElementById('ai-input');
    elements.aiSend = document.getElementById('ai-send');
    
    // Settings Panel
    elements.settingsPanel = document.getElementById('settings-panel');
    elements.closeSettings = document.getElementById('close-settings');
    elements.themeSelect = document.getElementById('theme-select');
    elements.autoTranscribe = document.getElementById('auto-transcribe');
    elements.soundEffects = document.getElementById('sound-effects');
    elements.exportAll = document.getElementById('export-all');
    elements.clearAll = document.getElementById('clear-all');
    elements.logoutBtn = document.getElementById('logout-btn');
    
    // Toast
    elements.toastContainer = document.getElementById('toast-container');
}

// ====================================
// Initialization
// ====================================

function init() {
    cacheElements();
    loadSettings();
    applyTheme();
    
    if (isAuthenticated()) {
        showApp();
        loadNotes();
    }
    
    setupEventListeners();
}

function isAuthenticated() {
    return localStorage.getItem(CONFIG.STORAGE_KEYS.AUTH) === 'true';
}

function showApp() {
    elements.authGate.classList.add('hidden');
    elements.app.classList.remove('hidden');
}

// ====================================
// Event Listeners
// ====================================

function setupEventListeners() {
    elements.authForm.addEventListener('submit', handleAuth);
    elements.menuToggle.addEventListener('click', toggleSidebar);
    elements.searchInput.addEventListener('input', debounce(handleSearch, 300));
    elements.aiAssistantBtn.addEventListener('click', toggleAiPanel);
    elements.settingsBtn.addEventListener('click', toggleSettings);
    
    document.addEventListener('keydown', handleKeyboard);
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => handleFilterChange(item.dataset.filter));
    });
    
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => handleViewChange(btn.dataset.view));
    });
    
    elements.sortSelect.addEventListener('change', handleSortChange);
    elements.recordBtn.addEventListener('click', startRecording);
    elements.cancelRecording.addEventListener('click', cancelRecording);
    elements.stopRecording.addEventListener('click', stopRecording);
    
    elements.closeNoteModal.addEventListener('click', closeNoteModal);
    elements.starNote.addEventListener('click', toggleNoteStar);
    elements.editNote.addEventListener('click', editCurrentNote);
    elements.deleteNote.addEventListener('click', deleteCurrentNote);
    elements.addTagBtn.addEventListener('click', addTagToNote);
    elements.addTagInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTagToNote();
    });
    
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', closeAllModals);
    });
    
    elements.closeAiPanel.addEventListener('click', toggleAiPanel);
    elements.aiSend.addEventListener('click', sendAiMessage);
    elements.aiInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendAiMessage();
    });
    
    document.querySelectorAll('.ai-suggestion').forEach(btn => {
        btn.addEventListener('click', () => {
            elements.aiInput.value = btn.textContent.replace(/"/g, '');
            sendAiMessage();
        });
    });
    
    elements.closeSettings.addEventListener('click', toggleSettings);
    elements.themeSelect.addEventListener('change', handleThemeChange);
    elements.autoTranscribe.addEventListener('change', saveSettings);
    elements.soundEffects.addEventListener('change', saveSettings);
    elements.exportAll.addEventListener('click', exportAllNotes);
    elements.clearAll.addEventListener('click', clearAllData);
    elements.logoutBtn.addEventListener('click', logout);
}

// ====================================
// Authentication
// ====================================

function handleAuth(e) {
    e.preventDefault();
    const password = elements.authPassword.value;
    
    if (password === CONFIG.ACCESS_CODE) {
        localStorage.setItem(CONFIG.STORAGE_KEYS.AUTH, 'true');
        showApp();
        loadNotes();
        showToast('Welcome back!', 'success');
    } else {
        elements.authError.textContent = 'Invalid access code';
        elements.authPassword.value = '';
        elements.authPassword.focus();
    }
}

function logout() {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.AUTH);
    location.reload();
}

// ====================================
// Notes CRUD
// ====================================

function loadNotes() {
    const stored = localStorage.getItem(CONFIG.STORAGE_KEYS.NOTES);
    state.notes = stored ? JSON.parse(stored) : [];
    updateUI();
}

function saveNotes() {
    localStorage.setItem(CONFIG.STORAGE_KEYS.NOTES, JSON.stringify(state.notes));
}

function createNote(transcript, duration) {
    const note = {
        id: generateId(),
        transcript: transcript,
        duration: duration,
        createdAt: new Date().toISOString(),
        tags: [],
        starred: false
    };
    
    state.notes.unshift(note);
    saveNotes();
    updateUI();
    showToast('Note saved!', 'success');
    return note;
}

function updateNote(id, updates) {
    const index = state.notes.findIndex(n => n.id === id);
    if (index !== -1) {
        state.notes[index] = { ...state.notes[index], ...updates };
        saveNotes();
        updateUI();
    }
}

function deleteNoteById(id) {
    state.notes = state.notes.filter(n => n.id !== id);
    saveNotes();
    updateUI();
    showToast('Note deleted', 'success');
}

// ====================================
// Recording
// ====================================

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        state.audioChunks = [];
        state.mediaRecorder = new MediaRecorder(stream);
        
        state.audioContext = new AudioContext();
        state.analyser = state.audioContext.createAnalyser();
        const source = state.audioContext.createMediaStreamSource(stream);
        source.connect(state.analyser);
        state.analyser.fftSize = 256;
        
        state.mediaRecorder.ondataavailable = (e) => {
            state.audioChunks.push(e.data);
        };
        
        state.mediaRecorder.onstop = handleRecordingComplete;
        
        state.mediaRecorder.start();
        state.isRecording = true;
        state.recordingStartTime = Date.now();
        
        elements.recordBtn.classList.add('recording');
        elements.recordingModal.classList.remove('hidden');
        
        updateRecordingTime();
        state.recordingTimer = setInterval(updateRecordingTime, 1000);
        visualizeAudio();
        
        if (state.settings.soundEffects) playSound('start');
        
    } catch (err) {
        console.error('Microphone error:', err);
        showToast('Unable to access microphone', 'error');
    }
}

function stopRecording() {
    if (state.mediaRecorder && state.isRecording) {
        state.mediaRecorder.stop();
        state.mediaRecorder.stream.getTracks().forEach(track => track.stop());
        clearInterval(state.recordingTimer);
        state.isRecording = false;
        elements.recordBtn.classList.remove('recording');
        elements.recordingModal.classList.add('hidden');
        if (state.settings.soundEffects) playSound('stop');
    }
}

function cancelRecording() {
    if (state.mediaRecorder && state.isRecording) {
        state.mediaRecorder.stop();
        state.mediaRecorder.stream.getTracks().forEach(track => track.stop());
        clearInterval(state.recordingTimer);
        state.isRecording = false;
        state.audioChunks = [];
        elements.recordBtn.classList.remove('recording');
        elements.recordingModal.classList.add('hidden');
    }
}

async function handleRecordingComplete() {
    const duration = Math.floor((Date.now() - state.recordingStartTime) / 1000);
    
    if (state.audioContext) state.audioContext.close();
    
    let transcript = '';
    
    if (state.settings.autoTranscribe && state.audioChunks.length > 0) {
        showToast('Processing...', 'success');
        // For now, prompt for manual entry since browser transcription is limited
        transcript = prompt('Enter your note:') || '';
    }
    
    if (!transcript) {
        transcript = prompt('Enter your note:') || 'Voice note';
    }
    
    if (transcript.trim()) {
        createNote(transcript.trim(), duration);
    }
}

function updateRecordingTime() {
    const elapsed = Math.floor((Date.now() - state.recordingStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const seconds = (elapsed % 60).toString().padStart(2, '0');
    elements.recordingTime.textContent = `${minutes}:${seconds}`;
}

function visualizeAudio() {
    const canvas = elements.audioVisualizer;
    const ctx = canvas.getContext('2d');
    const bufferLength = state.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    
    function draw() {
        if (!state.isRecording) return;
        requestAnimationFrame(draw);
        
        state.analyser.getByteFrequencyData(dataArray);
        
        ctx.fillStyle = '#1a1a1d';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const barWidth = (canvas.width / bufferLength) * 2.5;
        let x = 0;
        
        for (let i = 0; i < bufferLength; i++) {
            const barHeight = (dataArray[i] / 255) * canvas.height;
            const hue = 240 + (i / bufferLength) * 60;
            ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;
            ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
            x += barWidth + 1;
        }
    }
    draw();
}

// ====================================
// UI Updates
// ====================================

function updateUI() {
    updateCounts();
    updateTagsList();
    renderNotes();
    updateStats();
}

function updateCounts() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    elements.countAll.textContent = state.notes.length;
    elements.countToday.textContent = state.notes.filter(n => new Date(n.createdAt) >= today).length;
    elements.countWeek.textContent = state.notes.filter(n => new Date(n.createdAt) >= weekAgo).length;
    elements.countStarred.textContent = state.notes.filter(n => n.starred).length;
}

function updateTagsList() {
    const allTags = new Set();
    state.notes.forEach(note => note.tags.forEach(tag => allTags.add(tag)));
    
    elements.tagsList.innerHTML = Array.from(allTags).map(tag => `
        <button class="tag-btn ${state.currentTag === tag ? 'active' : ''}" data-tag="${tag}">${tag}</button>
    `).join('');
    
    elements.tagsList.querySelectorAll('.tag-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.currentTag = state.currentTag === btn.dataset.tag ? null : btn.dataset.tag;
            updateUI();
        });
    });
}

function updateStats() {
    elements.totalNotes.textContent = state.notes.length;
    const totalSeconds = state.notes.reduce((sum, note) => sum + (note.duration || 0), 0);
    elements.totalDuration.textContent = `${Math.floor(totalSeconds / 60)}m`;
}

function renderNotes() {
    let filtered = getFilteredNotes();
    
    if (state.searchQuery) {
        const query = state.searchQuery.toLowerCase();
        filtered = filtered.filter(note => 
            note.transcript.toLowerCase().includes(query) ||
            note.tags.some(tag => tag.toLowerCase().includes(query))
        );
    }
    
    filtered = sortNotes(filtered);
    
    if (filtered.length === 0) {
        elements.notesContainer.innerHTML = '';
        elements.emptyState.classList.remove('hidden');
    } else {
        elements.emptyState.classList.add('hidden');
        elements.notesContainer.innerHTML = filtered.map(note => createNoteCard(note)).join('');
        
        elements.notesContainer.querySelectorAll('.note-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.note-star')) openNoteModal(card.dataset.id);
            });
            card.querySelector('.note-star').addEventListener('click', (e) => {
                e.stopPropagation();
                toggleStar(card.dataset.id);
            });
        });
    }
    
    elements.notesContainer.className = state.currentView === 'list' ? 'notes-grid list-view' : 'notes-grid';
}

function createNoteCard(note) {
    const date = new Date(note.createdAt);
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const durationStr = note.duration ? `${Math.floor(note.duration / 60)}:${(note.duration % 60).toString().padStart(2, '0')}` : '';
    
    return `
        <div class="note-card ${note.starred ? 'starred' : ''}" data-id="${note.id}">
            <div class="note-card-header">
                <span class="note-time">${timeStr}</span>
                <button class="note-star" title="Star">
                    <svg viewBox="0 0 24 24" fill="${note.starred ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                        <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
                    </svg>
                </button>
            </div>
            <div class="note-content">${escapeHtml(note.transcript)}</div>
            <div class="note-card-footer">
                <div class="note-tags-preview">
                    ${note.tags.slice(0, 3).map(tag => `<span class="note-tag">${tag}</span>`).join('')}
                </div>
                <span class="note-duration">${durationStr}</span>
            </div>
        </div>
    `;
}

function getFilteredNotes() {
    let notes = [...state.notes];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    switch (state.currentFilter) {
        case 'today': notes = notes.filter(n => new Date(n.createdAt) >= today); break;
        case 'week': notes = notes.filter(n => new Date(n.createdAt) >= weekAgo); break;
        case 'starred': notes = notes.filter(n => n.starred); break;
    }
    
    if (state.currentTag) notes = notes.filter(n => n.tags.includes(state.currentTag));
    return notes;
}

function sortNotes(notes) {
    switch (state.currentSort) {
        case 'newest': return notes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        case 'oldest': return notes.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        case 'az': return notes.sort((a, b) => a.transcript.localeCompare(b.transcript));
        case 'za': return notes.sort((a, b) => b.transcript.localeCompare(a.transcript));
        default: return notes;
    }
}

// ====================================
// Event Handlers
// ====================================

function handleFilterChange(filter) {
    state.currentFilter = filter;
    state.currentTag = null;
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.filter === filter);
    });
    updateUI();
}

function handleViewChange(view) {
    state.currentView = view;
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });
    renderNotes();
}

function handleSortChange(e) {
    state.currentSort = e.target.value;
    renderNotes();
}

function handleSearch(e) {
    state.searchQuery = e.target.value;
    renderNotes();
}

function handleKeyboard(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        elements.searchInput.focus();
    }
    if (e.key === 'Escape') closeAllModals();
}

function toggleSidebar() { elements.sidebar.classList.toggle('open'); }
function toggleAiPanel() { 
    elements.aiPanel.classList.toggle('hidden'); 
    elements.settingsPanel.classList.add('hidden'); 
}
function toggleSettings() { 
    elements.settingsPanel.classList.toggle('hidden'); 
    elements.aiPanel.classList.add('hidden'); 
}
function closeAllModals() {
    elements.recordingModal.classList.add('hidden');
    elements.noteModal.classList.add('hidden');
    elements.aiPanel.classList.add('hidden');
    elements.settingsPanel.classList.add('hidden');
}

// ====================================
// Note Modal
// ====================================

function openNoteModal(id) {
    const note = state.notes.find(n => n.id === id);
    if (!note) return;
    
    state.currentNote = note;
    
    elements.noteDate.textContent = formatDateTime(new Date(note.createdAt));
    elements.noteDuration.textContent = note.duration ? `${Math.floor(note.duration / 60)}:${(note.duration % 60).toString().padStart(2, '0')}` : '';
    elements.noteTranscript.textContent = note.transcript;
    
    elements.starNote.innerHTML = `
        <svg viewBox="0 0 24 24" fill="${note.starred ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
            <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
        </svg>
    `;
    elements.starNote.style.color = note.starred ? 'var(--warning)' : '';
    
    renderNoteTags();
    elements.noteModal.classList.remove('hidden');
}

function closeNoteModal() {
    elements.noteModal.classList.add('hidden');
    state.currentNote = null;
}

function renderNoteTags() {
    if (!state.currentNote) return;
    elements.noteTags.innerHTML = state.currentNote.tags.map(tag => `
        <span class="note-tag-item">${tag}
            <button onclick="removeTagFromNote('${tag}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        </span>
    `).join('');
}

function toggleStar(id) {
    const note = state.notes.find(n => n.id === id);
    if (note) updateNote(id, { starred: !note.starred });
}

function toggleNoteStar() {
    if (state.currentNote) {
        toggleStar(state.currentNote.id);
        state.currentNote.starred = !state.currentNote.starred;
        elements.starNote.innerHTML = `
            <svg viewBox="0 0 24 24" fill="${state.currentNote.starred ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
            </svg>
        `;
        elements.starNote.style.color = state.currentNote.starred ? 'var(--warning)' : '';
    }
}

function editCurrentNote() {
    if (!state.currentNote) return;
    const newTranscript = prompt('Edit note:', state.currentNote.transcript);
    if (newTranscript !== null && newTranscript.trim()) {
        updateNote(state.currentNote.id, { transcript: newTranscript.trim() });
        state.currentNote.transcript = newTranscript.trim();
        elements.noteTranscript.textContent = newTranscript.trim();
        showToast('Note updated', 'success');
    }
}

function deleteCurrentNote() {
    if (!state.currentNote) return;
    if (confirm('Delete this note?')) {
        deleteNoteById(state.currentNote.id);
        closeNoteModal();
    }
}

function addTagToNote() {
    if (!state.currentNote) return;
    const tag = elements.addTagInput.value.trim().toLowerCase();
    if (tag && !state.currentNote.tags.includes(tag)) {
        const newTags = [...state.currentNote.tags, tag];
        updateNote(state.currentNote.id, { tags: newTags });
        state.currentNote.tags = newTags;
        renderNoteTags();
        elements.addTagInput.value = '';
    }
}

window.removeTagFromNote = function(tag) {
    if (!state.currentNote) return;
    const newTags = state.currentNote.tags.filter(t => t !== tag);
    updateNote(state.currentNote.id, { tags: newTags });
    state.currentNote.tags = newTags;
    renderNoteTags();
};

// ====================================
// AI Assistant
// ====================================

function sendAiMessage() {
    const message = elements.aiInput.value.trim();
    if (!message) return;
    
    addAiMessage(message, 'user');
    elements.aiInput.value = '';
    
    const welcome = elements.aiChat.querySelector('.ai-welcome');
    if (welcome) welcome.remove();
    
    const response = processAiQuery(message);
    setTimeout(() => addAiMessage(response, 'assistant'), 500);
}

function addAiMessage(text, role) {
    const div = document.createElement('div');
    div.className = `ai-message ${role}`;
    div.textContent = text;
    elements.aiChat.appendChild(div);
    elements.aiChat.scrollTop = elements.aiChat.scrollHeight;
}

function processAiQuery(query) {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('find') || lowerQuery.includes('search') || lowerQuery.includes('look')) {
        const keywords = extractKeywords(query);
        const matches = state.notes.filter(note => 
            keywords.some(kw => note.transcript.toLowerCase().includes(kw))
        );
        
        if (matches.length > 0) {
            return `Found ${matches.length} note(s):\n\n${matches.slice(0, 3).map(n => 
                `• "${n.transcript.substring(0, 80)}${n.transcript.length > 80 ? '...' : ''}"`
            ).join('\n')}${matches.length > 3 ? `\n\n...and ${matches.length - 3} more.` : ''}`;
        }
        return "No notes found matching your search.";
    }
    
    if (lowerQuery.includes('summarize') || lowerQuery.includes('summary')) {
        if (lowerQuery.includes('today')) {
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const todayNotes = state.notes.filter(n => new Date(n.createdAt) >= today);
            if (todayNotes.length === 0) return "No notes recorded today.";
            return `Today: ${todayNotes.length} note(s):\n\n${todayNotes.map(n => `• ${n.transcript.substring(0, 60)}...`).join('\n')}`;
        }
        return `Total: ${state.notes.length} notes. ${state.notes.filter(n => n.starred).length} starred. Tags: ${getMostCommonTags(3).join(', ') || 'none'}.`;
    }
    
    if (lowerQuery.includes('what did i') || lowerQuery.includes('did i mention')) {
        const keywords = extractKeywords(query);
        const matches = state.notes.filter(note => 
            keywords.some(kw => note.transcript.toLowerCase().includes(kw))
        );
        if (matches.length > 0) return `Found:\n\n${matches.slice(0, 3).map(n => `"${n.transcript}"`).join('\n\n')}`;
        return "Couldn't find notes about that.";
    }
    
    return `I can help search your notes. Try:\n\n• "Find notes about work"\n• "Summarize today"\n• "What did I say about the project?"`;
}

function extractKeywords(query) {
    const stopWords = ['find', 'search', 'look', 'up', 'notes', 'about', 'the', 'a', 'an', 'my', 'me', 'i', 'what', 'did', 'say', 'mention'];
    return query.toLowerCase().split(/\s+/).filter(word => word.length > 2 && !stopWords.includes(word));
}

function getMostCommonTags(limit) {
    const tagCounts = {};
    state.notes.forEach(note => note.tags.forEach(tag => { tagCounts[tag] = (tagCounts[tag] || 0) + 1; }));
    return Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([tag]) => tag);
}

// ====================================
// Settings
// ====================================

function loadSettings() {
    const stored = localStorage.getItem(CONFIG.STORAGE_KEYS.SETTINGS);
    if (stored) state.settings = { ...CONFIG.DEFAULTS, ...JSON.parse(stored) };
}

function saveSettings() {
    state.settings = {
        theme: elements.themeSelect.value,
        autoTranscribe: elements.autoTranscribe.checked,
        soundEffects: elements.soundEffects.checked
    };
    localStorage.setItem(CONFIG.STORAGE_KEYS.SETTINGS, JSON.stringify(state.settings));
}

function handleThemeChange() { saveSettings(); applyTheme(); }

function applyTheme() {
    const theme = state.settings.theme;
    if (theme === 'auto') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
        document.documentElement.setAttribute('data-theme', theme);
    }
    if (elements.themeSelect) elements.themeSelect.value = theme;
    if (elements.autoTranscribe) elements.autoTranscribe.checked = state.settings.autoTranscribe;
    if (elements.soundEffects) elements.soundEffects.checked = state.settings.soundEffects;
}

// ====================================
// Export & Clear
// ====================================

function exportAllNotes() {
    const data = { exportDate: new Date().toISOString(), notes: state.notes };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voice-notes-export-${formatDate(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Notes exported!', 'success');
}

function clearAllData() {
    if (confirm('Delete ALL notes? This cannot be undone.')) {
        state.notes = [];
        saveNotes();
        updateUI();
        showToast('All data cleared', 'success');
    }
}

// ====================================
// Utilities
// ====================================

function generateId() { return Date.now().toString(36) + Math.random().toString(36).substr(2); }

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(date) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateTime(date) {
    return date.toLocaleDateString('en-US', { 
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}

function debounce(fn, delay) {
    let timeout;
    return (...args) => { clearTimeout(timeout); timeout = setTimeout(() => fn(...args), delay); };
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    elements.toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function playSound(type) {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.frequency.value = type === 'start' ? 800 : 600;
    gainNode.gain.value = 0.1;
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.1);
}

// Initialize
document.addEventListener('DOMContentLoaded', init);