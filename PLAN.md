# AI-Powered Running Route Generator v5 - Project Plan

## Overview
Build an intelligent web application that generates optimized running routes using AI to evaluate multiple route alternatives from OpenRouteService. The app will present the best route based on user preferences and route quality analysis.

## Core Features

### User Input Parameters
- **Distance**: Slider from 0-50km with precise input
- **Route Type**: 
  - Loop (circular route)
  - Out & Back (turnaround route)
- **Terrain Preference**:
  - Flat (minimal elevation changes)
  - Hilly (varied elevation with climbs)
- **Starting Location**: 
  - Auto-detect user location
  - Manual address/landmark input
  - Map click selection

### AI-Powered Route Generation
1. **Multiple Route Generation**: Generate 10+ route alternatives using OpenRouteService API
2. **AI Evaluation**: Use AI to analyze and score routes based on:
   - Distance accuracy to user preference
   - Elevation profile matching terrain preference
   - Route safety (avoiding busy roads where possible)
   - Scenic value and running appeal
   - Route complexity and navigation ease
3. **Route Selection Interface**: Present all routes sorted by AI/evaluation score with selection UI

### Route Visualization & Selection
- **Interactive Map**: Leaflet-based map with route overlay
- **Route Alternatives Panel**: 
  - Display all generated routes sorted by score (highest first)
  - Show route preview cards with key stats (distance, elevation, score)
  - Allow user to click/select any route alternative
  - Highlight selected route on map
  - Show detailed route information for selected route
- **Elevation Coloring**: Color-coded route segments based on gradient
  - Green: Flat (0-3% grade)
  - Yellow: Moderate (3-8% grade)  
  - Red: Steep (8%+ grade)
- **Elevation Markers**: Start, turnaround, and key elevation points
- **Route Information**: Distance, elevation gain/loss, estimated time, AI score/reasoning

## Technical Architecture

### Frontend Framework
- **Vanilla JavaScript** (following existing codebase pattern)
- **Leaflet.js** for interactive mapping
- **Responsive Design** with mobile-first approach
- **Progressive Web App** capabilities

### API Integrations
1. **OpenRouteService API**
   - Route generation with walking/running profile
   - 3D polyline decoding (includes elevation data)
   - Multiple route alternatives generation
2. **Elevation API** (Open-Meteo)
   - Detailed elevation data for route coloring
   - Gradient calculation for route segments
3. **AI Service** (OpenAI/Anthropic)
   - Route evaluation and scoring
   - Natural language route descriptions

### Core Components

#### 1. Route Generator Engine (`routeGenerator.js`)
- Generate multiple route alternatives using different parameters
- Coordinate calculation for various route types
- Distance and bearing calculations
- Route validation and filtering

#### 2. AI Route Evaluator (`aiEvaluator.js`)
- Evaluate route alternatives against user preferences
- Score routes on multiple criteria:
  - Distance accuracy (±10% tolerance)
  - Elevation profile matching
  - Safety considerations
  - Scenic/running appeal
- Return ranked route recommendations

#### 3. Polyline Decoder (`polylineDecoder.js`)
- Decode 3D polylines from OpenRouteService
- Handle elevation data extraction
- Convert to coordinate arrays for mapping

#### 4. Map Controller (`mapController.js`)
- Initialize Leaflet map
- Display routes with elevation coloring
- Handle user interactions (location selection)
- Manage route overlays and markers
- **NEW**: Support switching between multiple route visualizations
- **NEW**: Highlight selected route vs alternatives

#### 5. Elevation Service (`elevationService.js`)
- Sample routes at regular intervals (50m)
- Fetch elevation data for route points
- Calculate gradients and steepness
- Generate color coding for route segments

### Route Generation Algorithm

#### Multiple Route Generation Strategy
1. **Base Route Generation**: Create initial route using user parameters
2. **Alternative Generation**: 
   - Vary destination bearings (8 cardinal directions)
   - Adjust route parameters (±20% distance tolerance)
   - Try different routing profiles if available
