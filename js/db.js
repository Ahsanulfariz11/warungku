import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

const DB_NAME = 'WarungSembakoDB';
const DB_VERSION = 2;

class WarungDB {
  constructor() {
    this.db = null;          // Untuk IndexedDB fallback
    this.firestore = null;   // Untuk Firebase Firestore
    this.useFirebase = false;
  }

  /**
   * Inisialisasi database.
   * Mendeteksi konfigurasi Firebase, jika ada menggunakan Firestore.
   * Jika tidak ada atau gagal, otomatis menggunakan IndexedDB lokal.
   */
  async init() {
    if (typeof isFirebaseConfigured === 'function' && isFirebaseConfigured()) {
      try {
        console.log("🔥 Mencoba menghubungkan ke Firebase...");
        // Inisialisasi Firebase App
        firebase.initializeApp(firebaseConfig);
        this.firestore = firebase.firestore();

        // Aktifkan Offline Persistence
        await this.firestore.enablePersistence({ synchronizeTabs: true })
          .catch((err) => {
            if (err.code == 'failed-precondition') {
              console.warn("⚠️ Firestore persistence gagal: multi-tab terbuka.");
            } else if (err.code == 'unimplemented') {
              console.warn("⚠️ Firestore persistence gagal: browser tidak mendukung.");
            }
          });

        // Test Firestore read permission before committing to use Firebase
        try {
          await this.firestore.collection('products').limit(1).get();
          this.useFirebase = true;
          console.log("✅ Firebase Firestore berhasil diaktifkan dengan Offline Persistence & izin baca terverifikasi.");
          return;
        } catch (permissionErr) {
          console.warn("⚠️ Firebase Firestore gagal diakses karena tidak ada izin (Missing or insufficient permissions). Otomatis beralih ke IndexedDB lokal:", permissionErr.message);
          this.useFirebase = false;
        }
      } catch (err) {
        console.error("❌ Gagal menginisialisasi Firebase. Berpindah ke IndexedDB lokal.", err);
        this.useFirebase = false;
      }
    } else {
      console.log("ℹ️ Kredensial Firebase tidak terdeteksi. Menggunakan database lokal IndexedDB.");
      this.useFirebase = false;
    }

    // Fallback ke IndexedDB
    await this.initIndexedDB();
  }

