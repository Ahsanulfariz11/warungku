import Swal from 'sweetalert2';
import { createIcons, icons } from 'lucide';

/**
 * Format number to Indonesian Rupiah
 * @param {number} amount 
 * @returns {string} e.g. "Rp 15.000"
 */
function formatRupiah(amount) {
  if (amount == null || isNaN(amount)) return 'Rp 0';
  return 'Rp ' + Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Parse rupiah string back to number
 * @param {string} str 
 * @returns {number}
 */
function parseRupiah(str) {
  if (typeof str === 'number') return str;
  return parseInt(str.replace(/[^0-9]/g, ''), 10) || 0;
}

/**
 * Format date to Indonesian locale
 * @param {Date|string|number} date 
 * @param {boolean} withTime 
 * @returns {string}
 */
function formatDate(date, withTime = false) {
  const d = new Date(date);
  const options = { day: 'numeric', month: 'short', year: 'numeric' };
  if (withTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
  }
  return d.toLocaleDateString('id-ID', options);
}

/**
 * Format date to YYYY-MM-DD for input fields
 */
function formatDateInput(date) {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

/**
 * Generate unique ID
 * @returns {string}
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Debounce function
 */
function debounce(fn, delay = 300) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Get start of day
 */
function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get end of day
 */
function endOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Get date N days ago
 */
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return startOfDay(d);
}

/**
 * Show toast notification using SweetAlert2
 */
function showToast(message, type = 'success', duration = 3000) {
  const iconMap = {
    success: 'success',
    error: 'error',
    warning: 'warning',
    info: 'info'
  };

  Swal.fire({
    toast: true,
    position: 'bottom-end',
    showConfirmButton: false,
    timer: duration,
    timerProgressBar: true,
    icon: iconMap[type] || 'info',
    title: message,
    background: '#1e293b',
    color: '#f1f5f9',
    customClass: {
      popup: 'swal-toast-popup'
    }
  });
}

/**
 * Show confirmation dialog using SweetAlert2
 * @returns {Promise<boolean>}
 */
function showConfirm(title, message) {
  return Swal.fire({
    title: title,
    html: message,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#10b981',
    cancelButtonColor: '#ef4444',
    confirmButtonText: 'Ya, Lanjutkan',
    cancelButtonText: 'Batal',
    background: '#1e293b',
    color: '#f1f5f9'
  }).then((result) => {
    return result.isConfirmed;
  });
}

/**
 * Product categories (Flat Single-Tier)
 */
const CATEGORIES = [
  { id: 'dapur', name: 'Bahan Dapur & Sembako', icon: 'wheat' },
  { id: 'makanan_minuman', name: 'Makanan & Minuman', icon: 'cookie' },
  { id: 'kebutuhan_rumah', name: 'Kebutuhan Rumah', icon: 'home' },
  { id: 'lainnya', name: 'Lainnya', icon: 'package' }
];

const CATEGORY_MIGRATION_MAP = {
  'beras': 'dapur',
  'minyak': 'dapur',
  'gula': 'dapur',
  'bumbu': 'dapur',
  'mie': 'dapur',
  'susu': 'dapur',
  'minuman': 'makanan_minuman',
  'snack': 'makanan_minuman',
  'rokok': 'kebutuhan_rumah',
  'sabun': 'kebutuhan_rumah',
  'gas': 'kebutuhan_rumah',
  'lainnya': 'lainnya'
};

function migrateCategory(id) {
  return CATEGORY_MIGRATION_MAP[id] || id || 'lainnya';
}

function getCategoryName(id) {
  const migratedId = CATEGORY_MIGRATION_MAP[id] || id || 'lainnya';
  const cat = CATEGORIES.find(c => c.id === migratedId);
  return cat ? cat.name : 'Lainnya';
}

function getCategoryEmoji(id) {
  const migratedId = CATEGORY_MIGRATION_MAP[id] || id || 'lainnya';
  const cat = CATEGORIES.find(c => c.id === migratedId);
  const iconName = cat ? cat.icon : 'package';
  return `<i data-lucide="${iconName}"></i>`;
}

async function loadGlobalCategories() {
  if (!window.db) return;
  try {
    let dbCategories = await window.db.getSetting('categories');
    if (!dbCategories || !dbCategories.length) {
      dbCategories = [
        { id: 'dapur', name: 'Bahan Dapur & Sembako', icon: 'wheat' },
        { id: 'makanan_minuman', name: 'Makanan & Minuman', icon: 'cookie' },
        { id: 'kebutuhan_rumah', name: 'Kebutuhan Rumah', icon: 'home' },
        { id: 'lainnya', name: 'Lainnya', icon: 'package' }
      ];
      await window.db.setSetting('categories', dbCategories);
    }
    // Clear and push to modify the const array content
    CATEGORIES.length = 0;
    CATEGORIES.push(...dbCategories);
  } catch (err) {
    console.warn('Gagal memuat kategori dari DB, menggunakan bawaan:', err);
  }
}

function getCategoryCodePrefix(categoryId) {
  const prefixMap = {
    'dapur': 'SEM',
    'makanan_minuman': 'MAM',
    'kebutuhan_rumah': 'KEB',
    'lainnya': 'LAI'
  };
  if (prefixMap[categoryId]) {
    return prefixMap[categoryId];
  }
  return categoryId.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'CAT');
}

