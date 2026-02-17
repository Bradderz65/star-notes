const PatchData = {
    version: "4.0.2",
    releaseDate: "February 2026",
    
    stats: {
        features: 0,
        improvements: 0,
        fixes: 0,
        ships: 0
    },
    
    categories: []
};

const THEME_STORAGE_KEY = 'star-notes-theme';

function applyTheme(theme) {
    const isLight = theme === 'light';
    const toggle = document.getElementById('theme-toggle');
    const label = document.getElementById('theme-toggle-text');

    document.body.classList.toggle('light-mode', isLight);

    if (!toggle || !label) {
        return;
    }

    toggle.setAttribute('aria-pressed', isLight ? 'true' : 'false');
    toggle.setAttribute('aria-label', isLight ? 'Switch to dark mode' : 'Switch to light mode');
    label.textContent = isLight ? 'Light' : 'Dark';
}

function initThemeToggle() {
    const toggle = document.getElementById('theme-toggle');
    if (!toggle) {
        return;
    }

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
    document.getElementById('current-version').textContent = PatchData.version;
    document.getElementById('patch-version').textContent = PatchData.version;
    document.getElementById('release-date').textContent = PatchData.releaseDate;
    
    document.getElementById('stat-features').textContent = PatchData.stats.features || '--';
    document.getElementById('stat-improvements').textContent = PatchData.stats.improvements || '--';
    document.getElementById('stat-fixes').textContent = PatchData.stats.fixes || '--';
    document.getElementById('stat-ships').textContent = PatchData.stats.ships || '--';
}

function renderCategories() {
    const container = document.getElementById('patch-categories');
    
    if (PatchData.categories.length === 0) {
        return;
    }
    
    container.innerHTML = '';
    
    PatchData.categories.forEach(category => {
        const card = document.createElement('div');
        card.className = 'category-card';
        
        card.innerHTML = `
            <div class="category-header" onclick="toggleCategory(this)">
                <span class="category-title">${category.name}</span>
                <span class="category-count">${category.items.length}</span>
            </div>
            <div class="category-content">
                ${category.items.map(item => `
                    <div class="patch-item">
                        <span class="patch-marker"></span>
                        <p class="patch-text">${item}</p>
                    </div>
                `).join('')}
            </div>
        `;
        
        container.appendChild(card);
    });
}

function toggleCategory(header) {
    const content = header.nextElementSibling;
    content.classList.toggle('active');
}

function addCategory(name, items) {
    PatchData.categories.push({ name, items });
    renderCategories();
}

function setStats(stats) {
    Object.assign(PatchData.stats, stats);
    updateUI();
}

function setVersion(version, date) {
    PatchData.version = version;
    PatchData.releaseDate = date;
    updateUI();
}

document.addEventListener('DOMContentLoaded', () => {
    initThemeToggle();
    updateUI();
});
