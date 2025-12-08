// Simple demo functionality
let currentDoc = null;

const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const docsList = document.getElementById('docsList');
const questionInput = document.getElementById('questionInput');
const sendBtn = document.getElementById('sendBtn');
const chatMessages = document.getElementById('chatMessages');
const summarizeBtn = document.getElementById('summarizeBtn');
const flashcardsBtn = document.getElementById('flashcardsBtn');
const practiceBtn = document.getElementById('practiceBtn');

uploadArea.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        currentDoc = file;
        displayDocument(file);
        enableFeatures();
    }
});

function displayDocument(file) {
    const size = (file.size / 1024).toFixed(1) + ' KB';
    docsList.innerHTML = `
        <div class="doc-item">
            <div>
                <div class="doc-name">${file.name}</div>
                <div class="doc-size">${size}</div>
            </div>
        </div>
    `;
}

function enableFeatures() {
    questionInput.disabled = false;
    sendBtn.disabled = false;
    summarizeBtn.disabled = false;
    flashcardsBtn.disabled = false;
    practiceBtn.disabled = false;
}

function addMessage(content, isUser = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user' : 'assistant'}`;
    messageDiv.innerHTML = `<div class="message-content">${content}</div>`;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

sendBtn.addEventListener('click', () => {
    const question = questionInput.value.trim();
    if (question && currentDoc) {
        addMessage(question, true);
        questionInput.value = '';
        
        // Simulated AI response
        setTimeout(() => {
            const responses = [
                `Based on "${currentDoc.name}", here's what I found: This is a demo response. In production, this would use AWS Bedrock with Claude AI to provide real answers from your document.`,
                `Great question! With real AWS integration, I would analyze "${currentDoc.name}" and give you a detailed answer based on its content.`,
                `Interesting! Once connected to AWS Bedrock, I'll be able to search through "${currentDoc.name}" and provide accurate, AI-powered answers.`
            ];
            addMessage(responses[Math.floor(Math.random() * responses.length)]);
        }, 1000);
    }
});

summarizeBtn.addEventListener('click', () => {
    if (currentDoc) {
        addMessage(`📝 Generating summary of "${currentDoc.name}"...`, false);
        setTimeout(() => {
            addMessage(`Summary: This is a demo. With AWS Bedrock, this would provide a concise summary of your document's key points and main ideas.`, false);
        }, 1500);
    }
});

flashcardsBtn.addEventListener('click', () => {
    if (currentDoc) {
        addMessage(`🎴 Creating flashcards from "${currentDoc.name}"...`, false);
        setTimeout(() => {
            addMessage(`Flashcards created! In production, I would generate Q&A flashcards from your document's important concepts.`, false);
        }, 1500);
    }
});

practiceBtn.addEventListener('click', () => {
    if (currentDoc) {
        addMessage(`✅ Generating practice questions for "${currentDoc.name}"...`, false);
        setTimeout(() => {
            addMessage(`Practice test ready! With AWS integration, I would create exam-style questions based on your document.`, false);
        }, 1500);
    }
});

questionInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !sendBtn.disabled) {
        sendBtn.click();
    }
});
