import Swal from 'sweetalert2';

let currentCategoryFilter = 'all';
let currentLabelFilter = 'all';
let currentSearchQuery = '';

async function renderProducts() {
  const container = document.getElementById('page-content');
  const canManageCategories = currentUser && (currentUser.role === 'owner' || currentUser.role === 'admin');
  
  container.innerHTML = `
    <div class="animate-fade-in">
      <div class="toolbar">
        <div class="toolbar-left" style="display: flex; gap: var(--space-sm); align-items: center; flex: 1; max-width: 500px;">
          <div class="search-bar" style="position: relative; flex: 1; max-width: 320px;">
            <i data-lucide="search" class="search-icon"></i>
            <input type="text" class="form-input" id="product-search" placeholder="Cari produk, kode atau label..." style="padding-left: 38px;" />
          </div>
          <button class="btn btn-secondary" id="btn-scan-product-search" style="padding: 10px 14px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;" title="Scan Barcode untuk Cari Produk">
            <i data-lucide="camera" style="width: 20px; height: 20px;"></i>
          </button>
          <select class="form-select" id="product-label-filter" style="max-width: 150px; margin: 0;">
            <option value="all">Semua Label</option>
            <option value="Promo">Promo</option>
            <option value="Terlaris">Terlaris</option>
            <option value="Baru">Baru</option>
            <option value="Grosir">Grosir</option>
            <option value="kustom">Label Kustom</option>
          </select>
        </div>
        <div class="toolbar-right">
          ${canManageCategories ? `
            <button class="btn btn-secondary" id="btn-manage-categories" style="display: inline-flex; align-items: center; gap: 6px;">
              <i data-lucide="settings" style="width: 16px; height: 16px;"></i> Kelola Kategori
            </button>
          ` : ''}
          <button class="btn btn-primary" id="btn-add-product">
            <i data-lucide="plus"></i> Tambah Produk
          </button>
        </div>
      </div>
      
      <div class="filter-chips" id="category-filters" style="margin-bottom: var(--space-lg);"></div>
      
      <div id="products-list"></div>
    </div>
  `;

  // Render category filters
  renderCategoryFilters();

  // Load products
  await loadProductsList();

  if (window.makeSelectCustom) {
    window.makeSelectCustom('product-label-filter');
  }

  // Event listeners
  document.getElementById('product-search').addEventListener('input', debounce(async (e) => {
    currentSearchQuery = e.target.value;
    await loadProductsList();
  }, 300));

  const btnScanProductSearch = document.getElementById('btn-scan-product-search');
  if (btnScanProductSearch) {
    btnScanProductSearch.addEventListener('click', () => {
      if (typeof window.startCameraScanner === 'function') {
        window.startCameraScanner(async (decodedText) => {
          const searchInput = document.getElementById('product-search');
          if (searchInput) {
            searchInput.value = decodedText;
            currentSearchQuery = decodedText;
            await loadProductsList();
            showToast(`Mencari kode: ${decodedText}`, 'success');
          }
          if (typeof window.stopCameraScanner === 'function') {
            window.stopCameraScanner();
          }
        });
      } else {
        showToast('Kamera pemindai tidak tersedia!', 'error');
      }
    });
  }

  const labelFilter = document.getElementById('product-label-filter');
  if (labelFilter) {
    labelFilter.value = currentLabelFilter;
    labelFilter.addEventListener('change', async (e) => {
      currentLabelFilter = e.target.value;
      await loadProductsList();
    });
  }

  document.getElementById('btn-add-product').addEventListener('click', () => {
    renderProductForm();
  });

  if (canManageCategories) {
    document.getElementById('btn-manage-categories').addEventListener('click', () => {
      renderManageCategories();
    });
  }
}

function renderCategoryFilters() {
  const container = document.getElementById('category-filters');
  if (!container) return;

  const chips = [
    { id: 'all', name: 'Semua', icon: 'list' },
    ...CATEGORIES
  ];

  container.innerHTML = chips.map(c => `
    <div class="chip ${currentCategoryFilter === c.id ? 'active' : ''}" data-category="${c.id}">
      <i data-lucide="${c.icon}" style="vertical-align: middle; margin-right: 4px; width: 14px; height: 14px;"></i> ${c.name}
    </div>
  `).join('');

  container.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', async () => {
      currentCategoryFilter = chip.dataset.category;
      renderCategoryFilters();
      await loadProductsList();
    });
  });

  if (window.renderLucide) window.renderLucide();
}

