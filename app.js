// Configuration
const API_BASE_URL = 'https://kfrg2d2cxa.execute-api.us-east-2.amazonaws.com';

// DOM Elements
const messageForm = document.getElementById('messageForm');
const nameInput = document.getElementById('name');
const messageInput = document.getElementById('message');
const submitBtn = document.getElementById('submitBtn');
const formMessage = document.getElementById('formMessage');
const messagesContainer = document.getElementById('messagesContainer');
const loadingSpinner = document.getElementById('loadingSpinner');
const noMessagesDiv = document.getElementById('noMessages');
const charCount = document.getElementById('charCount');
const totalMessagesEl = document.getElementById('totalMessages');

// State
let isSubmitting = false;
let refreshInterval = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadMessages();
    setupEventListeners();
    startAutoRefresh();
});

// Setup Event Listeners
function setupEventListeners() {
    // Form submission
    messageForm.addEventListener('submit', handleSubmit);
    
    // Character counter
    messageInput.addEventListener('input', updateCharCounter);
    
    // Clear form message when user starts typing again
    nameInput.addEventListener('input', clearFormMessage);
    messageInput.addEventListener('input', clearFormMessage);
}

// Character Counter
function updateCharCounter() {
    const count = messageInput.value.length;
    charCount.textContent = count;
    
    if (count > 450) {
        charCount.style.color = '#fca5a5';
    } else if (count > 400) {
        charCount.style.color = '#fbbf24';
    } else {
        charCount.style.color = 'var(--text-muted)';
    }
}

// Clear Form Message
function clearFormMessage() {
    formMessage.style.display = 'none';
    formMessage.className = 'form-message';
}

// Handle Form Submission
async function handleSubmit(e) {
    e.preventDefault();
    
    if (isSubmitting) return;
    
    const name = nameInput.value.trim();
    const message = messageInput.value.trim();
    
    if (!name || !message) {
        showFormMessage('Please fill in all fields', 'error');
        return;
    }
    
    isSubmitting = true;
    submitBtn.disabled = true;
    submitBtn.querySelector('.btn-text').textContent = 'Sending...';
    
    try {
        const response = await fetch(`${API_BASE_URL}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name, message })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            showFormMessage('Message sent successfully! 🚀', 'success');
            messageForm.reset();
            updateCharCounter();
            
            // Reload messages to show the new one
            setTimeout(() => {
                loadMessages();
            }, 500);
        } else {
            throw new Error('Failed to send message');
        }
        
    } catch (error) {
        console.error('Error sending message:', error);
        showFormMessage('Failed to send message. Please try again.', 'error');
    } finally {
        isSubmitting = false;
        submitBtn.disabled = false;
        submitBtn.querySelector('.btn-text').textContent = 'Send Signal';
    }
}

// Show Form Message
function showFormMessage(text, type) {
    formMessage.textContent = text;
    formMessage.className = `form-message ${type}`;
    formMessage.style.display = 'block';
    
    if (type === 'success') {
        setTimeout(() => {
            clearFormMessage();
        }, 5000);
    }
}

// Load Messages
async function loadMessages() {
    try {
        const response = await fetch(`${API_BASE_URL}/messages`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const messages = await response.json();
        
        // Hide loading spinner
        loadingSpinner.style.display = 'none';
        
        // Update stats
        updateStats(messages.length);
        
        if (messages.length === 0) {
            messagesContainer.style.display = 'none';
            noMessagesDiv.style.display = 'block';
        } else {
            noMessagesDiv.style.display = 'none';
            messagesContainer.style.display = 'grid';
            displayMessages(messages);
        }
        
    } catch (error) {
        console.error('Error loading messages:', error);
        loadingSpinner.style.display = 'none';
        messagesContainer.innerHTML = `
            <div class="error-message" style="text-align: center; padding: 40px; color: var(--text-muted);">
                <p>Unable to load messages. Please try again later.</p>
            </div>
        `;
    }
}

// Display Messages
function displayMessages(messages) {
    messagesContainer.innerHTML = messages.map((msg, index) => {
        const timeAgo = getTimeAgo(msg.createdAt);
        const initial = msg.name.charAt(0).toUpperCase();
        
        return `
            <div class="message-card" style="animation-delay: ${index * 0.05}s">
                <div class="message-header">
                    <div class="message-author">
                        <div class="author-avatar">${initial}</div>
                        <span class="author-name">${escapeHtml(msg.name)}</span>
                    </div>
                    <span class="message-time">${timeAgo}</span>
                </div>
                <div class="message-content">${escapeHtml(msg.message)}</div>
            </div>
        `;
    }).join('');
}

// Update Stats
function updateStats(count) {
    if (totalMessagesEl) {
        animateNumber(totalMessagesEl, count);
    }
}

// Animate Number
function animateNumber(element, target) {
    const current = parseInt(element.textContent) || 0;
    const increment = target > current ? 1 : -1;
    const duration = 1000;
    const steps = Math.abs(target - current);
    const stepDuration = duration / Math.max(steps, 1);
    
    let currentNum = current;
    
    const timer = setInterval(() => {
        currentNum += increment;
        element.textContent = currentNum;
        
        if (currentNum === target) {
            clearInterval(timer);
        }
    }, stepDuration);
}

// Get Time Ago
function getTimeAgo(timestamp) {
    if (!timestamp) return 'Just now';
    
    const now = new Date();
    const messageDate = new Date(timestamp);
    const seconds = Math.floor((now - messageDate) / 1000);
    
    const intervals = {
        year: 31536000,
        month: 2592000,
        week: 604800,
        day: 86400,
        hour: 3600,
        minute: 60
    };
    
    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
        const interval = Math.floor(seconds / secondsInUnit);
        
        if (interval >= 1) {
            return interval === 1 ? `1 ${unit} ago` : `${interval} ${unit}s ago`;
        }
    }
    
    return 'Just now';
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Auto-refresh messages every 30 seconds
function startAutoRefresh() {
    refreshInterval = setInterval(() => {
        loadMessages();
    }, 30000);
}

// Stop auto-refresh (cleanup)
function stopAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    stopAutoRefresh();
});
