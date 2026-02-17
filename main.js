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

document.addEventListener('DOMContentLoaded', updateUI);
