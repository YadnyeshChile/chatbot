// Socket.io connection
let socket = null;

// DOM Elements
const chatMessagesDiv = document.getElementById('chatMessages');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const chatForm = document.getElementById('chatForm');
const quickOptions = document.getElementById('quickOptions');
const minimizeBtn = document.getElementById('minimizeBtn');
const chatbotContainer = document.querySelector('.chatbot-container');
const logoutBtn = document.getElementById('logoutBtn');
const endBtn = document.getElementById('endBtn');
const userWelcome = document.getElementById('userWelcome');

// Escalation elements
const escalationModal = document.getElementById('escalationModal');
const escalationChatPanel = document.getElementById('escalationChatPanel');
const escalationMessages = document.getElementById('escalationMessages');
const escalationInput = document.getElementById('escalationInput');
const escalationSendBtn = document.getElementById('escalationSendBtn');
const closeEscalation = document.getElementById('closeEscalation');
const continueWithBot = document.getElementById('continueWithBot');
const escalateToAgent = document.getElementById('escalateToAgent');

let isMessageSending = false;
let currentUserId = null;
let currentUsername = null;
let currentEscalationId = null;
let inEscalation = false;

// Check authentication on page load
window.onload = () => {
    const userId = localStorage.getItem('userId');
    const username = localStorage.getItem('username');

    if (!userId) {
        // Redirect to login/register page
        window.location.href = '/auth';
    } else {
        currentUserId = userId;
        currentUsername = username;
        userWelcome.textContent = `Welcome, ${username}!`;
        
        // Initialize Socket.io connection
        initializeSocket();
        
        loadChatHistory();
    }
};

// Initialize Socket.io
function initializeSocket() {
    socket = io('http://localhost:5500');
    
    socket.on('connect', () => {
        console.log('Socket connected:', socket.id);
        socket.emit('user-join', currentUserId);
    });

    socket.on('escalation-message', (data) => {
        if (data.escalationId === currentEscalationId) {
            displayEscalationMessage(data);
        }
    });

    socket.on('disconnect', () => {
        console.log('Socket disconnected');
    });

    socket.on('error', (error) => {
        console.error('Socket error:', error);
        addMessage(`Error: ${error}`, 'bot');
    });
}

// Logout function
logoutBtn.onclick = () => {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('userId');
        localStorage.removeItem('username');
        localStorage.removeItem('isAdmin');
        window.location.href = '/auth';
    }
};

// End chat (clear conversation)
if (endBtn) {
    endBtn.onclick = () => {
        if (confirm('End chat and clear all messages?')) {
            chatMessagesDiv.innerHTML = '';
            addMessage('Chat cleared. Start a new conversation anytime!', 'bot');
            if (quickOptions) quickOptions.classList.remove('hidden');
            
            // Delete chat history from backend
            fetch(`http://localhost:5500/api/chat-history/${currentUserId}`, { method: 'DELETE' })
                .then(r => {
                    if (!r.ok) {
                        console.error('Failed to clear chat history:', r.status);
                    } else {
                        console.log('Chat history cleared successfully');
                    }
                })
                .catch(err => console.error('Error clearing backend history:', err));
        }
    };
}

// Load previous chat history
function loadChatHistory() {
    fetch(`http://localhost:5500/api/chat-history/${currentUserId}`)
        .then(r => r.json())
        .then(data => {
            if (data.history && data.history.length > 0) {
                // Clear the initial welcome message and load history
                chatMessagesDiv.innerHTML = '';
                
                // Show history in reverse order (oldest to newest)
                const history = data.history.reverse();
                history.forEach(chat => {
                    addMessage(chat.user_message, 'user', false);
                    addMessage(chat.bot_response, 'bot', false);
                });
            }
        })
        .catch(err => console.error('Error loading chat history:', err));
}

// Prevent form submission
chatForm.onsubmit = () => false;

// Send button click
sendBtn.onclick = () => {
    sendMessage();
    return false;
};

// Enter key in input
userInput.onkeydown = (e) => {
    if (e.key === 'Enter') {
        sendMessage();
        return false;
    }
};

// Quick buttons
document.querySelectorAll('.quick-btn').forEach(btn => {
    btn.onclick = () => {
        userInput.value = btn.dataset.message;
        sendMessage();
        return false;
    };
});