async function generateNextProductCode(categoryId) {
  const prefix = getCategoryCodePrefix(categoryId);
  if (!window.db) return `${prefix}-0001`;
  
  try {
    const allProducts = await window.db.getAllProducts();
    const pattern = new RegExp(`^${prefix}-(\\d+)$`);
    let maxSeq = 0;
    
    allProducts.forEach(p => {
      if (p.code) {
        const match = p.code.match(pattern);
        if (match) {
          const seq = parseInt(match[1], 10);
          if (seq > maxSeq) {
            maxSeq = seq;
          }
        }
      }
    });
    
    const nextSeq = maxSeq + 1;
    return `${prefix}-${nextSeq.toString().padStart(4, '0')}`;
  } catch (err) {
    console.warn('Gagal men-generate kode barang:', err);
    return `${prefix}-0001`;
  }
}

async function fetchProductInfoByBarcode(barcode) {
  if (!barcode || !/^\d+$/.test(barcode) || barcode.length < 6) {
    return null;
  }

  try {
    // OpenFoodFacts API (completely free and no key required)
    const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
    if (!response.ok) return null;
    
    const data = await response.json();
    if (data.status === 1 && data.product) {
      const product = data.product;
      // Get the product name (prefer Indonesian translation, fallback to English, fallback to generic)
      const name = product.product_name_id || product.product_name || product.product_name_en || '';
      const brand = product.brands || '';
      
      const fullName = brand && !name.toLowerCase().includes(brand.toLowerCase())
        ? `${brand} ${name}`
        : name;

      // Guess category based on online tags & product name keywords
      let category = 'lainnya';
      const categoriesText = (product.categories || '') + ' ' + (product.categories_tags ? product.categories_tags.join(' ') : '') + ' ' + fullName;
      const cleanText = categoriesText.toLowerCase();

      if (
        cleanText.includes('beras') || cleanText.includes('rice') ||
        cleanText.includes('minyak') || cleanText.includes('oil') ||
        cleanText.includes('gula') || cleanText.includes('sugar') ||
        cleanText.includes('terigu') || cleanText.includes('tepung') ||
        cleanText.includes('flour') || cleanText.includes('bumbu') ||
        cleanText.includes('sauce') || cleanText.includes('kecap') ||
        cleanText.includes('dapur') || cleanText.includes('wheat') ||
        cleanText.includes('spices') || cleanText.includes('salt') ||
        cleanText.includes('garam') || cleanText.includes('pasta') ||
        cleanText.includes('cooking')
      ) {
        category = 'dapur';
      } else if (
        cleanText.includes('makanan') || cleanText.includes('minuman') ||
        cleanText.includes('snack') || cleanText.includes('beverage') ||
        cleanText.includes('biscuit') || cleanText.includes('cookie') ||
        cleanText.includes('susu') || cleanText.includes('milk') ||
        cleanText.includes('soda') || cleanText.includes('tea') ||
        cleanText.includes('teh') || cleanText.includes('kopi') ||
        cleanText.includes('coffee') || cleanText.includes('mie') ||
        cleanText.includes('noodle') || cleanText.includes('permen') ||
        cleanText.includes('candy') || cleanText.includes('cokelat') ||
        cleanText.includes('chocolate') || cleanText.includes('wafer')
      ) {
        category = 'makanan_minuman';
      } else if (
        cleanText.includes('sabun') || cleanText.includes('soap') ||
        cleanText.includes('shampoo') || cleanText.includes('shampooing') ||
        cleanText.includes('detergen') || cleanText.includes('detergent') ||
        cleanText.includes('sikat gigi') || cleanText.includes('toothpaste') ||
        cleanText.includes('pewangi') || cleanText.includes('softener') ||
        cleanText.includes('pembersih') || cleanText.includes('cleaner') ||
        cleanText.includes('household') || cleanText.includes('rumah') ||
        cleanText.includes('tissue') || cleanText.includes('tisu') ||
        cleanText.includes('rokok') || cleanText.includes('cigarette') ||
        cleanText.includes('body wash') || cleanText.includes('pasta gigi')
      ) {
        category = 'kebutuhan_rumah';
      }

      return {
        name: fullName.trim(),
        image: product.image_url || null,
        category: category
      };
    }
  } catch (err) {
    console.warn('API fetch failed or offline:', err);
  }
  return null;
}

