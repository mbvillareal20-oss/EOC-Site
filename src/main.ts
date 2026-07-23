import { 
  initAuth, 
  subscribeAuth, 
  loginWithGoogle, 
  loginWithEmail,
  logoutUser, 
  getCurrentAuthState 
} from './auth';
import { 
  subscribeReferences, 
  subscribeSettings 
} from './db';
import { ReferenceItem, PortalSettings, UserAccount } from './types';

// DOM Elements
let currentCategory = 'All';
let currentSearch = '';
let references: ReferenceItem[] = [];
let portalSettings: PortalSettings | null = null;

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  initAuth();

  // Subscribe to Auth State
  subscribeAuth((state) => {
    renderAuthViews(state);
  });

  // Subscribe to Realtime Data
  subscribeReferences((items) => {
    references = items;
    renderReferences();
  });

  subscribeSettings((settings) => {
    portalSettings = settings;
    applyPortalSettings(settings);
  });
});

/**
 * Render Auth Views: Login Screen, Access Denied, or Main Portal
 */
function renderAuthViews(state: any) {
  let authOverlay = document.getElementById('authOverlay');
  let deniedOverlay = document.getElementById('deniedOverlay');

  // 1. Loading State
  if (state.loading) {
    return;
  }

  // 2. Not Logged In -> Visitor mode (view links directly)
  if (!state.user) {
    if (authOverlay && authOverlay.getAttribute('data-manual-open') !== 'true') {
      authOverlay.style.display = 'none';
    }
    if (deniedOverlay) deniedOverlay.style.display = 'none';
    renderUserHeaderPill(null, null);
    return;
  }

  // 3. Logged In but Access Denied (Not in users collection or suspended)
  if (state.accessDenied) {
    if (authOverlay) authOverlay.style.display = 'none';
    showAccessDeniedOverlay(state.deniedEmail || state.user.email);
    return;
  }

  // 4. Authorized User -> Hide Auth overlays, show portal with user profile
  if (authOverlay) authOverlay.style.display = 'none';
  if (deniedOverlay) deniedOverlay.style.display = 'none';

  renderUserHeaderPill(state.account, state.user);
}

/**
 * Show Google / Email Sign-In Modal
 */
