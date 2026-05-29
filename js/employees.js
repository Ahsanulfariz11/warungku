/* ============================================================
   EMPLOYEES — Employee management view (Owner only)
   ============================================================ */

async function renderEmployees() {
  const container = document.getElementById('page-content');

  container.innerHTML = `
    <div class="animate-fade-in">
      <div class="toolbar">
        <div class="toolbar-left">
          <div class="search-bar" style="flex: 1; max-width: 400px;">
            <i data-lucide="search" class="search-icon"></i>
            <input type="text" class="form-input" id="employee-search" placeholder="Cari karyawan..." />
          </div>
        </div>
        <div class="toolbar-right">
          <button class="btn btn-primary" id="btn-add-employee">
            <i data-lucide="user-plus"></i> Tambah Karyawan
          </button>
        </div>
      </div>

      <div class="filter-chips" id="role-filters" style="margin-bottom: var(--space-lg);"></div>

      <div id="employees-list"></div>
    </div>
  `;

  renderRoleFilters();
  await loadEmployeesList();

  document.getElementById('employee-search').addEventListener('input', debounce(async (e) => {
    await loadEmployeesList(e.target.value);
  }, 300));

  document.getElementById('btn-add-employee').addEventListener('click', () => {
    renderEmployeeForm();
  });
}

let employeeRoleFilter = 'all';

function renderRoleFilters() {
  const container = document.getElementById('role-filters');
  if (!container) return;

  const chips = [
    { id: 'all', name: 'Semua', icon: 'users' },
    { id: 'owner', name: 'Owner', icon: 'crown' },
    { id: 'admin', name: 'Admin', icon: 'shield' },
    { id: 'admin_toko', name: 'Admin Toko', icon: 'store' },
    { id: 'kasir', name: 'Kasir', icon: 'credit-card' }
  ];

  container.innerHTML = chips.map(c => `
    <div class="chip ${employeeRoleFilter === c.id ? 'active' : ''}" data-role="${c.id}">
      <i data-lucide="${c.icon}" style="vertical-align: middle; margin-right: 4px; width: 14px; height: 14px;"></i> ${c.name}
    </div>
  `).join('');

  container.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', async () => {
      employeeRoleFilter = chip.dataset.role;
      renderRoleFilters();
      await loadEmployeesList();
    });
  });
}

