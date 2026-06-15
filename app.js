// --- Global Dashboard State ---
let map;
let eqLayerGroup;
let tectLayer;
let heatLayer;

let rawEarthquakes = [];
let filteredEarthquakes = [];
let rawTectonicData = null;

// Chart Instances
let chartMagDist = null;
let chartScatter = null;
let chartTimeline = null;
let chartFaultDist = null;
let chartNamedFault = null;

// Table Sort State
let sortColumn = 'Date';
let sortDirection = 'desc'; // 'asc' or 'desc'

// Colors mapping matching index.css
const COLOR_SHALLOW = '#00f2fe';
const COLOR_INTERMEDIATE = '#ff9f43';
const COLOR_DEEP = '#ff007f';

// --- Dashboard Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    initEventListeners();
    fetchData();
    updateTimeBadge();
    setInterval(updateTimeBadge, 60000);
});

// Update current MST time in badge
function updateTimeBadge() {
    const now = new Date();
    // Format to local MST / current time
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    document.getElementById('current-time').innerText = `MST ${timeString}`;
}

// Initialize Leaflet Map
function initMap() {
    // Center of Myanmar coordinates
    map = L.map('map', {
        center: [21.0, 96.2],
        zoom: 6,
        minZoom: 5,
        maxZoom: 12,
        zoomControl: true
    });

    // Dark Map Tile Layer (CartoDB Dark Matter)
    const darkTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    });
    darkTiles.addTo(map);

    // Create Layer Groups
    eqLayerGroup = L.layerGroup().addTo(map);
    
    // Add custom base layer control
    const satelliteTiles = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    });

    const baseMaps = {
        "Dark Vector": darkTiles,
        "Satellite Imagery": satelliteTiles
    };

    L.control.layers(baseMaps, null, { position: 'topright' }).addTo(map);
}

// Attach Event Listeners to UI Elements
function initEventListeners() {
    // Filter controls
    document.getElementById('search-location').addEventListener('input', applyFilters);
    
    const magSlider = document.getElementById('magnitude-slider');
    magSlider.addEventListener('input', (e) => {
        document.getElementById('mag-val').innerHTML = `${parseFloat(e.target.value).toFixed(1)} M<sub>w</sub>`;
        applyFilters();
    });

    const depthSlider = document.getElementById('depth-slider');
    depthSlider.addEventListener('input', (e) => {
        document.getElementById('depth-val').innerText = `${e.target.value} km`;
        applyFilters();
    });

    const faultSlider = document.getElementById('fault-slider');
    faultSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        document.getElementById('fault-val').innerText = val === 100 ? "100+ km" : `${val} km`;
        applyFilters();
    });

    document.getElementById('date-start').addEventListener('change', applyFilters);
    document.getElementById('date-end').addEventListener('change', applyFilters);
    
    document.getElementById('reset-btn').addEventListener('click', resetFilters);

    // Chart Tabs
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            tabButtons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            const targetTab = e.target.getAttribute('data-tab');
            const tabContents = document.querySelectorAll('.chart-tab-content');
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === targetTab) {
                    content.classList.add('active');
                }
            });
            
            // Re-render charts in active tab to fix sizing issues
            resizeCharts();
        });
    });

    // Table sorting
    const headers = document.querySelectorAll('.data-table th[data-sort]');
    headers.forEach(header => {
        header.addEventListener('click', () => {
            const col = header.getAttribute('data-sort');
            if (sortColumn === col) {
                sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                sortColumn = col;
                sortDirection = 'desc'; // Default to descending
            }
            
            // Update sort icon
            headers.forEach(h => {
                const icon = h.querySelector('i');
                icon.className = 'fa-solid fa-sort';
            });
            const activeIcon = header.querySelector('i');
            activeIcon.className = sortDirection === 'asc' ? 'fa-solid fa-sort-up' : 'fa-solid fa-sort-down';
            
            renderTable();
        });
    });
}

