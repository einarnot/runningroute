// 3D Polyline decoder for OpenRouteService responses
// Based on Google's polyline algorithm with elevation support

class PolylineDecoder {
    constructor() {
        this.precision = 5; // Default precision for lat/lng
        this.elevationPrecision = 2; // Precision for elevation data
    }

    // Decode 2D polyline (lat, lng only)
    decode2D(encoded, precision = this.precision) {
        if (!encoded || typeof encoded !== 'string') {
            console.warn('Invalid polyline string provided');
            return [];
        }

        const coordinates = [];
        let index = 0;
        let lat = 0;
        let lng = 0;
        const factor = Math.pow(10, precision);

        try {
            while (index < encoded.length) {
                // Decode latitude
                let shift = 0;
                let result = 0;
                let byte;
                
                do {
                    byte = encoded.charCodeAt(index++) - 63;
                    result |= (byte & 0x1f) << shift;
                    shift += 5;
                } while (byte >= 0x20);
                
                const deltaLat = ((result & 1) ? ~(result >> 1) : (result >> 1));
                lat += deltaLat;

                // Decode longitude
                shift = 0;
                result = 0;
                
                do {
                    byte = encoded.charCodeAt(index++) - 63;
                    result |= (byte & 0x1f) << shift;
                    shift += 5;
                } while (byte >= 0x20);
                
                const deltaLng = ((result & 1) ? ~(result >> 1) : (result >> 1));
                lng += deltaLng;

                coordinates.push([lat / factor, lng / factor]);
            }
        } catch (error) {
            console.error('Error decoding polyline:', error);
            return [];
        }

        return coordinates;
    }

    // Decode 3D polyline (lat, lng, elevation)
    decode3D(encoded, precision = this.precision, elevationPrecision = this.elevationPrecision) {
        if (!encoded || typeof encoded !== 'string') {
            console.warn('Invalid 3D polyline string provided');
            return [];
        }

        const coordinates = [];
        let index = 0;
        let lat = 0;
        let lng = 0;
        let elevation = 0;
        const factor = Math.pow(10, precision);
        const elevationFactor = Math.pow(10, elevationPrecision);

        try {
            while (index < encoded.length) {
                // Decode latitude
                let shift = 0;
                let result = 0;
                let byte;
                
                do {
                    byte = encoded.charCodeAt(index++) - 63;
                    result |= (byte & 0x1f) << shift;
                    shift += 5;
                } while (byte >= 0x20);
                
                const deltaLat = ((result & 1) ? ~(result >> 1) : (result >> 1));
                lat += deltaLat;

                // Decode longitude
                shift = 0;
                result = 0;
                
                do {
                    byte = encoded.charCodeAt(index++) - 63;
                    result |= (byte & 0x1f) << shift;
                    shift += 5;
                } while (byte >= 0x20);
                
                const deltaLng = ((result & 1) ? ~(result >> 1) : (result >> 1));
                lng += deltaLng;

                // Decode elevation
                shift = 0;
                result = 0;
                
                do {
                    byte = encoded.charCodeAt(index++) - 63;
                    result |= (byte & 0x1f) << shift;
                    shift += 5;
                } while (byte >= 0x20);
                
                const deltaElevation = ((result & 1) ? ~(result >> 1) : (result >> 1));
                elevation += deltaElevation;

                coordinates.push([
                    lat / factor, 
                    lng / factor, 
                    elevation / elevationFactor
                ]);
            }
        } catch (error) {
            console.error('Error decoding 3D polyline:', error);
            return [];
        }

        return coordinates;
    }

    // Process OpenRouteService response
    processRouteResponse(response) {
        if (!response || !response.routes || response.routes.length === 0) {
            console.warn('Invalid route response');
            return null;
        }

        const route = response.routes[0];
        const geometry = route.geometry;
        
        if (!geometry) {
            console.warn('No geometry found in route');
            return null;
        }

        // Check if it's 3D polyline (includes elevation)
        const is3D = route.elevation === true || 
                     (route.segments && route.segments.some(s => s.ascent !== undefined));

        let coordinates;
        if (is3D) {
            coordinates = this.decode3D(geometry);
        } else {
            coordinates = this.decode2D(geometry);
            // If no elevation data, set all elevations to 0
            coordinates = coordinates.map(coord => [...coord, 0]);
        }

        // Extract route metadata
        const summary = route.summary || {};
        const segments = route.segments || [];
        
        let totalAscent = 0;
        let totalDescent = 0;
        
        segments.forEach(segment => {
            if (segment.ascent) totalAscent += segment.ascent;
            if (segment.descent) totalDescent += segment.descent;
        });

        return {
            coordinates,
            distance: summary.distance ? summary.distance / 1000 : 0, // Convert to km
            duration: summary.duration || 0,
            ascent: totalAscent || 0,
            descent: totalDescent || 0,
            segments,
            bbox: response.bbox || null,
            is3D
        };
    }

