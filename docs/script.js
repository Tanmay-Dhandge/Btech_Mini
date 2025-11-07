// --- ⚠️ 1. CONFIGURE YOUR MQTT BROKER (Existing Code) ⚠️ ---
const MQTT_BROKER_URL = "afc8a0ac2ccf462c8f92b932403518df.s1.eu.hivemq.cloud";
const MQTT_PORT = 8884; // Your WebSocket port (usually 8884 for HiveMQ)
const MQTT_USER = "hivemq.webclient.1761751067946";
const MQTT_PASS = "wy.b7f8cB*0GTUW&4Ha:";

// --- ⚠️ 2. CONFIGURE YOUR RENDER BACKEND (Existing Code) ⚠️ ---
const RENDER_BACKEND_URL = "https://live-videofeed.onrender.com";
// -----------------------------------------------------

// --- MQTT Client (Existing Code) ---
var client = new Paho.MQTT.Client(MQTT_BROKER_URL, MQTT_PORT, "web-client-" + parseInt(Math.random() * 100));
client.onConnectionLost = onConnectionLost;
client.onMessageArrived = onMessageArrived;

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
// --- Socket.IO Video Logic (Existing Code) ---
// -------------------------------------------------------------------
const videoSocket = io(RENDER_BACKEND_URL);

videoSocket.on('connect', () => {
    console.log('✅ Connected to Render video socket.');
    liveFeed.alt = "Connected, waiting for video stream...";
});
videoSocket.on('disconnect', () => {
    console.log('❌ Disconnected from Render video socket.');
    liveFeed.alt = "Feed disconnected. Trying to reconnect...";
});
videoSocket.on('new_frame_for_viewers', (data) => {
    liveFeed.src = 'data:image/jpeg;base64,' + data.frame;
});

// -------------------------------------------------------------------
// --- MQTT Logic (UPDATED) ---
// -------------------------------------------------------------------
function connectMqtt() {
    console.log("Connecting to MQTT broker...");
    statusText.textContent = "Connecting...";
    statusDot.style.background = "#f59e0b"; // Yellow
    client.connect({
        userName: MQTT_USER,
        password: MQTT_PASS,
        useSSL: true,
        onSuccess: onConnect,
        onFailure: onConnectionLost
    });
}
function onConnect() {
    console.log("✅ Connected to MQTT");
    statusText.textContent = "Connected";
    statusDot.style.background = "#10b981"; // Green
    // Subscribe to all topics
    client.subscribe("project/sensors");
    client.subscribe("project/status");
    client.subscribe("project/rfid"); // <-- NEW
}
function onConnectionLost(responseObject) {
    console.log("❌ MQTT Connection lost: " + responseObject.errorMessage);
    statusText.textContent = "Disconnected";
    statusDot.style.background = "#ef4444"; // Red
    setTimeout(connectMqtt, 3000);
}
function onMessageArrived(message) {
    try {
        const data = JSON.parse(message.payloadString);
        
        if (message.destinationName === "project/sensors") {
            updateSensorReadings(data);
        } else if (message.destinationName === "project/status") {
            updateControls(data);
        } else if (message.destinationName === "project/rfid") {
            updateRfidStatus(data);
        }

    } catch (e) {
        console.error("Error parsing JSON message:", e, message.payloadString);
    }
}

// --- MQTT Helper Functions (UPDATED) ---

function updateSensorReadings(data) {
    // Helper to safely update text
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

// NEW function to handle RFID topic
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

// --- MQTT Publisher Functions (UPDATED) ---

function publishControl(message) {
    if (!client.isConnected()) {
        alert("Not connected to control server.");
        return;
    }
    var m = new Paho.MQTT.Message(message);
    m.destinationName = "project/control";
    client.send(m);
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

// NEW function for door
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
// --- Page Load (UPDATED) ---
// -------------------------------------------------------------------
window.addEventListener('load', () => {
    // Start MQTT connection
    connectMqtt();
    
    // Add listener for the mode toggle
    modeToggle.addEventListener("change", toggleMode);
    
    // Add an error handler for the video feed
    liveFeed.addEventListener('error', () => {
        liveFeed.alt = 'Error in video stream. Reconnecting...';
    });
});
