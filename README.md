# VietMap Route Tracking Demo

JavaScript demo application showcasing VietMap GL JS capabilities for route tracking, navigation simulation, and automatic rerouting.

## Features

- **Interactive Map Display** - VietMap GL JS v6.0.1 with navigation and scale controls
- **Route Finding** - Calculate routes between two points with distance and duration
- **Real-time Location** - Support for device geolocation
- **Movement Simulation** - Mock location movement along the route with adjustable speed
- **Automatic Rerouting** - Detects when user deviates >30m from route and automatically finds new route
- **Deviation Simulation** - Built-in option to simulate off-route scenarios for testing

## Project Structure

```
vietmap_route_tracking_demo/
├── index.html              # Main HTML file
├── README.md               # This documentation
├── css/
│   └── styles.css          # Application styles
└── js/
    ├── config.js           # Configuration (API keys, settings)
    ├── utils.js            # Utility functions (distance, formatting)
    ├── map.js              # Map initialization and controls
    ├── routing.js          # Route finding and rerouting logic
    ├── mock-location.js    # Location simulation module
    └── app.js              # Main application controller
```

## Prerequisites

- A valid VietMap API key (register at https://maps.vietmap.vn/console/register)

## Quick Start

### 1. Get API Key

Register for a VietMap API key at [https://maps.vietmap.vn/console/register](https://maps.vietmap.vn/console/register)

### 2. Configure API Key

Open `js/config.js` and replace `YOUR_API_KEY_HERE` with your API key:

```javascript
var Config = {
    API_KEYS: {
        // API key for Map Tiles/Styles
        TILEMAP: 'YOUR_TILEMAP_API_KEY',
        // API key for Routing API
        ROUTE: 'YOUR_ROUTE_API_KEY'
    },
    // ...
};
```

### 3. Run the Application
- Install Live Server extension in VSCode or use a similar tool to serve files over HTTP.
- Open `index.html` via the server.

## Usage Guide

### Finding a Route

1. Enter start coordinates in the "Start Point" field (format: `latitude, longitude`)
2. Enter end coordinates in the "End Point" field
3. Click **"Find Route"** button
4. The route will be displayed on the map with distance and duration info

### Using Current Location

1. Click **"Use Current Location"** button
2. Allow browser location access when prompted
3. Your current position will be set as the start point

### Running the Simulation

1. First, find a route (see above)
2. Click **"Start Movement"** button
3. Watch the blue marker move along the route
4. Adjust speed using the slider (1x to 10x)
5. Click **"Stop"** to pause the simulation

### Testing Automatic Rerouting

1. Check the **"Simulate Route Deviation"** checkbox
2. Start the simulation
3. The system will randomly simulate going off-route
4. When deviation exceeds 30 meters, automatic rerouting triggers
5. Watch the route update in real-time

## Configuration Options

Edit `js/config.js` to customize:

| Setting | Description | Default |
|---------|-------------|---------|
| `MAP.DEFAULT_CENTER` | Initial map center [lng, lat] | Ho Chi Minh City |
| `MAP.DEFAULT_ZOOM` | Initial zoom level | 13 |
| `ROUTING.DEFAULT_VEHICLE` | Vehicle type: car, bike, foot, motorcycle | motorcycle |
| `ROUTING.REROUTE_THRESHOLD` | Deviation distance to trigger reroute (meters) | 30 |
| `ROUTING.REROUTE_COOLDOWN` | Minimum time between reroutes (ms) | 3000 |
| `SIMULATION.UPDATE_INTERVAL` | Position update interval (ms) | 1000 |
| `SIMULATION.BASE_MOVE_DISTANCE` | Distance per update (meters) | 10 |

## Module Documentation

### Config (`js/config.js`)
Central configuration for API keys, map settings, routing parameters, and simulation options.

### Utils (`js/utils.js`)
Utility functions including:
- `calculateDistance()` - Haversine formula for distance between coordinates
- `distanceToRoute()` - Perpendicular distance from point to route line
- `formatDistance()` / `formatDuration()` - Human-readable formatting
- `parseCoordinates()` - Parse "lat, lng" string input

### MapModule (`js/map.js`)
Handles VietMap GL JS initialization and map interactions:
- Map initialization with controls
- Marker management (user, start, end)
- Route drawing and clearing
- Camera controls (flyTo, fitBounds)

### RoutingModule (`js/routing.js`)
Route finding and deviation detection:
- `findRoute()` - Call VietMap Routing API
- `reroute()` - Find new route from current position
- `checkDeviation()` - Check if user is off-route
- `hasArrived()` - Check if destination reached

### MockLocationModule (`js/mock-location.js`)
Location simulation for testing:
- Simulates movement along route coordinates
- Supports speed multiplier (1x-10x)
- Can simulate route deviation for testing reroute

### App (`js/app.js`)
Main application controller:
- DOM element management
- Event binding
- Coordinates UI updates with module callbacks

## API Reference

### VietMap Routing API

**Endpoint:** `https://maps.vietmap.vn/api/route`

**Parameters:**
- `api-version`: API version (1.1)
- `apikey`: Your API key
- `point`: Coordinates (lat,lng) - specify twice for start and end
- `vehicle`: Vehicle type (car, bike, foot, motorcycle)
- `points_encoded`: false for GeoJSON coordinates

**Example:**
```
https://maps.vietmap.vn/api/route?api-version=1.1&apikey=YOUR_KEY&point=10.7769,106.7009&point=10.8231,106.6297&vehicle=motorcycle
```

## Integration Guide: Replace Simulation with Real GPS via WebSocket

This section explains how to replace the mock location simulation with real GPS data from a backend server using WebSocket.

### Architecture Overview

```
┌─────────────┐     WebSocket      ┌─────────────┐     GPS Data     ┌─────────────┐
│   Browser   │ ◄────────────────► │   Backend   │ ◄──────────────► │ GPS Device  │
│  (VietMap)  │                    │   Server    │                  │  / Mobile   │
└─────────────┘                    └─────────────┘                  └─────────────┘
```

### Step 1: Create WebSocket Location Module

Create a new file `js/socket-location.js`:

```javascript
/**
 * WebSocket Location Module
 * Receives real GPS data from backend server
 */
var SocketLocationModule = {
    socket: null,
    isConnected: false,
    callbacks: {
        onPositionUpdate: null,
        onDeviation: null,
        onArrival: null,
        onConnectionChange: null
    },

    /**
     * Initialize WebSocket connection
     * @param {Object} options - Configuration options
     */
    init: function(options) {
        this.callbacks = Object.assign(this.callbacks, options);
    },

    /**
     * Connect to WebSocket server
     * @param {string} serverUrl - WebSocket server URL (e.g., 'wss://your-server.com/gps')
     * @param {string} vehicleId - Vehicle/driver identifier
     */
    connect: function(serverUrl, vehicleId) {
        var self = this;

        // Close existing connection
        if (this.socket) {
            this.socket.close();
        }

        this.socket = new WebSocket(serverUrl);

        this.socket.onopen = function() {
            self.isConnected = true;
            Logger.log('WebSocket connected', 'success');

            // Subscribe to vehicle updates
            self.socket.send(JSON.stringify({
                type: 'subscribe',
                vehicleId: vehicleId
            }));

            if (self.callbacks.onConnectionChange) {
                self.callbacks.onConnectionChange(true);
            }
        };

        this.socket.onmessage = function(event) {
            self.handleMessage(JSON.parse(event.data));
        };

        this.socket.onclose = function() {
            self.isConnected = false;
            Logger.log('WebSocket disconnected', 'warning');

            if (self.callbacks.onConnectionChange) {
                self.callbacks.onConnectionChange(false);
            }

            // Auto-reconnect after 5 seconds
            setTimeout(function() {
                if (!self.isConnected) {
                    Logger.log('Reconnecting...', 'info');
                    self.connect(serverUrl, vehicleId);
                }
            }, 5000);
        };

        this.socket.onerror = function(error) {
            Logger.log('WebSocket error: ' + error.message, 'error');
        };
    },

    /**
     * Handle incoming WebSocket messages
     * @param {Object} data - Parsed JSON message
     */
    handleMessage: function(data) {
        switch (data.type) {
            case 'position':
                // GPS position update
                // Expected format: { type: 'position', lat: 10.xxx, lng: 106.xxx, heading: 45, speed: 30, timestamp: 1234567890 }
                this.handlePositionUpdate(data);
                break;

            case 'arrival':
                // Arrived at destination
                if (this.callbacks.onArrival) {
                    this.callbacks.onArrival();
                }
                break;

            case 'vehicle_info':
                // Update vehicle information
                // Expected format: { type: 'vehicle_info', licensePlate: '59XX-123.45', driverName: 'Nguyen Van A', ... }
                MapModule.setVehicleInfo(data);
                break;

            default:
                console.log('Unknown message type:', data.type);
        }
    },

    /**
     * Process position update from backend
     * @param {Object} data - Position data
     */
    handlePositionUpdate: function(data) {
        var lat = data.lat;
        var lng = data.lng;
        var heading = data.heading || 0;

        // Check if deviated from route
        var deviationCheck = RoutingModule.checkDeviation(lat, lng);
        var deviated = deviationCheck.deviated;

        // Update marker position and heading
        MapModule.setUserMarker(lat, lng, deviated, heading);

        // Trigger callback
        if (this.callbacks.onPositionUpdate) {
            this.callbacks.onPositionUpdate(lat, lng, deviated);
        }

        // Handle deviation - trigger reroute
        if (deviated && this.callbacks.onDeviation) {
            this.callbacks.onDeviation(lat, lng);
        }

        // Check arrival
        if (RoutingModule.hasArrived(lat, lng, 30)) {
            if (this.callbacks.onArrival) {
                this.callbacks.onArrival();
            }
        }
    },

    /**
     * Disconnect from WebSocket server
     */
    disconnect: function() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        this.isConnected = false;
    },

    /**
     * Send message to backend
     * @param {Object} data - Data to send
     */
    send: function(data) {
        if (this.socket && this.isConnected) {
            this.socket.send(JSON.stringify(data));
        }
    }
};
```

### Step 2: Update index.html

Add the new script file:

```html
<!-- JavaScript Files -->
<script src="js/config.js"></script>
<script src="js/utils.js"></script>
<script src="js/map.js"></script>
<script src="js/routing.js"></script>
<script src="js/socket-location.js"></script>  <!-- Add this line -->
<script src="js/app.js"></script>
```

### Step 3: Update App.js

Replace `MockLocationModule` with `SocketLocationModule`:

```javascript
// In App.init() or initMockLocation(), replace with:
initSocketLocation: function() {
    var self = this;

    SocketLocationModule.init({
        onPositionUpdate: function(lat, lng, deviated) {
            self.handlePositionUpdate(lat, lng, deviated);
        },
        onDeviation: function(lat, lng) {
            self.handleDeviation(lat, lng);
        },
        onArrival: function() {
            self.handleArrival();
        },
        onConnectionChange: function(connected) {
            self.updateStatus(connected ? 'Connected' : 'Disconnected', connected ? 'active' : '');
        }
    });

    // Connect to your WebSocket server
    var serverUrl = 'wss://your-backend-server.com/gps';
    var vehicleId = 'vehicle_001';  // or get from config/user input
    SocketLocationModule.connect(serverUrl, vehicleId);
}
```

### Step 4: Backend WebSocket Server (Example - Node.js)

Example backend server using Node.js and ws library:

```javascript
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

// Store connected clients by vehicle ID
const clients = new Map();

wss.on('connection', function(ws) {
    let vehicleId = null;

    ws.on('message', function(message) {
        const data = JSON.parse(message);

        if (data.type === 'subscribe') {
            vehicleId = data.vehicleId;
            clients.set(vehicleId, ws);
            console.log(`Client subscribed to vehicle: ${vehicleId}`);
        }
    });

    ws.on('close', function() {
        if (vehicleId) {
            clients.delete(vehicleId);
        }
    });
});

// Function to broadcast GPS data to subscribed client
function sendGPSUpdate(vehicleId, gpsData) {
    const client = clients.get(vehicleId);
    if (client && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
            type: 'position',
            lat: gpsData.latitude,
            lng: gpsData.longitude,
            heading: gpsData.heading,
            speed: gpsData.speed,
            timestamp: Date.now()
        }));
    }
}

// Example: Receive GPS data from GPS device/mobile app
// This could come from MQTT, HTTP API, or another source
function onGPSDataReceived(vehicleId, gpsData) {
    sendGPSUpdate(vehicleId, gpsData);
}
```

### Step 5: GPS Data Format

The backend should send GPS data in this format:

```json
{
    "type": "position",
    "lat": 10.762622,
    "lng": 106.660172,
    "heading": 45,
    "speed": 35,
    "accuracy": 10,
    "timestamp": 1703923456789
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Message type: `position`, `arrival`, `vehicle_info` |
| `lat` | number | Latitude in decimal degrees |
| `lng` | number | Longitude in decimal degrees |
| `heading` | number | Direction in degrees (0-360, 0=North) |
| `speed` | number | Speed in km/h |
| `accuracy` | number | GPS accuracy in meters |
| `timestamp` | number | Unix timestamp in milliseconds |

### Step 6: Vehicle Info Update

To update driver/vehicle information displayed in the popup:

```json
{
    "type": "vehicle_info",
    "licensePlate": "59DB-123.45",
    "driverName": "Nguyen Van B",
    "driverPhone": "0901234567",
    "vehicleType": "Honda Winner X",
    "status": "Delivering"
}
```

