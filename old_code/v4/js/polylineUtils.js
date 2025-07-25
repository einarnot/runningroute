// Polyline utilities for 3D elevation data
class PolylineUtils {
    
    /**
     * Decode a 3D polyline string with elevation data
     * @param {string} polylineString - Encoded polyline string
     * @param {boolean} hasElevation - Whether the polyline includes elevation data
     * @returns {Array} Array of [lat, lng, elevation] coordinates
     */
    static decode3D(polylineString, hasElevation = true) {
        if (!polylineString) return [];
        
        try {
            // Use the enhanced polyline decoder that properly handles 3D elevation data
            const decoded = polyline.decode(polylineString, hasElevation);
            
            // The decoder already returns [lat, lng, elevation] when hasElevation is true
            if (!hasElevation) {
                return decoded.map(coord => [coord[0], coord[1], 0]);
            }
            
            // Ensure all coordinates have elevation data
            return decoded.map(coord => [
                coord[0], 
                coord[1], 
                coord[2] !== undefined ? coord[2] : 0
            ]);
        } catch (error) {
            console.error('Error decoding polyline:', error);
            return [];
        }
    }
    
    /**
     * Calculate distance between two coordinates (Haversine formula)
     * @param {Array} coord1 - [lat, lng]
     * @param {Array} coord2 - [lat, lng] 
     * @returns {number} Distance in meters
     */
    static calculateDistance(coord1, coord2) {
        const R = 6371000; // Earth's radius in meters
        const lat1Rad = coord1[0] * Math.PI / 180;
        const lat2Rad = coord2[0] * Math.PI / 180;
        const deltaLatRad = (coord2[0] - coord1[0]) * Math.PI / 180;
        const deltaLngRad = (coord2[1] - coord1[1]) * Math.PI / 180;
        
        const a = Math.sin(deltaLatRad/2) * Math.sin(deltaLatRad/2) +
                  Math.cos(lat1Rad) * Math.cos(lat2Rad) *
                  Math.sin(deltaLngRad/2) * Math.sin(deltaLngRad/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        
        return R * c;
    }
    
    /**
     * Calculate gradient between two points with elevation
     * @param {Array} coord1 - [lat, lng, elevation]
     * @param {Array} coord2 - [lat, lng, elevation]
     * @returns {number} Gradient as percentage
     */
    static calculateGradient(coord1, coord2) {
        const distance = this.calculateDistance(coord1, coord2);
        if (distance === 0) return 0;
        
        const elevationDiff = coord2[2] - coord1[2];
        return (elevationDiff / distance) * 100;
    }
    
    /**
     * Get steepness level based on gradient
     * @param {number} gradient - Gradient as percentage
     * @returns {number} Steepness level from CONFIG.STEEPNESS_LEVELS
     */
    static getSteepnessLevel(gradient) {
        const absGradient = Math.abs(gradient);
        
        if (absGradient >= 15) return gradient > 0 ? CONFIG.STEEPNESS_LEVELS.VERY_STEEP : CONFIG.STEEPNESS_LEVELS.DOWNHILL_MODERATE;
        if (absGradient >= 10) return gradient > 0 ? CONFIG.STEEPNESS_LEVELS.STEEP : CONFIG.STEEPNESS_LEVELS.DOWNHILL_MODERATE;
        if (absGradient >= 5) return gradient > 0 ? CONFIG.STEEPNESS_LEVELS.MODERATE : CONFIG.STEEPNESS_LEVELS.DOWNHILL_SLIGHT;
        if (absGradient >= 2) return gradient > 0 ? CONFIG.STEEPNESS_LEVELS.SLIGHT : CONFIG.STEEPNESS_LEVELS.DOWNHILL_SLIGHT;
        
        return CONFIG.STEEPNESS_LEVELS.FLAT;
    }
    
    /**
     * Get color for elevation visualization based on steepness
     * @param {number} steepnessLevel - Steepness level
     * @returns {string} Color hex code
     */
    static getElevationColor(steepnessLevel) {
        switch (steepnessLevel) {
            case CONFIG.STEEPNESS_LEVELS.VERY_STEEP:
                return CONFIG.ELEVATION_COLORS.VERY_STEEP;
            case CONFIG.STEEPNESS_LEVELS.STEEP:
                return CONFIG.ELEVATION_COLORS.STEEP;
            case CONFIG.STEEPNESS_LEVELS.MODERATE:
                return CONFIG.ELEVATION_COLORS.MODERATE;
            case CONFIG.STEEPNESS_LEVELS.SLIGHT:
                return CONFIG.ELEVATION_COLORS.SLIGHT;
            default:
                return CONFIG.ELEVATION_COLORS.FLAT;
        }
    }
    
    /**
     * Process route coordinates and add elevation analysis
     * @param {Array} coordinates - Array of [lat, lng, elevation] coordinates
     * @returns {Object} Processed route data with elevation analysis
     */
    static processRouteElevation(coordinates) {
        if (!coordinates || coordinates.length < 2) {
            return {
                coordinates: [],
                segments: [],
                totalDistance: 0,
                elevationGain: 0,
                elevationLoss: 0,
                steepestSegment: null
            };
        }
        
        const segments = [];
        let totalDistance = 0;
        let elevationGain = 0;
        let elevationLoss = 0;
        let steepestGradient = 0;
        let steepestSegment = null;
        
        for (let i = 0; i < coordinates.length - 1; i++) {
            const coord1 = coordinates[i];
            const coord2 = coordinates[i + 1];
            
            const distance = this.calculateDistance(coord1, coord2);
            const gradient = this.calculateGradient(coord1, coord2);
            const steepnessLevel = this.getSteepnessLevel(gradient);
            const color = this.getElevationColor(steepnessLevel);
            
            const segment = {
                start: coord1,
                end: coord2,
                distance: distance,
                gradient: gradient,
                steepnessLevel: steepnessLevel,
                color: color,
                elevationChange: coord2[2] - coord1[2]
            };
            
            segments.push(segment);
            totalDistance += distance;
            
            // Track elevation changes
            if (segment.elevationChange > 0) {
                elevationGain += segment.elevationChange;
            } else {
                elevationLoss += Math.abs(segment.elevationChange);
            }
            
            // Track steepest segment
            if (Math.abs(gradient) > Math.abs(steepestGradient)) {
                steepestGradient = gradient;
                steepestSegment = {
                    ...segment,
                    index: i,
                    midpoint: [
                        (coord1[0] + coord2[0]) / 2,
                        (coord1[1] + coord2[1]) / 2,
                        (coord1[2] + coord2[2]) / 2
                    ]
                };
            }
        }
        
        return {
            coordinates,
            segments,
            totalDistance,
            elevationGain,
            elevationLoss,
            steepestSegment
        };
    }
    
    /**
     * Generate kilometer markers along the route
     * @param {Array} coordinates - Route coordinates
     * @param {number} totalDistance - Total route distance in meters
     * @returns {Array} Array of kilometer marker positions
     */
    static generateKilometerMarkers(coordinates, totalDistance) {
        if (!coordinates || coordinates.length < 2) return [];
        
        const markers = [];
        const totalKm = Math.floor(totalDistance / 1000);
        let currentDistance = 0;
        let nextKmTarget = 1000; // First marker at 1km
        
        for (let i = 0; i < coordinates.length - 1; i++) {
            const coord1 = coordinates[i];
            const coord2 = coordinates[i + 1];
            const segmentDistance = this.calculateDistance(coord1, coord2);
            
            // Check if we cross a kilometer boundary in this segment
            if (currentDistance + segmentDistance >= nextKmTarget && nextKmTarget <= totalDistance) {
                // Interpolate position where the kilometer mark should be
                const distanceIntoSegment = nextKmTarget - currentDistance;
                const ratio = distanceIntoSegment / segmentDistance;
                
                const markerPosition = [
                    coord1[0] + (coord2[0] - coord1[0]) * ratio,
                    coord1[1] + (coord2[1] - coord1[1]) * ratio,
                    coord1[2] + (coord2[2] - coord1[2]) * ratio
                ];
                
                markers.push({
                    position: markerPosition,
                    kilometer: Math.round(nextKmTarget / 1000),
                    elevation: markerPosition[2]
                });
                
                nextKmTarget += 1000;
            }
            
            currentDistance += segmentDistance;
        }
        
        return markers;
    }
}