3. **Route Validation**: Filter out invalid or poor-quality routes
4. **AI Evaluation**: Score all valid routes using AI analysis

#### AI Evaluation Criteria
```javascript
const evaluationCriteria = {
  distanceAccuracy: 0.25,    // 25% weight - how close to desired distance
  terrainMatch: 0.30,        // 30% weight - matches flat/hilly preference  
  safetyScore: 0.20,         // 20% weight - avoids dangerous areas
  scenicValue: 0.15,         // 15% weight - parks, waterfronts, etc.
  navigationEase: 0.10       // 10% weight - simple to follow
};
```

#### 6. Route Selection UI (`routeSelector.js`) - NEW COMPONENT
- Display route alternatives panel with preview cards
- Sort routes by AI/evaluation score (highest first)
- Show route summary stats (distance, elevation, score) for each alternative
- Handle route selection and switching
- Update map display when user selects different route
- Provide visual feedback for selected vs available routes

### Data Flow
1. User inputs preferences → Frontend validation
2. Generate 10+ route alternatives → OpenRouteService API
3. Evaluate routes with AI → AI Service API
4. **NEW**: Display all routes sorted by score → Route selection UI
5. **NEW**: User selects preferred route → Update map and info panel
7. Color-code route segments → Render final route

## Implementation Plan

### Phase 1: Core Infrastructure
- [ ] Set up project structure and build system
- [ ] Configure secure API key management system
- [ ] Implement OpenRouteService integration
- [ ] Create polyline decoder for 3D routes
- [ ] Build basic map interface with Leaflet

### Phase 2: Route Generation
- [ ] Implement multiple route generation logic
- [ ] Create route validation and filtering
- [ ] Add distance and coordinate calculations
- [ ] Test route generation with various parameters

### Phase 3: AI Integration
- [ ] Set up AI service integration (OpenAI/Anthropic)
- [ ] Implement route evaluation logic
- [ ] Create scoring system for route alternatives
- [ ] Test AI route selection accuracy

### Phase 4: Enhanced Visualization
- [ ] Implement elevation data fetching
- [ ] Create route coloring based on gradients
- [ ] Add elevation markers and route information
- [ ] Build responsive UI matching design mockups
- [ ] **NEW**: Create route alternatives selection panel
- [ ] **NEW**: Implement route preview cards with stats
- [ ] **NEW**: Add route switching functionality in UI
- [ ] **NEW**: Sort and display all routes by AI/evaluation score

### Phase 5: User Experience
- [ ] Add location detection and address search
- [ ] Implement route saving and favorites
- [ ] Create route sharing functionality
- [ ] Add offline PWA capabilities

### Phase 6: Testing & Optimization
- [ ] Comprehensive testing of route generation
- [ ] Performance optimization for mobile devices
- [ ] Error handling and edge cases
- [ ] User acceptance testing

## File Structure
```
v5/
├── index.html                 # Main HTML file
├── styles/
│   ├── main.css              # Main styles
│   ├── mobile.css            # Mobile responsive styles
│   └── components.css        # Component-specific styles
├── js/
│   ├── app.js                # Main application controller
│   ├── routeGenerator.js     # Route generation engine
│   ├── aiEvaluator.js        # AI route evaluation
│   ├── mapController.js      # Map interaction handling
│   ├── elevationService.js   # Elevation data management
│   ├── polylineDecoder.js    # 3D polyline decoding
│   ├── locationService.js    # GPS and address handling
│   └── utils.js              # Utility functions
├── config/
│   ├── api-keys.js           # API configuration
│   └── settings.js           # App configuration
└── PLAN.md                   # This file
```

## API Requirements

### OpenRouteService
- API Key: Required for route generation
- Endpoints: `/v2/directions/foot-walking`
- Rate Limits: 2000 requests/day (free tier)
- 3D Polyline support: Essential for elevation data

