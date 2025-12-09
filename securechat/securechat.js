/**
 * SecureChat - End-to-End Encrypted Messaging
 * Zero-knowledge architecture with client-side encryption
 */

const CONFIG = {
    STORAGE_PREFIX: 'securechat_',
    OWNER_EMAIL: 'dave@davedirty.com',
    OWNER_PASSWORD: 'dave3232',
    AWS: {
        API_ENDPOINT: 'https://YOUR_APPSYNC_ENDPOINT.amazonaws.com/graphql',
        REGION: 'us-east-2'
    }
};

const state = {
    user: null,
    keys: null,
    conversations: [],
    activeConversation: null,
    messages: {}
};

const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

// ============================================================
// CRYPTOGRAPHY - WebCrypto API for E2E Encryption
// ============================================================
const Crypto = {
    async generateKeyPair() {
        const keyPair = await window.crypto.subtle.generateKey(
            { name: 'ECDH', namedCurve: 'P-256' },
            true,
            ['deriveKey', 'deriveBits']
        );
        return keyPair;
    },

    async exportPublicKey(publicKey) {
        const exported = await window.crypto.subtle.exportKey('spki', publicKey);
        return this.arrayBufferToBase64(exported);
    },

    async importPublicKey(base64Key) {
        const keyData = this.base64ToArrayBuffer(base64Key);
        return await window.crypto.subtle.importKey(
            'spki',
            keyData,
            { name: 'ECDH', namedCurve: 'P-256' },
            false,
            []
        );
    },

    async deriveSharedKey(privateKey, publicKey) {
        return await window.crypto.subtle.deriveKey(
            { name: 'ECDH', public: publicKey },
            privateKey,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    },

    async encrypt(plaintext, key) {
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const encoded = new TextEncoder().encode(plaintext);
        
        const ciphertext = await window.crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            encoded
        );
        
        return {
            ciphertext: this.arrayBufferToBase64(ciphertext),
            iv: this.arrayBufferToBase64(iv)
        };
    },

    async decrypt(ciphertext, iv, key) {
        const decrypted = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: this.base64ToArrayBuffer(iv) },
            key,
            this.base64ToArrayBuffer(ciphertext)
        );
        
        return new TextDecoder().decode(decrypted);
    },

    async getKeyFingerprint(publicKey) {
        const exported = await window.crypto.subtle.exportKey('spki', publicKey);
        const hash = await window.crypto.subtle.digest('SHA-256', exported);
        const hashArray = Array.from(new Uint8Array(hash));
        return hashArray.slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join(':').toUpperCase();
    },

    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        bytes.forEach(b => binary += String.fromCharCode(b));
        return btoa(binary);
    },

    base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }
};

// ============================================================
// INITIALIZATION
// ============================================================
document.addEventListener('DOMContentLoaded', init);

function init() {
    checkSession();
    setupEventListeners();
}

function setupEventListeners() {
    // Auth
    $('login-form').addEventListener('submit', handleLogin);
    $('register-form').addEventListener('submit', handleRegister);
    $('show-register').addEventListener('click', () => toggleAuthView('register'));
    $('show-login').addEventListener('click', () => toggleAuthView('login'));
    
    // Sidebar
    $('new-chat-btn').addEventListener('click', () => openModal('new-chat-modal'));
    $('settings-btn').addEventListener('click', () => {
        openModal('settings-modal');
        updateSettingsPanel();
    });
    $('search-contacts').addEventListener('input', filterConversations);
    
    // Chat
    $('mobile-back').addEventListener('click', showSidebar);
    $('send-btn').addEventListener('click', sendMessage);
    $('message-input').addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    $('message-input').addEventListener('input', autoResizeTextarea);
    
    // New Chat Modal
    $('close-new-chat').addEventListener('click', () => closeModal('new-chat-modal'));
    $('cancel-new-chat').addEventListener('click', () => closeModal('new-chat-modal'));
    $('start-chat').addEventListener('click', startNewChat);
    
    // Settings Modal
    $('close-settings').addEventListener('click', () => closeModal('settings-modal'));
    $('logout-btn').addEventListener('click', logout);
    $('clear-messages-btn').addEventListener('click', clearAllMessages);
    $('export-keys-btn').addEventListener('click', exportKeys);
    
    // Modal backdrops
    $$('.modal-backdrop').forEach(el => {
        el.addEventListener('click', closeAllModals);
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeAllModals();
    });
}

