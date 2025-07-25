// Route generator engine for creating multiple route alternatives

class RouteGenerator {
    constructor() {
        this.apiBaseUrl = '/api'; // Vercel serverless functions
        this.maxRetries = 3;
        this.retryDelay = 1000;
    }

    // Generate multiple route alternatives
    async generateRoutes(preferences) {
        try {
            Utils.showLoading(true, 'Generating route alternatives...', 'Finding the best paths');

            // Validate preferences
            const validatedPrefs = this.validatePreferences(preferences);
            
            // Generate route alternatives
            const routes = await this.callRouteGenerationAPI(validatedPrefs);
            
            if (!routes || routes.length === 0) {
                throw new Error('No routes could be generated for your preferences');
            }

            Utils.showLoading(true, 'Evaluating routes with AI...', 'Selecting the best option');

            // Evaluate routes with AI
            const evaluatedRoutes = await this.evaluateRoutesWithAI(routes, validatedPrefs);
            
            // Select the best route
            const bestRoute = this.selectBestRoute(evaluatedRoutes);
            
            if (!bestRoute) {
                throw new Error('Could not find a suitable route');
            }

            // Enhance route with elevation data
            const enhancedRoute = await this.enhanceRouteWithElevation(bestRoute);
            
            Utils.showLoading(false);
            
            return enhancedRoute;
        } catch (error) {
            Utils.showLoading(false);
            console.error('Route generation failed:', error);
            throw error;
        }
    }

    // Validate user preferences
    validatePreferences(preferences) {
        const validated = {
            startLat: null,
            startLon: null,
            distance: 5,
            routeType: 'loop',
            terrain: 'flat'
        };

        // Validate start location
        if (preferences.startLocation) {
            const coords = this.parseLocationInput(preferences.startLocation);
            if (coords) {
                validated.startLat = coords.lat;
                validated.startLon = coords.lon;
            } else {
                throw new Error('Invalid starting location. Please enter valid coordinates or address.');
            }
        } else {
            throw new Error('Starting location is required');
        }

        // Validate distance
        const distance = parseFloat(preferences.distance);
        if (isNaN(distance) || distance < 0.5 || distance > 50) {
            throw new Error('Distance must be between 0.5 and 50 kilometers');
        }
        validated.distance = distance;

        // Validate route type
        if (['loop', 'outback'].includes(preferences.routeType)) {
            validated.routeType = preferences.routeType;
        }

        // Validate terrain preference
        if (['flat', 'hilly'].includes(preferences.terrain)) {
            validated.terrain = preferences.terrain;
        }

        return validated;
    }

    // Parse location input (coordinates or address)
    parseLocationInput(input) {
        if (!input || typeof input !== 'string') {
            return null;
        }

        const trimmed = input.trim();
        
        // Check if it's coordinates (lat, lon)
        const coordMatch = trimmed.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
        if (coordMatch) {
            const lat = parseFloat(coordMatch[1]);
            const lon = parseFloat(coordMatch[2]);
            
            if (Utils.isValidCoordinate(lat, lon)) {
                return { lat, lon };
            }
        }

        // If not coordinates, assume it's an address (will be geocoded by backend)
        return { address: trimmed };
    }

    // Call route generation API
    async callRouteGenerationAPI(preferences) {
        const requestData = {
            startLat: preferences.startLat,
            startLon: preferences.startLon,
            startAddress: preferences.address,
            distance: preferences.distance,
            routeType: preferences.routeType,
            terrain: preferences.terrain,
            alternatives: 10 // Request 10 alternative routes
        };

        let attempt = 0;
        while (attempt < this.maxRetries) {
            try {
                const response = await Utils.apiCall(`${this.apiBaseUrl}/generate-routes`, {
                    method: 'POST',
                    body: JSON.stringify(requestData)
                });

                if (response.success) {
                    return response.data.routes;
                } else {
                    throw new Error(response.error.message || 'Route generation failed');
                }
            } catch (error) {
                attempt++;
                console.warn(`Route generation attempt ${attempt} failed:`, error);
                
                if (attempt >= this.maxRetries) {
                    throw new Error(`Route generation failed after ${this.maxRetries} attempts: ${error.message}`);
                }
                
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
            }
        }
    }

