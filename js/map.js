/**
 * VietMap Route Tracking Demo - Map Module
 *
 * Handles map initialization and interactions
 */

var MapModule = {
    map: null,
    markers: {
        user: null,
        start: null,
        end: null
    },
    routeLayerId: 'route-layer',
    routeSourceId: 'route-source',

    // Vehicle/Driver information for popup
    vehicleInfo: {
        licensePlate: '59DB-056.43',
        driverName: 'Nguyễn Văn A',
        driverPhone: '0901234567',
        vehicleType: 'Honda Wave Alpha',
        status: 'Đang giao hàng'
    },

    /**
     * Initialize the map
     * @param {Function} callback - Callback after map loads
     */
    init: function(callback) {
        var self = this;

        this.map = new vietmapgl.Map({
            container: 'map',
            style: Config.getStyleUrl(),
            center: Config.MAP.DEFAULT_CENTER,
            zoom: Config.MAP.DEFAULT_ZOOM,
            minZoom: Config.MAP.MIN_ZOOM,
            maxZoom: Config.MAP.MAX_ZOOM
        });

        this.map.addControl(new vietmapgl.NavigationControl(), 'top-right');
        this.map.addControl(new vietmapgl.ScaleControl(), 'bottom-left');

        this.map.on('load', function() {
            Logger.log('Map is ready', 'success');

            // Find first symbol layer to insert route below text labels
            var firstSymbolLayer = null;
            var layers = self.map.getStyle().layers;
            for (var i = 0; i < layers.length; i++) {
                if (layers[i].type === 'symbol') {
                    firstSymbolLayer = layers[i].id;
                    break;
                }
            }

            // Add source for route
            self.map.addSource(self.routeSourceId, {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    geometry: {
                        type: 'LineString',
                        coordinates: []
                    }
                }
            });

            // Add route layer below text labels
            self.map.addLayer({
                id: self.routeLayerId,
                type: 'line',
                source: self.routeSourceId,
                layout: {
                    'line-join': 'round',
                    'line-cap': 'round'
                },
                paint: {
                    'line-color': Config.STYLES.ROUTE_LINE.color,
                    'line-width': Config.STYLES.ROUTE_LINE.width,
                    'line-opacity': Config.STYLES.ROUTE_LINE.opacity
                }
            }, firstSymbolLayer); // Insert before first symbol layer

            if (callback) callback();
        });

        // Handle map click
        this.map.on('click', function(e) {
            Logger.log('Click: ' + e.lngLat.lat.toFixed(6) + ', ' + e.lngLat.lng.toFixed(6), 'info');
        });

        // Handle right-click (context menu)
        this.map.on('contextmenu', function(e) {
            e.preventDefault();
            App.showContextMenu(e.point.x, e.point.y, e.lngLat);
        });
    },

    /**
     * Create marker HTML element
     */
    createMarkerElement: function(className) {
        var el = document.createElement('div');
        el.className = className;
        return el;
    },

    /**
     * Update vehicle/driver information
     * @param {Object} info - Vehicle info object
     */
    setVehicleInfo: function(info) {
        if (info.licensePlate) this.vehicleInfo.licensePlate = info.licensePlate;
        if (info.driverName) this.vehicleInfo.driverName = info.driverName;
        if (info.driverPhone) this.vehicleInfo.driverPhone = info.driverPhone;
        if (info.vehicleType) this.vehicleInfo.vehicleType = info.vehicleType;
        if (info.status) this.vehicleInfo.status = info.status;
    },

    /**
     * Generate popup HTML content for vehicle info
     */
    getVehiclePopupContent: function() {
        var info = this.vehicleInfo;
        return '<div class="vehicle-popup">' +
            '<div class="popup-header">' +
                '<strong>' + info.licensePlate + '</strong>' +
                '<span class="popup-status">' + info.status + '</span>' +
            '</div>' +
            '<div class="popup-body">' +
                '<p><i class="icon-driver"></i> ' + info.driverName + '</p>' +
                '<p><i class="icon-phone"></i> ' + info.driverPhone + '</p>' +
                '<p><i class="icon-vehicle"></i> ' + info.vehicleType + '</p>' +
            '</div>' +
        '</div>';
    },

    /**
     * Set user location marker with heading rotation
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @param {boolean} deviated - Whether user is off-route
     * @param {number} heading - Heading in degrees (0=North, 90=East)
     */
    setUserMarker: function(lat, lng, deviated, heading) {
        var self = this;

        if (this.markers.user) {
            this.markers.user.setLngLat([lng, lat]);
            var el = this.markers.user.getElement();
            if (deviated) {
                el.classList.add('deviated');
            } else {
                el.classList.remove('deviated');
            }
            // Apply rotation using marker's setRotation method
            if (typeof heading === 'number') {
                this.markers.user.setRotation(heading);
            }
            // Update popup content if exists
            var popup = this.markers.user.getPopup();
            if (popup) {
                popup.setHTML(this.getVehiclePopupContent());
            }
        } else {
            var el = this.createMarkerElement('user-marker');

            // Create popup for vehicle info
            var popup = new vietmapgl.Popup({
                offset: 25,
                closeButton: true,
                closeOnClick: false
            }).setHTML(this.getVehiclePopupContent());

            this.markers.user = new vietmapgl.Marker({
                element: el,
                rotationAlignment: 'map',
                rotation: heading || 0
            })
                .setLngLat([lng, lat])
                .setPopup(popup)
                .addTo(this.map);

            // Add click event to toggle popup
            el.style.cursor = 'pointer';
            el.addEventListener('click', function(e) {
                e.stopPropagation();
                e.preventDefault();
                self.markers.user.togglePopup();
            });
        }
    },

    /**
     * Set start point marker
     */
    setStartMarker: function(lat, lng) {
        if (this.markers.start) {
            this.markers.start.setLngLat([lng, lat]);
        } else {
            var el = this.createMarkerElement('start-marker');
            this.markers.start = new vietmapgl.Marker({ element: el })
                .setLngLat([lng, lat])
                .setPopup(new vietmapgl.Popup().setHTML('<strong>Start Point</strong>'))
                .addTo(this.map);
        }
    },

    /**
     * Set end point marker
     */
    setEndMarker: function(lat, lng) {
        if (this.markers.end) {
            this.markers.end.setLngLat([lng, lat]);
        } else {
            var el = this.createMarkerElement('end-marker');
            this.markers.end = new vietmapgl.Marker({ element: el })
                .setLngLat([lng, lat])
                .setPopup(new vietmapgl.Popup().setHTML('<strong>End Point</strong>'))
                .addTo(this.map);
        }
    },

    /**
     * Draw route on map
     * @param {Array} coordinates - Array of coordinates [[lng, lat], ...]
     */
    drawRoute: function(coordinates) {
        if (!this.map.getSource(this.routeSourceId)) return;

        this.map.getSource(this.routeSourceId).setData({
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: coordinates
            }
        });
    },

    /**
     * Clear route from map
     */
    clearRoute: function() {
        this.drawRoute([]);
    },

    /**
     * Fit map to bounds
     * @param {Array} coordinates - Array of coordinates
     */
    fitBounds: function(coordinates) {
        if (!coordinates || coordinates.length === 0) return;

        var bounds = new vietmapgl.LngLatBounds();
        coordinates.forEach(function(coord) {
            bounds.extend(coord);
        });

        this.map.fitBounds(bounds, {
            padding: 50,
            maxZoom: 15
        });
    },

    /**
     * Move camera to location
     */
    flyTo: function(lat, lng, zoom) {
        this.map.flyTo({
            center: [lng, lat],
            zoom: zoom || this.map.getZoom()
        });
    },

    /**
     * Remove all markers
     */
    clearMarkers: function() {
        if (this.markers.user) {
            this.markers.user.remove();
            this.markers.user = null;
        }
        if (this.markers.start) {
            this.markers.start.remove();
            this.markers.start = null;
        }
        if (this.markers.end) {
            this.markers.end.remove();
            this.markers.end = null;
        }
    }
};
