// --- ⚠️ 1. CONFIGURE YOUR MQTT BROKER (Existing Code) ⚠️ ---
const MQTT_BROKER_URL = "afc8a0ac2ccf462c8f92b932403518df.s1.eu.hivemq.cloud";
const MQTT_PORT = 8884; // Your WebSocket port (usually 8884 for HiveMQ)
const MQTT_USER = "hivemq.webclient.1761751067946";
const MQTT_PASS = "wy.b7f8cB*0GTUW&4Ha:";

// --- ⚠️ 2. CONFIGURE YOUR RENDER BACKEND (NEW) ⚠️ ---
// Paste the URL of your Render service
const RENDER_BACKEND_URL = "https://live-videofeed.onrender.com";
// -----------------------------------------------------

// --- MQTT Client (Existing Code) ---
var client = new Paho.MQTT.Client(MQTT_BROKER_URL, MQTT_PORT, "web-client-" + parseInt(Math.random() * 100));
client.onConnectionLost = onConnectionLost;
client.onMessageArrived = onMessageArrived;

// --- DOM Elements (Existing Code) ---
let statusText = document.getElementById('status');
let statusDot = document.getElementById('status-dot');
let fanControl = document.getElementById("fan-control");
let lightControl = document.getElementById("light-control");
let fanStatus = document.getElementById("fan-status");
let lightStatus = document.getElementById("light-status");
let modeToggle = document.getElementById("mode-toggle");
// ... (all your other sensor spans like insideTemp, etc.) ...

// --- NEW: Surveillance Elements ---
let liveFeed = document.getElementById('liveFeed');

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
// --- NEW: Socket.IO Video Logic ---
// -------------------------------------------------------------------
// This connects to your Render video relay
const videoSocket = io(RENDER_BACKEND_URL);

videoSocket.on('connect', () => {
    console.log('✅ Connected to Render video socket.');
    liveFeed.alt = "Connected, waiting for video stream...";
});

videoSocket.on('disconnect', () => {
    console.log('❌ Disconnected from Render video socket.');
    liveFeed.alt = "Feed disconnected. Trying to reconnect...";
});

// This is the main event! It fires every time a new frame arrives
videoSocket.on('new_frame_for_viewers', (data) => {
    // 'data.frame' contains the base64 string
    // 'data:image/jpeg;base64,' tells the browser to display this string as an image
    liveFeed.src = 'data:image/jpeg;base64,' + data.frame;
});

// -------------------------------------------------------------------
// --- MQTT Logic (This is all your existing code) ---
// --- LEAVE ALL OF THIS CODE AS-IS ---
// -------------------------------------------------------------------
function connectMqtt() {
    console.log("Connecting to MQTT broker...");
    statusText.textContent = "Connecting...";
    statusDot.style.background = "#f59e0b"; // Yellow
    // ... (rest of your existing function) ...
    client.connect({
        userName: MQTT_USER,
        password: MQTT_PASS,
        useSSL: true,
        onSuccess: onConnect,
        onFailure: onConnectionLost
    });
}
function onConnect() {
    // ... (rest of your existing function) ...
    console.log("✅ Connected to MQTT");
    statusText.textContent = "Connected";
    statusDot.style.background = "#10b981"; // Green
    client.subscribe("project/status");
    client.subscribe("project/sensors");
}
function onConnectionLost(responseObject) {
    // ... (rest of your existing function) ...
    console.log("❌ MQTT Connection lost: " + responseObject.errorMessage);
    statusText.textContent = "Disconnected";
    statusDot.style.background = "#ef4444"; // Red
    setTimeout(connectMqtt, 3000);
}
function onMessageArrived(message) {
    // ... (rest of your existing function) ...
    try {
        const data = JSON.parse(message.payloadString);
        if (message.destinationName === "project/sensors") {
            updateSensorReadings(data);
        } else if (message.destinationName === "project/status") {
            updateControls(data);
        }
    } catch (e) {
        console.error("Error parsing JSON message:", e);
    }
}
function updateSensorReadings(data) {
    // ... (all your existing sensor logic) ...
    document.getElementById('insideTemp').textContent = data.insideTemp.toFixed(1);
    document.getElementById('insideHum').textContent = data.insideHum.toFixed(1);
    document.getElementById('outsideTemp').textContent = data.outsideTemp.toFixed(1);
    document.getElementById('outsideHum').textContent = data.outsideHum.toFixed(1);
    document.getElementById('outsidePress').textContent = data.outsidePress.toFixed(0);
    document.getElementById('lightLux').textContent = data.lightLux.toFixed(1);
}
function updateControls(data) {
    // ... (all your existing control logic) ...
    modeToggle.checked = (data.mode === "Manual");
    
    if (data.fan) {
        fanControl.classList.add('active');
        fanStatus.textContent = "ON";
    } else {
        fanControl.classList.remove('active');
        fanStatus.textContent = "OFF";
    }
    
    if (data.light) {
        lightControl.classList.add('active');
        lightStatus.textContent = "ON";
    } else {
        lightControl.classList.remove('active');
        lightStatus.textContent = "OFF";
    }
    
    if (data.mode === "Manual") {
        fanControl.classList.remove('disabled');
        lightControl.classList.remove('disabled');
    } else {
        fanControl.classList.add('disabled');
        lightControl.classList.add('disabled');
    }
}
function toggleFan() {
    // ... (your existing toggleFan function) ...
    if (modeToggle.checked) {
        var message = new Paho.MQTT.Message("fan-toggle");
        message.destinationName = "project/control";
        client.send(message);
    } else {
        alert("Switch to Manual mode to control the fan.");
    }
}
function toggleLight() {
    // ... (your existing toggleLight function) ...
    if (modeToggle.checked) {
        var message = new Paho.MQTT.Message("light-toggle");
        message.destinationName = "project/control";
        client.send(message);
    } else {
        alert("Switch to Manual mode to control the light.");
    }
}
function toggleMode() {
    // ... (your existing toggleMode function) ...
    var message = new Paho.MQTT.Message("mode-toggle");
    message.destinationName = "project/control";
    client.send(message);
}

// -------------------------------------------------------------------
// --- Page Load (Updated) ---
// -------------------------------------------------------------------
window.addEventListener('load', () => {
    // Start MQTT connection (Existing)
    connectMqtt();
    
    // Add listener for the mode toggle (Existing)
    modeToggle.addEventListener("change", toggleMode);

    // REMOVE all the old 'setFeedUrlButton' and 'localStorage' listeners.
    // The video starts automatically now.
    
    // Add an error handler for the video feed
    liveFeed.addEventListener('error', () => {
        liveFeed.alt = 'Error in video stream. Reconnecting...';
    });
});
