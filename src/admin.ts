import { 
  initAuth, 
  subscribeAuth, 
  logoutUser, 
  getCurrentAuthState 
} from './auth';
import { 
  subscribeReferences, 
  subscribeSettings, 
  subscribeUsers, 
  saveReference, 
  deleteReference, 
  toggleReferenceVisibility, 
  updateReferencesOrder, 
  updatePortalSettings, 
  addUserAccount, 
  updateUserRole, 
  deleteUserAccount 
} from './db';
import { uploadFileToStorage, isSupabaseConfigured, supabaseUrl, supabaseAnonKey } from './supabase';
import { ReferenceItem, PortalSettings, UserAccount, UserRole } from './types';

// Admin State
let currentTab: 'dashboard' | 'references' | 'users' | 'banner' | 'appearance' | 'supabase' = 'dashboard';
let referencesList: ReferenceItem[] = [];
let usersList: UserAccount[] = [];
let portalSettings: PortalSettings | null = null;
let currentAdminSearch = '';
let currentUsersSearch = '';

document.addEventListener('DOMContentLoaded', () => {
  initAuth();

  // Auth Protection Guard
  subscribeAuth((state) => {
    if (state.loading) return;

    const userRole = state.account?.role?.toString().toLowerCase();

    if (!state.user || state.accessDenied || userRole !== 'admin') {
      // Non-admin or unauthenticated user trying to access admin page -> redirect to portal
      alert('Access Restricted: Only portal Administrators can access the Admin Management Console.');
      window.location.href = 'index.html';
      return;
    }

    renderAdminShell(state.account, state.user);
  });

  // Subscribe to real-time collections
  subscribeReferences((items) => {
    referencesList = items;
    renderTabContent();
  });

  subscribeSettings((settings) => {
    portalSettings = settings;
    renderTabContent();
  });

  subscribeUsers((users) => {
    usersList = users;
    renderTabContent();
  });
});

/**
 * Render the Admin Dashboard Layout
 */
function renderAdminShell(account: UserAccount | null, user: any) {
  const mainEl = document.querySelector('main');
  if (!mainEl) return;

  // Build Sidebar & Main Pane Layout
  mainEl.innerHTML = `
    <div class="container">
      <div class="admin-layout">
        
        <!-- Left Sidebar Navigation -->
        <aside class="admin-sidebar">
          <div class="sidebar-title">Admin Navigation</div>
          
          <button class="sidebar-nav-btn ${currentTab === 'dashboard' ? 'active' : ''}" data-tab="dashboard">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            <span>Dashboard</span>
          </button>

          <button class="sidebar-nav-btn ${currentTab === 'references' ? 'active' : ''}" data-tab="references">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
            <span>References</span>
          </button>

          <button class="sidebar-nav-btn ${currentTab === 'users' ? 'active' : ''}" data-tab="users">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            <span>Users</span>
          </button>

          <button class="sidebar-nav-btn ${currentTab === 'banner' ? 'active' : ''}" data-tab="banner">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
            <span>Banner &amp; Logo</span>
          </button>

          <button class="sidebar-nav-btn ${currentTab === 'appearance' ? 'active' : ''}" data-tab="appearance">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 2a10 10 0 0 0 0 20z"></path>
            </svg>
            <span>Appearance</span>
          </button>

          <button class="sidebar-nav-btn ${currentTab === 'supabase' ? 'active' : ''}" data-tab="supabase">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
            </svg>
            <span>Database &amp; Supabase</span>
          </button>

          <hr style="border: none; border-top: 1px solid var(--border-subtle); margin: 0.5rem 0;" />

          <button id="adminLogoutBtn" class="sidebar-nav-btn" style="color: #dc2626;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span>Logout</span>
          </button>
        </aside>

        <!-- Right Content Pane -->
        <div id="adminContentPane" class="admin-content-pane">
          <!-- Dynamically populated based on active tab -->
        </div>

      </div>
    </div>
  `;

  // Attach tab switching handlers
  document.querySelectorAll('.sidebar-nav-btn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab') as any;
      if (tab) {
        currentTab = tab;
        document.querySelectorAll('.sidebar-nav-btn[data-tab]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderTabContent();
      }
    });
  });

  document.getElementById('adminLogoutBtn')?.addEventListener('click', () => {
    logoutUser();
  });

  renderTabContent();
}

/**
 * Render Content Pane based on active tab
 */
function renderTabContent() {
  const pane = document.getElementById('adminContentPane');
  if (!pane) return;

  switch (currentTab) {
    case 'dashboard':
      renderDashboardTab(pane);
      break;
    case 'references':
      renderReferencesTab(pane);
      break;
    case 'users':
      renderUsersTab(pane);
      break;
    case 'banner':
      renderBannerTab(pane);
      break;
    case 'appearance':
      renderAppearanceTab(pane);
      break;
    case 'supabase':
      renderSupabaseTab(pane);
      break;
  }
}

/**
 * 📊 Dashboard Tab
 */