// Fetch Data Files
function fetchData() {
    // Load tectonic map background first
    fetch('./Myanmar_Tectonic_Map_2011.geojson')
        .then(res => res.json())
        .then(data => {
            rawTectonicData = data;
            renderTectonicMap();
        })
        .catch(err => {
            console.error("Error loading Tectonic Map:", err);
            showNotification("Failed to load Tectonic Map layer.", "error");
        });

    // Load analyzed earthquakes (contains distance measurements)
    fetch('./analyzed_earthquakes.json')
        .then(res => res.json())
        .then(data => {
            rawEarthquakes = data.features;
            filteredEarthquakes = [...rawEarthquakes];
            
            // Set input bounds dynamically
            initFilterBounds();
            
            // Initial Dashboard Render
            updateDashboard();
        })
        .catch(err => {
            console.error("Error loading Earthquake data:", err);
            showNotification("Failed to load Earthquake data.", "error");
        });
}

// Initialize dynamic bounds based on data
function initFilterBounds() {
    if (rawEarthquakes.length === 0) return;
    
    // Find min and max dates
    const dates = rawEarthquakes.map(f => f.properties.Date);
    const minDate = dates.reduce((a, b) => a < b ? a : b);
    const maxDate = dates.reduce((a, b) => a > b ? a : b);
    
    document.getElementById('date-start').value = minDate;
    document.getElementById('date-end').value = maxDate;
}

// Reset Filters
function resetFilters() {
    document.getElementById('search-location').value = '';
    
    const magSlider = document.getElementById('magnitude-slider');
    magSlider.value = 3.0;
    document.getElementById('mag-val').innerHTML = '3.0 M<sub>w</sub>';
    
    const depthSlider = document.getElementById('depth-slider');
    depthSlider.value = 150;
    document.getElementById('depth-val').innerText = '150 km';
    
    const faultSlider = document.getElementById('fault-slider');
    faultSlider.value = 100;
    document.getElementById('fault-val').innerText = '100+ km';
    
    initFilterBounds();
    applyFilters();
}

// Apply Active Filters to Dataset
function applyFilters() {
    const searchText = document.getElementById('search-location').value.toLowerCase();
    const minMag = parseFloat(document.getElementById('magnitude-slider').value);
    const maxDepth = parseInt(document.getElementById('depth-slider').value);
    const maxFaultDist = parseInt(document.getElementById('fault-slider').value);
    const startDateStr = document.getElementById('date-start').value;
    const endDateStr = document.getElementById('date-end').value;
    
    const startDate = startDateStr ? new Date(startDateStr) : null;
    const endDate = endDateStr ? new Date(endDateStr) : null;
    
    filteredEarthquakes = rawEarthquakes.filter(feature => {
        const props = feature.properties;
        
        // Location Filter
        const locationMatch = !searchText || props.Location.toLowerCase().includes(searchText);
        
        // Magnitude Filter
        const magMatch = props.Magnitude >= minMag;
        
        // Depth Filter
        const depthMatch = props.Depth_km <= maxDepth;
        
        // Fault Proximity Filter
        // If the slider is at 100, we treat it as "unlimited" or 100+ km
        const faultMatch = maxFaultDist === 100 || props.Distance_to_Fault_km <= maxFaultDist;
        
        // Date Filter
        let dateMatch = true;
        if (props.Date) {
            const eqDate = new Date(props.Date);
            if (startDate && eqDate < startDate) dateMatch = false;
            if (endDate && eqDate > endDate) dateMatch = false;
        }
        
        return locationMatch && magMatch && depthMatch && faultMatch && dateMatch;
    });
    
    updateDashboard();
}

// Update Map, Charts, Metrics, and Table
function updateDashboard() {
    updateKPIs();
    renderMapMarkers();
    renderCharts();
    renderTable();
}

