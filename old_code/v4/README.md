# Route Generator

A modern, mobile-optimized web application that automatically generates running routes with elevation data using OpenRouteService API.

## Features

- **Automatic Route Generation**: Creates loop routes based on desired distance (1-50km)
- **Terrain Preferences**: Choose between flat or hilly routes
- **Elevation Visualization**: Color-coded route segments showing elevation changes
- **Kilometer Markers**: Visual markers every kilometer with elevation data
- **Steepest Section Highlighting**: Identifies and highlights the most challenging part of the route
- **Mobile-Optimized**: Responsive design with touch-friendly controls
- **Progressive Web App**: Install on mobile devices for app-like experience

## Technical Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Mapping**: Leaflet.js with OpenStreetMap tiles
- **API**: OpenRouteService for route generation and elevation data
- **Mobile**: PWA with service worker support

## Project Structure

```
v4/
├── index.html              # Main HTML file
├── styles.css             # CSS styles
├── manifest.json          # PWA manifest
├── package.json           # Dependencies
├── js/
│   ├── app.js            # Main application controller
│   ├── config.js         # Configuration constants
│   ├── mapComponent.js   # Leaflet map integration
│   ├── polylineUtils.js  # 3D polyline processing utilities
│   └── routeService.js   # OpenRouteService API integration
└── sample-*.json         # Sample API responses for reference
```

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start development server**:
   ```bash
   npm run dev
   ```

3. **Open in browser**:
   Navigate to `http://localhost:3000`

## Configuration

The app is configured with an OpenRouteService API key in `js/config.js`. All configuration options are centralized in this file:

- API endpoints and authentication
- Map settings (center, zoom levels)
- Route generation parameters
- Elevation visualization colors
- Steepness level thresholds

## Usage

1. **Allow location access** when prompted (or use the location button)
2. **Set your preferences**:
   - Adjust distance slider (1-50km)
   - Choose terrain preference (flat/hilly)
3. **Generate route** by tapping the "Generate Route" button
4. **View results**:
   - Route displayed on map with elevation colors
   - Kilometer markers show distance progress
   - Steepest section highlighted with warning marker
   - Route statistics overlay shows key metrics

## Features in Detail

### Elevation Visualization
- **Green**: Flat terrain (0-2% gradient)
- **Light Green**: Slight incline (2-5% gradient)
- **Yellow**: Moderate incline (5-10% gradient)
- **Orange**: Steep incline (10-15% gradient)
- **Red**: Very steep incline (15%+ gradient)

### Route Generation Algorithm
1. Creates waypoints in a roughly circular pattern around the starting point
2. Adjusts waypoint distribution based on terrain preference
3. Uses OpenRouteService to calculate optimal routing between waypoints
4. Processes 3D polyline data to extract elevation information
5. Analyzes route segments for steepness and generates visualization

### Mobile Optimization
- Touch-friendly slide-up input panel
- Responsive design for various screen sizes
- PWA capabilities for installation on mobile devices
- Optimized map controls for touch interaction
- Efficient rendering for battery life

## API Integration

The app integrates with OpenRouteService using:
- **Profile**: `foot-walking` for flat routes, `foot-hiking` for hilly routes
- **Elevation**: Enabled to get 3D polyline data
- **Extra Info**: Requests steepness and surface data for enhanced analysis

## Browser Support

- Modern browsers with ES6+ support
- Geolocation API for location services
- Service Worker support for PWA features
- WebGL for smooth map rendering

## Development

To extend the app:

1. **Add new terrain types**: Modify `CONFIG.ROUTE_PROFILES` and update UI
2. **Enhance elevation analysis**: Extend `PolylineUtils` class methods
3. **Add export functionality**: Implement GPX/KML export in `RouteService`
4. **Improve route optimization**: Enhance waypoint generation algorithm

## License

MIT License - see package.json for details