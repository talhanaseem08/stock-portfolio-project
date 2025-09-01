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


function handleChartResize() {
  Object.keys(activeCharts).forEach(chartId => {
    if (activeCharts[chartId]) {
      activeCharts[chartId].resize();
    }
  });
}


window.addEventListener('resize', handleChartResize);

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
    
    //document.getElementById("pie-debug").innerHTML = `Data: ${JSON.stringify(charts.market_category_pie)}`;
    
    renderPieChart("marketPie", charts.market_category_pie, "Market Category", "Count", "Market Categories");
  } else {
    console.log("No market category pie chart data available");
    document.getElementById("pie-debug").innerHTML = "No data available for pie chart";
    
    
    // const testData = [
    //   { "Market Category": "Test 1", "Count": 50 },
    //   { "Market Category": "Test 2", "Count": 30 },
    //   { "Market Category": "Test 3", "Count": 20 }
    // ];
    renderPieChart("marketPie", testData, "Market Category", "Count", "Test Chart");
  }
  if (charts.scatter) {
    console.log("Rendering scatter chart");
    renderScatterChart("scatterPlot", charts.scatter, "Symbol", "Round Lot Size", "Symbol vs Round Lot Size");
  }
 
  await fetchMetaAdvancedAnalysis();
}

async function fetchMetaKPIs() {
  if (!currentToken) return;
  
  try {
    let res = await fetch(`http://127.0.0.1:5000/analyze-meta/${currentToken}/kpis`);
    let kpis = await res.json();
    
    let kpiBox = document.getElementById("summary-kpis");
    
 
    let uniqueStocksCard = kpiBox.querySelector('.col-md-3:nth-child(1) .kpi-value');
    if (uniqueStocksCard) {
      uniqueStocksCard.textContent = kpis["Unique Stocks"] || "N/A";
    }
    

    let exchangeCard = kpiBox.querySelector('.col-md-3:nth-child(2) .kpi-value');
    if (exchangeCard) {
      if (kpis["Exchange Distribution"] && kpis["Exchange Distribution"] !== "N/A") {
        let exchangeCount = Object.keys(kpis["Exchange Distribution"]).length;
        exchangeCard.textContent = exchangeCount;
      } else {
        exchangeCard.textContent = "N/A";
      }
    }
    
   
    let etfCard = kpiBox.querySelector('.col-md-3:nth-child(3) .kpi-value');
    if (etfCard) {
      etfCard.textContent = kpis["ETF Count"] || "N/A";
    }
    

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


document.getElementById("cancel-cleanup").addEventListener("click", async() => {
  bootstrap.Modal.getInstance(document.getElementById("metaCleanupModal")).hide();
  renderMetaOverview(metaPreviewData);
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
    pageLength: 5,
    responsive: false,
    scrollX: false,
    autoWidth: false,
    language: {
      search: "Search:",
      lengthMenu: "Show _MENU_ entries",
      info: "Showing _START_ to _END_ of _TOTAL_ entries",
      paginate: { first: "First", last: "Last", next: "Next", previous: "Previous" }
    }
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
        backgroundColor: 'rgba(13, 110, 253, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 8,
        pointBackgroundColor: '#0d6efd',
        pointBorderColor: '#fff',
        pointBorderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 2000,
        easing: 'easeInOutQuart'
      },
      layout: {
        padding: {
          top: 10,
          bottom: 10,
          left: 10,
          right: 10
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Date',
            color: '#f8f9fa',
            font: {
              size: 14,
              weight: 'bold'
            }
          },
          ticks: {
            color: '#f5f5f5',
            font: {
              size: 12
            },
            maxTicksLimit: 10
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)',
            drawBorder: false
          }
        },
        y: {
          title: {
            display: true,
            text: yKey,
            color: '#f8f9fa',
            font: {
              size: 14,
              weight: 'bold'
            }
          },
          ticks: {
            color: '#f5f5f5',
            font: {
              size: 12
            }
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)',
            drawBorder: false
          }
        }
      },
      plugins: {
        legend: {
          labels: {
            color: '#f8f9fa',
            font: {
              size: 14,
              weight: 'bold'
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          titleColor: '#f8f9fa',
          bodyColor: '#f8f9fa',
          borderColor: '#0d6efd',
          borderWidth: 1,
          cornerRadius: 8,
          mode: 'index',
          intersect: false
        }
      },
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false
      }
    }
  });
}

