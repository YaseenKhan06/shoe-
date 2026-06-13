const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const path = require('path');

// Load environment variables locally
require('dotenv').config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Serve static assets from root for local dev
app.use(express.static(path.join(__dirname, '..')));

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'stepstyle_secret_key_2026';

// MongoDB Connection Cache
let cachedDb = null;

async function connectToDatabase() {
    if (cachedDb && mongoose.connection.readyState === 1) {
        return cachedDb;
    }
    if (!process.env.MONGODB_URI) {
        throw new Error('Please define the MONGODB_URI environment variable inside .env');
    }
    const db = await mongoose.connect(process.env.MONGODB_URI);
    cachedDb = db;
    await seedDatabaseIfEmpty();
    return db;
}

// Product Schema
const ProductSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: String, required: true },
    img: { type: mongoose.Schema.Types.Mixed, required: true },
    category: { type: String, required: true },
    description: { type: String },
    brand: { type: String },
    material: { type: String },
    soleMaterial: { type: String },
    closure: { type: String },
    suitableFor: { type: String },
    sizes: { type: [String], default: [] }
});

const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);

// Initial drops seeding if db is empty
const initialProducts = [
    { name: "Apex Carbon V1", price: "240", img: "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?auto=format&fit=crop&q=80&w=400", category: "Sports", description: "Elite carbon athletic performance shoe.", brand: "StepStyle", material: "Carbon Fiber, Mesh", soleMaterial: "Rubber", closure: "Lace-Up", suitableFor: "Men", sizes: ["7", "8", "9", "10", "11"] },
    { name: "Onyx Reserve", price: "310", img: "https://images.unsplash.com/photo-1605348532760-6753d2c43329?auto=format&fit=crop&q=80&w=400", category: "Sports", description: "Premium dark reserve athletic design.", brand: "StepStyle", material: "Synthetic Leather", soleMaterial: "EVA", closure: "Lace-Up", suitableFor: "Men", sizes: ["8", "9", "10", "11"] },
    { name: "Solaris Glide", price: "185", img: "https://images.unsplash.com/photo-1512374382149-4332c6c02151?auto=format&fit=crop&q=80&w=400", category: "Casual", description: "Lightweight slide for high motion freedom.", brand: "StepStyle", material: "Textile", soleMaterial: "Rubber", closure: "Slip-On", suitableFor: "Men", sizes: ["7", "8", "9", "10"] },
    { name: "Lunar Flux", price: "275", img: "https://images.unsplash.com/photo-1551107696-a4b0c5a0d9a2?auto=format&fit=crop&q=80&w=400", category: "Casual", description: "Space design casual performance sneakers.", brand: "StepStyle", material: "Knit", soleMaterial: "Rubber", closure: "Lace-Up", suitableFor: "Men", sizes: ["8", "9", "10", "11", "12"] },
    { name: "Aero Stealth", price: "220", img: "https://images.unsplash.com/photo-1460353581641-37baddab0fa2?auto=format&fit=crop&q=80&w=400", category: "Sports", description: "Stealth athletic runner for clean motion.", brand: "StepStyle", material: "Mesh", soleMaterial: "Rubber", closure: "Lace-Up", suitableFor: "Men", sizes: ["6", "7", "8", "9", "10", "11"] },
    { name: "Veridian Peak", price: "195", img: "https://images.unsplash.com/photo-1539185441755-769473a23570?auto=format&fit=crop&q=80&w=400", category: "Formal", description: "Artisanal leather shoe with green detailing.", brand: "StepStyle", material: "Leather", soleMaterial: "Rubber", closure: "Lace-Up", suitableFor: "Men", sizes: ["7", "8", "9", "10"] },
    { name: "Obsidian Core", price: "340", img: "https://images.unsplash.com/photo-1511556532299-8f660fc26c06?auto=format&fit=crop&q=80&w=400", category: "Formal", description: "Deep black premium luxury formal footwear.", brand: "StepStyle", material: "Patent Leather", soleMaterial: "Rubber", closure: "Lace-Up", suitableFor: "Men", sizes: ["8", "9", "10", "11"] },
    { name: "Nova Horizon", price: "260", img: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&q=80&w=400", category: "Casual", description: "High design horizon casual line.", brand: "StepStyle", material: "Suede", soleMaterial: "Rubber", closure: "Lace-Up", suitableFor: "Men", sizes: ["7", "8", "9", "10", "11"] }
];

async function seedDatabaseIfEmpty() {
    const count = await Product.countDocuments();
    if (count === 0) {
        await Product.insertMany(initialProducts);
        console.log("Database seeded successfully with initial mock products.");
    }
}

// Authentication Middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
}

// API Routes

// POST /api/login - Authenticate Admin
app.post('/api/login', (req, res) => {
    const { adminId, adminPass } = req.body;
    
    const envAdminId = process.env.ADMIN_ID || 'admin';
    const envAdminPass = process.env.ADMIN_PASS || 'stepstyle2026';

    if (adminId === envAdminId && adminPass === envAdminPass) {
        const token = jwt.sign({ admin: true }, JWT_SECRET, { expiresIn: '2h' });
        return res.json({ success: true, token });
    } else {
        return res.status(401).json({ success: false, error: 'Invalid Admin ID or Password' });
    }
});

// GET /api/products - Get products (optionally filtered by category)
app.get('/api/products', async (req, res) => {
    try {
        await connectToDatabase();

        const filter = {};
        if (req.query.category) {
            filter.category = req.query.category;
        }

        const products = await Product.find(filter).sort({ _id: -1 });
        return res.json(products);
    } catch (err) {
        console.error('GET /api/products error:', err);
        return res.status(500).json({ error: 'Database query failed' });
    }
});

// GET /api/products/:id - Get single product
app.get('/api/products/:id', async (req, res) => {
    try {
        await connectToDatabase();
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid Product ID format' });
        }
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        return res.json(product);
    } catch (err) {
        console.error('GET /api/products/:id error:', err);
        return res.status(500).json({ error: 'Database query failed' });
    }
});

// POST /api/products - Save new product (protected)
app.post('/api/products', authenticateToken, async (req, res) => {
    try {
        const { name, price, img, category, description, brand, material, soleMaterial, closure, suitableFor, sizes } = req.body;
        
        if (!name || !price || !img || !category) {
            return res.status(400).json({ error: 'Fields (name, price, img, category) are required' });
        }

        await connectToDatabase();
        
        const newProduct = new Product({
            name,
            price,
            img,
            category,
            description: description || '',
            brand: brand || '',
            material: material || '',
            soleMaterial: soleMaterial || '',
            closure: closure || '',
            suitableFor: suitableFor || '',
            sizes: Array.isArray(sizes) ? sizes : []
        });

        const savedProduct = await newProduct.save();
        return res.status(201).json({ success: true, product: savedProduct });
    } catch (err) {
        console.error('POST /api/products error:', err);
        return res.status(500).json({ error: 'Failed to save product to database' });
    }
});

// DELETE /api/products/:id - Remove product (protected)
app.delete('/api/products/:id', authenticateToken, async (req, res) => {
    try {
        await connectToDatabase();
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid Product ID format' });
        }
        const deletedProduct = await Product.findByIdAndDelete(req.params.id);
        if (!deletedProduct) {
            return res.status(404).json({ error: 'Product not found' });
        }
        return res.json({ success: true, message: 'Product deleted successfully' });
    } catch (err) {
        console.error('DELETE /api/products/:id error:', err);
        return res.status(500).json({ error: 'Failed to delete product from database' });
    }
});

module.exports = app;
