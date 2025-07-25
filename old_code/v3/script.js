// Updated elevation display - v3
class RouteGenerator {
    constructor() {
        this.map = null;
        this.currentRoute = null;
        this.routeSegments = []; // Array to store route segments
        this.elevationMarkers = [];
        this.elevationLegend = null;
        this.debugMode = false; // Debug mode toggle
        this.debugMarkers = []; // Store debug markers
        this.userLocation = null;
        this.startLocation = null; // Current start position for routes
        this.apiKey = 'YOUR_OPENROUTE_SERVICE_API_KEY';
        
        this.initMap();
        this.initControls();
        this.getCurrentLocation(); // Auto-request location on startup
    }

    initMap() {
        this.map = L.map('map').setView([63.4305, 10.3951], 13);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);

        // Add click event to set start position
        this.map.on('click', (e) => {
            this.setStartPosition(e.latlng);
        });
    }

    /**
     * Decode an x,y or x,y,z encoded polyline
     * @param {*} encodedPolyline
     * @param {Boolean} includeElevation - true for x,y,z polyline
     * @returns {Array} of coordinates
     */
    decodePolyline(encodedPolyline, includeElevation = true) {
        // array that holds the points
        let points = []
        let index = 0
        const len = encodedPolyline.length
        let lat = 0
        let lng = 0
        let ele = 0
        while (index < len) {
            let b
            let shift = 0
            let result = 0
            do {
                b = encodedPolyline.charAt(index++).charCodeAt(0) - 63 // finds ascii
                // and subtract it by 63
                result |= (b & 0x1f) << shift
                shift += 5
            } while (b >= 0x20)

            lat += ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1))
            shift = 0
            result = 0
            do {
                b = encodedPolyline.charAt(index++).charCodeAt(0) - 63
                result |= (b & 0x1f) << shift
                shift += 5
            } while (b >= 0x20)
            lng += ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1))

            if (includeElevation) {
                shift = 0
                result = 0
                do {
                    b = encodedPolyline.charAt(index++).charCodeAt(0) - 63
                    result |= (b & 0x1f) << shift
                    shift += 5
                } while (b >= 0x20)
                ele += ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1))
            }
            try {
                let location = [(lat / 1E5), (lng / 1E5)]
                if (includeElevation) location.push((ele / 100))
                points.push(location)
            } catch (e) {
                console.log(e)
            }
        }
        return points
    }

    async findRoute() {
        const desiredDistance = parseFloat(document.getElementById('distance-slider').value) * 1000;
        this.showLoading(true);

        try {
            console.log('Finding route with desired distance:', desiredDistance);
            console.log('Start location:', this.startLocation);
            
            // Try different destination distances to find one that gives us the desired total distance
            const route = await this.findOptimalRoute(this.startLocation, desiredDistance);
            
            if (route && route.routes && route.routes.length > 0) {
                console.log('Route found successfully');
                await this.displayRoute(route.routes[0]);
                this.showRouteInfo(route.routes[0]);
            } else {
                console.log('No routes in API response:', route);
                this.showError('No route found. Try a different distance or location.');
            }
        } catch (error) {
            console.error('Route finding error:', error);
            this.showError('Error finding route: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    showLoading(show) {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = show ? 'flex' : 'none';
        }
    }

    showError(message) {
        alert(message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new RouteGenerator();
});