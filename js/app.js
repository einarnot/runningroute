// Main application controller for Route Generator v5

class App {
    constructor() {
        this.currentRoute = null;
        this.isGenerating = false;
        this.preferences = this.getDefaultPreferences();
        
        // Initialize app when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    // Initialize the application
    init() {
        try {
            console.log('Initializing Route Generator v5...');
            
            // Initialize map
            window.MapController.initializeMap();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Setup mobile responsiveness
            this.setupMobileFeatures();
            
            // Setup route selection handling
            this.setupRouteSelectionHandlers();
            
            // Load saved preferences
            this.loadSavedPreferences();
            
            // Add elevation legend to map
            window.MapController.addElevationLegend();
            
            console.log('App initialized successfully');
        } catch (error) {
            console.error('Failed to initialize app:', error);
            window.Utils.showError('Failed to initialize the application. Please refresh the page.');
        }
    }

    // Set up all event listeners
    setupEventListeners() {
        // Form submission
        const form = document.getElementById('preferencesForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleFormSubmit();
            });
        }

        // Distance range/number sync
        this.setupDistanceSync();
        
        // Location services
        this.setupLocationServices();
        
        // Modal handlers
        this.setupModalHandlers();
        
        // Map control handlers
        this.setupMapControlHandlers();
        
        // Mobile sidebar toggle
        this.setupSidebarToggle();
        