function renderDashboardTab(pane: HTMLElement) {
  const visibleCount = referencesList.filter(r => r.visible !== false).length;
  const adminCount = usersList.filter(u => u.role === 'Admin').length;

  pane.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
      <h2 style="font-size: 1.35rem; font-weight: 800; color: var(--text-main);">Dashboard Overview</h2>
      
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">📁</div>
          <div>
            <div class="stat-value">${referencesList.length}</div>
            <div class="stat-label">Total Reference Links</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon">👁</div>
          <div>
            <div class="stat-value">${visibleCount}</div>
            <div class="stat-label">Visible on Portal</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon">👥</div>
          <div>
            <div class="stat-value">${usersList.length}</div>
            <div class="stat-label">Registered Users</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon">👑</div>
          <div>
            <div class="stat-value">${adminCount}</div>
            <div class="stat-label">System Admins</div>
          </div>
        </div>
      </div>

      <div style="background-color: var(--surface-white); border: 1px solid var(--border-subtle); border-radius: var(--radius-card); padding: 1.5rem; box-shadow: var(--shadow-card);">
        <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 1rem;">Quick Actions</h3>
        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
          <button id="quickAddRefBtn" class="btn btn-primary">➕ Add Reference</button>
          <button id="quickAddUserBtn" class="btn btn-secondary">👤 Manage Users</button>
          <button id="quickBannerBtn" class="btn btn-secondary">🖼 Customize Banner</button>
          <button id="quickDbBtn" class="btn btn-secondary">⚡ Database &amp; Supabase</button>
          <a href="index.html" class="btn btn-secondary">🌐 View Live Portal</a>
        </div>
      </div>
    </div>
  `;

  document.getElementById('quickAddRefBtn')?.addEventListener('click', () => {
    currentTab = 'references';
    renderAdminShell(null, null);
    openAddReferenceModal();
  });

  document.getElementById('quickAddUserBtn')?.addEventListener('click', () => {
    currentTab = 'users';
    renderAdminShell(null, null);
  });

  document.getElementById('quickBannerBtn')?.addEventListener('click', () => {
    currentTab = 'banner';
    renderAdminShell(null, null);
  });

  document.getElementById('quickDbBtn')?.addEventListener('click', () => {
    currentTab = 'supabase';
    renderAdminShell(null, null);
  });
}

/**
 * 📁 References Management Tab
 */
function renderReferencesTab(pane: HTMLElement) {
  let filtered = [...referencesList];

  if (currentAdminSearch.trim()) {
    const term = currentAdminSearch.toLowerCase().trim();
    filtered = filtered.filter(item => 
      item.title.toLowerCase().includes(term) ||
      item.category.toLowerCase().includes(term) ||
      (item.description && item.description.toLowerCase().includes(term)) ||
      item.url.toLowerCase().includes(term)
    );
  }

  pane.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 1rem;">
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
        <div>
          <h2 style="font-size: 1.35rem; font-weight: 800; color: var(--text-main);">References Management</h2>
          <p style="font-size: 0.85rem; color: var(--text-muted);">Add, edit, reorder, or hide references on the portal.</p>
        </div>
        <button id="addRefBtn" class="btn btn-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          <span>Add New Reference</span>
        </button>
      </div>

      <input 
        type="text" 
        id="adminSearchInput" 
        class="form-control" 
        placeholder="Filter references by title, category, description, or URL..." 
        value="${escapeHtml(currentAdminSearch)}"
      />

      <div id="adminRefList">
        ${filtered.length === 0 ? `
          <div class="empty-state">
            <p>No reference items found matching your search.</p>
          </div>
        ` : filtered.map((item, idx) => `
          <div class="admin-item-card ${item.visible === false ? 'is-hidden' : ''}" data-id="${item.id}">
            <div class="admin-item-left">
              <div class="reorder-controls">
                <button class="reorder-btn move-up-btn" data-id="${item.id}" ${idx === 0 ? 'disabled style="opacity:0.3"' : ''} title="Move Up">▲</button>
                <button class="reorder-btn move-down-btn" data-id="${item.id}" ${idx === filtered.length - 1 ? 'disabled style="opacity:0.3"' : ''} title="Move Down">▼</button>
              </div>

              <div style="width: 38px; height: 38px; border-radius: 8px; background: var(--bg-main); display: flex; align-items: center; justify-content: center; flex-shrink: 0; padding: 4px; border: 1px solid var(--border-subtle); overflow: hidden;">
                <img src="${getItemIconUrl(item)}" alt="${escapeHtml(item.title)}" style="width: 100%; height: 100%; object-fit: contain;" />
              </div>

              <div class="admin-item-details">
                <div class="admin-item-title">
                  <span>${escapeHtml(item.title)}</span>
                  <span class="category-tag">${escapeHtml(item.category)}</span>
                  ${item.badge ? `<span class="badge-tag">${escapeHtml(item.badge)}</span>` : ''}
                  <span class="visible-badge ${item.visible !== false ? 'active' : 'hidden-tag'}">
                    ${item.visible !== false ? 'Visible' : 'Hidden'}
                  </span>
                </div>
                <a href="${escapeHtml(item.url)}" target="_blank" class="admin-item-url">${escapeHtml(item.url)}</a>
                ${item.description ? `<p class="admin-item-desc">${escapeHtml(item.description)}</p>` : ''}
              </div>
            </div>

            <div class="admin-item-actions">
              <button class="btn btn-sm btn-secondary toggle-vis-btn" data-id="${item.id}" data-vis="${item.visible !== false}">
                ${item.visible !== false ? '🙈 Hide' : '👁 Show'}
              </button>
              <button class="btn btn-sm btn-secondary edit-ref-btn" data-id="${item.id}">✏️ Edit</button>
              <button class="btn btn-sm btn-danger delete-ref-btn" data-id="${item.id}">🗑 Delete</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // Search filter
  document.getElementById('adminSearchInput')?.addEventListener('input', (e: any) => {
    currentAdminSearch = e.target.value;
    renderReferencesTab(pane);
  });

  document.getElementById('addRefBtn')?.addEventListener('click', () => {
    openAddReferenceModal();
  });

  // Reorder controls
  pane.querySelectorAll('.move-up-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const idx = referencesList.findIndex(r => r.id === id);
      if (idx > 0) {
        const temp = referencesList[idx];
        referencesList[idx] = referencesList[idx - 1];
        referencesList[idx - 1] = temp;
        updateReferencesOrder(referencesList);
      }
    });
  });

  pane.querySelectorAll('.move-down-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const idx = referencesList.findIndex(r => r.id === id);
      if (idx !== -1 && idx < referencesList.length - 1) {
        const temp = referencesList[idx];
        referencesList[idx] = referencesList[idx + 1];
        referencesList[idx + 1] = temp;
        updateReferencesOrder(referencesList);
      }
    });
  });

  // Toggle Visibility
  pane.querySelectorAll('.toggle-vis-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id')!;
      const isVis = btn.getAttribute('data-vis') === 'true';
      toggleReferenceVisibility(id, isVis);
    });
  });

  // Edit Reference
  pane.querySelectorAll('.edit-ref-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id')!;
      const ref = referencesList.find(r => r.id === id);
      if (ref) openAddReferenceModal(ref);
    });
  });

  // Delete Reference
  pane.querySelectorAll('.delete-ref-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id')!;
      if (confirm('Are you sure you want to delete this reference link?')) {
        deleteReference(id);
        showToast('Reference deleted.');
      }
    });
  });
}

