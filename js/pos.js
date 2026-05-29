import { Html5Qrcode } from 'html5-qrcode';

/* ============================================================
   POS — Point of Sale / Kasir view
   ============================================================ */

let cart = [];
let lastUpdatedProductId = null;

async function renderPOS() {
  const container = document.getElementById('page-content');
  
  container.innerHTML = `
    <div class="animate-fade-in">
      <div class="pos-layout">
        <!-- Left: Products -->
        <div class="pos-products">
          <div class="search-bar" style="margin-bottom: var(--space-md); display: flex; gap: var(--space-sm); align-items: center;">
            <div style="position: relative; flex: 1;">
              <i data-lucide="search" class="search-icon"></i>
              <input type="text" class="form-input" id="pos-search" placeholder="Cari produk... (ketik atau scan QR)" style="padding-left: 38px;" />
            </div>
            <button class="btn btn-secondary" id="btn-scan-camera" style="padding: 10px 14px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;" title="Scan QR menggunakan Kamera">
              <i data-lucide="camera" style="width: 20px; height: 20px;"></i>
            </button>
          </div>
          <div class="filter-chips" id="pos-category-filters" style="margin-bottom: var(--space-md);"></div>
          <div class="pos-product-grid" id="pos-product-grid"></div>
        </div>
        
        <!-- Right: Cart -->
        <div class="pos-cart">
          <div class="cart-header">
            <h3><i data-lucide="shopping-cart" style="vertical-align: middle; margin-right: 6px;"></i> Keranjang</h3>
            <span class="cart-count" id="cart-count">0</span>
          </div>
          <div class="cart-items" id="cart-items">
            <div class="cart-empty">
              <i data-lucide="shopping-cart" style="font-size: 3rem; opacity: 0.3; margin-bottom: var(--space-md); display: block; margin: 0 auto 12px auto;"></i>
              <span>Keranjang kosong</span>
              <span style="font-size: 0.75rem;">Klik produk untuk menambahkan</span>
            </div>
          </div>
          <div class="cart-footer" id="cart-footer" style="display: none;">
            <div class="cart-total-row">
              <span>Subtotal</span>
              <span id="cart-subtotal">Rp 0</span>
            </div>
            <div class="cart-total-row total">
              <span>Total</span>
              <span id="cart-total">Rp 0</span>
            </div>
            <div class="cart-payment">
              <div class="form-group" style="margin-bottom: var(--space-sm);">
                <label class="form-label">Bayar (Rp)</label>
                <input type="number" class="form-input" id="pos-paid" placeholder="0" min="0" style="font-size: 1.1rem; font-weight: 700; text-align: right;" />
              </div>
              <div class="cart-change" id="cart-change" style="display: none;">
                <span>Kembalian</span>
                <span id="change-amount">Rp 0</span>
              </div>
              <div style="display: flex; gap: var(--space-sm); margin-top: var(--space-md);">
                <button class="btn btn-secondary" style="flex: 1;" id="btn-clear-cart"><i data-lucide="trash-2"></i> Kosongkan</button>
                <button class="btn btn-primary" style="flex: 2;" id="btn-pay"><i data-lucide="credit-card"></i> Bayar</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Category filters for POS
  renderPOSCategoryFilters();

  // Load products
  await loadPOSProducts();

  // Search
  document.getElementById('pos-search').addEventListener('input', debounce(async (e) => {
    await loadPOSProducts(e.target.value);
  }, 200));

  // Paid input — calculate change
  document.getElementById('pos-paid').addEventListener('input', (e) => {
    calculateChange();
  });

  // Clear cart
  document.getElementById('btn-clear-cart').addEventListener('click', () => {
    cart = [];
    renderCart();
  });

  // Pay
  document.getElementById('btn-pay').addEventListener('click', processPayment);

  // Camera Scan Click
  document.getElementById('btn-scan-camera').addEventListener('click', () => {
    startCameraScanner();
  });
}

let posCategoryFilter = 'all';

function renderPOSCategoryFilters() {
  const container = document.getElementById('pos-category-filters');
  if (!container) return;

  const chips = [
    { id: 'all', name: 'Semua', icon: 'list' },
    ...CATEGORIES
  ];

  container.innerHTML = chips.map(c => `
    <div class="chip ${posCategoryFilter === c.id ? 'active' : ''}" data-category="${c.id}">
      <i data-lucide="${c.icon}" style="vertical-align: middle; margin-right: 4px; width: 14px; height: 14px;"></i> ${c.name}
    </div>
  `).join('');

  container.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', async () => {
      posCategoryFilter = chip.dataset.category;
      renderPOSCategoryFilters();
      await loadPOSProducts();
    });
  });

  if (window.renderLucide) window.renderLucide();
}

async function loadPOSProducts(searchQuery = '') {
  const container = document.getElementById('pos-product-grid');
  if (!container) return;

  let products = await db.getAllProducts();

  // Filter by category
  if (posCategoryFilter !== 'all') {
    products = products.filter(p => p.category === posCategoryFilter);
  }

  // Filter by search
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    products = products.filter(p => 
      p.name.toLowerCase().includes(q) || 
      (p.code && p.code.toLowerCase().includes(q)) ||
      (p.labels && p.labels.some(l => l.toLowerCase().includes(q)))
    );
  }

  // Only show products with stock > 0
  products = products.filter(p => p.stock > 0);
  products.sort((a, b) => a.name.localeCompare(b.name));

  if (!products.length) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <i data-lucide="package" style="font-size: 3rem; opacity: 0.3; display: block; margin: 0 auto 12px auto;"></i>
        <div class="empty-state-title">Tidak ada produk</div>
        <div class="empty-state-text">Tambahkan produk terlebih dahulu di menu Produk.</div>
      </div>
    `;
    if (window.renderLucide) window.renderLucide();
    return;
  }

  container.innerHTML = products.map(p => `
    <div class="pos-product-card stagger-item" data-id="${p.id}" onclick="addToCart('${p.id}')" style="display: flex; flex-direction: column; align-items: center; justify-content: space-between; min-height: 200px; padding: var(--space-md);">
      <div class="pos-product-image" style="width: 100%; height: 80px; border-radius: var(--radius-md); border: 1px solid var(--border); overflow: hidden; display: flex; align-items: center; justify-content: center; background: var(--bg-tertiary); margin-bottom: var(--space-sm); flex-shrink: 0; position: relative;">
        ${p.image ? `<img src="${p.image}" style="width: 100%; height: 100%; object-fit: cover;" />` : `<div style="font-size: 1.5rem; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; color: var(--text-muted);">${getCategoryEmoji(p.category)}</div>`}
      </div>
      <div class="pos-product-name" title="${p.name}" style="font-weight: 600; width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 2px;">${p.name}</div>
      ${p.labels && p.labels.length ? `
        <div style="display: flex; gap: 4px; justify-content: center; margin-top: 2px; margin-bottom: 4px; flex-wrap: wrap;">
          ${p.labels.map(l => {
            let colorClass = 'badge-secondary';
            let style = 'background: rgba(148, 163, 184, 0.15); color: var(--text-secondary); padding: 2px 6px; font-size: 0.55rem; text-transform: uppercase; font-weight: 700;';
            if (l === 'Promo') { colorClass = 'badge-danger'; style = 'padding: 2px 6px; font-size: 0.55rem; text-transform: uppercase; font-weight: 700;'; }
            else if (l === 'Terlaris') { colorClass = 'badge-warning'; style = 'padding: 2px 6px; font-size: 0.55rem; text-transform: uppercase; font-weight: 700;'; }
            else if (l === 'Baru') { colorClass = 'badge-info'; style = 'padding: 2px 6px; font-size: 0.55rem; text-transform: uppercase; font-weight: 700;'; }
            else if (l === 'Grosir') { colorClass = 'badge-success'; style = 'padding: 2px 6px; font-size: 0.55rem; text-transform: uppercase; font-weight: 700;'; }
            return `<span class="badge ${colorClass}" style="${style}">${l}</span>`;
          }).join('')}
        </div>
      ` : ''}
      <div class="pos-product-price">${formatRupiah(p.sellPrice)}</div>
      <div class="pos-product-stock">Stok: ${p.stock} ${p.unit}</div>
    </div>
  `).join('');

  if (window.renderLucide) window.renderLucide();
}