// Calculate and render KPI metrics
function updateKPIs() {
    const total = filteredEarthquakes.length;
    document.getElementById('kpi-total').innerText = total;
    
    if (total === 0) {
        document.getElementById('kpi-max-mag').innerText = "N/A";
        document.getElementById('kpi-max-mag-loc').innerText = "No events";
        document.getElementById('kpi-avg-depth').innerText = "N/A";
        document.getElementById('kpi-avg-depth-class').innerText = "No events";
        document.getElementById('kpi-avg-fault').innerText = "N/A";
        return;
    }
    
    // Find Max Magnitude
    let maxFeature = filteredEarthquakes[0];
    let sumDepth = 0;
    let sumFault = 0;
    
    filteredEarthquakes.forEach(f => {
        if (f.properties.Magnitude > maxFeature.properties.Magnitude) {
            maxFeature = f;
        }
        sumDepth += f.properties.Depth_km;
        sumFault += f.properties.Distance_to_Fault_km;
    });
    
    const avgDepth = sumDepth / total;
    const avgFault = sumFault / total;
    
    document.getElementById('kpi-max-mag').innerText = `${maxFeature.properties.Magnitude.toFixed(1)} Mw`;
    
    // Clean location description for KPI subtext
    let locClean = maxFeature.properties.Location.replace(/^About\s+/, '').replace(/\.$/, '');
    document.getElementById('kpi-max-mag-loc').innerText = `in ${locClean}`;
    
    document.getElementById('kpi-avg-depth').innerText = `${avgDepth.toFixed(1)} km`;
    
    // Depth description
    let depthDesc = "Shallow hypocenter";
    if (avgDepth > 70) depthDesc = "Deep hypocenters";
    else if (avgDepth > 30) depthDesc = "Intermediate hypocenters";
    document.getElementById('kpi-avg-depth-class').innerText = depthDesc;
    
    document.getElementById('kpi-avg-fault').innerText = `${avgFault.toFixed(1)} km`;
}

// Render Tectonic Map background layer (Single Class Style)
function renderTectonicMap() {
    if (!rawTectonicData) return;
    
    // If layer already exists, remove it
    if (tectLayer) {
        map.removeLayer(tectLayer);
    }
    
    // Style as a single-class lineament background: thin amber-orange lines
    tectLayer = L.geoJSON(rawTectonicData, {
        style: function(feature) {
            return {
                color: '#ff6b6b', // Solid, clean coral red/amber line
                weight: 1.5,
                opacity: 0.45,
                dashArray: '2, 3' // Dashed for background aesthetic
            };
        },
        onEachFeature: function(feature, layer) {
            const props = feature.properties;
            const name = props.NAME || "Unnamed Tectonic Lineament";
            const code = props.CODE || "N/A";
            const segment = props.SEGMENT || "N/A";
            const type = props.TYPE_DESCR || "N/A";
            
            let popupContent = `
                <div class="map-popup-container">
                    <div class="map-popup-header">
                        <h4>Tectonic Fault</h4>
                        <span class="map-popup-badge" style="background: rgba(255, 107, 107, 0.15); color: #ff6b6b; border: 1px solid rgba(255, 107, 107, 0.3);">${code}</span>
                    </div>
                    <div class="map-popup-grid">
                        <span>Name:</span> <span>${name}</span>
                        <span>Segment:</span> <span>${segment}</span>
                        <span>Type:</span> <span>${type}</span>
                    </div>
                </div>
            `;
            layer.bindPopup(popupContent);
            
            // Hover styles for background lineaments
            layer.on('mouseover', function(e) {
                layer.setStyle({
                    color: '#ff007f',
                    opacity: 0.8,
                    weight: 2.5
                });
            });
            layer.on('mouseout', function(e) {
                tectLayer.resetStyle(layer);
            });
        }
    }).addTo(map);
    
    // Send tectonic layer to back so earthquakes are on top
    tectLayer.bringToBack();
}

