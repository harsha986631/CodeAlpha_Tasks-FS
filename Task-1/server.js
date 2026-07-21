/**
 * SIMPLE E-COMMERCE STORE — single file backend + frontend
 * ----------------------------------------------------------
 * Stack: Node.js + Express (backend), plain HTML/CSS/JS (frontend, embedded below)
 * "Database": a JSON file (db.json) on disk, auto-created & seeded on first run.
 *
 * Features:
 *   - Product listing + product detail page
 *   - User registration / login / logout (sessions, hashed passwords)
 *   - Shopping cart (stored server-side, tied to session)
 *   - Order processing / checkout + order history
 *
 * HOW TO RUN:
 *   1) npm install express express-session bcryptjs
 *   2) node server.js
 *   3) open http://localhost:3000
 *
 * Everything — routes, API, and the HTML/CSS/JS the browser receives — lives
 * in this one file to keep the project easy to read and run.
 */

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'db.json');
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// 1. "DATABASE" — a JSON file used as simple persistent storage.
// ---------------------------------------------------------------------------

function seedDb() {
  return {
    users: [],          // { id, name, email, passwordHash }
    products: [
      { id: 1, name: 'Wireless Headphones', price: 59.99, category: 'Electronics', stock: 25, image: '🎧', description: 'Over-ear wireless headphones with noise cancellation and 30-hour battery life.' },
      { id: 2, name: 'Mechanical Keyboard', price: 89.99, category: 'Electronics', stock: 15, image: '⌨️', description: 'RGB backlit mechanical keyboard with hot-swappable switches.' },
      { id: 3, name: 'Ceramic Coffee Mug', price: 14.5, category: 'Home', stock: 50, image: '☕', description: 'Handmade 12oz ceramic mug, microwave and dishwasher safe.' },
      { id: 4, name: 'Running Shoes', price: 74.0, category: 'Sportswear', stock: 20, image: '👟', description: 'Lightweight breathable running shoes with cushioned sole.' },
      { id: 5, name: 'Backpack', price: 45.0, category: 'Accessories', stock: 30, image: '🎒', description: 'Water-resistant 25L backpack with padded laptop compartment.' },
      { id: 6, name: 'Desk Lamp', price: 22.99, category: 'Home', stock: 40, image: '💡', description: 'Adjustable LED desk lamp with 3 brightness levels and USB charging port.' },
      { id: 7, name: 'Yoga Mat', price: 19.99, category: 'Sportswear', stock: 35, image: '🧘', description: 'Non-slip eco-friendly yoga mat, 6mm thick.' },
      { id: 8, name: 'Sunglasses', price: 34.5, category: 'Accessories', stock: 18, image: '🕶️', description: 'Polarized UV400 protection sunglasses with classic frame.' },
    ],
    orders: [],          // { id, userId, items: [{productId, name, price, qty}], total, status, createdAt }
    nextUserId: 1,
    nextOrderId: 1,
  };
}

function loadDb() {
  if (!fs.existsSync(DB_FILE)) {
    const fresh = seedDb();
    fs.writeFileSync(DB_FILE, JSON.stringify(fresh, null, 2));
    return fresh;
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
}

function saveDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

let db = loadDb();

// ---------------------------------------------------------------------------
// 2. APP SETUP
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json());
app.use(
  session({
    secret: 'dev-secret-change-me-in-production',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 24 }, // 1 day
  })
);

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
  next();
}

function getCart(req) {
  if (!req.session.cart) req.session.cart = []; // [{productId, qty}]
  return req.session.cart;
}

// ---------------------------------------------------------------------------
// 3. AUTH API
// ---------------------------------------------------------------------------

