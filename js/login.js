/* ============================================================
   LOGIN — Login page & first-time setup UI
   ============================================================ */

/**
 * Show login screen (hides main app)
 */
async function showLoginScreen() {
  const loginScreen = document.getElementById('login-screen');
  const appLayout = document.querySelector('.app-layout');
  
  loginScreen.style.display = 'flex';
  appLayout.style.display = 'none';

  const hasEmployees = await hasAnyEmployees();

  if (!hasEmployees) {
    renderSetupScreen();
  } else {
    renderUserSelectScreen();
  }
}

/**
 * Hide login screen, show main app
 */
function hideLoginScreen() {
  const loginScreen = document.getElementById('login-screen');
  const appLayout = document.querySelector('.app-layout');
  
  loginScreen.style.display = 'none';
  appLayout.style.display = 'flex';
}

/**
 * First-time setup — create Owner account
 */
function renderSetupScreen() {
  const loginScreen = document.getElementById('login-screen');
  
  loginScreen.innerHTML = `
    <div class="login-container animate-fade-in">
      <div class="login-card setup-card">
        <div class="login-logo"><i data-lucide="store" style="width: 48px; height: 48px; margin: 0 auto;"></i></div>
        <h1 class="login-title">Selamat Datang!</h1>
        <p class="login-subtitle">Setup akun Owner untuk mulai menggunakan aplikasi</p>
        
        <form id="setup-form" class="login-form">
          <div class="form-group">
            <label class="form-label">Nama Lengkap *</label>
            <input type="text" class="form-input" id="setup-name" placeholder="Nama pemilik warung" required autofocus />
          </div>
          
          <div class="form-group">
            <label class="form-label">No. Telepon</label>
            <input type="tel" class="form-input" id="setup-phone" placeholder="08xxxxxxxxxx" />
          </div>
          
          <div class="form-group">
            <label class="form-label">PIN (4-6 digit) *</label>
            <input type="password" class="form-input pin-input" id="setup-pin" placeholder="••••••" maxlength="6" inputmode="numeric" pattern="[0-9]*" required />
            <span class="form-hint">PIN digunakan untuk login ke aplikasi</span>
          </div>
          
          <div class="form-group">
            <label class="form-label">Konfirmasi PIN *</label>
            <input type="password" class="form-input pin-input" id="setup-pin-confirm" placeholder="••••••" maxlength="6" inputmode="numeric" pattern="[0-9]*" required />
          </div>
          
          <button type="submit" class="btn btn-primary login-btn" id="btn-setup">
            <i data-lucide="play" style="width: 16px; height: 16px; margin-right: 6px; vertical-align: middle;"></i> Buat Akun & Mulai
          </button>
        </form>
      </div>
    </div>
  `;

  document.getElementById('setup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleSetup();
  });

  if (window.renderLucide) window.renderLucide();
}

async function handleSetup() {
  const name = document.getElementById('setup-name').value.trim();
  const phone = document.getElementById('setup-phone').value.trim();
  const pin = document.getElementById('setup-pin').value;
  const pinConfirm = document.getElementById('setup-pin-confirm').value;

  if (!name) {
    showToast('Nama harus diisi!', 'error');
    return;
  }

  if (pin.length < 4 || pin.length > 6) {
    showToast('PIN harus 4-6 digit!', 'error');
    return;
  }

  if (!/^\d+$/.test(pin)) {
    showToast('PIN hanya boleh berisi angka!', 'error');
    return;
  }

  if (pin !== pinConfirm) {
    showToast('Konfirmasi PIN tidak cocok!', 'error');
    document.getElementById('setup-pin-confirm').classList.add('shake');
    setTimeout(() => document.getElementById('setup-pin-confirm').classList.remove('shake'), 500);
    return;
  }

  try {
    const pinHash = await hashPin(pin);
    await db.addEmployee({
      name,
      role: 'owner',
      pinHash,
      phone,
      active: true
    });

    showToast('Akun Owner berhasil dibuat! Silakan login.', 'success');
    
    // Show user select screen
    setTimeout(() => renderUserSelectScreen(), 500);
  } catch (err) {
    showToast('Gagal membuat akun: ' + err.message, 'error');
  }
}

/**
 * User selection screen
 */
async function renderUserSelectScreen() {
  const loginScreen = document.getElementById('login-screen');
  const employees = await db.getAllEmployees();
  const activeEmployees = employees.filter(e => e.active);

  loginScreen.innerHTML = `
    <div class="login-container animate-fade-in">
      <div class="login-card">
        <div class="login-logo"><i data-lucide="store" style="width: 48px; height: 48px; margin: 0 auto;"></i></div>
        <h1 class="login-title">Warung Sembako</h1>
        <p class="login-subtitle">Pilih akun untuk masuk</p>
        
        <div class="user-select-grid">
          ${activeEmployees.map(emp => {
            const roleInfo = getRoleInfo(emp.role);
            return `
              <div class="user-select-item" data-id="${emp.id}" onclick="selectUserForLogin('${emp.id}')">
                <div class="user-avatar" style="background: ${getAvatarColor(emp.role)}">
                  ${getInitials(emp.name)}
                </div>
                <div class="user-select-name">${emp.name}</div>
                <div class="user-select-role"><i data-lucide="${roleInfo.icon}" style="width: 14px; height: 14px; vertical-align: middle; margin-right: 4px;"></i> ${roleInfo.label}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;

  if (window.renderLucide) window.renderLucide();
}

