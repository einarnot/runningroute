class RouteGenerator {
    constructor() {
        this.map = null;
        this.routeGenerations = [];
        this.currentRouteIndex = 0;
        this.routeLayers = [];
        
        // OpenRouteService API configuration
        this.ORS_API_KEY = 'YOUR_OPENROUTE_SERVICE_API_KEY'; // Replace with your API key
        this.ORS_BASE_URL = 'https://api.openrouteservice.org/v2';
        
        this.init();
    }

    init() {
        this.initMap();
        this.initControls();
        this.getCurrentLocation();
    }

    initMap() {
        this.map = L.map('map').setView([63.4305, 10.3951], 13);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);
    }

    initControls() {
        const generateBtn = document.getElementById('generate-route');
        const distanceSlider = document.getElementById('distance');
        const distanceDisplay = document.getElementById('distance-display');
        
        distanceSlider.addEventListener('input', (e) => {
            distanceDisplay.textContent = e.target.value + ' km';
        });

        generateBtn.addEventListener('click', () => {
            this.generateRoutes();
        });
    }

    getCurrentLocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    this.map.setView([lat, lng], 15);
                    
                    // Add user location marker
                    L.marker([lat, lng])
                        .addTo(this.map)
                        .bindPopup('Your Location')
                        .openPopup();
                },
                (error) => {
                    console.error('Error getting location:', error);
                }
            );
        }
    }

    async generateRoutes() {
        const distance = document.getElementById('distance').value;
        const center = this.map.getCenter();
        
        this.showLoading(true);
        
        try {
            // Generate multiple route options
            const routes = await this.generateMultipleRoutes(center, distance);
            this.displayRouteOptions(routes);
        } catch (error) {
            console.error('Error generating routes:', error);
            this.showError('Failed to generate routes');
        } finally {
            this.showLoading(false);
        }
    }

    async generateMultipleRoutes(center, distance) {
        const routes = [];
        const numRoutes = 5; // Generate 5 different route options
        
        for (let i = 0; i < numRoutes; i++) {
            try {
                const route = await this.generateSingleRoute(center, distance, i);
                if (route) routes.push(route);
            } catch (error) {
                console.warn(`Failed to generate route ${i}:`, error);
            }
        }
        
        return routes;
    }

    async generateSingleRoute(center, distance, variation) {
        // Calculate destination based on bearing and distance
        const bearing = (variation * 72) * (Math.PI / 180); // Spread routes evenly
        const destination = this.calculateDestination(center, distance * 1000 / 2, bearing);
        
        // Create out-and-back route coordinates
        const coordinates = [
            [center.lng, center.lat],
            [destination.lng, destination.lat],
            [center.lng, center.lat]
        ];

        const response = await fetch(`${this.ORS_BASE_URL}/directions/foot-walking`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': this.ORS_API_KEY
            },
            body: JSON.stringify({
                coordinates: coordinates,
                format: 'json'
            })
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        return data.routes[0];
    }

    calculateDestination(start, distance, bearing) {
        const R = 6371000; // Earth's radius in meters
        const lat1 = start.lat * Math.PI / 180;
        const lng1 = start.lng * Math.PI / 180;

        const lat2 = Math.asin(Math.sin(lat1) * Math.cos(distance / R) + 
                              Math.cos(lat1) * Math.sin(distance / R) * Math.cos(bearing));
        
        const lng2 = lng1 + Math.atan2(Math.sin(bearing) * Math.sin(distance / R) * Math.cos(lat1),
                                      Math.cos(distance / R) - Math.sin(lat1) * Math.sin(lat2));

        return {
            lat: lat2 * 180 / Math.PI,
            lng: lng2 * 180 / Math.PI
        };
    }

    displayRouteOptions(routes) {
        // Clear existing routes
        this.clearRoutes();
        
        routes.forEach((route, index) => {
            const coordinates = this.decodePolyline(route.geometry);
            const routeLayer = L.polyline(coordinates, {
                color: index === 0 ? '#ff0000' : '#0066cc',
                weight: index === 0 ? 5 : 3,
                opacity: 0.7
            }).addTo(this.map);
            
            this.routeLayers.push(routeLayer);
            
            // Add click handler to select route
            routeLayer.on('click', () => {
                this.selectRoute(index);
            });
        });
        
        // Fit map to show all routes
        if (this.routeLayers.length > 0) {
            const group = L.featureGroup(this.routeLayers);
            this.map.fitBounds(group.getBounds(), { padding: [20, 20] });
        }
    }

    selectRoute(index) {
        // Highlight selected route
        this.routeLayers.forEach((layer, i) => {
            layer.setStyle({
                color: i === index ? '#ff0000' : '#0066cc',
                weight: i === index ? 5 : 3
            });
        });
        
        this.currentRouteIndex = index;
    }

    clearRoutes() {
        this.routeLayers.forEach(layer => {
            this.map.removeLayer(layer);
        });
        this.routeLayers = [];
    }

    decodePolyline(encoded) {
        // Simple polyline decoder
        const points = [];
        let index = 0, len = encoded.length;
        let lat = 0, lng = 0;

        while (index < len) {
            let b, shift = 0, result = 0;
            do {
                b = encoded.charAt(index++).charCodeAt(0) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);
            
            lat += ((result & 1) ? ~(result >> 1) : (result >> 1));
            
            shift = 0;
            result = 0;
            do {
                b = encoded.charAt(index++).charCodeAt(0) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);
            
            lng += ((result & 1) ? ~(result >> 1) : (result >> 1));
            
            points.push([lat / 1e5, lng / 1e5]);
        }

        return points;
    }

    showLoading(show) {
        const loader = document.getElementById('loading');
        if (loader) {
            loader.style.display = show ? 'block' : 'none';
        }
    }

    showError(message) {
        alert(message);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new RouteGenerator();
});