async function addToCart(productId) {
  const product = await db.getProduct(productId);
  if (!product) return;

  const existing = cart.find(item => item.productId === productId);
  
  if (existing) {
    // Check stock
    if (existing.qty >= product.stock) {
      showToast(`Stok ${product.name} tidak mencukupi!`, 'warning');
      return;
    }
    existing.qty++;
    existing.subtotal = existing.qty * existing.price;
  } else {
    cart.push({
      productId: product.id,
      productName: product.name,
      price: product.sellPrice,
      buyPrice: product.buyPrice,
      qty: 1,
      subtotal: product.sellPrice,
      unit: product.unit,
      maxStock: product.stock
    });
  }

  lastUpdatedProductId = productId;
  renderCart();
  showToast(`${product.name} ditambahkan`, 'success', 1500);
}

function removeFromCart(index) {
  cart.splice(index, 1);
  renderCart();
}

function updateCartQty(index, delta) {
  const item = cart[index];
  if (!item) return;

  const newQty = item.qty + delta;
  
  if (newQty <= 0) {
    removeFromCart(index);
    return;
  }

  if (newQty > item.maxStock) {
    showToast('Stok tidak mencukupi!', 'warning');
    return;
  }

  item.qty = newQty;
  item.subtotal = item.qty * item.price;
  lastUpdatedProductId = item.productId;
  renderCart();
}

