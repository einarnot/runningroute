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
    pace = 5,
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
    const routes = await generateRouteAlternatives(lat, lon, distance, routeType, terrain, alternatives, pace);
    
    console.log(`Generated ${routes?.length || 0} route alternatives with pace ${pace}min/km`);
    
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
async function generateRouteAlternatives(startLat, startLon, distance, routeType, terrain, alternatives, pace = 5) {
  const routes = [];
  const maxRetries = 3;
  const distanceAdjustments = new Map(); // Track distance adjustments for each bearing
  
  // Generate different route variations
  const bearings = [0, 45, 90, 135, 180, 225, 270, 315]; // 8 directions
  const distanceVariations = [0.9, 1.0, 1.1]; // ±10% distance variation
  
  for (let i = 0; i < Math.min(alternatives, bearings.length * distanceVariations.length); i++) {
    const bearing = bearings[i % bearings.length];
    const distanceMultiplier = distanceVariations[Math.floor(i / bearings.length) % distanceVariations.length];
    let adjustedDistance = distance * distanceMultiplier;
    
    // Apply learned distance adjustments for this bearing
    const bearingKey = Math.round(bearing / 45) * 45; // Group similar bearings
    if (distanceAdjustments.has(bearingKey)) {
      const adjustment = distanceAdjustments.get(bearingKey);
      adjustedDistance *= adjustment;
      console.log(`Applying learned adjustment for bearing ${bearing}°: ${adjustment.toFixed(3)}x`);
    }
    
    try {
      const route = await generateSingleRoute(startLat, startLon, adjustedDistance, routeType, bearing);
      if (route) {
        // Calculate the distance error and learn from it
        const actualDistance = route.distance;
        const targetDistance = distance * distanceMultiplier;
        const distanceError = actualDistance / targetDistance;
        
        // Update distance adjustment for this bearing
        let newAdjustment;
        if (distanceAdjustments.has(bearingKey)) {
          // Exponential moving average for smoother learning
          const currentAdjustment = distanceAdjustments.get(bearingKey);
          const correctionFactor = 1 / distanceError;
          newAdjustment = currentAdjustment * 0.7 + correctionFactor * 0.3;
        } else {
          // First time for this bearing, use inverse of error
          newAdjustment = 1 / distanceError;
        }
        
        // Limit adjustment to reasonable bounds (0.5x to 2.0x)
        newAdjustment = Math.max(0.5, Math.min(2.0, newAdjustment));
        distanceAdjustments.set(bearingKey, newAdjustment);
        
        console.log(`Route ${i}: target=${targetDistance.toFixed(1)}km, actual=${actualDistance.toFixed(1)}km, error=${distanceError.toFixed(3)}, new_adj=${newAdjustment.toFixed(3)}`);
        
        // Calculate duration based on user's pace
        route.duration = Math.round(route.distance * pace);
        route.pace = pace;
        route.routeType = routeType; // Add route type to the route object
        routes.push({
          id: `route_${i}`,
          ...route,
          bearing,
          distanceMultiplier,
          targetDistance: targetDistance,
          distanceAccuracy: Math.abs(1 - distanceError) // How close we got (0 = perfect, 1 = 100% off)
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
  let coordinates = [];
  
  if (routeType === 'loop') {
    // Generate loop route coordinates (ORS expects [lng, lat] format)
    coordinates.push([startLon, startLat]); // Start point
    
    // Create waypoints for a roughly circular route
    // Adjust waypoint distances based on target route distance
    const numWaypoints = 4;
    const baseRadius = distance / (2 * Math.PI); // Theoretical radius for circular route
    const radiusMultiplier = 1.2; // Adjust for road network reality
    const effectiveRadius = baseRadius * radiusMultiplier;
    
    for (let i = 0; i < numWaypoints; i++) {
      const angle = (preferredBearing + (360 / numWaypoints) * i) * (Math.PI / 180);
      // Use more consistent waypoint distances for better distance control
      const waypointDistance = effectiveRadius * (0.8 + Math.random() * 0.4); // Less variation for better control
      
      const lat = startLat + (waypointDistance / 111.32) * Math.cos(angle);
      const lon = startLon + (waypointDistance / (111.32 * Math.cos(startLat * Math.PI / 180))) * Math.sin(angle);
      
      coordinates.push([lon, lat]); // [lng, lat] format for ORS
    }
    
    coordinates.push([startLon, startLat]); // Return to start
  } else {
    // Generate out-and-back route with better distance estimation
    const angle = preferredBearing * (Math.PI / 180);
    // For out-and-back, the actual route distance is usually longer than straight-line distance
    // Use a more conservative estimate that accounts for road network
    const straightLineDistance = distance / 2.4; // More conservative factor for road routing
    
    coordinates.push([startLon, startLat]); // Start point
    
    // Add intermediate waypoint to create more interesting route
    const intermediateDistance = straightLineDistance * 0.7;
    const intermediateLat = startLat + (intermediateDistance / 111.32) * Math.cos(angle);
    const intermediateLon = startLon + (intermediateDistance / (111.32 * Math.cos(startLat * Math.PI / 180))) * Math.sin(angle);
    coordinates.push([intermediateLon, intermediateLat]);
    
    // Destination point
    const destLat = startLat + (straightLineDistance / 111.32) * Math.cos(angle);
    const destLon = startLon + (straightLineDistance / (111.32 * Math.cos(startLat * Math.PI / 180))) * Math.sin(angle);
    
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
      instructions: false,
      options: {
        avoid_features: ['ferries']
      }
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