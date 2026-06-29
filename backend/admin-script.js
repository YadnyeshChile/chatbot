// API Configuration
const API_URL = 'http://localhost:5500/api';

// DOM Elements
const navItems = document.querySelectorAll('.nav-item');
const tabContents = document.querySelectorAll('.tab-content');
const addFaqBtn = document.getElementById('addFaqBtn');
const addFaqForm = document.getElementById('addFaqForm');
const faqForm = document.getElementById('faqForm');
const cancelBtn = document.getElementById('cancelBtn');
const faqsList = document.getElementById('faqsList');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const chatHistoryContainer = document.getElementById('chatHistoryContainer');
const logoutBtn = document.getElementById('logoutBtn');
const usersList = document.getElementById('usersList');
const userChatContainer = document.getElementById('userChatContainer');
const backToUsersList = document.getElementById('backToUsersList');
const chatMessagesAdmin = document.getElementById('chatMessagesAdmin');
const selectedUserName = document.getElementById('selectedUserName');

let currentEditingId = null;
let currentSelectedUserId = null;

// Check authentication on page load
window.onload = () => {
    const userId = localStorage.getItem('userId');
    const isAdmin = localStorage.getItem('isAdmin');

    if (!userId || isAdmin !== '1') {
        window.location.href = '/auth';
    }
};

// Logout function
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to logout?')) {
            localStorage.removeItem('userId');
            localStorage.removeItem('username');
            localStorage.removeItem('isAdmin');
            window.location.href = '/auth';
        }
    });
}