        // Window resize handling
        window.addEventListener('resize', window.Utils.throttle(() => {
            this.handleWindowResize();
        }, 250));
    }

    // Setup distance range and number input synchronization
    setupDistanceSync() {
        const rangeInput = document.getElementById('distanceRange');
        const numberInput = document.getElementById('distanceValue');

        if (rangeInput && numberInput) {
            rangeInput.addEventListener('input', (e) => {
                numberInput.value = e.target.value;
                this.updatePreferences();
            });

            numberInput.addEventListener('input', (e) => {
                rangeInput.value = e.target.value;
                this.updatePreferences();
            });
        }

        // Setup pace synchronization
        this.setupPaceSync();
    }

    // Setup pace range and number input synchronization
    setupPaceSync() {
        const paceRange = document.getElementById('paceRange');
        const paceText = document.getElementById('paceValue');

        if (paceRange && paceText) {
            // When range changes, update text with min:sec format
            paceRange.addEventListener('input', (e) => {
                const rawValue = parseFloat(e.target.value);
                const roundedValue = Utils.roundPaceToInterval(rawValue);
                e.target.value = roundedValue;
                paceText.value = Utils.formatPaceForDisplay(roundedValue);
                this.updatePreferences();
            });

            // When text changes, validate and update range
            paceText.addEventListener('input', (e) => {
                const textValue = e.target.value;
                
                // Validate min:sec format (e.g., "4:30") with 5-second intervals
                const minSecPattern = /^(\d+):([0-5]\d)$/;
                const match = textValue.match(minSecPattern);
                
                if (match) {
                    const minutes = parseInt(match[1]);
                    const seconds = parseInt(match[2]);
                    
                    // Check if seconds are in 5-second intervals
                    if (seconds % 5 === 0) {
                        const decimalValue = Utils.minSecToDecimalMinutes(textValue);
                        // Ensure it's within range
                        if (decimalValue >= 3 && decimalValue <= 8) {
                            paceRange.value = decimalValue;
                            e.target.setCustomValidity('');
                        } else {
                            e.target.setCustomValidity('Pace must be between 3:00 and 8:00 min/km');
                        }
                    } else {
                        e.target.setCustomValidity('Please use 5-second intervals (e.g., 4:30, 4:35, 4:40)');
                    }
                } else if (textValue !== '') {
                    e.target.setCustomValidity('Please use format like 4:30 with 5-second intervals');
                } else {
                    e.target.setCustomValidity('');
                }
                
                this.updatePreferences();
            });

            // When user leaves the text field, ensure proper formatting and round to 5-second intervals
            paceText.addEventListener('blur', (e) => {
                const textValue = e.target.value;
                const minSecPattern = /^(\d+):([0-5]\d)$/;
                
                if (minSecPattern.test(textValue)) {
                    const decimalValue = Utils.minSecToDecimalMinutes(textValue);
                    if (decimalValue >= 3 && decimalValue <= 8) {
                        // Round to nearest 5-second interval and reformat
                        const roundedValue = Utils.roundPaceToInterval(decimalValue);
                        e.target.value = Utils.formatPaceForDisplay(roundedValue);
                        paceRange.value = roundedValue;
                        this.updatePreferences();
                    }
                }
            });

            // Initialize with proper format
            paceText.value = Utils.formatPaceForDisplay(parseFloat(paceRange.value));
        }
    }

    // Setup location-related services
    setupLocationServices() {
        const locateBtn = document.getElementById('locateBtn');
        const locationInput = document.getElementById('startLocation');

        // Current location button
        if (locateBtn) {
            locateBtn.addEventListener('click', async () => {
                await this.handleCurrentLocationRequest();
            });
        }

        // Location input with geocoding
        if (locationInput) {
            const debouncedGeocode = window.Utils.debounce(async (value) => {
                if (value.length > 3 && !this.isCoordinateFormat(value)) {
                    await this.handleAddressInput(value);
                }
            }, 1000);

            locationInput.addEventListener('input', (e) => {
                debouncedGeocode(e.target.value);
            });

            locationInput.addEventListener('blur', () => {
                this.updatePreferences();
            });
            
            locationInput.addEventListener('change', () => {
                this.updatePreferences();
            });
        }
    }

    // Setup modal event handlers
    setupModalHandlers() {
        // Error modal
        const errorModal = document.getElementById('errorModal');
        const errorClose = document.getElementById('errorModalClose');
        const errorOk = document.getElementById('errorModalOk');

        if (errorClose) {
            errorClose.addEventListener('click', () => {
                if (errorModal) errorModal.style.display = 'none';
            });
        }

        if (errorOk) {
            errorOk.addEventListener('click', () => {
                if (errorModal) errorModal.style.display = 'none';
            });
        }

        // Help modal
        const helpBtn = document.getElementById('helpBtn');
        const helpModal = document.getElementById('helpModal');
        const helpClose = document.getElementById('helpModalClose');
        const helpOk = document.getElementById('helpModalOk');

        if (helpBtn) {
            helpBtn.addEventListener('click', () => {
                if (helpModal) helpModal.style.display = 'flex';
            });
        }

        if (helpClose) {
            helpClose.addEventListener('click', () => {
                if (helpModal) helpModal.style.display = 'none';
            });
        }

        if (helpOk) {
            helpOk.addEventListener('click', () => {
                if (helpModal) helpModal.style.display = 'none';
            });
        }

        // Close modals on background click
        [errorModal, helpModal].forEach(modal => {
            if (modal) {
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        modal.style.display = 'none';
                    }
                });
            }
        });
    }

    // Setup map control handlers
    setupMapControlHandlers() {
        const centerBtn = document.getElementById('centerBtn');
        const fullscreenBtn = document.getElementById('fullscreenBtn');

        if (centerBtn) {
            centerBtn.addEventListener('click', () => {
                if (this.currentRoute) {
                    window.MapController.centerOnRoute();
                } else {
                    window.MapController.centerOnUserLocation();
                }
            });
        }

        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => {
                window.MapController.toggleFullscreen();
            });
        }
    }

    // Setup mobile sidebar toggle
    setupSidebarToggle() {
        const sidebarToggle = document.getElementById('sidebarToggle');
        const mobileMenuBtn = document.getElementById('mobileMenuBtn');
        const sidebar = document.getElementById('sidebar');

        // Function to toggle sidebar
        const toggleSidebar = () => {
            if (sidebar) {
                sidebar.classList.toggle('open');
                
                // Create/remove backdrop for mobile
                this.toggleMobileBackdrop(sidebar.classList.contains('open'));
            }
        };

        // Add event listeners to both toggle buttons
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', toggleSidebar);
        }

        if (mobileMenuBtn) {
            mobileMenuBtn.addEventListener('click', toggleSidebar);
        }
    }

    // Setup route selection event handlers
    setupRouteSelectionHandlers() {
        // Listen for route selection events from RouteSelector
        document.addEventListener('routeSelected', async (event) => {
            const { route, index } = event.detail;
            
            try {
                // Enhance route with elevation data if not already enhanced
                const enhancedRoute = await window.RouteGenerator.enhanceRouteOnDemand(route, this.preferences);
                
                // Update current route
                this.currentRoute = enhancedRoute;
                
                // Update map display
                window.MapController.displayRoute(enhancedRoute);
                
                // Update route info panel
                this.updateRouteInfoPanel(enhancedRoute);
                
                console.log(`Switched to route ${index + 1}:`, enhancedRoute);
            } catch (error) {
                console.error('Failed to switch route:', error);
                // Still update with original route if enhancement fails
                this.currentRoute = route;
                window.MapController.displayRoute(route);
                this.updateRouteInfoPanel(route);
            }
        });
    }

    // Setup mobile-specific features
    setupMobileFeatures() {
        // Detect mobile and add appropriate classes
        if (window.Utils.isMobile()) {
            document.body.classList.add('mobile');
        }

        if (window.Utils.isTouchDevice()) {
            document.body.classList.add('touch');
        }

        // Handle orientation changes
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                window.MapController.invalidateSize();
            }, 500);
        });
    }

    // Toggle mobile backdrop
    toggleMobileBackdrop(show) {
        let backdrop = document.querySelector('.mobile-backdrop');
        
        if (show && !backdrop) {
            backdrop = document.createElement('div');
            backdrop.className = 'mobile-backdrop';
            backdrop.addEventListener('click', () => {
                const sidebar = document.getElementById('sidebar');
                if (sidebar) {
                    sidebar.classList.remove('open');
                    this.toggleMobileBackdrop(false);
                }
            });
            document.body.appendChild(backdrop);
            
            // Trigger animation
            setTimeout(() => backdrop.classList.add('active'), 10);
        } else if (!show && backdrop) {
            backdrop.classList.remove('active');
            setTimeout(() => backdrop.remove(), 300);
        }
    }

    // Handle form submission
    async handleFormSubmit() {
        if (this.isGenerating) {
            return;
        }

        try {
            // Update preferences from form
            this.updatePreferences();
            
            // Validate preferences
            if (!this.preferences.startLocation) {
                window.Utils.showError('Please enter a starting location');
                return;
            }

            // Set generating state
            this.setGeneratingState(true);

            // Generate routes (now returns array of all routes)
            const routes = await window.RouteGenerator.generateRoutes(this.preferences);
            
            if (routes && routes.length > 0) {
                // Display all routes in selector (best route is selected by default)
                window.RouteSelector.displayRoutes(routes);
                
                // Set current route to the best one (first in sorted array)
                this.currentRoute = routes[0];
                
                // Display best route on map
                window.MapController.displayRoute(routes[0]);
                
                // Update route info panel
                this.updateRouteInfoPanel(routes[0]);
                
                // Close mobile sidebar if open
                if (window.Utils.isMobile()) {
                    const sidebar = document.getElementById('sidebar');
                    if (sidebar) {
                        sidebar.classList.remove('open');
                        this.toggleMobileBackdrop(false);
                    }
                }

                // Save preferences
                this.savePreferences();

                console.log(`${routes.length} routes generated successfully. Best route:`, routes[0]);
            }
        } catch (error) {
            console.error('Route generation failed:', error);
            window.Utils.showError(error.message || 'Failed to generate route. Please try again.');
        } finally {
            this.setGeneratingState(false);
        }
    }

    // Handle current location request
    async handleCurrentLocationRequest() {
        try {
            const position = await window.LocationService.getCurrentLocation();
            
            if (position) {
                const locationInput = document.getElementById('startLocation');
                if (locationInput) {
                    locationInput.value = `${position.lat.toFixed(6)}, ${position.lon.toFixed(6)}`;
                }

                // Center map on location
                window.MapController.map.setView([position.lat, position.lon], 15);
                window.MapController.addLocationMarker(position.lat, position.lon, 'Your Location', true);

                // Try to get readable address
                try {
                    const address = await window.LocationService.reverseGeocode(position.lat, position.lon);
                    if (locationInput) {
                        locationInput.value = window.LocationService.formatAddress(address);
                    }
                } catch (reverseError) {
                    console.warn('Could not get address for location:', reverseError);
                }

                this.updatePreferences();
            }
        } catch (error) {
            console.error('Failed to get current location:', error);
            window.Utils.showError(error.message || 'Could not access your location. Please check your browser settings.');
        }
    }

    // Handle address input with geocoding
    async handleAddressInput(address) {
        try {
            const results = await window.LocationService.geocodeAddress(address);
            
            if (results && results.length > 0) {
                const location = results[0]; // Use first result
                
                // Update map
                window.MapController.map.setView([location.lat, location.lon], 15);
                window.MapController.addLocationMarker(location.lat, location.lon, location.displayName);
                
                // Save to recent locations
                window.LocationService.saveRecentLocation(location);
            }
        } catch (error) {
            console.warn('Geocoding failed:', error);
            // Don't show error for geocoding failures as they happen during typing
        }
    }

    // Update route information panel
    updateRouteInfoPanel(route) {
        const routeInfo = document.getElementById('routeInfo');
        if (!routeInfo) return;

        // Show the panel
        routeInfo.style.display = 'block';

        // Update individual fields
        const updates = {
            'routeDistance': route.stats?.distance || 'N/A',
            'routeElevation': route.stats?.ascent || 'N/A',
            'routeTime': route.stats?.duration || 'N/A',
            'routeScore': (route.aiScore !== undefined && route.aiScore !== null) ? `${Math.round(route.aiScore * 100)}%` : 'N/A'
        };

        Object.entries(updates).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });

        // Update score label based on whether AI was used
        const scoreLabel = document.getElementById('routeScoreLabel');
        if (scoreLabel && route.usedAI !== undefined) {
            scoreLabel.textContent = route.usedAI ? 'AI Score:' : 'Score:';
        }
    }

    // Set generating state (loading/disabled buttons)
    setGeneratingState(generating) {
        this.isGenerating = generating;
        
        const generateBtn = document.getElementById('generateBtn');
        if (generateBtn) {
            if (generating) {
                generateBtn.classList.add('loading');
                generateBtn.disabled = true;
            } else {
                generateBtn.classList.remove('loading');
                generateBtn.disabled = false;
            }
        }
    }

    // Update preferences from form
    updatePreferences() {
        const formData = new FormData(document.getElementById('preferencesForm'));
        const paceText = document.getElementById('paceValue')?.value || '5:00';
        
        this.preferences = {
            distance: parseFloat(document.getElementById('distanceValue')?.value || 5),
            pace: Utils.minSecToDecimalMinutes(paceText),
            routeType: formData.get('routeType') || 'outback',
            terrain: formData.get('terrain') || 'flat',
            startLocation: document.getElementById('startLocation')?.value || ''
        };
    }

    // Get default preferences
    getDefaultPreferences() {
        return {
            distance: 5,
            pace: 5,
            routeType: 'outback',
            terrain: 'flat',
            startLocation: ''
        };
    }

    // Load saved preferences from localStorage
    loadSavedPreferences() {
        const saved = window.Utils.storage.get('userPreferences');
        
        if (saved) {
            // Update form fields
            const distanceRange = document.getElementById('distanceRange');
            const distanceValue = document.getElementById('distanceValue');
            const paceRange = document.getElementById('paceRange');
            const paceValue = document.getElementById('paceValue');
            
            if (distanceRange && distanceValue) {
                distanceRange.value = saved.distance || 5;
                distanceValue.value = saved.distance || 5;
            }

            if (paceRange && paceValue) {
                const paceDecimal = saved.pace || 5;
                paceRange.value = paceDecimal;
                paceValue.value = Utils.formatPaceForDisplay(paceDecimal);
            }

            // Update radio buttons
            if (saved.routeType) {
                const routeTypeRadio = document.querySelector(`input[name="routeType"][value="${saved.routeType}"]`);
                if (routeTypeRadio) routeTypeRadio.checked = true;
            }

            if (saved.terrain) {
                const terrainRadio = document.querySelector(`input[name="terrain"][value="${saved.terrain}"]`);
                if (terrainRadio) terrainRadio.checked = true;
            }

            // Update location if saved
            const locationInput = document.getElementById('startLocation');
            if (locationInput && saved.startLocation) {
                locationInput.value = saved.startLocation;
            }

            this.preferences = { ...this.getDefaultPreferences(), ...saved };
        }
    }

    // Save preferences to localStorage
    savePreferences() {
        window.Utils.storage.set('userPreferences', this.preferences);
    }

    // Handle window resize
    handleWindowResize() {
        // Invalidate map size
        window.MapController.invalidateSize();
        
        // Update mobile class
        if (window.Utils.isMobile()) {
            document.body.classList.add('mobile');
        } else {
            document.body.classList.remove('mobile');
            
            // Close mobile sidebar if window becomes desktop
            const sidebar = document.getElementById('sidebar');
            if (sidebar) {
                sidebar.classList.remove('open');
                this.toggleMobileBackdrop(false);
            }
        }
    }

    // Check if input is in coordinate format
    isCoordinateFormat(input) {
        return /^-?\d+\.?\d*,\s*-?\d+\.?\d*$/.test(input.trim());
    }

    // Get current route
    getCurrentRoute() {
        return this.currentRoute;
    }

    // Clear current route
    clearRoute() {
        this.currentRoute = null;
        window.MapController.clearRoute();
        
        // Clear route selector
        window.RouteSelector.clear();
        
        // Hide route info panel
        const routeInfo = document.getElementById('routeInfo');
        if (routeInfo) {
            routeInfo.style.display = 'none';
        }
    }

    // Export route data (for future sharing functionality)
    exportRoute() {
        if (!this.currentRoute) {
            window.Utils.showError('No route to export');
            return null;
        }

        return {
            route: this.currentRoute,
            preferences: this.preferences,
            timestamp: new Date().toISOString(),
            version: '1.0'
        };
    }

    // Get app statistics
    getStats() {
        return {
            currentRoute: !!this.currentRoute,
            preferences: this.preferences,
            isGenerating: this.isGenerating,
            mapInitialized: window.MapController.isInitialized(),
            routeGenerator: window.RouteGenerator.getStats(),
            locationService: {
                currentPosition: window.LocationService.currentPosition,
                recentLocations: window.LocationService.getRecentLocations().length
            }
        };
    }
}

// Initialize app when script loads
window.App = new App();

// Make app globally accessible for debugging
window.getAppStats = () => window.App.getStats();