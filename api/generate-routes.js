export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { 
    startLat, 
    startLon, 
    startAddress,
    distance, 
    routeType, 
    terrain, 
    alternatives = 5 
  } = req.body;
  
  // Validate required parameters
  if ((!startLat || !startLon) && !startAddress) {
    return res.status(400).json({ error: 'Starting location (coordinates or address) is required' });
  }
  
  if (!distance || distance < 0.5 || distance > 50) {
    return res.status(400).json({ error: 'Distance must be between 0.5 and 50 kilometers' });
  }

  try {
    let lat = startLat;
    let lon = startLon;

    // Geocode address if coordinates not provided
    if (!lat || !lon) {
      if (!startAddress) {
        return res.status(400).json({ error: 'Either coordinates or address must be provided' });
      }
      
      // Use Nominatim for geocoding
      const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(startAddress)}&limit=1`;
      const geocodeResponse = await fetch(geocodeUrl, {
        headers: { 'User-Agent': 'RouteGenerator/1.0' }
      });
      
      if (!geocodeResponse.ok) {
        throw new Error('Failed to geocode address');
      }
      
      const geocodeData = await geocodeResponse.json();
      if (!geocodeData || geocodeData.length === 0) {
        return res.status(400).json({ error: 'Address not found' });
      }
      
      lat = parseFloat(geocodeData[0].lat);
      lon = parseFloat(geocodeData[0].lon);
    }

    // Generate route alternatives
    const routes = await generateRouteAlternatives(lat, lon, distance, routeType, terrain, alternatives);
    
    if (!routes || routes.length === 0) {
      return res.status(404).json({ error: 'No routes could be generated for the given parameters' });
    }

    res.status(200).json({ routes });
  } catch (error) {
    console.error('Route generation error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate route' });
  }
}

// Helper function to generate route alternatives
async function generateRouteAlternatives(startLat, startLon, distance, routeType, terrain, alternatives) {
  const routes = [];
  const maxRetries = 3;
  
  // Generate different route variations
  const bearings = [0, 45, 90, 135, 180, 225, 270, 315]; // 8 directions
  const distanceVariations = [0.9, 1.0, 1.1]; // ±10% distance variation
  
  for (let i = 0; i < Math.min(alternatives, bearings.length * distanceVariations.length); i++) {
    const bearing = bearings[i % bearings.length];
    const distanceMultiplier = distanceVariations[Math.floor(i / bearings.length) % distanceVariations.length];
    const adjustedDistance = distance * distanceMultiplier;
    
    try {
      const route = await generateSingleRoute(startLat, startLon, adjustedDistance, routeType, bearing);
      if (route) {
        routes.push({
          id: `route_${i}`,
          ...route,
          bearing,
          distanceMultiplier
        });
      }
    } catch (error) {
      console.warn(`Failed to generate route ${i}:`, error.message);
      continue; // Try next route
    }
  }
  
  return routes;
}

// Helper function to generate a single route
async function generateSingleRoute(startLat, startLon, distance, routeType, preferredBearing) {
  const radiusKm = distance / 2;
  const coordinates = [];
  
  if (routeType === 'loop') {
    // Generate loop route coordinates (ORS expects [lng, lat] format)
    coordinates.push([startLon, startLat]); // Start point
    
    // Create waypoints for a roughly circular route
    const numWaypoints = 4;
    for (let i = 0; i < numWaypoints; i++) {
      const angle = (preferredBearing + (360 / numWaypoints) * i) * (Math.PI / 180);
      const waypointDistance = radiusKm * (0.7 + Math.random() * 0.6); // Vary distance for more natural routes
      
      const lat = startLat + (waypointDistance / 111.32) * Math.cos(angle);
      const lon = startLon + (waypointDistance / (111.32 * Math.cos(startLat * Math.PI / 180))) * Math.sin(angle);
      
      coordinates.push([lon, lat]); // [lng, lat] format for ORS
    }
    
    coordinates.push([startLon, startLat]); // Return to start
  } else {
    // Generate out-and-back route
    const angle = preferredBearing * (Math.PI / 180);
    const halfDistance = distance / 2;
    
    coordinates.push([startLon, startLat]); // Start point
    
    // Destination point
    const destLat = startLat + (halfDistance / 111.32) * Math.cos(angle);
    const destLon = startLon + (halfDistance / (111.32 * Math.cos(startLat * Math.PI / 180))) * Math.sin(angle);
    
    coordinates.push([destLon, destLat]); // Destination ([lng, lat] format)
    coordinates.push([startLon, startLat]); // Return to start
  }
  
  // Call OpenRouteService API
  const response = await fetch('https://api.openrouteservice.org/v2/directions/foot-walking', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTE_SERVICE_API_KEY}`
    },
    body: JSON.stringify({
      coordinates,
      format: 'json',
      elevation: true,
      extra_info: ['steepness'],
      instructions: false
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouteService API error (${response.status}): ${errorText}`);
  }
  
  const data = await response.json();
  
  if (!data.routes || data.routes.length === 0) {
    throw new Error('No route returned from OpenRouteService');
  }
  
  const route = data.routes[0];
  const summary = route.summary || {};
  
  return {
    coordinates: decodePolyline(route.geometry),
    distance: summary.distance ? summary.distance / 1000 : distance, // Convert to km
    duration: summary.duration || 0,
    ascent: summary.ascent || 0,
    descent: summary.descent || 0,
    segments: route.segments || [],
    bbox: data.bbox || null
  };
}

// Polyline decoder with elevation support (based on ORS format)
function decodePolyline(encoded, precision = 5) {
  if (!encoded) return [];
  
  const coordinates = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  let ele = 0;
  const factor = Math.pow(10, precision);
  const elevationFactor = Math.pow(10, 2); // ORS uses precision 2 for elevation

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

    // Decode elevation (if available)
    if (index < encoded.length) {
      shift = 0;
      result = 0;
      
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20 && index < encoded.length);
      
      const deltaEle = ((result & 1) ? ~(result >> 1) : (result >> 1));
      ele += deltaEle;
      
      coordinates.push([lat / factor, lng / factor, ele / elevationFactor]);
    } else {
      // No elevation data available
      coordinates.push([lat / factor, lng / factor, 0]);
    }
  }

  return coordinates;
}