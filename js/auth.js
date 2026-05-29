/* ============================================================
   AUTH — Authentication & Role-Based Access Control
   ============================================================ */

// Role definitions & permissions
const ROLES = {
  owner: { label: 'Owner', icon: 'crown', level: 4 },
  admin: { label: 'Admin', icon: 'shield', level: 3 },
  admin_toko: { label: 'Admin Toko', icon: 'store', level: 2 },
  kasir: { label: 'Kasir', icon: 'credit-card', level: 1 }
};

// Pages each role can access
const ROLE_PERMISSIONS = {
  owner:      ['dashboard', 'products', 'pos', 'reports', 'backup', 'employees'],
  admin:      ['dashboard', 'products', 'pos', 'reports', 'backup'],
  admin_toko: ['dashboard', 'products', 'pos', 'reports'],
  kasir:      ['pos']
};

// Default landing page per role
const ROLE_DEFAULT_PAGE = {
  owner: 'dashboard',
  admin: 'dashboard',
  admin_toko: 'dashboard',
  kasir: 'pos'
};

// Session key
const SESSION_KEY = 'warung_session';

// Current user (set after login) - prefilled to bypass authentication
let currentUser = {
  id: 'default-owner',
  name: 'Pemilik Warung',
  role: 'owner',
  phone: ''
};

/**
 * Hash a PIN using SHA-256
 * @param {string} pin 
 * @returns {Promise<string>} hex hash
 */
async function hashPin(pin) {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + '_warung_salt_2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Attempt login with PIN
 * @param {string} pin 
 * @returns {Promise<object|null>} employee object if success, null if fail
 */
async function loginWithPin(pin) {
  const pinHash = await hashPin(pin);
  const employees = await db.getAllEmployees();
  const employee = employees.find(e => e.pinHash === pinHash && e.active);

  if (employee) {
    currentUser = {
      id: employee.id,
      name: employee.name,
      role: employee.role,
      phone: employee.phone
    };
    // Save session
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));
    return currentUser;
  }
  return null;
}

/**
 * Restore session from sessionStorage
 * @returns {object|null}
 */
function restoreSession() {
  try {
    const data = sessionStorage.getItem(SESSION_KEY);
    if (data) {
      currentUser = JSON.parse(data);
      return currentUser;
    }
  } catch (e) {
    console.warn('Failed to restore session:', e);
  }
  currentUser = null;
  return null;
}

/**
 * Logout current user
 */
function logout() {
  currentUser = null;
  sessionStorage.removeItem(SESSION_KEY);
}

/**
 * Check if user is logged in
 */
function isLoggedIn() {
  return currentUser !== null;
}

/**
 * Check if current user has access to a page
 * @param {string} page 
 * @returns {boolean}
 */
function hasAccess(page) {
  if (!currentUser) return false;
  const permissions = ROLE_PERMISSIONS[currentUser.role] || [];
  return permissions.includes(page);
}

/**
 * Get default page for current user's role
 */
function getDefaultPage() {
  if (!currentUser) return 'pos';
  return ROLE_DEFAULT_PAGE[currentUser.role] || 'pos';
}

/**
 * Get role display info
 */
function getRoleInfo(role) {
  return ROLES[role] || { label: role, icon: 'user', level: 0 };
}

/**
 * Get user initials for avatar
 */
function getInitials(name) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

async function hasAnyEmployees() {
  const employees = await db.getAllEmployees();
  return employees.length > 0;
}

window.ROLES = ROLES;
window.ROLE_PERMISSIONS = ROLE_PERMISSIONS;
window.ROLE_DEFAULT_PAGE = ROLE_DEFAULT_PAGE;
window.SESSION_KEY = SESSION_KEY;
window.hashPin = hashPin;
window.loginWithPin = loginWithPin;
window.restoreSession = restoreSession;
window.logout = logout;
window.isLoggedIn = isLoggedIn;
window.hasAccess = hasAccess;
window.getDefaultPage = getDefaultPage;
window.getRoleInfo = getRoleInfo;
window.getInitials = getInitials;
window.hasAnyEmployees = hasAnyEmployees;

// Bind currentUser to window dynamically
Object.defineProperty(window, 'currentUser', {
  get: () => currentUser,
  set: (val) => { currentUser = val; },
  configurable: true
});