// Minimize button
minimizeBtn.onclick = () => {
    chatbotContainer.style.transform = chatbotContainer.style.transform === 'scaleY(0)' ? 'scaleY(1)' : 'scaleY(0)';
    chatbotContainer.style.transformOrigin = 'top';
    chatbotContainer.style.transition = 'transform 0.3s ease';
    return false;
};

// ==================== ESCALATION HANDLERS ====================

// Show escalation modal
function showEscalationModal() {
    escalationModal.style.display = 'flex';
}

// Hide escalation modal
function hideEscalationModal() {
    escalationModal.style.display = 'none';
}

// Continue with Bot - dismiss escalation
continueWithBot.onclick = () => {
    hideEscalationModal();
    addMessage('Okay, I\'ll try to help you further. What else would you like to know?', 'bot');
};

// Escalate to Agent
escalateToAgent.onclick = () => {
    hideEscalationModal();
    createEscalationTicket();
};

// Create escalation ticket
function createEscalationTicket() {
    const lastUserMessage = Array.from(chatMessagesDiv.querySelectorAll('.user-message')).pop();
    const initialQuestion = lastUserMessage ? lastUserMessage.textContent : 'Customer needs assistance';
    
    fetch('http://localhost:5500/api/escalations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: currentUserId,
            username: currentUsername,
            initialQuestion: initialQuestion
        })
    })
    .then(r => r.json())
    .then(data => {
        if (data.escalationId) {
            currentEscalationId = data.escalationId;
            inEscalation = true;
            
            // Load existing escalation messages
            fetch(`http://localhost:5500/api/escalations/${currentEscalationId}`)
                .then(r => r.json())
                .then(escalData => {
                    showEscalationChatPanel();
                    if (escalData.messages) {
                        escalData.messages.forEach(msg => {
                            displayEscalationMessage(msg);
                        });
                    }
                    addMessage(`✅ You've been connected to a human agent. Your ticket ID is ${data.ticketId}`, 'bot');
                })
                .catch(err => console.error('Error loading escalation:', err));
        }
    })
    .catch(err => {
        console.error('Escalation error:', err);
        addMessage('Sorry, couldn\'t connect to an agent. Please try again.', 'bot');
    });
}

// Show escalation chat panel
function showEscalationChatPanel() {
    escalationChatPanel.style.display = 'flex';
    chatMessagesDiv.style.display = 'none';
    document.querySelector('.quick-options').style.display = 'none';
    document.querySelector('.chat-input-area').style.display = 'none';
}

// Hide escalation chat panel
function hideEscalationChatPanel() {
    escalationChatPanel.style.display = 'none';
    chatMessagesDiv.style.display = 'block';
    document.querySelector('.quick-options').style.display = 'flex';
    document.querySelector('.chat-input-area').style.display = 'block';
    inEscalation = false;
    currentEscalationId = null;
}

// Display escalation message
function displayEscalationMessage(msg) {
    const messageDiv = document.createElement('div');
    messageDiv.style.marginBottom = '12px';
    messageDiv.style.padding = '10px';
    messageDiv.style.borderRadius = '6px';
    messageDiv.style.display = 'flex';
    messageDiv.style.gap = '8px';
    
    if (msg.sender_type === 'user' || msg.senderType === 'user') {
        messageDiv.style.justifyContent = 'flex-end';
        messageDiv.innerHTML = `
            <div style="
                background:#667eea;
                color:white;
                max-width:70%;
                padding:10px 12px;
                border-radius:8px;
                word-wrap:break-word;
            ">
                <p style="margin:0; font-size:14px;">${escapeHtml(msg.message_text || msg.messageText)}</p>
            </div>
        `;
    } else {
        messageDiv.style.justifyContent = 'flex-start';
        messageDiv.innerHTML = `
            <div style="
                background:#e3e3e3;
                color:#333;
                max-width:70%;
                padding:10px 12px;
                border-radius:8px;
                word-wrap:break-word;
            ">
                <p style="margin:0; font-size:14px;"><strong>Agent:</strong> ${escapeHtml(msg.message_text || msg.messageText)}</p>
            </div>
        `;
    }
    
    escalationMessages.appendChild(messageDiv);
    escalationMessages.scrollTop = escalationMessages.scrollHeight;
}

