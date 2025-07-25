// Main application controller
class App {
    constructor() {
        this.map = null;
        this.routeService = null;
        this.currentLocation = null;
        this.isGenerating = false;
        
        this.initialize();
    }
    
    /**
     * Initialize the application
     */
    async initialize() {
        try {
            // Initialize services
            this.routeService = new RouteService();
            
            // Initialize map
            this.map = new MapComponent('map');
            
            // Set up UI event listeners
            this.setupEventListeners();
            
            // Get user location
            await this.getUserLocation();
            
            // Initialize UI state
            this.updateDistanceDisplay();
            
            console.log('App initialized successfully');
            
        } catch (error) {
            console.error('Error initializing app:', error);
            this.showError('Failed to initialize the application');
        }
    }
    
    /**
     * Set up event listeners for UI interactions
     */
    setupEventListeners() {
        // Distance slider
        const distanceSlider = document.getElementById('distance');
        if (distanceSlider) {
            distanceSlider.addEventListener('input', () => {
                this.updateDistanceDisplay();
            });
        }
        
        // Generate route button
        const generateBtn = document.getElementById('generateBtn');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => {
                this.generateRoute();
            });
        }
        
        // Location button
        const locationBtn = document.getElementById('locationBtn');
        if (locationBtn) {
            locationBtn.addEventListener('click', () => {
                this.getUserLocation(true);
            });
        }
        
        // Input panel toggle
        const panelHeader = document.querySelector('.panel-header');
        if (panelHeader) {
            panelHeader.addEventListener('click', () => {
                this.toggleInputPanel();
            });
        }
        
        // Close stats button
        const closeStats = document.getElementById('closeStats');
        if (closeStats) {
            closeStats.addEventListener('click', () => {
                this.hideRouteStats();
            });
        }
        
        // Close error button
        const closeError = document.getElementById('closeError');
        if (closeError) {
            closeError.addEventListener('click', () => {
                this.hideError();
            });
        }
        
        // Handle window resize
        window.addEventListener('resize', () => {
            if (this.map) {
                this.map.resize();
            }
        });
        
        // Handle orientation change on mobile
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                if (this.map) {
                    this.map.resize();
                }
            }, 100);
        });
    }
    
    /**
     * Get user's current location
     * @param {boolean} centerMap - Whether to center map on location
     */
    async getUserLocation(centerMap = false) {
        try {
            this.showLoading('Getting your location...');
            
            const location = await this.routeService.getCurrentLocation();
            this.currentLocation = location;
            
            if (this.map) {
                this.map.setCurrentLocation(location);
                
                if (centerMap) {
                    // Center map on user location
                    this.map.map.setView(location, CONFIG.DEFAULT_ZOOM);
                }
            }
            
            this.hideLoading();
            
        } catch (error) {
            console.error('Error getting location:', error);
            this.hideLoading();
            
            // Use default location if geolocation fails
            this.currentLocation = CONFIG.DEFAULT_CENTER;
            if (this.map) {
                this.map.setCurrentLocation(this.currentLocation);
            }
            
            if (centerMap) {
                this.showError('Could not get your location. Using default location.');
            }
        }
    }
    
    /**
     * Generate a new route based on user preferences
     */
    async generateRoute() {
        if (this.isGenerating) {
            return; // Prevent multiple simultaneous requests
        }
        
        try {
            this.isGenerating = true;
            this.showLoading('Generating your route...');
            
            // Get user preferences
            const distance = parseFloat(document.getElementById('distance').value);
            const terrain = document.querySelector('input[name="terrain"]:checked').value;
            
            // Use current location or map center
            const startPoint = this.currentLocation || this.map.getCenter();
            
            // Generate route
            const routeData = await this.routeService.generateRoute(startPoint, distance, terrain);
            
            // Display route on map
            this.map.displayRoute(routeData);
            
            // Show route statistics
            this.showRouteStats(routeData);
            
            // Collapse input panel
            this.collapseInputPanel();
            
            this.hideLoading();
            
        } catch (error) {
            console.error('Error generating route:', error);
            this.hideLoading();
            this.showError('Failed to generate route. Please try again.');
        } finally {
            this.isGenerating = false;
        }
    }
    
    /**
     * Update the distance display in the UI
     */
    updateDistanceDisplay() {
        const distanceSlider = document.getElementById('distance');
        const distanceValue = document.getElementById('distanceValue');
        
        if (distanceSlider && distanceValue) {
            distanceValue.textContent = distanceSlider.value;
        }
    }
    
    /**
     * Toggle the input panel expanded/collapsed state
     */
    toggleInputPanel() {
        const inputPanel = document.getElementById('inputPanel');
        if (inputPanel) {
            inputPanel.classList.toggle('expanded');
        }
    }
    
    /**
     * Collapse the input panel
     */
    collapseInputPanel() {
        const inputPanel = document.getElementById('inputPanel');
        if (inputPanel) {
            inputPanel.classList.remove('expanded');
        }
    }
    
    /**
     * Expand the input panel
     */
    expandInputPanel() {
        const inputPanel = document.getElementById('inputPanel');
        if (inputPanel) {
            inputPanel.classList.add('expanded');
        }
    }
    
    /**
     * Show route statistics
     * @param {Object} routeData - Route data to display
     */
    showRouteStats(routeData) {
        const routeStats = document.getElementById('routeStats');
        const statDistance = document.getElementById('statDistance');
        const statElevation = document.getElementById('statElevation');
        const statSteepest = document.getElementById('statSteepest');
        
        if (routeStats && statDistance && statElevation && statSteepest) {
            // Format distance
            const distance = (routeData.distance / 1000).toFixed(1);
            statDistance.textContent = `${distance} km`;
            
            // Format elevation gain
            const elevationGain = routeData.ascent.toFixed(0);
            statElevation.textContent = `+${elevationGain}m`;
            
            // Format steepest gradient
            if (routeData.elevationData.steepestSegment) {
                const steepest = routeData.elevationData.steepestSegment.gradient.toFixed(1);
                statSteepest.textContent = `${steepest}%`;
            } else {
                statSteepest.textContent = 'N/A';
            }
            
            // Show the stats panel
            routeStats.classList.remove('hidden');
        }
    }
    
    /**
     * Hide route statistics
     */
    hideRouteStats() {
        const routeStats = document.getElementById('routeStats');
        if (routeStats) {
            routeStats.classList.add('hidden');
        }
    }
    
    /**
     * Show loading indicator
     * @param {string} message - Loading message
     */
    showLoading(message = 'Loading...') {
        const loading = document.getElementById('loading');
        const loadingText = loading?.querySelector('p');
        
        if (loading) {
            if (loadingText) {
                loadingText.textContent = message;
            }
            loading.classList.remove('hidden');
        }
        
        // Disable generate button
        const generateBtn = document.getElementById('generateBtn');
        if (generateBtn) {
            generateBtn.disabled = true;
        }
    }
    
    /**
     * Hide loading indicator
     */
    hideLoading() {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.classList.add('hidden');
        }
        
        // Re-enable generate button
        const generateBtn = document.getElementById('generateBtn');
        if (generateBtn) {
            generateBtn.disabled = false;
        }
    }
    
    /**
     * Show error message
     * @param {string} message - Error message
     */
    showError(message) {
        const errorMessage = document.getElementById('errorMessage');
        const errorText = document.getElementById('errorText');
        
        if (errorMessage && errorText) {
            errorText.textContent = message;
            errorMessage.classList.remove('hidden');
            
            // Auto-hide after 5 seconds
            setTimeout(() => {
                this.hideError();
            }, 5000);
        }
    }
    
    /**
     * Hide error message
     */
    hideError() {
        const errorMessage = document.getElementById('errorMessage');
        if (errorMessage) {
            errorMessage.classList.add('hidden');
        }
    }
    
    /**
     * Handle app destruction/cleanup
     */
    destroy() {
        if (this.map) {
            this.map.destroy();
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (window.app) {
        window.app.destroy();
    }
});