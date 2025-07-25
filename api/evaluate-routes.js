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
  
  const { routes, preferences } = req.body;
  
  if (!routes || !Array.isArray(routes) || !preferences) {
    return res.status(400).json({ error: 'Invalid request data' });
  }
  
  try {
    // Try AI evaluation first, but fallback to local scoring
    let evaluations;
    let usedAI = false;
    
    try {
      evaluations = await evaluateWithAI(routes, preferences);
      usedAI = true;
    } catch (aiError) {
      console.log('AI evaluation failed, using fallback scoring:', aiError.message);
      evaluations = evaluateWithFallback(routes, preferences);
      usedAI = false;
    }
    
    res.status(200).json({ 
      evaluations, 
      usedAI 
    });
  } catch (error) {
    console.error('Route evaluation error:', error);
    
    // Last resort fallback
    const fallbackEvaluations = evaluateWithFallback(routes, preferences);
    res.status(200).json({ 
      evaluations: fallbackEvaluations, 
      usedAI: false 
    });
  }
}

// AI-based evaluation with proper JSON parsing
async function evaluateWithAI(routes, preferences) {
  console.log(`Evaluating ${routes.length} routes with AI:`, routes.map(r => ({ id: r.id, distance: r.distance })));
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [{
        role: 'system',
        content: `You are a running route expert. Evaluate ALL routes provided and return ONLY a valid JSON array with one evaluation object for each route in this exact format:
[{"routeId": 0, "score": 0.85, "reasoning": "Good distance match", "criteria": {"distanceAccuracy": 0.9, "terrainMatch": 0.8, "safetyScore": 0.7, "scenicValue": 0.6, "navigationEase": 0.8}}, {"routeId": 1, "score": 0.72, "reasoning": "Different route", "criteria": {"distanceAccuracy": 0.8, "terrainMatch": 0.7, "safetyScore": 0.6, "scenicValue": 0.7, "navigationEase": 0.9}}]
IMPORTANT: Return exactly ${routes.length} evaluation objects, one for each route. Do not use markdown formatting or code blocks. Return only the JSON array. When terrain is set to flat, prioritize low elevation. When terrain is set to hilly, prefer routes with high elevation gain, to the point where elevation is more important than distance desire.`
      }, {
        role: 'user',
        content: `Evaluate these ${routes.length} routes for preferences: distance=${preferences.desiredDistance}km, pace=${preferences.pace}min/km, type=${preferences.routeType}, terrain=${preferences.terrain}
        
Routes data: ${JSON.stringify(routes.map((r, i) => ({
  id: i,
  distance: r.distance,
  ascent: r.ascent,
  descent: r.descent,
  duration: r.duration,
  estimatedDuration: Math.round(r.distance * (preferences.pace || 5))
})))}

Return scores 0-1.0 and criteria scores 0-1.0 for each route. Consider pace preferences when evaluating duration suitability.`
      }],
      temperature: 0.1,
      max_tokens: 2000
    })
  });
  
  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Rate limit exceeded');
    }
    throw new Error(`OpenAI API error: ${response.status}`);
  }
  
  const data = await response.json();
  let content = data.choices[0].message.content.trim();
  
  console.log('Raw AI response:', content);
  
  // Clean up markdown formatting if present
  content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  
  console.log('Cleaned AI response:', content);
  
  try {
    const parsed = JSON.parse(content);
    console.log('Parsed AI evaluations:', parsed);
    return parsed;
  } catch (parseError) {
    console.error('Failed to parse AI response:', content);
    throw new Error('Invalid AI response format');
  }
}