// Send escalation message
escalationSendBtn.onclick = () => {
    const message = escalationInput.value.trim();
    if (!message || !currentEscalationId) return;
    
    // Send to server via Socket.io - only display when server broadcasts it back
    socket.emit('escalation-message', {
        escalationId: currentEscalationId,
        userId: currentUserId,
        adminId: null,
        senderType: 'user',
        messageText: message
    });
    
    escalationInput.value = '';
};

// Escalation input Enter key
document.getElementById('escalationInput').onkeydown = (e) => {
    if (e.key === 'Enter') {
        escalationSendBtn.click();
        return false;
    }
};

// Close escalation chat
closeEscalation.onclick = () => {
    if (confirm('End this chat with the agent?')) {
        hideEscalationChatPanel();
    }
};

// Send Message
function sendMessage() {
    const message = userInput.value.trim();
    
    if (!message || isMessageSending) return;
    
    if (!currentUserId) {
        console.error('ERROR: currentUserId is not set!', currentUserId);
        addMessage('Error: User ID not found. Please refresh the page.', 'bot');
        return;
    }
    
    console.log('Sending message:', { message, userId: currentUserId });
    
    // If in escalation, send to escalation API
    if (inEscalation && currentEscalationId) {
        sendEscalationMessage(message);
        return;
    }
    
    isMessageSending = true;
    addMessage(message, 'user');
    userInput.value = '';
    
    if (quickOptions && !quickOptions.classList.contains('hidden')) {
        quickOptions.classList.add('hidden');
    }
    
    showTypingIndicator();
    
    fetch('http://localhost:5500/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message, userId: currentUserId })
    })
    .then(r => r.json())
    .then(data => {
        console.log('Chat response:', data);
        removeTypingIndicator();
        addMessage(data.response, 'bot');
        isMessageSending = false;
        
        // Show escalation dialog if hard question
        if (data.isHardQuestion) {
            setTimeout(() => {
                showEscalationModal();
            }, 500);
        }
        
        // Refresh page if category is 'refresh'
        if (data.category === 'refresh') {
            setTimeout(() => {
                location.reload();
            }, 1500);
        }
    })
    .catch(err => {
        console.error('Fetch error:', err);
        removeTypingIndicator();
        addMessage('Sorry, something went wrong.', 'bot');
        isMessageSending = false;
    });
}

// Add Message
function addMessage(text, sender, scroll = true) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = sender === 'user' ? '👤' : '🤖';
    
    const content = document.createElement('div');
    content.className = 'message-content';
    content.innerHTML = `<p>${escapeHtml(text)}</p>`;
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(content);
    chatMessagesDiv.appendChild(messageDiv);
    
    chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
}

// Typing Indicator
function showTypingIndicator(scroll = true) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot-message';
    messageDiv.id = 'typingIndicator';
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = '🤖';
    
    const content = document.createElement('div');
    content.className = 'message-content';
    content.innerHTML = `<div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`;
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(content);
    chatMessagesDiv.appendChild(messageDiv);
    
    if (scroll) {
        chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
    }
}

function removeTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) indicator.remove();
}

// Escape HTML
function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// =======================
// 📜 CHAT HISTORY FEATURE
// =======================

const historyBtn = document.getElementById('historyBtn');
const historyPanel = document.getElementById('historyPanel');
const historyContent = document.getElementById('historyContent');
const closeHistory = document.getElementById('closeHistory');

// OPEN HISTORY
historyBtn.onclick = () => {
    historyPanel.style.display = 'block';
    loadHistoryPanel();
};

// CLOSE HISTORY
closeHistory.onclick = () => {
    historyPanel.style.display = 'none';
};

// LOAD HISTORY INTO PANEL
function loadHistoryPanel() {
    fetch('http://localhost:5500/api/chat-history')
        .then(res => res.json())
        .then(data => {
            historyContent.innerHTML = '';

            if (!data.history || data.history.length === 0) {
                historyContent.innerHTML = '<p>No chat history found.</p>';
                return;
            }

            data.history.forEach(item => {
                const div = document.createElement('div');
                div.style.marginBottom = '15px';

                div.innerHTML = `
                    <p><strong>👤 You:</strong> ${escapeHtml(item.user_message)}</p>
                    <p><strong>🤖 Bot:</strong> ${escapeHtml(item.bot_response)}</p>
                    <hr/>
                `;

                historyContent.appendChild(div);
            });
        })
        .catch(err => {
            console.error(err);
            historyContent.innerHTML = '<p>Error loading history</p>';
        });
}