/**
 * 👥 Users Management Tab
 */
function renderUsersTab(pane: HTMLElement) {
  let filtered = [...usersList];

  if (currentUsersSearch.trim()) {
    const term = currentUsersSearch.toLowerCase().trim();
    filtered = filtered.filter(u => {
      const email = (u.email || '').toLowerCase();
      const name = (u.name || '').toLowerCase();
      const role = (u.role || '').toLowerCase();
      return email.includes(term) || name.includes(term) || role.includes(term);
    });
  }

  pane.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
      <div>
        <h2 style="font-size: 1.35rem; font-weight: 800; color: var(--text-main);">User Account Management</h2>
        <p style="font-size: 0.85rem; color: var(--text-muted);">Manage authorized users and assign Admin or Viewer roles.</p>
      </div>

      <!-- Add User Form Card -->
      <div style="background-color: var(--surface-white); border: 1px solid var(--border-subtle); border-radius: var(--radius-card); padding: 1.25rem 1.5rem; box-shadow: var(--shadow-card);">
        <h3 style="font-size: 1rem; font-weight: 700; margin-bottom: 0.75rem;">Add Authorized User</h3>
        <form id="addUserForm" class="form-row" style="align-items: flex-end;">
          <div class="form-group" style="flex: 2; margin-bottom: 0;">
            <label class="form-label" for="newUserGmail">Gmail Address *</label>
            <input type="email" id="newUserGmail" class="form-control" placeholder="e.g. juan@gmail.com or user@dswd.gov.ph" required />
          </div>

          <div class="form-group" style="flex: 1; margin-bottom: 0;">
            <label class="form-label" for="newUserRole">Select Role *</label>
            <select id="newUserRole" class="form-control">
              <option value="Viewer">👤 Viewer</option>
              <option value="Admin">👑 Admin</option>
            </select>
          </div>

          <button type="submit" class="btn btn-primary" style="height: 42px;">
            ➕ Add User
          </button>
        </form>
      </div>

      <!-- Users Search & Table -->
      <div style="display: flex; flex-direction: column; gap: 0.85rem;">
        <input 
          type="text" 
          id="usersSearchInput" 
          class="form-control" 
          placeholder="Search registered users by Gmail address or name..." 
          value="${escapeHtml(currentUsersSearch)}"
        />

        <div class="table-container">
          <table class="admin-table">
            <thead>
              <tr>
                <th>User / Name</th>
                <th>Gmail Address</th>
                <th>Role</th>
                <th>Status</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.length === 0 ? `
                <tr>
                  <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 2rem;">
                    No user accounts found.
                  </td>
                </tr>
              ` : filtered.map(u => `
                <tr>
                  <td>
                    <div class="user-cell">
                      ${u.photoURL ? `<img src="${u.photoURL}" alt="${escapeHtml(u.name || u.email)}" />` : `
                        <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--header-border); color: #fff; font-weight: 700; display: flex; align-items: center; justify-content: center; font-size: 13px;">
                          ${(u.name || u.email).charAt(0).toUpperCase()}
                        </div>
                      `}
                      <div>
                        <div style="font-weight: 700;">${escapeHtml(u.name || u.email.split('@')[0])}</div>
                      </div>
                    </div>
                  </td>
                  <td style="font-weight: 600;">${escapeHtml(u.email)}</td>
                  <td>
                    <span class="role-badge ${u.role === 'Admin' ? 'admin' : 'viewer'}">
                      ${u.role === 'Admin' ? '👑 Admin' : '👤 Viewer'}
                    </span>
                  </td>
                  <td>
                    <span style="display: inline-flex; align-items: center; gap: 4px; font-size: 0.775rem; font-weight: 700; color: #059669;">
                      <span style="width: 6px; height: 6px; border-radius: 50%; background: #10B981;"></span>
                      ${u.status || 'Active'}
                    </span>
                  </td>
                  <td style="text-align: right;">
                    <div style="display: inline-flex; align-items: center; gap: 0.5rem;">
                      <select class="form-control change-role-select" data-email="${escapeHtml(u.email)}" style="padding: 0.25rem 0.5rem; font-size: 0.8rem; width: auto;">
                        <option value="Viewer" ${u.role === 'Viewer' ? 'selected' : ''}>Viewer</option>
                        <option value="Admin" ${u.role === 'Admin' ? 'selected' : ''}>Admin</option>
                      </select>
                      <button class="btn btn-sm btn-danger delete-user-btn" data-email="${escapeHtml(u.email)}" title="Remove User">
                        🗑 Remove
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  // Search input
  document.getElementById('usersSearchInput')?.addEventListener('input', (e: any) => {
    currentUsersSearch = e.target.value;
    renderUsersTab(pane);
  });

  // Add User Form
  document.getElementById('addUserForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailInput = document.getElementById('newUserGmail') as HTMLInputElement;
    const roleSelect = document.getElementById('newUserRole') as HTMLSelectElement;

    if (emailInput && emailInput.value) {
      await addUserAccount({
        email: emailInput.value.trim(),
        role: roleSelect.value as UserRole,
        status: 'Active'
      });
      showToast(`User ${emailInput.value} added as ${roleSelect.value}.`);
      emailInput.value = '';
      renderUsersTab(pane);
    }
  });

  // Role changes
  pane.querySelectorAll('.change-role-select').forEach(sel => {
    sel.addEventListener('change', async (e: any) => {
      const email = sel.getAttribute('data-email')!;
      const newRole = e.target.value as UserRole;
      await updateUserRole(email, newRole);
      showToast(`Updated ${email} role to ${newRole}.`);
      renderUsersTab(pane);
    });
  });

  // Delete User
  pane.querySelectorAll('.delete-user-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const email = btn.getAttribute('data-email')!;
      if (confirm(`Are you sure you want to remove user ${email}?`)) {
        await deleteUserAccount(email);
        showToast(`Removed user ${email}.`);
        renderUsersTab(pane);
      }
    });
  });
}

/**
 * 🖼 Banner & Logo Customization Tab
 */
function renderBannerTab(pane: HTMLElement) {
  const current = portalSettings || {
    mainTitle: "Emergency Operation Center",
    subtitle: "Reference Portal",
    agencyName: "DSWD EOC • Operational Directory",
    logoUrl: "/src/assets/images/eoc_portal_logo_1784808168520.jpg",
    bannerUrl: "",
    bannerHeight: 220,
    primaryColor: "#0055A4",
    headerBgColor: "#003366"
  };

  pane.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
      <div>
        <h2 style="font-size: 1.35rem; font-weight: 800; color: var(--text-main);">Banner &amp; Logo Settings</h2>
        <p style="font-size: 0.85rem; color: var(--text-muted);">Customize portal headers, banner background, logo, titles, and layout dimensions.</p>
      </div>

      <div style="background-color: var(--surface-white); border: 1px solid var(--border-subtle); border-radius: var(--radius-card); padding: 1.5rem; box-shadow: var(--shadow-card);">
        <form id="bannerForm" style="display: flex; flex-direction: column; gap: 1.25rem;">
          
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="cfgMainTitle">Main Title</label>
              <input type="text" id="cfgMainTitle" class="form-control" value="${escapeHtml(current.mainTitle || 'Emergency Operation Center')}" required />
            </div>

            <div class="form-group">
              <label class="form-label" for="cfgSubtitle">Subtitle</label>
              <input type="text" id="cfgSubtitle" class="form-control" value="${escapeHtml(current.subtitle || 'Reference Portal')}" required />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="cfgAgencyName">Agency Badge Text</label>
            <input type="text" id="cfgAgencyName" class="form-control" value="${escapeHtml(current.agencyName || 'DSWD EOC • Operational Directory')}" required />
          </div>

          <!-- Banner Background -->
          <div class="form-group">
            <label class="form-label" for="cfgBannerUrl">Banner Image URL / Upload to Storage</label>
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;">
              <input type="text" id="cfgBannerUrl" class="form-control" style="flex: 1; min-width: 200px;" value="${escapeHtml(current.bannerUrl || current.bannerImage || '')}" placeholder="https://example.com/banner.jpg" />
              <label class="btn btn-secondary" style="cursor: pointer; margin: 0;">
                📁 Upload Banner File
                <input type="file" id="cfgBannerFileInput" accept="image/*" style="display: none;" />
              </label>
            </div>
            <!-- Banner Preview -->
            <div id="bannerPreviewContainer" style="margin-top: 0.5rem; display: ${current.bannerUrl || current.bannerImage ? 'block' : 'none'};">
              <span style="font-size: 0.75rem; color: var(--text-muted);">Preview:</span>
              <div style="width: 100%; height: 100px; border-radius: 6px; overflow: hidden; border: 1px solid var(--border-subtle); margin-top: 4px;">
                <img id="bannerPreviewImg" src="${escapeHtml(current.bannerUrl || current.bannerImage || '')}" style="width: 100%; height: 100%; object-fit: cover;" />
              </div>
            </div>
          </div>

          <!-- Banner Presets -->
          <div>
            <label class="form-label">Or Select EOC Preset Banner</label>
            <div class="preset-grid">
              <div class="preset-card ${!(current.bannerUrl || current.bannerImage) ? 'selected' : ''}" data-preset="">
                <div style="width:100%; height:100%; background: linear-gradient(135deg, #003366, #0055A4); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 11px; font-weight: 700;">
                  Default Blue
                </div>
                <div class="preset-card-title">Clean Navy</div>
              </div>
              <div class="preset-card ${(current.bannerUrl || current.bannerImage || '').includes('preset1') ? 'selected' : ''}" data-preset="https://images.unsplash.com/photo-1541888946425-d0fbb186a5b7?auto=format&fit=crop&w=1200&q=80">
                <img src="https://images.unsplash.com/photo-1541888946425-d0fbb186a5b7?auto=format&fit=crop&w=300&q=80" alt="Preset 1" />
                <div class="preset-card-title">Command Center</div>
              </div>
              <div class="preset-card ${(current.bannerUrl || current.bannerImage || '').includes('preset2') ? 'selected' : ''}" data-preset="https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80">
                <img src="https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=300&q=80" alt="Preset 2" />
                <div class="preset-card-title">Digital Operations</div>
              </div>
            </div>
          </div>

          <!-- Banner Height Adjuster -->
          <div class="form-group">
            <label class="form-label" for="cfgBannerHeight">Banner Height: <span id="heightVal">${current.bannerHeight || 220}</span>px</label>
            <input type="range" id="cfgBannerHeight" min="140" max="360" step="10" value="${current.bannerHeight || 220}" class="form-control" />
          </div>

          <!-- Logo URL & Upload -->
          <div class="form-group">
            <label class="form-label" for="cfgLogoUrl">Logo Image URL / Upload to Storage</label>
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;">
              <input type="text" id="cfgLogoUrl" class="form-control" style="flex: 1; min-width: 200px;" value="${escapeHtml(current.logoUrl || current.logo || '')}" placeholder="/src/assets/images/eoc_portal_logo_1784808168520.jpg" />
              <label class="btn btn-secondary" style="cursor: pointer; margin: 0;">
                📷 Upload Logo File
                <input type="file" id="cfgLogoFileInput" accept="image/*" style="display: none;" />
              </label>
            </div>
            <!-- Logo Preview -->
            <div id="logoPreviewContainer" style="margin-top: 0.5rem; display: ${current.logoUrl || current.logo ? 'block' : 'none'};">
              <span style="font-size: 0.75rem; color: var(--text-muted);">Preview:</span>
              <div style="width: 60px; height: 60px; border-radius: 6px; overflow: hidden; border: 1px solid var(--border-subtle); margin-top: 4px; padding: 4px; background: #fff;">
                <img id="logoPreviewImg" src="${escapeHtml(current.logoUrl || current.logo || '')}" style="width: 100%; height: 100%; object-fit: contain;" />
              </div>
            </div>
          </div>

          <div style="display: flex; gap: 0.75rem; margin-top: 0.5rem;">
            <button type="submit" id="saveBannerBtn" class="btn btn-primary">💾 Save Banner &amp; Branding Settings</button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Range Slider text listener
  const heightSlider = document.getElementById('cfgBannerHeight') as HTMLInputElement;
  const heightVal = document.getElementById('heightVal');
  if (heightSlider && heightVal) {
    heightSlider.addEventListener('input', () => {
      heightVal.textContent = heightSlider.value;
    });
  }

  const bannerFileInput = document.getElementById('cfgBannerFileInput') as HTMLInputElement;
  const bannerUrlInput = document.getElementById('cfgBannerUrl') as HTMLInputElement;
  const bannerPreviewContainer = document.getElementById('bannerPreviewContainer');
  const bannerPreviewImg = document.getElementById('bannerPreviewImg') as HTMLImageElement;

  if (bannerFileInput && bannerUrlInput) {
    bannerFileInput.addEventListener('change', async (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        showToast('Uploading banner image to Storage...');
        const downloadUrl = await uploadFileToStorage(file, `banners/${Date.now()}_${file.name}`);
        bannerUrlInput.value = downloadUrl;
        if (bannerPreviewImg) bannerPreviewImg.src = downloadUrl;
        if (bannerPreviewContainer) bannerPreviewContainer.style.display = 'block';
        showToast('Banner uploaded! Click Save to apply changes.');
      }
    });

    bannerUrlInput.addEventListener('input', () => {
      if (bannerPreviewImg && bannerPreviewContainer) {
        bannerPreviewImg.src = bannerUrlInput.value;
        bannerPreviewContainer.style.display = bannerUrlInput.value ? 'block' : 'none';
      }
    });
  }

  const logoFileInput = document.getElementById('cfgLogoFileInput') as HTMLInputElement;
  const logoUrlInput = document.getElementById('cfgLogoUrl') as HTMLInputElement;
  const logoPreviewContainer = document.getElementById('logoPreviewContainer');
  const logoPreviewImg = document.getElementById('logoPreviewImg') as HTMLImageElement;

  if (logoFileInput && logoUrlInput) {
    logoFileInput.addEventListener('change', async (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        showToast('Uploading logo image to Storage...');
        const downloadUrl = await uploadFileToStorage(file, `logos/${Date.now()}_${file.name}`);
        logoUrlInput.value = downloadUrl;
        if (logoPreviewImg) logoPreviewImg.src = downloadUrl;
        if (logoPreviewContainer) logoPreviewContainer.style.display = 'block';
        showToast('Logo uploaded! Click Save to apply changes.');
      }
    });

    logoUrlInput.addEventListener('input', () => {
      if (logoPreviewImg && logoPreviewContainer) {
        logoPreviewImg.src = logoUrlInput.value;
        logoPreviewContainer.style.display = logoUrlInput.value ? 'block' : 'none';
      }
    });
  }

  // Preset Cards
  pane.querySelectorAll('.preset-card').forEach(card => {
    card.addEventListener('click', () => {
      const url = card.getAttribute('data-preset') || '';
      if (bannerUrlInput) {
        bannerUrlInput.value = url;
        if (bannerPreviewImg && bannerPreviewContainer) {
          bannerPreviewImg.src = url;
          bannerPreviewContainer.style.display = url ? 'block' : 'none';
        }
      }
      pane.querySelectorAll('.preset-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
    });
  });

  // Submit Form
  document.getElementById('bannerForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const mainTitle = (document.getElementById('cfgMainTitle') as HTMLInputElement).value;
    const subtitle = (document.getElementById('cfgSubtitle') as HTMLInputElement).value;
    const agencyName = (document.getElementById('cfgAgencyName') as HTMLInputElement).value;
    const bannerUrl = (document.getElementById('cfgBannerUrl') as HTMLInputElement).value;
    const bannerHeight = parseInt((document.getElementById('cfgBannerHeight') as HTMLInputElement).value, 10);
    const logoUrl = (document.getElementById('cfgLogoUrl') as HTMLInputElement).value;

    await updatePortalSettings({
      title: mainTitle,
      mainTitle,
      subtitle,
      agencyName,
      bannerUrl,
      bannerImage: bannerUrl,
      bannerHeight,
      logoUrl,
      logo: logoUrl
    });

    showToast('Banner & Branding settings saved successfully!');
  });
}


/**
 * 🎨 Appearance Tab
 */
function renderAppearanceTab(pane: HTMLElement) {
  const current = portalSettings || {
    primaryColor: "#0055A4",
    headerBgColor: "#003366"
  };

  pane.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
      <div>
        <h2 style="font-size: 1.35rem; font-weight: 800; color: var(--text-main);">Theme &amp; Appearance</h2>
        <p style="font-size: 0.85rem; color: var(--text-muted);">Adjust theme colors and primary accents.</p>
      </div>

      <div style="background-color: var(--surface-white); border: 1px solid var(--border-subtle); border-radius: var(--radius-card); padding: 1.5rem; box-shadow: var(--shadow-card);">
        <form id="appearanceForm" style="display: flex; flex-direction: column; gap: 1.25rem;">
          
          <div class="form-group">
            <label class="form-label" for="cfgPrimaryColor">Primary Accent Color</label>
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <input type="color" id="cfgPrimaryColor" value="${current.primaryColor || '#0055A4'}" style="width: 48px; height: 38px; border: none; cursor: pointer;" />
              <input type="text" id="cfgPrimaryColorText" class="form-control" value="${current.primaryColor || '#0055A4'}" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="cfgHeaderBgColor">Header Navy Background</label>
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <input type="color" id="cfgHeaderBgColor" value="${current.headerBgColor || '#003366'}" style="width: 48px; height: 38px; border: none; cursor: pointer;" />
              <input type="text" id="cfgHeaderBgColorText" class="form-control" value="${current.headerBgColor || '#003366'}" />
            </div>
          </div>

          <button type="submit" class="btn btn-primary" style="align-self: flex-start; margin-top: 0.5rem;">
            💾 Save Theme Colors
          </button>
        </form>
      </div>
    </div>
  `;

  document.getElementById('appearanceForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const primaryColor = (document.getElementById('cfgPrimaryColorText') as HTMLInputElement).value;
    const headerBgColor = (document.getElementById('cfgHeaderBgColorText') as HTMLInputElement).value;

    await updatePortalSettings({
      primaryColor,
      headerBgColor
    });

    showToast('Theme colors updated!');
  });
}

