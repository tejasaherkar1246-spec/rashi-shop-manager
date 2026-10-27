// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Your Firebase Configuration (From your console)
const firebaseConfig = {
    apiKey: "AIzaSyCx2JObrUS4hA0-I-iRYG2639UygxLFot8",
    authDomain: "rashiboutiqueapplication.firebaseapp.com",
    projectId: "rashiboutiqueapplication",
    storageBucket: "rashiboutiqueapplication.firebasestorage.app",
    messagingSenderId: "224929726297",
    appId: "1:224929726297:web:ea9f9fc8c0604c98921648",
    measurementId: "G-89PL5RDC4Z"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let products = [];
let sales = [];
let udhari = {};

// Auth State Listener
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('app-container').style.display = 'block';
        loadCloudData();
    } else {
        document.getElementById('login-container').style.display = 'flex';
        document.getElementById('app-container').style.display = 'none';
    }
});

window.handleLogin = function(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    signInWithEmailAndPassword(auth, email, password)
        .catch((error) => {
            alert('Login Failed: ' + error.message);
        });
}

window.handleLogout = function() {
    signOut(auth);
}

// Load Data from Firestore Cloud
async function loadCloudData() {
    try {
        // Load Products
        const prodSnapshot = await getDocs(collection(db, "products"));
        products = [];
        prodSnapshot.forEach((docSnap) => {
            products.push({ id: docSnap.id, ...docSnap.data() });
        });

        // Load Sales
        const salesSnapshot = await getDocs(collection(db, "sales"));
        sales = [];
        salesSnapshot.forEach((docSnap) => {
            sales.push(docSnap.data());
        });

        // Load Udhari
        const udhariSnapshot = await getDocs(collection(db, "udhari"));
        udhari = {};
        udhariSnapshot.forEach((docSnap) => {
            udhari[docSnap.id] = docSnap.data();
        });

        renderAll();
    } catch (err) {
        console.error("Error loading cloud data: ", err);
    }
}

window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    event.target.classList.add('active');
    renderAll();
}

window.renderAll = function() {
    renderInventory();
    renderSalesProductDropdown();
    renderSalesTable();
    renderUdhariTable();
    updateDashboardMetrics();
}

window.handleAddProduct = async function(e) {
    e.preventDefault();
    const name = document.getElementById('prod-name').value;
    const price = parseFloat(document.getElementById('prod-price').value);
    const qty = parseInt(document.getElementById('prod-qty').value);

    const newProd = { name, price, qty };
    const docRef = await addDoc(collection(db, "products"), newProd);
    products.push({ id: docRef.id, ...newProd });

    renderAll();
    document.getElementById('product-form').reset();
}

window.deleteProduct = async function(id) {
    await deleteDoc(doc(db, "products", id));
    products = products.filter(p => p.id !== id);
    renderAll();
}

function renderInventory() {
    const tbody = document.querySelector('#inventory-table tbody');
    tbody.innerHTML = '';
    products.forEach(p => {
        let status = p.qty > 5 ? 'In Full Stock' : (p.qty > 0 ? 'Low Stock' : 'Out of Stock');
        let statusClass = p.qty > 5 ? 'color: green;' : (p.qty > 0 ? 'color: orange;' : 'color: red; font-weight: bold;');
        
        tbody.innerHTML += `
            <tr>
                <td>${p.name}</td>
                <td>₹${p.price}</td>
                <td>${p.qty}</td>
                <td style="${statusClass}">${status}</td>
                <td><button class="btn danger" onclick="deleteProduct('${p.id}')">Delete</button></td>
            </tr>
        `;
    });
}

function renderSalesProductDropdown() {
    const select = document.getElementById('sale-product');
    select.innerHTML = '';
    products.forEach(p => {
        select.innerHTML += `<option value="${p.id}" data-price="${p.price}" data-name="${p.name}" data-qty="${p.qty}">${p.name} (Stock: ${p.qty})</option>`;
    });
    updateSalePrice();
}

window.updateSalePrice = function() {
    const select = document.getElementById('sale-product');
    const selectedOption = select.options[select.selectedIndex];
    if (selectedOption) {
        const price = selectedOption.getAttribute('data-price');
        const qty = document.getElementById('sale-qty').value;
        document.getElementById('sale-price').value = price * qty;
    }
}

window.calculateTotal = function() {
    updateSalePrice();
}

window.handleSale = async function(e) {
    e.preventDefault();
    const customer = document.getElementById('sale-customer').value;
    const select = document.getElementById('sale-product');
    const selectedOption = select.options[select.selectedIndex];
    const productId = select.value;
    const productName = selectedOption.getAttribute('data-name');
    const currentStock = parseInt(selectedOption.getAttribute('data-qty'));
    const qty = parseInt(document.getElementById('sale-qty').value);
    const amount = parseFloat(document.getElementById('sale-price').value);
    const type = document.getElementById('sale-type').value;

    if (currentStock < qty) {
        alert('Error: Insufficient stock available!');
        return;
    }

    // Update product stock in firestore
    const newStock = currentStock - qty;
    await updateDoc(doc(db, "products", productId), { qty: newStock });

    // Record sale in firestore
    const saleRecord = {
        date: new Date().toLocaleString(),
        customer,
        productName,
        qty,
        amount,
        type
    };
    await addDoc(collection(db, "sales"), saleRecord);
    sales.unshift(saleRecord);

    // Handle Udhari
    if (type === 'Udhari') {
        if (!udhari[customer]) {
            udhari[customer] = { balance: 0, items: [] };
        }
        udhari[customer].balance += amount;
        udhari[customer].items.push(`${qty}x ${productName} (₹${amount})`);

        await setDoc(doc(db, "udhari", customer), udhari[customer]);
    }

    await loadCloudData();
    document.getElementById('sale-form').reset();
    alert('Sale recorded & cloud database updated successfully!');
}

function renderSalesTable() {
    const tbody = document.querySelector('#sales-table tbody');
    tbody.innerHTML = '';
    sales.forEach(s => {
        tbody.innerHTML += `
            <tr>
                <td>${s.date}</td>
                <td>${s.customer}</td>
                <td>${s.productName}</td>
                <td>${s.qty}</td>
                <td>₹${s.amount}</td>
                <td>${s.type}</td>
            </tr>
        `;
    });
}

function renderUdhariTable() {
    const tbody = document.querySelector('#udhari-table tbody');
    tbody.innerHTML = '';
    for (let customer in udhari) {
        if (udhari[customer].balance > 0) {
            tbody.innerHTML += `
                <tr>
                    <td>${customer}</td>
                    <td>₹${udhari[customer].balance}</td>
                    <td>${udhari[customer].items.join(', ')}</td>
                    <td><button class="btn success" onclick="clearUdhari('${customer}')">Mark Paid / Clear</button></td>
                </tr>
            `;
        }
    }
}

window.clearUdhari = async function(customer) {
    if (confirm(`Clear all dues for ${customer}?`)) {
        await deleteDoc(doc(db, "udhari", customer));
        delete udhari[customer];
        renderAll();
    }
}

function updateDashboardMetrics() {
    let todayTotal = 0;
    let totalUdhari = 0;

    sales.forEach(s => {
        todayTotal += s.amount;
    });

    for (let c in udhari) {
        totalUdhari += udhari[c].balance;
    }

    document.getElementById('today-sales').innerText = `₹${todayTotal}`;
    document.getElementById('weekly-sales').innerText = `₹${todayTotal * 7}`;
    document.getElementById('monthly-sales').innerText = `₹${todayTotal * 30}`;
    document.getElementById('total-udhari').innerText = `₹${totalUdhari}`;
}