### AI Service (OpenAI recommended)
- API Key: Required for route evaluation
- Model: GPT-4 or GPT-3.5-turbo
- Use Case: Route analysis and scoring
- Expected Usage: 10+ evaluations per route generation

### Open-Meteo Elevation API
- No API key required
- Endpoint: `/v1/elevation`
- Rate Limits: Generous for non-commercial use
- Backup for elevation if OpenRouteService insufficient

## Success Criteria
1. **Route Quality**: 90%+ of generated routes meet user distance preference within 10%
2. **AI Accuracy**: AI-selected routes preferred by users in 80%+ of cases
3. **Performance**: Route generation completes in <10 seconds
4. **Mobile Experience**: Fully functional on mobile devices
5. **Reliability**: 99%+ uptime with proper error handling

## Development Considerations

### Code Reuse from Previous Versions
- Polyline decoder from `old_code/v3/script.js` (lines 557-605)
- Elevation coloring logic (lines 790-806)
- Distance calculation utilities (lines 540-549)
- Map initialization patterns

### UI/UX Inspiration
- **Desktop**: Clean sidebar with preferences, large map area
- **Mobile**: Collapsible preferences panel, full-screen map
- **Color Scheme**: Blue primary, green for flat routes, yellow/red for grades
- **Icons**: Simple, intuitive icons for route types and terrain

### Performance Optimization
- Lazy load AI evaluation only when needed
- Cache successful routes to avoid regeneration
- Optimize polyline sampling for mobile performance
- Progressive enhancement for advanced features

## API Key Security & Configuration

### Secure API Key Management
**Problem**: API keys must be kept secure and not exposed in client-side code or version control.

**Solution**: Multi-layer approach for different deployment scenarios:

#### Development Environment
1. **Environment Variables**: Store API keys in `.env` file (git-ignored)
   ```bash
   OPENROUTE_SERVICE_API_KEY=your_key_here
   OPENAI_API_KEY=your_key_here
   ```

2. **Local Configuration**: Create `config/api-keys.local.js` (git-ignored)
   ```javascript
   export const API_KEYS = {
     openRouteService: process.env.OPENROUTE_SERVICE_API_KEY,
     openAI: process.env.OPENAI_API_KEY
   };
   ```

#### Production Deployment
**Chosen Strategy**: Vercel Serverless Functions
- Deploy serverless functions with environment variables
- Frontend calls functions instead of APIs directly
- Functions handle API key authentication securely
- Zero server management with automatic scaling
- See BACKEND_PROCEDURE.md for detailed setup instructions

#### Recommended Architecture for Security
```
Frontend → Backend Proxy/Function → External APIs
         ↑                        ↑
    No API keys            API keys stored securely
```

#### Implementation Steps
1. **Create `.gitignore`** entries:
   ```
   .env
   config/api-keys.local.js
   config/secrets.json
   ```

2. **Create `config/api-keys.template.js`** (committed to repo):
   ```javascript
   // Copy to api-keys.local.js and add your keys
   export const API_KEYS = {
     openRouteService: 'YOUR_OPENROUTE_API_KEY',
     openAI: 'YOUR_OPENAI_API_KEY'
   };
   ```

3. **Add setup instructions** in README:
   - Copy template file
   - Add API keys to local config
   - Set up environment variables for production

#### Alternative: Client-Side with User-Provided Keys
- Allow users to input their own API keys
- Store in browser localStorage (not secure but user's responsibility)
- Clear warnings about API key security
- Suitable for personal/developer tools only

## Risk Mitigation
1. **API Rate Limits**: Implement request queuing and caching
2. **AI Service Costs**: Set usage limits and fallback scoring
3. **Route Quality**: Multiple validation layers before AI evaluation
4. **Mobile Performance**: Optimize for lower-end devices
5. **User Location Privacy**: Clear consent and data handling
6. **API Key Exposure**: Use backend proxy or serverless functions for production

This plan provides a comprehensive roadmap for building an AI-powered route generator that leverages existing code patterns while introducing intelligent route evaluation capabilities and secure API key management.