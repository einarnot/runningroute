// OpenRouteService integration for route generation
class RouteService {
    constructor() {
        this.baseUrl = CONFIG.ORS_BASE_URL;
        this.apiKey = CONFIG.ORS_API_KEY;
    }
    
    /**
     * Generate a route of specified distance and terrain preference
     * @param {Array} centerPoint - [lat, lng] starting point
     * @param {number} targetDistance - Desired distance in kilometers
     * @param {string} terrain - 'flat' or 'hilly'
     * @returns {Promise<Object>} Route data with elevation information
     */
    async generateRoute(centerPoint, targetDistance, terrain = 'flat') {
        try {
            // Generate waypoints for a loop route
            const waypoints = this.generateWaypoints(centerPoint, targetDistance, terrain);
            
            // Get route from OpenRouteService
            const routeData = await this.getRouteFromORS(waypoints, terrain);
            
            if (!routeData || !routeData.routes || routeData.routes.length === 0) {
                throw new Error('No route found');
            }
            
            // Process the route data
            return this.processRouteData(routeData.routes[0]);
            
        } catch (error) {
            console.error('Error generating route:', error);
            
            // If it's a "routable point" error, try with a more conservative approach
            if (error.message && error.message.includes('Could not find routable point')) {
                console.log('Retrying with more conservative waypoint generation...');
                try {
                    const conservativeWaypoints = this.generateConservativeWaypoints(centerPoint, targetDistance, terrain);
                    const routeData = await this.getRouteFromORS(conservativeWaypoints, terrain);
                    
                    if (routeData && routeData.routes && routeData.routes.length > 0) {
                        return this.processRouteData(routeData.routes[0]);
                    }
                } catch (retryError) {
                    console.error('Conservative retry also failed:', retryError);
                }
            }
            
            throw error;
        }
    }
    
    /**
     * Generate waypoints for a loop route based on distance and terrain
     * @param {Array} center - [lat, lng] center point
     * @param {number} targetDistance - Target distance in km
     * @param {string} terrain - Terrain preference
     * @returns {Array} Array of waypoints
     */
    generateWaypoints(center, targetDistance, terrain) {
        const waypoints = [center]; // Start point
        
        // For longer distances, use a more conservative approach
        // Adjust radius based on distance to prevent waypoints in unreachable areas
        let radiusKm;
        let numWaypoints;
        
        if (targetDistance <= 5) {
            radiusKm = targetDistance / (2 * Math.PI) * 1.0;
            numWaypoints = 3;
        } else if (targetDistance <= 15) {
            // For medium distances (5-15km), use more conservative radius
            radiusKm = targetDistance / (2 * Math.PI) * 0.8;
            numWaypoints = Math.min(4, Math.max(3, Math.floor(targetDistance / 4)));
        } else {
            // For very long distances (15km+), use much smaller radius relative to distance
            radiusKm = targetDistance / (2 * Math.PI) * 0.6;
            numWaypoints = Math.min(5, Math.max(4, Math.floor(targetDistance / 5)));
        }
        
        // Convert to degrees with more conservative conversion for longer distances
        let radiusDegrees = radiusKm / 111;
        
        // Generate waypoints with better distribution
        for (let i = 0; i < numWaypoints; i++) {
            const baseAngle = (2 * Math.PI * i) / numWaypoints;
            let validWaypoint = null;
            let attempts = 0;
            let currentRadius = radiusDegrees;
            
            while (!validWaypoint && attempts < CONFIG.MAX_WAYPOINT_ATTEMPTS) {
                // Use less randomness for longer distances to stay closer to roads
                const radiusVariation = targetDistance > 10 ? 0.15 : 0.3; // Less variation for long routes
                const angleVariation = targetDistance > 10 ? 0.2 : 0.4;   // Less angle variation for long routes
                
                const randomRadius = currentRadius * (1 - radiusVariation + Math.random() * radiusVariation * 2);
                const randomAngle = baseAngle + (Math.random() - 0.5) * angleVariation;
                
                const lat = center[0] + Math.cos(randomAngle) * randomRadius;
                const lng = center[1] + Math.sin(randomAngle) * randomRadius;
                
                // More strict validation for longer routes
                if (this.isValidWaypoint([lat, lng], center, radiusKm, targetDistance)) {
                    validWaypoint = [lat, lng];
                } else {
                    attempts++;
                    // Reduce radius more aggressively for failed attempts
                    currentRadius *= 0.8;
                }
            }
            
            // Enhanced fallback for longer routes - use much smaller radius
            if (!validWaypoint) {
                const fallbackRadius = radiusDegrees * (targetDistance > 10 ? 0.3 : 0.5);
                const lat = center[0] + Math.cos(baseAngle) * fallbackRadius;
                const lng = center[1] + Math.sin(baseAngle) * fallbackRadius;
                validWaypoint = [lat, lng];
                console.warn(`Using conservative fallback waypoint for ${targetDistance}km route: [${lat.toFixed(6)}, ${lng.toFixed(6)}]`);
            }
            
            waypoints.push(validWaypoint);
        }
        
        // Return to start to complete the loop
        waypoints.push(center);
        
        console.log(`Generated ${numWaypoints} waypoints for ${targetDistance}km route with ${radiusKm.toFixed(2)}km radius`);
        return waypoints;
    }
    