function makeSelectCustom(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;

  // Remove existing custom select if present
  let existingContainer = select.nextElementSibling;
  if (existingContainer && existingContainer.classList.contains('custom-select-container')) {
    existingContainer.remove();
  }

  const container = document.createElement('div');
  container.className = 'custom-select-container';
  select.style.display = 'none';
  select.parentNode.insertBefore(container, select.nextSibling);

  const trigger = document.createElement('div');
  trigger.className = 'custom-select-trigger';
  
  const updateTriggerText = () => {
    const selectedOption = select.options[select.selectedIndex];
    trigger.innerHTML = `
      <span>${selectedOption ? selectedOption.text : ''}</span>
      <i data-lucide="chevron-down" style="width: 14px; height: 14px; transition: transform 0.2s;"></i>
    `;
    if (window.renderLucide) window.renderLucide();
  };

  updateTriggerText();
  container.appendChild(trigger);

  const optionsContainer = document.createElement('div');
  optionsContainer.className = 'custom-select-options';
  container.appendChild(optionsContainer);

  const renderOptions = () => {
    optionsContainer.innerHTML = Array.from(select.options).map((opt, index) => {
      const isSelected = opt.value === select.value ? 'selected' : '';
      return `
        <div class="custom-select-option ${isSelected}" data-value="${opt.value}" data-index="${index}">
          ${opt.text}
        </div>
      `;
    }).join('');

    optionsContainer.querySelectorAll('.custom-select-option').forEach(optEl => {
      optEl.addEventListener('click', (e) => {
        e.stopPropagation();
        select.value = optEl.dataset.value;
        updateTriggerText();
        
        // Trigger original select 'change' event
        const event = new Event('change', { bubbles: true });
        select.dispatchEvent(event);
        
        closeDropdown();
      });
    });
  };

  renderOptions();

  // Listen to external value changes (like online auto-fill) to sync custom trigger text
  select.addEventListener('change', () => {
    updateTriggerText();
  });

  const toggleDropdown = (e) => {
    e.stopPropagation();
    const isOpen = container.classList.contains('open');
    closeAllCustomSelects();
    if (!isOpen) {
      container.classList.add('open');
      renderOptions(); // rerender to update active class
    }
  };

  const closeDropdown = () => {
    container.classList.remove('open');
  };

  trigger.addEventListener('click', toggleDropdown);
  
  // Clean up global click listener
  document.addEventListener('click', closeDropdown);
  
  if (window.renderLucide) window.renderLucide();
}

function closeAllCustomSelects() {
  document.querySelectorAll('.custom-select-container').forEach(c => c.classList.remove('open'));
}

// Global renderer for Lucide icons
window.renderLucide = () => {
  if (createIcons && icons) {
    createIcons({ icons });
  }
};

window.formatRupiah = formatRupiah;
window.parseRupiah = parseRupiah;
window.formatDate = formatDate;
window.formatDateInput = formatDateInput;
window.generateId = generateId;
window.debounce = debounce;
window.startOfDay = startOfDay;
window.endOfDay = endOfDay;
window.daysAgo = daysAgo;
window.showToast = showToast;
window.showConfirm = showConfirm;
window.CATEGORIES = CATEGORIES;
window.migrateCategory = migrateCategory;
window.loadGlobalCategories = loadGlobalCategories;
window.getCategoryName = getCategoryName;
window.getCategoryEmoji = getCategoryEmoji;
window.getCategoryCodePrefix = getCategoryCodePrefix;
window.generateNextProductCode = generateNextProductCode;
window.fetchProductInfoByBarcode = fetchProductInfoByBarcode;
window.makeSelectCustom = makeSelectCustom;
