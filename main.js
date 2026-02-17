const THEME_STORAGE_KEY = 'star-notes-theme';
const PATCH_DATA_URL = 'data/patches.json';

const PatchData = {
    version: null,
    releaseDate: null,
    buildChannel: null,
    status: null,
    stats: {
        features: 0,
        improvements: 0,
        fixes: 0,
        ships: 0,
    },
    categories: [],
    history: [],
    selectedPatchId: null,
    generatedAt: null,
};

const UIState = {
    activeFilter: 'all',
    searchQuery: '',
    expandedCategories: new Set(),
};

const PatchStore = {
    patches: [],
    byId: {},
};

function applyTheme(theme) {
    const isLight = theme === 'light';
    const toggle = document.getElementById('theme-toggle');

    document.body.classList.toggle('light-mode', isLight);

    if (!toggle) return;

    toggle.setAttribute('aria-pressed', isLight ? 'true' : 'false');
    toggle.setAttribute('aria-label', isLight ? 'Switch to dark mode' : 'Switch to light mode');
}

function initThemeToggle() {
    const toggle = document.getElementById('theme-toggle');
    if (!toggle) return;

    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
    const initialTheme = storedTheme || (prefersLight ? 'light' : 'dark');
    applyTheme(initialTheme);

    toggle.addEventListener('click', () => {
        const isLight = document.body.classList.contains('light-mode');
        const nextTheme = isLight ? 'dark' : 'light';
        applyTheme(nextTheme);
        localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    });
}

function formatGeneratedAt(isoValue) {
    if (!isoValue) return '--';
    const parsed = new Date(isoValue);
    if (Number.isNaN(parsed.getTime())) return '--';
    return parsed.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

function formatRelativeTime(isoValue) {
    if (!isoValue) return '--';
    const parsed = new Date(isoValue);
    const diffMs = Date.now() - parsed.getTime();
    if (Number.isNaN(diffMs) || diffMs < 0) return 'just now';
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

function formatPatchDate(raw) {
    const iso = raw?.release_date_iso || raw?.releaseDateIso || null;
    if (iso) {
        const parsed = new Date(iso);
        if (!Number.isNaN(parsed.getTime())) {
            return parsed.toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
            });
        }
    }

    return String(raw?.releaseDate || raw?.release_date_display || 'Unknown date');
}