async function loadEmployeesList(searchQuery = '') {
  const container = document.getElementById('employees-list');
  if (!container) return;

  let employees = await db.getAllEmployees();

  // Filter by role
  if (employeeRoleFilter !== 'all') {
    employees = employees.filter(e => e.role === employeeRoleFilter);
  }

  // Filter by search
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    employees = employees.filter(e => e.name.toLowerCase().includes(q) || (e.phone && e.phone.includes(q)));
  }

  // Sort: active first, then by name
  employees.sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  if (!employees.length) {
    container.innerHTML = `
      <div class="empty-state">
        <i data-lucide="users" style="font-size: 3rem; opacity: 0.3; display: block; margin: 0 auto 12px auto;"></i>
        <div class="empty-state-title">Belum ada karyawan</div>
        <div class="empty-state-text">Klik "Tambah Karyawan" untuk menambahkan karyawan baru.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Karyawan</th>
            <th>Role</th>
            <th>Telepon</th>
            <th>Status</th>
            <th>Terdaftar</th>
            <th style="text-align: center;">Aksi</th>
          </tr>
        </thead>
        <tbody>
          ${employees.map(emp => {
            const roleInfo = getRoleInfo(emp.role);
            const isSelf = currentUser && currentUser.id === emp.id;
            return `
              <tr style="${!emp.active ? 'opacity: 0.5;' : ''}">
                <td>
                  <div style="display: flex; align-items: center; gap: var(--space-sm);">
                    <div class="user-avatar user-avatar-sm" style="background: ${getAvatarColor(emp.role)}; overflow: hidden; display: flex; align-items: center; justify-content: center;">
                      ${emp.image ? `<img src="${emp.image}" style="width: 100%; height: 100%; object-fit: cover;" />` : getInitials(emp.name)}
                    </div>
                    <div>
                      <div style="font-weight: 600;">${emp.name}</div>
                      ${isSelf ? '<span style="font-size: 0.7rem; color: var(--accent-light);">(Anda)</span>' : ''}
                    </div>
                  </div>
                </td>
                <td>
                  <span class="badge badge-${getRoleBadgeClass(emp.role)}">
                    ${roleInfo.label}
                  </span>
                </td>
                <td>${emp.phone || '-'}</td>
                <td>
                  <span class="badge ${emp.active ? 'badge-success' : 'badge-danger'}">
                    ${emp.active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </td>
                <td>${formatDate(emp.createdAt)}</td>
                <td style="text-align: center;">
                  <div style="display: flex; gap: 4px; justify-content: center;">
                    <button class="btn-icon" title="Edit" onclick="renderEmployeeForm('${emp.id}')"><i data-lucide="edit"></i></button>
                    <button class="btn-icon" title="Reset PIN" onclick="renderResetPinForm('${emp.id}')"><i data-lucide="key"></i></button>
                    ${!isSelf ? `
                      <button class="btn-icon" title="${emp.active ? 'Nonaktifkan' : 'Aktifkan'}" onclick="toggleEmployeeActive('${emp.id}')">
                        ${emp.active ? '<i data-lucide="user-x"></i>' : '<i data-lucide="user-check"></i>'}
                      </button>
                    ` : ''}
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
    <div style="padding: var(--space-md); color: var(--text-muted); font-size: 0.8rem;">
      Menampilkan ${employees.length} karyawan
    </div>
  `;
  if (window.renderLucide) window.renderLucide();
}

function getRoleBadgeClass(role) {
  const map = { owner: 'warning', admin: 'info', admin_toko: 'success', kasir: 'info' };
  return map[role] || 'info';
}

async function renderEmployeeForm(employeeId = null) {
  const isEdit = !!employeeId;
  let employee = null;

  if (isEdit) {
    employee = await db.getEmployee(employeeId);
    if (!employee) return;
  }

  let employeeImageBase64 = employee ? (employee.image || '') : '';

  const container = document.getElementById('page-content');
  container.innerHTML = `
    <div class="animate-fade-in" style="max-width: 860px; margin: 0 auto;">
      <div style="display: flex; align-items: center; gap: var(--space-md); margin-bottom: var(--space-lg);">
        <button class="btn btn-secondary btn-sm" onclick="renderEmployees()" style="padding: 8px 12px; border-radius: var(--radius-md); display: inline-flex; align-items: center; gap: 6px;">
          <i data-lucide="arrow-left" style="width: 16px; height: 16px;"></i> Kembali
        </button>
        <h2 style="font-size: 1.4rem; font-weight: 700; color: var(--text-primary); margin: 0;">${isEdit ? 'Edit Karyawan' : 'Tambah Karyawan Baru'}</h2>
      </div>
      
      <div class="card" style="padding: var(--space-xl); border-radius: var(--radius-lg); background: var(--bg-card); border: 1px solid var(--border);">
        <form id="employee-form" onsubmit="event.preventDefault();" style="display: grid; grid-template-columns: 240px 1fr; gap: var(--space-xl);">
          
          <!-- Left Column: Employee Profile Photo -->
          <div style="display: flex; flex-direction: column; align-items: center; gap: var(--space-md);">
            <label class="form-label" style="align-self: flex-start; margin-bottom: 2px;">Foto Profil</label>
            <div id="image-preview-container" style="width: 200px; height: 200px; border-radius: 50%; border: 1px solid var(--border); background: var(--bg-tertiary); overflow: hidden; display: flex; align-items: center; justify-content: center; position: relative;">
              ${employeeImageBase64 ? `<img src="${employeeImageBase64}" id="img-preview" style="width: 100%; height: 100%; object-fit: cover;" />` : `<i data-lucide="user" id="img-placeholder" style="width: 64px; height: 64px; color: var(--text-muted); opacity: 0.5;"></i>`}
            </div>
            <div style="width: 100%; display: flex; flex-direction: column; gap: var(--space-xs);">
              <input type="file" id="f-image-file" accept="image/*" style="display: none;" />
              <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('f-image-file').click()" style="justify-content: center; display: flex; align-items: center; gap: 6px; width: 100%;">
                <i data-lucide="upload" style="width: 14px; height: 14px;"></i> Pilih Foto
              </button>
              <button type="button" class="btn btn-danger btn-sm" id="btn-remove-image" style="justify-content: center; display: ${employeeImageBase64 ? 'flex' : 'none'}; align-items: center; gap: 6px; width: 100%;">
                <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i> Hapus Foto
              </button>
            </div>
            <span class="form-hint" style="text-align: center; font-size: 0.7rem; line-height: 1.4;">Ukuran maksimal 2MB.</span>
          </div>
          
          <!-- Right Column: Form Inputs -->
          <div style="display: flex; flex-direction: column; gap: var(--space-md);">
            <div class="form-group">
              <label class="form-label">Nama Lengkap *</label>
              <input type="text" class="form-input" id="f-emp-name" value="${employee ? employee.name : ''}" placeholder="Nama karyawan" required />
            </div>
            
            <div class="form-group">
              <label class="form-label">Role *</label>
              <select class="form-select" id="f-emp-role">
                ${Object.entries(ROLES).map(([key, val]) => `
                  <option value="${key}" ${employee && employee.role === key ? 'selected' : ''}>
                    ${val.label}
                  </option>
                `).join('')}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">No. Telepon</label>
              <input type="tel" class="form-input" id="f-emp-phone" value="${employee ? (employee.phone || '') : ''}" placeholder="08xxxxxxxxxx" />
            </div>
            
            ${!isEdit ? `
              <div class="form-row" style="margin-bottom: var(--space-md);">
                <div class="form-group">
                  <label class="form-label">PIN (4-6 digit) *</label>
                  <input type="password" class="form-input pin-input" id="f-emp-pin" placeholder="••••••" maxlength="6" inputmode="numeric" pattern="[0-9]*" required />
                </div>
                <div class="form-group">
                  <label class="form-label">Konfirmasi PIN *</label>
                  <input type="password" class="form-input pin-input" id="f-emp-pin-confirm" placeholder="••••••" maxlength="6" inputmode="numeric" pattern="[0-9]*" required />
                </div>
              </div>
            ` : ''}
            
            <div style="display: flex; justify-content: flex-end; gap: var(--space-md); border-top: 1px solid var(--border); padding-top: var(--space-lg); margin-top: var(--space-md);">
              <button type="button" class="btn btn-secondary" onclick="renderEmployees()">Batal</button>
              <button type="button" class="btn btn-primary" id="btn-save-employee" style="padding: 10px 24px;">
                <i data-lucide="save"></i> ${isEdit ? 'Simpan Perubahan' : 'Tambah Karyawan'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  `;

  setTimeout(() => {
    const nameEl = document.getElementById('f-emp-name');
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
        employeeImageBase64 = event.target.result;
        imagePreviewContainer.innerHTML = `<img src="${employeeImageBase64}" id="img-preview" style="width: 100%; height: 100%; object-fit: cover;" />`;
        btnRemoveImage.style.display = 'flex';
      };
      reader.readAsDataURL(file);
    });
  }

  if (btnRemoveImage) {
    btnRemoveImage.addEventListener('click', () => {
      employeeImageBase64 = '';
      imagePreviewContainer.innerHTML = `<i data-lucide="user" id="img-placeholder" style="width: 64px; height: 64px; color: var(--text-muted); opacity: 0.5;"></i>`;
      btnRemoveImage.style.display = 'none';
      if (window.renderLucide) window.renderLucide();
      if (imageFileInput) imageFileInput.value = '';
    });
  }

  if (window.renderLucide) window.renderLucide();

  document.getElementById('btn-save-employee').addEventListener('click', async () => {
    const name = document.getElementById('f-emp-name').value.trim();
    const role = document.getElementById('f-emp-role').value;
    const phone = document.getElementById('f-emp-phone').value.trim();

    if (!name) {
      showToast('Nama harus diisi!', 'error');
      return;
    }

    try {
      if (isEdit) {
        await db.updateEmployee(employeeId, { name, role, phone, image: employeeImageBase64 });
        showToast('Data karyawan berhasil diperbarui!', 'success');
        
        if (currentUser && currentUser.id === employeeId) {
          currentUser.name = name;
          currentUser.role = role;
          currentUser.phone = phone;
          currentUser.image = employeeImageBase64;
          sessionStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));
          updateSidebarUserInfo();
        }
      } else {
        const pin = document.getElementById('f-emp-pin').value;
        const pinConfirm = document.getElementById('f-emp-pin-confirm').value;

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
          return;
        }

        const pinHash = await hashPin(pin);
        await db.addEmployee({ name, role, pinHash, phone, active: true, image: employeeImageBase64 });
        showToast('Karyawan berhasil ditambahkan!', 'success');
      }

      await renderEmployees();
    } catch (err) {
      showToast('Gagal menyimpan: ' + err.message, 'error');
    }
  });
}

async function renderResetPinForm(employeeId) {
  const employee = await db.getEmployee(employeeId);
  if (!employee) return;

  const container = document.getElementById('page-content');
  container.innerHTML = `
    <div class="animate-fade-in" style="max-width: 480px; margin: 0 auto;">
      <div style="display: flex; align-items: center; gap: var(--space-md); margin-bottom: var(--space-lg);">
        <button class="btn btn-secondary btn-sm" onclick="renderEmployees()" style="padding: 8px 12px; border-radius: var(--radius-md); display: inline-flex; align-items: center; gap: 6px;">
          <i data-lucide="arrow-left" style="width: 16px; height: 16px;"></i> Kembali
        </button>
        <h2 style="font-size: 1.4rem; font-weight: 700; color: var(--text-primary); margin: 0;">Reset PIN</h2>
      </div>
      
      <div class="card" style="padding: var(--space-xl); border-radius: var(--radius-lg); background: var(--bg-card); border: 1px solid var(--border);">
        <p style="margin-bottom: var(--space-lg); color: var(--text-secondary); font-size: 0.95rem;">
          Reset PIN untuk karyawan: <strong style="color: var(--text-primary);">${employee.name}</strong>
        </p>
        
        <form id="pin-reset-form" onsubmit="event.preventDefault();">
          <div class="form-row" style="margin-bottom: var(--space-xl);">
            <div class="form-group">
              <label class="form-label">PIN Baru (4-6 digit)</label>
              <input type="password" class="form-input pin-input" id="f-new-pin" placeholder="••••••" maxlength="6" inputmode="numeric" pattern="[0-9]*" required />
            </div>
            <div class="form-group">
              <label class="form-label">Konfirmasi PIN</label>
              <input type="password" class="form-input pin-input" id="f-new-pin-confirm" placeholder="••••••" maxlength="6" inputmode="numeric" pattern="[0-9]*" required />
            </div>
          </div>
          
          <div style="display: flex; justify-content: flex-end; gap: var(--space-md); border-top: 1px solid var(--border); padding-top: var(--space-lg);">
            <button type="button" class="btn btn-secondary" onclick="renderEmployees()">Batal</button>
            <button type="button" class="btn btn-primary" id="btn-reset-pin" style="padding: 10px 24px;">
              <i data-lucide="key"></i> Reset PIN
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  setTimeout(() => {
    const pinEl = document.getElementById('f-new-pin');
    if (pinEl) pinEl.focus();
  }, 200);

  if (window.renderLucide) window.renderLucide();

  document.getElementById('btn-reset-pin').addEventListener('click', async () => {
    const pin = document.getElementById('f-new-pin').value;
    const pinConfirm = document.getElementById('f-new-pin-confirm').value;

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
      return;
    }

    try {
      const pinHash = await hashPin(pin);
      await db.updateEmployee(employeeId, { pinHash });
      showToast(`PIN ${employee.name} berhasil direset!`, 'success');
      await renderEmployees();
    } catch (err) {
      showToast('Gagal reset PIN: ' + err.message, 'error');
    }
  });
}

async function toggleEmployeeActive(employeeId) {
  const employee = await db.getEmployee(employeeId);
  if (!employee) return;

  if (currentUser && currentUser.id === employeeId) {
    showToast('Tidak bisa menonaktifkan akun sendiri!', 'error');
    return;
  }

  const action = employee.active ? 'menonaktifkan' : 'mengaktifkan';
  const confirmed = await showConfirm(
    `${employee.active ? 'Nonaktifkan' : 'Aktifkan'} Karyawan`,
    `Apakah Anda yakin ingin ${action} <strong>${employee.name}</strong>?${employee.active ? ' Karyawan tidak akan bisa login.' : ''}`
  );

  if (confirmed) {
    try {
      await db.updateEmployee(employeeId, { active: !employee.active });
      showToast(`${employee.name} berhasil di${employee.active ? 'nonaktifkan' : 'aktifkan'}`, 'success');
      await loadEmployeesList();
    } catch (err) {
      showToast('Gagal: ' + err.message, 'error');
    }
  }
}

window.renderEmployees = renderEmployees;
window.renderEmployeeForm = renderEmployeeForm;
window.renderResetPinForm = renderResetPinForm;
window.toggleEmployeeActive = toggleEmployeeActive;