function showLoginOverlay() {
  let authOverlay = document.getElementById('authOverlay');
  if (!authOverlay) {
    authOverlay = document.createElement('div');
    authOverlay.id = 'authOverlay';
    authOverlay.className = 'auth-overlay';
    document.body.appendChild(authOverlay);
  }

  authOverlay.setAttribute('data-manual-open', 'true');

  const logoUrl = portalSettings?.logoUrl || '/src/assets/images/eoc_portal_logo_1784808168520.jpg';
  const currentHost = window.location.hostname;

  authOverlay.innerHTML = `
    <div class="auth-card" style="max-width: 440px; width: 90%; position: relative;">
      <button id="closeAuthModalBtn" title="Close modal" style="position: absolute; top: 0.85rem; right: 0.85rem; background: none; border: none; font-size: 1.25rem; color: var(--text-muted); cursor: pointer; padding: 4px; line-height: 1;">✕</button>

      <img src="${logoUrl}" class="auth-logo" alt="DSWD EOC Logo" />
      <div>
        <h2 class="auth-title">EOC Reference Portal</h2>
        <p class="auth-subtitle" style="margin-top: 0.35rem;">
          Department of Social Welfare and Development<br/>
          Emergency Operation Center
        </p>
      </div>

      <!-- Direct Email Access -->
      <div style="background-color: var(--bg-main); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); text-align: left;">
        <label style="display: block; font-size: 0.8rem; font-weight: 600; color: var(--text-main); margin-bottom: 0.35rem;">
          ✉️ Sign In with Authorized Email
        </label>
        <div style="display: flex; gap: 0.5rem; margin-top: 0.25rem;">
          <input type="email" id="emailAuthInput" placeholder="name@dswd.gov.ph" value="mblvillareal@dswd.gov.ph" class="form-input" style="flex: 1; font-size: 0.85rem; padding: 0.5rem 0.75rem;" />
          <button id="emailAuthBtn" class="btn btn-primary" style="white-space: nowrap; font-size: 0.85rem; padding: 0.5rem 0.9rem;">
            Sign In
          </button>
        </div>
        <p style="font-size: 0.725rem; color: var(--text-muted); margin-top: 0.35rem; line-height: 1.3;">
          Authorized DSWD accounts (@dswd.gov.ph) gain instant access to reference materials &amp; Admin features.
        </p>
      </div>

      <div style="display: flex; align-items: center; gap: 0.75rem; color: var(--text-muted); font-size: 0.75rem;">
        <div style="flex: 1; height: 1px; background-color: var(--border-subtle);"></div>
        <span>OR</span>
        <div style="flex: 1; height: 1px; background-color: var(--border-subtle);"></div>
      </div>

      <!-- Google Sign In Button -->
      <button id="authLoginBtn" class="google-signin-btn" style="margin: 0;">
        <svg width="20" height="20" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
          <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.29v3.15C3.26 21.3 7.37 24 12 24z"/>
          <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.29C.47 8.21 0 10.05 0 12s.47 3.79 1.29 5.42l3.99-3.15z"/>
          <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.37 0 3.26 2.7 1.29 6.58l3.99 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
        </svg>
        <span>Sign in with Google OAuth</span>
      </button>

      <!-- Domain Helper Banner -->
      <div style="background-color: var(--bg-card); border: 1px solid var(--border-subtle); padding: 0.65rem 0.85rem; border-radius: 6px; font-size: 0.75rem; color: var(--text-muted); text-align: left;">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
          <span style="font-weight: 600; color: var(--text-main);">Current App Domain:</span>
          <button id="copyDomainBtn" class="btn btn-secondary btn-sm" style="font-size: 0.7rem; padding: 0.2rem 0.5rem;">📋 Copy Domain</button>
        </div>
        <code id="domainCode" style="font-family: monospace; font-size: 0.725rem; word-break: break-all; color: var(--primary); display: block; margin-bottom: 0.25rem;">${currentHost}</code>
        <span style="display: block; font-size: 0.7rem; color: var(--text-muted);">To enable Google Popup Auth, add this domain in <strong>Firebase Console → Authentication → Settings → Authorized domains</strong>.</span>
      </div>

      <button id="continueVisitorBtn" class="btn btn-secondary" style="width: 100%; margin-top: 0.25rem; font-size: 0.825rem;">
        Continue Browsing as Visitor
      </button>

      <div id="authErrorMsg" style="display: none; padding: 0.75rem; border-radius: 6px; background-color: rgba(220,38,38,0.1); border: 1px solid rgba(220,38,38,0.3); color: #dc2626; font-size: 0.8rem; text-align: center; line-height: 1.4;"></div>
    </div>
  `;

  authOverlay.style.display = 'flex';

  const closeOverlay = () => {
    if (authOverlay) {
      authOverlay.style.display = 'none';
      authOverlay.removeAttribute('data-manual-open');
    }
  };

  document.getElementById('closeAuthModalBtn')?.addEventListener('click', closeOverlay);
  document.getElementById('continueVisitorBtn')?.addEventListener('click', closeOverlay);

  // Email Sign In Event Handler
  const emailAuthBtn = document.getElementById('emailAuthBtn') as HTMLButtonElement | null;
  const emailAuthInput = document.getElementById('emailAuthInput') as HTMLInputElement | null;
  const errorMsgEl = document.getElementById('authErrorMsg');

  if (emailAuthBtn && emailAuthInput) {
    emailAuthBtn.addEventListener('click', async () => {
      if (errorMsgEl) errorMsgEl.style.display = 'none';
      const val = emailAuthInput.value.trim();
      if (!val) {
        if (errorMsgEl) {
          errorMsgEl.textContent = 'Please enter an email address.';
          errorMsgEl.style.display = 'block';
        }
        return;
      }

      emailAuthBtn.disabled = true;
      emailAuthBtn.textContent = 'Signing in...';

      try {
        await loginWithEmail(val);
        closeOverlay();
      } catch (err: any) {
        console.error('Email login error:', err);
        if (errorMsgEl) {
          errorMsgEl.textContent = err?.message || 'Failed to sign in with email.';
          errorMsgEl.style.display = 'block';
        }
      } finally {
        emailAuthBtn.disabled = false;
        emailAuthBtn.textContent = 'Sign In';
      }
    });

    emailAuthInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        emailAuthBtn.click();
      }
    });
  }

  // Copy Domain Event Handler
  document.getElementById('copyDomainBtn')?.addEventListener('click', () => {
    navigator.clipboard.writeText(currentHost);
    showToast('Domain copied to clipboard!');
  });

  // Google Login Event Handler
  const loginBtn = document.getElementById('authLoginBtn');
  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      if (errorMsgEl) errorMsgEl.style.display = 'none';

      try {
        await loginWithGoogle();
        closeOverlay();
      } catch (err: any) {
        console.error('Login error:', err);
        let msg = 'Google Sign-In failed. Please try again.';
        if (err?.code === 'auth/popup-blocked') {
          msg = 'Pop-up blocked by browser! Please allow pop-ups for this site or use Direct Email Sign-In above.';
        } else if (err?.code === 'auth/unauthorized-domain') {
          msg = `Domain "${currentHost}" is not authorized in Firebase Console yet! Please use Direct Email Sign-In above, or add this domain under Firebase Console → Authentication → Settings → Authorized Domains.`;
        } else if (err?.code === 'auth/operation-not-allowed') {
          msg = 'Google provider is disabled in Firebase Console! Please use Direct Email Sign-In above or enable Google Sign-In in Firebase Console.';
        } else if (err?.message) {
          msg = `Sign-in error: ${err.message}`;
        }

        if (errorMsgEl) {
          errorMsgEl.textContent = msg;
          errorMsgEl.style.display = 'block';
        } else {
          showToast(msg);
        }
      }
    });
  }
}

