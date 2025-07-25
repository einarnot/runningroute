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
          content: 'You are a running route expert. Evaluate routes based on distance accuracy, terrain preference, safety, and scenic value. Return a JSON object with route scores.'
        }, {
          role: 'user',
          content: `Evaluate these ${routes.length} routes for a runner with preferences: ${JSON.stringify(preferences)}. Routes: ${JSON.stringify(routes.map(r => ({
            distance: r.summary?.distance,
            duration: r.summary?.duration,
            ascent: r.summary?.ascent,
            descent: r.summary?.descent
          })))}. Return JSON with scores 0-100 for each route.`
        }],
        temperature: 0.3,
        max_tokens: 1000
      })
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const data = await response.json();
    const evaluation = JSON.parse(data.choices[0].message.content);
    
    res.status(200).json(evaluation);
  } catch (error) {
    console.error('Route evaluation error:', error);
    res.status(500).json({ error: 'Failed to evaluate routes' });
  }
}