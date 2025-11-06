// /js/auth.js
console.log('🔐 Auth.js loaded');

// Global authentication functions
async function updateAuthUI() {
    try {
        console.log('🔄 Updating auth UI...');
        const response = await fetch('/api/user-info');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const userInfo = await response.json();
        console.log('👤 User info:', userInfo);

        updateAuthButtons(userInfo);
        updateNavigation(userInfo);
        
        return userInfo;

    } catch (error) {
        console.error('❌ Error checking auth status:', error);
        setLoggedOutState();
        return { loggedIn: false };
    }
}

function updateAuthButtons(userInfo) {
    const authButtons = document.getElementById('authButtons');
    if (!authButtons) {
        console.log('❌ authButtons element not found');
        return;
    }

    if (userInfo.loggedIn) {
        console.log('✅ User logged in, showing logout button');
        authButtons.innerHTML = `
            <div style="display: flex; align-items: center; gap: 15px;">
                <span class="welcome-text">
                    <i class="fas fa-user-circle"></i> Welcome, ${userInfo.user.name}
                </span>
                <button class="btn btn-outline" onclick="logout()">
                    <i class="fas fa-sign-out-alt"></i> Logout
                </button>
            </div>
        `;
    } else {
        console.log('❌ User not logged in, showing login/register buttons');
        authButtons.innerHTML = `
            <div style="display: flex; gap: 10px;">
                <a href="/login.html" class="btn btn-outline">
                    <i class="fas fa-sign-in-alt"></i> Login
                </a>
                <a href="/register.html" class="btn btn-primary">
                    <i class="fas fa-user-plus"></i> Register
                </a>
            </div>
        `;
    }
}

function updateNavigation(userInfo) {
    const navThirdLink = document.getElementById('navThirdLink');
    const adminLink = document.getElementById('adminLink');

    if (userInfo.loggedIn) {
        console.log('🔄 Updating navigation for role:', userInfo.user.role);
        
        if (userInfo.user.role === 'organizer') {
            if (navThirdLink) {
                navThirdLink.textContent = 'Dashboard';
                navThirdLink.href = '/organizer-dashboard.html';
            }
        } else if (userInfo.user.role === 'admin') {
            if (navThirdLink) {
                navThirdLink.textContent = 'Admin';
                navThirdLink.href = '/admin-dashboard.html';
            }
        } else {
            if (navThirdLink) {
                navThirdLink.textContent = 'My Bookings';
                navThirdLink.href = '/my-bookings.html';
            }
        }

        if (adminLink) {
            adminLink.style.display = userInfo.user.role === 'admin' ? 'block' : 'none';
        }
    } else {
        console.log('🔄 Setting default navigation for logged out user');
        if (navThirdLink) {
            navThirdLink.textContent = 'My Bookings';
            navThirdLink.href = '/my-bookings.html';
        }
        if (adminLink) {
            adminLink.style.display = 'none';
        }
    }
}

function setLoggedOutState() {
    console.log('🔒 Setting logged out state');
    const authButtons = document.getElementById('authButtons');
    const navThirdLink = document.getElementById('navThirdLink');
    const adminLink = document.getElementById('adminLink');

    if (authButtons) {
        authButtons.innerHTML = `
            <div style="display: flex; gap: 10px;">
                <a href="/login.html" class="btn btn-outline">
                    <i class="fas fa-sign-in-alt"></i> Login
                </a>
                <a href="/register.html" class="btn btn-primary">
                    <i class="fas fa-user-plus"></i> Register
                </a>
            </div>
        `;
    }

    if (navThirdLink) {
        navThirdLink.textContent = 'My Bookings';
        navThirdLink.href = '/my-bookings.html';
    }

    if (adminLink) {
        adminLink.style.display = 'none';
    }
}

async function logout() {
    try {
        console.log('🚪 Logging out...');
        const response = await fetch('/api/logout', { 
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            showMessage('You have been logged out successfully.', 'success');
            setTimeout(() => {
                window.location.href = '/';
            }, 1500);
        } else {
            throw new Error('Logout failed');
        }
    } catch (error) {
        console.error('Logout error:', error);
        showMessage('Error during logout. Please try again.', 'error');
        setTimeout(() => {
            window.location.href = '/';
        }, 2000);
    }
}

function showMessage(message, type = 'info') {
    console.log(`📢 ${type.toUpperCase()}: ${message}`);
    
    let messageContainer = document.getElementById('messageContainer');
    if (!messageContainer) {
        messageContainer = document.createElement('div');
        messageContainer.id = 'messageContainer';
        messageContainer.style.position = 'fixed';
        messageContainer.style.top = '80px';
        messageContainer.style.left = '50%';
        messageContainer.style.transform = 'translateX(-50%)';
        messageContainer.style.zIndex = '1000';
        messageContainer.style.width = '90%';
        messageContainer.style.maxWidth = '500px';
        document.body.appendChild(messageContainer);
    }

    const icons = {
        'success': 'check-circle',
        'error': 'exclamation-triangle',
        'warning': 'exclamation-circle',
        'info': 'info-circle'
    };

    messageContainer.innerHTML = `
        <div class="alert alert-${type}">
            <i class="fas fa-${icons[type] || 'info-circle'}"></i> ${message}
        </div>
    `;

    if (type === 'success' || type === 'info') {
        setTimeout(() => {
            if (messageContainer) {
                messageContainer.innerHTML = '';
            }
        }, 5000);
    }
}

async function checkIfAlreadyLoggedIn(redirect = true) {
    try {
        const response = await fetch('/api/user-info');
        if (response.ok) {
            const userInfo = await response.json();
            if (userInfo.loggedIn) {
                showMessage(`You are already logged in as ${userInfo.user.name}. Redirecting...`, 'warning');
                
                if (redirect) {
                    setTimeout(() => {
                        if (userInfo.user.role === 'admin') {
                            window.location.href = '/admin-dashboard.html';
                        } else if (userInfo.user.role === 'organizer') {
                            window.location.href = '/organizer-dashboard.html';
                        } else {
                            window.location.href = '/events.html';
                        }
                    }, 2000);
                }
                return true;
            }
        }
        return false;
    } catch (error) {
        console.error('Error checking login status:', error);
        return false;
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM loaded, initializing auth...');
    updateAuthUI();
});