/**
 * Show Access Denied View
 */
function showAccessDeniedOverlay(email: string) {
  let deniedOverlay = document.getElementById('deniedOverlay');
  if (!deniedOverlay) {
    deniedOverlay = document.createElement('div');
    deniedOverlay.id = 'deniedOverlay';
    deniedOverlay.className = 'auth-overlay';
    document.body.appendChild(deniedOverlay);
  }

  deniedOverlay.innerHTML = `
    <div class="denied-card" style="position: relative;">
      <button id="closeDeniedBtn" style="position: absolute; top: 0.85rem; right: 0.85rem; background: none; border: none; font-size: 1.25rem; color: var(--text-muted); cursor: pointer; padding: 4px; line-height: 1;">✕</button>

      <div class="denied-icon-box">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
      </div>
      <div>
        <h2 class="denied-title">Access Restricted</h2>
        <div class="denied-email-badge" style="margin-top: 0.5rem; display: inline-block;">
          ${email}
        </div>
      </div>
      <p class="denied-message">
        Your account is not registered as an Admin. You can continue viewing all public reference links as a visitor.
      </p>
      <div style="display: flex; flex-direction: column; gap: 0.5rem; width: 100%; margin-top: 0.5rem;">
        <button id="deniedVisitorBtn" class="btn btn-primary" style="width: 100%;">
          Continue Browsing as Visitor
        </button>
        <button id="deniedSignOutBtn" class="btn btn-secondary" style="width: 100%;">
          Sign Out &amp; Switch Account
        </button>
      </div>
    </div>
  `;

  deniedOverlay.style.display = 'flex';

  document.getElementById('closeDeniedBtn')?.addEventListener('click', () => {
    deniedOverlay!.style.display = 'none';
  });
  document.getElementById('deniedVisitorBtn')?.addEventListener('click', () => {
    deniedOverlay!.style.display = 'none';
  });
  document.getElementById('deniedSignOutBtn')?.addEventListener('click', () => {
    logoutUser();
    deniedOverlay!.style.display = 'none';
  });
}

/**
 * Render User Profile Pill & Admin Panel Button in Header
 */
