document.addEventListener('DOMContentLoaded', () => {
    // 1. Locate search icon in navbar
    const searchIcon = Array.from(document.querySelectorAll('nav button, nav span, nav a')).find(el => el.textContent.trim() === 'search');
    
    if (!searchIcon) {
        console.warn('Search icon not found in navbar');
        return;
    }

    // 2. Create and inject full-width dark search bar
    const searchBar = document.createElement('div');
    searchBar.id = 'dynamic-search-bar';
    searchBar.className = 'fixed left-0 w-full z-40 bg-[#140d06]/95 backdrop-blur-xl border-b border-white/10 px-6 py-4 transition-all duration-300 transform -translate-y-full opacity-0 hidden';
    searchBar.style.top = '73px'; // Placed directly below navbar
    searchBar.innerHTML = `
        <div class="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <span class="material-symbols-outlined text-primary text-2xl">search</span>
            <input type="text" id="search-input" class="flex-grow bg-transparent border-0 focus:ring-0 text-on-surface text-lg placeholder-on-surface-variant/40 uppercase font-label-caps focus:outline-none" placeholder="Search elite drops... (Press Enter to search, Esc to close)" />
            <button id="close-search-btn" class="material-symbols-outlined text-on-surface-variant hover:text-primary transition-colors focus:outline-none">close</button>
        </div>
    `;
    document.body.appendChild(searchBar);

    const input = document.getElementById('search-input');
    const closeBtn = document.getElementById('close-search-btn');

    // 3. Toggle functions
    function openSearch() {
        searchBar.classList.remove('hidden');
        // Force DOM reflow
        searchBar.offsetHeight;
        searchBar.classList.remove('-translate-y-full', 'opacity-0');
        if (input) {
            input.value = '';
            input.focus();
        }
    }

    function closeSearch() {
        searchBar.classList.add('-translate-y-full', 'opacity-0');
        setTimeout(() => {
            searchBar.classList.add('hidden');
        }, 300);
    }

    function toggleSearch() {
        const isHidden = searchBar.classList.contains('hidden');
        if (isHidden) {
            openSearch();
        } else {
            closeSearch();
        }
    }

    // 4. Event listeners
    searchIcon.addEventListener('click', (e) => {
        e.preventDefault();
        toggleSearch();
    });

    closeBtn.addEventListener('click', closeSearch);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !searchBar.classList.contains('hidden')) {
            closeSearch();
        }
    });

    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const query = input.value.trim();
            if (query) {
                closeSearch();
                window.location.href = `category.html?search=${encodeURIComponent(query)}`;
            }
        }
    });
});
