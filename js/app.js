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
            MapController.initializeMap();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Setup mobile responsiveness
            this.setupMobileFeatures();
            
            // Load saved preferences
            this.loadSavedPreferences();
            
            // Add elevation legend to map
            MapController.addElevationLegend();
            
            console.log('App initialized successfully');
        } catch (error) {
            console.error('Failed to initialize app:', error);
            Utils.showError('Failed to initialize the application. Please refresh the page.');
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
        window.addEventListener('resize', Utils.throttle(() => {
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
            const debouncedGeocode = Utils.debounce(async (value) => {
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
                    MapController.centerOnRoute();
                } else {
                    MapController.centerOnUserLocation();
                }
            });
        }

        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => {
                MapController.toggleFullscreen();
            });
        }
    }

    // Setup mobile sidebar toggle
    setupSidebarToggle() {
        const sidebarToggle = document.getElementById('sidebarToggle');
        const sidebar = document.getElementById('sidebar');

        if (sidebarToggle && sidebar) {
            sidebarToggle.addEventListener('click', () => {
                sidebar.classList.toggle('open');
                
                // Create/remove backdrop for mobile
                this.toggleMobileBackdrop(sidebar.classList.contains('open'));
            });
        }
    }

    // Setup mobile-specific features
    setupMobileFeatures() {
        // Detect mobile and add appropriate classes
        if (Utils.isMobile()) {
            document.body.classList.add('mobile');
        }

        if (Utils.isTouchDevice()) {
            document.body.classList.add('touch');
        }

        // Handle orientation changes
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                MapController.invalidateSize();
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
                Utils.showError('Please enter a starting location');
                return;
            }

            // Set generating state
            this.setGeneratingState(true);

            // Generate route
            const route = await RouteGenerator.generateRoutes(this.preferences);
            
            if (route) {
                this.currentRoute = route;
                
                // Display route on map
                MapController.displayRoute(route);
                
                // Update route info panel
                this.updateRouteInfoPanel(route);
                
                // Close mobile sidebar if open
                if (Utils.isMobile()) {
                    const sidebar = document.getElementById('sidebar');
                    if (sidebar) {
                        sidebar.classList.remove('open');
                        this.toggleMobileBackdrop(false);
                    }
                }

                // Save preferences
                this.savePreferences();

                console.log('Route generated successfully:', route);
            }
        } catch (error) {
            console.error('Route generation failed:', error);
            Utils.showError(error.message || 'Failed to generate route. Please try again.');
        } finally {
            this.setGeneratingState(false);
        }
    }

    // Handle current location request
    async handleCurrentLocationRequest() {
        try {
            const position = await LocationService.getCurrentLocation();
            
            if (position) {
                const locationInput = document.getElementById('startLocation');
                if (locationInput) {
                    locationInput.value = `${position.lat.toFixed(6)}, ${position.lon.toFixed(6)}`;
                }

                // Center map on location
                MapController.map.setView([position.lat, position.lon], 15);
                MapController.addLocationMarker(position.lat, position.lon, 'Your Location', true);

                // Try to get readable address
                try {
                    const address = await LocationService.reverseGeocode(position.lat, position.lon);
                    if (locationInput) {
                        locationInput.value = LocationService.formatAddress(address);
                    }
                } catch (reverseError) {
                    console.warn('Could not get address for location:', reverseError);
                }

                this.updatePreferences();
            }
        } catch (error) {
            console.error('Failed to get current location:', error);
            Utils.showError(error.message || 'Could not access your location. Please check your browser settings.');
        }
    }

    // Handle address input with geocoding
    async handleAddressInput(address) {
        try {
            const results = await LocationService.geocodeAddress(address);
            
            if (results && results.length > 0) {
                const location = results[0]; // Use first result
                
                // Update map
                MapController.map.setView([location.lat, location.lon], 15);
                MapController.addLocationMarker(location.lat, location.lon, location.displayName);
                
                // Save to recent locations
                LocationService.saveRecentLocation(location);
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
            'routeScore': route.aiScore ? `${Math.round(route.aiScore * 100)}%` : 'N/A'
        };

        Object.entries(updates).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
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
        
        this.preferences = {
            distance: parseFloat(document.getElementById('distanceValue')?.value || 5),
            routeType: formData.get('routeType') || 'loop',
            terrain: formData.get('terrain') || 'flat',
            startLocation: document.getElementById('startLocation')?.value || ''
        };
    }

    // Get default preferences
    getDefaultPreferences() {
        return {
            distance: 5,
            routeType: 'loop',
            terrain: 'flat',
            startLocation: ''
        };
    }

    // Load saved preferences from localStorage
    loadSavedPreferences() {
        const saved = Utils.storage.get('userPreferences');
        
        if (saved) {
            // Update form fields
            const distanceRange = document.getElementById('distanceRange');
            const distanceValue = document.getElementById('distanceValue');
            
            if (distanceRange && distanceValue) {
                distanceRange.value = saved.distance || 5;
                distanceValue.value = saved.distance || 5;
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
        Utils.storage.set('userPreferences', this.preferences);
    }

    // Handle window resize
    handleWindowResize() {
        // Invalidate map size
        MapController.invalidateSize();
        
        // Update mobile class
        if (Utils.isMobile()) {
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
        MapController.clearRoute();
        
        // Hide route info panel
        const routeInfo = document.getElementById('routeInfo');
        if (routeInfo) {
            routeInfo.style.display = 'none';
        }
    }

    // Export route data (for future sharing functionality)
    exportRoute() {
        if (!this.currentRoute) {
            Utils.showError('No route to export');
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
            mapInitialized: MapController.isInitialized(),
            routeGenerator: RouteGenerator.getStats(),
            locationService: {
                currentPosition: LocationService.currentPosition,
                recentLocations: LocationService.getRecentLocations().length
            }
        };
    }
}

// Initialize app when script loads
window.App = new App();

// Make app globally accessible for debugging
window.getAppStats = () => window.App.getStats();