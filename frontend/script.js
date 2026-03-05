document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("prediction-form");
    const runBtn = document.getElementById("run-btn");
    const loading = document.getElementById("loading");
    const inventoryBody = document.getElementById("inventory-body");
    const emptyRow = document.getElementById("empty-row");
    const logsContainer = document.getElementById("logs-container");

    // Replace with your actual deployed Azure Function App URL
    const API_URL = "https://disaster-ml-api-a8bab2eqhtg7afas.eastasia-01.azurewebsites.net/api/predict_supply";

    function addLog(message, type = "normal") {
        const now = new Date();
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

        const logEntry = document.createElement("div");
        logEntry.className = `log-entry ${type}`;
        logEntry.innerHTML = `<span class="timestamp">[${timeString}]</span> ${message}`;

        logsContainer.appendChild(logEntry);
        logsContainer.scrollTop = logsContainer.scrollHeight;
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        // 1. Gather Data
        const formData = new FormData(form);
        const requestData = {
            product: formData.get("product"),
            current_stock: parseInt(formData.get("current_stock")),
            month: parseInt(formData.get("month")),
            promotions_active: parseInt(formData.get("promotions_active")),
            past_sales: parseInt(formData.get("past_sales"))
        };

        // 2. UI Loading State
        runBtn.disabled = true;
        loading.classList.remove("hidden");
        addLog(`Initiating Agent Engine for ${requestData.product}...`, "info");

        try {
            // 3. Call Azure Function (Predict Supply Endpoint)
            addLog(`Sending POST request to Function App...`, "normal");
            const response = await fetch(API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Failed to fetch prediction");
            }

            const data = await response.json();

            // 4. Update UI with Results
            addLog(`Response received. Forecast: ${data.predicted_demand} units.`, "success");

            if (data.decision === "REORDER NEEDED") {
                addLog(`⚠️ ALERT: Low stock detected! Triggering notification workflow via Service Bus...`, "alert");
            } else {
                addLog(`✓ Stock sufficient. No action required.`, "success");
            }

            // Remove empty state if present
            if (emptyRow) {
                emptyRow.style.display = 'none';
            }

            // Create new row in the table
            const row = document.createElement("tr");
            row.className = "data-row";

            // Format Badge
            let badgeClass = data.decision === "REORDER NEEDED" ? "status-reorder" : "status-ok";
            let icon = data.decision === "REORDER NEEDED" ? "⚠️" : "✓";

            row.innerHTML = `
                <td><strong>${data.product}</strong></td>
                <td>${data.current_stock}</td>
                <td>${data.predicted_demand}</td>
                <td><span class="status-badge ${badgeClass}">${icon} ${data.decision}</span></td>
            `;

            // Prepend so newest is on top
            inventoryBody.insertBefore(row, inventoryBody.firstChild);

        } catch (error) {
            console.error(error);
            addLog(`ERROR: ${error.message}`, "alert");
            addLog(`Ensure the Azure Function is running locally on port 7071 and CORS is allowed.`, "normal");
        } finally {
            // Restore UI
            runBtn.disabled = false;
            loading.classList.add("hidden");
        }
    });
});
