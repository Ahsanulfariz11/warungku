/* ============================================================
   APP — Main application controller & router
   ============================================================ */

let currentPage = 'dashboard';

// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Initialize database
    await db.init();
    console.log('Database initialized');

    // Bypass login: directly enter main app
    hideLoginScreen();
    await initApp();

  } catch (err) {
    console.error('Initialization failed:', err);
    showToast('Gagal memuat aplikasi: ' + err.message, 'error');
  }
});

/**
 * Initialize the main app after login
 */
async function initApp() {
  // Load dynamic categories
  if (window.loadGlobalCategories) {
    await window.loadGlobalCategories();
  }

  // Setup navigation
  setupNavigation();

  // Setup mobile menu
  setupMobileMenu();
  setupMobileBottomScan();

  // Setup online/offline detection
  setupConnectionStatus();

  // Setup PWA install prompt
  setupPWAInstall();

  // Update sidebar based on role
  updateSidebarForRole();
  updateSidebarUserInfo();

  // Navigate to default page for role
  const hash = window.location.hash.slice(1);
  const defaultPage = getDefaultPage();
  
  if (hash && hasAccess(hash)) {
    navigateTo(hash);
  } else {
    navigateTo(defaultPage);
  }

  // Update low stock badge
  updateLowStockBadge();
}

// ==================== NAVIGATION ====================

function setupNavigation() {
  document.querySelectorAll('.nav-item[data-page], .mobile-bottom-nav-item[data-page]').forEach(item => {
    item.addEventListener('click', () => {
      const page = item.dataset.page;
      if (hasAccess(page)) {
        navigateTo(page);
        closeMobileSidebar();
      } else {
        showToast('Anda tidak memiliki akses ke halaman ini', 'warning');
      }
    });
  });

  // Handle browser back/forward
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.slice(1) || getDefaultPage();
    if (hash !== currentPage && hasAccess(hash)) {
      navigateTo(hash, false);
    }
  });
}

async function navigateTo(page, updateHash = true) {
  // Check access
  if (!hasAccess(page)) {
    const defaultPage = getDefaultPage();
    if (page !== defaultPage) {
      showToast('Akses ditolak', 'warning');
      navigateTo(defaultPage);
    }
    return;
  }

  currentPage = page;

  if (updateHash) {
    window.location.hash = page;
  }

  // Update active nav item
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });
  document.querySelectorAll('.mobile-bottom-nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });

  // Update page header
  const titles = {
    dashboard: { title: 'Dashboard', subtitle: 'Ringkasan penjualan dan stok warung Anda', icon: 'layout-dashboard' },
    products: { title: 'Produk', subtitle: 'Kelola produk dan stok barang', icon: 'package' },
    pos: { title: 'Kasir', subtitle: 'Transaksi penjualan', icon: 'shopping-cart' },
    reports: { title: 'Laporan', subtitle: 'Statistik dan laporan penjualan', icon: 'trending-up' },
    backup: { title: 'Backup', subtitle: 'Export dan import data', icon: 'database' },
    employees: { title: 'Karyawan', subtitle: 'Kelola karyawan dan hak akses', icon: 'users' }
  };

  const info = titles[page] || titles.dashboard;
  document.getElementById('page-title').innerHTML = `<i data-lucide="${info.icon}" style="vertical-align: middle; margin-right: 8px;"></i>${info.title}`;
  document.getElementById('page-subtitle').textContent = info.subtitle;

  // Render page content
  const container = document.getElementById('page-content');
  container.innerHTML = `<div class="loading-spinner"><div class="spinner"></div></div>`;

  try {
    switch (page) {
      case 'dashboard':
        await renderDashboard();
        break;
      case 'products':
        await renderProducts();
        break;
      case 'pos':
        await renderPOS();
        break;
      case 'reports':
        await renderReports();
        break;
      case 'backup':
        await renderBackup();
        break;
      case 'employees':
        await renderEmployees();
        break;
      default:
        await renderDashboard();
    }
    
    // Trigger Lucide icons rendering
    if (window.renderLucide) window.renderLucide();
  } catch (err) {
    console.error(`Error rendering ${page}:`, err);
    container.innerHTML = `
      <div class="empty-state">
        <i data-lucide="alert-triangle" style="font-size: 2rem; color: var(--danger); margin-bottom: var(--space-md);"></i>
        <div class="empty-state-title">Terjadi Kesalahan</div>
        <div class="empty-state-text">${err.message}</div>
      </div>
    `;
    if (window.renderLucide) window.renderLucide();
  }
}

// ==================== SIDEBAR ROLE MANAGEMENT ====================

function updateSidebarForRole() {
  if (!currentUser) return;

  const permissions = ROLE_PERMISSIONS[currentUser.role] || [];

  // Show/hide nav items based on role
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    const page = item.dataset.page;
    item.style.display = permissions.includes(page) ? '' : 'none';
  });

  // Show/hide nav sections if all items are hidden
  document.querySelectorAll('.nav-section').forEach(section => {
    const visibleItems = section.querySelectorAll('.nav-item[data-page]:not([style*="display: none"])');
    const title = section.querySelector('.nav-section-title');
    if (visibleItems.length === 0 && title) {
      section.style.display = 'none';
    } else {
      section.style.display = '';
    }
  });
}