/**
 * Open Add/Edit Reference Modal
 */
function openAddReferenceModal(item?: ReferenceItem) {
  let modal = document.getElementById('editModal');
  if (!modal) return;

  const isEdit = !!item;
  const modalTitle = document.getElementById('modalTitle');
  if (modalTitle) modalTitle.textContent = isEdit ? 'Edit Reference Link' : 'Add New Reference Link';

  (document.getElementById('fieldId') as HTMLInputElement).value = item?.id || '';
  (document.getElementById('fieldTitle') as HTMLInputElement).value = item?.title || '';
  (document.getElementById('fieldIcon') as HTMLSelectElement).value = item?.icon || 'drive';
  (document.getElementById('fieldLogoUrl') as HTMLInputElement).value = item?.logoUrl || item?.logo || '';
  (document.getElementById('fieldCategory') as HTMLInputElement).value = item?.category || 'Google Drive';
  (document.getElementById('fieldBadge') as HTMLInputElement).value = item?.badge || '';
  (document.getElementById('fieldUrl') as HTMLInputElement).value = item?.url || '';
  (document.getElementById('fieldDescription') as HTMLTextAreaElement).value = item?.description || '';
  (document.getElementById('fieldVisible') as HTMLInputElement).checked = item?.visible !== false;

  const logoFileInput = document.getElementById('fieldLogoFileInput') as HTMLInputElement;
  const logoUrlInput = document.getElementById('fieldLogoUrl') as HTMLInputElement;
  const logoPreviewContainer = document.getElementById('fieldLogoPreviewContainer');
  const logoPreviewImg = document.getElementById('fieldLogoPreviewImg') as HTMLImageElement;
  const clearLogoBtn = document.getElementById('clearFieldLogoBtn');

  const updateLogoPreview = (url: string) => {
    if (logoPreviewImg && logoPreviewContainer) {
      if (url && url.trim()) {
        logoPreviewImg.src = url.trim();
        logoPreviewContainer.style.display = 'flex';
      } else {
        logoPreviewContainer.style.display = 'none';
      }
    }
  };

  updateLogoPreview(item?.logoUrl || item?.logo || '');

  if (logoFileInput && logoUrlInput) {
    logoFileInput.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        showToast('Uploading custom reference logo...');
        try {
          const downloadUrl = await uploadFileToStorage(file, `ref_logos/${Date.now()}_${file.name}`);
          logoUrlInput.value = downloadUrl;
          updateLogoPreview(downloadUrl);
          showToast('Logo uploaded! Click Save to apply.');
        } catch (err) {
          console.error('Error uploading logo:', err);
          showToast('Failed to upload logo file.');
        }
      }
    };

    logoUrlInput.oninput = () => {
      updateLogoPreview(logoUrlInput.value);
    };
  }

  if (clearLogoBtn) {
    clearLogoBtn.onclick = () => {
      if (logoUrlInput) logoUrlInput.value = '';
      if (logoFileInput) logoFileInput.value = '';
      updateLogoPreview('');
    };
  }

  modal.classList.add('active');

  const closeBtn = document.getElementById('closeEditModalBtn');
  const cancelBtn = document.getElementById('cancelEditBtn');
  const refForm = document.getElementById('referenceForm');

  const closeModal = () => modal?.classList.remove('active');

  if (closeBtn) closeBtn.onclick = closeModal;
  if (cancelBtn) cancelBtn.onclick = closeModal;

  if (refForm) {
    refForm.onsubmit = async (e) => {
      e.preventDefault();
      const id = (document.getElementById('fieldId') as HTMLInputElement).value;
      const title = (document.getElementById('fieldTitle') as HTMLInputElement).value;
      const icon = (document.getElementById('fieldIcon') as HTMLSelectElement).value;
      const logoUrl = (document.getElementById('fieldLogoUrl') as HTMLInputElement).value;
      const category = (document.getElementById('fieldCategory') as HTMLInputElement).value;
      const badge = (document.getElementById('fieldBadge') as HTMLInputElement).value;
      const url = (document.getElementById('fieldUrl') as HTMLInputElement).value;
      const description = (document.getElementById('fieldDescription') as HTMLTextAreaElement).value;
      const visible = (document.getElementById('fieldVisible') as HTMLInputElement).checked;

      await saveReference({
        id: id || undefined,
        title,
        icon,
        logoUrl,
        logo: logoUrl,
        category,
        badge,
        url,
        description,
        visible
      });

      closeModal();
      showToast(isEdit ? 'Reference updated!' : 'New reference created!');
    };
  }
}

