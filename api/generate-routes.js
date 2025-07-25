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
  
  const { coordinates, profile = 'foot-walking' } = req.body;
  
  if (!coordinates || !Array.isArray(coordinates)) {
    return res.status(400).json({ error: 'Invalid coordinates' });
  }
  
  try {
    const response = await fetch('https://api.openrouteservice.org/v2/directions/foot-walking', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTE_SERVICE_API_KEY}`
      },
      body: JSON.stringify({
        coordinates,
        profile,
        format: 'json',
        elevation: false
      })
    });
    
    if (!response.ok) {
      throw new Error(`OpenRouteService API error: ${response.status}`);
    }
    
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error('Route generation error:', error);
    res.status(500).json({ error: 'Failed to generate route' });
  }
}