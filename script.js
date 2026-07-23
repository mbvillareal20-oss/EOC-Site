/**
 * Emergency Operation Center (EOC) Reference Portal
 * Main Application Logic & Data Binding
 * 
 * Section Overview:
 * 1. Global State & DOM Element Selectors
 * 2. Data Initialization (Fetch links.json with links.js Fallback)
 * 3. Icon Resolver Mapping
 * 4. Card Rendering Engine
 * 5. Search & Category Filtering Engine
 * 6. Interactive Event Listeners (Search, Filters, Clipboard, Shortcuts)
 * 7. Toast & Modal UI Utilities
 */

// ==========================================================================
// 1. Global State & DOM Element Selectors
// ==========================================================================

// Global state holding all reference items and active filters
const state = {
  allLinks: [],
  filteredLinks: [],
  activeCategory: 'All',
  searchQuery: ''
};

// DOM Element references
const elements = {
  cardsGrid: document.getElementById('cardsGrid'),
  searchContainer: document.getElementById('searchContainer'),
  searchInput: document.getElementById('searchInput'),
  clearSearchBtn: document.getElementById('clearSearchBtn'),
  filterContainer: document.getElementById('filterContainer'),
  displayedCount: document.getElementById('displayedCount'),
  totalCount: document.getElementById('totalCount'),
  emptyState: document.getElementById('emptyState'),
  resetFilterBtn: document.getElementById('resetFilterBtn'),
  toast: document.getElementById('toast'),
  toastMessage: document.getElementById('toastMessage'),
  jsonModal: document.getElementById('jsonModal'),
  jsonPreview: document.getElementById('jsonPreview'),
  closeModalBtn: document.getElementById('closeModalBtn'),
  copyJsonBtn: document.getElementById('copyJsonBtn'),
  viewJsonBtn: document.getElementById('viewJsonBtn')
};

// ==========================================================================
// 2. Data Initialization (LocalStorage, Google Sheets & JSON Fallback)
// ==========================================================================

const LOCAL_STORAGE_KEY = 'EOC_PORTAL_LINKS';
const GSHEET_URL_KEY = 'EOC_PORTAL_GSHEET_URL';

/**
 * Parses CSV string from published Google Sheet into Link objects
 */
function parseCSV(csvText) {
  const lines = csvText.split(/\r\n|\n/);
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
  const results = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Naive CSV split taking care of basic quotes
    const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
    const cleanValues = values.map(v => v.trim().replace(/^"|"$/g, ''));

    const item = { id: `gsheet-${i}` };
    headers.forEach((h, idx) => {
      const val = cleanValues[idx] || '';
      if (h.includes('icon')) item.icon = val.toLowerCase();
      else if (h.includes('title')) item.title = val;
      else if (h.includes('desc')) item.description = val;
      else if (h.includes('url') || h.includes('link')) item.url = val;
      else if (h.includes('cat')) item.category = val;
      else if (h.includes('badge')) item.badge = val;
      else if (h.includes('visib')) item.visible = val.toLowerCase() !== 'false' && val !== '0' && val !== 'no';
    });

    if (item.title && item.url) {
      if (!item.category) item.category = 'General';
      if (!item.icon) item.icon = 'website';
      if (item.visible === undefined) item.visible = true;
      results.push(item);
    }
  }
  return results;
}

/**
 * Loads link data from localStorage, Google Sheets CSV, links.json, or links.js fallback
 */
async function loadReferenceLinks() {
  let loadedData = null;

  // 1. Try Google Sheets Sync if configured
  const gsheetUrl = localStorage.getItem(GSHEET_URL_KEY);
  if (gsheetUrl) {
    try {
      const res = await fetch(gsheetUrl);
      if (res.ok) {
        const text = await res.text();
        const sheetLinks = parseCSV(text);
        if (sheetLinks.length > 0) {
          loadedData = sheetLinks;
          console.log('Successfully loaded references from Google Sheets!');
        }
      }
    } catch (err) {
      console.warn('Google Sheets sync failed, falling back to local storage/json:', err.message);
    }
  }

  // 2. Try LocalStorage
  if (!loadedData) {
    const local = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (local) {
      try {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) {
          loadedData = parsed;
        }
      } catch (e) {
        console.warn('Failed to parse local storage links:', e);
      }
    }
  }

  // 3. Try links.json fetch
  if (!loadedData) {
    try {
      const response = await fetch('./links.json');
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          loadedData = data;
        }
      }
    } catch (err) {
      console.warn('Falling back to links.js data source:', err.message);
    }
  }

  // 4. Fallback to window.EOC_LINKS
  if (!loadedData && window.EOC_LINKS && Array.isArray(window.EOC_LINKS)) {
    loadedData = window.EOC_LINKS;
  }

  state.allLinks = (loadedData || []).map((item, idx) => ({
    id: item.id || `link-${idx + 1}`,
    title: item.title || 'Untitled Reference',
    category: item.category || 'General',
    icon: item.icon || 'website',
    description: item.description || '',
    url: item.url || '#',
    badge: item.badge || '',
    visible: item.visible !== false
  }));

  // Filter out hidden items on main portal homepage
  state.allLinks = state.allLinks.filter(item => item.visible !== false);

  // Set total count metadata
  if (elements.totalCount) {
    elements.totalCount.textContent = state.allLinks.length;
  }

  // Initial Filter & Render
  applyFilters();
}

