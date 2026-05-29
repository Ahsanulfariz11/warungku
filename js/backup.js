/* ============================================================
   BACKUP — Export/Import data view
   ============================================================ */

async function renderBackup() {
  const container = document.getElementById('page-content');
  
  const lastBackup = await db.getSetting('lastBackup');
  
  container.innerHTML = `
    <div class="animate-fade-in">
      <div class="backup-section">
        <!-- Export -->
        <div class="backup-card">
          <div class="backup-card-icon"><i data-lucide="upload-cloud" style="width: 48px; height: 48px; margin: 0 auto 12px auto; color: var(--accent-light);"></i></div>
          <div class="backup-card-title">Export Data</div>
          <div class="backup-card-desc">
            Download semua data (produk, transaksi & karyawan) sebagai file JSON. 
            Simpan file ini sebagai backup untuk berjaga-jaga.
          </div>
          ${lastBackup ? `<p style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: var(--space-md);">Backup terakhir: ${formatDate(lastBackup, true)}</p>` : ''}
          <button class="btn btn-primary" id="btn-export" style="width: 100%; justify-content: center;">
            <i data-lucide="upload-cloud"></i> Export Semua Data
          </button>
        </div>
        
        <!-- Import -->
        <div class="backup-card">
          <div class="backup-card-icon"><i data-lucide="download-cloud" style="width: 48px; height: 48px; margin: 0 auto 12px auto; color: var(--accent-light);"></i></div>
          <div class="backup-card-title">Import Data</div>
          <div class="backup-card-desc">
            Restore data dari file backup JSON yang pernah di-export sebelumnya.
            <strong style="color: var(--warning); display: inline-flex; align-items: center; gap: 4px; justify-content: center; width: 100%;"><i data-lucide="alert-triangle" style="width: 14px; height: 14px;"></i> Data saat ini akan diganti!</strong>
          </div>
          <button class="btn btn-outline" id="btn-import" style="width: 100%; margin-bottom: var(--space-md); justify-content: center;">
            <i data-lucide="file-json"></i> Pilih File untuk Import
          </button>
          <input type="file" id="import-file" accept=".json" style="display: none;" />
          <div class="file-drop" id="file-drop">
            <i data-lucide="folder-open" style="width: 32px; height: 32px; margin: 0 auto 8px auto; color: var(--text-muted);"></i>
            <div>Seret file JSON ke sini</div>
            <div style="font-size: 0.75rem; margin-top: 4px;">atau klik tombol di atas</div>
          </div>
        </div>
      </div>
      
      <!-- Data Summary -->
      <div class="card" style="margin-top: var(--space-xl);">
        <div class="card-header">
          <span class="card-title"><i data-lucide="pie-chart" style="vertical-align: middle; margin-right: 6px;"></i> Ringkasan Data Saat Ini</span>
        </div>
        <div id="data-summary" style="padding-top: var(--space-md);"></div>
      </div>
    </div>
  `;

  // Load data summary
  await loadDataSummary();

  // Export
  document.getElementById('btn-export').addEventListener('click', exportData);

  // Import button
  document.getElementById('btn-import').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });

  // File input
  document.getElementById('import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) await importDataFromFile(file);
  });

  // Drag & drop
  const dropZone = document.getElementById('file-drop');
  
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) await importDataFromFile(file);
  });

  if (window.renderLucide) window.renderLucide();
}

async function loadDataSummary() {
  const container = document.getElementById('data-summary');
  if (!container) return;

  const products = await db.getAllProducts();
  const transactions = await db.getAllTransactions();
  const employees = await db.getAllEmployees();
  const totalSales = transactions.reduce((sum, t) => sum + t.total, 0);

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: var(--space-md);">
      <div style="text-align: center; padding: var(--space-md);">
        <div style="font-size: 1.5rem; font-weight: 800; color: var(--accent-light);">${products.length}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted);">Produk</div>
      </div>
      <div style="text-align: center; padding: var(--space-md);">
        <div style="font-size: 1.5rem; font-weight: 800; color: #60a5fa;">${transactions.length}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted);">Transaksi</div>
      </div>
      <div style="text-align: center; padding: var(--space-md);">
        <div style="font-size: 1.5rem; font-weight: 800; color: #a78bfa;">${employees.length}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted);">Karyawan</div>
      </div>
      <div style="text-align: center; padding: var(--space-md);">
        <div style="font-size: 1.5rem; font-weight: 800; color: #fbbf24;">${formatRupiah(totalSales)}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted);">Total Penjualan</div>
      </div>
    </div>
  `;
}

async function exportData() {
  try {
    const data = await db.exportAll();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-warung-sembako-${formatDateInput(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Save last backup timestamp
    await db.setSetting('lastBackup', new Date().toISOString());

    showToast('Data berhasil di-export!', 'success');
  } catch (err) {
    showToast('Gagal export: ' + err.message, 'error');
  }
}

async function importDataFromFile(file) {
  if (!file.name.endsWith('.json')) {
    showToast('Hanya file JSON yang didukung!', 'error');
    return;
  }

  const confirmed = await showConfirm(
    'Import Data',
    'Semua data saat ini akan <strong>diganti</strong> dengan data dari file backup. Pastikan Anda sudah mem-backup data saat ini. Lanjutkan?'
  );

  if (!confirmed) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!data.data || (!data.data.products && !data.data.transactions)) {
      throw new Error('Format file tidak valid');
    }

    const result = await db.importAll(data);
    showToast(`Import berhasil! ${result.products} produk, ${result.transactions} transaksi, ${result.employees || 0} karyawan`, 'success', 5000);
    
    // Reload summary
    await loadDataSummary();
    updateLowStockBadge();
  } catch (err) {
    showToast('Gagal import: ' + err.message, 'error');
  }
}

window.renderBackup = renderBackup;
window.exportData = exportData;
window.importDataFromFile = importDataFromFile;
window.downloadBackup = exportData;
window.handleBackupImport = importDataFromFile;