function renderMultiLineChart(canvasId, data, keys, label) {
  destroyChart(canvasId);
  let ctx = document.getElementById(canvasId).getContext("2d");
  const colors = [
    { border: '#0d6efd', background: 'rgba(13, 110, 253, 0.1)' },
    { border: '#fd7e14', background: 'rgba(253, 126, 20, 0.1)' },
    { border: '#20c997', background: 'rgba(32, 201, 151, 0.1)' },
    { border: '#dc3545', background: 'rgba(220, 53, 69, 0.1)' },
    { border: '#6f42c1', background: 'rgba(111, 66, 193, 0.1)' }
  ];
  
  activeCharts[canvasId] = new Chart(ctx, {
    type: "line",
    data: {
      labels: data.map(d => d.Date),
      datasets: keys.map((k, i) => ({
        label: k,
        data: data.map(d => d[k]),
        borderColor: colors[i % colors.length].border,
        backgroundColor: colors[i % colors.length].background,
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 8,
        pointBackgroundColor: colors[i % colors.length].border,
        pointBorderColor: '#fff',
        pointBorderWidth: 2
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 2000,
        easing: 'easeInOutQuart'
      },
      layout: {
        padding: {
          top: 10,
          bottom: 10,
          left: 10,
          right: 10
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Date',
            color: '#f8f9fa',
            font: {
              size: 14,
              weight: 'bold'
            }
          },
          ticks: {
            color: '#f5f5f5',
            font: {
              size: 12
            },
            maxTicksLimit: 10
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)',
            drawBorder: false
          }
        },
        y: {
          title: {
            display: true,
            text: 'Price',
            color: '#f8f9fa',
            font: {
              size: 14,
              weight: 'bold'
            }
          },
          ticks: {
            color: '#f5f5f5',
            font: {
              size: 12
            }
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)',
            drawBorder: false
          }
        }
      },
      plugins: {
        legend: {
          labels: {
            color: '#f8f9fa',
            font: {
              size: 14,
              weight: 'bold'
            },
            usePointStyle: true,
            pointStyle: 'circle'
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          titleColor: '#f8f9fa',
          bodyColor: '#f8f9fa',
          borderColor: '#0d6efd',
          borderWidth: 1,
          cornerRadius: 8,
          mode: 'index',
          intersect: false
        }
      },
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false
      }
    }
  });
}