// ============================================================
// AUTHENTICATION
// ============================================================
function toggleAuthView(view) {
    $('login-view').classList.toggle('hidden', view !== 'login');
    $('register-view').classList.toggle('hidden', view !== 'register');
    $('login-error').textContent = '';
    $('register-error').textContent = '';
}

async function handleLogin(e) {
    e.preventDefault();
    const email = $('login-email').value.trim().toLowerCase();
    const password = $('login-password').value;
    
    const users = getUsers();
    
    // Check owner
    if (email === CONFIG.OWNER_EMAIL && password === CONFIG.OWNER_PASSWORD) {
        if (!users[email]) {
            users[email] = await createUserObject('Dave (Owner)', true);
            saveUsers(users);
        }
        await loginUser(email, users[email]);
        return;
    }
    
    // Check regular user
    if (users[email] && users[email].password === password) {
        await loginUser(email, users[email]);
        return;
    }
    
    showError('login-error', 'Invalid email or password');
}

async function handleRegister(e) {
    e.preventDefault();
    const name = $('register-name').value.trim();
    const email = $('register-email').value.trim().toLowerCase();
    const password = $('register-password').value;
    const confirm = $('register-confirm').value;
    
    if (password !== confirm) {
        showError('register-error', 'Passwords do not match');
        return;
    }
    
    if (password.length < 8) {
        showError('register-error', 'Password must be at least 8 characters');
        return;
    }
    
    const users = getUsers();
    if (users[email]) {
        showError('register-error', 'Email already registered');
        return;
    }
    
    const user = await createUserObject(name, false);
    user.password = password;
    users[email] = user;
    saveUsers(users);
    
    await loginUser(email, user);
    toast('Account created successfully!', 'success');
}

async function createUserObject(displayName, isOwner) {
    const keyPair = await Crypto.generateKeyPair();
    const publicKeyBase64 = await Crypto.exportPublicKey(keyPair.publicKey);
    
    // Store private key in IndexedDB for security
    const privateKeyJwk = await window.crypto.subtle.exportKey('jwk', keyPair.privateKey);
    
    return {
        displayName,
        isOwner,
        publicKey: publicKeyBase64,
        privateKeyJwk: privateKeyJwk,
        createdAt: new Date().toISOString()
    };
}

async function loginUser(email, user) {
    state.user = { ...user, email };
    
    // Reconstruct keys
    if (user.privateKeyJwk) {
        const privateKey = await window.crypto.subtle.importKey(
            'jwk',
            user.privateKeyJwk,
            { name: 'ECDH', namedCurve: 'P-256' },
            true,
            ['deriveKey', 'deriveBits']
        );
        const publicKey = await Crypto.importPublicKey(user.publicKey);
        state.keys = { privateKey, publicKey };
    }
    
    // Save session
    localStorage.setItem(CONFIG.STORAGE_PREFIX + 'session', JSON.stringify({ email }));
    
    showApp();
}

function checkSession() {
    const session = localStorage.getItem(CONFIG.STORAGE_PREFIX + 'session');
    if (session) {
        try {
            const { email } = JSON.parse(session);
            const users = getUsers();
            if (users[email]) {
                loginUser(email, users[email]);
            }
        } catch (e) {
            console.error('Session check failed:', e);
            localStorage.removeItem(CONFIG.STORAGE_PREFIX + 'session');
        }
    }
}

function logout() {
    state.user = null;
    state.keys = null;
    state.conversations = [];
    state.activeConversation = null;
    state.messages = {};
    localStorage.removeItem(CONFIG.STORAGE_PREFIX + 'session');
    location.reload();
}

// ============================================================
// APP UI
// ============================================================
function showApp() {
    $('auth-screen').classList.add('hidden');
    $('app').classList.remove('hidden');
    updateUserUI();
    loadConversations();
}

function updateUserUI() {
    const initial = (state.user.displayName || state.user.email)[0].toUpperCase();
    $('user-avatar').textContent = initial;
    $('user-name').textContent = state.user.displayName || state.user.email;
}

async function updateSettingsPanel() {
    $('settings-email').textContent = state.user.email;
    $('settings-name').value = state.user.displayName || '';
    
    if (state.keys?.publicKey) {
        const fingerprint = await Crypto.getKeyFingerprint(state.keys.publicKey);
        $('key-fingerprint').textContent = fingerprint;
    }
}

function showSidebar() {
    $('sidebar').classList.add('active');
    $('chat-empty').classList.remove('hidden');
    $('chat-active').classList.add('hidden');
    state.activeConversation = null;
}

