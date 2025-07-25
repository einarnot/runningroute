// Map component with elevation visualization
class MapComponent {
    constructor(containerId) {
        this.containerId = containerId;
        this.map = null;
        this.currentRoute = null;
        this.routeLayer = null;
        this.markerLayer = null;
        this.currentLocationMarker = null;
        
        this.initialize();
    }
    
    /**
     * Initialize the Leaflet map
     */
    initialize() {
        // Create map instance
        this.map = L.map(this.containerId, {
            center: CONFIG.DEFAULT_CENTER,
            zoom: CONFIG.DEFAULT_ZOOM,
            minZoom: CONFIG.MIN_ZOOM,
            maxZoom: CONFIG.MAX_ZOOM,
            zoomControl: false, // We'll add custom controls
            attributionControl: true
        });
        
        // Add zoom control in bottom right
        L.control.zoom({
            position: 'bottomright'
        }).addTo(this.map);
        
        // Add modern tile layer (CartoDB Positron - clean, modern style)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '© OpenStreetMap contributors © CARTO',
            subdomains: 'abcd',
            maxZoom: CONFIG.MAX_ZOOM
        }).addTo(this.map);
        
        // Initialize layer groups
        this.routeLayer = L.layerGroup().addTo(this.map);
        this.markerLayer = L.layerGroup().addTo(this.map);
        
        // Set up map events
        this.setupMapEvents();
    }
    
    /**
     * Set up map event listeners
     */
    setupMapEvents() {
        // Handle map clicks for debugging (optional)
        this.map.on('click', (e) => {
            console.log('Map clicked:', e.latlng);
        });
        
        // Handle zoom events for marker scaling
        this.map.on('zoomend', () => {
            this.updateMarkerSizes();
        });
    }
    
    /**
     * Display a route on the map with elevation visualization
     * @param {Object} routeData - Processed route data
     */
    displayRoute(routeData) {
        this.currentRoute = routeData;
        
        // Clear existing route and markers
        this.clearRoute();
        
        // Display route segments with elevation colors
        this.displayRouteSegments(routeData.elevationData);
        
        // Add kilometer markers
        this.addKilometerMarkers(routeData.kmMarkers);
        
        // Highlight steepest segment
        if (routeData.elevationData.steepestSegment) {
            this.highlightSteepestSegment(routeData.elevationData.steepestSegment);
        }
        
        // Fit map to route bounds
        this.fitToRoute(routeData.coordinates);
    }
    
    /**
     * Display route segments with elevation-based colors
     * @param {Object} elevationData - Processed elevation data
     */
    displayRouteSegments(elevationData) {
        if (!elevationData.segments || elevationData.segments.length === 0) {
            return;
        }
        
        elevationData.segments.forEach((segment, index) => {
            const coordinates = [
                [segment.start[0], segment.start[1]],
                [segment.end[0], segment.end[1]]
            ];
            
            // Create polyline with elevation-based color and modern styling
            const polyline = L.polyline(coordinates, {
                color: segment.color,
                weight: 8,
                opacity: 0.9,
                lineCap: 'round',
                lineJoin: 'round'
            });
            
            // Add popup with segment information
            const gradient = segment.gradient.toFixed(1);
            const distance = segment.distance.toFixed(0);
            const elevationChange = segment.elevationChange.toFixed(1);
            
            polyline.bindPopup(`
                <div class="elevation-popup">
                    <strong>Segment ${index + 1}</strong><br>
                    Distance: ${distance}m<br>
                    Gradient: ${gradient}%<br>
                    Elevation change: ${elevationChange}m
                </div>
            `);
            
            polyline.addTo(this.routeLayer);
        });
    }
    
    /**
     * Add kilometer markers along the route
     * @param {Array} kmMarkers - Array of kilometer marker data
     */
    addKilometerMarkers(kmMarkers) {
        if (!kmMarkers || kmMarkers.length === 0) {
            return;
        }
        
        kmMarkers.forEach(marker => {
            const markerElement = L.divIcon({
                className: 'kilometer-marker',
                html: `<div class="kilometer-marker">${marker.kilometer}</div>`,
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            });
            
            const leafletMarker = L.marker(
                [marker.position[0], marker.position[1]], 
                { icon: markerElement }
            );
            
            // Add popup with elevation information
            leafletMarker.bindPopup(`
                <div class="elevation-popup">
                    <strong>${marker.kilometer} km</strong><br>
                    <span class="elevation">${marker.elevation.toFixed(0)}m</span>
                </div>
            `);
            
            leafletMarker.addTo(this.markerLayer);
        });
    }
    
    /**
     * Highlight the steepest segment of the route
     * @param {Object} steepestSegment - Steepest segment data
     */
    highlightSteepestSegment(steepestSegment) {
        if (!steepestSegment) return;
        
        // Create a pulsing marker at the midpoint of the steepest segment
        const steepestMarker = L.divIcon({
            className: 'kilometer-marker steepest-marker',
            html: `<div class="kilometer-marker steepest-marker">⚠️</div>`,
            iconSize: [35, 35],
            iconAnchor: [17.5, 17.5]
        });
        
        const marker = L.marker(
            [steepestSegment.midpoint[0], steepestSegment.midpoint[1]], 
            { icon: steepestMarker }
        );
        
        // Add popup with steepest segment information
        marker.bindPopup(`
            <div class="elevation-popup">
                <strong>Steepest Section</strong><br>
                Gradient: ${steepestSegment.gradient.toFixed(1)}%<br>
                Distance: ${steepestSegment.distance.toFixed(0)}m<br>
                Elevation change: ${steepestSegment.elevationChange.toFixed(1)}m
            </div>
        `);
        
        marker.addTo(this.markerLayer);
        
        // Also highlight the segment with a thicker line
        const highlightPolyline = L.polyline([
            [steepestSegment.start[0], steepestSegment.start[1]],
            [steepestSegment.end[0], steepestSegment.end[1]]
        ], {
            color: '#dc2626',
            weight: 10,
            opacity: 0.6,
            lineCap: 'round',
            lineJoin: 'round'
        });
        
        highlightPolyline.addTo(this.routeLayer);
    }
    
    /**
     * Fit the map view to show the entire route
     * @param {Array} coordinates - Route coordinates
     */
    fitToRoute(coordinates) {
        if (!coordinates || coordinates.length === 0) {
            return;
        }
        
        // Convert coordinates to Leaflet format
        const latLngs = coordinates.map(coord => [coord[0], coord[1]]);
        
        // Create bounds and fit map
        const bounds = L.latLngBounds(latLngs);
        this.map.fitBounds(bounds, {
            padding: [20, 20],
            maxZoom: 16
        });
    }
    
    /**
     * Clear current route and markers from the map
     */
    clearRoute() {
        this.routeLayer.clearLayers();
        this.markerLayer.clearLayers();
        this.currentRoute = null;
    }
    
    /**
     * Set the user's current location on the map
     * @param {Array} coordinates - [lat, lng]
     */
    setCurrentLocation(coordinates) {
        // Remove existing location marker
        if (this.currentLocationMarker) {
            this.map.removeLayer(this.currentLocationMarker);
        }
        
        // Create location marker
        const locationIcon = L.divIcon({
            className: 'current-location-marker',
            html: `<div style="
                width: 20px; 
                height: 20px; 
                background: #2563eb; 
                border: 3px solid white; 
                border-radius: 50%; 
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            "></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });
        
        this.currentLocationMarker = L.marker(coordinates, { 
            icon: locationIcon,
            zIndexOffset: 1000 
        });
        
        this.currentLocationMarker.bindPopup('Your location');
        this.currentLocationMarker.addTo(this.map);
        
        // Center map on location
        this.map.setView(coordinates, CONFIG.DEFAULT_ZOOM);
    }
    
    /**
     * Update marker sizes based on current zoom level
     */
    updateMarkerSizes() {
        const zoom = this.map.getZoom();
        const scale = Math.max(0.7, Math.min(1.3, zoom / CONFIG.DEFAULT_ZOOM));
        
        // This would update CSS custom properties if implemented
        document.documentElement.style.setProperty('--marker-scale', scale);
    }
    
    /**
     * Get the current map center
     * @returns {Array} [lat, lng]
     */
    getCenter() {
        const center = this.map.getCenter();
        return [center.lat, center.lng];
    }
    
    /**
     * Get current route data
     * @returns {Object} Current route data
     */
    getCurrentRoute() {
        return this.currentRoute;
    }
    
    /**
     * Resize map (useful when container size changes)
     */
    resize() {
        if (this.map) {
            this.map.invalidateSize();
        }
    }
    
    /**
     * Destroy the map instance
     */
    destroy() {
        if (this.map) {
            this.map.remove();
            this.map = null;
        }
    }
}