function renderBarChart(canvasId, data, xKey, yKey, label) {
  destroyChart(canvasId);
  let ctx = document.getElementById(canvasId).getContext("2d");
  const colors = [
    '#0d6efd', '#6f42c1', '#fd7e14', '#20c997', '#dc3545',
    '#ffc107', '#6610f2', '#e83e8c', '#fd7e14', '#28a745'
  ];
  
  activeCharts[canvasId] = new Chart(ctx, {
    type: "bar",
    data: {
      labels: data.map(d => d[xKey]),
      datasets: [{
        label,
        data: data.map(d => d[yKey]),
        backgroundColor: data.map((_, index) => colors[index % colors.length]),
        borderColor: data.map((_, index) => colors[index % colors.length]),
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 2000,
        easing: 'easeInOutQuart'
      },
      scales: {
        x: {
          title: {
            display: true,
            text: xKey,
            color: '#f8f9fa',
            font: {
              size: 14,
              weight: 'bold'
            }
          },
          ticks: {
            color: '#f5f5f5',
            font: {
              size: 12
            }
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)',
            drawBorder: false
          }
        },
        y: {
          title: {
            display: true,
            text: yKey,
            color: '#f8f9fa',
            font: {
              size: 14,
              weight: 'bold'
            }
          },
          ticks: {
            color: '#f5f5f5',
            font: {
              size: 12
            }
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)',
            drawBorder: false
          }
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          titleColor: '#f8f9fa',
          bodyColor: '#f8f9fa',
          borderColor: '#0d6efd',
          borderWidth: 1,
          cornerRadius: 8,
          displayColors: true,
          callbacks: {
            label: function(context) {
              return `${context.parsed.y} ${yKey}`;
            }
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
  const colors = [
    '#0d6efd', '#6f42c1', '#fd7e14', '#20c997', '#dc3545',
    '#ffc107', '#6610f2', '#e83e8c', '#fd7e14', '#28a745',
    '#17a2b8', '#6c757d', '#343a40', '#495057', '#868e96'
  ];
  
  try {
    activeCharts[canvasId] = new Chart(ctx, {
      type: "pie",
      data: {
        labels: data.map(d => d[labelKey]),
        datasets: [{
          label,
          data: data.map(d => d[valueKey]),
          backgroundColor: data.map((_, index) => colors[index % colors.length]),
          borderColor: '#2a2a3d',
          borderWidth: 3,
          hoverBorderColor: '#0d6efd',
          hoverBorderWidth: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 2000,
          easing: 'easeInOutQuart'
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#f8f9fa',
              font: {
                size: 12,
                weight: 'bold'
              },
              padding: 15,
              usePointStyle: true,
              pointStyle: 'circle'
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            titleColor: '#f8f9fa',
            bodyColor: '#f8f9fa',
            borderColor: '#0d6efd',
            borderWidth: 1,
            cornerRadius: 8,
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = context.parsed;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = ((value / total) * 100).toFixed(1);
                return `${label}: ${value} (${percentage}%)`;
              }
            }
          }
        }
      }
    });
    
    console.log(`Pie chart rendered successfully: ${canvasId}`);
  } catch (error) {
    console.error(`Error rendering pie chart ${canvasId}:`, error);
    const debugElement = document.getElementById("pie-debug");
    if (debugElement) {
      debugElement.innerHTML += `<br><span class="text-danger">Chart rendering error: ${error.message}</span>`;
    }
  }
}

function renderScatterChart(canvasId, data, xKey, yKey, label) {
  destroyChart(canvasId);
  let ctx = document.getElementById(canvasId).getContext("2d");
  let chartData;
  if (xKey === "Symbol") {
    chartData = data.map((d, index) => ({ x: index, y: d[yKey] }));
  } else {
    chartData = data.map(d => ({ x: d[xKey], y: d[yKey] }));
  }
  
  activeCharts[canvasId] = new Chart(ctx, {
    type: "scatter",
    data: {
      datasets: [{
        label,
        data: chartData,
        backgroundColor: '#0d6efd',
        borderColor: '#6f42c1',
        borderWidth: 2,
        pointRadius: 8,
        pointHoverRadius: 12,
        pointHoverBackgroundColor: '#fd7e14',
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 2000,
        easing: 'easeInOutQuart'
      },
      scales: {
        x: {
          type: 'linear',
          position: 'bottom',
          title: {
            display: true,
            text: xKey === "Symbol" ? "Stock Index" : xKey,
            color: '#f8f9fa',
            font: {
              size: 14,
              weight: 'bold'
            }
          },
          ticks: {
            color: '#f5f5f5',
            font: {
              size: 12
            }
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)',
            drawBorder: false
          }
        },
        y: {
          title: {
            display: true,
            text: yKey,
            color: '#f8f9fa',
            font: {
              size: 14,
              weight: 'bold'
            }
          },
          ticks: {
            color: '#f5f5f5',
            font: {
              size: 12
            }
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)',
            drawBorder: false
          }
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          titleColor: '#f8f9fa',
          bodyColor: '#f8f9fa',
          borderColor: '#0d6efd',
          borderWidth: 1,
          cornerRadius: 8,
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

function renderCorrelationMatrix(canvasId, correlationData, columns) {
  destroyChart(canvasId);
  
  let canvas = document.getElementById(canvasId);
  if (!canvas) {
    console.error(`Canvas element not found for: ${canvasId}`);
    return;
  }
  
  let ctx = canvas.getContext("2d");
  
  
  const matrixSize = columns.length;
  const matrix = Array(matrixSize).fill().map(() => Array(matrixSize).fill(0));
  

  correlationData.forEach(item => {
    const i = columns.indexOf(item.Column1);
    const j = columns.indexOf(item.Column2);
    matrix[i][j] = item.Correlation;
    matrix[j][i] = item.Correlation; // Make symmetric
  });
  

  const datasets = columns.map((col, i) => ({
    label: col,
    data: matrix[i].map((val, j) => ({ x: j, y: i, v: val })),
    backgroundColor: matrix[i].map(val => {
      const intensity = Math.abs(val);
      if (val < 0) {
        return `rgba(220, 53, 69, ${intensity})`; 
      } else if (val > 0) {
        return `rgba(13, 110, 253, ${intensity})`; 
      } else {
        return 'rgba(255, 255, 255, 0.1)';
      }
    }),
    borderColor: '#444',
    borderWidth: 1,
    pointRadius: 0
  }));
  
  activeCharts[canvasId] = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 1000,
        easing: 'easeInOutQuart'
      },
      scales: {
        x: {
          type: 'linear',
          position: 'bottom',
          min: -0.5,
          max: matrixSize - 0.5,
          ticks: {
            stepSize: 1,
            callback: function(value) {
              return columns[Math.round(value)] || '';
            },
            color: '#f5f5f5',
            font: { size: 12 }
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)',
            drawBorder: false
          }
        },
        y: {
          type: 'linear',
          min: -0.5,
          max: matrixSize - 0.5,
          ticks: {
            stepSize: 1,
            callback: function(value) {
              return columns[Math.round(value)] || '';
            },
            color: '#f5f5f5',
            font: { size: 12 }
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)',
            drawBorder: false
          }
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          titleColor: '#f8f9fa',
          bodyColor: '#f8f9fa',
          borderColor: '#0d6efd',
          borderWidth: 1,
          cornerRadius: 8,
          callbacks: {
            title: function(context) {
              const x = Math.round(context[0].parsed.x);
              const y = Math.round(context[0].parsed.y);
              return `${columns[y]} vs ${columns[x]}`;
            },
            label: function(context) {
              return `Correlation: ${context.parsed.v.toFixed(3)}`;
            }
          }
        }
      }
    }
  });
}


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

function renderMetaAdvancedAnalysis(analysis) {
  const container = document.getElementById("meta-advanced-analysis");
  if (!container) return;
  
  let html = '<div class="row g-3">';
  
  if (analysis.etf_percentages) {
    html += `
      <div class="col-md-6">
        <div class="card bg-dark text-light">
          <div class="card-header">
            <h6>ETF vs Non-ETF Distribution</h6>
          </div>
          <div class="card-body">
            <canvas id="etfVsNonEtfBar"></canvas>
          </div>
        </div>
      </div>
    `;

    setTimeout(() => {
      const chartData = [
        { "Status": "ETF", "Percentage": analysis.etf_percentages["ETF Percentage"] },
        { "Status": "Non-ETF", "Percentage": analysis.etf_percentages["Non-ETF Percentage"] }
      ];
      renderBarChart("etfVsNonEtfBar", chartData, "Status", "Percentage", "ETF vs Non-ETF (%)");
    }, 100);
  }
  
  
  if (analysis.top_round_lot && analysis.top_round_lot.length) {
    html += `
      <div class="col-md-6">
        <div class="card bg-dark text-light">
          <div class="card-header">
            <h6>Top 10 Companies by Round Lot Size</h6>
          </div>
                     <div class="card-body">
             <canvas id="topRoundLotChart"></canvas>
           </div>
        </div>
      </div>
    `;

    setTimeout(() => {
      const data = analysis.top_round_lot.map(d => ({
        "Symbol": d.Symbol,
        "Round Lot Size": d["Round Lot Size"]
      }));
      renderBarChart("topRoundLotChart", data, "Symbol", "Round Lot Size", "Top 10 Round Lot Size");
    }, 100);
  } else if (analysis.financial_status) {
   
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
  // if (analysis.test_issue) {
  //   html += `
  //     <div class="col-md-6">
  //       <div class="card bg-dark text-light">
  //         <div class="card-header">
  //           <h6>Test Issue Distribution</h6>
  //         </div>
  //         <div class="card-body">
  //           <div class="row">
  //             ${analysis.test_issue.map(item => `
  //               <div class="col-6 mb-2">
  //                 <div class="kpi-card">
  //                   <div class="kpi-value">${item.Count}</div>
  //                   <div class="kpi-label">${item["Test Issue"] || "Unknown"}</div>
  //                 </div>
  //               </div>
  //             `).join('')}
  //           </div>
  //         </div>
  //       </div>
  //     </div>
  //   `;
  // }
  
  // Round Lot Size Distribution
  // if (analysis.round_lot_distribution) {
  //   html += `
  //     <div class="col-md-12">
  //       <div class="card bg-dark text-light">
  //         <div class="card-header">
  //           <h6>Round Lot Size Distribution</h6>
  //         </div>
  //         <div class="card-body">
  //           <canvas id="roundLotChart"></canvas>
  //         </div>
  //       </div>
  //     </div>
  //   `;
    
  //   // Render the chart after DOM is updated
  //   setTimeout(() => {
  //     if (analysis.round_lot_distribution.length > 0) {
  //       renderBarChart("roundLotChart", analysis.round_lot_distribution, "Round Lot Size Range", "Count", "Round Lot Size Distribution");
  //     }
  //   }, 100);
  // }
  
  html += '</div>';
  container.innerHTML = html;
}
