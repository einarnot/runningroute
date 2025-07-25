// Enhanced polyline decoder with 3D elevation support
// Based on the improved decoder that handles x,y,z encoded polylines
var polyline = (function() {
    
    /**
     * Decode an x,y or x,y,z encoded polyline
     * @param {string} encodedPolyline - Encoded polyline string
     * @param {boolean} includeElevation - true for x,y,z polyline (default: true)
     * @returns {Array} Array of coordinates [lat, lng] or [lat, lng, elevation]
     */
    function decode(encodedPolyline, includeElevation = true) {
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
            
            // Decode latitude
            do {
                b = encodedPolyline.charAt(index++).charCodeAt(0) - 63 // finds ascii and subtract it by 63
                result |= (b & 0x1f) << shift
                shift += 5
            } while (b >= 0x20)

            lat += ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1))
            
            // Decode longitude
            shift = 0
            result = 0
            do {
                b = encodedPolyline.charAt(index++).charCodeAt(0) - 63
                result |= (b & 0x1f) << shift
                shift += 5
            } while (b >= 0x20)
            lng += ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1))

            // Decode elevation if requested
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
                console.log('Error decoding polyline point:', e)
            }
        }
        return points
    }

    /**
     * Encode an array of coordinates into a polyline string
     * @param {Array} coordinates - Array of [lat, lng] coordinates
     * @param {number} precision - Precision (default 5)
     * @returns {string} Encoded polyline string
     */
    function encode(coordinates, precision) {
        if (!coordinates.length) return '';

        var factor = Math.pow(10, precision || 5),
            output = _encode(coordinates[0][0], 0, factor) + _encode(coordinates[0][1], 0, factor);

        for (var i = 1; i < coordinates.length; i++) {
            var a = coordinates[i], b = coordinates[i - 1];
            output += _encode(a[0], b[0], factor);
            output += _encode(a[1], b[1], factor);
        }

        return output;
    }

    function _encode(current, previous, factor) {
        current = Math.round(current * factor);
        previous = Math.round(previous * factor);
        var coordinate = current - previous;
        coordinate <<= 1;
        if (current - previous < 0) {
            coordinate = ~coordinate;
        }
        var output = '';
        while (coordinate >= 0x20) {
            output += String.fromCharCode((0x20 | (coordinate & 0x1f)) + 63);
            coordinate >>= 5;
        }
        output += String.fromCharCode(coordinate + 63);
        return output;
    }

    return {
        decode: decode,
        encode: encode
    };

})();

// Make it available globally
if (typeof module !== 'undefined' && module.exports) {
    module.exports = polyline;
} else if (typeof window !== 'undefined') {
    window.polyline = polyline;
}