  /**
   * Inisialisasi IndexedDB Lokal (Fallback)
   */
  async initIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Products store
        if (!db.objectStoreNames.contains('products')) {
          const productStore = db.createObjectStore('products', { keyPath: 'id' });
          productStore.createIndex('name', 'name', { unique: false });
          productStore.createIndex('category', 'category', { unique: false });
          productStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Transactions store
        if (!db.objectStoreNames.contains('transactions')) {
          const txStore = db.createObjectStore('transactions', { keyPath: 'id' });
          txStore.createIndex('date', 'date', { unique: false });
          txStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }

        // Employees store (new in v2)
        if (!db.objectStoreNames.contains('employees')) {
          const empStore = db.createObjectStore('employees', { keyPath: 'id' });
          empStore.createIndex('role', 'role', { unique: false });
          empStore.createIndex('pinHash', 'pinHash', { unique: false });
          empStore.createIndex('active', 'active', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        console.log("✅ Database lokal IndexedDB berhasil dimuat.");
        resolve(this.db);
      };

      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  }

  // ==================== EMPLOYEES ====================

  async addEmployee(employee) {
    const data = {
      id: generateId(),
      name: employee.name,
      role: employee.role || 'kasir',
      pinHash: employee.pinHash,
      phone: employee.phone || '',
      active: employee.active !== undefined ? employee.active : true,
      image: employee.image || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (this.useFirebase) {
      await this.firestore.collection('employees').doc(data.id).set(data);
      return data;
    } else {
      return this._put('employees', data);
    }
  }

  async updateEmployee(id, updates) {
    if (this.useFirebase) {
      const docRef = this.firestore.collection('employees').doc(id);
      const existing = await docRef.get();
      if (!existing.exists) throw new Error('Karyawan tidak ditemukan');
      const updated = { ...existing.data(), ...updates, updatedAt: new Date().toISOString() };
      await docRef.set(updated);
      return updated;
    } else {
      const existing = await this.getEmployee(id);
      if (!existing) throw new Error('Karyawan tidak ditemukan');
      const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
      return this._put('employees', updated);
    }
  }

  async getEmployee(id) {
    if (this.useFirebase) {
      const doc = await this.firestore.collection('employees').doc(id).get();
      return doc.exists ? doc.data() : null;
    } else {
      return this._get('employees', id);
    }
  }

  async getAllEmployees() {
    if (this.useFirebase) {
      const snapshot = await this.firestore.collection('employees').get();
      const list = [];
      snapshot.forEach(doc => list.push(doc.data()));
      return list;
    } else {
      return this._getAll('employees');
    }
  }

  async getEmployeesByRole(role) {
    if (this.useFirebase) {
      const snapshot = await this.firestore.collection('employees').where('role', '==', role).get();
      const list = [];
      snapshot.forEach(doc => list.push(doc.data()));
      return list;
    } else {
      return this._getAllByIndex('employees', 'role', role);
    }
  }

  async deleteEmployee(id) {
    if (this.useFirebase) {
      await this.firestore.collection('employees').doc(id).delete();
    } else {
      return this._delete('employees', id);
    }
  }

  // ==================== PRODUCTS ====================

  async addProduct(product) {
    const data = {
      id: generateId(),
      name: product.name,
      code: product.code || '',
      category: product.category || 'lainnya',
      buyPrice: Number(product.buyPrice) || 0,
      sellPrice: Number(product.sellPrice) || 0,
      stock: Number(product.stock) || 0,
      minStock: Number(product.minStock) || 5,
      unit: product.unit || 'pcs',
      labels: product.labels || [],
      image: product.image || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (this.useFirebase) {
      await this.firestore.collection('products').doc(data.id).set(data);
      return data;
    } else {
      return this._put('products', data);
    }
  }

  async updateProduct(id, updates) {
    if (this.useFirebase) {
      const docRef = this.firestore.collection('products').doc(id);
      const existing = await docRef.get();
      if (!existing.exists) throw new Error('Produk tidak ditemukan');
      const updated = { ...existing.data(), ...updates, updatedAt: new Date().toISOString() };
      await docRef.set(updated);
      return updated;
    } else {
      const existing = await this.getProduct(id);
      if (!existing) throw new Error('Produk tidak ditemukan');
      const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
      return this._put('products', updated);
    }
  }

  async getProduct(id) {
    let product;
    if (this.useFirebase) {
      const doc = await this.firestore.collection('products').doc(id).get();
      product = doc.exists ? doc.data() : null;
    } else {
      product = await this._get('products', id);
    }
    if (product && window.migrateCategory) {
      product.category = window.migrateCategory(product.category);
    }
    return product;
  }

  async getAllProducts() {
    let list = [];
    if (this.useFirebase) {
      const snapshot = await this.firestore.collection('products').get();
      snapshot.forEach(doc => list.push(doc.data()));
    } else {
      list = await this._getAll('products');
    }
    return list.map(p => {
      if (window.migrateCategory) {
        p.category = window.migrateCategory(p.category);
      }
      return p;
    });
  }

  async getProductsByCategory(category) {
    let list = [];
    const targetCat = window.migrateCategory ? window.migrateCategory(category) : category;
    if (this.useFirebase) {
      const snapshot = await this.firestore.collection('products').where('category', '==', targetCat).get();
      snapshot.forEach(doc => list.push(doc.data()));
    } else {
      list = await this._getAllByIndex('products', 'category', targetCat);
    }
    return list.map(p => {
      if (window.migrateCategory) {
        p.category = window.migrateCategory(p.category);
      }
      return p;
    });
  }

  async deleteProduct(id) {
    if (this.useFirebase) {
      await this.firestore.collection('products').doc(id).delete();
    } else {
      return this._delete('products', id);
    }
  }

  async searchProducts(query) {
    const all = await this.getAllProducts();
    const q = query.toLowerCase();
    return all.filter(p => p.name.toLowerCase().includes(q));
  }

  async getLowStockProducts() {
    const all = await this.getAllProducts();
    return all.filter(p => p.stock <= p.minStock);
  }

  async updateStock(productId, quantityChange) {
    if (this.useFirebase) {
      const docRef = this.firestore.collection('products').doc(productId);
      const doc = await docRef.get();
      if (!doc.exists) throw new Error('Produk tidak ditemukan');
      const product = doc.data();
      product.stock = Math.max(0, product.stock + quantityChange);
      product.updatedAt = new Date().toISOString();
      await docRef.set(product);
      return product;
    } else {
      const product = await this.getProduct(productId);
      if (!product) throw new Error('Produk tidak ditemukan');
      product.stock = Math.max(0, product.stock + quantityChange);
      product.updatedAt = new Date().toISOString();
      return this._put('products', product);
    }
  }

  // ==================== TRANSACTIONS ====================

  async addTransaction(transaction) {
    const data = {
      id: generateId(),
      items: transaction.items, // [{productId, productName, qty, price, subtotal}]
      total: Number(transaction.total),
      paid: Number(transaction.paid),
      change: Number(transaction.change),
      paymentMethod: transaction.paymentMethod || 'tunai',
      cashierId: transaction.cashierId || null,
      cashierName: transaction.cashierName || null,
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString()
    };

    // Kurangi stok untuk tiap item
    for (const item of data.items) {
      await this.updateStock(item.productId, -item.qty);
    }

    if (this.useFirebase) {
      await this.firestore.collection('transactions').doc(data.id).set(data);
      return data;
    } else {
      return this._put('transactions', data);
    }
  }

  async getTransaction(id) {
    if (this.useFirebase) {
      const doc = await this.firestore.collection('transactions').doc(id).get();
      return doc.exists ? doc.data() : null;
    } else {
      return this._get('transactions', id);
    }
  }

  async getAllTransactions() {
    if (this.useFirebase) {
      const snapshot = await this.firestore.collection('transactions').get();
      const list = [];
      snapshot.forEach(doc => list.push(doc.data()));
      return list;
    } else {
      return this._getAll('transactions');
    }
  }

  async getTransactionsByDateRange(startDate, endDate) {
    const all = await this.getAllTransactions();
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    return all.filter(t => {
      const tDate = new Date(t.createdAt).getTime();
      return tDate >= start && tDate <= end;
    });
  }

  async getTodayTransactions() {
    const today = startOfDay();
    const end = endOfDay();
    return this.getTransactionsByDateRange(today, end);
  }

  async deleteTransaction(id) {
    if (this.useFirebase) {
      await this.firestore.collection('transactions').doc(id).delete();
    } else {
      return this._delete('transactions', id);
    }
  }

  // ==================== SETTINGS ====================

  async getSetting(key) {
    if (this.useFirebase) {
      const doc = await this.firestore.collection('settings').doc(key).get();
      return doc.exists ? doc.data().value : null;
    } else {
      const result = await this._get('settings', key);
      return result ? result.value : null;
    }
  }

  async setSetting(key, value) {
    if (this.useFirebase) {
      await this.firestore.collection('settings').doc(key).set({ key, value });
      return { key, value };
    } else {
      return this._put('settings', { key, value });
    }
  }

  // ==================== STATISTICS ====================

  async getDailySales(days = 7) {
    const results = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const start = startOfDay(date);
      const end = endOfDay(date);
      const txs = await this.getTransactionsByDateRange(start, end);
      const total = txs.reduce((sum, t) => sum + t.total, 0);
      const profit = txs.reduce((sum, t) => {
        return sum + t.items.reduce((s, item) => s + ((item.price - (item.buyPrice || 0)) * item.qty), 0);
      }, 0);
      results.push({
        date: start,
        label: date.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' }),
        total,
        profit,
        count: txs.length
      });
    }
    return results;
  }

  async getMonthlySales() {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const end = endOfDay();
    const txs = await this.getTransactionsByDateRange(start, end);
    return {
      total: txs.reduce((sum, t) => sum + t.total, 0),
      count: txs.length,
      profit: txs.reduce((sum, t) => {
        return sum + t.items.reduce((s, item) => s + ((item.price - (item.buyPrice || 0)) * item.qty), 0);
      }, 0)
    };
  }

  // ==================== EXPORT / IMPORT ====================

  async exportAll() {
    const products = await this.getAllProducts();
    const transactions = await this.getAllTransactions();
    const employees = await this.getAllEmployees();
    return {
      version: DB_VERSION,
      exportedAt: new Date().toISOString(),
      appName: 'Warung Sembako',
      data: { products, transactions, employees }
    };
  }

  async importAll(data) {
    if (!data || !data.data) throw new Error('Format data tidak valid');
    
    const { products, transactions, employees } = data.data;
    
    if (this.useFirebase) {
      // Hapus data saat ini di Firebase Firestore
      const currentProducts = await this.getAllProducts();
      for (const p of currentProducts) {
        await this.firestore.collection('products').doc(p.id).delete();
      }
      const currentTransactions = await this.getAllTransactions();
      for (const t of currentTransactions) {
        await this.firestore.collection('transactions').doc(t.id).delete();
      }
      const currentEmployees = await this.getAllEmployees();
      for (const e of currentEmployees) {
        await this.firestore.collection('employees').doc(e.id).delete();
      }

      // Tulis data baru ke Firestore
      if (products && products.length) {
        for (const p of products) {
          await this.firestore.collection('products').doc(p.id).set(p);
        }
      }
      if (transactions && transactions.length) {
        for (const t of transactions) {
          await this.firestore.collection('transactions').doc(t.id).set(t);
        }
      }
      if (employees && employees.length) {
        for (const e of employees) {
          await this.firestore.collection('employees').doc(e.id).set(e);
        }
      }
    } else {
      // Clear data lokal IndexedDB
      await this._clear('products');
      await this._clear('transactions');
      if (employees) {
        await this._clear('employees');
      }

      // Import ke lokal IndexedDB
      if (products && products.length) {
        for (const p of products) {
          await this._put('products', p);
        }
      }
      if (transactions && transactions.length) {
        for (const t of transactions) {
          await this._put('transactions', t);
        }
      }
      if (employees && employees.length) {
        for (const e of employees) {
          await this._put('employees', e);
        }
      }
    }

    return {
      products: products ? products.length : 0,
      transactions: transactions ? transactions.length : 0,
      employees: employees ? employees.length : 0
    };
  }

  // ==================== LOW-LEVEL HELPERS (INDEXEDDB) ====================

  _put(storeName, data) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.put(data);
      request.onsuccess = () => resolve(data);
      request.onerror = () => reject(request.error);
    });
  }

  _get(storeName, key) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  _getAll(storeName) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  _getAllByIndex(storeName, indexName, value) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  _delete(storeName, key) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  _clear(storeName) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

// Instansiasi database global
const db = new WarungDB();

window.db = db;
