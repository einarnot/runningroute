// Location service for GPS and address handling

class LocationService {
    constructor() {
        this.currentPosition = null;
        this.watchId = null;
        this.geoOptions = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000 // 5 minutes
        };
    }

    // Get current GPS location
    async getCurrentLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation is not supported by this browser'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.currentPosition = {
                        lat: position.coords.latitude,
                        lon: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        timestamp: new Date(position.timestamp)
                    };
                    resolve(this.currentPosition);
                },
                (error) => {
                    let message = 'Unable to get your location';
                    
                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            message = 'Location access denied. Please enable location services and try again.';
                            break;
                        case error.POSITION_UNAVAILABLE:
                            message = 'Location information is unavailable. Please check your GPS settings.';
                            break;
                        case error.TIMEOUT:
                            message = 'Location request timed out. Please try again.';
                            break;
                    }
                    
                    reject(new Error(message));
                },
                this.geoOptions
            );
        });
    }

    // Start watching position changes
    watchPosition(callback, errorCallback) {
        if (!navigator.geolocation) {
            errorCallback?.(new Error('Geolocation not supported'));
            return null;
        }

        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                this.currentPosition = {
                    lat: position.coords.latitude,
                    lon: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: new Date(position.timestamp)
                };
                callback(this.currentPosition);
            },
            (error) => {
                errorCallback?.(error);
            },
            this.geoOptions
        );

        return this.watchId;
    }

    // Stop watching position
    stopWatching() {
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
    }

    // Geocode address to coordinates using OpenStreetMap Nominatim
    async geocodeAddress(address) {
        if (!address || address.trim().length === 0) {
            throw new Error('Please enter a valid address');
        }

        const encodedAddress = encodeURIComponent(address.trim());
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=5&addressdetails=1`;

        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'RouteGenerator/1.0'
                }
            });

            if (!response.ok) {
                throw new Error(`Geocoding failed: ${response.statusText}`);
            }

            const results = await response.json();

            if (!results || results.length === 0) {
                throw new Error('No results found for this address. Please try a different search term.');
            }

            // Convert results to consistent format
            return results.map(result => ({
                lat: parseFloat(result.lat),
                lon: parseFloat(result.lon),
                displayName: result.display_name,
                address: {
                    house_number: result.address?.house_number,
                    road: result.address?.road,
                    city: result.address?.city || result.address?.town || result.address?.village,
                    state: result.address?.state,
                    country: result.address?.country,
                    postcode: result.address?.postcode
                },
                boundingBox: result.boundingbox ? {
                    minLat: parseFloat(result.boundingbox[0]),
                    maxLat: parseFloat(result.boundingbox[1]),
                    minLon: parseFloat(result.boundingbox[2]),
                    maxLon: parseFloat(result.boundingbox[3])
                } : null,
                type: result.type,
                importance: result.importance
            }));
        } catch (error) {
            console.error('Geocoding error:', error);
            throw new Error(`Unable to find location: ${error.message}`);
        }
    }

    // Reverse geocode coordinates to address
    async reverseGeocode(lat, lon) {
        if (!window.Utils.isValidCoordinate(lat, lon)) {
            throw new Error('Invalid coordinates provided');
        }

        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`;

        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'RouteGenerator/1.0'
                }
            });

            if (!response.ok) {
                throw new Error(`Reverse geocoding failed: ${response.statusText}`);
            }

            const result = await response.json();

            if (!result || result.error) {
                throw new Error('No address found for these coordinates');
            }

            return {
                lat: parseFloat(result.lat),
                lon: parseFloat(result.lon),
                displayName: result.display_name,
                address: {
                    house_number: result.address?.house_number,
                    road: result.address?.road,
                    city: result.address?.city || result.address?.town || result.address?.village,
                    state: result.address?.state,
                    country: result.address?.country,
                    postcode: result.address?.postcode
                }
            };
        } catch (error) {
            console.error('Reverse geocoding error:', error);
            throw new Error(`Unable to get address: ${error.message}`);
        }
    }

    // Get formatted address string
    formatAddress(addressData) {
        if (!addressData || !addressData.address) {
            return addressData?.displayName || 'Unknown location';
        }

        const addr = addressData.address;
        const parts = [];

        if (addr.house_number && addr.road) {
            parts.push(`${addr.house_number} ${addr.road}`);
        } else if (addr.road) {
            parts.push(addr.road);
        }

        if (addr.city) {
            parts.push(addr.city);
        }

        if (addr.state && addr.country) {
            parts.push(`${addr.state}, ${addr.country}`);
        } else if (addr.country) {
            parts.push(addr.country);
        }

        return parts.join(', ') || addressData.displayName || 'Unknown location';
    }

    // Check if location services are available
    isGeolocationAvailable() {
        return 'geolocation' in navigator;
    }

    // Check if location permission is granted
    async checkLocationPermission() {
        if (!navigator.permissions) {
            return 'unsupported';
        }

        try {
            const permission = await navigator.permissions.query({ name: 'geolocation' });
            return permission.state; // 'granted', 'denied', or 'prompt'
        } catch (error) {
            console.warn('Could not check location permission:', error);
            return 'unsupported';
        }
    }

    // Save recent locations to localStorage
    saveRecentLocation(location) {
        const recentLocations = this.getRecentLocations();
        
        // Check if location already exists
        const existing = recentLocations.find(loc => 
            Math.abs(loc.lat - location.lat) < 0.001 && 
            Math.abs(loc.lon - location.lon) < 0.001
        );

        if (!existing) {
            recentLocations.unshift({
                ...location,
                timestamp: new Date().toISOString()
            });

            // Keep only last 10 locations
            if (recentLocations.length > 10) {
                recentLocations.splice(10);
            }

            window.Utils.storage.set('recentLocations', recentLocations);
        }
    }

    // Get recent locations from localStorage
    getRecentLocations() {
        return window.Utils.storage.get('recentLocations', []);
    }

    // Clear recent locations
    clearRecentLocations() {
        window.Utils.storage.remove('recentLocations');
    }

    // Get user's preferred location (last used)
    getPreferredLocation() {
        return window.Utils.storage.get('preferredLocation', null);
    }

    // Save user's preferred location
    savePreferredLocation(location) {
        window.Utils.storage.set('preferredLocation', {
            ...location,
            timestamp: new Date().toISOString()
        });
    }

    // Calculate bounds for multiple locations
    calculateBounds(locations) {
        if (!locations || locations.length === 0) {
            return null;
        }

        let minLat = locations[0].lat;
        let maxLat = locations[0].lat;
        let minLon = locations[0].lon;
        let maxLon = locations[0].lon;

        locations.forEach(location => {
            minLat = Math.min(minLat, location.lat);
            maxLat = Math.max(maxLat, location.lat);
            minLon = Math.min(minLon, location.lon);
            maxLon = Math.max(maxLon, location.lon);
        });

        return {
            minLat,
            maxLat,
            minLon,
            maxLon,
            center: {
                lat: (minLat + maxLat) / 2,
                lon: (minLon + maxLon) / 2
            }
        };
    }

    // Validate coordinates are within reasonable bounds (roughly Earth)
    validateCoordinates(lat, lon) {
        return window.Utils.isValidCoordinate(lat, lon);
    }

    // Get distance from current location
    getDistanceFromCurrent(lat, lon) {
        if (!this.currentPosition || !window.Utils.isValidCoordinate(lat, lon)) {
            return null;
        }

        return window.Utils.calculateDistance(
            this.currentPosition.lat,
            this.currentPosition.lon,
            lat,
            lon
        );
    }

    // Cleanup method
    cleanup() {
        this.stopWatching();
        this.currentPosition = null;
    }
}

// Create global instance
window.LocationService = new LocationService();