// Render Earthquake markers & Heatmap
function renderMapMarkers() {
    eqLayerGroup.clearLayers();
    
    if (heatLayer) {
        map.removeLayer(heatLayer);
    }

    const heatPoints = [];
    
    filteredEarthquakes.forEach(feature => {
        const props = feature.properties;
        const geom = feature.geometry;
        
        if (geom.type === 'Point') {
            const lon = geom.coordinates[0];
            const lat = geom.coordinates[1];
            
            // Map depth to accent colors
            let color = COLOR_SHALLOW;
            if (props.Depth_km > 70) {
                color = COLOR_DEEP;
            } else if (props.Depth_km > 30) {
                color = COLOR_INTERMEDIATE;
            }
            
            // Scale circle size exponentially by magnitude
            // 3.0 -> ~5px radius, 6.0 -> ~20px radius
            const radius = Math.pow(2.4, props.Magnitude - 3.0) * 4.5 + 3;
            
            const marker = L.circleMarker([lat, lon], {
                radius: radius,
                fillColor: color,
                fillOpacity: 0.75,
                color: '#ffffff',
                weight: 1.0,
                opacity: 0.45
            });
            
            // Custom Popup content
            const popupContent = `
                <div class="map-popup-container" style="min-width: 250px;">
                    <div class="map-popup-header">
                        <h4>M<sub>w</sub> ${props.Magnitude.toFixed(1)} Event</h4>
                        <span class="map-popup-badge" style="background: ${color}20; color: ${color}; border: 1px solid ${color}40;">${props.Depth_Class}</span>
                    </div>
                    <div class="map-popup-grid">
                        <span>Date:</span> <span>${props.Date}</span>
                        <span>Time (MST):</span> <span>${props.Time_MST}</span>
                        <span>Location:</span> <span style="max-width: 170px; word-wrap: break-word;">${props.Location}</span>
                        <span>Depth:</span> <span>${props.Depth_km} km</span>
                        <span>Nearest Fault:</span> <span>${props.Nearest_Fault_Name}</span>
                        <span>Fault Distance:</span> <span>${props.Distance_to_Fault_km} km</span>
                        <span>Closest Named:</span> <span>${props.Nearest_Named_Fault_Name}</span>
                        <span>Named Fault Dist:</span> <span>${props.Distance_to_Named_Fault_km >= 0 ? props.Distance_to_Named_Fault_km + ' km' : 'N/A'}</span>
                    </div>
                    <div class="map-popup-footer">
                        Coordinates: ${lat.toFixed(4)}, ${lon.toFixed(4)}
                    </div>
                </div>
            `;
            marker.bindPopup(popupContent);
            
            // Hover states
            marker.on('mouseover', function(e) {
                marker.openPopup();
                marker.setStyle({ weight: 2.0, opacity: 1.0 });
            });
            marker.on('mouseout', function(e) {
                marker.setStyle({ weight: 1.0, opacity: 0.45 });
            });
            
            eqLayerGroup.addLayer(marker);
            
            // Add to heatmap points: [lat, lon, intensity]
            // Intensity based on magnitude squared
            heatPoints.push([lat, lon, Math.pow(props.Magnitude, 2) / 36.0]);
        }
    });
    
    // Create heat layer but don't add to map immediately (can be toggled if needed, or overlayed)
    heatLayer = L.heatLayer(heatPoints, {
        radius: 25,
        blur: 15,
        maxZoom: 10,
        gradient: {
            0.4: '#00f2fe',
            0.65: '#ff9f43',
            1.0: '#ff007f'
        }
    });
    
    // Toggle controls for map mode could be added here, but keeping it simple.
}

// Render Charts using Chart.js
function renderCharts() {
    renderMagDistributionChart();
    renderMagDepthScatterChart();
    renderTimelineChart();
    renderFaultDistChart();
    renderNamedFaultChart();
}

function resizeCharts() {
    // Small delay to allow CSS transitions to finish before chart calculations
    setTimeout(() => {
        if (chartMagDist) chartMagDist.resize();
        if (chartScatter) chartScatter.resize();
        if (chartTimeline) chartTimeline.resize();
        if (chartFaultDist) chartFaultDist.resize();
        if (chartNamedFault) chartNamedFault.resize();
    }, 100);
}

