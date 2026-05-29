// ================= LOGIN =================

async function login() {

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    const response = await fetch("http://127.0.0.1:5000/login", {

        method: "POST",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify({
            username,
            password
        })

    });

    const data = await response.json();

    if (data.token) {

        localStorage.setItem("token", data.token);

        window.location.href = "index.html";

    } else {

        alert(data.msg || "Login Failed");
    }
}


document.addEventListener("DOMContentLoaded", function() {
    const path = window.location.pathname;
    if (path.endsWith("index.html") || path.endsWith("/") || path.endsWith("dashboard.html")) {
        if (!localStorage.getItem("token")) {
            window.location.href = "login.html";
            return;
        }

        loadSavedPrediction();
        loadRecentHistory();
    }
});

async function loadRecentHistory() {
    const token = localStorage.getItem("token");

    const response = await fetch("http://127.0.0.1:5000/history", {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const error = await response.json();
        document.getElementById("history").innerHTML = `<p style='color:#ff9aa2;'>${error.msg || error.error || 'Unable to load history.'}</p>`;
        return;
    }

    const data = await response.json();
    document.getElementById("history").innerHTML = renderHistoryOutput(data, 10);
}

function savePredictionState(data) {
    try {
        localStorage.setItem("lastPrediction", JSON.stringify(data));
    } catch (error) {
        console.warn("Could not save prediction state", error);
    }
}

function clearPredictionView() {
    const output = document.getElementById("output");
    output.innerHTML = "<p>Uploading file and running prediction... Please wait.</p>";

    if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
    }

    const mapContainer = document.getElementById("map");
    if (mapContainer) {
        mapContainer.innerHTML = "";
    }
}

function loadSavedPrediction() {
    const saved = localStorage.getItem("lastPrediction");
    if (!saved) {
        return;
    }

    try {
        const data = JSON.parse(saved);
        if (!data || !data.prediction) {
            return;
        }

        document.getElementById("output").innerHTML = renderPredictionOutput(data.prediction, data.accuracy);

        drawChart(data.prediction);
        loadMap(data.prediction);
    } catch (error) {
        console.warn("Could not restore prediction state", error);
    }
}


// ================= REGISTER =================

async function register() {

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    const response = await fetch("http://127.0.0.1:5000/register", {

        method: "POST",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify({
            username,
            password
        })

    });

    const data = await response.json();

    alert(data.msg);
}


// ================= PREDICTION =================

async function sendData(event) {

    if (event && event.preventDefault) {
        event.preventDefault();
    }

    const fileInput = document.getElementById("file");

    if (fileInput.files.length === 0) {

        alert("Please upload CSV file");
        return;
    }

    const file = fileInput.files[0];

    const formData = new FormData();
    formData.append("file", file);

    const token = localStorage.getItem("token");

    if (!token) {

        alert("Session expired. Login again.");
        window.location.href = "login.html";
        return;
    }

    clearPredictionView();
    document.getElementById("loader").style.display = "block";

    try {

        const response = await fetch("http://127.0.0.1:5000/predict", {

            method: "POST",

            headers: {
                Authorization: `Bearer ${token}`
            },

            body: formData
        });

        const data = response.ok ? await response.json() : await response.json();

        document.getElementById("loader").style.display = "none";

        console.log(data);

        if (!response.ok) {
            alert(data.error || data.msg || "Prediction Failed");
            return;
        }

        // ================= OUTPUT =================

        document.getElementById("output").innerHTML = renderPredictionOutput(data.prediction, data.accuracy);

        savePredictionState(data);

        // ================= CHART =================

        try {
            drawChart(data.prediction);
        } catch (chartError) {
            console.warn("Chart render failed", chartError);
        }

        // ================= MAP =================

        try {
            loadMap(data.prediction);
        } catch (mapError) {
            console.warn("Map render failed", mapError);
        }

        // ================= HISTORY =================

        loadHistory();

    } catch (error) {

        console.log(error);

        document.getElementById("loader").style.display = "none";

        alert("Prediction Failed");
    }
}


// ================= MAP =================

function loadMap(predictions) {

    document.getElementById("map").innerHTML = "";

    const map = L.map("map", { scrollWheelZoom: false }).setView([12.97, 77.59], 6);

    map.keyboard.disable();

    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            attribution: "© OpenStreetMap"
        }
    ).addTo(map);

    predictions.forEach(item => {

        let color = item.prediction === 1 ? "red" : "green";

        L.circleMarker([item.lat, item.lon], {

            radius: 8,
            color: color

        })
        .addTo(map)
        .bindPopup(`
            Prediction: ${item.prediction}<br>
            Latitude: ${item.lat}<br>
            Longitude: ${item.lon}
        `);
    });

    setTimeout(() => {
        map.invalidateSize();
    }, 50);
}

