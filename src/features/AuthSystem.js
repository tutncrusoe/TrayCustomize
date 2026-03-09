export class AuthSystem {
    constructor() {
        this.modal = document.getElementById('login-modal');
        this.modalContent = document.getElementById('login-modal-content');
        this.closeBtn = document.getElementById('close-login-modal');
        // We use document.getElementById inside methods or event delegation for the loginBtn
        // in case the DOM changes.
        this.form = document.getElementById('login-form');
        this.emailInput = document.getElementById('login-email');
        this.tokenInput = document.getElementById('login-token');
        this.tokenContainer = document.getElementById('login-token-container');
        this.submitBtn = document.getElementById('login-submit-btn');
        this.errorText = document.getElementById('login-error');
        this.title = document.getElementById('login-title');
        this.desc = document.getElementById('login-desc');
        
        // Logout Modal elements
        this.logoutModal = document.getElementById('logout-modal');
        this.logoutModalContent = document.getElementById('logout-modal-content');
        this.cancelLogoutBtn = document.getElementById('cancel-logout-btn');
        this.confirmLogoutBtn = document.getElementById('confirm-logout-btn');

        this.step = 'email'; // 'email' or 'token'
        this.currentUser = null;
        this.isGithubPages = window.location.hostname.includes('github.io');
        this.apiBaseUrl = this.isGithubPages ? 'https://tecton3d-cloud.onrender.com' : '';
        this.initSession().then(() => {
            this.updateUI();
            this.bindEvents();
        });
    }

    async initSession() {
        try {
            const res = await fetch(`${this.apiBaseUrl}/api/auth/me`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                if (data.loggedIn) {
                    this.currentUser = { email: data.email };
                }
            }
        } catch (e) {
            console.error('Session check failed', e);
        }
    }

    bindEvents() {
        // Use event delegation for login button in case it is dynamically re-rendered or moved
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('#login-btn');
            if (btn) {
                if (this.currentUser) {
                    this.openLogoutModal();
                } else {
                    this.openModal();
                }
            }
        });

        // Logout Modal specific bindings
        if (this.cancelLogoutBtn) {
            this.cancelLogoutBtn.addEventListener('click', () => this.closeLogoutModal());
        }

        if (this.confirmLogoutBtn) {
            this.confirmLogoutBtn.addEventListener('click', () => {
                this.closeLogoutModal();
                this.logout();
            });
        }

        if (this.logoutModal) {
            this.logoutModal.addEventListener('click', (e) => {
                if (e.target === this.logoutModal) this.closeLogoutModal();
            });
        }

        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.closeModal());
        }

        if (this.modal) {
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) this.closeModal();
            });
        }

        if (this.form) {
            this.form.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                if (this.step === 'email') {
                    await this.handleSendToken();
                } else {
                    await this.handleVerifyToken();
                }
            });
        }
    }

    openModal() {
        this.step = 'email';
        this.emailInput.value = '';
        this.emailInput.disabled = false;
        this.tokenInput.value = '';
        this.tokenContainer.classList.add('hidden');
        this.submitBtn.innerHTML = 'Send Token';
        this.errorText.classList.add('hidden');
        this.title.innerText = 'Sign in';
        this.desc.innerText = 'via secure email token';

        this.modal.classList.remove('hidden');
        // Trigger reflow
        void this.modal.offsetWidth;
        this.modal.classList.remove('opacity-0');
        this.modalContent.classList.remove('scale-95');
        this.modalContent.classList.add('scale-100');
        
        setTimeout(() => this.emailInput.focus(), 100);
    }

    closeModal() {
        this.modal.classList.add('opacity-0');
        this.modalContent.classList.add('scale-95');
        this.modalContent.classList.remove('scale-100');
        setTimeout(() => {
            this.modal.classList.add('hidden');
        }, 200);
    }

    openLogoutModal() {
        if (!this.logoutModal) return;
        this.logoutModal.classList.remove('hidden');
        // Trigger reflow
        void this.logoutModal.offsetWidth;
        this.logoutModal.classList.remove('opacity-0');
        this.logoutModalContent.classList.remove('scale-95');
        this.logoutModalContent.classList.add('scale-100');
    }

    closeLogoutModal() {
        if (!this.logoutModal) return;
        this.logoutModal.classList.add('opacity-0');
        this.logoutModalContent.classList.add('scale-95');
        this.logoutModalContent.classList.remove('scale-100');
        setTimeout(() => {
            this.logoutModal.classList.add('hidden');
        }, 200);
    }

    showError(msg) {
        this.errorText.innerText = msg;
        this.errorText.classList.remove('hidden');
    }

    setLoading(isLoading) {
        if (isLoading) {
            this.submitBtn.disabled = true;
            this.submitBtn.classList.add('opacity-70');
            this.submitBtn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Processing...';
            if (typeof lucide !== 'undefined') lucide.createIcons();
        } else {
            this.submitBtn.disabled = false;
            this.submitBtn.classList.remove('opacity-70');
            this.submitBtn.innerHTML = this.step === 'email' ? 'Send Token' : 'Verify & Log in';
        }
    }

    async handleSendToken() {
        const email = this.emailInput.value.trim();
        if (!email) return;

        this.errorText.classList.add('hidden');
        this.setLoading(true);

        try {
            const res = await fetch(`${this.apiBaseUrl}/api/auth/send-token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
                credentials: 'include'
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Failed to send token');

            // Success
            this.step = 'token';
            this.emailInput.disabled = true;
            this.tokenContainer.classList.remove('hidden');
            this.title.innerText = 'Enter Token';
            this.desc.innerText = `Sent to ${email}`;
            this.tokenInput.required = true;
            setTimeout(() => this.tokenInput.focus(), 100);
        } catch (err) {
            this.showError(err.message);
        } finally {
            this.setLoading(false);
        }
    }

    async handleVerifyToken() {
        const email = this.emailInput.value.trim();
        const token = this.tokenInput.value.trim();
        if (!token) return;

        this.errorText.classList.add('hidden');
        this.setLoading(true);

        try {
            const res = await fetch(`${this.apiBaseUrl}/api/auth/verify-token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, token }),
                credentials: 'include'
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Invalid token');

            // Success login (Server sets HttpOnly cookie)
            this.currentUser = { email };
            this.updateUI();
            this.closeModal();
        } catch (err) {
            this.showError(err.message);
        } finally {
            this.setLoading(false);
        }
    }

    async logout() {
        try {
            await fetch(`${this.apiBaseUrl}/api/auth/logout`, { method: 'POST', credentials: 'include' });
        } catch (e) {
            console.error('Logout failed', e);
        }
        this.currentUser = null;
        this.updateUI();
    }

    updateUI() {
        const currentLoginBtn = document.getElementById('login-btn');
        const currentBtnText = document.getElementById('login-btn-text');
        
        if (!currentLoginBtn || !currentBtnText) return;
        
        if (this.currentUser) {
            // Logged in
            currentBtnText.innerText = this.currentUser.email.split('@')[0];
            // change icon
            const icon = currentLoginBtn.querySelector('i');
            if (icon) {
                icon.setAttribute('data-lucide', 'log-out');
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }
        } else {
            // Logged out
            currentBtnText.innerText = 'Log in';
            const icon = currentLoginBtn.querySelector('i');
            if (icon) {
                icon.setAttribute('data-lucide', 'user');
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }
        }
    }
}
