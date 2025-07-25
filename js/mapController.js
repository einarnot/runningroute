// Map controller for Leaflet integration and route visualization

class MapController {
    constructor() {
        this.map = null;
        this.routeLayer = null;
        this.markersLayer = null;
        this.currentRoute = null;
        this.mapInitialized = false;
        this.defaultCenter = [59.9139, 10.7522]; // Oslo, Norway
        this.defaultZoom = 13;
    }

    // Initialize the map
    initializeMap(containerId = 'map') {
        if (this.mapInitialized) {
            return this.map;
        }

        try {
            // Create map instance
            this.map = L.map(containerId, {
                center: this.defaultCenter,
                zoom: this.defaultZoom,
                zoomControl: false, // We'll add custom controls
                attributionControl: true
            });

            // Add tile layer
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                maxZoom: 19,
                tileSize: 256,
                zoomOffset: 0
            }).addTo(this.map);

            // Create layer groups
            this.routeLayer = L.layerGroup().addTo(this.map);
            this.markersLayer = L.layerGroup().addTo(this.map);

            // Add zoom controls to bottom right
            L.control.zoom({
                position: 'bottomright'
            }).addTo(this.map);

            // Add scale control
            L.control.scale({
                position: 'bottomleft',
                metric: true,
                imperial: false
            }).addTo(this.map);

            // Set up event handlers
            this.setupEventHandlers();

            this.mapInitialized = true;
            console.log('Map initialized successfully');

            // Try to get user's location and center map
            this.centerOnUserLocation();

