import Chart from 'chart.js/auto';

let reportPeriod = '7days';
let reportStartDate = null;
let reportEndDate = null;

async function renderReports() {
  const container = document.getElementById('page-content');
  
  container.innerHTML = `
    <div class="animate-fade-in">
      <div class="toolbar">
        <div class="toolbar-left">
          <div class="filter-chips">
            <div class="chip ${reportPeriod === 'today' ? 'active' : ''}" data-period="today">Hari Ini</div>
            <div class="chip ${reportPeriod === '7days' ? 'active' : ''}" data-period="7days">7 Hari</div>
            <div class="chip ${reportPeriod === '30days' ? 'active' : ''}" data-period="30days">30 Hari</div>
            <div class="chip ${reportPeriod === 'custom' ? 'active' : ''}" data-period="custom">Custom</div>
          </div>
        </div>
        <div class="toolbar-right">
          <button class="btn btn-outline btn-sm" id="btn-export-csv"><i data-lucide="download"></i> Export CSV</button>
        </div>
      </div>
      
      <div id="custom-date-range" style="display: ${reportPeriod === 'custom' ? 'flex' : 'none'}; gap: var(--space-md); margin-bottom: var(--space-lg); align-items: flex-end;">
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">Dari</label>
          <input type="date" class="form-input" id="report-start" value="${reportStartDate || formatDateInput(daysAgo(7))}" />
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">Sampai</label>
          <input type="date" class="form-input" id="report-end" value="${reportEndDate || formatDateInput(new Date())}" />
        </div>
        <button class="btn btn-primary btn-sm" id="btn-apply-dates">Terapkan</button>
      </div>
      
      <div class="report-summary" id="report-summary"></div>
      
      <div class="chart-container" style="margin-bottom: var(--space-xl);">
        <div class="card-header">
          <span class="card-title"><i data-lucide="trending-up" style="vertical-align: middle; margin-right: 6px;"></i> Grafik Penjualan & Keuntungan</span>
        </div>
        <div style="position: relative; height: 260px;">
          <canvas id="report-chart"></canvas>
        </div>
      </div>
      
      <div class="card">
        <div class="card-header">
          <span class="card-title"><i data-lucide="list" style="vertical-align: middle; margin-right: 6px;"></i> Detail Transaksi</span>
        </div>
        <div id="report-transactions"></div>
      </div>
    </div>
  `;

  // Period filter click
  document.querySelectorAll('.filter-chips .chip[data-period]').forEach(chip => {
    chip.addEventListener('click', async () => {
      reportPeriod = chip.dataset.period;
      document.querySelectorAll('.chip[data-period]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      
      const customRange = document.getElementById('custom-date-range');
      customRange.style.display = reportPeriod === 'custom' ? 'flex' : 'none';
      
      if (reportPeriod !== 'custom') {
        await loadReportData();
      }
    });
  });

  // Apply custom dates
  const applyBtn = document.getElementById('btn-apply-dates');
  if (applyBtn) {
    applyBtn.addEventListener('click', async () => {
      reportStartDate = document.getElementById('report-start').value;
      reportEndDate = document.getElementById('report-end').value;
      await loadReportData();
    });
  }

  // Export CSV
  document.getElementById('btn-export-csv').addEventListener('click', exportReportCSV);

  // Load data
  await loadReportData();
}

function getDateRange() {
  let start, end;
  
  switch (reportPeriod) {
    case 'today':
      start = startOfDay();
      end = endOfDay();
      break;
    case '7days':
      start = daysAgo(7);
      end = endOfDay();
      break;
    case '30days':
      start = daysAgo(30);
      end = endOfDay();
      break;
    case 'custom':
      start = startOfDay(reportStartDate || daysAgo(7));
      end = endOfDay(reportEndDate || new Date());
      break;
    default:
      start = daysAgo(7);
      end = endOfDay();
  }
  
  return { start, end };
}

async function loadReportData() {
  const { start, end } = getDateRange();
  const transactions = await db.getTransactionsByDateRange(start, end);

  // Check if user can see profit
  const canSeeProfit = currentUser && currentUser.role !== 'admin_toko';

  // Summary
  const totalSales = transactions.reduce((sum, t) => sum + t.total, 0);
  const totalProfit = transactions.reduce((sum, t) => {
    return sum + t.items.reduce((s, item) => s + ((item.price - (item.buyPrice || 0)) * item.qty), 0);
  }, 0);
  const totalItems = transactions.reduce((sum, t) => {
    return sum + t.items.reduce((s, item) => s + item.qty, 0);
  }, 0);
  const avgTransaction = transactions.length > 0 ? totalSales / transactions.length : 0;

  const summaryContainer = document.getElementById('report-summary');
  if (summaryContainer) {
    summaryContainer.innerHTML = `
      <div class="report-card stagger-item">
        <div class="report-card-value" style="color: var(--accent-light);">${formatRupiah(totalSales)}</div>
        <div class="report-card-label">Total Penjualan</div>
      </div>
      ${canSeeProfit ? `
      <div class="report-card stagger-item">
        <div class="report-card-value" style="color: #34d399;">${formatRupiah(totalProfit)}</div>
        <div class="report-card-label">Keuntungan</div>
      </div>
      ` : ''}
      <div class="report-card stagger-item">
        <div class="report-card-value" style="color: #60a5fa;">${transactions.length}</div>
        <div class="report-card-label">Jumlah Transaksi</div>
      </div>
      <div class="report-card stagger-item">
        <div class="report-card-value" style="color: #fbbf24;">${totalItems}</div>
        <div class="report-card-label">Item Terjual</div>
      </div>
      <div class="report-card stagger-item">
        <div class="report-card-value" style="color: #a78bfa;">${formatRupiah(avgTransaction)}</div>
        <div class="report-card-label">Rata-rata / Transaksi</div>
      </div>
    `;
  }

  // Chart
  await loadReportChart(start, end);

  // Transactions table
  renderReportTransactions(transactions);
}

let reportChartInstance = null;

async function loadReportChart(start, end) {
  const canvas = document.getElementById('report-chart');
  if (!canvas) return;

  const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  const days = Math.min(diffDays, 31);
  const data = await db.getDailySales(days);

  if (reportChartInstance) {
    reportChartInstance.destroy();
  }

  const labels = data.map(d => d.label);
  const sales = data.map(d => d.total);
  const profits = data.map(d => d.profit);

  const datasets = [{
    label: 'Penjualan (Rp)',
    data: sales,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10b981',
    borderWidth: 2,
    fill: true,
    tension: 0.3,
    type: 'line'
  }];

  const canSeeProfit = currentUser && currentUser.role !== 'admin_toko';
  if (canSeeProfit) {
    datasets.push({
      label: 'Keuntungan (Rp)',
      data: profits,
      backgroundColor: 'rgba(59, 130, 246, 0.85)',
      borderColor: '#3b82f6',
      borderWidth: 1,
      borderRadius: 4,
      type: 'bar'
    });
  }

  reportChartInstance = new Chart(canvas, {
    data: {
      labels: labels,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: {
            color: '#94a3b8'
          }
        },
        tooltip: {
          backgroundColor: '#1e293b',
          titleColor: '#f1f5f9',
          bodyColor: '#f1f5f9',
          borderColor: 'rgba(16, 185, 129, 0.2)',
          borderWidth: 1,
          callbacks: {
            label: function(context) {
              return context.dataset.label + ': ' + formatRupiah(context.raw);
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

function renderReportTransactions(transactions) {
  const container = document.getElementById('report-transactions');
  if (!container) return;

  const canSeeProfit = currentUser && currentUser.role !== 'admin_toko';
  const sorted = [...transactions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (!sorted.length) {
    container.innerHTML = `
      <div class="empty-state" style="padding: var(--space-xl);">
        <i data-lucide="bar-chart-3" style="font-size: 3rem; opacity: 0.3; margin-bottom: var(--space-md); display: block; margin: 0 auto 12px auto;"></i>
        <div class="empty-state-title">Tidak ada data</div>
        <div class="empty-state-text">Belum ada transaksi di periode ini.</div>
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
            <th>Kasir</th>
            <th>Item</th>
            <th>Detail</th>
            <th>Total</th>
            ${canSeeProfit ? '<th>Keuntungan</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${sorted.map(t => {
            const profit = t.items.reduce((s, item) => s + ((item.price - (item.buyPrice || 0)) * item.qty), 0);
            return `
              <tr>
                <td>${formatDate(t.createdAt, true)}</td>
                <td>${t.cashierName || '-'}</td>
                <td>${t.items.length} item</td>
                <td style="font-size: 0.8rem; color: var(--text-muted);">
                  ${t.items.map(item => `${item.productName} ×${item.qty}`).join(', ')}
                </td>
                <td style="font-weight: 700; color: var(--accent-light);">${formatRupiah(t.total)}</td>
                ${canSeeProfit ? `<td style="font-weight: 600; color: #34d399;">${formatRupiah(profit)}</td>` : ''}
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
  if (window.renderLucide) window.renderLucide();
}

async function exportReportCSV() {
  const { start, end } = getDateRange();
  const transactions = await db.getTransactionsByDateRange(start, end);

  if (!transactions.length) {
    showToast('Tidak ada data untuk di-export', 'warning');
    return;
  }

  const rows = [
    ['Tanggal', 'Waktu', 'Kasir', 'Item', 'Qty', 'Harga', 'Subtotal', 'Total Transaksi', 'Metode Bayar']
  ];

  transactions.forEach(t => {
    t.items.forEach((item, i) => {
      rows.push([
        formatDate(t.createdAt),
        new Date(t.createdAt).toLocaleTimeString('id-ID'),
        i === 0 ? (t.cashierName || '-') : '',
        item.productName,
        item.qty,
        item.price,
        item.subtotal,
        i === 0 ? t.total : '',
        i === 0 ? t.paymentMethod : ''
      ]);
    });
  });

  const csv = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `laporan-warung-${formatDateInput(start)}-${formatDateInput(end)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('Laporan berhasil di-export!', 'success');
}

window.renderReports = renderReports;
window.exportReportCSV = exportReportCSV;
window.exportTransactionsCSV = exportReportCSV;