function updateUI() {
    const versionEl = document.getElementById('current-version');
    const patchVersionEl = document.getElementById('patch-version');
    const releaseDateEl = document.getElementById('release-date');
    const buildChannelEl = document.getElementById('build-channel');
    const statusEl = document.getElementById('release-status');
    const updatedEl = document.getElementById('patch-updated');
    const footerMetaEl = document.getElementById('footer-meta');

    if (versionEl) versionEl.textContent = PatchData.version || '--';
    if (patchVersionEl) patchVersionEl.textContent = PatchData.version || '--';
    if (releaseDateEl) releaseDateEl.textContent = PatchData.releaseDate || '--';
    if (buildChannelEl) buildChannelEl.textContent = PatchData.buildChannel || '--';
    if (updatedEl) updatedEl.textContent = `Last updated: ${formatGeneratedAt(PatchData.generatedAt)} (${formatRelativeTime(PatchData.generatedAt)})`;
    if (footerMetaEl) footerMetaEl.textContent = `Data source: starcitizen.tools • Updated ${formatRelativeTime(PatchData.generatedAt)}`;

    if (statusEl) {
        statusEl.textContent = PatchData.status || '--';
        const isLive = /deployed|live|released|current/i.test(PatchData.status || '');
        statusEl.classList.toggle('status-live', isLive);
    }

    const featuresEl = document.getElementById('stat-features');
    const improvementsEl = document.getElementById('stat-improvements');
    const fixesEl = document.getElementById('stat-fixes');
    const shipsEl = document.getElementById('stat-ships');

    if (featuresEl) featuresEl.textContent = PatchData.stats.features || '--';
    if (improvementsEl) improvementsEl.textContent = PatchData.stats.improvements || '--';
    if (fixesEl) fixesEl.textContent = PatchData.stats.fixes || '--';
    if (shipsEl) shipsEl.textContent = PatchData.stats.ships || '--';
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function createPatchItem(text) {
    const row = document.createElement('div');
    row.className = 'patch-item';

    const marker = document.createElement('span');
    marker.className = 'patch-marker';

    const paragraph = document.createElement('p');
    paragraph.className = 'patch-text';

    const safeText = escapeHtml(text);
    if (UIState.searchQuery) {
        const escaped = UIState.searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escaped})`, 'ig');
        paragraph.innerHTML = safeText.replace(regex, '<mark>$1</mark>');
    } else {
        paragraph.textContent = text;
    }

    row.appendChild(marker);
    row.appendChild(paragraph);
    return row;
}

function shouldIncludeCategory(category) {
    if (UIState.activeFilter === 'all') return true;
    const normalizedName = String(category.name || '').toLowerCase();
    return normalizedName.includes(UIState.activeFilter);
}

function filterCategoryItems(category) {
    if (!UIState.searchQuery) return category.items;
    const query = UIState.searchQuery.toLowerCase();
    return category.items.filter((item) => item.toLowerCase().includes(query));
}

function toggleCategory(categoryId, forceExpanded = null) {
    const shouldExpand = forceExpanded === null
        ? !UIState.expandedCategories.has(categoryId)
        : Boolean(forceExpanded);

    if (shouldExpand) UIState.expandedCategories.add(categoryId);
    else UIState.expandedCategories.delete(categoryId);
}

function createCategoryCard(category, index, visibleItems) {
    const categoryId = `${PatchData.selectedPatchId || 'patch'}-cat-${index}`;
    const contentId = `${categoryId}-content`;

    const card = document.createElement('div');
    card.className = 'category-card';

    const header = document.createElement('button');
    header.className = 'category-header';
    header.type = 'button';
    header.setAttribute('aria-controls', contentId);
    header.setAttribute('aria-expanded', UIState.expandedCategories.has(categoryId) ? 'true' : 'false');

    const title = document.createElement('span');
    title.className = 'category-title';
    title.textContent = category.name;

    const right = document.createElement('span');
    right.className = 'category-header-right';

    const count = document.createElement('span');
    count.className = 'category-count';
    count.textContent = String(visibleItems.length);

    const chevron = document.createElement('span');
    chevron.className = 'category-chevron';
    chevron.textContent = '▾';

    right.appendChild(count);
    right.appendChild(chevron);

    header.appendChild(title);
    header.appendChild(right);

    const content = document.createElement('div');
    content.className = 'category-content';
    content.id = contentId;

    const inner = document.createElement('div');
    inner.className = 'category-content-inner';

    visibleItems.forEach((item) => {
        inner.appendChild(createPatchItem(item));
    });

    content.appendChild(inner);

    const syncExpanded = () => {
        const expanded = UIState.expandedCategories.has(categoryId);
        header.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        content.classList.toggle('active', expanded);
    };

    header.addEventListener('click', () => {
        toggleCategory(categoryId);
        syncExpanded();
    });

    syncExpanded();

    card.appendChild(header);
    card.appendChild(content);
    return card;
}

function renderCategories() {
    const container = document.getElementById('patch-categories');
    const searchMeta = document.getElementById('search-meta');
    container.innerHTML = '';

    const filteredCategories = PatchData.categories
        .filter((category) => shouldIncludeCategory(category))
        .map((category) => ({ ...category, items: filterCategoryItems(category) }))
        .filter((category) => category.items.length);

    const totalMatches = filteredCategories.reduce((sum, category) => sum + category.items.length, 0);
    if (searchMeta) {
        if (UIState.searchQuery) searchMeta.textContent = `${totalMatches} matches`;
        else searchMeta.textContent = 'All notes';
    }

    if (!filteredCategories.length) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon"></div>
                <h3>No Matching Patch Notes</h3>
                <p>Try a different filter or search term.</p>
            </div>
        `;
        return;
    }

    filteredCategories.forEach((category, index) => {
        container.appendChild(createCategoryCard(category, index, category.items));
    });
}

