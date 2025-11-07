// --- ⚠️ 1. CONFIGURE YOUR RENDER BACKEND ⚠️ ---
// This is now the ONLY server we connect to
const RENDER_BACKEND_URL = "https://live-videofeed.onrender.com";
// -----------------------------------------------------

// --- DOM Elements ---
let statusText = document.getElementById('status');
let statusDot = document.getElementById('status-dot');
let liveFeed = document.getElementById('liveFeed');

// Control Elements
let fanControl = document.getElementById("fan-control");
let lightControl = document.getElementById("light-control");
let doorControl = document.getElementById("door-control");
let fanStatus = document.getElementById("fan-status");
let lightStatus = document.getElementById("light-status");
let doorStatus = document.getElementById("door-status");
let modeToggle = document.getElementById("mode-toggle");

// -------------------------------------------------------------------
// --- Page Navigation (Existing Code) ---
// -------------------------------------------------------------------
function showView(viewName) {
    if (viewName === 'dashboard') {
        document.getElementById('dashboard-view').style.display = 'block';
        document.getElementById('surveillance-view').style.display = 'none';
        document.getElementById('btn-dashboard').classList.add('active');
        document.getElementById('btn-surveillance').classList.remove('active');
    } else {
        document.getElementById('dashboard-view').style.display = 'none';
        document.getElementById('surveillance-view').style.display = 'block';
        document.getElementById('btn-dashboard').classList.remove('active');
        document.getElementById('btn-surveillance').classList.add('active');
    }
}

// -------------------------------------------------------------------
// --- Single Socket.IO Connection for EVERYTHING ---
// -------------------------------------------------------------------
const socket = io(RENDER_BACKEND_URL);

// --- Connection Status Handlers ---
socket.on('connect', () => {
    console.log('✅ Connected to Render server.');
    statusText.textContent = "Connected";
    statusDot.style.background = "#10b981"; // Green
    liveFeed.alt = "Connected, waiting for video stream...";
});

socket.on('disconnect', () => {
    console.log('❌ Disconnected from Render server.');
    statusText.textContent = "Disconnected";
    statusDot.style.background = "#ef4444"; // Red
    liveFeed.alt = "Feed disconnected. Trying to reconnect...";
});

// --- Event Listeners from Server ---

// 1. Listen for Video
socket.on('new_frame_for_viewers', (data) => {
    liveFeed.src = 'data:image/jpeg;base64,' + data.frame;
});

// 2. Listen for Sensor Data
socket.on('new_sensor_data', (data) => {
    // Data is a JSON string from ESP32, parse it
    try {
        const sensorData = JSON.parse(data);
        updateSensorReadings(sensorData);
    } catch (e) {
        console.error("Error parsing sensor data:", e, data);
    }
});

// 3. Listen for Control Status Data
socket.on('new_status_data', (data) => {
    try {
        const statusData = JSON.parse(data);
        updateControls(statusData);
    } catch (e) {
        console.error("Error parsing status data:", e, data);
    }
});

// 4. Listen for RFID Data
socket.on('new_rfid_data', (data) => {
    try {
        const rfidData = JSON.parse(data);
        updateRfidStatus(rfidData);
    } catch (e) {
        console.error("Error parsing rfid data:", e, data);
    }
});


// --- Helper Functions to Update Page ---

function updateSensorReadings(data) {
    const updateText = (id, value, decimals = 1) => {
        const el = document.getElementById(id);
        if (el && value != null) el.textContent = value.toFixed(decimals);
    };

    updateText('dht_temp', data.dht_temp);
    updateText('dht_humidity', data.dht_humidity);
    updateText('bmp_temp', data.bmp_temp);
    updateText('pressure_hpa', data.pressure_hpa, 0);
    updateText('lightPercent', data.lightPercent, 0);
    updateText('mq135', data.mq135, 0);
}

function updateControls(data) {
    // Fan
    if (data.fan) {
        fanControl.classList.add('active');
        fanStatus.textContent = "ON";
    } else {
        fanControl.classList.remove('active');
        fanStatus.textContent = "OFF";
    }
    // Light
    if (data.light) {
        lightControl.classList.add('active');
        lightStatus.textContent = "ON";
    } else {
        lightControl.classList.remove('active');
        lightStatus.textContent = "OFF";
    }
    // Door
    if (data.door) {
        doorControl.classList.add('active');
        doorStatus.textContent = "Unlocking...";
    } else {
        doorControl.classList.remove('active');
        doorStatus.textContent = "Locked";
    }
    // Mode
    const isManual = (data.mode === "Manual");
    modeToggle.checked = isManual;
    if (isManual) {
        fanControl.classList.remove('disabled');
        lightControl.classList.remove('disabled');
        doorControl.classList.remove('disabled');
    } else {
        fanControl.classList.add('disabled');
        lightControl.classList.add('disabled');
        doorControl.classList.add('disabled');
    }
}

function updateRfidStatus(data) {
    const rfidStatusEl = document.getElementById('door');
    const rfidUidEl = document.getElementById('lastRfid');

    if (data.access === "granted") {
        rfidStatusEl.textContent = "Access Granted";
        rfidStatusEl.style.color = "#10b981"; // Green
    } else {
        rfidStatusEl.textContent = "Access Denied";
        rfidStatusEl.style.color = "#ef4444"; // Red
    }
    rfidUidEl.textContent = data.uid;
}

// --- Publisher Functions (Sending to Render) ---

function publishControl(command) {
    if (!socket.connected) {
        alert("Not connected to control server.");
        return;
    }
    socket.emit("control_command_from_web", command);
}

function toggleFan() {
    if (modeToggle.checked) {
        publishControl("fan-toggle");
    } else {
        alert("Switch to Manual mode to control the fan.");
    }
}

function toggleLight() {
    if (modeToggle.checked) {
        publishControl("light-toggle");
    } else {
        alert("Switch to Manual mode to control the light.");
    }
}

function toggleDoor() {
     if (modeToggle.checked) {
        publishControl("door-toggle");
    } else {
        alert("Switch to Manual mode to control the door.");
    }
}

function toggleMode() {
    publishControl("mode-toggle");
}

// -------------------------------------------------------------------
// --- Page Load ---
// -------------------------------------------------------------------
window.addEventListener('load', () => {
    // Add listener for the mode toggle
    modeToggle.addEventListener("change", toggleMode);
    
    // Add an error handler for the video feed
    liveFeed.addEventListener('error', () => {
        liveFeed.alt = 'Error in video stream. Reconnecting...';
    });
    
    // NOTE: All connections now start automatically. No connectMqtt() needed.
});