// Chart 1: Magnitude Distribution Histogram
function renderMagDistributionChart() {
    const ctx = document.getElementById('chart-mag-dist').getContext('2d');
    
    // Bins: 3.0-3.4, 3.5-3.9, 4.0-4.4, 4.5-4.9, 5.0-5.4, 5.5-6.0
    const bins = ['3.0-3.4', '3.5-3.9', '4.0-4.4', '4.5-4.9', '5.0-5.4', '5.5-6.0'];
    const counts = [0, 0, 0, 0, 0, 0];
    
    filteredEarthquakes.forEach(f => {
        const mag = f.properties.Magnitude;
        if (mag < 3.5) counts[0]++;
        else if (mag < 4.0) counts[1]++;
        else if (mag < 4.5) counts[2]++;
        else if (mag < 5.0) counts[3]++;
        else if (mag < 5.5) counts[4]++;
        else counts[5]++;
    });
    
    if (chartMagDist) {
        chartMagDist.destroy();
    }
    
    chartMagDist = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: bins,
            datasets: [{
                label: 'Earthquake Count',
                data: counts,
                backgroundColor: 'rgba(0, 242, 254, 0.4)',
                borderColor: '#00f2fe',
                borderWidth: 1.5,
                borderRadius: 4,
                hoverBackgroundColor: 'rgba(0, 242, 254, 0.75)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1e2230',
                    titleColor: '#fff',
                    bodyColor: '#a4b0be',
                    borderColor: 'rgba(255,255,255,0.08)',
                    borderWidth: 1
                }
            },
            scales: {
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8', stepSize: 1 }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8' }
                }
            }
        }
    });
}

// Chart 2: Depth vs Magnitude Scatter (Inverted Depth)
function renderMagDepthScatterChart() {
    const ctx = document.getElementById('chart-mag-depth-scatter').getContext('2d');
    
    const scatterData = filteredEarthquakes.map(f => {
        const props = f.properties;
        let color = COLOR_SHALLOW;
        if (props.Depth_km > 70) color = COLOR_DEEP;
        else if (props.Depth_km > 30) color = COLOR_INTERMEDIATE;
        
        return {
            x: props.Magnitude,
            y: props.Depth_km,
            label: props.Location,
            pointColor: color
        };
    });
    
    if (chartScatter) {
        chartScatter.destroy();
    }
    
    chartScatter = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                data: scatterData,
                backgroundColor: scatterData.map(d => d.pointColor),
                borderColor: '#ffffff',
                borderWidth: 0.5,
                pointRadius: 6,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1e2230',
                    titleColor: '#fff',
                    bodyColor: '#a4b0be',
                    borderColor: 'rgba(255,255,255,0.08)',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            const p = context.raw;
                            return `Location: ${p.label} | Mag: ${p.x.toFixed(1)} Mw | Depth: ${p.y} km`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Magnitude (Mw)', color: '#94a3b8' },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8' },
                    min: 3.0,
                    max: 6.5
                },
                y: {
                    title: { display: true, text: 'Depth (km)', color: '#94a3b8' },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8' },
                    min: 0,
                    max: 160,
                    reverse: true // IMPORTANT: Geological convention has depth downward!
                }
            }
        }
    });
}