function getPatchType(version) {
    const match = String(version || '').match(/^(\d+)\.(\d+)\.(\d+)/);
    if (!match) return 'Update';
    const patch = Number(match[3]);
    return patch === 0 ? 'Major' : 'Minor';
}

function renderHistory() {
    const container = document.getElementById('history-list');
    container.innerHTML = '';

    PatchData.history.forEach((entry, index) => {
        const patchId = entry.patchId || entry.version || String(index);
        const isSelected = PatchData.selectedPatchId
            ? patchId === PatchData.selectedPatchId
            : index === 0;

        const item = document.createElement('div');
        item.className = `history-item ${index === 0 ? 'current' : ''} ${isSelected ? 'selected' : ''}`.trim();
        item.setAttribute('role', 'button');
        item.setAttribute('tabindex', '0');

        const version = document.createElement('div');
        version.className = 'history-version';
        version.textContent = entry.version || 'Unknown';

        const date = document.createElement('div');
        date.className = 'history-date';
        date.textContent = entry.date || 'Unknown date';

        const meta = document.createElement('div');
        meta.className = 'history-meta';
        const total = Number(entry.totalChanges || 0);
        meta.textContent = `${getPatchType(entry.version)} • ${total} changes`;

        const status = document.createElement('div');
        status.className = 'history-status';
        status.textContent = entry.status || (index === 0 ? 'Current' : 'Archived');

        const middle = document.createElement('div');
        middle.appendChild(date);
        middle.appendChild(meta);

        item.appendChild(version);
        item.appendChild(middle);
        item.appendChild(status);

        const onSelect = () => selectPatchById(patchId, { scrollToNotes: true });
        item.addEventListener('click', onSelect);
        item.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelect();
            }
        });

        container.appendChild(item);
    });
}

function setLoadingState() {
    const container = document.getElementById('patch-categories');
    container.innerHTML = `
        <div class="empty-state">
            <h3>Loading Patch Data</h3>
            <p>Reading local patch dataset...</p>
            <div class="skeleton-list" aria-hidden="true">
                <div class="skeleton-row"></div>
                <div class="skeleton-row"></div>
                <div class="skeleton-row"></div>
            </div>
        </div>
    `;
}

