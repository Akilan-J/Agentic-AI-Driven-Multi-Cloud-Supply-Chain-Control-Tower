document.addEventListener("DOMContentLoaded", () => {
    // Auth Check
    if (!localStorage.getItem('auth_token')) {
        window.location.href = 'login.html';
    }

    const form = document.getElementById("prediction-form");
    const logoutBtn = document.getElementById("logout-btn");
    const runBtn = document.getElementById("run-btn");
    const loading = document.getElementById("loading");
    const inventoryBody = document.getElementById("inventory-body");
    const emptyRow = document.getElementById("empty-row");
    const logsContainer = document.getElementById("logs-container");

    let predictionChart = null;

    // Initialize Chart
    function initChart() {
        const ctx = document.getElementById('predictionChart').getContext('2d');
        predictionChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Past Sales', 'Current Stock', 'Forecast Demand'],
                datasets: [{
                    label: 'Inventory Levels',
                    data: [0, 0, 0],
                    borderColor: '#38bdf8',
                    backgroundColor: 'rgba(56, 189, 248, 0.2)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#38bdf8',
                    pointRadius: 6,
                    pointHoverRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#94a3b8' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#94a3b8' }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleColor: '#38bdf8',
                        bodyColor: '#fff',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1
                    }
                }
            }
        });
    }

    function updateChart(pastSales, currentStock, predictedDemand) {
        if (!predictionChart) initChart();
        predictionChart.data.datasets[0].data = [pastSales, currentStock, predictedDemand];
        predictionChart.update();
    }

    function addLog(message, type = "normal") {
        const now = new Date();
        const timeString = now.toLocaleTimeString();
        const logEntry = document.createElement("div");
        logEntry.className = `log-entry ${type}`;
        logEntry.innerHTML = `<span class="timestamp">[${timeString}]</span> ${message}`;
        logsContainer.prepend(logEntry);
    }

    function renderResult(result) {
        if (emptyRow) emptyRow.style.display = 'none';

        const row = document.createElement('tr');
        row.className = 'fade-in';
        row.innerHTML = `
            <td><strong>${result.product}</strong></td>
            <td>${result.current_stock}</td>
            <td>${result.predicted_demand}</td>
            <td><span class="badge ${result.decision === 'REORDER NEEDED' ? 'warning' : 'success'}">${result.decision}</span></td>
        `;
        inventoryBody.prepend(row);
    }

    // Logout
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('auth_token');
        window.location.href = 'login.html';
    });

    // Form Submit
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const requestData = {
            product: formData.get("product"),
            current_stock: parseInt(formData.get("current_stock")),
            month: parseInt(formData.get("month")),
            promotions_active: parseInt(formData.get("promotions_active")),
            past_sales: parseInt(formData.get("past_sales"))
        };

        runBtn.disabled = true;
        loading.classList.remove("hidden");
        addLog(`Initiating Agent Engine for ${requestData.product}...`, "info");

        try {
            // Note: Update URL to your production endpoint when ready
            const API_URL = "http://localhost:7071/api/predict_supply";
            const response = await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) throw new Error("API request failed");
            const data = await response.json();

            addLog(`Response received. Forecast: ${data.predicted_demand} units.`, "success");
            renderResult(data);
            updateChart(requestData.past_sales, requestData.current_stock, data.predicted_demand);

        } catch (error) {
            addLog(`Offline/Error: ${error.message}. Running simulation...`, "normal");
            // Simulation for demo
            const simulated = {
                product: requestData.product,
                current_stock: requestData.current_stock,
                predicted_demand: Math.floor(Math.random() * 50) + 30,
                decision: requestData.current_stock < 50 ? "REORDER NEEDED" : "STOCK OK"
            };
            setTimeout(() => {
                renderResult(simulated);
                updateChart(requestData.past_sales, requestData.current_stock, simulated.predicted_demand);
            }, 500);
        } finally {
            runBtn.disabled = false;
            loading.classList.add("hidden");
        }
    });

    // Init
    initChart();
});