    /**
     * Generate very conservative waypoints for when normal generation fails
     * Uses much smaller radius and fewer waypoints to stay close to known routable areas
     * @param {Array} center - [lat, lng] center point
     * @param {number} targetDistance - Target distance in km
     * @param {string} terrain - Terrain preference
     * @returns {Array} Array of conservative waypoints
     */
    generateConservativeWaypoints(center, targetDistance, terrain) {
        const waypoints = [center];
        
        // Use very small radius for conservative approach
        const radiusKm = Math.min(2, targetDistance / 8); // Much smaller radius
        const radiusDegrees = radiusKm / 111;
        
        // Use only 3 waypoints in a simple triangle
        const angles = [0, 2.094, 4.189]; // 120 degrees apart (2π/3 radians)
        
        angles.forEach((angle, index) => {
            // Very minimal randomization
            const slight_randomRadius = radiusDegrees * (0.9 + Math.random() * 0.2); // 0.9 to 1.1
            const slight_randomAngle = angle + (Math.random() - 0.5) * 0.1; // ±0.05 radian variation
            
            const lat = center[0] + Math.cos(slight_randomAngle) * slight_randomRadius;
            const lng = center[1] + Math.sin(slight_randomAngle) * slight_randomRadius;
            
            waypoints.push([lat, lng]);
            console.log(`Conservative waypoint ${index + 1}: [${lat.toFixed(6)}, ${lng.toFixed(6)}] (${(this.calculateDistance(center, [lat, lng]) / 1000).toFixed(2)}km from center)`);
        });
        
        waypoints.push(center); // Return to start
        
        console.log(`Generated conservative waypoints with ${radiusKm.toFixed(2)}km radius for ${targetDistance}km target`);
        return waypoints;
    }
    
    /**
     * Basic validation to check if a waypoint is likely to be on land
     * @param {Array} waypoint - [lat, lng] to validate
     * @param {Array} center - [lat, lng] center point
     * @param {number} maxDistanceKm - Maximum distance from center
     * @param {number} targetDistance - Target route distance (for stricter validation on longer routes)
     * @returns {boolean} Whether the waypoint seems valid
     */
    isValidWaypoint(waypoint, center, maxDistanceKm, targetDistance = 5) {
        const [lat, lng] = waypoint;
        
        // Basic bounds checking
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            return false;
        }
        