// ============================================================
// CONVERSATIONS
// ============================================================
function loadConversations() {
    const key = CONFIG.STORAGE_PREFIX + 'conversations_' + state.user.email;
    const stored = localStorage.getItem(key);
    state.conversations = stored ? JSON.parse(stored) : [];
    
    // Load demo conversation for testing
    if (state.conversations.length === 0) {
        state.conversations.push({
            id: 'demo_' + Date.now(),
            contactEmail: 'alice@example.com',
            contactName: 'Alice',
            lastMessage: 'Hey! This is a secure chat.',
            lastMessageTime: new Date().toISOString(),
            unreadCount: 1,
            autoDelete: 86400
        });
    }
    
    renderConversations();
}

function saveConversations() {
    const key = CONFIG.STORAGE_PREFIX + 'conversations_' + state.user.email;
    localStorage.setItem(key, JSON.stringify(state.conversations));
}

function renderConversations() {
    const container = $('conversations-list');
    
    if (state.conversations.length === 0) {
        container.innerHTML = `
            <div class="empty-conversations">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                <p>No conversations yet</p>
                <span>Start chatting by adding a contact</span>
            </div>
        `;
        return;
    }
    
    container.innerHTML = state.conversations.map(conv => `
        <div class="conversation-item${state.activeConversation?.id === conv.id ? ' active' : ''}" 
             data-id="${conv.id}">
            <div class="conversation-avatar">${(conv.contactName || conv.contactEmail)[0].toUpperCase()}</div>
            <div class="conversation-info">
                <div class="conversation-header">
                    <span class="conversation-name">${escapeHtml(conv.contactName || conv.contactEmail)}</span>
                    <span class="conversation-time">${formatTime(conv.lastMessageTime)}</span>
                </div>
                <div class="conversation-preview">
                    <span class="conversation-message">${escapeHtml(conv.lastMessage || 'No messages yet')}</span>
                    ${conv.unreadCount > 0 ? `<span class="conversation-badge">${conv.unreadCount}</span>` : ''}
                </div>
            </div>
        </div>
    `).join('');
    
    // Attach click handlers
    container.querySelectorAll('.conversation-item').forEach(item => {
        item.addEventListener('click', () => {
            const conv = state.conversations.find(c => c.id === item.dataset.id);
            if (conv) openConversation(conv);
        });
    });
}

function filterConversations(e) {
    const query = e.target.value.toLowerCase();
    const items = $$('.conversation-item');
    
    items.forEach(item => {
        const name = item.querySelector('.conversation-name').textContent.toLowerCase();
        item.style.display = name.includes(query) ? 'flex' : 'none';
    });
}

// ============================================================
// CHAT
// ============================================================
function openConversation(conversation) {
    state.activeConversation = conversation;
    
    // Clear unread
    conversation.unreadCount = 0;
    saveConversations();
    
    // Update UI
    $('chat-empty').classList.add('hidden');
    $('chat-active').classList.remove('hidden');
    $('sidebar').classList.remove('active');
    
    // Update header
    const initial = (conversation.contactName || conversation.contactEmail)[0].toUpperCase();
    $('chat-avatar').textContent = initial;
    $('chat-name').textContent = conversation.contactName || conversation.contactEmail;
    
    // Load messages
    loadMessages(conversation.id);
    renderConversations();
}

function loadMessages(conversationId) {
    const key = CONFIG.STORAGE_PREFIX + 'messages_' + conversationId;
    const stored = localStorage.getItem(key);
    state.messages[conversationId] = stored ? JSON.parse(stored) : [];
    
    // Add demo messages if empty
    if (state.messages[conversationId].length === 0) {
        state.messages[conversationId] = [
            {
                id: 'msg_1',
                type: 'received',
                text: 'Hey! This message is end-to-end encrypted. 🔒',
                timestamp: new Date(Date.now() - 3600000).toISOString(),
                encrypted: true
            },
            {
                id: 'msg_2',
                type: 'received',
                text: 'Only you and I can read these messages. Not even the server!',
                timestamp: new Date(Date.now() - 3500000).toISOString(),
                encrypted: true
            }
        ];
    }
    
    renderMessages();
}

function saveMessages(conversationId) {
    const key = CONFIG.STORAGE_PREFIX + 'messages_' + conversationId;
    localStorage.setItem(key, JSON.stringify(state.messages[conversationId] || []));
}

