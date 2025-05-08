// Initialize map
var map = L.map("map").setView([22.5937, 78.9629], 6);

// Base layers
var osmLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
});

var satelliteLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
});

var roadLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
});

var terrainLayer = L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a> contributors',
});

// Add default layer (road layer instead of satellite)
roadLayer.addTo(map);

// Load history from localStorage
var historyList = JSON.parse(localStorage.getItem('mapHistory')) || [];
updateHistoryDisplay();

// Layer dropdown functionality
const layerDropdown = document.querySelector('.layer-dropdown');
const layerDropdownHeader = document.querySelector('.layer-dropdown-header');
const layerOptions = document.querySelectorAll('.layer-option');
const selectedLayerText = document.querySelector('.selected-layer');

// Set initial selected layer
let currentLayer = 'road';
document.querySelector('.layer-option[data-value="road"]').classList.add('selected');
selectedLayerText.textContent = 'Road Layer';

// Toggle dropdown
layerDropdownHeader.addEventListener('click', () => {
    layerDropdown.classList.toggle('active');
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (!layerDropdown.contains(e.target)) {
        layerDropdown.classList.remove('active');
    }
});

// Handle layer selection
layerOptions.forEach(option => {
    option.addEventListener('click', () => {
        const value = option.getAttribute('data-value');
        const text = option.querySelector('span').textContent;
        
        // Update selected state
        layerOptions.forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
        
        // Update dropdown header
        selectedLayerText.textContent = text;
        
        // Change map layer
        if (value === 'satellite') {
            map.removeLayer(roadLayer);
            map.removeLayer(terrainLayer);
            satelliteLayer.addTo(map);
            currentLayer = 'satellite';
        } else if (value === 'terrain') {
            map.removeLayer(satelliteLayer);
            map.removeLayer(roadLayer);
            terrainLayer.addTo(map);
            currentLayer = 'terrain';
        } else {
            map.removeLayer(satelliteLayer);
            map.removeLayer(terrainLayer);
            roadLayer.addTo(map);
            currentLayer = 'road';
        }
        
        // Close dropdown
        layerDropdown.classList.remove('active');
    });
});

var socket = io();
var micEnabled = false;
var markers = [];

document.getElementById("toggleMic").addEventListener("click", function () {
    micEnabled = !micEnabled;
    const micButton = this;
    const micWaves = micButton.querySelector('.mic-waves');
    const statusContainer = document.getElementById("status");
    
    if (micEnabled) {
        micButton.classList.add('active');
        micWaves.classList.add('active');
        statusContainer.classList.add('active');
        statusContainer.textContent = "Listening...";
        micButton.innerHTML = '<i class="fas fa-microphone"></i><div class="mic-waves"></div>';
        // Start initial listening
        socket.emit("start_recognition");
    } else {
        micButton.classList.remove('active');
        micWaves.classList.remove('active');
        statusContainer.classList.remove('active');
        statusContainer.textContent = "Microphone disabled";
        micButton.innerHTML = '<i class="fas fa-microphone"></i><div class="mic-waves"></div>';
    }
});

socket.on("recognized_command", function (data) {
    if (data.error) {
        console.log("Error:", data.error);
    } else {
        handleCommand(data);
    }
    // Continue listening after processing the command
    if (micEnabled) {
        socket.emit("start_recognition");
    }
});

function handleCommand(data) {
    switch(data.type) {
        case 'navigate':
            navigateToCity(data.latitude, data.longitude);
            addToHistory(`Navigated to ${data.city}`);
            break;
        case 'zoom':
            if (data.action === 'in') {
                map.zoomIn();
            } else if (data.action === 'out') {
                map.zoomOut();
            }
            break;
        case 'move':
            switch(data.direction) {
                case 'up':
                    map.panBy([0, -100]);
                    break;
                case 'down':
                    map.panBy([0, 100]);
                    break;
                case 'left':
                    map.panBy([-100, 0]);
                    break;
                case 'right':
                    map.panBy([100, 0]);
                    break;
            }
            break;
        case 'show':
        case 'hide':
            toggleLayer(data.layer, data.type === 'show');
            break;
        case 'center':
            map.setView([data.latitude, data.longitude], map.getZoom());
            break;
        case 'marker':
            addMarker(data.latitude, data.longitude);
            break;
    }
    // Update status to indicate ready for next command
    if (micEnabled) {
        document.getElementById("status").textContent = "Listening...";
    }
}

function navigateToCity(lat, lon) {
    clearMarkers();
    addMarker(lat, lon);
    map.setView([lat, lon], 13);
}

function addMarker(lat, lon) {
    var marker = L.marker([lat, lon]).addTo(map);
    markers.push(marker);
}

function clearMarkers() {
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
}