    // Sample coordinates at regular intervals for visualization
    sampleCoordinates(coordinates, intervalKm = 0.05) {
        if (!coordinates || coordinates.length < 2) {
            return coordinates || [];
        }

        const sampled = [coordinates[0]]; // Always include first point
        let cumulativeDistance = 0;
        let lastSampledDistance = 0;

        for (let i = 1; i < coordinates.length; i++) {
            const prev = coordinates[i - 1];
            const curr = coordinates[i];
            
            const segmentDistance = Utils.calculateDistance(
                prev[0], prev[1], curr[0], curr[1]
            );
            
            cumulativeDistance += segmentDistance;
            
            // Sample if we've traveled the required interval
            if (cumulativeDistance - lastSampledDistance >= intervalKm) {
                sampled.push(curr);
                lastSampledDistance = cumulativeDistance;
            }
        }

        // Always include last point if not already sampled
        const lastCoord = coordinates[coordinates.length - 1];
        const lastSampled = sampled[sampled.length - 1];
        
        if (lastSampled[0] !== lastCoord[0] || lastSampled[1] !== lastCoord[1]) {
            sampled.push(lastCoord);
        }

        return sampled;
    }

    // Calculate gradients for route segments
    calculateGradients(coordinates) {
        if (!coordinates || coordinates.length < 2) {
            return [];
        }

        const gradients = [];

        for (let i = 0; i < coordinates.length - 1; i++) {
            const current = coordinates[i];
            const next = coordinates[i + 1];
            
            const distance = Utils.calculateDistance(
                current[0], current[1], next[0], next[1]
            );
            
            let gradient = 0;
            if (distance > 0 && current[2] !== undefined && next[2] !== undefined) {
                gradient = Utils.calculateGradient(current[2], next[2], distance);
            }
            
            gradients.push({
                gradient,
                distance,
                startElevation: current[2] || 0,
                endElevation: next[2] || 0,
                color: Utils.getRouteColor(gradient)
            });
        }

        return gradients;
    }

    // Create colored route segments for map display
    createColoredSegments(coordinates) {
        const gradients = this.calculateGradients(coordinates);
        const segments = [];

        for (let i = 0; i < gradients.length; i++) {
            const start = coordinates[i];
            const end = coordinates[i + 1];
            const gradient = gradients[i];

            segments.push({
                coordinates: [
                    [start[0], start[1]],
                    [end[0], end[1]]
                ],
                gradient: gradient.gradient,
                color: gradient.color,
                distance: gradient.distance,
                elevationChange: gradient.endElevation - gradient.startElevation
            });
        }

        return segments;
    }

    // Get route statistics
    getRouteStats(coordinates) {
        if (!coordinates || coordinates.length < 2) {
            return {
                totalDistance: 0,
                totalAscent: 0,
                totalDescent: 0,
                maxElevation: 0,
                minElevation: 0,
                avgGradient: 0
            };
        }

        let totalDistance = 0;
        let totalAscent = 0;
        let totalDescent = 0;
        let maxElevation = coordinates[0][2] || 0;
        let minElevation = coordinates[0][2] || 0;
        let totalElevationChange = 0;

        for (let i = 1; i < coordinates.length; i++) {
            const prev = coordinates[i - 1];
            const curr = coordinates[i];
            
            // Distance calculation
            const distance = Utils.calculateDistance(
                prev[0], prev[1], curr[0], curr[1]
            );
            totalDistance += distance;
            
            // Elevation calculations
            const prevElevation = prev[2] || 0;
            const currElevation = curr[2] || 0;
            const elevationChange = currElevation - prevElevation;
            
            maxElevation = Math.max(maxElevation, currElevation);
            minElevation = Math.min(minElevation, currElevation);
            
            if (elevationChange > 0) {
                totalAscent += elevationChange;
            } else {
                totalDescent += Math.abs(elevationChange);
            }
            
            totalElevationChange += Math.abs(elevationChange);
        }

        const avgGradient = totalDistance > 0 ? 
            (totalElevationChange / (totalDistance * 1000)) * 100 : 0;

        return {
            totalDistance,
            totalAscent,
            totalDescent,
            maxElevation,
            minElevation,
            avgGradient
        };
    }
}

// Create global instance
window.PolylineDecoder = new PolylineDecoder();