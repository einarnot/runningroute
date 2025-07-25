// Elevation service for route elevation data and coloring

class ElevationService {
    constructor() {
        this.cache = new Map();
        this.batchSize = 100; // Maximum points per API request
        this.elevationApiUrl = 'https://api.open-meteo.com/v1/elevation';
    }

    // Get elevation data for coordinates using Open-Meteo API
    async getElevations(coordinates) {
        if (!coordinates || coordinates.length === 0) {
            return [];
        }

        // Check cache first
        const cacheKey = this.generateCacheKey(coordinates);
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const elevations = await this.fetchElevationsFromAPI(coordinates);
            
            // Cache the results
            this.cache.set(cacheKey, elevations);
            
            // Clean cache if it gets too large
            if (this.cache.size > 100) {
                const firstKey = this.cache.keys().next().value;
                this.cache.delete(firstKey);
            }
            
            return elevations;
        } catch (error) {
            console.error('Failed to fetch elevation data:', error);
            // Return zeros as fallback
            return coordinates.map(() => 0);
        }
    }

    // Fetch elevations from Open-Meteo API
    async fetchElevationsFromAPI(coordinates) {
        const batches = this.createBatches(coordinates);
        const allElevations = [];

        for (const batch of batches) {
            const lats = batch.map(coord => coord[0]);
            const lons = batch.map(coord => coord[1]);
            
            const params = new URLSearchParams({
                latitude: lats.join(','),
                longitude: lons.join(',')
            });

            const response = await fetch(`${this.elevationApiUrl}?${params}`);
            
            if (!response.ok) {
                throw new Error(`Elevation API error: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (!data.elevation || !Array.isArray(data.elevation)) {
                throw new Error('Invalid elevation data received');
            }

            allElevations.push(...data.elevation);
        }

        return allElevations;
    }

    // Create batches for API requests
    createBatches(coordinates) {
        const batches = [];
        for (let i = 0; i < coordinates.length; i += this.batchSize) {
            batches.push(coordinates.slice(i, i + this.batchSize));
        }
        return batches;
    }

    // Generate cache key for coordinates
    generateCacheKey(coordinates) {
        // Create a simplified key based on first/last/middle coordinates
        const first = coordinates[0];
        const last = coordinates[coordinates.length - 1];
        const middle = coordinates[Math.floor(coordinates.length / 2)];
        
        return `${first[0].toFixed(4)},${first[1].toFixed(4)}_${middle[0].toFixed(4)},${middle[1].toFixed(4)}_${last[0].toFixed(4)},${last[1].toFixed(4)}_${coordinates.length}`;
    }

    // Add elevation data to route coordinates
    async enhanceRouteWithElevation(coordinates) {
        if (!coordinates || coordinates.length === 0) {
            return [];
        }

        // Check if coordinates already have elevation data
        const hasElevation = coordinates.every(coord => coord.length >= 3 && coord[2] !== undefined);
        
        if (hasElevation) {
            return coordinates;
        }

        try {
            const elevations = await this.getElevations(coordinates);
            
            return coordinates.map((coord, index) => [
                coord[0], // latitude
                coord[1], // longitude
                elevations[index] || 0 // elevation
            ]);
        } catch (error) {
            console.error('Error enhancing route with elevation:', error);
            // Return coordinates with zero elevation as fallback
            return coordinates.map(coord => [...coord, 0]);
        }
    }

    // Sample route at regular intervals for elevation analysis
    sampleRouteForElevation(coordinates, intervalKm = 0.05) {
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

        // Always include last point
        const lastCoord = coordinates[coordinates.length - 1];
        const lastSampled = sampled[sampled.length - 1];
        
        if (lastSampled[0] !== lastCoord[0] || lastSampled[1] !== lastCoord[1]) {
            sampled.push(lastCoord);
        }

        return sampled;
    }

    // Calculate route elevation profile
    calculateElevationProfile(coordinates) {
        if (!coordinates || coordinates.length < 2) {
            return {
                totalDistance: 0,
                totalAscent: 0,
                totalDescent: 0,
                maxElevation: 0,
                minElevation: 0,
                elevationGain: 0,
                averageGradient: 0,
                maxGradient: 0,
                segments: []
            };
        }

        let totalDistance = 0;
        let totalAscent = 0;
        let totalDescent = 0;
        let maxElevation = coordinates[0][2] || 0;
        let minElevation = coordinates[0][2] || 0;
        let maxGradient = 0;
        const segments = [];

        for (let i = 1; i < coordinates.length; i++) {
            const prev = coordinates[i - 1];
            const curr = coordinates[i];
            
            const distance = Utils.calculateDistance(
                prev[0], prev[1], curr[0], curr[1]
            );
            
            const prevElevation = prev[2] || 0;
            const currElevation = curr[2] || 0;
            const elevationChange = currElevation - prevElevation;
            const gradient = Utils.calculateGradient(prevElevation, currElevation, distance);
            
            totalDistance += distance;
            maxElevation = Math.max(maxElevation, currElevation);
            minElevation = Math.min(minElevation, currElevation);
            maxGradient = Math.max(maxGradient, Math.abs(gradient));
            
            if (elevationChange > 0) {
                totalAscent += elevationChange;
            } else {
                totalDescent += Math.abs(elevationChange);
            }

            segments.push({
                distance,
                elevationChange,
                gradient,
                startElevation: prevElevation,
                endElevation: currElevation,
                cumulativeDistance: totalDistance,
                color: Utils.getRouteColor(gradient)
            });
        }

        const elevationGain = totalAscent;
        const averageGradient = totalDistance > 0 ? 
            ((totalAscent + totalDescent) / (totalDistance * 1000)) * 100 : 0;

        return {
            totalDistance,
            totalAscent,
            totalDescent,
            maxElevation,
            minElevation,
            elevationGain,
            averageGradient,
            maxGradient,
            segments
        };
    }

    // Create colored route segments for map display
    createColoredSegments(coordinates) {
        const segments = [];

        for (let i = 0; i < coordinates.length - 1; i++) {
            const start = coordinates[i];
            const end = coordinates[i + 1];
            
            const distance = Utils.calculateDistance(
                start[0], start[1], end[0], end[1]
            );
            
            const startElevation = start[2] || 0;
            const endElevation = end[2] || 0;
            const gradient = Utils.calculateGradient(startElevation, endElevation, distance);
            const color = Utils.getRouteColor(gradient);

            segments.push({
                coordinates: [
                    [start[0], start[1]],
                    [end[0], end[1]]
                ],
                gradient,
                color,
                distance,
                elevationChange: endElevation - startElevation,
                startElevation,
                endElevation
            });
        }

        return segments;
    }

    // Get elevation statistics summary
    getElevationSummary(coordinates) {
        const profile = this.calculateElevationProfile(coordinates);
        
        return {
            distance: Utils.formatDistance(profile.totalDistance),
            ascent: Utils.formatElevation(profile.totalAscent),
            descent: Utils.formatElevation(profile.totalDescent),
            maxElevation: Utils.formatElevation(profile.maxElevation),
            minElevation: Utils.formatElevation(profile.minElevation),
            avgGradient: `${profile.averageGradient.toFixed(1)}%`,
            maxGradient: `${profile.maxGradient.toFixed(1)}%`
        };
    }

    // Classify terrain difficulty based on elevation profile
    classifyTerrain(coordinates) {
        const profile = this.calculateElevationProfile(coordinates);
        
        const avgGradient = profile.averageGradient;
        const maxGradient = profile.maxGradient;
        const totalAscent = profile.totalAscent;
        const distance = profile.totalDistance;
        
        // Calculate ascent per km
        const ascentPerKm = distance > 0 ? totalAscent / distance : 0;
        
        if (avgGradient <= 2 && maxGradient <= 5 && ascentPerKm <= 30) {
            return {
                level: 'flat',
                description: 'Flat terrain with minimal elevation changes',
                difficulty: 1,
                color: '#10b981'
            };
        } else if (avgGradient <= 5 && maxGradient <= 12 && ascentPerKm <= 80) {
            return {
                level: 'rolling',
                description: 'Rolling terrain with moderate hills',
                difficulty: 2,
                color: '#f59e0b'
            };
        } else if (avgGradient <= 8 && maxGradient <= 20 && ascentPerKm <= 150) {
            return {
                level: 'hilly',
                description: 'Hilly terrain with challenging climbs',
                difficulty: 3,
                color: '#ef4444'
            };
        } else {
            return {
                level: 'mountainous',
                description: 'Mountainous terrain with steep climbs',
                difficulty: 4,
                color: '#dc2626'
            };
        }
    }

    // Clear elevation cache
    clearCache() {
        this.cache.clear();
    }

    // Get cache statistics
    getCacheStats() {
        return {
            size: this.cache.size,
            maxSize: 100
        };
    }
}

// Create global instance
window.ElevationService = new ElevationService();