// Chart 3: Timeline (Frequency over time, aggregated by week)
function renderTimelineChart() {
    const ctx = document.getElementById('chart-timeline').getContext('2d');
    
    // Sort earthquakes by date ascending
    const sortedEvents = [...filteredEarthquakes].sort((a, b) => new Date(a.properties.Date) - new Date(b.properties.Date));
    
    // Group by week
    const weeklyData = {};
    
    sortedEvents.forEach(f => {
        const d = new Date(f.properties.Date);
        // Get Sunday of that week
        const day = d.getDay();
        const diff = d.getDate() - day; 
        const weekSunday = new Date(d.setDate(diff));
        const dateStr = weekSunday.toISOString().split('T')[0];
        
        weeklyData[dateStr] = (weeklyData[dateStr] || 0) + 1;
    });
    
    const labels = Object.keys(weeklyData);
    const dataPoints = Object.values(weeklyData);
    
    if (chartTimeline) {
        chartTimeline.destroy();
    }
    
    chartTimeline = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Earthquake Count (Weekly)',
                data: dataPoints,
                backgroundColor: 'rgba(0, 242, 254, 0.08)',
                borderColor: '#00f2fe',
                borderWidth: 2,
                pointBackgroundColor: '#00f2fe',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 1,
                pointRadius: 4,
                pointHoverRadius: 6,
                tension: 0.2,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1e2230',
                    callbacks: {
                        title: function(context) {
                            return `Week of Sunday, ${context[0].label}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8', stepSize: 1 },
                    min: 0
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8' }
                }
            }
        }
    });
}

// Chart 4: Fault Distance Distribution
function renderFaultDistChart() {
    const ctx = document.getElementById('chart-fault-dist').getContext('2d');
    
    const bins = ['< 5 km', '5-10 km', '10-20 km', '20-50 km', '> 50 km'];
    const counts = [0, 0, 0, 0, 0];
    
    filteredEarthquakes.forEach(f => {
        const dist = f.properties.Distance_to_Fault_km;
        if (dist <= 5) counts[0]++;
        else if (dist <= 10) counts[1]++;
        else if (dist <= 20) counts[2]++;
        else if (dist <= 50) counts[3]++;
        else counts[4]++;
    });
    
    if (chartFaultDist) {
        chartFaultDist.destroy();
    }
    
    chartFaultDist = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: bins,
            datasets: [{
                data: counts,
                backgroundColor: [
                    'rgba(255, 0, 127, 0.65)',      // < 5km (Highest spatial risk)
                    'rgba(255, 159, 67, 0.65)',     // 5-10km
                    'rgba(241, 196, 15, 0.65)',     // 10-20km
                    'rgba(16, 185, 129, 0.65)',     // 20-50km
                    'rgba(0, 242, 254, 0.65)'       // >50km
                ],
                borderColor: 'rgba(255, 255, 255, 0.1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { color: '#94a3b8', font: { size: 10 } }
                },
                tooltip: {
                    backgroundColor: '#1e2230',
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b);
                            const val = context.raw;
                            const pct = ((val / total) * 100).toFixed(1);
                            return ` ${context.label}: ${val} (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Chart 5: Nearest Named Fault Horizontal Bar
function renderNamedFaultChart() {
    const ctx = document.getElementById('chart-named-fault-bar').getContext('2d');
    
    const counts = {};
    filteredEarthquakes.forEach(f => {
        const fault = f.properties.Nearest_Named_Fault_Name;
        if (fault && fault !== "None") {
            counts[fault] = (counts[fault] || 0) + 1;
        }
    });
    
    // Sort descending
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const labels = sorted.map(x => x[0]);
    const values = sorted.map(x => x[1]);
    
    if (chartNamedFault) {
        chartNamedFault.destroy();
    }
    
    chartNamedFault = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Associated Earthquakes',
                data: values,
                backgroundColor: 'rgba(255, 159, 67, 0.4)',
                borderColor: '#ff9f43',
                borderWidth: 1.5,
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y', // Makes it horizontal
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { backgroundColor: '#1e2230' }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8', stepSize: 2 },
                    min: 0
                },
                y: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8', font: { size: 10 } }
                }
            }
        }
    });
}

