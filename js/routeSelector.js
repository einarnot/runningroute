// Route Selector Component for Route Generator v5
// Manages route alternatives display and selection

class RouteSelector {
    constructor() {
        this.routes = [];
        this.selectedRouteIndex = 0;
        this.alternativesPanel = null;
        this.alternativesList = null;
    }

    // Initialize the route selector
    init() {
        this.alternativesPanel = document.getElementById('routeAlternatives');
        this.alternativesList = document.getElementById('alternativesList');
        
        if (!this.alternativesPanel || !this.alternativesList) {
            console.error('Route selector elements not found in DOM');
            return false;
        }
        
        return true;
    }

    // Display route alternatives sorted by score
    displayRoutes(routes) {
        if (!this.init()) return;

        // Sort routes by AI score (highest first)
        this.routes = [...routes].sort((a, b) => (b.aiScore || 0) - (a.aiScore || 0));
        this.selectedRouteIndex = 0; // Select best route by default

        if (this.routes.length === 0) {
            this.hideAlternatives();
            return;
        }

        // Generate route cards
        this.renderRouteCards();
        
        // Show the alternatives panel
        this.showAlternatives();

        // Notify of initial selection
        this.onRouteSelected(0);
    }

    // Render route cards in the alternatives list
    renderRouteCards() {
        if (!this.alternativesList) return;

        this.alternativesList.innerHTML = '';

        this.routes.forEach((route, index) => {
            const card = this.createRouteCard(route, index);
            this.alternativesList.appendChild(card);
        });
    }

    // Create a single route card element
    createRouteCard(route, index) {
        const card = document.createElement('div');
        card.className = `route-card ${index === this.selectedRouteIndex ? 'selected' : ''}`;
        card.setAttribute('data-route-index', index);

        // Format route data
        const distance = route.distance ? `${route.distance.toFixed(1)} km` : 'N/A';
        const elevation = route.ascent ? `${Math.round(route.ascent)} m` : 'N/A';
        const duration = route.duration ? this.formatDuration(route.duration) : 'N/A';
        const score = route.aiScore ? `${Math.round(route.aiScore * 100)}%` : 'N/A';
        const scoreLabel = route.usedAI ? 'AI Score' : 'Score';

        card.innerHTML = `
            <div class="route-card-header">
                <div class="route-rank">${index + 1}</div>
                <div class="route-score">${scoreLabel}: ${score}</div>
            </div>
            <div class="route-card-stats">
                <div class="route-stat">
                    <span class="route-stat-label">Distance</span>
                    <span class="route-stat-value">${distance}</span>
                </div>
                <div class="route-stat">
                    <span class="route-stat-label">Elevation</span>
                    <span class="route-stat-value">${elevation}</span>
                </div>
                <div class="route-stat">
                    <span class="route-stat-label">Duration</span>
                    <span class="route-stat-value">${duration}</span>
                </div>
                <div class="route-stat">
                    <span class="route-stat-label">Type</span>
                    <span class="route-stat-value">${route.type || 'Loop'}</span>
                </div>
            </div>
            ${route.aiReasoning ? `
                <div class="route-card-reasoning">
                    ${route.aiReasoning}
                </div>
            ` : ''}
        `;

        // Add click handler
        card.addEventListener('click', () => {
            this.selectRoute(index);
        });

        return card;
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

    // Update visual selection of cards
    updateCardSelection(previousIndex, newIndex) {
        const cards = this.alternativesList.querySelectorAll('.route-card');
        
        // Remove previous selection
        if (cards[previousIndex]) {
            cards[previousIndex].classList.remove('selected');
        }

        // Add new selection
        if (cards[newIndex]) {
            cards[newIndex].classList.add('selected');
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

    // Show alternatives panel
    showAlternatives() {
        if (this.alternativesPanel) {
            this.alternativesPanel.style.display = 'block';
        }
    }

    // Hide alternatives panel
    hideAlternatives() {
        if (this.alternativesPanel) {
            this.alternativesPanel.style.display = 'none';
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
        
        if (this.alternativesList) {
            this.alternativesList.innerHTML = '';
        }
        
        this.hideAlternatives();
    }

    // Get component stats for debugging
    getStats() {
        return {
            routeCount: this.routes.length,
            selectedIndex: this.selectedRouteIndex,
            selectedRoute: this.getSelectedRoute(),
            isVisible: this.alternativesPanel ? 
                this.alternativesPanel.style.display !== 'none' : false
        };
    }
}

// Export as global object
window.RouteSelector = new RouteSelector();

// Make stats function available for debugging
window.getRouteSelectorStats = () => window.RouteSelector.getStats();