// Route Selector Component for Route Generator v5
// Manages route alternatives display and selection

class RouteSelector {
    constructor() {
        this.routes = [];
        this.selectedRouteIndex = 0;
        this.carousel = null;
        this.carouselTrack = null;
        this.carouselPrev = null;
        this.carouselNext = null;
        this.carouselClose = null;
    }

    // Initialize the route selector
    init() {
        this.carousel = document.getElementById('routeCarousel');
        this.carouselTrack = document.getElementById('carouselTrack');
        this.carouselPrev = document.getElementById('carouselPrev');
        this.carouselNext = document.getElementById('carouselNext');
        this.carouselClose = document.getElementById('carouselClose');
        
        if (!this.carousel || !this.carouselTrack) {
            console.error('Route carousel elements not found in DOM');
            return false;
        }
        
        this.setupCarouselControls();
        return true;
    }

    // Setup carousel navigation controls
    setupCarouselControls() {
        // Previous button
        if (this.carouselPrev) {
            this.carouselPrev.addEventListener('click', () => this.scrollPrevious());
        }

        // Next button
        if (this.carouselNext) {
            this.carouselNext.addEventListener('click', () => this.scrollNext());
        }

        // Close button
        if (this.carouselClose) {
            this.carouselClose.addEventListener('click', () => this.hideCarousel());
        }

        // Track scroll events to update navigation buttons
        if (this.carouselTrack) {
            this.carouselTrack.addEventListener('scroll', () => this.updateNavButtons());
            
            // Add touch/swipe support for mobile
            this.setupTouchSupport();
        }
    }

    // Display route alternatives sorted by score
    displayRoutes(routes) {
        if (!this.init()) return;

        // Sort routes by AI score (highest first)
        this.routes = [...routes].sort((a, b) => (b.aiScore || 0) - (a.aiScore || 0));
        this.selectedRouteIndex = 0; // Select best route by default

        if (this.routes.length === 0) {
            this.hideCarousel();
            return;
        }

        // Generate route tiles
        this.renderRouteTiles();
        
        // Show the carousel
        this.showCarousel();

        // Notify of initial selection
        this.onRouteSelected(0);
    }

    // Render route tiles in the carousel
    renderRouteTiles() {
        if (!this.carouselTrack) return;

        this.carouselTrack.innerHTML = '';

        this.routes.forEach((route, index) => {
            const tile = this.createRouteTile(route, index);
            this.carouselTrack.appendChild(tile);
        });

        // Update navigation buttons
        this.updateNavButtons();
    }

    // Create a single route tile element
    createRouteTile(route, index) {
        const tile = document.createElement('div');
        tile.className = `route-tile ${index === this.selectedRouteIndex ? 'selected' : ''}`;
        tile.setAttribute('data-route-index', index);

        // Format route data
        const distance = route.distance ? `${route.distance.toFixed(1)}km` : 'N/A';
        const elevation = route.ascent ? `${Math.round(route.ascent)}m` : 'N/A';
        const duration = route.duration ? this.formatDuration(route.duration) : 'N/A';
        const score = route.aiScore ? `${Math.round(route.aiScore * 100)}%` : 'N/A';
        const scoreLabel = route.usedAI ? 'AI' : 'Score';

        tile.innerHTML = `
            <div class="route-tile-header">
                <div class="route-rank">${index + 1}</div>
                <div class="route-score">${scoreLabel}: ${score}</div>
            </div>
            <div class="route-tile-stats">
                <div class="route-stat">
                    <div class="route-stat-label">Distance</div>
                    <div class="route-stat-value">${distance}</div>
                </div>
                <div class="route-stat">
                    <div class="route-stat-label">Elevation</div>
                    <div class="route-stat-value">${elevation}</div>
                </div>
                <div class="route-stat">
                    <div class="route-stat-label">Duration</div>
                    <div class="route-stat-value">${duration}</div>
                </div>
                <div class="route-stat">
                    <div class="route-stat-label">Type</div>
                    <div class="route-stat-value">${route.type || 'Loop'}</div>
                </div>
            </div>
        `;

        // Add click handler
        tile.addEventListener('click', () => {
            this.selectRoute(index);
        });

        return tile;
    }

    // Select a route by index
    selectRoute(index) {
        if (index < 0 || index >= this.routes.length) return;

        // Update selected index
        const previousIndex = this.selectedRouteIndex;
        this.selectedRouteIndex = index;

        // Update visual selection
        this.updateCardSelection(previousIndex, index);

        // Notify of selection change
        this.onRouteSelected(index);
    }

    // Update visual selection of tiles
    updateCardSelection(previousIndex, newIndex) {
        const tiles = this.carouselTrack.querySelectorAll('.route-tile');
        
        // Remove previous selection
        if (tiles[previousIndex]) {
            tiles[previousIndex].classList.remove('selected');
        }

        // Add new selection
        if (tiles[newIndex]) {
            tiles[newIndex].classList.add('selected');
            
            // Scroll selected tile into view
            this.scrollToTile(newIndex);
        }
    }