function toggleLayer(layerName, show) {
    switch(layerName.toLowerCase()) {
        case 'satellite':
            if (show) {
                map.removeLayer(roadLayer);
                map.removeLayer(terrainLayer);
                satelliteLayer.addTo(map);
                currentLayer = 'satellite';
                document.querySelector('.layer-option[data-value="satellite"]').classList.add('selected');
                document.querySelector('.layer-option[data-value="road"]').classList.remove('selected');
                document.querySelector('.layer-option[data-value="terrain"]').classList.remove('selected');
                selectedLayerText.textContent = 'Satellite View';
            } else {
                map.removeLayer(satelliteLayer);
                roadLayer.addTo(map);
                currentLayer = 'road';
                document.querySelector('.layer-option[data-value="road"]').classList.add('selected');
                document.querySelector('.layer-option[data-value="satellite"]').classList.remove('selected');
                document.querySelector('.layer-option[data-value="terrain"]').classList.remove('selected');
                selectedLayerText.textContent = 'Road Layer';
            }
            break;
        case 'road':
            if (show) {
                map.removeLayer(satelliteLayer);
                map.removeLayer(terrainLayer);
                roadLayer.addTo(map);
                currentLayer = 'road';
                document.querySelector('.layer-option[data-value="road"]').classList.add('selected');
                document.querySelector('.layer-option[data-value="satellite"]').classList.remove('selected');
                document.querySelector('.layer-option[data-value="terrain"]').classList.remove('selected');
                selectedLayerText.textContent = 'Road Layer';
            } else {
                map.removeLayer(roadLayer);
                satelliteLayer.addTo(map);
                currentLayer = 'satellite';
                document.querySelector('.layer-option[data-value="satellite"]').classList.add('selected');
                document.querySelector('.layer-option[data-value="road"]').classList.remove('selected');
                document.querySelector('.layer-option[data-value="terrain"]').classList.remove('selected');
                selectedLayerText.textContent = 'Satellite View';
            }
            break;
        case 'terrain':
            if (show) {
                map.removeLayer(satelliteLayer);
                map.removeLayer(roadLayer);
                terrainLayer.addTo(map);
                currentLayer = 'terrain';
                document.querySelector('.layer-option[data-value="terrain"]').classList.add('selected');
                document.querySelector('.layer-option[data-value="satellite"]').classList.remove('selected');
                document.querySelector('.layer-option[data-value="road"]').classList.remove('selected');
                selectedLayerText.textContent = 'Terrain View';
            } else {
                map.removeLayer(terrainLayer);
                roadLayer.addTo(map);
                currentLayer = 'road';
                document.querySelector('.layer-option[data-value="road"]').classList.add('selected');
                document.querySelector('.layer-option[data-value="satellite"]').classList.remove('selected');
                document.querySelector('.layer-option[data-value="terrain"]').classList.remove('selected');
                selectedLayerText.textContent = 'Road Layer';
            }
            break;
    }
}

function addToHistory(command) {
    // Only add navigation commands to history
    if (command.startsWith('Navigated to')) {
        historyList.unshift({
            id: Date.now(),
            text: command
        });
        if (historyList.length > 10) historyList.pop();
        updateHistoryDisplay();
        // Save to localStorage
        localStorage.setItem('mapHistory', JSON.stringify(historyList));
    }
}

function deleteHistoryItem(id) {
    historyList = historyList.filter(item => item.id !== id);
    updateHistoryDisplay();
    localStorage.setItem('mapHistory', JSON.stringify(historyList));
}

function updateHistoryDisplay() {
    const historyContainer = document.getElementById("historyList");
    historyContainer.innerHTML = "";
    historyList.forEach(item => {
        const div = document.createElement("div");
        div.className = "history-item";
        
        const textSpan = document.createElement("span");
        textSpan.textContent = item.text;
        
        const deleteButton = document.createElement("span");
        deleteButton.className = "delete-history";
        deleteButton.innerHTML = '<i class="fas fa-times"></i>';
        deleteButton.onclick = () => deleteHistoryItem(item.id);
        
        div.appendChild(textSpan);
        div.appendChild(deleteButton);
        historyContainer.appendChild(div);
    });
}

// Mouse position display
map.on('mousemove', function(e) {
    document.getElementById("coordsDisplay").textContent = 
        `Lat: ${e.latlng.lat.toFixed(4)}, Lon: ${e.latlng.lng.toFixed(4)}`;
});

// Create offline indicator
const offlineIndicator = document.createElement('div');
offlineIndicator.className = 'offline-indicator';
offlineIndicator.innerHTML = '<i class="fas fa-wifi"></i> Offline'; // Initial text
document.body.appendChild(offlineIndicator);

// Check internet connectivity
function updateOnlineStatus() {
    if (navigator.onLine) {
        // Change the indicator to "Back Online" (green) and text
        offlineIndicator.classList.add('online');
        offlineIndicator.innerHTML = '<i class="fas fa-wifi"></i> Back Online!'; // Change text to "Back Online"
        
        // Wait for a short moment before starting the fade-out animation
        setTimeout(() => {
            offlineIndicator.innerHTML = '<i class="fas fa-wifi"></i> Offline!'; // Change text to "Back Online"
            // Add the reverse animation to hide the indicator
            offlineIndicator.classList.add('hide');
            
            // Wait for the animation to complete before setting display: none
            setTimeout(() => {
                offlineIndicator.style.display = 'none'; // Hide after animation
                offlineIndicator.classList.remove('show', 'hide', 'online'); // Clean up the classes
            }, 500); // Duration of the animation (500ms matches the CSS transition)
        }, 1000); // Show "Back Online" for 1 second before fading out
    } else {
        // Display the indicator with the show animation
        offlineIndicator.style.display = 'flex';
        setTimeout(() => {
            offlineIndicator.classList.add('show');
        }, 10);
    }
}

// Listen to the online and offline events
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

// Initial check
updateOnlineStatus();
