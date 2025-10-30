// --- ⚠️ 1. CONFIGURE YOUR MQTT BROKER ⚠️ ---
const MQTT_BROKER_URL = "afc8a0ac2ccf462c8f92b932403518df.s1.eu.hivemq.cloud";
const MQTT_PORT = 8884; // Your WebSocket port (usually 8884 for HiveMQ)
const MQTT_USER = "hivemq.webclient.1761751067946";
const MQTT_PASS = "wy.b7f8cB*0GTUW&4Ha:";
// ---

// --- MQTT Client ---
var client = new Paho.MQTT.Client(MQTT_BROKER_URL, MQTT_PORT, "web-client-" + parseInt(Math.random() * 100));
client.onConnectionLost = onConnectionLost;
client.onMessageArrived = onMessageArrived;

// --- DOM Elements ---
let statusText = document.getElementById('status');
let statusDot = document.getElementById('status-dot');

// Dashboard controls
let fanControl = document.getElementById("fan-control");
let lightControl = document.getElementById("light-control");
let fanStatus = document.getElementById("fan-status");
let lightStatus = document.getElementById("light-status");
let modeToggle = document.getElementById("mode-toggle");

// Surveillance controls
let feedUrlInput = document.getElementById('feedUrlInput');
let setFeedUrlButton = document.getElementById('setFeedUrlButton');
let liveFeed = document.getElementById('liveFeed');

// --- Key for Browser Storage ---
const STORAGE_KEY = 'liveFeedUrl';

// -------------------------------------------------------------------
// --- Page Navigation ---
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
// --- Surveillance Logic (NEW) ---
// -------------------------------------------------------------------

// Saves the new URL and updates the image
function setFeedUrl() {
    const baseUrl = feedUrlInput.value.trim();
    if (!baseUrl) {
        alert("Please paste the Pinggy URL (e.g., https://...)");
        return;
    }

    // Save the base URL to the browser's local storage
    localStorage.setItem(STORAGE_KEY, baseUrl);
    
    // Update the image source
    // We automatically add the "/video" part for you
    liveFeed.src = baseUrl + "/video";
}

// Handles a broken video feed
function handleFeedError() {
    liveFeed.src = ''; // Clear the broken source
    liveFeed.alt = 'Feed not available. Check URL or click "Visit Site" in a new tab.';
    console.error("Feed error. Make sure your Python server is running and you clicked 'Visit Site' on the warning page.");
}

// -------------------------------------------------------------------
// --- MQTT Logic ---
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
    client.subscribe("project/status");
    client.subscribe("project/sensors");
}

function onConnectionLost(responseObject) {
    console.log("❌ Connection lost: " + responseObject.errorMessage);
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
        }
    } catch (e) {
        console.error("Error parsing JSON message:", e);
    }
}

// --- MQTT Dashboard Functions ---

function updateSensorReadings(data) {
    document.getElementById('insideTemp').textContent = data.insideTemp.toFixed(1);
    document.getElementById('insideHum').textContent = data.insideHum.toFixed(1);
    document.getElementById('outsideTemp').textContent = data.outsideTemp.toFixed(1);
    document.getElementById('outsideHum').textContent = data.outsideHum.toFixed(1);
    document.getElementById('outsidePress').textContent = data.outsidePress.toFixed(0);
    document.getElementById('lightLux').textContent = data.lightLux.toFixed(1);
}

function updateControls(data) {
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
    if (modeToggle.checked) {
        var message = new Paho.MQTT.Message("fan-toggle");
        message.destinationName = "project/control";
        client.send(message);
    } else {
        alert("Switch to Manual mode to control the fan.");
    }
}

function toggleLight() {
    if (modeToggle.checked) {
        var message = new Paho.MQTT.Message("light-toggle");
        message.destinationName = "project/control";
        client.send(message);
    } else {
        alert("Switch to Manual mode to control the light.");
    }
}

function toggleMode() {
    var message = new Paho.MQTT.Message("mode-toggle");
    message.destinationName = "project/control";
    client.send(message);
}

// -------------------------------------------------------------------
// --- Page Load ---
// -------------------------------------------------------------------

window.addEventListener('load', () => {
    // Start MQTT
    connectMqtt();
    
    // Add listener for the mode toggle
    modeToggle.addEventListener("change", toggleMode);

    // --- Add Listeners for new Surveillance controls ---
    setFeedUrlButton.addEventListener('click', setFeedUrl);
    liveFeed.addEventListener('error', handleFeedError);

    // --- Load saved URL from browser memory ---
    const savedUrl = localStorage.getItem(STORAGE_KEY);
    if (savedUrl) {
        feedUrlInput.value = savedUrl;
        liveFeed.src = savedUrl + "/video";
    }
});