function setErrorState(message) {
    const container = document.getElementById('patch-categories');
    container.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon"></div>
            <h3>Unable to Load Patch Data</h3>
            <p>${message}</p>
            <button type="button" class="empty-action" id="retry-load-btn">Retry</button>
        </div>
    `;

    const retry = document.getElementById('retry-load-btn');
    if (retry) retry.addEventListener('click', () => loadPatchDataset());
}

/**
 * Compare two semantic version strings (e.g., "4.0.2" vs "4.0.10")
 * Returns a comparator for descending order (newest first).
 */
function compareSemver(v1, v2) {
    const parts1 = String(v1 || '0').split('.').map(Number);
    const parts2 = String(v2 || '0').split('.').map(Number);
    const maxLen = Math.max(parts1.length, parts2.length);

    for (let i = 0; i < maxLen; i++) {
        const a = parts1[i] || 0;
        const b = parts2[i] || 0;
        if (a !== b) return b - a;
    }
    return 0;
}

function inferStatsFromCategories(categories) {
    const stats = { features: 0, improvements: 0, fixes: 0, ships: 0 };
    categories.forEach((category) => {
        const count = Array.isArray(category.items) ? category.items.length : 0;
        const name = String(category.name || '').toLowerCase();
        if (name.includes('feature')) stats.features += count;
        if (name.includes('improvement')) stats.improvements += count;
        if (name.includes('fix')) stats.fixes += count;
        if (name.includes('ship') || name.includes('vehicle')) stats.ships += count;
    });
    return stats;
}

function normalizePatch(raw, index) {
    const categories = Array.isArray(raw.categories)
        ? raw.categories
              .map((cat) => ({
                  name: String(cat.name || 'Notes'),
                  items: Array.isArray(cat.items) ? cat.items.map((v) => String(v)).filter(Boolean) : [],
              }))
              .filter((cat) => cat.items.length)
        : [];

    const inferredStats = inferStatsFromCategories(categories);
    const stats = {
        features: Number(raw.stats?.features ?? inferredStats.features) || 0,
        improvements: Number(raw.stats?.improvements ?? inferredStats.improvements) || 0,
        fixes: Number(raw.stats?.fixes ?? inferredStats.fixes) || 0,
        ships: Number(raw.stats?.ships ?? inferredStats.ships) || 0,
    };

    const normalizedDate = formatPatchDate(raw);

    return {
        patchId: String(raw.patch_id || raw.patchId || raw.version || `patch-${index}`),
        version: String(raw.version || 'Unknown'),
        date: normalizedDate,
        releaseDate: normalizedDate,
        releaseDateIso: raw.release_date_iso ? String(raw.release_date_iso) : null,
        buildChannel: String(raw.build_channel || 'LIVE'),
        status: String(raw.status || (index === 0 ? 'Current' : 'Archived')),
        categories,
        stats,
    };
}

function applyPatch(patch) {
    PatchData.selectedPatchId = patch.patchId;
    PatchData.version = patch.version;
    PatchData.releaseDate = patch.releaseDate;
    PatchData.buildChannel = patch.buildChannel;
    PatchData.status = patch.status;
    PatchData.categories = patch.categories;
    PatchData.stats = patch.stats;

    UIState.searchQuery = '';
    const searchEl = document.getElementById('patch-search');
    if (searchEl) searchEl.value = '';

    UIState.expandedCategories = new Set();
    if (patch.categories.length > 0) {
        UIState.expandedCategories.add(`${PatchData.selectedPatchId || 'patch'}-cat-0`);
    }
}

function scrollToPatchNotesSection() {
    const target = document.getElementById('patch-toolbar') || document.getElementById('patch-categories');
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function selectPatchById(patchId, options = {}) {
    const { scrollToNotes = false } = options;

    const selected = PatchStore.byId[patchId];
    if (!selected) return;

    applyPatch(selected);
    updateUI();
    renderCategories();
    renderHistory();

    if (scrollToNotes) {
        requestAnimationFrame(() => {
            scrollToPatchNotesSection();
        });
    }
}

function buildHistoryFromPatches(patches) {
    return patches.map((patch, index) => ({
        patchId: patch.patchId,
        version: patch.version,
        date: patch.date,
        status: index === 0 ? 'Current' : 'Archived',
        totalChanges: Number(patch.stats?.features || 0)
            + Number(patch.stats?.improvements || 0)
            + Number(patch.stats?.fixes || 0)
            + Number(patch.stats?.ships || 0),
    }));
}

function pruneOlderThanMonths(patches, months) {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);

    return patches.filter((patch) => {
        if (!patch.releaseDateIso) return true;
        const parsed = new Date(patch.releaseDateIso);
        if (Number.isNaN(parsed.getTime())) return true;
        return parsed >= cutoff;
    });
}

function renderFilterChips() {
    const container = document.getElementById('patch-filters');
    if (!container) return;

    const chipDefs = [
        { key: 'all', label: 'All' },
        { key: 'feature', label: 'Features' },
        { key: 'improvement', label: 'Improvements' },
        { key: 'fix', label: 'Bug Fixes' },
        { key: 'ship', label: 'Ships' },
        { key: 'known', label: 'Known Issues' },
    ];

    container.innerHTML = '';
    chipDefs.forEach((chip) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `filter-chip ${UIState.activeFilter === chip.key ? 'active' : ''}`.trim();
        btn.textContent = chip.label;
        btn.setAttribute('role', 'tab');
        btn.setAttribute('aria-selected', UIState.activeFilter === chip.key ? 'true' : 'false');

        btn.addEventListener('click', () => {
            UIState.activeFilter = chip.key;
            renderFilterChips();
            renderCategories();
        });

        container.appendChild(btn);
    });
}

function initToolbarActions() {
    const search = document.getElementById('patch-search');
    const clearSearch = document.getElementById('clear-search-btn');
    const expandAll = document.getElementById('expand-all-btn');
    const collapseAll = document.getElementById('collapse-all-btn');

    if (search) {
        search.addEventListener('input', () => {
            UIState.searchQuery = search.value.trim();
            renderCategories();
        });
    }

    if (clearSearch) {
        clearSearch.addEventListener('click', () => {
            UIState.searchQuery = '';
            if (search) search.value = '';
            renderCategories();
        });
    }

    if (expandAll) {
        expandAll.addEventListener('click', () => {
            UIState.expandedCategories = new Set(
                PatchData.categories.map((_, index) => `${PatchData.selectedPatchId || 'patch'}-cat-${index}`),
            );
            renderCategories();
        });
    }

    if (collapseAll) {
        collapseAll.addEventListener('click', () => {
            UIState.expandedCategories = new Set();
            renderCategories();
        });
    }
}

function initBackToTop() {
    const button = document.getElementById('back-to-top');
    if (!button) return;

    const updateVisibility = () => {
        button.classList.toggle('visible', window.scrollY > 500);
    };

    window.addEventListener('scroll', updateVisibility, { passive: true });
    updateVisibility();

    button.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

async function loadPatchDataset() {
    setLoadingState();

    try {
        let payload = null;
        if (window.STAR_NOTES_DATA && Array.isArray(window.STAR_NOTES_DATA.patches)) {
            payload = window.STAR_NOTES_DATA;
        } else {
            const response = await fetch(PATCH_DATA_URL, { cache: 'no-store' });
            if (!response.ok) {
                throw new Error(`Failed to load ${PATCH_DATA_URL} (${response.status})`);
            }
            payload = await response.json();
        }

        const rawPatches = Array.isArray(payload?.patches) ? payload.patches : [];
        if (!rawPatches.length) {
            throw new Error('No patches found in local dataset.');
        }

        const normalized = rawPatches.map((patch, idx) => normalizePatch(patch, idx));
        normalized.sort((a, b) => compareSemver(a.version, b.version));

        const recentOnly = pruneOlderThanMonths(normalized, 3);

        PatchStore.patches = recentOnly;
        PatchStore.byId = Object.fromEntries(recentOnly.map((patch) => [patch.patchId, patch]));
        PatchData.generatedAt = payload?.generated_at || null;

        if (!PatchStore.patches.length) {
            throw new Error('No patches in last 3 months in local dataset.');
        }

        PatchData.history = buildHistoryFromPatches(PatchStore.patches);
        applyPatch(PatchStore.patches[0]);

        updateUI();
        renderFilterChips();
        renderCategories();
        renderHistory();
    } catch (error) {
        console.error(error);
        setErrorState('Patch dataset is missing or invalid. Run the update script to regenerate data/patches.json.');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initThemeToggle();
    initToolbarActions();
    initBackToTop();
    updateUI();
    renderFilterChips();
    renderCategories();
    renderHistory();
    loadPatchDataset();
});

// Register service worker for offline support
if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js', { scope: './' })
        .then((reg) => console.log('[SW] Registered:', reg.scope))
        .catch((err) => console.warn('[SW] Registration failed:', err));
}