let selectedUserId = null;

async function selectUserForLogin(employeeId) {
  selectedUserId = employeeId;
  const employee = await db.getEmployee(employeeId);
  if (!employee) return;

  renderPinScreen(employee);
}

/**
 * PIN entry screen
 */
function renderPinScreen(employee) {
  const loginScreen = document.getElementById('login-screen');
  const roleInfo = getRoleInfo(employee.role);

  loginScreen.innerHTML = `
    <div class="login-container animate-fade-in">
      <div class="login-card pin-card">
        <button class="login-back" onclick="renderUserSelectScreen()">← Kembali</button>
        
        <div class="user-avatar user-avatar-lg" style="background: ${getAvatarColor(employee.role)}">
          ${getInitials(employee.name)}
        </div>
        <h2 class="login-user-name">${employee.name}</h2>
        <p class="login-user-role"><i data-lucide="${roleInfo.icon}" style="width: 14px; height: 14px; vertical-align: middle; margin-right: 4px;"></i> ${roleInfo.label}</p>
        
        <div class="pin-display" id="pin-display">
          <div class="pin-dot"></div>
          <div class="pin-dot"></div>
          <div class="pin-dot"></div>
          <div class="pin-dot"></div>
          <div class="pin-dot"></div>
          <div class="pin-dot"></div>
        </div>
        <p class="pin-error" id="pin-error" style="display: none;">PIN salah, coba lagi</p>
        
        <div class="pin-numpad">
          ${[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map(key => {
            if (key === '') return '<div class="numpad-key numpad-empty"></div>';
            if (key === '⌫') return `<div class="numpad-key numpad-delete" onclick="pinKeyPress('delete')">⌫</div>`;
            return `<div class="numpad-key" onclick="pinKeyPress('${key}')">${key}</div>`;
          }).join('')}
        </div>
      </div>
    </div>
  `;

  // Also listen for keyboard input
  document.addEventListener('keydown', handlePinKeyboard);

  if (window.renderLucide) window.renderLucide();
}

let pinBuffer = '';

function handlePinKeyboard(e) {
  if (e.key >= '0' && e.key <= '9') {
    pinKeyPress(e.key);
  } else if (e.key === 'Backspace') {
    pinKeyPress('delete');
  }
}

async function pinKeyPress(key) {
  const display = document.getElementById('pin-display');
  const errorEl = document.getElementById('pin-error');
  if (!display) return;

  if (key === 'delete') {
    pinBuffer = pinBuffer.slice(0, -1);
  } else {
    if (pinBuffer.length >= 6) return;
    pinBuffer += key;
  }

  // Update dots
  const dots = display.querySelectorAll('.pin-dot');
  dots.forEach((dot, i) => {
    dot.classList.toggle('filled', i < pinBuffer.length);
  });

  // Hide error
  if (errorEl) errorEl.style.display = 'none';

  // Try login when PIN is 4-6 digits and user stops typing
  if (pinBuffer.length >= 4) {
    // Debounce the login attempt
    clearTimeout(window._pinTimeout);
    window._pinTimeout = setTimeout(async () => {
      await attemptLogin(pinBuffer);
    }, 400);
  }
}

async function attemptLogin(pin) {
  const user = await loginWithPin(pin);
  
  if (user) {
    // Success!
    document.removeEventListener('keydown', handlePinKeyboard);
    pinBuffer = '';
    showToast(`Selamat datang, ${user.name}!`, 'success');
    hideLoginScreen();
    await initApp();
  } else if (pinBuffer.length >= 6) {
    // Wrong PIN after max length
    pinBuffer = '';
    const display = document.getElementById('pin-display');
    const errorEl = document.getElementById('pin-error');
    
    if (display) {
      display.classList.add('shake');
      setTimeout(() => display.classList.remove('shake'), 500);
      display.querySelectorAll('.pin-dot').forEach(d => d.classList.remove('filled'));
    }
    if (errorEl) errorEl.style.display = 'block';
  }
}

/**
 * Get avatar background color based on role
 */
function getAvatarColor(role) {
  const colors = {
    owner: 'linear-gradient(135deg, #f59e0b, #d97706)',
    admin: 'linear-gradient(135deg, #3b82f6, #2563eb)',
    admin_toko: 'linear-gradient(135deg, #10b981, #059669)',
    kasir: 'linear-gradient(135deg, #8b5cf6, #7c3aed)'
  };
  return colors[role] || colors.kasir;
}

window.showLoginScreen = showLoginScreen;
window.hideLoginScreen = hideLoginScreen;
window.renderSetupScreen = renderSetupScreen;
window.handleSetup = handleSetup;
window.renderUserSelectScreen = renderUserSelectScreen;
window.selectUserForLogin = selectUserForLogin;
window.renderPinScreen = renderPinScreen;
window.pinKeyPress = pinKeyPress;
window.attemptLogin = attemptLogin;
window.getAvatarColor = getAvatarColor;
