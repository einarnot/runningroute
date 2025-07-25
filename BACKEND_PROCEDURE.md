# Backend Setup Procedure - Serverless Functions

## Strategy Decision: Vercel Serverless Functions

**Chosen Strategy**: Vercel Serverless Functions  
**Rationale**: 
- Zero server management
- Automatic scaling
- Free tier sufficient for development/personal use
- Easy deployment with git integration
- Built-in environment variable management
- Excellent performance for API proxy services

## What You Need to Do

### Step 1: Install Required Tools
```bash
# Install Vercel CLI globally
npm install -g vercel

# Install project dependencies (run in project root)
npm init -y
npm install --save-dev vercel
```

### Step 2: Create Project Structure
```bash
# Create API folder structure
mkdir -p api
mkdir -p config
```

### Step 3: Create API Endpoint Files

#### Create `api/generate-routes.js`
```javascript
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
```

#### Create `api/evaluate-routes.js`
```javascript
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
```

### Step 4: Create Vercel Configuration

#### Create `vercel.json`
```json
{
  "version": 2,
  "functions": {
    "api/**/*.js": {
      "runtime": "@vercel/node@18"
    }
  },
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/$1"
    }
  ]
}
```

### Step 5: Set Up Environment Variables

#### Create `.env.local` (for local development - DO NOT COMMIT)
```bash
OPENROUTE_SERVICE_API_KEY=your_openroute_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
```

#### Update `.gitignore`
```gitignore
# Environment variables
.env
.env.local
.env.production

# Vercel
.vercel
```

### Step 6: Deploy to Vercel

#### Option A: Deploy via CLI
```bash
# Login to Vercel (first time only)
vercel login

# Deploy project
vercel

# Set environment variables on Vercel
vercel env add OPENROUTE_SERVICE_API_KEY
vercel env add OPENAI_API_KEY

# Redeploy with environment variables
vercel --prod
```

#### Option B: Deploy via Git Integration
1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your GitHub repository
4. Add environment variables in Vercel dashboard:
   - Go to Project Settings → Environment Variables
   - Add `OPENROUTE_SERVICE_API_KEY`
   - Add `OPENAI_API_KEY`
5. Redeploy

### Step 7: Update Frontend Code

#### Update your JavaScript to use the new endpoints:
```javascript
// Replace direct API calls with your Vercel function calls
const VERCEL_API_BASE = 'https://your-project-name.vercel.app/api';

// Generate routes
async function generateRoute(coordinates) {
  const response = await fetch(`${VERCEL_API_BASE}/generate-routes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ coordinates })
  });
  
  if (!response.ok) {
    throw new Error('Failed to generate route');
  }
  
  return response.json();
}

// Evaluate routes with AI
async function evaluateRoutes(routes, preferences) {
  const response = await fetch(`${VERCEL_API_BASE}/evaluate-routes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ routes, preferences })
  });
  
  if (!response.ok) {
    throw new Error('Failed to evaluate routes');
  }
  
  return response.json();
}
```

### Step 8: Local Development

#### Run locally with Vercel CLI:
```bash
# Install dependencies
npm install

# Start local development server
vercel dev
```

Your API endpoints will be available at:
- `http://localhost:3000/api/generate-routes`
- `http://localhost:3000/api/evaluate-routes`

## Final Project Structure
```
v5/
├── api/
│   ├── generate-routes.js      # OpenRouteService proxy
│   └── evaluate-routes.js      # OpenAI proxy
├── js/
│   └── (your frontend files)
├── vercel.json                 # Vercel configuration
├── package.json               # Node.js dependencies
├── .env.local                 # Local environment variables (git-ignored)
├── .gitignore                 # Updated with Vercel/env exclusions
└── BACKEND_PROCEDURE.md       # This file
```

## Testing Your Setup

1. **Local Test**: Run `vercel dev` and test endpoints at `localhost:3000`
2. **Production Test**: Deploy and test your live Vercel URL
3. **Frontend Integration**: Update frontend to use your new API endpoints
4. **Monitor**: Check Vercel dashboard for function logs and performance

## Cost Considerations

**Vercel Free Tier Limits:**
- 100GB bandwidth/month
- 100 serverless function invocations/day
- 10 second function timeout

**Estimated Usage:**
- Route generation: ~10 API calls per user session
- AI evaluation: ~1 API call per route generation
- Should easily fit within free tier for personal/development use

## Troubleshooting

**Common Issues:**
1. **CORS Errors**: Ensure CORS headers are set in all API functions
2. **Environment Variables**: Double-check they're set in Vercel dashboard
3. **Function Timeout**: OpenAI calls may take time; monitor function duration
4. **API Rate Limits**: Implement request queuing if hitting limits

**Debug Commands:**
```bash
# Check deployment status
vercel ls

# View function logs
vercel logs

# Check environment variables
vercel env ls
```

This setup provides a secure, scalable backend that keeps your API keys safe while providing the functionality your route generator needs.