app.post('/api/register', (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email and password are required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (db.users.find((u) => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(409).json({ error: 'Email already registered' });
  }
  const user = {
    id: db.nextUserId++,
    name,
    email,
    passwordHash: bcrypt.hashSync(password, 10),
  };
  db.users.push(user);
  saveDb(db);
  req.session.userId = user.id;
  res.json({ id: user.id, name: user.name, email: user.email });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = db.users.find((u) => u.email.toLowerCase() === (email || '').toLowerCase());
  if (!user || !bcrypt.compareSync(password || '', user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  req.session.userId = user.id;
  res.json({ id: user.id, name: user.name, email: user.email });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  const user = db.users.find((u) => u.id === req.session.userId);
  if (!user) return res.json({ user: null });
  res.json({ user: { id: user.id, name: user.name, email: user.email } });
});

// ---------------------------------------------------------------------------
// 4. PRODUCT API
// ---------------------------------------------------------------------------

app.get('/api/products', (req, res) => {
  res.json(db.products);
});

app.get('/api/products/:id', (req, res) => {
  const product = db.products.find((p) => p.id === Number(req.params.id));
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

// ---------------------------------------------------------------------------
// 5. CART API (session-based, works whether logged in or not)
// ---------------------------------------------------------------------------

function cartWithDetails(req) {
  const cart = getCart(req);
  const items = cart
    .map((line) => {
      const product = db.products.find((p) => p.id === line.productId);
      if (!product) return null;
      return { productId: product.id, name: product.name, price: product.price, image: product.image, qty: line.qty };
    })
    .filter(Boolean);
  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  return { items, total: Math.round(total * 100) / 100 };
}

app.get('/api/cart', (req, res) => {
  res.json(cartWithDetails(req));
});

app.post('/api/cart', (req, res) => {
  const { productId, qty } = req.body || {};
  const product = db.products.find((p) => p.id === Number(productId));
  if (!product) return res.status(404).json({ error: 'Product not found' });
  const cart = getCart(req);
  const existing = cart.find((l) => l.productId === product.id);
  const addQty = Math.max(1, Number(qty) || 1);
  if (existing) existing.qty += addQty;
  else cart.push({ productId: product.id, qty: addQty });
  res.json(cartWithDetails(req));
});

app.put('/api/cart/:productId', (req, res) => {
  const { qty } = req.body || {};
  const cart = getCart(req);
  const line = cart.find((l) => l.productId === Number(req.params.productId));
  if (!line) return res.status(404).json({ error: 'Item not in cart' });
  line.qty = Math.max(0, Number(qty) || 0);
  req.session.cart = cart.filter((l) => l.qty > 0);
  res.json(cartWithDetails(req));
});

app.delete('/api/cart/:productId', (req, res) => {
  const cart = getCart(req);
  req.session.cart = cart.filter((l) => l.productId !== Number(req.params.productId));
  res.json(cartWithDetails(req));
});

// ---------------------------------------------------------------------------
// 6. ORDER PROCESSING
// ---------------------------------------------------------------------------

app.post('/api/orders', requireAuth, (req, res) => {
  const { items, total } = cartWithDetails(req);
  if (items.length === 0) return res.status(400).json({ error: 'Cart is empty' });

  // Basic stock check
  for (const item of items) {
    const product = db.products.find((p) => p.id === item.productId);
    if (!product || product.stock < item.qty) {
      return res.status(400).json({ error: `Not enough stock for "${item.name}"` });
    }
  }
  // Deduct stock
  for (const item of items) {
    const product = db.products.find((p) => p.id === item.productId);
    product.stock -= item.qty;
  }

  const order = {
    id: db.nextOrderId++,
    userId: req.session.userId,
    items,
    total,
    status: 'confirmed',
    createdAt: new Date().toISOString(),
  };
  db.orders.push(order);
  req.session.cart = [];
  saveDb(db);
  res.json(order);
});

app.get('/api/orders', requireAuth, (req, res) => {
  const myOrders = db.orders.filter((o) => o.userId === req.session.userId).sort((a, b) => b.id - a.id);
  res.json(myOrders);
});

// ---------------------------------------------------------------------------
// 7. FRONTEND — single-page app served as one HTML string.
// ---------------------------------------------------------------------------

app.get('/', (req, res) => {
  res.type('html').send(FRONTEND_HTML);
});

const FRONTEND_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>SimpleShop</title>
<style>
  :root{
    --bg:#f7f7fb; --card:#ffffff; --ink:#1c1c28; --muted:#6b6b7b;
    --accent:#4f46e5; --accent-dark:#4338ca; --border:#e6e6ef; --danger:#dc2626; --ok:#16a34a;
  }
  *{box-sizing:border-box;}
  body{margin:0;font-family:'Segoe UI',Roboto,Arial,sans-serif;background:var(--bg);color:var(--ink);}
  header{background:var(--card);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:10;}
  .nav{max-width:1100px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;padding:14px 20px;}
  .brand{font-size:22px;font-weight:800;color:var(--accent);cursor:pointer;}
  .nav-links{display:flex;align-items:center;gap:18px;}
  .nav-links a, .nav-links button{background:none;border:none;font-size:15px;color:var(--ink);cursor:pointer;padding:6px 4px;}
  .nav-links a:hover, .nav-links button:hover{color:var(--accent);}
  .cart-badge{background:var(--accent);color:#fff;border-radius:999px;padding:1px 8px;font-size:12px;margin-left:4px;}
  main{max-width:1100px;margin:0 auto;padding:24px 20px 60px;}
  h1{font-size:26px;margin:0 0 6px;}
  .subtitle{color:var(--muted);margin:0 0 24px;}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:18px;}
  .card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px;cursor:pointer;transition:transform .12s, box-shadow .12s;}
  .card:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(0,0,0,.06);}
  .emoji{font-size:48px;text-align:center;margin-bottom:10px;}
  .p-name{font-weight:600;margin:0 0 4px;font-size:15px;}
  .p-cat{color:var(--muted);font-size:12px;margin:0 0 8px;}
  .p-price{font-weight:700;color:var(--accent);font-size:16px;}
  button.primary{background:var(--accent);color:#fff;border:none;padding:10px 16px;border-radius:8px;font-size:14px;cursor:pointer;font-weight:600;}
  button.primary:hover{background:var(--accent-dark);}
  button.secondary{background:#fff;color:var(--ink);border:1px solid var(--border);padding:10px 16px;border-radius:8px;font-size:14px;cursor:pointer;}
  button.secondary:hover{border-color:var(--accent);color:var(--accent);}
  button.danger{background:none;border:none;color:var(--danger);cursor:pointer;font-size:13px;}
  .qty-controls{display:flex;align-items:center;gap:8px;}
  .qty-controls button{width:28px;height:28px;border-radius:6px;border:1px solid var(--border);background:#fff;cursor:pointer;}
  .row{display:flex;align-items:center;justify-content:space-between;}
  .detail-wrap{display:flex;gap:32px;flex-wrap:wrap;background:var(--card);border:1px solid var(--border);border-radius:14px;padding:28px;}
  .detail-emoji{font-size:120px;flex:0 0 260px;text-align:center;}
  .detail-info{flex:1;min-width:260px;}
  .back-link{display:inline-block;margin-bottom:16px;color:var(--accent);cursor:pointer;font-size:14px;}
  .cart-line{display:flex;align-items:center;justify-content:space-between;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px 16px;margin-bottom:10px;}
  .cart-line .info{display:flex;align-items:center;gap:12px;}
  .cart-emoji{font-size:28px;}
  .cart-summary{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px;margin-top:20px;max-width:360px;margin-left:auto;}
  .total-row{display:flex;justify-content:space-between;font-weight:700;font-size:18px;margin:10px 0 16px;}
  form{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:26px;max-width:380px;margin:0 auto;}
  form h2{margin-top:0;}
  form label{display:block;font-size:13px;color:var(--muted);margin:12px 0 4px;}
  form input{width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;font-size:14px;}
  form button{width:100%;margin-top:18px;}
  .form-switch{text-align:center;margin-top:14px;font-size:13px;color:var(--muted);}
  .form-switch a{color:var(--accent);cursor:pointer;text-decoration:none;}
  .msg{padding:10px 14px;border-radius:8px;font-size:14px;margin-bottom:14px;}
  .msg.error{background:#fef2f2;color:var(--danger);border:1px solid #fecaca;}
  .msg.ok{background:#f0fdf4;color:var(--ok);border:1px solid #bbf7d0;}
  .empty{text-align:center;color:var(--muted);padding:60px 0;}
  .order-card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:18px;margin-bottom:14px;}
  .order-card .oid{font-weight:700;}
  .badge-status{background:#f0fdf4;color:var(--ok);padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600;}
  footer{text-align:center;color:var(--muted);font-size:13px;padding:30px 0;}
  .stock-low{color:var(--danger);font-size:12px;font-weight:600;}
</style>
</head>
<body>

<header>
  <div class="nav">
    <div class="brand" onclick="navigate('home')">🛍️ SimpleShop</div>
    <div class="nav-links" id="navLinks"></div>
  </div>
</header>

<main id="app"></main>
<footer>Simple E-commerce Demo &middot; Express.js + JSON file storage</footer>

<script>
// ---------------------------------------------------------------------
// FRONTEND APP — vanilla JS, no build step, single page, client-side router
// ---------------------------------------------------------------------
const state = { user: null, route: 'home', productId: null, products: [], cart: { items: [], total: 0 } };

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function navigate(route, productId = null) {
  state.route = route;
  state.productId = productId;
  render();
  window.scrollTo(0, 0);
}

async function loadInitial() {
  const [{ user }, products, cart] = await Promise.all([
    api('/api/me'),
    api('/api/products'),
    api('/api/cart'),
  ]);
  state.user = user;
  state.products = products;
  state.cart = cart;
  render();
}

function renderNav() {
  const nav = document.getElementById('navLinks');
  const cartCount = state.cart.items.reduce((s, i) => s + i.qty, 0);
  nav.innerHTML = \`
    <a onclick="navigate('home')">Products</a>
    <a onclick="navigate('cart')">Cart <span class="cart-badge">\${cartCount}</span></a>
    \${state.user ? \`
      <a onclick="navigate('orders')">My Orders</a>
      <span style="color:var(--muted);font-size:14px;">Hi, \${escapeHtml(state.user.name)}</span>
      <button onclick="logout()">Logout</button>
    \` : \`
      <a onclick="navigate('login')">Login</a>
      <button class="primary" onclick="navigate('register')">Sign Up</button>
    \`}
  \`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function money(n) { return '$' + Number(n).toFixed(2); }

async function render() {
  renderNav();
  const app = document.getElementById('app');
  if (state.route === 'home') app.innerHTML = viewHome();
  else if (state.route === 'product') app.innerHTML = viewProduct();
  else if (state.route === 'cart') app.innerHTML = viewCart();
  else if (state.route === 'login') app.innerHTML = viewLogin();
  else if (state.route === 'register') app.innerHTML = viewRegister();
  else if (state.route === 'orders') app.innerHTML = await viewOrders();
  else if (state.route === 'checkout-success') app.innerHTML = viewCheckoutSuccess();
}

// ---- Views ----

function viewHome() {
  const cards = state.products.map(p => \`
    <div class="card" onclick="navigate('product', \${p.id})">
      <div class="emoji">\${p.image}</div>
      <p class="p-name">\${escapeHtml(p.name)}</p>
      <p class="p-cat">\${escapeHtml(p.category)}</p>
      <div class="row">
        <span class="p-price">\${money(p.price)}</span>
        \${p.stock < 5 ? '<span class="stock-low">Low stock</span>' : ''}
      </div>
    </div>
  \`).join('');
  return \`
    <h1>Our Products</h1>
    <p class="subtitle">Browse the catalog and add items to your cart.</p>
    <div class="grid">\${cards}</div>
  \`;
}

function viewProduct() {
  const p = state.products.find(x => x.id === state.productId);
  if (!p) return '<p>Product not found.</p>';
  return \`
    <span class="back-link" onclick="navigate('home')">&larr; Back to products</span>
    <div class="detail-wrap">
      <div class="detail-emoji">\${p.image}</div>
      <div class="detail-info">
        <h1>\${escapeHtml(p.name)}</h1>
        <p class="p-cat">\${escapeHtml(p.category)}</p>
        <p style="color:var(--muted);line-height:1.6;">\${escapeHtml(p.description)}</p>
        <p class="p-price" style="font-size:24px;">\${money(p.price)}</p>
        <p style="color:var(--muted);font-size:13px;">\${p.stock} in stock</p>
        <div id="detailMsg"></div>
        <button class="primary" onclick="addToCart(\${p.id})" \${p.stock === 0 ? 'disabled' : ''}>
          \${p.stock === 0 ? 'Out of stock' : 'Add to Cart'}
        </button>
      </div>
    </div>
  \`;
}

function viewCart() {
  if (state.cart.items.length === 0) {
    return \`<h1>Your Cart</h1><div class="empty">Your cart is empty. <br><br><span class="back-link" onclick="navigate('home')">Browse products &rarr;</span></div>\`;
  }
  const lines = state.cart.items.map(i => \`
    <div class="cart-line">
      <div class="info">
        <span class="cart-emoji">\${i.image}</span>
        <div>
          <div style="font-weight:600;">\${escapeHtml(i.name)}</div>
          <div style="color:var(--muted);font-size:13px;">\${money(i.price)} each</div>
        </div>
      </div>
      <div class="qty-controls">
        <button onclick="updateQty(\${i.productId}, \${i.qty - 1})">−</button>
        <span>\${i.qty}</span>
        <button onclick="updateQty(\${i.productId}, \${i.qty + 1})">+</button>
        <button class="danger" onclick="updateQty(\${i.productId}, 0)">Remove</button>
      </div>
    </div>
  \`).join('');
  return \`
    <h1>Your Cart</h1>
    \${lines}
    <div class="cart-summary">
      <div class="total-row"><span>Total</span><span>\${money(state.cart.total)}</span></div>
      <div id="cartMsg"></div>
      <button class="primary" style="width:100%;" onclick="checkout()">Checkout</button>
    </div>
  \`;
}

function viewLogin() {
  return \`
    <form onsubmit="return doLogin(event)">
      <h2>Login</h2>
      <div id="loginMsg"></div>
      <label>Email</label>
      <input type="email" id="loginEmail" required />
      <label>Password</label>
      <input type="password" id="loginPassword" required />
      <button class="primary" type="submit">Login</button>
      <div class="form-switch">No account? <a onclick="navigate('register')">Sign up</a></div>
    </form>
  \`;
}

function viewRegister() {
  return \`
    <form onsubmit="return doRegister(event)">
      <h2>Create Account</h2>
      <div id="registerMsg"></div>
      <label>Name</label>
      <input type="text" id="regName" required />
      <label>Email</label>
      <input type="email" id="regEmail" required />
      <label>Password (min 6 chars)</label>
      <input type="password" id="regPassword" required minlength="6" />
      <button class="primary" type="submit">Sign Up</button>
      <div class="form-switch">Already have an account? <a onclick="navigate('login')">Login</a></div>
    </form>
  \`;
}

async function viewOrders() {
  if (!state.user) { navigate('login'); return ''; }
  const orders = await api('/api/orders');
  if (orders.length === 0) return \`<h1>My Orders</h1><div class="empty">No orders yet.</div>\`;
  const cards = orders.map(o => \`
    <div class="order-card">
      <div class="row">
        <span class="oid">Order #\${o.id}</span>
        <span class="badge-status">\${o.status}</span>
      </div>
      <p style="color:var(--muted);font-size:13px;">\${new Date(o.createdAt).toLocaleString()}</p>
      \${o.items.map(i => \`<div class="row" style="font-size:14px;padding:4px 0;"><span>\${i.image} \${escapeHtml(i.name)} x\${i.qty}</span><span>\${money(i.price * i.qty)}</span></div>\`).join('')}
      <div class="total-row" style="font-size:15px;margin-top:8px;"><span>Total</span><span>\${money(o.total)}</span></div>
    </div>
  \`).join('');
  return \`<h1>My Orders</h1>\${cards}\`;
}

function viewCheckoutSuccess() {
  return \`
    <div class="empty">
      <h1 style="color:var(--ok);">🎉 Order placed!</h1>
      <p>Thanks for your purchase.</p>
      <button class="primary" onclick="navigate('orders')">View My Orders</button>
      <button class="secondary" onclick="navigate('home')">Continue Shopping</button>
    </div>
  \`;
}

// ---- Actions ----

async function addToCart(productId) {
  try {
    state.cart = await api('/api/cart', { method: 'POST', body: JSON.stringify({ productId, qty: 1 }) });
    const msg = document.getElementById('detailMsg');
    if (msg) msg.innerHTML = '<div class="msg ok">Added to cart!</div>';
    renderNav();
  } catch (e) {
    const msg = document.getElementById('detailMsg');
    if (msg) msg.innerHTML = '<div class="msg error">' + e.message + '</div>';
  }
}

async function updateQty(productId, qty) {
  if (qty <= 0) state.cart = await api('/api/cart/' + productId, { method: 'DELETE' });
  else state.cart = await api('/api/cart/' + productId, { method: 'PUT', body: JSON.stringify({ qty }) });
  render();
}

async function checkout() {
  if (!state.user) { navigate('login'); return; }
  try {
    await api('/api/orders', { method: 'POST' });
    state.cart = await api('/api/cart');
    navigate('checkout-success');
  } catch (e) {
    const msg = document.getElementById('cartMsg');
    if (msg) msg.innerHTML = '<div class="msg error">' + e.message + '</div>';
  }
}

async function doLogin(evt) {
  evt.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  try {
    state.user = await api('/api/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    state.cart = await api('/api/cart');
    navigate('home');
  } catch (e) {
    document.getElementById('loginMsg').innerHTML = '<div class="msg error">' + e.message + '</div>';
  }
  return false;
}

async function doRegister(evt) {
  evt.preventDefault();
  const name = document.getElementById('regName').value;
  const email = document.getElementById('regEmail').value;
  const password = document.getElementById('regPassword').value;
  try {
    state.user = await api('/api/register', { method: 'POST', body: JSON.stringify({ name, email, password }) });
    state.cart = await api('/api/cart');
    navigate('home');
  } catch (e) {
    document.getElementById('registerMsg').innerHTML = '<div class="msg error">' + e.message + '</div>';
  }
  return false;
}

async function logout() {
  await api('/api/logout', { method: 'POST' });
  state.user = null;
  navigate('home');
}

loadInitial();
</script>
</body>
</html>`;

// ---------------------------------------------------------------------------
// 8. START SERVER
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`SimpleShop running at http://localhost:${PORT}`);
});
