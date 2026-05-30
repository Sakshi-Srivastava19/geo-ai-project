// ===== DEBUG =====
console.log("JS Loaded");
const API_URL = "https://geo-ai-project-backend1.onrender.com";
// ===== SEND DATA =====
function sendData(event) {
    if (event) event.preventDefault(); // 🔥 prevent refresh

    let fileInput = document.getElementById("file");

    if (fileInput.files.length === 0) {
        alert("Upload CSV first!");
        return;
    }

    let token = localStorage.getItem("token");
    if (!token) {
        alert("Please login first!");
        window.location.href = "login.html";
        return;
    }

    document.getElementById("loader").style.display = "block";

    let formData = new FormData();
    formData.append("file", fileInput.files[0]);

    fetch(`${API_URL}/predict`, {
        method: "POST",
        headers: {
            "Authorization": "Bearer " + token
        },
        body: formData
    })
    .then(res => res.json())
    .then(data => {
        document.getElementById("loader").style.display = "none";

        if (data.error || data.msg) {
            document.getElementById("output").innerText =
                data.error || data.msg;
            return;
        }

        let prediction = data.prediction || [];
        let accuracy = data.accuracy || "N/A";
        let dataRows = data.data || [];

        let outputText =
            "Prediction: " + JSON.stringify(prediction) +
            "\nAccuracy: " + accuracy;

        // ✅ Persist output
        localStorage.setItem("lastOutput", outputText);
        localStorage.setItem("lastPredictions", JSON.stringify(prediction));
        localStorage.setItem("lastData", JSON.stringify(dataRows));
        localStorage.setItem("lastAccuracy", accuracy);
        window.lastOutput = outputText;
        document.getElementById("output").innerText = outputText;

        // ✅ Save clean history (NO undefined)
        if (prediction.length > 0) {
            saveHistory(prediction, accuracy);
            drawChart(prediction);
            drawMap(prediction, dataRows);
        }
    })
    .catch(err => {
        console.error(err);
        document.getElementById("loader").style.display = "none";
        document.getElementById("output").innerText = "Server error!";
    });
}

// ===== CHART =====
function drawChart(predictions) {
    let canvas = document.getElementById("chart");

    // 🔥 FIX: ensure canvas visible
    canvas.style.display = "block";

    if (window.chartInstance) {
        window.chartInstance.destroy();
    }

    let count1 = predictions.filter(x => x === 1).length;
    let count0 = predictions.filter(x => x === 0).length;

    window.chartInstance = new Chart(canvas, {
        type: "bar",
        data: {
            labels: ["Safe (0)", "Risk (1)"],
            datasets: [{
                label: "Prediction Count",
                data: [count0, count1]
            }]
        },
        options: {
            responsive: true
        }
    });
}

// ===== MAP =====
function drawMap(predictions, data) {
    let mapDiv = document.getElementById("map");

    // 🔥 clear old map
    mapDiv.innerHTML = "";

    window.map = L.map('map').setView([20.5937, 78.9629], 4);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png')
    .addTo(window.map);

    predictions.forEach((p, i) => {
        let lat = data[i].latitude;
        let lon = data[i].longitude;

        let color = p === 1 ? "red" : "green";

        L.circleMarker([lat, lon], {
            color: color,
            radius: 6
        })
        .addTo(window.map)
        .bindPopup("Prediction: " + p + "<br>Lat: " + lat + "<br>Lon: " + lon);
    });

    // 🔥 FIX: force map render
    setTimeout(() => {
        window.map.invalidateSize();
    }, 200);
}

// ===== HISTORY =====
function loadHistory() {
    let historyDiv = document.getElementById("history");

    let history = JSON.parse(localStorage.getItem("history")) || [];

    // 🔥 FIX: remove bad entries
    history = history.filter(h => h.prediction && h.accuracy);

    if (history.length === 0) {
        historyDiv.innerHTML = "No history found";
        return;
    }

    historyDiv.innerHTML = history.map(h =>
        `<div>Prediction: ${JSON.stringify(h.prediction)} <br> Accuracy: ${h.accuracy}</div><hr>`
    ).join("");
}

// ===== SAVE HISTORY =====
function saveHistory(prediction, accuracy) {
    let history = JSON.parse(localStorage.getItem("history")) || [];

    // 🔥 avoid saving undefined
    if (!prediction || !accuracy) return;

    history.push({ prediction, accuracy });

    localStorage.setItem("history", JSON.stringify(history));
}

// ===== ADMIN =====
function goAdmin() {
    window.location.href = "admin.html";
}

// ===== LOGOUT =====
function logout() {
    localStorage.removeItem("token");
    window.location.href = "login.html";
}

// ===== ON LOAD =====
window.onload = function() {
    let lastOutput = localStorage.getItem("lastOutput");
    if (lastOutput) {
        document.getElementById("output").innerText = lastOutput;
    }

    let lastPred = localStorage.getItem("lastPredictions");
    let lastData = localStorage.getItem("lastData");
    if (lastPred && lastData) {
        let pred = JSON.parse(lastPred);
        let data = JSON.parse(lastData);
        drawChart(pred);
        drawMap(pred, data);
    }
};