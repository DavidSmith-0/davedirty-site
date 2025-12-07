/**
 * Discussion Board - JavaScript
 * Cloud-powered discussion board using AWS
 */

// Configuration
const CONFIG = {
    API_ENDPOINT: 'https://YOUR_API_GATEWAY_URL/prod', // Replace with your API Gateway URL
    MESSAGES_TABLE: 'Messages' // Your DynamoDB table name
};

// State
let messages = [];

// DOM Elements
const messageForm = document.getElementById('message-form');
const messagesList = document.getElementById('messages-list');
const refreshBtn = document.getElementById('refresh-btn');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadMessages();
    
    messageForm.addEventListener('submit', handleSubmit);
    refreshBtn.addEventListener('click', loadMessages);
});

// Load messages from API
async function loadMessages() {
    try {
        messagesList.innerHTML = '<div class="loading">Loading messages...</div>';
        
        // TODO: Replace with actual API call
        // const response = await fetch(`${CONFIG.API_ENDPOINT}/messages`);
        // const data = await response.json();
        // messages = data.messages || [];
        
        // Demo data for now (remove when API is connected)
        messages = [
            {
                id: '1',
                author: 'Dave',
                content: 'Welcome to the discussion board! Feel free to share your thoughts and feedback.',
                timestamp: new Date().toISOString()
            }
        ];
        
        renderMessages();
        showToast('Messages loaded', 'success');
    } catch (error) {
        console.error('Error loading messages:', error);
        messagesList.innerHTML = '<div class="empty-state">Failed to load messages</div>';
        showToast('Failed to load messages', 'error');
    }
}

// Handle form submission
async function handleSubmit(e) {
    e.preventDefault();
    
    const author = document.getElementById('author-name').value.trim();
    const content = document.getElementById('message-content').value.trim();
    
    if (!author || !content) {
        showToast('Please fill in all fields', 'error');
        return;
    }
    
    try {
        const newMessage = {
            id: Date.now().toString(),
            author,
            content,
            timestamp: new Date().toISOString()
        };
        
        // TODO: Replace with actual API call
        // const response = await fetch(`${CONFIG.API_ENDPOINT}/messages`, {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify(newMessage)
        // });
        
        // Add to local state (remove when API is connected)
        messages.unshift(newMessage);
        renderMessages();
        
        // Clear form
        messageForm.reset();
        
        showToast('Message posted successfully!', 'success');
    } catch (error) {
        console.error('Error posting message:', error);
        showToast('Failed to post message', 'error');
    }
}

// Render messages
function renderMessages() {
    if (messages.length === 0) {
        messagesList.innerHTML = '<div class="empty-state">No messages yet. Be the first to post!</div>';
        return;
    }
    
    messagesList.innerHTML = messages.map(msg => `
        <div class="message-card">
            <div class="message-header">
                <span class="message-author">${escapeHtml(msg.author)}</span>
                <span class="message-date">${formatDate(msg.timestamp)}</span>
            </div>
            <div class="message-content">${escapeHtml(msg.content)}</div>
        </div>
    `).join('');
}

// Format date
function formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    // Less than 1 minute
    if (diff < 60000) {
        return 'Just now';
    }
    
    // Less than 1 hour
    if (diff < 3600000) {
        const minutes = Math.floor(diff / 60000);
        return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    }
    
    // Less than 1 day
    if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    }
    
    // Format as date
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
}

// Show toast notification
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    const container = document.getElementById('toast-container');
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
