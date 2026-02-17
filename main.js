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
};

const PatchStore = {
    patches: [],
    byId: {},
};

function applyTheme(theme) {
    const isLight = theme === 'light';
    const toggle = document.getElementById('theme-toggle');
    const label = document.getElementById('theme-toggle-text');

    document.body.classList.toggle('light-mode', isLight);

    if (!toggle || !label) return;

    toggle.setAttribute('aria-pressed', isLight ? 'true' : 'false');
    toggle.setAttribute('aria-label', isLight ? 'Switch to dark mode' : 'Switch to light mode');
    label.textContent = isLight ? 'Light' : 'Dark';
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

function updateUI() {
    const versionEl = document.getElementById('current-version');
    const patchVersionEl = document.getElementById('patch-version');
    const releaseDateEl = document.getElementById('release-date');
    const buildChannelEl = document.getElementById('build-channel');
    const statusEl = document.getElementById('release-status');

    if (versionEl) versionEl.textContent = PatchData.version || '--';
    if (patchVersionEl) patchVersionEl.textContent = PatchData.version || '--';
    if (releaseDateEl) releaseDateEl.textContent = PatchData.releaseDate || '--';
    if (buildChannelEl) buildChannelEl.textContent = PatchData.buildChannel || '--';

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

function createPatchItem(text) {
    const row = document.createElement('div');
    row.className = 'patch-item';

    const marker = document.createElement('span');
    marker.className = 'patch-marker';

    const paragraph = document.createElement('p');
    paragraph.className = 'patch-text';
    paragraph.textContent = text;

    row.appendChild(marker);
    row.appendChild(paragraph);
    return row;
}

function createCategoryCard(category) {
    const card = document.createElement('div');
    card.className = 'category-card';

    const header = document.createElement('div');
    header.className = 'category-header';

    const title = document.createElement('span');
    title.className = 'category-title';
    title.textContent = category.name;

    const count = document.createElement('span');
    count.className = 'category-count';
    count.textContent = String(category.items.length);

    header.appendChild(title);
    header.appendChild(count);

    const content = document.createElement('div');
    content.className = 'category-content';

    category.items.forEach((item) => {
        content.appendChild(createPatchItem(item));
    });

    header.addEventListener('click', () => {
        content.classList.toggle('active');
    });

    card.appendChild(header);
    card.appendChild(content);
    return card;
}

function renderCategories() {
    const container = document.getElementById('patch-categories');
    container.innerHTML = '';

    if (!PatchData.categories.length) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon"></div>
                <h3>No Patch Notes Available</h3>
                <p>Content will appear here once patch notes are published.</p>
            </div>
        `;
        return;
    }

    PatchData.categories.forEach((category) => {
        container.appendChild(createCategoryCard(category));
    });
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

        const status = document.createElement('div');
        status.className = 'history-status';
        status.textContent = entry.status || (index === 0 ? 'Current' : 'Archived');

        item.appendChild(version);
        item.appendChild(date);
        item.appendChild(status);

        const onSelect = () => selectPatchById(patchId);
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
            <div class="empty-icon"></div>
            <h3>Loading Patch Data</h3>
            <p>Reading local patch dataset...</p>
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
        </div>
    `;
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
        if (a !== b) return b - a; // Descending order (newest first)
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

    return {
        patchId: String(raw.patch_id || raw.patchId || raw.version || `patch-${index}`),
        version: String(raw.version || 'Unknown'),
        date: String(raw.release_date_display || raw.releaseDate || raw.release_date_iso || 'Unknown date'),
        releaseDate: String(raw.release_date_display || raw.releaseDate || raw.release_date_iso || 'Unknown date'),
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
}

function selectPatchById(patchId) {
    const selected = PatchStore.byId[patchId];
    if (!selected) return;
    applyPatch(selected);
    updateUI();
    renderCategories();
    renderHistory();
}

function buildHistoryFromPatches(patches) {
    return patches.map((patch, index) => ({
        patchId: patch.patchId,
        version: patch.version,
        date: patch.date,
        status: index === 0 ? 'Current' : 'Archived',
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
        
        // Sort by semantic version (newest first)
        normalized.sort((a, b) => compareSemver(a.version, b.version));
        
        const recentOnly = pruneOlderThanMonths(normalized, 3);

        PatchStore.patches = recentOnly;
        PatchStore.byId = Object.fromEntries(recentOnly.map((patch) => [patch.patchId, patch]));

        if (!PatchStore.patches.length) {
            throw new Error('No patches in last 3 months in local dataset.');
        }

        PatchData.history = buildHistoryFromPatches(PatchStore.patches);
        applyPatch(PatchStore.patches[0]);

        updateUI();
        renderCategories();
        renderHistory();
    } catch (error) {
        console.error(error);
        setErrorState('Patch dataset is missing or invalid. Run the update script to regenerate data/patches.json.');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initThemeToggle();
    updateUI();
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
