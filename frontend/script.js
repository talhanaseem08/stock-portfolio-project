let currentToken = null;
let currentFileType = null; // "stock" or "meta"
let metaPreviewData = null;
let removedColumns = new Set();
let activeCharts = {}; // to destroy old charts

// ---------- Form Submit ----------
document.getElementById("upload-form").addEventListener("submit", async function (e) {
  e.preventDefault(); // ✅ prevent reload

  const fileInput = document.getElementById("csvFile");
  if (!fileInput.files.length) return;

  const formData = new FormData();
  formData.append("file", fileInput.files[0]);

  try {
    let res = await fetch("http://127.0.0.1:5000/upload-csv", {
      method: "POST",
      body: formData
    });

    if (!res.ok) throw new Error("Upload failed");

    let data = await res.json();
    console.log("Upload response:", data);

    currentToken = data.token;
    currentFileType = data.summary.can_analyze ? "stock" : "meta";

    document.getElementById("upload-status").innerText =
      `File uploaded. Type: ${currentFileType.toUpperCase()}`;

    if (currentFileType === "meta") {
      metaPreviewData = data.preview;
      removedColumns.clear();
      showMetaCleanupModal(data.preview);
    } else {
      renderStockOverview(data);
      fetchStockAnalysis();
    }
  } catch (err) {
    console.error("Upload error:", err);
    alert("Failed to upload file. See console for details.");
  }
});

// ---------- Stock Overview ----------
function renderStockOverview(data) {
  document.getElementById("overview-section").style.display = "block";

  let kpiBox = document.getElementById("summary-kpis");
  kpiBox.innerHTML = `
    <div class="col-md-3"><div class="kpi-card">
      <div class="kpi-value">${data.summary.rows}</div>
      <div class="kpi-label">Rows</div>
    </div></div>
    <div class="col-md-3"><div class="kpi-card">
      <div class="kpi-value">${data.summary.cols}</div>
      <div class="kpi-label">Columns</div>
    </div></div>
    <div class="col-md-3"><div class="kpi-card">
      <div class="kpi-value">${(data.summary.date_min || "") + " → " + (data.summary.date_max || "")}</div>
      <div class="kpi-label">Date Range</div>
    </div></div>
  `;

  renderTable("preview-box", data.preview);

  let extraBox = document.getElementById("extra-kpis");
  extraBox.innerHTML = "";
  for (let key in data.extra) {
    extraBox.innerHTML += `
      <div class="col-md-3"><div class="kpi-card">
        <div class="kpi-value">${data.extra[key]}</div>
        <div class="kpi-label">${key}</div>
      </div></div>`;
  }
}

function renderMetaOverview(preview) {
  document.getElementById("overview-section").style.display = "block";

  

    



  renderTable("preview-box", preview);
}
//   fetch(`http://127.0.0.1:5000/analyze-meta/${currentToken}/charts`)
//     .then(res => res.json())
//     .then(charts => {
//       renderBarChart("exchangeBar", charts.exchange_bar, "Exchange", "Count", "Stocks per Exchange");
//       renderPieChart("marketPie", charts.market_category_pie, "Market Category", "Count", "Market Categories");

//       if (charts.scatter && charts.scatter.length > 0) {
//         renderBarChart("scatterPlot", charts.scatter, "Symbol", "Round Lot Size", "Symbol vs Round Lot Size");
//       }

//       renderBarChart("top10Bar", charts.top10, "Symbol", "Round Lot Size", "Top 10 by Round Lot Size");
//     });
// }


async function fetchmetaAnalysis() {
  if (!currentToken) return;


  console.log("fetchmetaAnalysis called, token:", currentToken);

  document.getElementById("meta-section").style.display = "block";


  // ✅ Fetch only charts, since backend has no meta metrics
  let resCharts = await fetch(`http://127.0.0.1:5000/analyze-meta/${currentToken}/charts`);
  let charts = await resCharts.json();

  if (charts.exchange_bar) {
    renderBarChart("exchangeBar", charts.exchange_bar, "Listing Exchange", "Count", "Stocks per Exchange");
  }
  if (charts.market_category_pie) {
    renderPieChart("marketPie", charts.market_category_pie, "Market Category", "Count", "Market Categories");
  }
  if (charts.scatter) {
    renderBarChart("scatterPlot", charts.scatter, "Symbol", "Round Lot Size", "Symbol vs Round Lot Size");
  }
}



// ---------- Fetch Stock Analysis ----------
async function fetchStockAnalysis() {
  if (!currentToken) return;

  document.getElementById("analysis-section").style.display = "block";

  let res = await fetch(`http://127.0.0.1:5000/analyze/${currentToken}/metrics`);
  let metrics = await res.json();
  let kpiBox = document.getElementById("metrics-kpis");
  kpiBox.innerHTML = "";
  for (let key in metrics) {
    kpiBox.innerHTML += `
      <div class="col-md-3"><div class="kpi-card">
        <div class="kpi-value">${metrics[key]}</div>
        <div class="kpi-label">${key}</div>
      </div></div>`;
  }

  let resCharts = await fetch(`http://127.0.0.1:5000/analyze/${currentToken}/charts`);
  let charts = await resCharts.json();

  renderLineChart("priceChart", charts.price_chart, "Close", "Stock Price Over Time");
  renderMultiLineChart("maChart", charts.ma_chart, ["Close", "MA20", "MA50"], "Moving Averages");
  renderLineChart("volatilityChart", charts.volatility, "Rolling_Volatility", "20-Day Rolling Volatility");
}