// Fallback scoring algorithm that doesn't require external APIs
function evaluateWithFallback(routes, preferences) {
  console.log(`Evaluating ${routes.length} routes with fallback method`);
  const evaluations = [];
  
  routes.forEach((route, index) => {
    // Calculate duration based on user's pace (min/km)
    const userPace = preferences.pace || 5; // Default to 5 min/km if not provided
    const estimatedDuration = route.distance * userPace; // in minutes
    
    // Update route with calculated duration
    route.duration = Math.round(estimatedDuration);
    
    // Distance accuracy scoring (0-1)
    const targetDistance = preferences.desiredDistance || 5;
    const distanceError = Math.abs(route.distance - targetDistance) / targetDistance;
    const distanceAccuracy = Math.max(0, 1 - distanceError * 2); // Penalty for >50% error
    
    // Terrain matching scoring (0-1)
    let terrainMatch = 0.5; // Default neutral score
    const ascentPerKm = route.distance > 0 ? (route.ascent || 0) / route.distance : 0;
    
    if (preferences.terrain === 'flat') {
      // Prefer routes with less than 30m ascent per km
      terrainMatch = ascentPerKm < 30 ? 0.9 : Math.max(0.2, 0.9 - (ascentPerKm - 30) / 50);
    } else if (preferences.terrain === 'hilly') {
      // Prefer routes with 50-100m ascent per km
      if (ascentPerKm >= 50 && ascentPerKm <= 100) {
        terrainMatch = 0.9;
      } else if (ascentPerKm < 50) {
        terrainMatch = 0.4 + (ascentPerKm / 50) * 0.4; // Scale up to 0.8
      } else {
        terrainMatch = Math.max(0.3, 0.9 - (ascentPerKm - 100) / 100);
      }
    }
    
    // Safety score (basic heuristic)
    let safetyScore = 0.7; // Default moderate safety
    
    // Route type preference
    let routeTypeScore = 0.8; // Default good score
    
    // Scenic value (basic heuristic based on route complexity)
    const routeComplexity = route.coordinates ? route.coordinates.length / route.distance : 50;
    const scenicValue = Math.min(0.9, 0.4 + routeComplexity / 200);
    
    // Navigation ease (simpler routes are easier to follow)
    const navigationEase = Math.max(0.3, 0.9 - routeComplexity / 300);
    
    // Calculate overall score (weighted average)
    const weights = {
      distanceAccuracy: 0.30,
      terrainMatch: 0.25,
      safetyScore: 0.20,
      scenicValue: 0.15,
      navigationEase: 0.10
    };
    
    const weightedScore = 
      distanceAccuracy * weights.distanceAccuracy +
      terrainMatch * weights.terrainMatch +
      safetyScore * weights.safetyScore +
      scenicValue * weights.scenicValue +
      navigationEase * weights.navigationEase;
    
    // Keep score in 0-1 scale as expected by frontend
    const finalScore = Math.round(weightedScore * 100) / 100;
    
    // Generate reasoning
    let reasoning = `Distance: ${route.distance.toFixed(1)}km (target: ${targetDistance}km), Duration: ${estimatedDuration.toFixed(0)}min at ${userPace}min/km pace`;
    if (distanceAccuracy > 0.8) reasoning += ', excellent match';
    else if (distanceAccuracy > 0.6) reasoning += ', good match';
    else reasoning += ', distance deviation';
    
    if (preferences.terrain === 'flat' && ascentPerKm < 30) {
      reasoning += ', flat terrain as requested';
    } else if (preferences.terrain === 'hilly' && ascentPerKm > 50) {
      reasoning += ', hilly terrain as requested';
    }
    
    evaluations.push({
      routeId: route.id || index,
      score: finalScore,
      reasoning: reasoning,
      criteria: {
        distanceAccuracy: Math.round(distanceAccuracy * 100) / 100,
        terrainMatch: Math.round(terrainMatch * 100) / 100,
        safetyScore: Math.round(safetyScore * 100) / 100,
        scenicValue: Math.round(scenicValue * 100) / 100,
        navigationEase: Math.round(navigationEase * 100) / 100
      }
    });
  });
  
  console.log(`Fallback evaluation completed: ${evaluations.length} evaluations created`);
  return evaluations;
}