        // Check if too far from center - stricter for longer routes
        const distance = this.calculateDistance(center, waypoint) / 1000; // Convert to km
        const maxAllowedDistance = targetDistance > 10 ? maxDistanceKm * 1.2 : maxDistanceKm * 1.5;
        
        if (distance > maxAllowedDistance) {
            return false;
        }
        
        // For longer routes, be more conservative about minimum distance
        // This prevents waypoints too close to center that might not create long enough segments
        if (targetDistance > 10) {
            const minDistance = maxDistanceKm * 0.3; // At least 30% of max radius
            if (distance < minDistance) {
                return false;
            }
        }
        
        // For very long routes (15km+), avoid waypoints that might be in remote areas
        if (targetDistance > 15) {
            // This is a basic heuristic - in a real implementation you might check
            // against known road networks or populated areas
            const remoteAreaCheck = Math.abs(lat % 0.01) < 0.001 && Math.abs(lng % 0.01) < 0.001;
            if (remoteAreaCheck) {
                return false; // Likely in a grid pattern that might be water or remote
            }
        }
        
        return true;
    }
    
    /**
     * Calculate distance between two points using Haversine formula
     * @param {Array} point1 - [lat, lng]
     * @param {Array} point2 - [lat, lng]
     * @returns {number} Distance in meters
     */
    calculateDistance(point1, point2) {
        const R = 6371000; // Earth's radius in meters
        const lat1Rad = point1[0] * Math.PI / 180;
        const lat2Rad = point2[0] * Math.PI / 180;
        const deltaLatRad = (point2[0] - point1[0]) * Math.PI / 180;
        const deltaLngRad = (point2[1] - point1[1]) * Math.PI / 180;
        
        const a = Math.sin(deltaLatRad/2) * Math.sin(deltaLatRad/2) +
                  Math.cos(lat1Rad) * Math.cos(lat2Rad) *
                  Math.sin(deltaLngRad/2) * Math.sin(deltaLngRad/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        
        return R * c;
    }
    
    /**
     * Get route from OpenRouteService API
     * @param {Array} waypoints - Array of [lat, lng] coordinates
     * @param {string} terrain - Terrain preference
     * @returns {Promise<Object>} Raw route data from API
     */
    async getRouteFromORS(waypoints, terrain) {
        // Convert waypoints to the format expected by ORS (lng, lat)
        const coordinates = waypoints.map(point => [point[1], point[0]]);
        
        const profile = 'foot-walking';
        
        // Request body matching the sample JSON structure
        const requestBody = {
            coordinates: coordinates,
            format: 'json',
            elevation: true,
            extra_info: ['steepness', 'surface'],
            options: {
                avoid_features: CONFIG.AVOID_FEATURES,
                avoid_borders: 'none'
            }
        };
        
        console.log('ORS Request:', {
            url: `${this.baseUrl}/directions/${profile}`,
            body: requestBody
        });
        
        const response = await fetch(`${this.baseUrl}/directions/${profile}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': this.apiKey,
                'Accept': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenRouteService API error: ${response.status} - ${errorText}`);
        }
        
        return await response.json();
    }
    
    /**
     * Process raw route data from ORS into our internal format
     * @param {Object} route - Raw route data from ORS
     * @returns {Object} Processed route data
     */
    processRouteData(route) {
        try {
            // Extract basic route information
            const summary = route.summary;
            const geometry = route.geometry;
            const bbox = route.bbox;
            const extras = route.extras || {};
            
            // Decode the polyline geometry
            let coordinates = [];
            if (geometry) {
                // ORS returns encoded polylines, but with elevation we need special handling
                coordinates = this.decodeORSGeometry(geometry, bbox);
            }
            
            // Process elevation data using our utility
            const elevationData = PolylineUtils.processRouteElevation(coordinates);
            
            // Generate kilometer markers
            const kmMarkers = PolylineUtils.generateKilometerMarkers(
                coordinates, 
                elevationData.totalDistance
            );
            
            // Process steepness information from extras
            const steepnessInfo = this.processORSSteepness(extras.steepness, coordinates);
            
            // Process surface information
            const surfaceInfo = this.processORSSurface(extras.surface);
            
            return {
                // Basic route info
                distance: summary.distance,
                duration: summary.duration,
                ascent: summary.ascent,
                descent: summary.descent,
                
                // Geometry and coordinates
                coordinates: coordinates,
                bbox: bbox,
                
                // Elevation analysis
                elevationData: elevationData,
                kmMarkers: kmMarkers,
                
                // Additional info from ORS
                steepnessInfo: steepnessInfo,
                surfaceInfo: surfaceInfo,
                
                // Original route data for reference
                originalRoute: route
            };
            
        } catch (error) {
            console.error('Error processing route data:', error);
            throw new Error('Failed to process route data');
        }
    }
    
    /**
     * Decode ORS geometry string with elevation data
     * @param {string} geometry - Encoded geometry string
     * @param {Array} bbox - Bounding box with elevation info
     * @returns {Array} Array of [lat, lng, elevation] coordinates
     */
    decodeORSGeometry(geometry, bbox) {
        try {
            // Use the improved 3D polyline decoder
            const decoded = PolylineUtils.decode3D(geometry, true);
            
            // If the decoded coordinates don't have proper elevation data,
            // we can fallback to using bbox elevation range
            if (decoded.length > 0 && (decoded[0][2] === undefined || decoded[0][2] === 0)) {
                console.log('Fallback: Using bbox elevation approximation');
                const minElevation = bbox[2] || 0;
                const maxElevation = bbox[5] || 100;
                
                return decoded.map((coord, index) => {
                    // Simple elevation interpolation based on position along route
                    const progress = index / (decoded.length - 1);
                    const elevationVariation = (maxElevation - minElevation) * Math.sin(progress * Math.PI * 2);
                    const elevation = minElevation + (maxElevation - minElevation) * 0.5 + elevationVariation * 0.3;
                    
                    return [coord[0], coord[1], elevation];
                });
            }
            
            return decoded;
            
        } catch (error) {
            console.error('Error decoding geometry:', error);
            return [];
        }
    }
    
    /**
     * Process steepness information from ORS extras
     * @param {Object} steepnessData - Steepness data from ORS
     * @param {Array} coordinates - Route coordinates
     * @returns {Object} Processed steepness information
     */
    processORSSteepness(steepnessData, coordinates) {
        if (!steepnessData || !steepnessData.values) {
            return { segments: [], summary: [] };
        }
        
        const segments = steepnessData.values.map(segment => {
            const [startIdx, endIdx, steepnessValue] = segment;
            
            return {
                startIndex: startIdx,
                endIndex: endIdx,
                steepnessValue: steepnessValue,
                startCoord: coordinates[startIdx],
                endCoord: coordinates[endIdx],
                color: PolylineUtils.getElevationColor(steepnessValue)
            };
        });
        
        return {
            segments: segments,
            summary: steepnessData.summary || []
        };
    }
    
    /**
     * Process surface information from ORS extras
     * @param {Object} surfaceData - Surface data from ORS
     * @returns {Object} Processed surface information
     */
    processORSSurface(surfaceData) {
        if (!surfaceData) {
            return { segments: [], summary: [] };
        }
        
        return {
            segments: surfaceData.values || [],
            summary: surfaceData.summary || []
        };
    }
    
    /**
     * Get current user location
     * @returns {Promise<Array>} [lat, lng] coordinates
     */
    async getCurrentLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation is not supported'));
                return;
            }
            
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve([position.coords.latitude, position.coords.longitude]);
                },
                (error) => {
                    console.error('Geolocation error:', error);
                    // Fallback to default location
                    resolve(CONFIG.DEFAULT_CENTER);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 300000 // 5 minutes
                }
            );
        });
    }
}