function renderCart() {
  const itemsContainer = document.getElementById('cart-items');
  const footer = document.getElementById('cart-footer');
  const countBadge = document.getElementById('cart-count');

  if (!itemsContainer) return;

  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
  countBadge.textContent = totalItems;

  if (!cart.length) {
    itemsContainer.innerHTML = `
      <div class="cart-empty">
        <i data-lucide="shopping-cart" style="font-size: 3rem; opacity: 0.3; margin-bottom: var(--space-md); display: block; margin: 0 auto 12px auto;"></i>
        <span>Keranjang kosong</span>
        <span style="font-size: 0.75rem;">Klik produk untuk menambahkan</span>
      </div>
    `;
    footer.style.display = 'none';
    if (window.renderLucide) window.renderLucide();
    return;
  }

  footer.style.display = 'block';

  itemsContainer.innerHTML = cart.map((item, i) => {
    const isFlash = item.productId === lastUpdatedProductId ? 'cart-item-flash-glow' : '';
    return `
      <div class="cart-item ${isFlash}">
        <div class="cart-item-info">
          <div class="cart-item-name">${item.productName}</div>
          <div class="cart-item-price">${formatRupiah(item.price)}</div>
        </div>
        <div class="cart-item-qty">
          <button onclick="updateCartQty(${i}, -1)"><i data-lucide="minus" style="width: 12px; height: 12px;"></i></button>
          <span>${item.qty}</span>
          <button onclick="updateCartQty(${i}, 1)"><i data-lucide="plus" style="width: 12px; height: 12px;"></i></button>
        </div>
        <div class="cart-item-subtotal">${formatRupiah(item.subtotal)}</div>
        <button class="cart-item-remove" onclick="removeFromCart(${i})"><i data-lucide="x" style="width: 14px; height: 14px;"></i></button>
      </div>
    `;
  }).join('');

  // Reset lastUpdatedProductId after rendering
  lastUpdatedProductId = null;

  // Update totals
  const total = cart.reduce((sum, item) => sum + item.subtotal, 0);
  document.getElementById('cart-subtotal').textContent = formatRupiah(total);
  document.getElementById('cart-total').textContent = formatRupiah(total);

  if (window.renderLucide) window.renderLucide();
  calculateChange();
}

function calculateChange() {
  const total = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const paid = Number(document.getElementById('pos-paid').value) || 0;
  const changeContainer = document.getElementById('cart-change');
  const changeAmount = document.getElementById('change-amount');

  if (paid > 0 && paid >= total) {
    changeContainer.style.display = 'flex';
    changeAmount.textContent = formatRupiah(paid - total);
  } else {
    changeContainer.style.display = 'none';
  }
}