    // Handle route selection (override this or use events)
    onRouteSelected(index) {
        const selectedRoute = this.routes[index];
        if (!selectedRoute) return;

        // Update map display
        if (window.MapController && window.MapController.displayRoute) {
            window.MapController.displayRoute(selectedRoute);
        }

        // Update route info panel
        if (window.App && window.App.updateRouteInfoPanel) {
            window.App.updateRouteInfoPanel(selectedRoute);
        }

        // Dispatch custom event for other components
        const event = new CustomEvent('routeSelected', {
            detail: {
                route: selectedRoute,
                index: index,
                allRoutes: this.routes
            }
        });
        document.dispatchEvent(event);

        console.log(`Route ${index + 1} selected:`, selectedRoute);
    }

    // Format duration from seconds to readable format
    formatDuration(seconds) {
        if (!seconds || seconds <= 0) return 'N/A';

        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);

        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    }

    // Carousel navigation methods
    scrollPrevious() {
        if (this.carouselTrack) {
            const scrollAmount = 220; // Slightly more than tile width
            this.carouselTrack.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
        }
    }

    scrollNext() {
        if (this.carouselTrack) {
            const scrollAmount = 220; // Slightly more than tile width
            this.carouselTrack.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
    }

    scrollToTile(index) {
        if (this.carouselTrack && index >= 0 && index < this.routes.length) {
            const tiles = this.carouselTrack.querySelectorAll('.route-tile');
            if (tiles[index]) {
                tiles[index].scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'nearest',
                    inline: 'center'
                });
            }
        }
    }

    updateNavButtons() {
        if (!this.carouselTrack || !this.carouselPrev || !this.carouselNext) return;

        const { scrollLeft, scrollWidth, clientWidth } = this.carouselTrack;
        
        // Disable/enable previous button
        this.carouselPrev.disabled = scrollLeft <= 0;
        
        // Disable/enable next button  
        this.carouselNext.disabled = scrollLeft >= scrollWidth - clientWidth - 1;
    }

    // Setup touch/swipe support for mobile
    setupTouchSupport() {
        if (!this.carouselTrack) return;

        let startX = null;
        let startScrollLeft = null;
        let isDragging = false;

        // Touch start
        this.carouselTrack.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startScrollLeft = this.carouselTrack.scrollLeft;
            isDragging = true;
        }, { passive: true });

        // Touch move
        this.carouselTrack.addEventListener('touchmove', (e) => {
            if (!isDragging || startX === null) return;
            
            const touchX = e.touches[0].clientX;
            const deltaX = startX - touchX;
            this.carouselTrack.scrollLeft = startScrollLeft + deltaX;
        }, { passive: true });

        // Touch end
        this.carouselTrack.addEventListener('touchend', () => {
            isDragging = false;
            startX = null;
            startScrollLeft = null;
        }, { passive: true });

        // Mouse events for desktop drag support
        this.carouselTrack.addEventListener('mousedown', (e) => {
            startX = e.clientX;
            startScrollLeft = this.carouselTrack.scrollLeft;
            isDragging = true;
            this.carouselTrack.style.cursor = 'grabbing';
        });

        this.carouselTrack.addEventListener('mousemove', (e) => {
            if (!isDragging || startX === null) return;
            
            e.preventDefault();
            const deltaX = startX - e.clientX;
            this.carouselTrack.scrollLeft = startScrollLeft + deltaX;
        });

        this.carouselTrack.addEventListener('mouseup', () => {
            isDragging = false;
            startX = null;
            startScrollLeft = null;
            this.carouselTrack.style.cursor = 'grab';
        });

        this.carouselTrack.addEventListener('mouseleave', () => {
            isDragging = false;
            startX = null;
            startScrollLeft = null;
            this.carouselTrack.style.cursor = 'grab';
        });

        // Set initial cursor
        this.carouselTrack.style.cursor = 'grab';
    }

    // Show carousel
    showCarousel() {
        if (this.carousel) {
            this.carousel.style.display = 'block';
            // Update nav buttons after showing
            setTimeout(() => this.updateNavButtons(), 100);
        }
    }

    // Hide carousel
    hideCarousel() {
        if (this.carousel) {
            this.carousel.style.display = 'none';
        }
    }

    // Get currently selected route
    getSelectedRoute() {
        return this.routes[this.selectedRouteIndex] || null;
    }

    // Get all routes
    getAllRoutes() {
        return [...this.routes];
    }

    // Get selected route index
    getSelectedIndex() {
        return this.selectedRouteIndex;
    }

    // Clear all routes
    clear() {
        this.routes = [];
        this.selectedRouteIndex = 0;
        
        if (this.carouselTrack) {
            this.carouselTrack.innerHTML = '';
        }
        
        this.hideCarousel();
    }

    // Get component stats for debugging
    getStats() {
        return {
            routeCount: this.routes.length,
            selectedIndex: this.selectedRouteIndex,
            selectedRoute: this.getSelectedRoute(),
            isVisible: this.carousel ? 
                this.carousel.style.display !== 'none' : false
        };
    }
}

// Export as global object
window.RouteSelector = new RouteSelector();

// Make stats function available for debugging
window.getRouteSelectorStats = () => window.RouteSelector.getStats();