// Render ledger list table
function renderTable() {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';
    
    // Sort filtered dataset
    const sortedData = [...filteredEarthquakes].sort((a, b) => {
        let valA, valB;
        
        if (sortColumn === 'Date') {
            // Sort by combined Date and Time
            valA = new Date(`${a.properties.Date}T${a.properties.Time_MST}`);
            valB = new Date(`${b.properties.Date}T${b.properties.Time_MST}`);
        } else {
            valA = a.properties[sortColumn];
            valB = b.properties[sortColumn];
        }
        
        // Handle nulls
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;
        
        if (typeof valA === 'string') {
            return sortDirection === 'asc' 
                ? valA.localeCompare(valB) 
                : valB.localeCompare(valA);
        } else {
            return sortDirection === 'asc' 
                ? valA - valB 
                : valB - valA;
        }
    });
    
    document.getElementById('table-count-text').innerText = `Showing ${sortedData.length} of ${rawEarthquakes.length} events`;
    
    if (sortedData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 30px;">No earthquake events match the active filter criteria.</td></tr>`;
        return;
    }
    
    sortedData.forEach(feature => {
        const props = feature.properties;
        const geom = feature.geometry;
        const lat = geom.coordinates[1];
        const lon = geom.coordinates[0];
        
        // Mag badge styling
        let magClass = 'mag-cyan';
        if (props.Magnitude >= 5.0) magClass = 'mag-red';
        else if (props.Magnitude >= 4.0) magClass = 'mag-orange';
        
        const tr = document.createElement('tr');
        
        // Center map on click row
        tr.addEventListener('click', (e) => {
            // Avoid zoom if clicking the icon button itself (handled separately)
            if (e.target.closest('.table-btn-zoom')) return;
            zoomToEvent(lat, lon, props.Magnitude);
        });
        
        tr.innerHTML = `
            <td>
                <div style="font-weight: 500;">${props.Date}</div>
                <div style="font-size: 11px; color: var(--text-muted);">${props.Time_MST}</div>
            </td>
            <td style="max-width: 250px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" title="${props.Location}">
                ${props.Location}
            </td>
            <td style="font-family: monospace; font-size: 12px; color: var(--text-secondary);">
                ${lat.toFixed(2)}&deg;N, ${lon.toFixed(2)}&deg;E
            </td>
            <td>
                <span class="mag-badge ${magClass}">${props.Magnitude.toFixed(1)}</span>
            </td>
            <td>
                <div style="font-weight: 500;">${props.Depth_km} km</div>
                <div style="font-size: 10px; color: var(--text-muted);">${props.Depth_Class.split(' ')[0]}</div>
            </td>
            <td>
                <div style="font-weight: 500;">${props.Distance_to_Fault_km.toFixed(1)} km</div>
                <div style="font-size: 10px; color: var(--text-muted); text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 100px;">
                    to ${props.Nearest_Fault_Name}
                </div>
            </td>
            <td>
                ${props.Nearest_Named_Fault_Name !== 'None' ? props.Nearest_Named_Fault_Name : '<span style="color: var(--text-muted);">None Close</span>'}
                <div style="font-size: 10px; color: var(--text-muted);">
                    ${props.Distance_to_Named_Fault_km >= 0 ? props.Distance_to_Named_Fault_km.toFixed(1) + ' km' : ''}
                </div>
            </td>
            <td>
                <button class="table-btn-zoom" title="Center map on event">
                    <i class="fa-solid fa-crosshairs"></i>
                </button>
            </td>
        `;
        
        tbody.appendChild(tr);
    });
}

// Pan & Zoom to Specific Coordinate and open popup
function zoomToEvent(lat, lon, mag) {
    // Zoom in closer based on Magnitude
    const zoomLevel = mag >= 5.0 ? 9 : 8;
    map.setView([lat, lon], zoomLevel, { animate: true, duration: 1 });
    
    // Find the marker that matches the coordinates and trigger its popup
    eqLayerGroup.eachLayer(layer => {
        const markerLatLng = layer.getLatLng();
        if (Math.abs(markerLatLng.lat - lat) < 0.0001 && Math.abs(markerLatLng.lng - lon) < 0.0001) {
            setTimeout(() => {
                layer.openPopup();
            }, 300);
        }
    });
}

// Simple Toast Notification system
function showNotification(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(30, 34, 48, 0.9);
        backdrop-filter: blur(10px);
        color: #fff;
        padding: 12px 20px;
        border-radius: 8px;
        border-left: 4px solid ${type === 'error' ? '#ff007f' : '#00f2fe'};
        box-shadow: 0 5px 15px rgba(0,0,0,0.3);
        z-index: 9999;
        font-family: var(--font-body);
        font-size: 13px;
        display: flex;
        align-items: center;
        gap: 10px;
        opacity: 0;
        transform: translateY(10px);
        transition: all 0.3s ease;
    `;
    
    const icon = type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-info';
    toast.innerHTML = `<i class="fa-solid ${icon}" style="color: ${type === 'error' ? '#ff007f' : '#00f2fe'}"></i> <span>${message}</span>`;
    
    document.body.appendChild(toast);
    
    // Fade in
    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    }, 100);
    
    // Remove after 4 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 4000);
}
