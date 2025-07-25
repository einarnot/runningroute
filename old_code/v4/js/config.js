// Configuration constants
const CONFIG = {
    // OpenRouteService API configuration
    ORS_API_KEY: 'YOUR_OPENROUTE_SERVICE_API_KEY',
    ORS_BASE_URL: 'https://api.openrouteservice.org/v2',
    
    // Map configuration
    DEFAULT_CENTER: [63.4738, 11.1197], // Trondheim, Norway
    DEFAULT_ZOOM: 13,
    
    // Route generation settings
    MAX_DISTANCE: 50000, // 50km in meters
    MIN_DISTANCE: 1000,  // 1km in meters
    DEFAULT_DISTANCE: 5000, // 5km in meters
    
    // Map tile configuration
    TILE_URL: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    TILE_ATTRIBUTION: '© OpenStreetMap contributors'
};