// ---------- Meta Cleanup Modal ----------
function showMetaCleanupModal(preview) {
  const modal = new bootstrap.Modal(document.getElementById("metaCleanupModal"));
  renderCleanupTable(preview);
  modal.show();
}

function createPreviewTable(data) {
  if (!data || data.length === 0) return "<p>No preview data available.</p>";

  const headers = Object.keys(data[0]);
  let tableHTML = `<table class="table table-dark table-striped"><thead><tr>`;

  headers.forEach(header => {
    tableHTML += `
      <th scope="col" data-column-name="${header}">
        ${header}
        <button type="button" class="btn btn-sm btn-outline-danger remove-column-btn" data-column="${header}">❌</button>
      </th>`;
  });

  tableHTML += `</tr></thead><tbody>`;

  data.forEach(row => {
    tableHTML += `<tr>`;
    headers.forEach(header => {
      tableHTML += `<td>${row[header]}</td>`;
    });
    tableHTML += `</tr>`;
  });

  tableHTML += `</tbody></table>`;
  return tableHTML;
}




function renderCleanupTable(preview) {
  const box = document.getElementById("cleanup-preview");
  box.innerHTML = "";

  if (!preview.length) return;
  const cols = Object.keys(preview[0]);

  let html = `<table class="table table-dark table-bordered"><thead><tr>`;
  cols.forEach(col => {
    const removed = removedColumns.has(col) ? "column-removed" : "";
    html += `<th class="${removed}">
      ${col} <button class="btn btn-sm btn-danger ms-1" onclick="toggleRemoveColumn('${col}')">X</button>
    </th>`;
  });
  html += `</tr></thead><tbody>`;

  preview.slice(0, 10).forEach(row => {
    html += `<tr>`;
    cols.forEach(col => {
      const removed = removedColumns.has(col) ? "column-removed" : "";
      html += `<td class="${removed}">${row[col]}</td>`;
    });
    html += `</tr>`;
  });

  html += `</tbody></table>`;
  box.innerHTML = html;
}

function toggleRemoveColumn(col) {
  if (removedColumns.has(col)) {
    removedColumns.delete(col);
  } else {
    removedColumns.add(col);
  }
  renderCleanupTable(metaPreviewData);
}

document.getElementById("saveMetaCleanup").addEventListener("click", async () => {
  let cleaned = metaPreviewData.map(row => {
    let r = {};
    for (let key in row) {
      if (!removedColumns.has(key)) r[key] = row[key];
    }
    return r;
  });

  renderMetaOverview(cleaned);

  bootstrap.Modal.getInstance(document.getElementById("metaCleanupModal")).hide();

   await fetchmetaAnalysis();
});




// ---------- Helpers ----------
function renderTable(containerId, data) {
  if (!data || !data.length) return;
  let container = document.getElementById(containerId);
  let cols = Object.keys(data[0]);
  let html = `<table id="${containerId}-table" class="table table-dark table-striped"><thead><tr>`;
  cols.forEach(c => (html += `<th>${c}</th>`));
  html += `</tr></thead><tbody>`;
  data.forEach(row => {
    html += `<tr>`;
    cols.forEach(c => (html += `<td>${row[c]}</td>`));
    html += `</tr>`;
  });
  html += `</tbody></table>`;
  container.innerHTML = html;

  $(`#${containerId}-table`).DataTable({
    pageLength: 5
  });
}

// ---------- Chart Helpers (with cleanup) ----------
function destroyChart(id) {
  if (activeCharts[id]) {
    activeCharts[id].destroy();
    delete activeCharts[id];
  }
}

function renderLineChart(canvasId, data, yKey, label) {
  destroyChart(canvasId);
  let ctx = document.getElementById(canvasId).getContext("2d");
  activeCharts[canvasId] = new Chart(ctx, {
    type: "line",
    data: {
      labels: data.map(d => d.Date),
      datasets: [{
        label,
        data: data.map(d => d[yKey]),
        borderColor: "#0d6efd",
        fill: false
      }]
    }
  });
}

function renderMultiLineChart(canvasId, data, keys, label) {
  destroyChart(canvasId);
  let ctx = document.getElementById(canvasId).getContext("2d");
  activeCharts[canvasId] = new Chart(ctx, {
    type: "line",
    data: {
      labels: data.map(d => d.Date),
      datasets: keys.map((k, i) => ({
        label: k,
        data: data.map(d => d[k]),
        borderColor: ["#0d6efd", "orange", "green"][i],
        fill: false
      }))
    }
  });
}

function renderBarChart(canvasId, data, xKey, yKey, label) {
  destroyChart(canvasId);
  let ctx = document.getElementById(canvasId).getContext("2d");
  activeCharts[canvasId] = new Chart(ctx, {
    type: "bar",
    data: {
      labels: data.map(d => d[xKey]),
      datasets: [{
        label,
        data: data.map(d => d[yKey]),
        backgroundColor: "#0d6efd"
      }]
    }
  });
}

function renderPieChart(canvasId, data, labelKey, valueKey, label) {
  destroyChart(canvasId);
  let ctx = document.getElementById(canvasId).getContext("2d");
  activeCharts[canvasId] = new Chart(ctx, {
    type: "pie",
    data: {
      labels: data.map(d => d[labelKey]),
      datasets: [{
        label,
        data: data.map(d => d[valueKey]),
        backgroundColor: ["#0d6efd", "orange", "green", "purple", "red"]
      }]
    }
  });
}
