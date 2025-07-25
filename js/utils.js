// Utility functions for Route Generator v5

// Distance calculation utilities
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function toRadians(degrees) {
    return degrees * (Math.PI / 180);
}

function toDegrees(radians) {
    return radians * (180 / Math.PI);
}

// Calculate bearing between two points
function calculateBearing(lat1, lon1, lat2, lon2) {
    const dLon = toRadians(lon2 - lon1);
    const lat1Rad = toRadians(lat1);
    const lat2Rad = toRadians(lat2);
    
    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
              Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    
    const bearing = toDegrees(Math.atan2(y, x));
    return (bearing + 360) % 360; // Normalize to 0-360
}

// Calculate destination point given start point, bearing, and distance
function calculateDestination(lat, lon, bearing, distance) {
    const R = 6371; // Earth's radius in km
    const bearingRad = toRadians(bearing);
    const latRad = toRadians(lat);
    const lonRad = toRadians(lon);
    
    const latDestRad = Math.asin(
        Math.sin(latRad) * Math.cos(distance / R) +
        Math.cos(latRad) * Math.sin(distance / R) * Math.cos(bearingRad)
    );
    
    const lonDestRad = lonRad + Math.atan2(
        Math.sin(bearingRad) * Math.sin(distance / R) * Math.cos(latRad),
        Math.cos(distance / R) - Math.sin(latRad) * Math.sin(latDestRad)
    );
    
    return {
        lat: toDegrees(latDestRad),
        lon: toDegrees(lonDestRad)
    };
}

// Format distance for display
function formatDistance(distanceKm) {
    if (distanceKm < 1) {
        return `${Math.round(distanceKm * 1000)}m`;
    }
    return `${distanceKm.toFixed(1)}km`;
}

// Format elevation for display
function formatElevation(elevationM) {
    return `${Math.round(elevationM)}m`;
}

// Format time for display based on distance and pace
function formatTime(distanceKm, paceMinPerKm = 5) {
    const totalMinutes = Math.round(distanceKm * paceMinPerKm);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}

// Calculate gradient between two elevation points
function calculateGradient(elevation1, elevation2, distance) {
    if (distance === 0) return 0;
    const elevationChange = elevation2 - elevation1;
    return (elevationChange / (distance * 1000)) * 100; // Convert to percentage
}

// Determine route segment color based on gradient
function getRouteColor(gradient) {
    const absGradient = Math.abs(gradient);
    if (absGradient <= 3) return '#10b981'; // Green - flat
    if (absGradient <= 8) return '#f59e0b'; // Yellow - moderate
    return '#ef4444'; // Red - steep
}

// Generate random ID
function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

// Debounce function for input handling
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle function for scroll/resize events
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Check if coordinates are valid
function isValidCoordinate(lat, lon) {
    return !isNaN(lat) && !isNaN(lon) && 
           lat >= -90 && lat <= 90 && 
           lon >= -180 && lon <= 180;
}

// Local storage utilities
const storage = {
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.warn('localStorage not available:', e);
            return false;
        }
    },
    
    get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (e) {
            console.warn('localStorage read error:', e);
            return defaultValue;
        }
    },
    
    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            console.warn('localStorage remove error:', e);
            return false;
        }
    }
};

// Error handling utilities
function handleError(error, context = '') {
    console.error(`Error in ${context}:`, error);
    
    // Extract meaningful error message
    let message = 'An unexpected error occurred';
    if (error.message) {
        message = error.message;
    } else if (typeof error === 'string') {
        message = error;
    }
    
    return {
        message,
        context,
        timestamp: new Date().toISOString()
    };
}

// Show error modal
function showError(message, title = 'Error') {
    const modal = document.getElementById('errorModal');
    const messageEl = document.getElementById('errorMessage');
    const titleEl = modal.querySelector('.modal-header h3');
    
    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;
    if (modal) modal.style.display = 'flex';
}

// Show/hide loading overlay
function showLoading(show = true, text = 'Loading...', details = '') {
    const overlay = document.getElementById('loadingOverlay');
    const textEl = overlay?.querySelector('.loading-text');
    const detailsEl = document.getElementById('loadingDetails');
    
    if (overlay) {
        overlay.style.display = show ? 'flex' : 'none';
    }
    
    if (textEl && text) {
        textEl.textContent = text;
    }
    
    if (detailsEl && details) {
        detailsEl.textContent = details;
    }
}

// API call wrapper with error handling
async function apiCall(url, options = {}) {
    try {
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        return { success: true, data };
    } catch (error) {
        console.error('API call failed:', error);
        return { 
            success: false, 
            error: handleError(error, `API call to ${url}`) 
        };
    }
}

// DOM utilities
function createElement(tag, className = '', textContent = '') {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (textContent) element.textContent = textContent;
    return element;
}

function addEventListeners(elements, event, handler) {
    if (!Array.isArray(elements)) {
        elements = [elements];
    }
    
    elements.forEach(element => {
        if (element && typeof element.addEventListener === 'function') {
            element.addEventListener(event, handler);
        }
    });
}

// Mobile detection
function isMobile() {
    return window.innerWidth <= 768;
}

// Touch device detection
function isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

// Get cardinal direction from bearing
function getCardinalDirection(bearing) {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(bearing / 45) % 8;
    return directions[index];
}

// Pace conversion utilities
function decimalMinutesToMinSec(decimalMinutes) {
    const minutes = Math.floor(decimalMinutes);
    const seconds = Math.round((decimalMinutes - minutes) * 60);
    // Round to nearest 5-second interval
    const roundedSeconds = Math.round(seconds / 5) * 5;
    const finalSeconds = roundedSeconds === 60 ? 0 : roundedSeconds;
    const finalMinutes = roundedSeconds === 60 ? minutes + 1 : minutes;
    return `${finalMinutes}:${finalSeconds.toString().padStart(2, '0')}`;
}

function minSecToDecimalMinutes(minSecString) {
    // Handle both "4:30" and "4.5" formats for backward compatibility
    if (minSecString.includes(':')) {
        const [minutes, seconds] = minSecString.split(':').map(Number);
        return minutes + (seconds / 60);
    }
    return parseFloat(minSecString);
}

function formatPaceForDisplay(decimalMinutes) {
    return decimalMinutesToMinSec(decimalMinutes);
}

function roundPaceToInterval(decimalMinutes) {
    // Round to nearest 5-second interval
    const totalSeconds = decimalMinutes * 60;
    const roundedSeconds = Math.round(totalSeconds / 5) * 5;
    return roundedSeconds / 60;
}

// Export utilities for use in other modules
window.Utils = {
    calculateDistance,
    calculateBearing,
    calculateDestination,
    calculateGradient,
    getRouteColor,
    formatDistance,
    formatElevation,
    formatTime,
    generateId,
    debounce,
    throttle,
    isValidCoordinate,
    storage,
    handleError,
    showError,
    showLoading,
    apiCall,
    createElement,
    addEventListeners,
    isMobile,
    isTouchDevice,
    getCardinalDirection,
    toRadians,
    toDegrees,
    decimalMinutesToMinSec,
    minSecToDecimalMinutes,
    formatPaceForDisplay,
    roundPaceToInterval
};