function renderUserHeaderPill(account: UserAccount | null, user: any) {
  const brandBar = document.querySelector('.brand-bar');
  if (!brandBar) return;

  // Check existing user pill container
  let userContainer = document.getElementById('userHeaderNav');
  if (!userContainer) {
    userContainer = document.createElement('div');
    userContainer.id = 'userHeaderNav';
    userContainer.style.display = 'flex';
    userContainer.style.alignItems = 'center';
    userContainer.style.gap = '0.75rem';
    brandBar.appendChild(userContainer);
  }

  if (!user) {
    userContainer.innerHTML = `
      <button id="openSignInModalBtn" style="display: flex; align-items: center; gap: 0.45rem; padding: 0.45rem 0.85rem; font-size: 0.825rem; font-weight: 600; border-radius: 20px; background: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.25); color: #ffffff; backdrop-filter: blur(4px); cursor: pointer; transition: all 0.2s ease;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
          <polyline points="10 17 15 12 10 7"></polyline>
          <line x1="15" y1="12" x2="3" y2="12"></line>
        </svg>
        <span>🔑 Admin / Staff Sign In</span>
      </button>
    `;

    document.getElementById('openSignInModalBtn')?.addEventListener('click', () => {
      showLoginOverlay();
    });
    return;
  }

  const role = account?.role || 'Viewer';
  const isAdmin = role === 'Admin';
  const name = account?.name || user?.displayName || user?.email?.split('@')[0] || 'User';
  const photo = user?.photoURL || '';

  userContainer.innerHTML = `
    ${isAdmin ? `
      <a href="admin.html" class="admin-nav-link" aria-label="Open Admin Panel">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
        <span>Admin Panel</span>
      </a>
    ` : ''}

    <div class="user-profile-pill">
      ${photo ? `<img src="${photo}" class="user-avatar" alt="${name}" />` : `
        <div class="user-avatar" style="display: flex; align-items: center; justify-content: center; background: #e2e8f0; color: #1e293b; font-weight: 700; font-size: 12px;">
          ${name.charAt(0).toUpperCase()}
        </div>
      `}
      <span>${name}</span>
      <span class="role-badge ${isAdmin ? 'admin' : 'viewer'}">${role}</span>
      <button id="headerSignOutBtn" style="background: none; border: none; color: #ffffff; opacity: 0.8; cursor: pointer; display: flex; align-items: center; padding: 2px; margin-left: 4px;" title="Sign Out">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
          <polyline points="16 17 21 12 16 7"></polyline>
          <line x1="21" y1="12" x2="9" y2="12"></line>
        </svg>
      </button>
    </div>
  `;

  document.getElementById('headerSignOutBtn')?.addEventListener('click', () => {
    logoutUser();
  });
}

/**
 * Apply Settings (Title, Subtitle, Colors, Banner, Footer)
 */
function applyPortalSettings(settings: PortalSettings) {
  const mainTitleEl = document.querySelector('.main-title');
  const titleText = settings.mainTitle || settings.title;
  if (mainTitleEl && titleText) mainTitleEl.textContent = titleText;

  const subtitleEl = document.querySelector('.subtitle');
  if (subtitleEl && settings.subtitle) subtitleEl.textContent = settings.subtitle;

  const logoImgEl = document.getElementById('portalLogo') as HTMLImageElement;
  const logoSrc = settings.logoUrl || settings.logo;
  if (logoImgEl && logoSrc) logoImgEl.src = logoSrc;

  const headerEl = document.querySelector('.portal-header') as HTMLElement;
  const bannerSrc = settings.bannerUrl || settings.bannerImage;
  if (headerEl) {
    if (bannerSrc) {
      headerEl.style.backgroundImage = `linear-gradient(rgba(0, 30, 60, 0.75), rgba(0, 30, 60, 0.85)), url('${bannerSrc}')`;
      headerEl.style.backgroundSize = 'cover';
      headerEl.style.backgroundPosition = 'center';
    } else {
      headerEl.style.backgroundImage = 'none';
      headerEl.style.backgroundColor = settings.headerBgColor || '#003366';
    }

    if (settings.bannerHeight) {
      headerEl.style.minHeight = `${settings.bannerHeight}px`;
    }
  }

  // Footer text
  const footerEl = document.querySelector('.footer-text') || document.querySelector('footer p');
  if (footerEl && settings.footer) {
    footerEl.textContent = settings.footer;
  }

  // Update theme colors
  if (settings.primaryColor) {
    document.documentElement.style.setProperty('--header-border', settings.primaryColor);
  }
}

/**
 * Render Reference Cards
 */