function updateSidebarUserInfo() {
  const userInfo = document.getElementById('sidebar-user-info');
  if (!userInfo || !currentUser) return;

  const roleInfo = getRoleInfo(currentUser.role);
  userInfo.innerHTML = `
    <div class="sidebar-user">
      <div class="user-avatar user-avatar-sm" style="background: ${getAvatarColor(currentUser.role)}">
        ${getInitials(currentUser.name)}
      </div>
      <div class="sidebar-user-details">
        <div class="sidebar-user-name">${currentUser.name}</div>
        <div class="sidebar-user-role">${roleInfo.label}</div>
      </div>
    </div>
  `;
}

async function handleLogout() {
  const confirmed = await showConfirm('Logout', 'Apakah Anda yakin ingin keluar?');
  if (confirmed) {
    logout();
    showToast('Berhasil logout', 'info');
    await showLoginScreen();
  }
}

// ==================== MOBILE MENU ====================

function setupMobileMenu() {
  const toggle = document.getElementById('menu-toggle');
  const bottomMenu = document.getElementById('btn-mobile-bottom-menu');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');

  const toggleSidebar = () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('show');
  };

  if (toggle) {
    toggle.addEventListener('click', toggleSidebar);
  }

  if (bottomMenu) {
    bottomMenu.addEventListener('click', toggleSidebar);
  }

  if (overlay) {
    overlay.addEventListener('click', closeMobileSidebar);
  }
}

function setupMobileBottomScan() {
  const scanBtn = document.getElementById('btn-mobile-bottom-scan');
  if (!scanBtn) return;

  scanBtn.addEventListener('click', () => {
    if (typeof window.startCameraScanner !== 'function') {
      showToast('Kamera pemindai tidak tersedia!', 'error');
      return;
    }

    // Determine target context based on current page
    if (currentPage === 'products') {
      const productForm = document.getElementById('product-form');
      if (productForm) {
        // We are in product edit/add form! Populate f-code
        window.startCameraScanner((code) => {
          const codeInput = document.getElementById('f-code');
          if (codeInput) {
            codeInput.value = code;
            showToast(`Scan berhasil: ${code}`, 'success');
            const event = new Event('change', { bubbles: true });
            codeInput.dispatchEvent(event);
          }
          const isBulkMode = document.getElementById('scan-bulk-mode')?.checked;
          if (!isBulkMode && typeof window.stopCameraScanner === 'function') {
            window.stopCameraScanner();
          }
        });
      } else {
        // We are in product list view! Filter by scanned code
        window.startCameraScanner((code) => {
          const searchInput = document.getElementById('product-search');
          if (searchInput) {
            searchInput.value = code;
            const event = new Event('input', { bubbles: true });
            searchInput.dispatchEvent(event);
            showToast(`Mencari kode: ${code}`, 'success');
          }
          window.stopCameraScanner();
        });
      }
    } else {
      // POS page or any other page: scan and add to POS cart!
      // If we are not on the POS page, let's navigate to POS page first!
      if (currentPage !== 'pos') {
        navigateTo('pos');
      }
      
      // Give the page a split second to render, then open the camera scanner
      setTimeout(() => {
        window.startCameraScanner();
      }, 250);
    }
  });
}

function closeMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('show');
}

// ==================== CONNECTION STATUS ====================

function setupConnectionStatus() {
  updateConnectionStatus();
  window.addEventListener('online', () => {
    updateConnectionStatus();
    showToast('Koneksi internet terhubung', 'success');
  });
  window.addEventListener('offline', () => {
    updateConnectionStatus();
    showToast('Mode offline — data tetap tersimpan', 'warning');
  });
}

function updateConnectionStatus() {
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  
  if (navigator.onLine) {
    if (statusDot) statusDot.classList.remove('offline');
    if (statusText) statusText.textContent = 'Online';
  } else {
    if (statusDot) statusDot.classList.add('offline');
    if (statusText) statusText.textContent = 'Offline';
  }
}

// ==================== PWA INSTALL ====================

let deferredPrompt = null;

function setupPWAInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallBanner();
  });
}

function showInstallBanner() {
  const banner = document.getElementById('pwa-install-banner');
  if (banner) {
    setTimeout(() => banner.classList.add('show'), 2000);
  }
}

async function installPWA() {
  if (!deferredPrompt) return;
  
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  
  if (outcome === 'accepted') {
    showToast('Aplikasi berhasil di-install!', 'success');
  }
  
  deferredPrompt = null;
  const banner = document.getElementById('pwa-install-banner');
  if (banner) banner.classList.remove('show');
}

function dismissInstallBanner() {
  const banner = document.getElementById('pwa-install-banner');
  if (banner) banner.classList.remove('show');
}

// ==================== SERVICE WORKER ====================

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('✅ Service Worker registered'))
      .catch(err => console.log('⚠️ Service Worker registration failed:', err));
  });
}

window.initApp = initApp;
window.navigateTo = navigateTo;
window.updateSidebarForRole = updateSidebarForRole;
window.updateSidebarUserInfo = updateSidebarUserInfo;
window.handleLogout = handleLogout;
window.installPWA = installPWA;
window.dismissInstallBanner = dismissInstallBanner;