async function loadProductsList() {
  const container = document.getElementById('products-list');
  if (!container) return;

  let products = await db.getAllProducts();

  // Filter by category
  if (currentCategoryFilter !== 'all') {
    products = products.filter(p => p.category === currentCategoryFilter);
  }

  // Filter by label
  if (currentLabelFilter !== 'all') {
    if (currentLabelFilter === 'kustom') {
      products = products.filter(p => p.labels && p.labels.some(l => !['Promo', 'Terlaris', 'Baru', 'Grosir'].includes(l)));
    } else {
      products = products.filter(p => p.labels && p.labels.includes(currentLabelFilter));
    }
  }

  // Filter by search
  if (currentSearchQuery) {
    const q = currentSearchQuery.toLowerCase();
    products = products.filter(p => 
      p.name.toLowerCase().includes(q) || 
      (p.code && p.code.toLowerCase().includes(q)) ||
      (p.labels && p.labels.some(l => l.toLowerCase().includes(q)))
    );
  }

  // Sort by name
  products.sort((a, b) => a.name.localeCompare(b.name));

  if (!products.length) {
    container.innerHTML = `
      <div class="empty-state">
        <i data-lucide="package" style="font-size: 3rem; opacity: 0.3; margin-bottom: var(--space-md); display: block; margin: 0 auto 12px auto;"></i>
        <div class="empty-state-title">Belum ada produk</div>
        <div class="empty-state-text">Klik tombol "Tambah Produk" untuk menambahkan produk pertama ke warung Anda.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Produk</th>
            <th>Kategori</th>
            <th>Harga Beli</th>
            <th>Harga Jual</th>
            <th>Stok</th>
            <th>Satuan</th>
            <th style="text-align: center;">Aksi</th>
          </tr>
        </thead>
        <tbody>
          ${products.map(p => `
            <tr>
              <td>
                <div style="display: flex; align-items: center; gap: var(--space-md);">
                  <div style="width: 40px; height: 40px; border-radius: var(--radius-sm); border: 1px solid var(--border); overflow: hidden; display: flex; align-items: center; justify-content: center; background: var(--bg-secondary); flex-shrink: 0;">
                    ${p.image ? `<img src="${p.image}" style="width: 100%; height: 100%; object-fit: cover;" />` : `<i data-lucide="package" style="width: 20px; height: 20px; color: var(--text-muted);"></i>`}
                  </div>
                  <div>
                    <div style="font-weight: 600;">${p.name}</div>
                    <div style="font-size: 0.72rem; color: var(--text-muted); font-family: monospace; margin-top: 1px;">${p.code || '-'}</div>
                    ${p.labels && p.labels.length ? `
                      <div style="display: flex; gap: 4px; margin-top: 4px; flex-wrap: wrap;">
                        ${p.labels.map(l => {
                          let colorClass = 'badge-secondary';
                          let style = 'background: rgba(148, 163, 184, 0.15); color: var(--text-secondary);';
                          if (l === 'Promo') { colorClass = 'badge-danger'; style = ''; }
                          else if (l === 'Terlaris') { colorClass = 'badge-warning'; style = ''; }
                          else if (l === 'Baru') { colorClass = 'badge-info'; style = ''; }
                          else if (l === 'Grosir') { colorClass = 'badge-success'; style = ''; }
                          return `<span class="badge ${colorClass}" style="${style}">${l}</span>`;
                        }).join('')}
                      </div>
                    ` : ''}
                  </div>
                </div>
              </td>
              <td>
                <span style="font-size: 0.85rem; display: inline-flex; align-items: center; gap: 6px;">${getCategoryEmoji(p.category)} ${getCategoryName(p.category)}</span>
              </td>
              <td>${formatRupiah(p.buyPrice)}</td>
              <td style="font-weight: 600; color: var(--accent-light);">${formatRupiah(p.sellPrice)}</td>
              <td>
                <span class="badge ${p.stock === 0 ? 'badge-danger' : p.stock <= p.minStock ? 'badge-warning' : 'badge-success'}">
                  ${p.stock}
                </span>
              </td>
              <td>${p.unit}</td>
              <td style="text-align: center;">
                <div style="display: flex; gap: 4px; justify-content: center;">
                  <button class="btn-icon" title="Edit" onclick="renderProductForm('${p.id}')"><i data-lucide="edit"></i></button>
                  <button class="btn-icon" title="Tambah Stok" onclick="renderAddStockForm('${p.id}')"><i data-lucide="plus-circle"></i></button>
                  <button class="btn-icon" title="Hapus" onclick="deleteProduct('${p.id}')"><i data-lucide="trash-2"></i></button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <div style="padding: var(--space-md); color: var(--text-muted); font-size: 0.8rem;">
      Menampilkan ${products.length} produk
    </div>
  `;
  if (window.renderLucide) window.renderLucide();
}

async function renderProductForm(productId = null) {
  const isEdit = !!productId;
  let product = null;

  if (isEdit) {
    product = await db.getProduct(productId);
    if (!product) return;
  }

  let productImageBase64 = product ? (product.image || '') : '';

  const container = document.getElementById('page-content');
  container.innerHTML = `
    <div class="animate-fade-in" style="max-width: 860px; margin: 0 auto;">
      <div style="display: flex; align-items: center; gap: var(--space-md); margin-bottom: var(--space-lg);">
        <button class="btn btn-secondary btn-sm" onclick="renderProducts()" style="padding: 8px 12px; border-radius: var(--radius-md); display: inline-flex; align-items: center; gap: 6px;">
          <i data-lucide="arrow-left" style="width: 16px; height: 16px;"></i> Kembali
        </button>
        <h2 style="font-size: 1.4rem; font-weight: 700; color: var(--text-primary); margin: 0;">${isEdit ? 'Edit Produk' : 'Tambah Produk Baru'}</h2>
      </div>
      
      <div class="card" style="padding: var(--space-xl); border-radius: var(--radius-lg); background: var(--bg-card); border: 1px solid var(--border);">
        <form id="product-form" onsubmit="event.preventDefault();" style="display: grid; grid-template-columns: 240px 1fr; gap: var(--space-xl);">
          
          <!-- Left Column: Large Product Photo -->
          <div style="display: flex; flex-direction: column; align-items: center; gap: var(--space-md);">
            <label class="form-label" style="align-self: flex-start; margin-bottom: 2px;">Foto Produk</label>
            <div id="image-preview-container" style="width: 240px; height: 240px; border-radius: var(--radius-lg); border: 1px solid var(--border); background: var(--bg-tertiary); overflow: hidden; display: flex; align-items: center; justify-content: center; position: relative;">
              ${productImageBase64 ? `<img src="${productImageBase64}" id="img-preview" style="width: 100%; height: 100%; object-fit: cover;" />` : `<i data-lucide="package" id="img-placeholder" style="width: 64px; height: 64px; color: var(--text-muted); opacity: 0.5;"></i>`}
            </div>
            <div style="width: 100%; display: flex; flex-direction: column; gap: var(--space-xs);">
              <input type="file" id="f-image-file" accept="image/*" style="display: none;" />
              <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('f-image-file').click()" style="justify-content: center; display: flex; align-items: center; gap: 6px; width: 100%;">
                <i data-lucide="upload" style="width: 14px; height: 14px;"></i> Pilih Foto
              </button>
              <button type="button" class="btn btn-danger btn-sm" id="btn-remove-image" style="justify-content: center; display: ${productImageBase64 ? 'flex' : 'none'}; align-items: center; gap: 6px; width: 100%;">
                <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i> Hapus Foto
              </button>
            </div>
            <span class="form-hint" style="text-align: center; font-size: 0.7rem; line-height: 1.4;">Mendukung format JPG, PNG, atau WebP dengan ukuran maksimal 2MB.</span>
          </div>
          
          <!-- Right Column: Form Inputs -->
          <div style="display: flex; flex-direction: column; gap: var(--space-md);">
            <div class="form-group">
              <label class="form-label">Nama Produk *</label>
              <input type="text" class="form-input" id="f-name" value="${product ? product.name : ''}" placeholder="Contoh: Beras Pandan Wangi 5kg" required />
            </div>
            
            <div class="form-group">
              <label class="form-label" style="display: flex; justify-content: space-between; align-items: center;">
                <span>Kode Produk</span>
                <div style="display: flex; gap: 6px;">
                  <button type="button" class="btn btn-secondary btn-sm" id="btn-generate-code" style="padding: 2px 8px; font-size: 0.7rem; display: inline-flex; align-items: center; gap: 4px; height: auto; font-weight: 500; cursor: pointer; border-radius: var(--radius-sm); border: 1px solid var(--border);">
                    <i data-lucide="refresh-cw" style="width: 10px; height: 10px;"></i> Buat Otomatis
                  </button>
                  <button type="button" class="btn btn-secondary btn-sm" id="btn-scan-product-code" style="padding: 2px 8px; font-size: 0.7rem; display: inline-flex; align-items: center; gap: 4px; height: auto; font-weight: 500; cursor: pointer; border-radius: var(--radius-sm); border: 1px solid var(--border);" title="Scan Barcode menggunakan Kamera HP">
                    <i data-lucide="camera" style="width: 10px; height: 10px;"></i> Scan Kamera
                  </button>
                </div>
              </label>
              <input type="text" class="form-input" id="f-code" value="${product ? (product.code || '') : ''}" placeholder="Contoh: SEM-0001 (atau klik Buat Otomatis)" />
            </div>
            
            <div class="form-group">
              <label class="form-label">Kategori</label>
              <select class="form-select" id="f-category">
                ${CATEGORIES.map(c => `
                  <option value="${c.id}" ${product && product.category === c.id ? 'selected' : ''}>
                    ${c.name}
                  </option>
                `).join('')}
              </select>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Harga Beli (Rp) *</label>
                <input type="number" class="form-input" id="f-buyPrice" value="${product ? product.buyPrice : ''}" placeholder="0" min="0" required />
              </div>
              <div class="form-group">
                <label class="form-label">Harga Jual (Rp) *</label>
                <input type="number" class="form-input" id="f-sellPrice" value="${product ? product.sellPrice : ''}" placeholder="0" min="0" required />
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Stok Awal</label>
                <input type="number" class="form-input" id="f-stock" value="${product ? product.stock : 0}" min="0" ${isEdit ? 'disabled' : ''} />
                ${isEdit ? '<span class="form-hint">Ubah stok di tombol Tambah Stok tabel</span>' : ''}
              </div>
              <div class="form-group">
                <label class="form-label">Stok Minimum</label>
                <input type="number" class="form-input" id="f-minStock" value="${product ? product.minStock : 5}" min="0" />
                <span class="form-hint">Peringatan jika stok di bawah ini</span>
              </div>
            </div>
            
            <div class="form-group">
              <label class="form-label">Satuan</label>
              <select class="form-select" id="f-unit">
                ${['pcs', 'kg', 'liter', 'bungkus', 'botol', 'kaleng', 'sachet', 'kotak', 'lusin', 'rim'].map(u => `
                  <option value="${u}" ${product && product.unit === u ? 'selected' : ''}>${u}</option>
                `).join('')}
              </select>
            </div>

            <div class="form-group" style="margin-bottom: var(--space-lg);">
              <label class="form-label">Label / Tag Produk</label>
              <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: var(--space-sm);">
                ${['Promo', 'Terlaris', 'Baru', 'Grosir'].map(tag => {
                  const isChecked = product && product.labels && product.labels.includes(tag);
                  return `
                    <label class="chip" style="display: inline-flex; align-items: center; gap: 6px; cursor: pointer; user-select: none; padding: 6px 12px; border-radius: var(--radius-md); border: 1px solid var(--border); background: var(--bg-secondary);">
                      <input type="checkbox" class="f-label-check" value="${tag}" ${isChecked ? 'checked' : ''} style="margin: 0; width: 14px; height: 14px; accent-color: var(--accent);" />
                      ${tag}
                    </label>
                  `;
                }).join('')}
              </div>
              <input type="text" class="form-input" id="f-custom-labels" value="${product && product.labels ? product.labels.filter(tag => !['Promo', 'Terlaris', 'Baru', 'Grosir'].includes(tag)).join(', ') : ''}" placeholder="Label kustom lainnya (pisahkan dengan koma)" />
            </div>
            
            <div style="display: flex; justify-content: flex-end; gap: var(--space-md); border-top: 1px solid var(--border); padding-top: var(--space-lg); margin-top: var(--space-md);">
              <button type="button" class="btn btn-secondary" onclick="renderProducts()">Batal</button>
              <button type="button" class="btn btn-primary" id="btn-save-product" style="padding: 10px 24px;">
                <i data-lucide="save"></i> ${isEdit ? 'Simpan Perubahan' : 'Tambah Produk'}
              </button>
            </div>
          </div>
          
        </form>
      </div>
    </div>
  `;

  // Focus on name field
  setTimeout(() => {
    const nameEl = document.getElementById('f-name');
    if (nameEl) nameEl.focus();
  }, 200);

  // File upload logic
  const imageFileInput = document.getElementById('f-image-file');
  const imagePreviewContainer = document.getElementById('image-preview-container');
  const btnRemoveImage = document.getElementById('btn-remove-image');

  if (imageFileInput) {
    imageFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (file.size > 2 * 1024 * 1024) {
        showToast('Ukuran foto maksimal 2MB!', 'warning');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        productImageBase64 = event.target.result;
        imagePreviewContainer.innerHTML = `<img src="${productImageBase64}" id="img-preview" style="width: 100%; height: 100%; object-fit: cover;" />`;
        btnRemoveImage.style.display = 'flex';
      };
      reader.readAsDataURL(file);
    });
  }

  if (btnRemoveImage) {
    btnRemoveImage.addEventListener('click', () => {
      productImageBase64 = '';
      imagePreviewContainer.innerHTML = `<i data-lucide="package" id="img-placeholder" style="width: 64px; height: 64px; color: var(--text-muted); opacity: 0.5;"></i>`;
      btnRemoveImage.style.display = 'none';
      if (window.renderLucide) window.renderLucide();
      if (imageFileInput) imageFileInput.value = '';
    });
  }

  const categorySelect = document.getElementById('f-category');
  const codeInput = document.getElementById('f-code');
  const btnGenerateCode = document.getElementById('btn-generate-code');

  // Helper to update the code
  const updateCodeAutomatically = async () => {
    const selectedCat = categorySelect.value;
    const nextCode = await window.generateNextProductCode(selectedCat);
    codeInput.value = nextCode;
  };

  if (btnGenerateCode) {
    btnGenerateCode.addEventListener('click', updateCodeAutomatically);
  }

  const autoFillProductDetails = async (barcode) => {
    if (!barcode || !/^\d+$/.test(barcode) || barcode.length < 6) {
      return;
    }

    const nameInput = document.getElementById('f-name');
    if (nameInput && !nameInput.value.trim()) {
      const info = await window.fetchProductInfoByBarcode(barcode);
      if (info && info.name) {
        nameInput.value = info.name;
        showToast(`Produk ditemukan online: ${info.name}`, 'success', 2500);
        
        // Auto-select category!
        const categorySelect = document.getElementById('f-category');
        if (categorySelect && info.category) {
          categorySelect.value = info.category;
          const event = new Event('change', { bubbles: true });
          categorySelect.dispatchEvent(event);
        }
        
        if (info.image && !productImageBase64) {
          const imagePreviewContainer = document.getElementById('image-preview-container');
          const btnRemoveImage = document.getElementById('btn-remove-image');
          if (imagePreviewContainer) {
            productImageBase64 = info.image;
            imagePreviewContainer.innerHTML = `<img src="${info.image}" id="img-preview" style="width: 100%; height: 100%; object-fit: cover;" />`;
            if (btnRemoveImage) btnRemoveImage.style.display = 'flex';
          }
        }
      } else {
        showToast('Info produk tidak ditemukan online. Silakan isi nama secara manual.', 'info', 3000);
      }
    }
  };

  if (codeInput) {
    codeInput.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const barcode = codeInput.value.trim();
        await autoFillProductDetails(barcode);
      }
    });

    codeInput.addEventListener('change', async () => {
      const barcode = codeInput.value.trim();
      await autoFillProductDetails(barcode);
    });
  }

  const btnScanProductCode = document.getElementById('btn-scan-product-code');
  if (btnScanProductCode) {
    btnScanProductCode.addEventListener('click', () => {
      if (typeof window.startCameraScanner === 'function') {
        window.startCameraScanner(async (decodedText) => {
          if (codeInput) {
            codeInput.value = decodedText;
            showToast(`Scan berhasil: ${decodedText}`, 'success');
            await autoFillProductDetails(decodedText);
          }
          const isBulkMode = document.getElementById('scan-bulk-mode')?.checked;
          if (!isBulkMode && typeof window.stopCameraScanner === 'function') {
            window.stopCameraScanner();
          }
        });
      } else {
        showToast('Kamera pemindai tidak tersedia!', 'error');
      }
    });
  }

  // Automatic code fill on category change for new products
  if (categorySelect && codeInput) {
    let previousCategory = categorySelect.value;
    
    // Auto-generate code for a new product immediately if code is empty
    if (!isEdit && !codeInput.value) {
      updateCodeAutomatically();
    }

    categorySelect.addEventListener('change', async () => {
      const prevPrefix = window.getCategoryCodePrefix(previousCategory);
      const currentVal = codeInput.value;
      
      if (!isEdit && (!currentVal || currentVal.startsWith(prevPrefix))) {
        await updateCodeAutomatically();
      }
      
      previousCategory = categorySelect.value;
    });
  }

  // Load Lucide Icons inside the page-content
  if (window.renderLucide) window.renderLucide();

  if (window.makeSelectCustom) {
    window.makeSelectCustom('f-category');
    window.makeSelectCustom('f-unit');
  }

  // Save handler
  document.getElementById('btn-save-product').addEventListener('click', async () => {
    const name = document.getElementById('f-name').value.trim();
    const code = document.getElementById('f-code').value.trim();
    const category = document.getElementById('f-category').value;
    const buyPrice = Number(document.getElementById('f-buyPrice').value);
    const sellPrice = Number(document.getElementById('f-sellPrice').value);
    const stock = Number(document.getElementById('f-stock').value);
    const minStock = Number(document.getElementById('f-minStock').value);
    const unit = document.getElementById('f-unit').value;

    // Collect labels
    const checkedLabels = Array.from(document.querySelectorAll('.f-label-check:checked')).map(el => el.value);
    const customLabelsInput = document.getElementById('f-custom-labels').value.trim();
    const customLabels = customLabelsInput ? customLabelsInput.split(',').map(s => s.trim()).filter(s => s.length > 0) : [];
    const labels = [...new Set([...checkedLabels, ...customLabels])];

    if (!name) {
      showToast('Nama produk harus diisi!', 'error');
      return;
    }
    if (sellPrice <= 0) {
      showToast('Harga jual harus lebih dari 0!', 'error');
      return;
    }

    try {
      if (isEdit) {
        await db.updateProduct(productId, { name, code, category, buyPrice, sellPrice, stock, minStock, unit, labels, image: productImageBase64 });
        showToast('Produk berhasil diperbarui!', 'success');
      } else {
        await db.addProduct({ name, code, category, buyPrice, sellPrice, stock, minStock, unit, labels, image: productImageBase64 });
        showToast('Produk berhasil ditambahkan!', 'success');
      }
      await renderProducts();
      updateLowStockBadge();
    } catch (err) {
      showToast('Gagal menyimpan: ' + err.message, 'error');
    }
  });
}

async function renderAddStockForm(productId) {
  const product = await db.getProduct(productId);
  if (!product) return;

  const container = document.getElementById('page-content');
  container.innerHTML = `
    <div class="animate-fade-in" style="max-width: 480px; margin: 0 auto;">
      <div style="display: flex; align-items: center; gap: var(--space-md); margin-bottom: var(--space-lg);">
        <button class="btn btn-secondary btn-sm" onclick="renderProducts()" style="padding: 8px 12px; border-radius: var(--radius-md); display: inline-flex; align-items: center; gap: 6px;">
          <i data-lucide="arrow-left" style="width: 16px; height: 16px;"></i> Kembali
        </button>
        <h2 style="font-size: 1.4rem; font-weight: 700; color: var(--text-primary); margin: 0;">Tambah Stok</h2>
      </div>
      
      <div class="card" style="padding: var(--space-xl); border-radius: var(--radius-lg); background: var(--bg-card); border: 1px solid var(--border);">
        <p style="margin-bottom: var(--space-lg); color: var(--text-secondary); font-size: 0.95rem; line-height: 1.6;">
          Produk: <strong style="color: var(--text-primary);">${product.name}</strong><br>
          Stok saat ini: <span class="badge badge-info" style="font-size: 0.8rem; padding: 4px 10px;">${product.stock} ${product.unit}</span>
        </p>
        
        <form id="stock-form" onsubmit="event.preventDefault();">
          <div class="form-group" style="margin-bottom: var(--space-xl);">
            <label class="form-label">Jumlah yang ditambahkan</label>
            <input type="number" class="form-input" id="f-add-stock" value="1" min="1" style="font-size: 1.3rem; font-weight: 700; text-align: center; padding: 12px;" />
          </div>
          
          <div style="display: flex; justify-content: flex-end; gap: var(--space-md); border-top: 1px solid var(--border); padding-top: var(--space-lg);">
            <button type="button" class="btn btn-secondary" onclick="renderProducts()">Batal</button>
            <button type="button" class="btn btn-primary" id="btn-save-stock" style="padding: 10px 24px;">
              <i data-lucide="plus"></i> Tambah Stok
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  setTimeout(() => {
    const stockEl = document.getElementById('f-add-stock');
    if (stockEl) stockEl.focus();
  }, 200);

  if (window.renderLucide) window.renderLucide();

  document.getElementById('btn-save-stock').addEventListener('click', async () => {
    const qty = Number(document.getElementById('f-add-stock').value);
    if (qty <= 0) {
      showToast('Jumlah harus lebih dari 0!', 'error');
      return;
    }
    try {
      await db.updateStock(productId, qty);
      showToast(`Stok ${product.name} bertambah ${qty} ${product.unit}`, 'success');
      await renderProducts();
      updateLowStockBadge();
    } catch (err) {
      showToast('Gagal: ' + err.message, 'error');
    }
  });
}



async function deleteProduct(productId) {
  const product = await db.getProduct(productId);
  if (!product) return;

  const confirmed = await showConfirm(
    'Hapus Produk',
    `Apakah Anda yakin ingin menghapus <strong>${product.name}</strong>? Tindakan ini tidak bisa dibatalkan.`
  );

  if (confirmed) {
    try {
      await db.deleteProduct(productId);
      showToast(`Produk "${product.name}" berhasil dihapus`, 'success');
      await loadProductsList();
      updateLowStockBadge();
    } catch (err) {
      showToast('Gagal menghapus: ' + err.message, 'error');
    }
  }
}

async function updateLowStockBadge() {
  const lowStock = await db.getLowStockProducts();
  const badge = document.getElementById('nav-badge-products');
  if (badge) {
    if (lowStock.length > 0) {
      badge.textContent = lowStock.length;
      badge.style.display = 'inline';
    } else {
      badge.style.display = 'none';
    }
  }
}

async function renderManageCategories() {
  const container = document.getElementById('page-content');
  if (!container) return;

  container.innerHTML = `
    <div class="animate-fade-in" style="max-width: 860px; margin: 0 auto;">
      <div style="display: flex; align-items: center; gap: var(--space-md); margin-bottom: var(--space-lg);">
        <button class="btn btn-secondary btn-sm" onclick="renderProducts()" style="padding: 8px 12px; border-radius: var(--radius-md); display: inline-flex; align-items: center; gap: 6px;">
          <i data-lucide="arrow-left" style="width: 16px; height: 16px;"></i> Kembali
        </button>
        <h2 style="font-size: 1.4rem; font-weight: 700; color: var(--text-primary); margin: 0;">Kelola Kategori Produk</h2>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 340px; gap: var(--space-xl);">
        
        <!-- Left: Categories List -->
        <div class="card" style="padding: var(--space-xl); border-radius: var(--radius-lg); background: var(--bg-card); border: 1px solid var(--border);">
          <h3 style="margin-top: 0; margin-bottom: var(--space-md); font-size: 1.1rem; font-weight: 600; color: var(--text-primary);">Daftar Kategori Aktif</h3>
          <div id="categories-list-container" style="display: flex; flex-direction: column; gap: var(--space-sm);">
            ${CATEGORIES.map(c => `
              <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-radius: var(--radius-md); background: var(--bg-secondary); border: 1px solid var(--border); transition: border-color var(--transition-fast);">
                <div style="display: flex; align-items: center; gap: var(--space-md);">
                  <span style="font-size: 1.3rem; color: var(--accent-light); display: inline-flex; align-items: center;">${getCategoryEmoji(c.id)}</span>
                  <strong style="color: var(--text-primary); font-size: 0.95rem; font-weight: 600;">${c.name}</strong>
                </div>
                ${c.id !== 'lainnya' ? `
                  <button class="btn-icon delete-cat-btn" data-id="${c.id}" style="color: var(--danger); padding: var(--space-xs); cursor: pointer; background: none; border: none;" title="Hapus Kategori">
                    <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
                  </button>
                ` : '<span class="badge badge-secondary" style="font-size: 0.75rem; font-style: italic; background: rgba(148, 163, 184, 0.1); color: var(--text-muted); padding: 4px 8px; border-radius: var(--radius-sm);">Bawaan</span>'}
              </div>
            `).join('')}
          </div>
        </div>
        
        <!-- Right: Add New Category Form -->
        <div class="card" style="padding: var(--space-xl); border-radius: var(--radius-lg); background: var(--bg-card); border: 1px solid var(--border); height: fit-content;">
          <h3 style="margin-top: 0; margin-bottom: var(--space-md); font-size: 1.1rem; font-weight: 600; color: var(--text-primary);">Tambah Kategori Baru</h3>
          <form id="add-category-form" onsubmit="event.preventDefault();" style="display: flex; flex-direction: column; gap: var(--space-md);">
            <div class="form-group">
              <label class="form-label">Nama Kategori</label>
              <input type="text" class="form-input" id="new-cat-name" placeholder="Contoh: Obat & Kesehatan" required />
            </div>
            
            <div class="form-group" style="margin-bottom: var(--space-sm);">
              <label class="form-label">Ikon Kategori</label>
              <select class="form-select" id="new-cat-icon">
                <option value="wheat">🌾 Gandum / Sembako</option>
                <option value="cookie">🍪 Kue / Makanan</option>
                <option value="home">🏠 Rumah / Kebersihan</option>
                <option value="cup-soda">🥤 Minuman</option>
                <option value="flame">🔥 Api / Rokok</option>
                <option value="sparkles">✨ Sabun / Detergen</option>
                <option value="fuel">⛽ Gas / BBM</option>
                <option value="package">📦 Lainnya / Paket</option>
              </select>
            </div>
            
            <button type="button" class="btn btn-primary" id="btn-save-category" style="width: 100%; justify-content: center; display: inline-flex; align-items: center; gap: 6px;">
              <i data-lucide="plus" style="width: 16px; height: 16px;"></i> Tambah Kategori
            </button>
          </form>
        </div>
        
      </div>
    </div>
  `;

  if (window.renderLucide) window.renderLucide();

  // Save handler
  document.getElementById('btn-save-category').addEventListener('click', async () => {
    const name = document.getElementById('new-cat-name').value.trim();
    const icon = document.getElementById('new-cat-icon').value;
    
    if (!name) {
      showToast('Nama kategori tidak boleh kosong!', 'error');
      return;
    }
    
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
    if (!id) {
      showToast('Nama kategori tidak valid!', 'error');
      return;
    }
    
    if (CATEGORIES.some(c => c.id === id)) {
      showToast('Kategori dengan nama serupa sudah ada!', 'warning');
      return;
    }
    
    const newCat = { id, name, icon };
    const updatedCategories = [...CATEGORIES, newCat];
    
    try {
      await db.setSetting('categories', updatedCategories);
      CATEGORIES.push(newCat);
      showToast(`Kategori "${name}" berhasil ditambahkan!`, 'success');
      
      // Live reload categories list inside page
      renderManageCategories();
    } catch (err) {
      showToast('Gagal menambahkan kategori: ' + err.message, 'error');
    }
  });

  // Delete handler
  container.querySelectorAll('.delete-cat-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const catId = btn.dataset.id;
      const cat = CATEGORIES.find(c => c.id === catId);
      if (!cat) return;
      
      const confirmed = await showConfirm(
        'Hapus Kategori',
        `Apakah Anda yakin ingin menghapus kategori <strong>${cat.name}</strong>?<br><br><small style="color: var(--danger);">Semua produk di kategori ini otomatis akan dialihkan ke kategori "Lainnya".</small>`
      );
      
      if (confirmed) {
        try {
          // Update all products in DB using this category to 'lainnya'
          const allProducts = await db.getAllProducts();
          for (const p of allProducts) {
            if (p.category === catId) {
              await db.updateProduct(p.id, { category: 'lainnya' });
            }
          }
          
          const updatedCategories = CATEGORIES.filter(c => c.id !== catId);
          await db.setSetting('categories', updatedCategories);
          
          // Update local state
          CATEGORIES.length = 0;
          CATEGORIES.push(...updatedCategories);
          
          showToast(`Kategori "${cat.name}" berhasil dihapus!`, 'success');
          
          // Live reload
          renderManageCategories();
        } catch (err) {
          showToast('Gagal menghapus kategori: ' + err.message, 'error');
        }
      }
    });
  });
}

window.renderProducts = renderProducts;
window.renderProductForm = renderProductForm;
window.deleteProduct = deleteProduct;
window.renderAddStockForm = renderAddStockForm;
window.quickAddStock = renderAddStockForm;
window.updateLowStockBadge = updateLowStockBadge;
window.renderManageCategories = renderManageCategories;