            return this.map;
        } catch (error) {
            console.error('Failed to initialize map:', error);
            window.Utils.showError('Failed to initialize map. Please refresh the page and try again.');
            return null;
        }
    }

    // Set up map event handlers
    setupEventHandlers() {
        if (!this.map) return;

        // Handle map clicks for location selection
        this.map.on('click', (e) => {
            this.handleMapClick(e);
        });

        // Handle map move events
        this.map.on('moveend', () => {
            this.handleMapMove();
        });

        // Handle zoom events
        this.map.on('zoomend', () => {
            this.handleZoomChange();
        });
    }

    // Handle map click events
    handleMapClick(e) {
        const lat = e.latlng.lat;
        const lon = e.latlng.lng;

        // Update location input field
        const locationInput = document.getElementById('startLocation');
        if (locationInput) {
            locationInput.value = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
        }

        // Add temporary marker
        this.addLocationMarker(lat, lon, 'Selected Location');

        // Reverse geocode to get address
        LocationService.reverseGeocode(lat, lon)
            .then(result => {
                if (locationInput) {
                    locationInput.value = LocationService.formatAddress(result);
                }
                this.updateLocationMarker(lat, lon, LocationService.formatAddress(result));
            })
            .catch(error => {
                console.warn('Reverse geocoding failed:', error);
            });
    }

    // Handle map move events
    handleMapMove() {
        // Save current map view to localStorage
        if (this.map) {
            const center = this.map.getCenter();
            const zoom = this.map.getZoom();
            
            window.Utils.storage.set('mapView', {
                lat: center.lat,
                lng: center.lng,
                zoom: zoom
            });
        }
    }

    // Handle zoom change events
    handleZoomChange() {
        // Adjust route line width based on zoom level
        if (this.currentRoute && this.map) {
            const zoom = this.map.getZoom();
            const lineWeight = Math.max(2, Math.min(6, zoom - 10));
            
            this.routeLayer.eachLayer(layer => {
                if (layer.setStyle) {
                    layer.setStyle({ weight: lineWeight });
                }
            });
        }
    }

    // Center map on user's current location
    async centerOnUserLocation() {
        try {
            const position = await window.LocationService.getCurrentLocation();
            
            if (position && this.map) {
                this.map.setView([position.lat, position.lon], this.defaultZoom);
                this.addLocationMarker(position.lat, position.lon, 'Your Location', true);
                
                // Update location input
                const locationInput = document.getElementById('startLocation');
                if (locationInput) {
                    locationInput.value = `${position.lat.toFixed(6)}, ${position.lon.toFixed(6)}`;
                    
                    // Trigger a change event to update app preferences
                    const event = new Event('change', { bubbles: true });
                    locationInput.dispatchEvent(event);
                }
            }
        } catch (error) {
            console.log('Could not get user location:', error.message);
            // Load saved map view or use default
            this.loadSavedMapView();
        }
    }

    // Load saved map view from localStorage
    loadSavedMapView() {
        const savedView = window.Utils.storage.get('mapView');
        
        if (savedView && this.map) {
            this.map.setView([savedView.lat, savedView.lng], savedView.zoom);
        }
    }

    // Add or update location marker
    addLocationMarker(lat, lon, title = 'Location', isCurrentLocation = false) {
        // Clear existing location markers
        this.markersLayer.clearLayers();

        const icon = isCurrentLocation ? 
            L.divIcon({
                html: '📍',
                iconSize: [30, 30],
                className: 'current-location-marker'
            }) :
            L.divIcon({
                html: '📌',
                iconSize: [25, 25],
                className: 'location-marker'
            });

        const marker = L.marker([lat, lon], { icon })
            .bindPopup(title)
            .addTo(this.markersLayer);

        return marker;
    }

    // Update existing location marker
    updateLocationMarker(lat, lon, title) {
        this.markersLayer.eachLayer(layer => {
            if (layer.setPopupContent) {
                layer.setPopupContent(title);
            }
        });
    }

    // Display route on map with elevation coloring
    displayRoute(routeData) {
        if (!this.map || !routeData || !routeData.coordinates) {
            console.error('Invalid route data or map not initialized');
            return;
        }

        // Clear existing route
        this.clearRoute();

        try {
            // Create colored segments
            const segments = window.PolylineDecoder.createColoredSegments(routeData.coordinates);
            
            if (segments.length === 0) {
                console.warn('No route segments to display');
                return;
            }

            // Add each segment with appropriate color
            segments.forEach((segment, index) => {
                const polyline = L.polyline(segment.coordinates, {
                    color: segment.color,
                    weight: 4,
                    opacity: 0.8,
                    lineJoin: 'round',
                    lineCap: 'round'
                });

                // Add popup with segment information
                const gradient = segment.gradient;
                const distance = window.Utils.formatDistance(segment.distance);
                const elevationChange = window.Utils.formatElevation(Math.abs(segment.elevationChange));
                const direction = segment.elevationChange > 0 ? 'uphill' : 'downhill';
                
                polyline.bindPopup(`
                    <div class="route-segment-popup">
                        <strong>Segment ${index + 1}</strong><br>
                        Distance: ${distance}<br>
                        Gradient: ${gradient.toFixed(1)}%<br>
                        Elevation: ${elevationChange} ${direction}
                    </div>
                `);

                polyline.addTo(this.routeLayer);
            });

            // Add start and end markers
            const startCoord = routeData.coordinates[0];
            const endCoord = routeData.coordinates[routeData.coordinates.length - 1];

            // Start marker
            L.marker([startCoord[0], startCoord[1]], {
                icon: L.divIcon({
                    html: '🏁',
                    iconSize: [30, 30],
                    className: 'start-marker'
                })
            })
            .bindPopup('Start')
            .addTo(this.markersLayer);

            // End marker (only if different from start)
            const isLoop = window.Utils.calculateDistance(
                startCoord[0], startCoord[1], 
                endCoord[0], endCoord[1]
            ) < 0.1; // Less than 100m apart

            if (!isLoop) {
                L.marker([endCoord[0], endCoord[1]], {
                    icon: L.divIcon({
                        html: '🏃',
                        iconSize: [30, 30],
                        className: 'end-marker'
                    })
                })
                .bindPopup('Finish')
                .addTo(this.markersLayer);
            }

            // Fit map to route bounds
            this.fitToBounds(routeData.coordinates);

            // Store current route
            this.currentRoute = routeData;

            console.log('Route displayed successfully');
        } catch (error) {
            console.error('Error displaying route:', error);
            window.Utils.showError('Failed to display route on map');
        }
    }

    // Fit map to show all route coordinates
    fitToBounds(coordinates) {
        if (!this.map || !coordinates || coordinates.length === 0) {
            return;
        }

        try {
            const bounds = L.latLngBounds(
                coordinates.map(coord => [coord[0], coord[1]])
            );
            
            this.map.fitBounds(bounds, {
                padding: [20, 20],
                maxZoom: 16
            });
        } catch (error) {
            console.error('Error fitting bounds:', error);
        }
    }

    // Clear route from map
    clearRoute() {
        if (this.routeLayer) {
            this.routeLayer.clearLayers();
        }
        if (this.markersLayer) {
            // Keep location markers, only clear route markers
            this.markersLayer.eachLayer(layer => {
                if (layer.options.icon && 
                    (layer.options.icon.options.className === 'start-marker' || 
                     layer.options.icon.options.className === 'end-marker')) {
                    this.markersLayer.removeLayer(layer);
                }
            });
        }
        this.currentRoute = null;
    }

    // Center map on current route
    centerOnRoute() {
        if (this.currentRoute && this.currentRoute.coordinates) {
            this.fitToBounds(this.currentRoute.coordinates);
        }
    }

    // Get current map center
    getCenter() {
        if (!this.map) return null;
        
        const center = this.map.getCenter();
        return {
            lat: center.lat,
            lon: center.lng
        };
    }

    // Get current map bounds
    getBounds() {
        if (!this.map) return null;
        
        const bounds = this.map.getBounds();
        return {
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            west: bounds.getWest()
        };
    }

    // Toggle fullscreen mode
    toggleFullscreen() {
        if (!this.map) return;

        const mapContainer = this.map.getContainer();
        
        if (!document.fullscreenElement) {
            mapContainer.requestFullscreen?.() ||
            mapContainer.webkitRequestFullscreen?.() ||
            mapContainer.msRequestFullscreen?.();
        } else {
            document.exitFullscreen?.() ||
            document.webkitExitFullscreen?.() ||
            document.msExitFullscreen?.();
        }

        // Invalidate size after fullscreen change
        setTimeout(() => {
            if (this.map) {
                this.map.invalidateSize();
            }
        }, 100);
    }

    // Invalidate map size (useful for responsive changes)
    invalidateSize() {
        if (this.map) {
            this.map.invalidateSize();
        }
    }

    // Add elevation legend to map
    addElevationLegend() {
        if (!this.map) return;

        const legend = L.control({ position: 'bottomright' });
        
        legend.onAdd = function() {
            const div = L.DomUtil.create('div', 'elevation-legend');
            div.innerHTML = `
                <div class="legend-title">Elevation</div>
                <div class="legend-item">
                    <span class="legend-color" style="background-color: #10b981;"></span>
                    <span class="legend-text">Flat (0-3%)</span>
                </div>
                <div class="legend-item">
                    <span class="legend-color" style="background-color: #f59e0b;"></span>
                    <span class="legend-text">Moderate (3-8%)</span>
                </div>
                <div class="legend-item">
                    <span class="legend-color" style="background-color: #ef4444;"></span>
                    <span class="legend-text">Steep (8%+)</span>
                </div>
            `;
            return div;
        };

        legend.addTo(this.map);
        return legend;
    }

    // Get map instance
    getMap() {
        return this.map;
    }

    // Check if map is initialized
    isInitialized() {
        return this.mapInitialized && this.map !== null;
    }

    // Destroy map instance
    destroy() {
        if (this.map) {
            this.map.remove();
            this.map = null;
            this.routeLayer = null;
            this.markersLayer = null;
            this.currentRoute = null;
            this.mapInitialized = false;
        }
    }
}

// Create global instance
window.MapController = new MapController();