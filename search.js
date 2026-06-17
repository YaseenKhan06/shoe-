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

    // 5. Initial counters check
    if (window.updateNavbarCounters) {
        window.updateNavbarCounters();
    }

    // 6. Setup Navbar Dropdown for logged-in user
    setupUserNavbarDropdown();
});

// Global Function to update navbar badges
window.updateNavbarCounters = async function() {
    const token = localStorage.getItem('userToken');
    if (!token) {
        const cartBadge = document.getElementById('cart-badge');
        const wishlistBadge = document.getElementById('wishlist-badge');
        if (cartBadge) cartBadge.innerText = '0';
        if (wishlistBadge) wishlistBadge.innerText = '0';
        return;
    }

    try {
        // Fetch cart items
        const cartRes = await fetch('/api/cart', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (cartRes.ok) {
            const cartItems = await cartRes.json();
            const cartBadge = document.getElementById('cart-badge');
            if (cartBadge) {
                const totalQty = cartItems.reduce((acc, item) => acc + (item.quantity || 1), 0);
                cartBadge.innerText = totalQty;
            }
        }

        // Fetch wishlist items
        const wishlistRes = await fetch('/api/wishlist', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (wishlistRes.ok) {
            const wishlistItems = await wishlistRes.json();
            const wishlistBadge = document.getElementById('wishlist-badge');
            if (wishlistBadge) {
                wishlistBadge.innerText = wishlistItems.length;
            }
        }
    } catch (err) {
        console.error("Error updating navbar counters:", err);
    }
};

// Global Function to dynamically wrap user icon in a dropdown menu
function setupUserNavbarDropdown() {
    const navLink = document.getElementById('user-nav-link');
    if (!navLink) return;

    const token = localStorage.getItem('userToken');
    if (!token) return; // Keep default Login link structure if not logged in

    // Clone the link to strip any hardcoded logout listeners attached by individual HTML templates
    const newNavLink = navLink.cloneNode(true);
    navLink.parentNode.replaceChild(newNavLink, navLink);

    // Hide user-nav-text so it leaves only the material person icon
    const navText = newNavLink.querySelector('#user-nav-text') || document.getElementById('user-nav-text');
    if (navText) navText.classList.add('hidden');

    // Create wrapper container
    const wrapper = document.createElement('div');
    wrapper.className = 'relative inline-block';
    newNavLink.parentNode.insertBefore(wrapper, newNavLink);
    wrapper.appendChild(newNavLink);

    // Create dropdown element
    const dropdown = document.createElement('div');
    dropdown.id = 'user-dropdown-menu';
    dropdown.className = 'hidden absolute right-0 mt-2 w-48 bg-[#140d06]/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-xl z-50 p-2 space-y-1';
    dropdown.innerHTML = `
        <a href="my-orders.html" class="flex items-center gap-2 px-4 py-2.5 text-xs font-label-caps uppercase tracking-wider text-on-surface-variant hover:text-primary hover:bg-white/5 rounded transition-all">
            <span class="material-symbols-outlined text-sm">receipt_long</span> My Orders
        </a>
        <a href="wishlist.html" class="flex items-center gap-2 px-4 py-2.5 text-xs font-label-caps uppercase tracking-wider text-on-surface-variant hover:text-primary hover:bg-white/5 rounded transition-all">
            <span class="material-symbols-outlined text-sm">favorite</span> Wishlist
        </a>
        <a href="profile.html" class="flex items-center gap-2 px-4 py-2.5 text-xs font-label-caps uppercase tracking-wider text-on-surface-variant hover:text-primary hover:bg-white/5 rounded transition-all">
            <span class="material-symbols-outlined text-sm">home_pin</span> Saved Addresses
        </a>
        <hr class="border-white/5 my-1" />
        <button id="nav-logout-btn" class="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-label-caps uppercase tracking-wider text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded text-left transition-all focus:outline-none">
            <span class="material-symbols-outlined text-sm text-red-400">logout</span> Logout
        </button>
    `;
    wrapper.appendChild(dropdown);

    // Event listeners
    newNavLink.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropdown.classList.toggle('hidden');
    });

    document.getElementById('nav-logout-btn').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('userToken');
        window.location.href = 'auth.html';
    });

    document.addEventListener('click', (e) => {
        if (!wrapper.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
    });
}

// Global function to add product to cart and update counters
window.addToCartGlobal = async function(productId) {
    const token = localStorage.getItem('userToken');
    if (!token) {
        alert("Please login to continue");
        window.location.href = 'auth.html';
        return;
    }

    try {
        const res = await fetch('/api/cart/add', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ productId, quantity: 1 })
        });

        const data = await res.json();
        if (res.ok && data.success) {
            alert("Added");
            if (window.updateNavbarCounters) {
                window.updateNavbarCounters();
            }
        } else {
            alert(data.error || "Failed to add product to cart.");
        }
    } catch (err) {
        console.error("Global Add to Cart error:", err);
        alert("Network error. Could not connect to API.");
    }
};
