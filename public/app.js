async function checkHealth() {
  const healthElement = document.getElementById("health");

  try {
    const response = await fetch("/api/health", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const status = await response.json();
    healthElement.textContent = status.status === "ok" ? "Server online" : "Server unavailable";
    healthElement.className = status.status === "ok" ? "health-ok" : "health-error";
  } catch (error) {
    healthElement.textContent = "Server unavailable";
    healthElement.className = "health-error";
  }
}

checkHealth();
