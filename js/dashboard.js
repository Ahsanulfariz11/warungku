import Chart from 'chart.js/auto';

async function renderDashboard() {
  const container = document.getElementById('page-content');
  
  container.innerHTML = `
    <div class="animate-fade-in">
      <div class="stats-grid" id="dashboard-stats"></div>
      
      <div class="dashboard-grid-2col">
        <div class="chart-container">
          <div class="card-header">
            <span class="card-title"><i data-lucide="trending-up" style="vertical-align: middle; margin-right: 6px;"></i> Penjualan 7 Hari Terakhir</span>
          </div>
          <div style="position: relative; height: 200px;">
            <canvas id="sales-chart"></canvas>
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <span class="card-title"><i data-lucide="alert-triangle" style="vertical-align: middle; margin-right: 6px;"></i> Stok Hampir Habis</span>
          </div>
          <div id="low-stock-list"></div>
        </div>
      </div>
      
      <div class="card">
        <div class="card-header">
          <span class="card-title"><i data-lucide="clock" style="vertical-align: middle; margin-right: 6px;"></i> Transaksi Terakhir</span>
        </div>
        <div id="recent-transactions"></div>
      </div>
    </div>
  `;

  await Promise.all([
    loadDashboardStats(),
    loadSalesChart(),
    loadLowStock(),
    loadRecentTransactions()
  ]);

  if (window.renderLucide) window.renderLucide();
}

async function loadDashboardStats() {
  const container = document.getElementById('dashboard-stats');
  if (!container) return;

  const todayTxs = await db.getTodayTransactions();
  const allProducts = await db.getAllProducts();
  const lowStock = await db.getLowStockProducts();
  const monthly = await db.getMonthlySales();

  const todaySales = todayTxs.reduce((sum, t) => sum + t.total, 0);

  container.innerHTML = `
    <div class="stat-card accent-green stagger-item">
      <div class="stat-icon"><i data-lucide="dollar-sign"></i></div>
      <div class="stat-value">${formatRupiah(todaySales)}</div>
      <div class="stat-label">Penjualan Hari Ini (${todayTxs.length} transaksi)</div>
    </div>
    <div class="stat-card accent-blue stagger-item">
      <div class="stat-icon"><i data-lucide="package"></i></div>
      <div class="stat-value">${allProducts.length}</div>
      <div class="stat-label">Total Produk</div>
    </div>
    <div class="stat-card accent-amber stagger-item">
      <div class="stat-icon"><i data-lucide="trending-up"></i></div>
      <div class="stat-value">${formatRupiah(monthly.total)}</div>
      <div class="stat-label">Penjualan Bulan Ini</div>
    </div>
    <div class="stat-card accent-red stagger-item">
      <div class="stat-icon"><i data-lucide="alert-triangle"></i></div>
      <div class="stat-value">${lowStock.length}</div>
      <div class="stat-label">Stok Hampir Habis</div>
    </div>
  `;
}

async function loadSalesChart() {
  const canvas = document.getElementById('sales-chart');
  if (!canvas) return;

  const data = await db.getDailySales(7);
  drawBarChart(canvas, data);
}

let salesChartInstance = null;

function drawBarChart(canvas, data) {
  if (salesChartInstance) {
    salesChartInstance.destroy();
  }

  const labels = data.map(d => d.label);
  const values = data.map(d => d.total);

  salesChartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Penjualan (Rp)',
        data: values,
        backgroundColor: 'rgba(16, 185, 129, 0.85)',
        borderColor: '#10b981',
        borderWidth: 1,
        borderRadius: 6,
        hoverBackgroundColor: '#34d399'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: '#1e293b',
          titleColor: '#f1f5f9',
          bodyColor: '#f1f5f9',
          borderColor: 'rgba(16, 185, 129, 0.2)',
          borderWidth: 1,
          callbacks: {
            label: function(context) {
              return 'Penjualan: ' + formatRupiah(context.raw);
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            color: '#94a3b8'
          }
        },
        y: {
          grid: {
            color: 'rgba(148, 163, 184, 0.05)'
          },
          ticks: {
            color: '#94a3b8',
            callback: function(value) {
              return formatRupiah(value).replace('Rp ', '');
            }
          }
        }
      }
    }
  });
}

async function loadLowStock() {
  const container = document.getElementById('low-stock-list');
  if (!container) return;

  const lowStock = await db.getLowStockProducts();

  if (!lowStock.length) {
    container.innerHTML = `
      <div class="empty-state" style="padding: var(--space-lg);">
        <i data-lucide="check" style="font-size: 2rem; color: var(--success); opacity: 0.8; margin-bottom: var(--space-sm);"></i>
        <p style="font-size: 0.85rem; font-weight: 500;">Semua stok aman!</p>
      </div>
    `;
    if (window.renderLucide) window.renderLucide();
    return;
  }

  container.innerHTML = lowStock.slice(0, 5).map(p => `
    <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border-light);">
      <div style="display: flex; align-items: center; gap: 6px;">
        <span style="font-size: 0.85rem; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
          ${getCategoryEmoji(p.category)}
          ${p.name}
        </span>
      </div>
      <span class="badge ${p.stock === 0 ? 'badge-danger' : 'badge-warning'}">
        ${p.stock === 0 ? 'Habis' : `Sisa ${p.stock}`}
      </span>
    </div>
  `).join('');
  
  if (window.renderLucide) window.renderLucide();
}

async function loadRecentTransactions() {
  const container = document.getElementById('recent-transactions');
  if (!container) return;

  const all = await db.getAllTransactions();
  const recent = all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);

  if (!recent.length) {
    container.innerHTML = `
      <div class="empty-state" style="padding: var(--space-lg);">
        <i data-lucide="shopping-cart" style="font-size: 2rem; opacity: 0.3; margin-bottom: var(--space-sm);"></i>
        <p style="font-size: 0.85rem;">Belum ada transaksi. Mulai dari menu Kasir!</p>
      </div>
    `;
    if (window.renderLucide) window.renderLucide();
    return;
  }

  container.innerHTML = `
    <div class="table-container" style="border: none;">
      <table class="data-table">
        <thead>
          <tr>
            <th>Waktu</th>
            <th>Item</th>
            <th>Total</th>
            <th>Bayar</th>
          </tr>
        </thead>
        <tbody>
          ${recent.map(t => `
            <tr>
              <td>${formatDate(t.createdAt, true)}</td>
              <td>${t.items.length} item</td>
              <td style="font-weight: 700; color: var(--accent-light);">${formatRupiah(t.total)}</td>
              <td><span class="badge badge-${t.paymentMethod === 'tunai' ? 'success' : 'info'}">${t.paymentMethod}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
  if (window.renderLucide) window.renderLucide();
}

window.renderDashboard = renderDashboard;