function getItemIconUrl(item: ReferenceItem): string {
  const customLogo = item.logoUrl || item.logo;
  if (customLogo && customLogo.trim()) {
    return customLogo.trim();
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

function escapeHtml(str?: string | null): string {
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

/**
 * ⚡ Database & Supabase Tab
 */
function renderSupabaseTab(pane: HTMLElement) {
  const isConnected = isSupabaseConfigured;
  const savedLocalUrl = localStorage.getItem('eoc_supabase_url') || '';
  const savedLocalKey = localStorage.getItem('eoc_supabase_anon_key') || '';
  const currentUrl = supabaseUrl || savedLocalUrl || 'Not set';
  const currentKey = supabaseAnonKey || savedLocalKey 
    ? ((supabaseAnonKey || savedLocalKey).substring(0, 16) + '...') 
    : 'Not set';

  const sqlSchema = `-- Supabase PostgreSQL Schema Script for EOC Reference Portal
-- Copy and paste this script into your Supabase SQL Editor:

-- 1. Create References Table
CREATE TABLE IF NOT EXISTS public.references (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  icon TEXT DEFAULT 'website',
  logo_url TEXT,
  category TEXT DEFAULT 'General',
  badge TEXT,
  url TEXT NOT NULL,
  description TEXT,
  visible BOOLEAN DEFAULT true,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Settings Table
CREATE TABLE IF NOT EXISTS public.settings (
  id TEXT PRIMARY KEY,
  main_title TEXT,
  subtitle TEXT,
  agency_name TEXT,
  logo_url TEXT,
  banner_url TEXT,
  banner_height INT DEFAULT 180,
  primary_color TEXT DEFAULT '#0038a8',
  header_bg_color TEXT DEFAULT '#ffffff',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Users Table
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'User',
  status TEXT DEFAULT 'Active',
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable Row Level Security (RLS) policies
ALTER TABLE public.references ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read references" ON public.references FOR SELECT USING (true);
CREATE POLICY "Allow all access references" ON public.references FOR ALL USING (true);

CREATE POLICY "Allow public read settings" ON public.settings FOR SELECT USING (true);
CREATE POLICY "Allow all access settings" ON public.settings FOR ALL USING (true);

CREATE POLICY "Allow public read users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Allow all access users" ON public.users FOR ALL USING (true);
`;

  pane.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
        <div>
          <h2 style="font-size: 1.35rem; font-weight: 800; color: var(--text-main); margin-bottom: 0.25rem;">Database &amp; Supabase Integration</h2>
          <p style="font-size: 0.9rem; color: var(--text-muted);">View connection status, paste API keys directly below, or get SQL initialization scripts.</p>
        </div>
        <div style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; border-radius: 9999px; font-weight: 600; font-size: 0.85rem; ${isConnected ? 'background: #dcfce7; color: #15803d; border: 1px solid #86efac;' : 'background: #fef3c7; color: #b45309; border: 1px solid #fcd34d;'}">
          <span style="width: 8px; height: 8px; border-radius: 50%; ${isConnected ? 'background: #22c55e;' : 'background: #f59e0b;'}"></span>
          ${isConnected ? 'Supabase Connected' : 'Local Storage Fallback (Active)'}
        </div>
      </div>

      <!-- Quick Connect Credentials Form -->
      <div style="background-color: var(--surface-white); border: 1px solid var(--border-subtle); border-radius: var(--radius-card); padding: 1.5rem; box-shadow: var(--shadow-card);">
        <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
          Direct Supabase Connection
        </h3>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1.25rem;">
          Paste your <strong>Project URL</strong> and <strong>Publishable key</strong> from your Supabase dashboard to link your database instantly.
        </p>

        <form id="supabaseConnectForm" style="display: flex; flex-direction: column; gap: 1rem;">
          <div>
            <label class="form-label" style="font-weight: 600;">Supabase Project URL</label>
            <input type="url" id="inputSupabaseUrl" class="form-input" placeholder="https://your-project-id.supabase.co" value="${escapeHtml(supabaseUrl || savedLocalUrl)}" required style="font-family: monospace;" />
            <span style="font-size: 0.775rem; color: #64748b; margin-top: 0.25rem; display: block;">Found in Supabase: <strong>Project Settings → API Keys → Project URL</strong> (or Data API)</span>
          </div>

          <div>
            <label class="form-label" style="font-weight: 600;">Supabase Publishable / Anon Key</label>
            <input type="text" id="inputSupabaseKey" class="form-input" placeholder="sb_publishable_... or legacy anon key" value="${escapeHtml(supabaseAnonKey || savedLocalKey)}" required style="font-family: monospace;" />
            <span style="font-size: 0.775rem; color: #64748b; margin-top: 0.25rem; display: block;">Found in Supabase: <strong>Project Settings → API Keys → Publishable key</strong></span>
          </div>

          <div style="display: flex; gap: 0.75rem; align-items: center; margin-top: 0.5rem;">
            <button type="submit" class="btn btn-primary">⚡ Save Credentials &amp; Connect</button>
            <button type="button" id="clearSupabaseBtn" class="btn btn-secondary" style="color: #dc2626;">Clear Credentials</button>
          </div>
        </form>
      </div>

      <!-- SQL Table Initialization Card -->
      <div style="background-color: var(--surface-white); border: 1px solid var(--border-subtle); border-radius: var(--radius-card); padding: 1.5rem; box-shadow: var(--shadow-card);">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
          <h3 style="font-size: 1.1rem; font-weight: 700; display: flex; align-items: center; gap: 0.5rem;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
            Supabase SQL Table Initialization Script
          </h3>
          <button id="copySqlBtn" class="btn btn-secondary btn-sm" style="font-size: 0.8rem; padding: 0.4rem 0.75rem;">📋 Copy SQL Script</button>
        </div>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.75rem;">
          Run this SQL script in your <a href="https://supabase.com/dashboard" target="_blank" style="color: var(--primary-blue); font-weight: 600;">Supabase SQL Editor</a> (click <strong>&gt;_ SQL Editor</strong> in Supabase left sidebar) to create the tables:
        </p>
        <pre style="background: #0f172a; color: #38bdf8; padding: 1rem; border-radius: 8px; font-size: 0.825rem; font-family: monospace; overflow-x: auto; max-height: 280px; white-space: pre-wrap;">${escapeHtml(sqlSchema)}</pre>
      </div>
    </div>
  `;

  document.getElementById('supabaseConnectForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const url = (document.getElementById('inputSupabaseUrl') as HTMLInputElement).value.trim();
    const key = (document.getElementById('inputSupabaseKey') as HTMLInputElement).value.trim();

    if (url && key) {
      localStorage.setItem('eoc_supabase_url', url);
      localStorage.setItem('eoc_supabase_anon_key', key);
      showToast('Supabase credentials saved! Reloading portal...');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  });

  document.getElementById('clearSupabaseBtn')?.addEventListener('click', () => {
    localStorage.removeItem('eoc_supabase_url');
    localStorage.removeItem('eoc_supabase_anon_key');
    showToast('Supabase credentials cleared. Reverting to local storage mode.');
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  });

  document.getElementById('copySqlBtn')?.addEventListener('click', () => {
    navigator.clipboard.writeText(sqlSchema).then(() => {
      const btn = document.getElementById('copySqlBtn');
      if (btn) {
        btn.textContent = '✅ Copied!';
        setTimeout(() => { btn.textContent = '📋 Copy SQL Script'; }, 2000);
      }
    });
  });
}
