/**
 * VietMap Route Tracking Demo - Main Application
 *
 * Application entry point and UI controller
 */

// Logger utility
var Logger = {
    container: null,

    init: function() {
        this.container = document.getElementById('log');
    },

    log: function(message, type) {
        type = type || 'info';
        var entry = document.createElement('div');
        entry.className = 'log-entry ' + type;

        var time = document.createElement('span');
        time.className = 'time';
        time.textContent = Utils.getCurrentTime();

        entry.appendChild(time);
        entry.appendChild(document.createTextNode(message));

        this.container.insertBefore(entry, this.container.firstChild);

        // Limit number of log entries
        while (this.container.children.length > 50) {
            this.container.removeChild(this.container.lastChild);
        }
    },

    clear: function() {
        this.container.innerHTML = '';
    }
};

// Main App
var App = {
    elements: {},
    isSimulating: false,
    removePassedRoute: true,
    contextMenu: null,
    contextMenuCoords: null,

    /**
     * Initialize application
     */
    init: function() {
        var self = this;

        // Cache DOM elements
        this.cacheElements();

        // Init Logger
        Logger.init();
        Logger.log('Starting application...', 'info');

        // Init Map
        MapModule.init(function() {
            self.bindEvents();
            self.initMockLocation();

            // Set default values
            self.elements.startPoint.value = '10.759333, 106.675913';
            self.elements.endPoint.value = '10.801180, 106.653297';

            Logger.log('Ready to use', 'success');
        });
    },

    /**
     * Cache DOM elements
     */
    cacheElements: function() {
        this.elements = {
            startPoint: document.getElementById('start-point'),
            endPoint: document.getElementById('end-point'),
            vehicleType: document.getElementById('vehicle-type'),
            btnFindRoute: document.getElementById('btn-find-route'),
            btnUseCurrent: document.getElementById('btn-use-current'),
            btnStartSimulation: document.getElementById('btn-start-simulation'),
            btnStopSimulation: document.getElementById('btn-stop-simulation'),
            simulationSpeed: document.getElementById('simulation-speed'),
            speedValue: document.getElementById('speed-value'),
            simulateDeviation: document.getElementById('simulate-deviation'),
            removePassedRoute: document.getElementById('remove-passed-route'),
            distance: document.getElementById('distance'),
            duration: document.getElementById('duration'),
            status: document.getElementById('status')
        };
        this.contextMenu = document.getElementById('context-menu');
    },

    /**
     * Bind event handlers
     */
    bindEvents: function() {
        var self = this;

        // Find route
        this.elements.btnFindRoute.addEventListener('click', function() {
            self.findRoute();
        });

        // Use current location as start point
        this.elements.btnUseCurrent.addEventListener('click', function() {
            self.useCurrentLocation();
        });

        // Start simulation
        this.elements.btnStartSimulation.addEventListener('click', function() {
            self.startSimulation();
        });

        // Stop simulation
        this.elements.btnStopSimulation.addEventListener('click', function() {
            self.stopSimulation();
        });

        // Speed change
        this.elements.simulationSpeed.addEventListener('input', function() {
            var speed = parseInt(this.value);
            self.elements.speedValue.textContent = speed + 'x';
            MockLocationModule.setSpeed(speed);
        });

        // Toggle deviation simulation
        this.elements.simulateDeviation.addEventListener('change', function() {
            MockLocationModule.setSimulateDeviation(this.checked);
            Logger.log('Deviation simulation: ' + (this.checked ? 'On' : 'Off'), 'info');
        });

        // Toggle remove passed route
        this.elements.removePassedRoute.addEventListener('change', function() {
            self.removePassedRoute = this.checked;
            Logger.log('Remove passed route: ' + (this.checked ? 'On' : 'Off'), 'info');
        });

        // Context menu items
        this.contextMenu.querySelectorAll('.context-menu-item').forEach(function(item) {
            item.addEventListener('click', function() {
                var action = this.getAttribute('data-action');
                self.handleContextMenuAction(action);
            });
        });

        // Hide context menu on click outside
        document.addEventListener('click', function() {
            self.hideContextMenu();
        });

        // Hide context menu on scroll
        document.addEventListener('scroll', function() {
            self.hideContextMenu();
        });
    },

    /**
     * Initialize mock location module
     */
    initMockLocation: function() {
        var self = this;

        MockLocationModule.init({
            onPositionUpdate: function(lat, lng, deviated) {
                self.handlePositionUpdate(lat, lng, deviated);
            },
            onDeviation: function(lat, lng) {
                self.handleDeviation(lat, lng);
            },
            onArrival: function() {
                self.handleArrival();
            }
        });
    },

    /**
     * Find route
     */
    findRoute: function() {
        var self = this;

        var start = Utils.parseCoordinates(this.elements.startPoint.value);
        var end = Utils.parseCoordinates(this.elements.endPoint.value);
        var vehicle = this.elements.vehicleType.value;

        if (!start || !end) {
            Logger.log('Invalid coordinates', 'error');
            return;
        }

        // Display markers
        MapModule.setStartMarker(start.lat, start.lng);
        MapModule.setEndMarker(end.lat, end.lng);

        Logger.log('Vehicle: ' + vehicle, 'info');

        // Find route
        RoutingModule.findRoute(start.lat, start.lng, end.lat, end.lng, vehicle, function(err, data) {
            if (err) {
                self.updateStatus('Error');
                return;
            }

            // Draw route
            MapModule.drawRoute(data.coordinates);
            MapModule.fitBounds(data.coordinates);

            // Update info
            self.elements.distance.textContent = Utils.formatDistance(data.distance);
            self.elements.duration.textContent = Utils.formatDuration(data.duration);
            self.updateStatus('Ready');

            // Enable start button
            self.elements.btnStartSimulation.disabled = false;
        });
    },

    /**
     * Use device's current location
     */
    useCurrentLocation: function() {
        var self = this;

        if (!navigator.geolocation) {
            Logger.log('Geolocation not supported', 'error');
            return;
        }

        Logger.log('Getting current location...', 'info');

        navigator.geolocation.getCurrentPosition(
            function(position) {
                var lat = position.coords.latitude;
                var lng = position.coords.longitude;
                self.elements.startPoint.value = lat.toFixed(6) + ', ' + lng.toFixed(6);
                MapModule.flyTo(lat, lng, 15);
                Logger.log('Location updated', 'success');
            },
            function(error) {
                Logger.log('Location error: ' + error.message, 'error');
            },
            {
                enableHighAccuracy: true,
                timeout: 10000
            }
        );
    },

    /**
     * Start movement simulation
     */
    startSimulation: function() {
        var start = Utils.parseCoordinates(this.elements.startPoint.value);

        if (!start) {
            Logger.log('Invalid start coordinates', 'error');
            return;
        }

        if (!RoutingModule.currentRoute) {
            Logger.log('No route available', 'error');
            return;
        }

        this.isSimulating = true;
        this.elements.btnStartSimulation.disabled = true;
        this.elements.btnStopSimulation.disabled = false;
        this.updateStatus('Moving', 'active');

        MockLocationModule.start(start.lat, start.lng);
    },

    /**
     * Stop simulation
     */
    stopSimulation: function() {
        this.isSimulating = false;
        this.elements.btnStartSimulation.disabled = false;
        this.elements.btnStopSimulation.disabled = true;
        this.updateStatus('Stopped');

        MockLocationModule.stop();
    },

    /**
     * Handle position update
     */
    handlePositionUpdate: function(lat, lng, deviated) {
        // Calculate heading to next point
        var heading = this.calculateHeading(lat, lng);

        // Update user marker with heading
        MapModule.setUserMarker(lat, lng, deviated, heading);

        // Update remaining distance
        var remaining = RoutingModule.getRemainingDistance(lat, lng);
        this.elements.distance.textContent = Utils.formatDistance(remaining) + ' remaining';

        // Remove passed route segments if enabled
        if (this.removePassedRoute && !deviated) {
            var routeIndex = MockLocationModule.currentRouteIndex;
            var fullRoute = RoutingModule.getRouteCoordinates();

            if (fullRoute && routeIndex > 0 && routeIndex < fullRoute.length) {
                // Get remaining route from current position
                var remainingRoute = fullRoute.slice(routeIndex);

                // Add current position as first point for smooth transition
                remainingRoute.unshift([lng, lat]);

                // Update route display
                MapModule.drawRoute(remainingRoute);
            }
        }
    },

    /**
     * Calculate heading based on next point in route
     */
    calculateHeading: function(lat, lng) {
        var routeCoords = RoutingModule.getRouteCoordinates();
        var routeIndex = MockLocationModule.currentRouteIndex;

        if (!routeCoords || routeCoords.length === 0) {
            return 0;
        }

        // Get next point on route
        var nextIndex = Math.min(routeIndex + 1, routeCoords.length - 1);
        var nextPoint = routeCoords[nextIndex];

        if (!nextPoint) {
            return 0;
        }

        // Calculate bearing from current position to next point
        // nextPoint is [lng, lat] format
        var bearing = Utils.calculateBearing(lat, lng, nextPoint[1], nextPoint[0]);

        return bearing;
    },

    /**
     * Handle route deviation
     */
    handleDeviation: function(lat, lng) {
        var self = this;

        this.updateStatus('Rerouting...', 'rerouting');

        RoutingModule.reroute(lat, lng, function(err, data) {
            if (err) {
                Logger.log('Reroute failed', 'error');
                self.updateStatus('Route error', 'error');
                return;
            }

            // Draw new route
            MapModule.drawRoute(data.coordinates);

            // Update info
            self.elements.distance.textContent = Utils.formatDistance(data.distance);
            self.elements.duration.textContent = Utils.formatDuration(data.duration);
            self.updateStatus('Route updated', 'active');

            // Reset mock location
            MockLocationModule.resetRoute();

            Logger.log('New route found', 'success');
        });
    },

    /**
     * Handle arrival at destination
     */
    handleArrival: function() {
        this.isSimulating = false;
        this.elements.btnStartSimulation.disabled = false;
        this.elements.btnStopSimulation.disabled = true;
        this.updateStatus('Arrived!', 'completed');

        Logger.log('You have arrived at your destination', 'success');
    },

    /**
     * Update status display
     */
    updateStatus: function(text, className) {
        this.elements.status.textContent = text;
        this.elements.status.className = className || '';
    },

    /**
     * Show context menu at position
     * @param {number} x - Screen X position
     * @param {number} y - Screen Y position
     * @param {Object} lngLat - Map coordinates {lng, lat}
     */
    showContextMenu: function(x, y, lngLat) {
        this.contextMenuCoords = lngLat;
        this.contextMenu.style.left = x + 'px';
        this.contextMenu.style.top = y + 'px';
        this.contextMenu.style.display = 'block';

        // Adjust position if menu goes off screen
        var menuRect = this.contextMenu.getBoundingClientRect();
        if (menuRect.right > window.innerWidth) {
            this.contextMenu.style.left = (x - menuRect.width) + 'px';
        }
        if (menuRect.bottom > window.innerHeight) {
            this.contextMenu.style.top = (y - menuRect.height) + 'px';
        }
    },

    /**
     * Hide context menu
     */
    hideContextMenu: function() {
        this.contextMenu.style.display = 'none';
        this.contextMenuCoords = null;
    },

    /**
     * Handle context menu action
     * @param {string} action - Action type
     */
    handleContextMenuAction: function(action) {
        if (!this.contextMenuCoords) return;

        var lat = this.contextMenuCoords.lat.toFixed(6);
        var lng = this.contextMenuCoords.lng.toFixed(6);
        var coordStr = lat + ', ' + lng;

        if (action === 'set-start') {
            this.elements.startPoint.value = coordStr;
            MapModule.setStartMarker(parseFloat(lat), parseFloat(lng));
            Logger.log('Start point set: ' + coordStr, 'success');
        } else if (action === 'set-end') {
            this.elements.endPoint.value = coordStr;
            MapModule.setEndMarker(parseFloat(lat), parseFloat(lng));
            Logger.log('End point set: ' + coordStr, 'success');
        }

        this.hideContextMenu();
    }
};

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    App.init();
});