    // Evaluate routes with AI
    async evaluateRoutesWithAI(routes, preferences) {
        const requestData = {
            routes: routes.map(route => ({
                id: route.id || Utils.generateId(),
                coordinates: route.coordinates,
                distance: route.distance,
                ascent: route.ascent,
                descent: route.descent,
                duration: route.duration
            })),
            preferences: {
                desiredDistance: preferences.distance,
                routeType: preferences.routeType,
                terrain: preferences.terrain
            }
        };

        let attempt = 0;
        while (attempt < this.maxRetries) {
            try {
                const response = await Utils.apiCall(`${this.apiBaseUrl}/evaluate-routes`, {
                    method: 'POST',
                    body: JSON.stringify(requestData)
                });

                if (response.success) {
                    // Merge AI evaluations with original route data
                    return this.mergeRouteEvaluations(routes, response.data.evaluations);
                } else {
                    throw new Error(response.error.message || 'Route evaluation failed');
                }
            } catch (error) {
                attempt++;
                console.warn(`Route evaluation attempt ${attempt} failed:`, error);
                
                if (attempt >= this.maxRetries) {
                    console.warn('AI evaluation failed, using fallback scoring');
                    return this.fallbackRouteEvaluation(routes, preferences);
                }
                
                await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
            }
        }
    }

    // Merge AI evaluations with route data
    mergeRouteEvaluations(routes, evaluations) {
        return routes.map(route => {
            const evaluation = evaluations.find(eval => 
                eval.routeId === route.id || 
                eval.routeId === routes.indexOf(route)
            );

            return {
                ...route,
                aiScore: evaluation?.score || 0,
                aiReasoning: evaluation?.reasoning || '',
                distanceAccuracy: evaluation?.criteria?.distanceAccuracy || 0,
                terrainMatch: evaluation?.criteria?.terrainMatch || 0,
                safetyScore: evaluation?.criteria?.safetyScore || 0,
                scenicValue: evaluation?.criteria?.scenicValue || 0,
                navigationEase: evaluation?.criteria?.navigationEase || 0
            };
        });
    }

    // Fallback route evaluation when AI fails
    fallbackRouteEvaluation(routes, preferences) {
        return routes.map((route, index) => {
            // Simple scoring based on distance accuracy
            const distanceError = Math.abs(route.distance - preferences.distance) / preferences.distance;
            const distanceScore = Math.max(0, 1 - distanceError * 2);

            // Terrain scoring (basic)
            let terrainScore = 0.5; // Default
            if (preferences.terrain === 'flat') {
                terrainScore = route.ascent < (preferences.distance * 20) ? 0.8 : 0.3;
            } else if (preferences.terrain === 'hilly') {
                terrainScore = route.ascent > (preferences.distance * 30) ? 0.8 : 0.4;
            }

            const overallScore = (distanceScore * 0.6) + (terrainScore * 0.4);

            return {
                ...route,
                id: route.id || Utils.generateId(),
                aiScore: overallScore,
                aiReasoning: 'Basic distance and terrain matching (AI unavailable)',
                distanceAccuracy: distanceScore,
                terrainMatch: terrainScore,
                safetyScore: 0.5,
                scenicValue: 0.5,
                navigationEase: 0.5
            };
        });
    }

    // Select the best route from evaluated routes
    selectBestRoute(evaluatedRoutes) {
        if (!evaluatedRoutes || evaluatedRoutes.length === 0) {
            return null;
        }

        // Sort by AI score (highest first)
        const sortedRoutes = evaluatedRoutes.sort((a, b) => b.aiScore - a.aiScore);
        
        // Return the best route
        return sortedRoutes[0];
    }

