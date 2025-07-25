// Script to analyze the elevation data from the sample JSON
const fs = require('fs');

// Read the sample data
const sampleData = JSON.parse(fs.readFileSync('sample-elevation-response.json', 'utf8'));

// Polyline decoder function (same as in script.js)
function decodePolyline(encoded, is3d = true) {
    const coordinates = [];
    let index = 0;
    let lat = 0;
    let lng = 0;
    let z = 0;

    while (index < encoded.length) {
        let b;
        let shift = 0;
        let result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        const dlat = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
        lat += dlat;

        shift = 0;
        result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        const dlng = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
        lng += dlng;

        if (is3d) {
            shift = 0;
            result = 0;
            do {
                b = encoded.charCodeAt(index++) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);
            const dz = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
            z += dz;
            
            coordinates.push([lat / 1e5, lng / 1e5, Math.round(z * 1e-2 * 10) / 10]);
        } else {
            coordinates.push([lat / 1e5, lng / 1e5]);
        }
    }

    return coordinates;
}

// Calculate distance using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Decode the route geometry
const route = sampleData.routes[0];
const coordinates = decodePolyline(route.geometry);

console.log('Route Analysis:');
console.log('Total points:', coordinates.length);
console.log('First few coordinates:');
for (let i = 0; i < Math.min(10, coordinates.length); i++) {
    console.log(`Point ${i}: [${coordinates[i][0].toFixed(6)}, ${coordinates[i][1].toFixed(6)}, ${coordinates[i][2]}m]`);
}

// Find elevation range
const elevations = coordinates.map(c => c[2]);
const minElevation = Math.min(...elevations);
const maxElevation = Math.max(...elevations);
console.log(`\nElevation range: ${minElevation}m to ${maxElevation}m`);

// Manual analysis of steepest sections
console.log('\nAnalyzing steepest sections manually:');
let steepestGrade = 0;
let steepestSection = null;

// Check every 10 points to find steep sections
for (let i = 0; i < coordinates.length - 10; i += 5) {
    const start = coordinates[i];
    const end = coordinates[i + 10];
    
    const distance = calculateDistance(start[0], start[1], end[0], end[1]);
    const elevationChange = end[2] - start[2];
    const grade = distance > 0 ? (elevationChange / distance) * 100 : 0;
    
    if (Math.abs(grade) > Math.abs(steepestGrade) && distance > 10) {
        steepestGrade = grade;
        steepestSection = {
            startIndex: i,
            endIndex: i + 10,
            start: start,
            end: end,
            distance: distance,
            elevationChange: elevationChange,
            grade: grade
        };
    }
}

console.log('\nSteepest section found:');
console.log('Grade:', steepestSection.grade.toFixed(2) + '%');
console.log('Distance:', steepestSection.distance.toFixed(1) + 'm');
console.log('Elevation change:', steepestSection.elevationChange.toFixed(1) + 'm');
console.log('Start point:', steepestSection.start);
console.log('End point:', steepestSection.end);

// Look for other steep sections with different segment sizes
console.log('\nChecking with different segment sizes:');
for (let segmentSize of [5, 15, 20, 30]) {
    let maxGradeForSize = 0;
    let sectionForSize = null;
    
    for (let i = 0; i < coordinates.length - segmentSize; i += Math.floor(segmentSize / 2)) {
        const start = coordinates[i];
        const end = coordinates[i + segmentSize];
        
        const distance = calculateDistance(start[0], start[1], end[0], end[1]);
        const elevationChange = end[2] - start[2];
        const grade = distance > 0 ? (elevationChange / distance) * 100 : 0;
        
        if (Math.abs(grade) > Math.abs(maxGradeForSize) && distance > 10) {
            maxGradeForSize = grade;
            sectionForSize = {
                distance: distance,
                elevationChange: elevationChange,
                grade: grade,
                startElevation: start[2],
                endElevation: end[2]
            };
        }
    }
    
    if (sectionForSize) {
        console.log(`Segment size ${segmentSize}: ${sectionForSize.grade.toFixed(2)}% grade (${sectionForSize.elevationChange.toFixed(1)}m over ${sectionForSize.distance.toFixed(1)}m)`);
    }
}
