let currentToken = null;
let currentFileType = null; 
let metaPreviewData = null;
let removedColumns = new Set();
let activeCharts = {}; 

document.getElementById("upload-form").addEventListener("submit", async function (e) {
  e.preventDefault(); 

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

    
    updateTabStates(currentFileType);

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


function updateTabStates(fileType) {
  const analysisTab = document.querySelector('a[href="#analysis"]');
  const metaAnalysisTab = document.querySelector('a[href="#meta-analysis"]');
  
  if (fileType === "stock") {

    analysisTab.classList.remove("disabled");
    analysisTab.removeAttribute("disabled");
    metaAnalysisTab.classList.add("disabled");
    metaAnalysisTab.setAttribute("disabled", "disabled");
    

    if (metaAnalysisTab.classList.contains("active")) {
      metaAnalysisTab.classList.remove("active");
      analysisTab.classList.add("active");

      document.getElementById("analysis").classList.add("show", "active");
      document.getElementById("meta-analysis").classList.remove("show", "active");
    }
  } else if (fileType === "meta") {

    metaAnalysisTab.classList.remove("disabled");
    metaAnalysisTab.removeAttribute("disabled");
    analysisTab.classList.add("disabled");
    analysisTab.setAttribute("disabled", "disabled");
    

    if (analysisTab.classList.contains("active")) {
      analysisTab.classList.remove("active");
      metaAnalysisTab.classList.add("active");
     document.getElementById("meta-analysis").classList.add("show", "active");
      document.getElementById("analysis").classList.remove("show", "active");
    }
  }
}

// ---------- Stock Overview ----------
function renderStockOverview(data) {
  document.getElementById("overview-section").style.display = "block";

  let kpiBox = document.getElementById("summary-kpis");
  kpiBox.innerHTML = `
    <div class="col-md-4"><div class="kpi-card">
      <div class="kpi-value">${data.summary.rows}</div>
      <div class="kpi-label">Rows</div>
    </div></div>
    <div class="col-md-4"><div class="kpi-card">
      <div class="kpi-value">${data.summary.cols}</div>
      <div class="kpi-label">Columns</div>
    </div></div>
    <div class="col-md-4"><div class="kpi-card">
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

// ---------- Meta Overview ----------
function renderMetaOverview(preview) {
  document.getElementById("overview-section").style.display = "block";


  let kpiBox = document.getElementById("summary-kpis");
  kpiBox.innerHTML = `
    <div class="col-md-3"><div class="kpi-card">
      <div class="kpi-value">Loading...</div>
      <div class="kpi-label">Unique Stocks on NASDAQ</div>
    </div></div>
    <div class="col-md-3"><div class="kpi-card">
      <div class="kpi-value">Loading...</div>
      <div class="kpi-label">Exchange Distribution</div>
    </div></div>
    <div class="col-md-3"><div class="kpi-card">
      <div class="kpi-value">Loading...</div>
      <div class="kpi-label">ETF Count</div>
    </div></div>
    <div class="col-md-3"><div class="kpi-card">
      <div class="kpi-value">Loading...</div>
      <div class="kpi-label">ETF vs Non-ETF</div>
    </div></div>
  `;

  renderTable("preview-box", preview);
  

  let extraBox = document.getElementById("extra-kpis");
  extraBox.innerHTML = "";
  
  fetchMetaKPIs();
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

// ---------- Fetch Meta Analysis ----------
async function fetchmetaAnalysis() {
  if (!currentToken) return;

  console.log("fetchmetaAnalysis called, token:", currentToken);

  document.getElementById("meta-section").style.display = "block";

  let resCharts = await fetch(`http://127.0.0.1:5000/analyze-meta/${currentToken}/charts`);
  let charts = await resCharts.json();
  
  console.log("Charts data received:", charts);

  if (charts.exchange_bar) {
    console.log("Rendering exchange bar chart");
    renderBarChart("exchangeBar", charts.exchange_bar, "Listing Exchange", "Count", "Stocks per Exchange");
  }
  if (charts.market_category_pie) {
    //console.log("Rendering market category pie chart with data:", charts.market_category_pie);
    
    // Update debug info
    document.getElementById("pie-debug").innerHTML = `Data: ${JSON.stringify(charts.market_category_pie)}`;
    
    renderPieChart("marketPie", charts.market_category_pie, "Market Category", "Count", "Market Categories");
  } else {
    console.log("No market category pie chart data available");
    document.getElementById("pie-debug").innerHTML = "No data available for pie chart";
    
    // Render a test pie chart to ensure the canvas works
    const testData = [
      { "Market Category": "Test 1", "Count": 50 },
      { "Market Category": "Test 2", "Count": 30 },
      { "Market Category": "Test 3", "Count": 20 }
    ];
    renderPieChart("marketPie", testData, "Market Category", "Count", "Test Chart");
  }
  if (charts.scatter) {
    console.log("Rendering scatter chart");
    renderScatterChart("scatterPlot", charts.scatter, "Symbol", "Round Lot Size", "Symbol vs Round Lot Size");
  }
  
  // Fetch and render advanced analysis
  await fetchMetaAdvancedAnalysis();
}

// ---------- Fetch Meta KPIs ----------
async function fetchMetaKPIs() {
  if (!currentToken) return;
  
  try {
    let res = await fetch(`http://127.0.0.1:5000/analyze-meta/${currentToken}/kpis`);
    let kpis = await res.json();
    
    let kpiBox = document.getElementById("summary-kpis");
    
    // 1. Unique Stocks on NASDAQ
    let uniqueStocksCard = kpiBox.querySelector('.col-md-3:nth-child(1) .kpi-value');
    if (uniqueStocksCard) {
      uniqueStocksCard.textContent = kpis["Unique Stocks"] || "N/A";
    }
    
    // 2. Exchange Distribution
    let exchangeCard = kpiBox.querySelector('.col-md-3:nth-child(2) .kpi-value');
    if (exchangeCard) {
      if (kpis["Exchange Distribution"] && kpis["Exchange Distribution"] !== "N/A") {
        let exchangeCount = Object.keys(kpis["Exchange Distribution"]).length;
        exchangeCard.textContent = exchangeCount;
      } else {
        exchangeCard.textContent = "N/A";
      }
    }
    
    // 3. ETF Count
    let etfCard = kpiBox.querySelector('.col-md-3:nth-child(3) .kpi-value');
    if (etfCard) {
      etfCard.textContent = kpis["ETF Count"] || "N/A";
    }
    
    // 4. ETF vs Non-ETF
    let etfVsNonEtfCard = kpiBox.querySelector('.col-md-3:nth-child(4) .kpi-value');
    if (etfVsNonEtfCard && kpis["ETF vs Non-ETF"] && kpis["ETF vs Non-ETF"] !== "N/A") {
      etfVsNonEtfCard.textContent = `${kpis["ETF vs Non-ETF"]["ETF Percentage"]}% / ${kpis["ETF vs Non-ETF"]["Non-ETF Percentage"]}%`;
    } else {
      etfVsNonEtfCard.textContent = "N/A";
    }
    
  } catch (err) {
    console.error("Error fetching meta KPIs:", err);
  }
}

// ---------- Meta Cleanup Modal ----------
function showMetaCleanupModal(preview) {
  const modal = new bootstrap.Modal(document.getElementById("metaCleanupModal"));
  renderCleanupTable(preview);
  modal.show();
}

function renderCleanupTable(preview) {
  const box = document.getElementById("cleanup-preview");
  box.innerHTML = "";

  if (!preview.length) return;
  const cols = Object.keys(preview[0]);

  let html = `<table class="table table-dark table-bordered"><thead><tr>`;
  cols.forEach(col => {
    if (!removedColumns.has(col)) {
      html += `<th>
        ${col} <button class="btn btn-sm btn-danger ms-1" onclick="toggleRemoveColumn('${col}')">X</button>
      </th>`;
    }
  });
  html += `</tr></thead><tbody>`;

  preview.slice(0, 10).forEach(row => {
    html += `<tr>`;
    cols.forEach(col => {
      if (!removedColumns.has(col)) {
        html += `<td>${row[col]}</td>`;
      }
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
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          title: {
            display: true,
            text: xKey,
            color: '#f5f5f5',
            font: {
              size: 14,
              weight: 'bold'
            }
          },
          ticks: {
            color: '#f5f5f5'
          }
        },
        y: {
          title: {
            display: true,
            text: yKey,
            color: '#f5f5f5',
            font: {
              size: 14,
              weight: 'bold'
            }
          },
          ticks: {
            color: '#f5f5f5'
          }
        }
      },
      plugins: {
        legend: {
          labels: {
            color: '#f5f5f5'
          }
        }
      }
    }
  });
}

function renderPieChart(canvasId, data, labelKey, valueKey, label) {
  console.log(`Rendering pie chart: ${canvasId}`, data, labelKey, valueKey, label);
  
  destroyChart(canvasId);
  
  let canvas = document.getElementById(canvasId);
  if (!canvas) {
    console.error(`Canvas element not found for: ${canvasId}`);
    return;
  }
  
  let ctx = canvas.getContext("2d");
  if (!ctx) {
    console.error(`Canvas context not found for: ${canvasId}`);
    return;
  }
  
  console.log(`Canvas dimensions: ${canvas.width} x ${canvas.height}`);
  
  try {
    activeCharts[canvasId] = new Chart(ctx, {
      type: "pie",
      data: {
        labels: data.map(d => d[labelKey]),
        datasets: [{
          label,
          data: data.map(d => d[valueKey]),
          backgroundColor: ["#0d6efd", "orange", "green", "purple", "red"]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#f5f5f5',
              font: {
                size: 12
              }
            }
          }
        }
      }
    });
    
    console.log(`Pie chart rendered successfully: ${canvasId}`);
  } catch (error) {
    console.error(`Error rendering pie chart ${canvasId}:`, error);
    // Try to show error on the page
    const debugElement = document.getElementById("pie-debug");
    if (debugElement) {
      debugElement.innerHTML += `<br><span class="text-danger">Chart rendering error: ${error.message}</span>`;
    }
  }
}