async function processPayment() {
  if (!cart.length) {
    showToast('Keranjang masih kosong!', 'warning');
    return;
  }

  const total = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const paid = Number(document.getElementById('pos-paid').value) || 0;

  if (paid < total) {
    showToast('Jumlah pembayaran kurang!', 'error');
    document.getElementById('pos-paid').focus();
    return;
  }

  try {
    const transaction = {
      items: cart.map(item => ({
        productId: item.productId,
        productName: item.productName,
        qty: item.qty,
        price: item.price,
        buyPrice: item.buyPrice,
        subtotal: item.subtotal
      })),
      total,
      paid,
      change: paid - total,
      paymentMethod: 'tunai',
      cashierId: currentUser ? currentUser.id : null,
      cashierName: currentUser ? currentUser.name : null
    };

    await db.addTransaction(transaction);

    // Show success with change info
    const changeText = paid - total > 0 ? `\nKembalian: ${formatRupiah(paid - total)}` : '';
    showToast(`Transaksi berhasil! Total: ${formatRupiah(total)}${changeText}`, 'success', 4000);

    // Clear cart and reload products
    cart = [];
    renderCart();
    await loadPOSProducts(document.getElementById('pos-search').value);
    document.getElementById('pos-paid').value = '';
    updateLowStockBadge();
  } catch (err) {
    showToast('Gagal memproses transaksi: ' + err.message, 'error');
  }
}

// ==================== DUAL SCANNER FUNCTIONALITY (CAMERA & HARDWARE) ====================

let html5QrcodeScanner = null;
let lastScannedCode = '';
let lastScannedTime = 0;

function appendCameraScannerOverlay() {
  let overlay = document.getElementById('camera-scanner-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'camera-scanner-overlay';
    overlay.innerHTML = `
      <div class="scanner-instructions">
        <h3>Pindai QR / Barcode</h3>
        <p>Arahkan kamera belakang HP ke Kode QR atau Barcode barang</p>
        <div style="margin-top: 12px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; background: rgba(9, 13, 22, 0.75); padding: 8px 16px; border-radius: var(--radius-full); border: 1px solid rgba(255, 255, 255, 0.15); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25); pointer-events: auto;">
          <input type="checkbox" id="scan-bulk-mode" style="width: 15px; height: 15px; accent-color: #10b981; cursor: pointer; margin: 0; pointer-events: auto;" />
          <label for="scan-bulk-mode" style="font-size: 0.72rem; color: #f1f5f9; font-weight: 600; cursor: pointer; user-select: none; pointer-events: auto;">Pindai Beruntun (Multi-Scan)</label>
        </div>
      </div>
      <div id="reader" style="width: 100%; height: 100%;"></div>
      <div class="scanner-target-area">
        <div class="scanner-laser-line"></div>
      </div>
      <button class="btn btn-danger" id="btn-stop-scanner" style="position: absolute; bottom: 40px; padding: 12px 30px; border-radius: var(--radius-full); display: inline-flex; align-items: center; gap: 8px; z-index: 3003; font-weight: 600; cursor: pointer; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);">
        <i data-lucide="x" style="width: 18px; height: 18px;"></i> Tutup Kamera
      </button>
    `;
    document.body.appendChild(overlay);
    
    // Wire up Close button
    document.getElementById('btn-stop-scanner').addEventListener('click', stopCameraScanner);
    
    if (window.renderLucide) window.renderLucide();
  }
}