    // Enhance route with elevation data
    async enhanceRouteWithElevation(route) {
        try {
            Utils.showLoading(true, 'Adding elevation data...', 'Analyzing route gradients');

            // Process route coordinates with polyline decoder
            let coordinates = route.coordinates;
            
            // If coordinates are not already enhanced, get elevation data
            if (!coordinates.every(coord => coord.length >= 3)) {
                coordinates = await ElevationService.enhanceRouteWithElevation(coordinates);
            }

            // Calculate elevation profile
            const elevationProfile = ElevationService.calculateElevationProfile(coordinates);
            
            // Create colored segments for visualization
            const coloredSegments = ElevationService.createColoredSegments(coordinates);
            
            // Get terrain classification
            const terrainClassification = ElevationService.classifyTerrain(coordinates);

            const enhancedRoute = {
                ...route,
                coordinates,
                elevationProfile,
                coloredSegments,
                terrainClassification,
                stats: {
                    distance: Utils.formatDistance(route.distance),
                    duration: Utils.formatTime(route.distance),
                    ascent: Utils.formatElevation(elevationProfile.totalAscent),
                    descent: Utils.formatElevation(elevationProfile.totalDescent),
                    maxElevation: Utils.formatElevation(elevationProfile.maxElevation),
                    minElevation: Utils.formatElevation(elevationProfile.minElevation),
                    avgGradient: `${elevationProfile.averageGradient.toFixed(1)}%`,
                    maxGradient: `${elevationProfile.maxGradient.toFixed(1)}%`
                }
            };

            Utils.showLoading(false);
            return enhancedRoute;
        } catch (error) {
            console.error('Failed to enhance route with elevation:', error);
            Utils.showLoading(false);
            
            // Return route without elevation enhancement
            return {
                ...route,
                elevationProfile: { totalAscent: 0, totalDescent: 0 },
                coloredSegments: [],
                terrainClassification: { level: 'unknown', difficulty: 0 },
                stats: {
                    distance: Utils.formatDistance(route.distance),
                    duration: Utils.formatTime(route.distance),
                    ascent: '0m',
                    descent: '0m',
                    maxElevation: '0m',
                    minElevation: '0m',
                    avgGradient: '0%',
                    maxGradient: '0%'
                }
            };
        }
    }

    // Generate route variations for better alternatives
    generateRouteVariations(basePreferences) {
        const variations = [];
        const baseDist = basePreferences.distance;

        // Distance variations (±20%)
        const distanceVariations = [
            baseDist * 0.8,
            baseDist * 0.9,
            baseDist,
            baseDist * 1.1,
            baseDist * 1.2
        ];

        // Bearing variations (different directions)
        const bearingVariations = [0, 45, 90, 135, 180, 225, 270, 315];

        distanceVariations.forEach(distance => {
            bearingVariations.forEach(bearing => {
                variations.push({
                    ...basePreferences,
                    distance,
                    preferredBearing: bearing,
                    variation: `${distance.toFixed(1)}km_${bearing}deg`
                });
            });
        });

        return variations.slice(0, 15); // Limit to 15 variations
    }

    // Cache route for future use
    cacheRoute(route, preferences) {
        const cacheKey = this.generateCacheKey(preferences);
        const cacheData = {
            route,
            preferences,
            timestamp: new Date().toISOString(),
            version: '1.0'
        };

        Utils.storage.set(`route_${cacheKey}`, cacheData);
    }

    // Get cached route
    getCachedRoute(preferences) {
        const cacheKey = this.generateCacheKey(preferences);
        const cached = Utils.storage.get(`route_${cacheKey}`);

        if (cached && cached.timestamp) {
            const cacheAge = Date.now() - new Date(cached.timestamp).getTime();
            const maxAge = 24 * 60 * 60 * 1000; // 24 hours

            if (cacheAge < maxAge) {
                return cached.route;
            }
        }

        return null;
    }

    // Generate cache key for preferences
    generateCacheKey(preferences) {
        const keyData = {
            lat: Math.round(preferences.startLat * 1000) / 1000,
            lon: Math.round(preferences.startLon * 1000) / 1000,
            distance: preferences.distance,
            type: preferences.routeType,
            terrain: preferences.terrain
        };

        return btoa(JSON.stringify(keyData)).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
    }

    // Clear route cache
    clearCache() {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('route_')) {
                keys.push(key);
            }
        }
        
        keys.forEach(key => localStorage.removeItem(key));
    }

    // Get route generation statistics
    getStats() {
        return {
            cacheSize: this.getCacheSize(),
            apiBaseUrl: this.apiBaseUrl,
            maxRetries: this.maxRetries
        };
    }

    // Get cache size
    getCacheSize() {
        let count = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('route_')) {
                count++;
            }
        }
        return count;
    }
}

// Create global instance
window.RouteGenerator = new RouteGenerator();