function renderReferences() {
  const cardsGrid = document.getElementById('cardsGrid');
  const emptyState = document.getElementById('emptyState');
  const displayedCount = document.getElementById('displayedCount');
  const totalCount = document.getElementById('totalCount');

  if (!cardsGrid || !emptyState) return;

  // Filter only visible cards for portal view
  let items = references.filter(item => item.visible !== false);

  if (totalCount) totalCount.textContent = items.length.toString();

  // Category filter
  if (currentCategory !== 'All') {
    items = items.filter(item => item.category?.toLowerCase() === currentCategory.toLowerCase());
  }

  // Search filter
  if (currentSearch.trim()) {
    const term = currentSearch.toLowerCase().trim();
    items = items.filter(item => 
      item.title.toLowerCase().includes(term) ||
      (item.description && item.description.toLowerCase().includes(term)) ||
      item.category.toLowerCase().includes(term) ||
      (item.badge && item.badge.toLowerCase().includes(term))
    );
  }

  if (displayedCount) displayedCount.textContent = items.length.toString();

  if (items.length === 0) {
    cardsGrid.innerHTML = '';
    emptyState.style.display = 'flex';
    return;
  }

  emptyState.style.display = 'none';

  cardsGrid.innerHTML = items.map(item => `
    <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="reference-card" id="ref-card-${item.id}">
      <div class="card-top">
        <div class="card-header-row">
          <div class="icon-box">
            <img src="${getItemIconUrl(item)}" alt="${escapeHtml(item.title)}" />
          </div>
          <div class="card-tags">
            <span class="category-tag">${escapeHtml(item.category)}</span>
            ${item.badge ? `<span class="badge-tag">${escapeHtml(item.badge)}</span>` : ''}
          </div>
        </div>
        <div class="card-body">
          <h3 class="card-title">${escapeHtml(item.title)}</h3>
          ${item.description ? `<p class="card-description">${escapeHtml(item.description)}</p>` : ''}
        </div>
      </div>
      <div class="card-footer">
        <span class="action-link">
          <span>Open Link</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="7" y1="17" x2="17" y2="7"></line>
            <polyline points="7 7 17 7 17 17"></polyline>
          </svg>
        </span>
        <button class="copy-btn" data-url="${escapeHtml(item.url)}" title="Copy Link to Clipboard">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </button>
      </div>
    </a>
  `).join('');

  // Attach event listeners to copy buttons
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const url = btn.getAttribute('data-url');
      if (url) {
        navigator.clipboard.writeText(url);
        showToast('Link copied to clipboard!');
      }
    });
  });
}

/**
 * Setup Event Listeners for Search & Filters
 */
function setupEventListeners() {
  const searchInput = document.getElementById('searchInput') as HTMLInputElement;
  const clearSearchBtn = document.getElementById('clearSearchBtn');

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      currentSearch = searchInput.value;
      if (clearSearchBtn) clearSearchBtn.style.display = currentSearch ? 'block' : 'none';
      renderReferences();
    });

    // Keyboard shortcut '/' to search
    window.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== searchInput) {
        e.preventDefault();
        searchInput.focus();
      }
    });
  }

  if (clearSearchBtn && searchInput) {
    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      currentSearch = '';
      clearSearchBtn.style.display = 'none';
      renderReferences();
    });
  }

  // Category filter buttons
  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCategory = btn.getAttribute('data-category') || 'All';
      renderReferences();
    });
  });

  // Reset filters button
  document.getElementById('resetFilterBtn')?.addEventListener('click', () => {
    currentCategory = 'All';
    currentSearch = '';
    if (searchInput) searchInput.value = '';
    if (clearSearchBtn) clearSearchBtn.style.display = 'none';
    filterBtns.forEach(b => {
      if (b.getAttribute('data-category') === 'All') b.classList.add('active');
      else b.classList.remove('active');
    });
    renderReferences();
  });
}

function getItemIconUrl(item: ReferenceItem): string {
  const custom = item.logoUrl || item.logo;
  if (custom && custom.trim()) {
    return custom.trim();
  }
  return getIconSvgPath(item.icon);
}

function getIconSvgPath(icon: string): string {
  switch (icon?.toLowerCase()) {
    case 'drive': return './assets/drive.svg';
    case 'sheets': return './assets/sheets.svg';
    case 'slides': return './assets/slides.svg';
    case 'meet': return './assets/meet.svg';
    case 'forms': return './assets/forms.svg';
    case 'pdf': return './assets/pdf.svg';
    default: return './assets/website.svg';
  }
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function showToast(message: string) {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMessage');
  if (toast && toastMsg) {
    toastMsg.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }
}