function renderScatterChart(canvasId, data, xKey, yKey, label) {
  destroyChart(canvasId);
  let ctx = document.getElementById(canvasId).getContext("2d");
  
  // For meta data, we need to handle the case where xKey might be Symbol (string)
  // We'll use the index as x-axis for better visualization
  let chartData;
  if (xKey === "Symbol") {
    // For meta data scatter plot, use index as x-axis
    chartData = data.map((d, index) => ({ x: index, y: d[yKey] }));
  } else {
    // For regular scatter plots
    chartData = data.map(d => ({ x: d[xKey], y: d[yKey] }));
  }
  
  activeCharts[canvasId] = new Chart(ctx, {
    type: "scatter",
    data: {
      datasets: [{
        label,
        data: chartData,
        backgroundColor: "#0d6efd",
        pointRadius: 6
      }]
    },
    options: {
      scales: {
        x: {
          type: 'linear',
          position: 'bottom',
          title: {
            display: true,
            text: xKey === "Symbol" ? "Stock Index" : xKey
          }
        },
        y: {
          title: {
            display: true,
            text: yKey
          }
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              if (xKey === "Symbol") {
                const index = context.parsed.x;
                const symbol = data[index] ? data[index][xKey] : 'Unknown';
                return `${xKey}: ${symbol}, ${yKey}: ${context.parsed.y}`;
              }
              return `${xKey}: ${context.parsed.x}, ${yKey}: ${context.parsed.y}`;
            }
          }
        }
      }
    }
  });
}