async function startCameraScanner(onSuccessCallback = null) {
  appendCameraScannerOverlay();
  const overlay = document.getElementById('camera-scanner-overlay');
  overlay.style.display = 'flex';

  try {
    html5QrcodeScanner = new Html5Qrcode("reader");
    
    const qrCodeSuccessCallback = async (decodedText, decodedResult) => {
      // Prevent double scans in bulk mode
      const isBulkMode = document.getElementById('scan-bulk-mode')?.checked;
      const currentTime = Date.now();
      if (isBulkMode && decodedText === lastScannedCode && (currentTime - lastScannedTime) < 1500) {
        return;
      }
      lastScannedCode = decodedText;
      lastScannedTime = currentTime;

      // Play a beautiful beep sound using Web Audio API
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(1000, audioCtx.currentTime); // 1000Hz
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.1); // beep for 100ms
      } catch (soundErr) {
        console.warn('Sound play blocked/unsupported:', soundErr);
      }

      // Haptic feedback vibration
      if (navigator.vibrate) {
        try {
          navigator.vibrate(100);
        } catch (vibErr) {
          console.warn('Vibration blocked:', vibErr);
        }
      }

      if (onSuccessCallback) {
        onSuccessCallback(decodedText);
      } else {
        await addToCartByCode(decodedText);
      }
    };

    const config = { 
      fps: 10, 
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0
    };

    // Use rear camera
    await html5QrcodeScanner.start(
      { facingMode: "environment" }, 
      config, 
      qrCodeSuccessCallback
    );
  } catch (err) {
    console.error("Camera access failed:", err);
    showToast("Gagal mengakses kamera. Berikan izin akses kamera browser Anda.", "error");
    stopCameraScanner();
  }
}

function stopCameraScanner() {
  const overlay = document.getElementById('camera-scanner-overlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
  
  if (html5QrcodeScanner) {
    html5QrcodeScanner.stop().then(() => {
      html5QrcodeScanner = null;
    }).catch(err => {
      console.warn("Failed to stop scanner cleanly:", err);
      html5QrcodeScanner = null;
    });
  }
}

async function addToCartByCode(code) {
  try {
    const allProducts = await db.getAllProducts();
    const product = allProducts.find(p => p.code && p.code.toLowerCase() === code.toLowerCase());
    
    if (product) {
      if (product.stock <= 0) {
        showToast(`Stok "${product.name}" habis!`, 'warning');
        return;
      }
      // Check if already in cart
      const existing = cart.find(item => item.productId === product.id);
      if (existing && existing.qty >= product.stock) {
        showToast(`Stok "${product.name}" tidak mencukupi!`, 'warning');
        return;
      }
      
      await addToCart(product.id);
      showToast(`Scan berhasil: ${product.name}`, 'success', 1500);
      
      // Stop camera scanner on success unless in bulk mode
      const isBulkMode = document.getElementById('scan-bulk-mode')?.checked;
      if (!isBulkMode) {
        stopCameraScanner();
      }
    } else {
      showToast(`Produk dengan kode "${code}" tidak ditemukan!`, 'warning');
    }
  } catch (err) {
    console.error('Scan error:', err);
    showToast('Gagal memproses hasil scan', 'error');
  }
}

// Keyboard wedge global scanner listener
let barcodeBuffer = '';
let lastKeyTime = 0;

document.addEventListener('keydown', async (e) => {
  // Only handle POS layout page
  const posLayout = document.querySelector('.pos-layout');
  if (!posLayout) return;

  const activeEl = document.activeElement;
  const isInputFocused = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.contentEditable === 'true');
  
  if (isInputFocused && activeEl.id !== 'pos-search') {
    return;
  }

  const currentTime = Date.now();
  
  if (currentTime - lastKeyTime > 40) {
    barcodeBuffer = '';
  }
  
  lastKeyTime = currentTime;
  
  if (e.key === 'Enter') {
    if (barcodeBuffer.length > 2) {
      const code = barcodeBuffer.trim();
      barcodeBuffer = '';
      e.preventDefault();
      await addToCartByCode(code);
    }
  } else if (e.key.length === 1) {
    barcodeBuffer += e.key;
  }
});

window.renderPOS = renderPOS;
window.addToCart = addToCart;
window.updateCartQty = updateCartQty;
window.removeFromCart = removeFromCart;
window.processPayment = processPayment;
window.calculateChange = calculateChange;
window.addToCartByCode = addToCartByCode;
window.startCameraScanner = startCameraScanner;
window.stopCameraScanner = stopCameraScanner;