// ==========================================================================
// 3. Icon Resolver Mapping
// ==========================================================================

/**
 * Maps resource icon key to local asset SVG path
 * @param {string} iconKey - Identifier such as 'drive', 'sheets', 'slides', 'meet', 'forms', 'pdf', 'website'
 * @returns {string} Relative asset image URL
 */
function getIconPath(iconKey) {
  const normalized = (iconKey || '').toLowerCase();
  switch (normalized) {
    case 'drive':
      return './assets/drive.svg';
    case 'sheets':
      return './assets/sheets.svg';
    case 'slides':
      return './assets/slides.svg';
    case 'meet':
      return './assets/meet.svg';
    case 'forms':
      return './assets/forms.svg';
    case 'pdf':
      return './assets/pdf.svg';
    case 'website':
    case 'link':
    default:
      return './assets/website.svg';
  }
}

// ==========================================================================
// 4. Card Rendering Engine
// ==========================================================================

/**
 * Creates an HTML string for a single reference card element
 * @param {Object} item - Reference link object
 * @returns {string} Card HTML string
 */
function createCardHTML(item) {
  const iconSrc = getIconPath(item.icon);
  const badgeHTML = item.badge 
    ? `<span class="badge-tag">${escapeHTML(item.badge)}</span>` 
    : '';

  return `
    <article class="reference-card" id="${escapeHTML(item.id || '')}">
      <div class="card-top">
        <div class="card-header-row">
          <div class="icon-box">
            <img src="${iconSrc}" alt="${escapeHTML(item.category || 'Reference')} icon" loading="lazy" />
          </div>
          <div class="card-tags">
            <span class="category-tag">${escapeHTML(item.category || 'General')}</span>
            ${badgeHTML}
          </div>
        </div>

        <div class="card-body">
          <h2 class="card-title">${escapeHTML(item.title)}</h2>
          <p class="card-description">${escapeHTML(item.description || 'No description provided.')}</p>
        </div>
      </div>

      <div class="card-footer">
        <a 
          href="${escapeHTML(item.url)}" 
          target="_blank" 
          rel="noopener noreferrer" 
          class="action-link"
          aria-label="Open ${escapeHTML(item.title)} in new tab"
        >
          <span>Open Reference</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
        </a>

        <button 
          class="copy-btn" 
          data-url="${escapeHTML(item.url)}" 
          title="Copy link to clipboard"
          aria-label="Copy ${escapeHTML(item.title)} link"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </button>
      </div>
    </article>
  `;
}

/**
 * Renders the filtered array of links into the DOM grid container
 */
function renderCards() {
  if (!elements.cardsGrid) return;

  if (state.filteredLinks.length === 0) {
    elements.cardsGrid.style.display = 'none';
    if (elements.emptyState) elements.emptyState.style.display = 'flex';
  } else {
    elements.cardsGrid.style.display = 'grid';
    if (elements.emptyState) elements.emptyState.style.display = 'none';

    elements.cardsGrid.innerHTML = state.filteredLinks
      .map(item => createCardHTML(item))
      .join('');
  }

  // Update counters
  if (elements.displayedCount) {
    elements.displayedCount.textContent = state.filteredLinks.length;
  }
}

// ==========================================================================
// 5. Search & Category Filtering Engine
// ==========================================================================

/**
 * Filters all links based on current state.activeCategory and state.searchQuery
 */
function applyFilters() {
  const query = state.searchQuery.trim().toLowerCase();

  state.filteredLinks = state.allLinks.filter(item => {
    // 1. Category Filter
    let matchesCategory = true;
    if (state.activeCategory !== 'All') {
      const cat = (item.category || '').toLowerCase();
      const targetCat = state.activeCategory.toLowerCase();
      
      if (targetCat === 'google drive') matchesCategory = cat.includes('drive');
      else if (targetCat === 'google sheets') matchesCategory = cat.includes('sheet');
      else if (targetCat === 'google slides') matchesCategory = cat.includes('slide');
      else if (targetCat === 'google meet') matchesCategory = cat.includes('meet');
      else if (targetCat === 'google forms') matchesCategory = cat.includes('form');
      else if (targetCat === 'pdfs') matchesCategory = cat.includes('pdf');
      else if (targetCat === 'websites') matchesCategory = cat.includes('website') || cat.includes('external');
      else matchesCategory = cat === targetCat;
    }

    // 2. Search Text Filter
    let matchesQuery = true;
    if (query) {
      const titleMatch = (item.title || '').toLowerCase().includes(query);
      const descMatch = (item.description || '').toLowerCase().includes(query);
      const catMatch = (item.category || '').toLowerCase().includes(query);
      const badgeMatch = (item.badge || '').toLowerCase().includes(query);
      matchesQuery = titleMatch || descMatch || catMatch || badgeMatch;
    }

    return matchesCategory && matchesQuery;
  });

  renderCards();
}