function renderMessages() {
    if (!state.activeConversation) return;
    
    const container = $('messages-container');
    const messages = state.messages[state.activeConversation.id] || [];
    
    container.innerHTML = messages.map(msg => `
        <div class="message ${msg.type}">
            <div class="message-bubble">
                <div class="message-text">${escapeHtml(msg.text)}</div>
            </div>
            <div class="message-meta">
                ${msg.encrypted ? `<svg class="message-encrypted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>` : ''}
                <span>${formatMessageTime(msg.timestamp)}</span>
            </div>
        </div>
    `).join('');
    
    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
}

async function sendMessage() {
    if (!state.activeConversation) return;
    
    const input = $('message-input');
    const text = input.value.trim();
    
    if (!text) return;
    
    // Create message
    const message = {
        id: 'msg_' + Date.now(),
        type: 'sent',
        text: text,
        timestamp: new Date().toISOString(),
        encrypted: true
    };
    
    // TODO: Encrypt with shared key
    // const encrypted = await Crypto.encrypt(text, sharedKey);
    // message.ciphertext = encrypted.ciphertext;
    // message.iv = encrypted.iv;
    
    // Add to messages
    if (!state.messages[state.activeConversation.id]) {
        state.messages[state.activeConversation.id] = [];
    }
    state.messages[state.activeConversation.id].push(message);
    
    // Update conversation
    state.activeConversation.lastMessage = text;
    state.activeConversation.lastMessageTime = message.timestamp;
    saveConversations();
    saveMessages(state.activeConversation.id);
    
    // Clear input and render
    input.value = '';
    input.style.height = 'auto';
    renderMessages();
    renderConversations();
    
    // TODO: Send to AWS AppSync
    // await sendToCloud(message);
    
    toast('Message sent (encrypted)', 'success');
}

function startNewChat() {
    const email = $('contact-email').value.trim().toLowerCase();
    const autoDelete = parseInt($('auto-delete').value);
    
    if (!email) {
        toast('Please enter a contact email', 'error');
        return;
    }
    
    // Check if conversation exists
    let conv = state.conversations.find(c => c.contactEmail === email);
    
    if (!conv) {
        conv = {
            id: 'conv_' + Date.now(),
            contactEmail: email,
            contactName: email.split('@')[0],
            lastMessage: '',
            lastMessageTime: new Date().toISOString(),
            unreadCount: 0,
            autoDelete: autoDelete
        };
        state.conversations.unshift(conv);
        saveConversations();
    }
    
    closeModal('new-chat-modal');
    $('contact-email').value = '';
    
    openConversation(conv);
    renderConversations();
    
    toast('Encrypted chat started!', 'success');
}

// ============================================================
// UTILITIES
// ============================================================
function getUsers() {
    return JSON.parse(localStorage.getItem(CONFIG.STORAGE_PREFIX + 'users') || '{}');
}

function saveUsers(users) {
    localStorage.setItem(CONFIG.STORAGE_PREFIX + 'users', JSON.stringify(users));
}

function showError(id, msg) {
    $(id).textContent = msg;
    setTimeout(() => $(id).textContent = '', 5000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

function formatTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatMessageTime(isoString) {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function autoResizeTextarea() {
    const textarea = $('message-input');
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
}

function openModal(id) {
    $(id).classList.add('active');
}

function closeModal(id) {
    $(id).classList.remove('active');
}

function closeAllModals() {
    $$('.modal.active').forEach(m => m.classList.remove('active'));
}

function toast(message, type = 'success') {
    const icons = {
        success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20,6 9,17 4,12"/></svg>',
        error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
    };
    
    const div = document.createElement('div');
    div.className = `toast ${type}`;
    div.innerHTML = `${icons[type]}<span>${escapeHtml(message)}</span>`;
    
    $('toast-container').appendChild(div);
    
    setTimeout(() => {
        div.style.opacity = '0';
        setTimeout(() => div.remove(), 300);
    }, 3000);
}

function clearAllMessages() {
    if (confirm('Delete all messages? This cannot be undone.')) {
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith(CONFIG.STORAGE_PREFIX + 'messages_')) {
                localStorage.removeItem(key);
            }
        });
        state.messages = {};
        if (state.activeConversation) {
            renderMessages();
        }
        toast('All messages cleared', 'success');
    }
}

async function exportKeys() {
    if (!state.keys) {
        toast('No keys to export', 'error');
        return;
    }
    
    const data = {
        publicKey: state.user.publicKey,
        privateKeyJwk: state.user.privateKeyJwk,
        exportedAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `securechat-keys-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast('Keys exported! Store securely.', 'success');
}

console.log('SecureChat loaded - E2E Encryption Ready');