function renderPredictionOutput(predictions, accuracy) {
    const normalCount = predictions.filter(item => item.prediction === 0).length;
    const alertCount = predictions.filter(item => item.prediction === 1).length;

    const rows = predictions.map((item, index) => {
        const label = item.prediction === 1 ? "Alert" : "Normal";
        const className = item.prediction === 1 ? "status alert" : "status ok";

        return `
            <tr>
                <td>${index + 1}</td>
                <td>${item.lat}</td>
                <td>${item.lon}</td>
                <td><span class="${className}">${label}</span></td>
            </tr>
        `;
    }).join("");

    return `
        <div class="prediction-summary">
            <span><strong>Total points:</strong> ${predictions.length}</span>
            <span><strong>Normal:</strong> ${normalCount}</span>
            <span><strong>Alert:</strong> ${alertCount}</span>
            <span><strong>Accuracy:</strong> ${accuracy ?? "N/A"}</span>
        </div>
        <div class="prediction-table-wrapper">
            <table class="prediction-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Latitude</th>
                        <th>Longitude</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        </div>
    `;
}


// ================= CHART =================

let chartInstance = null;

function drawChart(predictions) {

    const canvas = document.getElementById("chart");
    const ctx = canvas.getContext("2d");

    const normalCount = predictions.filter(item => item.prediction === 0).length;
    const alertCount = predictions.filter(item => item.prediction === 1).length;

    const labels = ["Normal", "Alert"];
    const values = [normalCount, alertCount];
    const backgroundColors = ["rgba(75, 192, 75, 0.7)", "rgba(255, 99, 132, 0.7)"];
    const borderColors = ["rgba(75, 192, 75, 1)", "rgba(255, 99, 132, 1)"];

    if (chartInstance) {
        chartInstance.destroy();
    }

    chartInstance = new Chart(ctx, {

        type: "bar",

        data: {
            labels: labels,
            datasets: [{
                label: "Prediction count",
                data: values,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 2
            }]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0,
                        stepSize: 1
                    },
                    title: {
                        display: true,
                        text: "Count"
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: "Prediction type"
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ${context.formattedValue}`;
                        }
                    }
                }
            }
        }
    });
}


// ================= HISTORY =================

async function loadHistory() {

    const token = localStorage.getItem("token");

    const response = await fetch("http://127.0.0.1:5000/history", {

        method: "GET",

        headers: {
            Authorization: `Bearer ${token}`
        }

    });

    if (!response.ok) {
        const error = await response.json();
        document.getElementById("history").innerHTML = `<p style='color:#ff9aa2;'>${error.msg || error.error || 'Unable to load history.'}</p>`;
        return;
    }

    const data = await response.json();

    document.getElementById("history").innerHTML = renderHistoryOutput(data, null);
}

function renderHistoryOutput(historyList, limit = 10) {
    if (!historyList || historyList.length === 0) {
        return "<p>No history yet...</p>";
    }

    const total = historyList.length;
    const sortedHistory = [...historyList].reverse();
    const showList = limit && total > limit ? sortedHistory.slice(0, limit) : sortedHistory;
    const showingText = limit && total > limit ? `Showing latest ${limit} of ${total} sessions` : `Showing ${total} session${total !== 1 ? "s" : ""}`;

    const historyItems = showList.map((entry, idx) => {
        const records = entry.results ?? entry.predictions ?? [];
        const count = Array.isArray(records) ? records.length : 0;
        const timestamp = entry.timestamp ? new Date(entry.timestamp).toLocaleString() : "Unknown time";
        const details = Array.isArray(records) ? records.slice(0, 5).map(record => {
            if (record && record.lat !== undefined && record.lon !== undefined) {
                return `<li>${record.prediction} @ ${record.lat}, ${record.lon}</li>`;
            }
            return `<li>${JSON.stringify(record)}</li>`;
        }).join("") : "";

        return `
            <div class="history-item">
                <div class="history-meta">
                    <strong>Session ${total - idx}</strong>
                    <span>${timestamp}</span>
                </div>
                <p>Predictions: ${count} point${count !== 1 ? "s" : ""}</p>
                ${details ? `<ul>${details}</ul>` : ""}
            </div>
        `;
    }).join("");

    const moreNote = limit && total > limit ? `<div class="history-note">Click the History button to view full history.</div>` : "";

    return `
        <div class="history-summary">${showingText}</div>
        ${moreNote}
        <div class="history-list">
            ${historyItems}
        </div>
    `;
}


// ================= ADMIN =================

async function goAdmin() {

    const token = localStorage.getItem("token");

    const response = await fetch("http://127.0.0.1:5000/admin", {

        method: "GET",

        headers: {
            Authorization: `Bearer ${token}`
        }

    });

    const data = await response.json();

    alert(JSON.stringify(data, null, 2));
}


// ================= LOGOUT =================

function logout() {

    localStorage.removeItem("token");
    localStorage.removeItem("lastPrediction");

    alert("Logged out");

    window.location.href = "login.html";
}