// ---------- Fetch Meta Advanced Analysis ----------
async function fetchMetaAdvancedAnalysis() {
  if (!currentToken) return;
  
  try {
    let res = await fetch(`http://127.0.0.1:5000/analyze-meta/${currentToken}/advanced`);
    let analysis = await res.json();
    
    renderMetaAdvancedAnalysis(analysis);
  } catch (err) {
    console.error("Error fetching meta advanced analysis:", err);
  }
}

// ---------- Render Meta Advanced Analysis ----------
function renderMetaAdvancedAnalysis(analysis) {
  const container = document.getElementById("meta-advanced-analysis");
  if (!container) return;
  
  let html = '<div class="row g-3">';
  
  // ETF vs Non-ETF Analysis
  if (analysis.etf_percentages) {
    html += `
      <div class="col-md-6">
        <div class="card bg-dark text-light">
          <div class="card-header">
            <h6>ETF vs Non-ETF Distribution</h6>
          </div>
          <div class="card-body">
            <div class="row">
              <div class="col-6">
                <div class="kpi-card">
                  <div class="kpi-value text-success">${analysis.etf_percentages["ETF Percentage"]}%</div>
                  <div class="kpi-label">ETF</div>
                </div>
              </div>
              <div class="col-6">
                <div class="kpi-card">
                  <div class="kpi-value text-warning">${analysis.etf_percentages["Non-ETF Percentage"]}%</div>
                  <div class="kpi-label">Non-ETF</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  
  // Market Cap Stats
  if (analysis.market_cap_stats) {
    html += `
      <div class="col-md-6">
        <div class="card bg-dark text-light">
          <div class="card-header">
            <h6>Market Cap Statistics</h6>
          </div>
          <div class="card-body">
            <div class="row">
              <div class="col-6">
                <div class="kpi-card">
                  <div class="kpi-value">${analysis.market_cap_stats.mean.toLocaleString()}</div>
                  <div class="kpi-label">Mean</div>
                </div>
              </div>
              <div class="col-6">
                <div class="kpi-card">
                  <div class="kpi-value">${analysis.market_cap_stats.median.toLocaleString()}</div>
                  <div class="kpi-label">Median</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  
  // Financial Status Analysis
  if (analysis.financial_status) {
    html += `
      <div class="col-md-6">
        <div class="card bg-dark text-light">
          <div class="card-header">
            <h6>Financial Status Distribution</h6>
          </div>
          <div class="card-body">
            <div class="row">
              ${analysis.financial_status.map(item => `
                <div class="col-6 mb-2">
                  <div class="kpi-card">
                    <div class="kpi-value">${item.Count}</div>
                    <div class="kpi-label">${item["Financial Status"] || "Unknown"}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  }
  
  // Test Issue Analysis
  if (analysis.test_issue) {
    html += `
      <div class="col-md-6">
        <div class="card bg-dark text-light">
          <div class="card-header">
            <h6>Test Issue Distribution</h6>
          </div>
          <div class="card-body">
            <div class="row">
              ${analysis.test_issue.map(item => `
                <div class="col-6 mb-2">
                  <div class="kpi-card">
                    <div class="kpi-value">${item.Count}</div>
                    <div class="kpi-label">${item["Test Issue"] || "Unknown"}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  }
  
  // Round Lot Size Distribution
  if (analysis.round_lot_distribution) {
    html += `
      <div class="col-md-12">
        <div class="card bg-dark text-light">
          <div class="card-header">
            <h6>Round Lot Size Distribution</h6>
          </div>
          <div class="card-body">
            <canvas id="roundLotChart"></canvas>
          </div>
        </div>
      </div>
    `;
    
    // Render the chart after DOM is updated
    setTimeout(() => {
      if (analysis.round_lot_distribution.length > 0) {
        renderBarChart("roundLotChart", analysis.round_lot_distribution, "Round Lot Size Range", "Count", "Round Lot Size Distribution");
      }
    }, 100);
  }
  
  // Sector Distribution (if available)
  if (analysis.sector_distribution) {
    html += `
      <div class="col-md-12">
        <div class="card bg-dark text-light">
          <div class="card-header">
            <h6>Top 10 Sectors</h6>
          </div>
          <div class="card-body">
            <div class="row">
              ${analysis.sector_distribution.map(item => `
                <div class="col-md-3 mb-2">
                  <div class="kpi-card">
                    <div class="kpi-value">${item.Count}</div>
                    <div class="kpi-label">${item.Sector || "Unknown"}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  }
  
  html += '</div>';
  container.innerHTML = html;
}