// ==========================================================================
// 6. Interactive Event Listeners
// ==========================================================================

function setupEventListeners() {
  // Search input events
  if (elements.searchInput) {
    elements.searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      if (elements.clearSearchBtn) {
        elements.clearSearchBtn.style.display = state.searchQuery ? 'flex' : 'none';
      }
      applyFilters();
    });
  }

  // Clear search button
  if (elements.clearSearchBtn) {
    elements.clearSearchBtn.addEventListener('click', () => {
      if (elements.searchInput) {
        elements.searchInput.value = '';
        state.searchQuery = '';
        elements.searchInput.focus();
      }
      elements.clearSearchBtn.style.display = 'none';
      applyFilters();
    });
  }

  // Category filter button click delegation
  if (elements.filterContainer) {
    elements.filterContainer.addEventListener('click', (e) => {
      const filterBtn = e.target.closest('.filter-btn');
      if (!filterBtn) return;

      // Update active button UI
      const allBtns = elements.filterContainer.querySelectorAll('.filter-btn');
      allBtns.forEach(btn => btn.classList.remove('active'));
      filterBtn.classList.add('active');

      // Update state and re-filter
      state.activeCategory = filterBtn.getAttribute('data-category') || 'All';
      applyFilters();
    });
  }

  // Copy button click delegation on cards grid
  if (elements.cardsGrid) {
    elements.cardsGrid.addEventListener('click', async (e) => {
      const copyBtn = e.target.closest('.copy-btn');
      if (!copyBtn) return;

      e.preventDefault();
      e.stopPropagation();

      const url = copyBtn.getAttribute('data-url');
      if (url) {
        try {
          await navigator.clipboard.writeText(url);
          showToast('Link copied to clipboard!');
        } catch (err) {
          showToast('Failed to copy link');
        }
      }
    });
  }

  // Reset filter button on empty state
  if (elements.resetFilterBtn) {
    elements.resetFilterBtn.addEventListener('click', () => {
      if (elements.searchInput) elements.searchInput.value = '';
      state.searchQuery = '';
      state.activeCategory = 'All';

      // Reset filter button highlight
      if (elements.filterContainer) {
        const allBtns = elements.filterContainer.querySelectorAll('.filter-btn');
        allBtns.forEach(btn => {
          if (btn.getAttribute('data-category') === 'All') btn.classList.add('active');
          else btn.classList.remove('active');
        });
      }

      if (elements.clearSearchBtn) elements.clearSearchBtn.style.display = 'none';
      applyFilters();
    });
  }

  // View JSON modal triggers
  if (elements.viewJsonBtn) {
    elements.viewJsonBtn.addEventListener('click', () => {
      openJsonModal();
    });
  }

  if (elements.closeModalBtn) {
    elements.closeModalBtn.addEventListener('click', () => {
      closeJsonModal();
    });
  }

  if (elements.jsonModal) {
    elements.jsonModal.addEventListener('click', (e) => {
      if (e.target === elements.jsonModal) closeJsonModal();
    });
  }

  if (elements.copyJsonBtn) {
    elements.copyJsonBtn.addEventListener('click', async () => {
      const jsonText = JSON.stringify(state.allLinks, null, 2);
      try {
        await navigator.clipboard.writeText(jsonText);
        showToast('JSON copied to clipboard!');
      } catch (err) {
        showToast('Failed to copy JSON');
      }
    });
  }

  // Global Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    // '/' key focuses search bar
    if (e.key === '/' && document.activeElement !== elements.searchInput) {
      e.preventDefault();
      if (elements.searchInput) elements.searchInput.focus();
    }
    // 'Escape' closes modal or clears search
    if (e.key === 'Escape') {
      if (elements.jsonModal && elements.jsonModal.classList.contains('active')) {
        closeJsonModal();
      } else if (elements.searchInput && document.activeElement === elements.searchInput) {
        elements.searchInput.value = '';
        state.searchQuery = '';
        if (elements.clearSearchBtn) elements.clearSearchBtn.style.display = 'none';
        applyFilters();
        elements.searchInput.blur();
      }
    }
  });
}

// ==========================================================================
// 7. Toast & Modal UI Utilities
// ==========================================================================

let toastTimeout = null;

function showToast(message) {
  if (!elements.toast || !elements.toastMessage) return;

  elements.toastMessage.textContent = message;
  elements.toast.classList.add('show');

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    elements.toast.classList.remove('show');
  }, 3000);
}

function openJsonModal() {
  if (!elements.jsonModal || !elements.jsonPreview) return;
  elements.jsonPreview.textContent = JSON.stringify(state.allLinks, null, 2);
  elements.jsonModal.classList.add('active');
}

function closeJsonModal() {
  if (!elements.jsonModal) return;
  elements.jsonModal.classList.remove('active');
}

/**
 * Utility to escape raw HTML text to prevent XSS injection
 */
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ==========================================================================
// Initialize Application on DOM Ready
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadReferenceLinks();
});