// Tab Navigation
navItems.forEach(item => {
    item.addEventListener('click', () => {
        const tabName = item.dataset.tab;
        
        // Remove active class from all items
        navItems.forEach(nav => nav.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        
        // Add active class to clicked item
        item.classList.add('active');
        document.getElementById(`${tabName}-tab`).classList.add('active');
        
        // Load data based on tab
        if (tabName === 'faqs') {
            loadFAQs();
        } else if (tabName === 'users') {
            loadUsersList();
        } else if (tabName === 'history') {
            loadChatHistory();
        } else if (tabName === 'stats') {
            loadStatistics();
        }
    });
});

// Add FAQ Button
addFaqBtn.addEventListener('click', () => {
    currentEditingId = null;
    faqForm.reset();
    document.querySelector('.form-container h3').textContent = 'Add New FAQ';
    addFaqForm.style.display = 'block';
    faqForm.scrollIntoView({ behavior: 'smooth' });
});

// Cancel Button
cancelBtn.addEventListener('click', () => {
    addFaqForm.style.display = 'none';
    faqForm.reset();
    currentEditingId = null;
});

// Form Submit
faqForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const question = document.getElementById('faqQuestion').value;
    const answer = document.getElementById('faqAnswer').value;
    const category = document.getElementById('faqCategory').value;
    
    if (!question || !answer || !category) {
        alert('Please fill in all fields');
        return;
    }
    
    try {
        if (currentEditingId) {
            // Update FAQ
            const response = await fetch(`${API_URL}/faqs/${currentEditingId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ question, answer, category })
            });
            
            if (!response.ok) {
                throw new Error('Failed to update FAQ');
            }
            
            alert('FAQ updated successfully!');
        } else {
            // Add new FAQ
            const response = await fetch(`${API_URL}/faqs`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ question, answer, category })
            });
            
            if (!response.ok) {
                throw new Error('Failed to add FAQ');
            }
            
            alert('FAQ added successfully!');
        }
        
        addFaqForm.style.display = 'none';
        faqForm.reset();
        currentEditingId = null;
        loadFAQs();
    } catch (error) {
        console.error('Error:', error);
        alert('Error saving FAQ: ' + error.message);
    }
});

// Load FAQs
async function loadFAQs() {
    try {
        console.log('Loading FAQs from:', `${API_URL}/faqs`);
        const response = await fetch(`${API_URL}/faqs`);
        console.log('FAQs Response status:', response.status);
        const data = await response.json();
        console.log('FAQs data:', data);
        const faqs = data.faqs || [];
        
        if (faqs.length === 0) {
            faqsList.innerHTML = '<p>No FAQs found. Add one to get started!</p>';
            return;
        }
        
        faqsList.innerHTML = faqs.map(faq => `
            <div class="faq-item">
                <div class="faq-question">${escapeHtml(faq.question)}</div>
                <div class="faq-answer">${escapeHtml(faq.answer)}</div>
                <span class="faq-category">${faq.category.toUpperCase()}</span>
                <div class="faq-actions">
                    <button class="btn-edit" onclick="editFAQ(${faq.id}, '${escapeHtml(faq.question)}', '${escapeHtml(faq.answer)}', '${faq.category}')">Edit</button>
                    <button class="btn-delete" onclick="deleteFAQ(${faq.id})">Delete</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading FAQs:', error);
        console.error('Stack:', error.stack);
        faqsList.innerHTML = '<p>Error loading FAQs. Make sure the backend is running on http://127.0.0.1:5500</p>';
    }
}

// Edit FAQ
function editFAQ(id, question, answer, category) {
    currentEditingId = id;
    document.getElementById('faqQuestion').value = question;
    document.getElementById('faqAnswer').value = answer;
    document.getElementById('faqCategory').value = category;
    document.querySelector('.form-container h3').textContent = 'Edit FAQ';
    addFaqForm.style.display = 'block';
    addFaqForm.scrollIntoView({ behavior: 'smooth' });
}

// Delete FAQ
async function deleteFAQ(id) {
    if (!confirm('Are you sure you want to delete this FAQ?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/faqs/${id}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete FAQ');
        }
        
        alert('FAQ deleted successfully!');
        loadFAQs();
    } catch (error) {
        console.error('Error:', error);
        alert('Error deleting FAQ: ' + error.message);
    }
}

// Load Chat History
async function loadChatHistory() {
    try {
        console.log('Loading users from:', `${API_URL}/admin/users`);
        const response = await fetch(`${API_URL}/admin/users`);
        console.log('Users Response status:', response.status);
        const data = await response.json();
        console.log('Users data:', data);
        const users = data.users || [];

        if (users.length === 0) {
            chatHistoryContainer.innerHTML = '<p>No users or chat history yet.</p>';
            return;
        }

        let allChats = [];

        for (const user of users) {
            const chatResponse = await fetch(`${API_URL}/admin/user-chat/${user.id}`);
            const chatData = await chatResponse.json();
            allChats = allChats.concat(chatData.chatHistory || []);
        }

        allChats.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        if (allChats.length === 0) {
            chatHistoryContainer.innerHTML = '<p>No chat history yet.</p>';
            return;
        }

        chatHistoryContainer.innerHTML = allChats.map(item => `
            <div class="chat-item">
                <div class="chat-user">👤 User: ${escapeHtml(item.username || item.user_message)}</div>
                <div class="chat-bot">🤖 Bot: ${escapeHtml(item.bot_response)}</div>
                <div class="chat-time">${new Date(item.timestamp).toLocaleString()}</div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading chat history:', error);
        chatHistoryContainer.innerHTML = '<p>Error loading chat history. Make sure the backend is running on http://127.0.0.1:5500</p>';
    }
}

// Clear Chat History
if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to clear all chat history? This cannot be undone.')) {
            return;
        }

        try {
            const response = await fetch(`${API_URL}/chat-history`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Failed to clear chat history');
            }

            alert('Chat history cleared successfully!');
            loadChatHistory();
        } catch (error) {
            console.error('Error:', error);
            alert('Error clearing chat history: ' + error.message);
        }
    });
}

// Load Users List
async function loadUsersList() {
    try {
        console.log('Loading users list from:', `${API_URL}/admin/users`);
        const response = await fetch(`${API_URL}/admin/users`);
        console.log('Users Response status:', response.status);
        const data = await response.json();
        console.log('Users data:', data);
        const users = data.users || [];
        
        if (users.length === 0) {
            usersList.innerHTML = '<p>No users yet.</p>';
            return;
        }
        
        usersList.innerHTML = users.map(user => `
            <div class="user-item" onclick="viewUserChat(${user.id}, '${escapeHtml(user.username)}')">
                <div class="user-info">
                    <div class="user-name">👤 ${escapeHtml(user.username)}</div>
                    <div class="user-email">${escapeHtml(user.email)}</div>
                    <div class="user-messages">Messages: ${user.message_count}</div>
                </div>
                <div class="user-date">${new Date(user.created_at).toLocaleDateString()}</div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading users:', error);
        usersList.innerHTML = '<p>Error loading users. Make sure the backend is running on http://127.0.0.1:5500</p>';
    }
}

// View User Chat
async function viewUserChat(userId, username) {
    currentSelectedUserId = userId;
    selectedUserName.textContent = `Chat with ${username}`;
    
    try {
        const response = await fetch(`${API_URL}/admin/user-chat/${userId}`);
        const data = await response.json();
        const chats = data.chatHistory || [];
        
        if (chats.length === 0) {
            chatMessagesAdmin.innerHTML = `<p>No chat history with ${username}</p>`;
        } else {
            // Sort by timestamp ascending (oldest to newest)
            chats.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            
            chatMessagesAdmin.innerHTML = chats.map(chat => `
                <div class="chat-item-admin">
                    <div class="chat-user-msg">
                        <strong>👤 User:</strong> ${escapeHtml(chat.user_message)}
                        <div class="chat-time-small">${new Date(chat.timestamp).toLocaleString()}</div>
                    </div>
                    <div class="chat-bot-msg">
                        <strong>🤖 Bot:</strong> ${escapeHtml(chat.bot_response)}
                    </div>
                </div>
            `).join('');
        }
        
        // Show chat container and hide users list
        document.querySelector('.users-list').style.display = 'none';
        userChatContainer.style.display = 'block';
    } catch (error) {
        console.error('Error loading user chat:', error);
        chatMessagesAdmin.innerHTML = '<p>Error loading chat history.</p>';
    }
}

// Back to Users List
if (backToUsersList) {
    backToUsersList.addEventListener('click', () => {
        document.querySelector('.users-list').style.display = 'block';
        userChatContainer.style.display = 'none';
        currentSelectedUserId = null;
    });
}

// Delete User Chat History
const deleteUserChatBtn = document.getElementById('deleteUserChatBtn');
if (deleteUserChatBtn) {
    deleteUserChatBtn.addEventListener('click', async () => {
        if (!currentSelectedUserId) {
            alert('No user selected');
            return;
        }

        const username = selectedUserName.textContent.replace('Chat with ', '');
        
        if (!confirm(`Are you sure you want to delete all chats for ${username}? This cannot be undone.`)) {
            return;
        }

        try {
            const response = await fetch(`${API_URL}/chat-history/${currentSelectedUserId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Failed to delete user chat history');
            }

            alert(`Chat history for ${username} deleted successfully!`);
            loadUsersList();
            document.querySelector('.users-list').style.display = 'block';
            userChatContainer.style.display = 'none';
            currentSelectedUserId = null;
        } catch (error) {
            console.error('Error:', error);
            alert('Error deleting chat history: ' + error.message);
        }
    });
}

// Load Statistics
async function loadStatistics() {
    try {
        console.log('Loading statistics...');
        const faqResponse = await fetch(`${API_URL}/faqs`);
        console.log('FAQs Response status:', faqResponse.status);
        const faqData = await faqResponse.json();
        console.log('FAQs data:', faqData);
        const faqs = faqData.faqs || [];
        
        const historyResponse = await fetch(`${API_URL}/chat-history`);
        console.log('History Response status:', historyResponse.status);
        const historyData = await historyResponse.json();
        console.log('History data:', historyData);

        // Calculate statistics
        const totalFaqs = faqs.length;
        const totalMessages = historyData.history?.length || 0;
        
        const categories = {};
        faqs.forEach(faq => {
            categories[faq.category] = (categories[faq.category] || 0) + 1;
        });
        
        const totalCategories = Object.keys(categories).length;
        const commonCategory = Object.keys(categories).length > 0 
            ? Object.keys(categories).reduce((a, b) => categories[a] > categories[b] ? a : b)
            : '-';
        
        // Update statistics display
        document.getElementById('totalFaqs').textContent = totalFaqs;
        document.getElementById('totalMessages').textContent = totalMessages;
        document.getElementById('totalCategories').textContent = totalCategories;
        document.getElementById('commonCategory').textContent = commonCategory.toUpperCase();
        
        // Category breakdown
        const categoryStats = document.getElementById('categoryStats');
        if (totalCategories > 0) {
            categoryStats.innerHTML = Object.entries(categories).map(([cat, count]) => `
                <div class="category-item">
                    <span class="category-name">${cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
                    <span class="category-count">${count}</span>
                </div>
            `).join('');
        } else {
            categoryStats.innerHTML = '<p>No categories yet.</p>';
        }
    } catch (error) {
        console.error('Error loading statistics:', error);
        document.getElementById('categoryStats').innerHTML = '<p>Error loading statistics. Make sure the backend is running on http://127.0.0.1:5500</p>';
    }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==================== ESCALATIONS ====================

// Socket.io connection
let adminSocket = null;
let currentEscalationId = null;
let currentEscalationUserId = null;
const adminId = localStorage.getItem('userId');

function initializeAdminSocket() {
    adminSocket = io('http://localhost:5500');
    
    adminSocket.on('connect', () => {
        console.log('Admin socket connected:', adminSocket.id);
        adminSocket.emit('admin-join', adminId);
    });

    adminSocket.on('escalations-update', (escalations) => {
        console.log('Escalations updated:', escalations);
        displayEscalationsList(escalations);
    });

    adminSocket.on('escalation-message', (data) => {
        console.log('New escalation message:', data);
        if (data.escalationId === currentEscalationId) {
            displayAdminEscalationMessage(data);
        }
    });

    adminSocket.on('escalation-status-changed', (data) => {
        if (data.escalationId === currentEscalationId) {
            document.getElementById('escalationStatus').textContent = data.status;
        }
        // Reload escalations list
        loadEscalations();
    });

    adminSocket.on('disconnect', () => {
        console.log('Admin socket disconnected');
    });

    adminSocket.on('error', (error) => {
        console.error('Admin socket error:', error);
    });
}

// Tab Navigation - add escalations handler
const tabNavigation = document.querySelectorAll('.nav-item');
tabNavigation.forEach(item => {
    item.addEventListener('click', () => {
        const tabName = item.dataset.tab;
        
        if (tabName === 'escalations') {
            loadEscalations();
        }
    });
});

// Load Escalations
async function loadEscalations() {
    try {
        const response = await fetch(`${API_URL}/escalations`);
        const data = await response.json();
        const escalations = data.escalations || [];
        
        displayEscalationsList(escalations);
    } catch (error) {
        console.error('Error loading escalations:', error);
        document.getElementById('escalationsList').innerHTML = '<p>Error loading escalations.</p>';
    }
}

// Display Escalations List
function displayEscalationsList(escalations) {
    const escalationsList = document.getElementById('escalationsList');
    
    if (!escalations || escalations.length === 0) {
        escalationsList.innerHTML = '<p>No active escalations.</p>';
        return;
    }
    
    escalationsList.innerHTML = escalations.map(esc => `
        <div class="user-item" onclick="viewEscalation(${esc.id}, ${esc.user_id}, '${escapeHtml(esc.username)}', '${esc.status}')" style="cursor:pointer;">
            <div class="user-info">
                <div class="user-name">🚨 Ticket #${esc.ticket_id}</div>
                <div class="user-email">User: ${escapeHtml(esc.username)}</div>
                <div class="user-messages" style="color:${esc.status === 'pending' ? '#ff6b6b' : '#51cf66'}">
                    Status: ${esc.status.toUpperCase()}
                </div>
                <div style="font-size:12px; color:#666; margin-top:5px;">
                    Issue: ${escapeHtml(esc.initial_question.substring(0, 50))}...
                </div>
            </div>
            <div class="user-date">${new Date(esc.created_at).toLocaleTimeString()}</div>
        </div>
    `).join('');
}

// View Escalation
async function viewEscalation(escalationId, userId, username, status) {
    currentEscalationId = escalationId;
    currentEscalationUserId = userId;
    
    try {
        const response = await fetch(`${API_URL}/escalations/${escalationId}`);
        const data = await response.json();
        const escalation = data.escalation;
        const messages = data.messages || [];
        
        // Update header info
        document.getElementById('selectedEscalationId').textContent = `Escalation #${escalation.ticket_id}`;
        document.getElementById('escalationUserName').textContent = username;
        document.getElementById('escalationStatus').textContent = status.toUpperCase();
        document.getElementById('escalationDate').textContent = new Date(escalation.created_at).toLocaleString();
        
        // Display messages
        const messagesContainer = document.getElementById('escalationMessagesContainer');
        messagesContainer.innerHTML = '';
        
        messages.forEach(msg => {
            displayAdminEscalationMessage(msg);
        });
        
        // Show chat container and hide list
        document.querySelector('.users-list') .style.display = 'none';
        document.getElementById('escalationChatContainer').style.display = 'block';
        
        // Focus on input
        document.getElementById('adminEscalationInput').focus();
    } catch (error) {
        console.error('Error loading escalation:', error);
        alert('Error loading escalation');
    }
}

// Display Escalation Message (for admin)
function displayAdminEscalationMessage(msg) {
    const container = document.getElementById('escalationMessagesContainer');
    const messageDiv = document.createElement('div');
    messageDiv.style.marginBottom = '10px';
    messageDiv.style.display = 'flex';
    messageDiv.style.justifyContent = msg.sender_type === 'user' || msg.senderType === 'user' ? 'flex-end' : 'flex-start';
    
    if (msg.sender_type === 'user' || msg.senderType === 'user') {
        messageDiv.innerHTML = `
            <div style="
                background:#e3e3e3;
                color:#333;
                max-width:70%;
                padding:10px 12px;
                border-radius:8px;
                word-wrap:break-word;
            ">
                <p style="margin:0; font-size:13px;"><strong>User:</strong> ${escapeHtml(msg.message_text || msg.messageText)}</p>
                <small style="color:#666; margin-top:3px; display:block;">${new Date(msg.timestamp).toLocaleTimeString()}</small>
            </div>
        `;
    } else {
        messageDiv.innerHTML = `
            <div style="
                background:#667eea;
                color:white;
                max-width:70%;
                padding:10px 12px;
                border-radius:8px;
                word-wrap:break-word;
            ">
                <p style="margin:0; font-size:13px;"><strong>You:</strong> ${escapeHtml(msg.message_text || msg.messageText)}</p>
                <small style="color:rgba(255,255,255,0.7); margin-top:3px; display:block;">${new Date(msg.timestamp).toLocaleTimeString()}</small>
            </div>
        `;
    }
    
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
}

// Send Escalation Message (admin)
const adminEscalationSendBtn = document.getElementById('adminEscalationSendBtn');
if (adminEscalationSendBtn) {
    adminEscalationSendBtn.onclick = () => {
        const message = document.getElementById('adminEscalationInput').value.trim();
        if (!message || !currentEscalationId) return;
        
        // Send via Socket.io - only display when server broadcasts it back
        adminSocket.emit('escalation-message', {
            escalationId: currentEscalationId,
            userId: currentEscalationUserId,
            adminId: adminId,
            senderType: 'admin',
            messageText: message
        });
        
        document.getElementById('adminEscalationInput').value = '';
    };
}

// Admin input enter key
const adminEscalationInput = document.getElementById('adminEscalationInput');
if (adminEscalationInput) {
    adminEscalationInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
            adminEscalationSendBtn.click();
            return false;
        }
    };
}

// Mark Escalation as Resolved
const completeEscalationBtn = document.getElementById('completeEscalationBtn');
if (completeEscalationBtn) {
    completeEscalationBtn.onclick = async () => {
        if (!currentEscalationId) return;
        
        if (!confirm('Mark this escalation as resolved?')) return;
        
        try {
            const response = await fetch(`${API_URL}/escalations/${currentEscalationId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'resolved', assignedAdminId: adminId })
            });
            
            if (!response.ok) throw new Error('Failed to update escalation');
            
            alert('Escalation marked as resolved!');
            
            // Emit status change via socket
            adminSocket.emit('escalation-status-update', {
                escalationId: currentEscalationId,
                status: 'resolved',
                assignedAdminId: adminId
            });
            
            // Back to list
            document.querySelector('.users-list').style.display = 'block';
            document.getElementById('escalationChatContainer').style.display = 'none';
            loadEscalations();
        } catch (error) {
            console.error('Error:', error);
            alert('Error updating escalation');
        }
    };
}

// Back to Escalations List
const backToEscalations = document.getElementById('backToEscalations');
if (backToEscalations) {
    backToEscalations.onclick = () => {
        document.querySelector('.users-list').style.display = 'block';
        document.getElementById('escalationChatContainer').style.display = 'none';
        currentEscalationId = null;
    };
}

// Refresh Escalations
const refreshEscalations = document.getElementById('refreshEscalations');
if (refreshEscalations) {
    refreshEscalations.onclick = () => {
        loadEscalations();
    };
}

// Initial load
loadFAQs();
initializeAdminSocket();
