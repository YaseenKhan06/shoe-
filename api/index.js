// Load environment variables locally at the very top
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const path = require('path');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const Razorpay = require('razorpay');
const crypto = require('crypto');

// Razorpay Instance Configuration
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Nodemailer Transporter Configuration (Using secure environment variables)
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

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
    sizes: { type: [String], default: [] },
    reviews: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        name: { type: String, required: true },
        rating: { type: Number, required: true, min: 1, max: 5 },
        comment: { type: String, required: true },
        date: { type: Date, default: Date.now }
    }]
});

const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);

// User Schema
const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    cart: [{
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        quantity: { type: Number, required: true, default: 1 }
    }],
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    addresses: [{
        name: String,
        mobile: String,
        address: String,
        city: String,
        state: String,
        pinCode: String
    }],
    resetOtp: { type: String },
    otpExpiry: { type: Date }
});

const User = mongoose.models.User || mongoose.model('User', UserSchema);

// Order Schema
const OrderSchema = new mongoose.Schema({
    orderId: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [{
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        quantity: { type: Number, required: true }
    }],
    totalAmount: { type: Number, required: true },
    shippingAddress: {
        name: { type: String, required: true },
        mobile: { type: String, required: true },
        address: { type: String, required: true },
        city: { type: String, required: true },
        state: { type: String, required: true },
        pinCode: { type: String, required: true }
    },
    paymentMethod: { type: String, required: true },
    status: { type: String, enum: ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'], default: 'Pending' },
    createdAt: { type: Date, default: Date.now }
});

const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);

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

// POST /api/signup - Register a new user
app.post('/api/signup', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'All fields (name, email, password) are required' });
        }

        await connectToDatabase();

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({
            name,
            email,
            password: hashedPassword
        });

        await newUser.save();

        const token = jwt.sign({ userId: newUser._id, email: newUser.email }, JWT_SECRET, { expiresIn: '24h' });
        return res.status(201).json({
            success: true,
            message: 'User registered successfully',
            token,
            user: { name: newUser.name, email: newUser.email }
        });
    } catch (err) {
        console.error('POST /api/signup error:', err);
        return res.status(500).json({ error: 'Internal server error during registration' });
    }
});

// POST /api/user-login - Authenticate User
app.post('/api/user-login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        await connectToDatabase();

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = jwt.sign({ userId: user._id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
        return res.json({
            success: true,
            message: 'Login successful',
            token,
            user: { name: user.name, email: user.email }
        });
    } catch (err) {
        console.error('POST /api/user-login error:', err);
        return res.status(500).json({ error: 'Internal server error during login' });
    }
});

// POST /api/auth/forgot-password - Generate and send OTP for password reset
app.post('/api/auth/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email address is required' });
        }

        await connectToDatabase();
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ error: 'Email not registered' });
        }

        // Generate a 6-digit numeric OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        // Expire in 10 minutes
        const expiry = new Date(Date.now() + 10 * 60 * 1000);

        user.resetOtp = otp;
        user.otpExpiry = expiry;
        await user.save();

        // Send OTP email via nodemailer
        const mailOptions = {
            from: '"StepStyle Support" <placeholder-email@gmail.com>',
            to: email,
            subject: 'StepStyle - Password Reset OTP',
            text: `Your password reset OTP is ${otp}. It is valid for 10 minutes.`,
            html: `<p>Your password reset OTP is <strong>${otp}</strong>. It is valid for 10 minutes.</p>`
        };

        // Attempt to send email, print to console if SMTP is unconfigured/offline
        try {
            await transporter.sendMail(mailOptions);
        } catch (mailErr) {
            console.warn("Nodemailer failed to send email (probably using dummy credentials). OTP: ", otp, mailErr.message);
        }

        return res.json({ success: true, message: 'OTP sent to your email.' });
    } catch (err) {
        console.error('POST /api/auth/forgot-password error:', err);
        return res.status(500).json({ error: 'Failed to process forgot password request' });
    }
});

// POST /api/auth/reset-password - Verify OTP and update password
app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        if (!email || !otp || !newPassword) {
            return res.status(400).json({ error: 'All fields (email, otp, newPassword) are required' });
        }

        await connectToDatabase();
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if OTP matches and has not expired
        if (!user.resetOtp || user.resetOtp !== otp) {
            return res.status(400).json({ error: 'Invalid OTP code' });
        }

        if (user.otpExpiry && new Date() > user.otpExpiry) {
            return res.status(400).json({ error: 'OTP has expired' });
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;

        // Clear OTP fields
        user.resetOtp = undefined;
        user.otpExpiry = undefined;
        await user.save();

        return res.json({ success: true, message: 'Password reset successful' });
    } catch (err) {
        console.error('POST /api/auth/reset-password error:', err);
        return res.status(500).json({ error: 'Failed to reset password' });
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
        const productId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ error: 'Invalid Product ID format' });
        }
        
        const deletedProduct = await Product.findByIdAndDelete(productId);
        if (!deletedProduct) {
            return res.status(404).json({ error: 'Product not found' });
        }

        // Clean up references to this product from all users' carts and wishlists
        await User.updateMany(
            {
                $or: [
                    { 'cart.productId': productId },
                    { wishlist: productId }
                ]
            },
            {
                $pull: {
                    cart: { productId: productId },
                    wishlist: productId
                }
            }
        );

        return res.json({ success: true, message: 'Product deleted successfully and cleaned up from users\' carts/wishlists' });
    } catch (err) {
        console.error('DELETE /api/products/:id error:', err);
        return res.status(500).json({ error: 'Failed to delete product from database' });
    }
});

// --- User Cart API Routes (Protected) ---

// GET /api/cart - Get user's cart items
app.get('/api/cart', authenticateToken, async (req, res) => {
    try {
        await connectToDatabase();
        const user = await User.findById(req.user.userId).populate('cart.productId');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        return res.json(user.cart);
    } catch (err) {
        console.error('GET /api/cart error:', err);
        return res.status(500).json({ error: 'Failed to retrieve cart' });
    }
});

// POST /api/cart/add - Add a product to cart
app.post('/api/cart/add', authenticateToken, async (req, res) => {
    try {
        const { productId, quantity } = req.body;
        if (!productId) {
            return res.status(400).json({ error: 'Product ID is required' });
        }
        const qty = parseInt(quantity) || 1;

        await connectToDatabase();
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const itemIndex = user.cart.findIndex(item => item.productId.toString() === productId);
        if (itemIndex > -1) {
            user.cart[itemIndex].quantity += qty;
        } else {
            user.cart.push({ productId, quantity: qty });
        }

        await user.save();
        const populatedUser = await user.populate('cart.productId');
        return res.json({ success: true, cart: populatedUser.cart });
    } catch (err) {
        console.error('POST /api/cart/add error:', err);
        return res.status(500).json({ error: 'Failed to add product to cart' });
    }
});

// DELETE /api/cart/remove - Remove a product from cart
app.delete('/api/cart/remove', authenticateToken, async (req, res) => {
    try {
        const { productId } = req.body;
        if (!productId) {
            return res.status(400).json({ error: 'Product ID is required' });
        }

        await connectToDatabase();
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        user.cart = user.cart.filter(item => item.productId.toString() !== productId);
        await user.save();
        const populatedUser = await user.populate('cart.productId');
        return res.json({ success: true, cart: populatedUser.cart });
    } catch (err) {
        console.error('DELETE /api/cart/remove error:', err);
        return res.status(500).json({ error: 'Failed to remove product from cart' });
    }
});

// PUT /api/cart/update - Update quantity of a product in the cart
app.put('/api/cart/update', authenticateToken, async (req, res) => {
    try {
        const { productId, quantity } = req.body;
        if (!productId) {
            return res.status(400).json({ error: 'Product ID is required' });
        }
        const qty = parseInt(quantity);

        await connectToDatabase();
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (qty < 1) {
            // Remove item
            user.cart = user.cart.filter(item => item.productId.toString() !== productId);
        } else {
            // Update quantity
            const itemIndex = user.cart.findIndex(item => item.productId.toString() === productId);
            if (itemIndex > -1) {
                user.cart[itemIndex].quantity = qty;
            } else {
                user.cart.push({ productId, quantity: qty });
            }
        }

        await user.save();
        const populatedUser = await user.populate('cart.productId');
        return res.json({ success: true, cart: populatedUser.cart });
    } catch (err) {
        console.error('PUT /api/cart/update error:', err);
        return res.status(500).json({ error: 'Failed to update cart quantity' });
    }
});

// --- User Wishlist API Routes (Protected) ---

// GET /api/wishlist - Get user's wishlist items
app.get('/api/wishlist', authenticateToken, async (req, res) => {
    try {
        await connectToDatabase();
        const user = await User.findById(req.user.userId).populate('wishlist');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        return res.json(user.wishlist);
    } catch (err) {
        console.error('GET /api/wishlist error:', err);
        return res.status(500).json({ error: 'Failed to retrieve wishlist' });
    }
});

// POST /api/wishlist/toggle - Toggle (add/remove) product in wishlist
app.post('/api/wishlist/toggle', authenticateToken, async (req, res) => {
    try {
        const { productId } = req.body;
        if (!productId) {
            return res.status(400).json({ error: 'Product ID is required' });
        }

        await connectToDatabase();
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const index = user.wishlist.indexOf(productId);
        let action = '';
        if (index > -1) {
            user.wishlist.splice(index, 1);
            action = 'removed';
        } else {
            user.wishlist.push(productId);
            action = 'added';
        }

        await user.save();
        const populatedUser = await user.populate('wishlist');
        return res.json({ success: true, action, wishlist: populatedUser.wishlist });
    } catch (err) {
        console.error('POST /api/wishlist/toggle error:', err);
        return res.status(500).json({ error: 'Failed to toggle wishlist item' });
    }
});

// --- Order API Routes (Protected / Admin) ---

// Helper function to generate a random 6-character alphanumeric order ID prefixed with #
function generateRandomOrderId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return '#' + code;
}

// POST /api/orders/place - Place a new order (Protected)
app.post('/api/orders/place', authenticateToken, async (req, res) => {
    try {
        const { shippingAddress, paymentMethod } = req.body;

        if (!shippingAddress || !shippingAddress.name || !shippingAddress.mobile || !shippingAddress.address || !shippingAddress.city || !shippingAddress.state || !shippingAddress.pinCode) {
            return res.status(400).json({ error: 'All shipping address fields are required' });
        }

        if (!paymentMethod) {
            return res.status(400).json({ error: 'Payment method is required' });
        }

        await connectToDatabase();

        // Generate a unique orderId
        let orderId;
        let isUnique = false;
        let attempts = 0;
        while (!isUnique && attempts < 10) {
            orderId = generateRandomOrderId();
            const existingOrder = await Order.findOne({ orderId });
            if (!existingOrder) {
                isUnique = true;
            }
            attempts++;
        }
        if (!isUnique) {
            return res.status(500).json({ error: 'Failed to generate a unique order ID. Please try again.' });
        }

        // Fetch user's cart populated with product pricing
        const user = await User.findById(req.user.userId).populate('cart.productId');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!user.cart || user.cart.length === 0) {
            return res.status(400).json({ error: 'Your cart is empty' });
        }

        // Calculate total amount and copy cart items for order
        let totalAmount = 0;
        const items = [];

        for (const item of user.cart) {
            if (!item.productId) {
                return res.status(400).json({ error: 'Cart contains an invalid or deleted product' });
            }
            const price = parseFloat(item.productId.price) || 0;
            totalAmount += price * item.quantity;
            items.push({
                productId: item.productId._id,
                quantity: item.quantity
            });
        }

        // Create new Order document
        const newOrder = new Order({
            orderId,
            userId: user._id,
            items,
            totalAmount,
            shippingAddress,
            paymentMethod,
            status: 'Pending'
        });

        await newOrder.save();

        // Clear user's cart
        user.cart = [];
        await user.save();

        return res.status(201).json({
            success: true,
            message: 'Order placed successfully',
            orderId: newOrder.orderId
        });
    } catch (err) {
        console.error('POST /api/orders/place error:', err);
        return res.status(500).json({ error: 'Failed to place order' });
    }
});

// PUT /api/orders/:id/status - Update order status (Protected for Admin)
app.put('/api/orders/:id/status', authenticateToken, async (req, res) => {
    try {
        const { status } = req.body;
        if (!['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'].includes(status)) {
            return res.status(400).json({ error: 'Invalid order status' });
        }

        await connectToDatabase();
        const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        return res.json({ success: true, order });
    } catch (err) {
        console.error('PUT /api/orders/:id/status error:', err);
        return res.status(500).json({ error: 'Failed to update order status' });
    }
});

// PUT /api/orders/:id/cancel - Cancel order (Protected)
app.put('/api/orders/:id/cancel', authenticateToken, async (req, res) => {
    try {
        await connectToDatabase();
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Verify ownership
        if (order.userId.toString() !== req.user.userId) {
            return res.status(403).json({ error: 'Unauthorized to cancel this order' });
        }

        // Allow cancellation only if status is 'Pending' or 'Confirmed'
        if (order.status !== 'Pending' && order.status !== 'Confirmed') {
            return res.status(400).json({ error: `Cannot cancel an order that is ${order.status}` });
        }

        order.status = 'Cancelled';
        await order.save();

        return res.json({ success: true, message: 'Order cancelled successfully', order });
    } catch (err) {
        console.error('PUT /api/orders/:id/cancel error:', err);
        return res.status(500).json({ error: 'Failed to cancel order' });
    }
});

// GET /api/orders/my-orders - Fetch logged-in user's orders (Protected)
app.get('/api/orders/my-orders', authenticateToken, async (req, res) => {
    try {
        await connectToDatabase();
        const orders = await Order.find({ userId: req.user.userId })
            .sort({ createdAt: -1 })
            .populate('items.productId');
        return res.json(orders);
    } catch (err) {
        console.error('GET /api/orders/my-orders error:', err);
        return res.status(500).json({ error: 'Failed to retrieve user orders' });
    }
});

// GET /api/orders/all - Retrieve all orders (Newest first, open access for admin panel)
app.get('/api/orders/all', async (req, res) => {
    try {
        await connectToDatabase();
        const orders = await Order.find()
            .sort({ createdAt: -1 })
            .populate('userId', 'name email')
            .populate('items.productId');
        return res.json(orders);
    } catch (err) {
        console.error('GET /api/orders/all error:', err);
        return res.status(500).json({ error: 'Failed to retrieve orders' });
    }
});

// GET /api/user/addresses - Retrieve saved addresses (Protected)
app.get('/api/user/addresses', authenticateToken, async (req, res) => {
    try {
        await connectToDatabase();
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        return res.json(user.addresses || []);
    } catch (err) {
        console.error('GET /api/user/addresses error:', err);
        return res.status(500).json({ error: 'Failed to retrieve addresses' });
    }
});

// POST /api/user/addresses - Save a new address (Protected)
app.post('/api/user/addresses', authenticateToken, async (req, res) => {
    try {
        const { name, mobile, address, city, state, pinCode } = req.body;
        if (!name || !mobile || !address || !city || !state || !pinCode) {
            return res.status(400).json({ error: 'All fields (name, mobile, address, city, state, pinCode) are required' });
        }

        await connectToDatabase();
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Add to addresses array safely
        if (!user.addresses) {
            user.addresses = [];
        }
        user.addresses.push({ name, mobile, address, city, state, pinCode });
        await user.save();

        return res.status(201).json({ success: true, addresses: user.addresses });
    } catch (err) {
        console.error('POST /api/user/addresses error:', err);
        return res.status(500).json({ error: 'Failed to add address' });
    }
});

// DELETE /api/user/addresses/:id - Delete a saved address (Protected, optional convenience helper)
app.delete('/api/user/addresses/:id', authenticateToken, async (req, res) => {
    try {
        await connectToDatabase();
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        user.addresses = user.addresses.filter(addr => addr._id.toString() !== req.params.id);
        await user.save();

        return res.json({ success: true, addresses: user.addresses });
    } catch (err) {
        console.error('DELETE /api/user/addresses error:', err);
        return res.status(500).json({ error: 'Failed to delete address' });
    }
});

// GET /api/reviews/check/:productId - Check if user has a Delivered order with this product
app.get('/api/reviews/check/:productId', authenticateToken, async (req, res) => {
    try {
        await connectToDatabase();
        
        const order = await Order.findOne({
            userId: req.user.userId,
            status: 'Delivered',
            'items.productId': req.params.productId
        });

        return res.json({ canReview: !!order });
    } catch (err) {
        console.error('GET /api/reviews/check/:productId error:', err);
        return res.status(500).json({ error: 'Failed to verify review permission' });
    }
});

// POST /api/products/:id/review - Post a review for a product (Only for Delivered orders with 100-word limit)
app.post('/api/products/:id/review', authenticateToken, async (req, res) => {
    try {
        const { rating, comment } = req.body;
        if (!rating || !comment) {
            return res.status(400).json({ error: 'Rating and comment are required' });
        }

        const ratingNum = parseInt(rating);
        if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
            return res.status(400).json({ error: 'Rating must be a number between 1 and 5' });
        }

        // Validate word count (max 100 words)
        const wordCount = comment.trim().split(/\s+/).filter(Boolean).length;
        if (wordCount > 100) {
            return res.status(400).json({ error: 'Comment exceeds the strict 100-word limit' });
        }

        await connectToDatabase();

        // Check if user has a Delivered order containing this product
        const order = await Order.findOne({
            userId: req.user.userId,
            status: 'Delivered',
            'items.productId': req.params.id
        });

        if (!order) {
            return res.status(403).json({ error: 'Only customers with delivered orders of this product can write reviews.' });
        }

        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        if (!product.reviews) {
            product.reviews = [];
        }

        product.reviews.push({
            userId: user._id,
            name: user.name,
            rating: ratingNum,
            comment: comment.trim()
        });

        await product.save();

        return res.json({ success: true, reviews: product.reviews });
    } catch (err) {
        console.error('POST /api/products/:id/review error:', err);
        return res.status(500).json({ error: 'Failed to save review' });
    }
});

// DELETE /api/products/:productId/reviews/:reviewId - Delete own review
app.delete('/api/products/:productId/reviews/:reviewId', authenticateToken, async (req, res) => {
    try {
        await connectToDatabase();
        const { productId, reviewId } = req.params;

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const review = product.reviews.id(reviewId);
        if (!review) {
            return res.status(404).json({ error: 'Review not found' });
        }

        // Verify ownership
        if (review.userId.toString() !== req.user.userId) {
            return res.status(403).json({ error: 'Unauthorized to delete this review' });
        }

        // Remove the review
        product.reviews.pull(reviewId);
        await product.save();

        return res.json({ success: true, message: 'Review deleted successfully', reviews: product.reviews });
    } catch (err) {
        console.error('DELETE review error:', err);
        return res.status(500).json({ error: 'Failed to delete review' });
    }
});

// POST /api/payment/create-order - Create a Razorpay order (Protected)
app.post('/api/payment/create-order', authenticateToken, async (req, res) => {
    try {
        await connectToDatabase();

        // Fetch user's cart populated with product pricing
        const user = await User.findById(req.user.userId).populate('cart.productId');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!user.cart || user.cart.length === 0) {
            return res.status(400).json({ error: 'Your cart is empty' });
        }

        // Calculate total amount in INR (convert to paise for Razorpay)
        let totalAmount = 0;
        for (const item of user.cart) {
            if (!item.productId) {
                return res.status(400).json({ error: 'Cart contains an invalid or deleted product' });
            }
            const price = parseFloat(item.productId.price) || 0;
            totalAmount += price * item.quantity;
        }

        if (totalAmount <= 0) {
            return res.status(400).json({ error: 'Invalid order amount' });
        }

        const options = {
            amount: Math.round(totalAmount * 100), // Amount in paise
            currency: 'INR',
            receipt: `rcpt_${Date.now()}` // Shortened to stay under 40 characters
        };

        const rzpOrder = await razorpay.orders.create(options);
        return res.json({
            id: rzpOrder.id,
            amount: rzpOrder.amount,
            currency: rzpOrder.currency,
            key_id: process.env.RAZORPAY_KEY_ID
        });
    } catch (err) {
        console.error('POST /api/payment/create-order error:', err);
        return res.status(500).json({ error: 'Failed to create payment order' });
    }
});

// POST /api/payment/verify - Verify Razorpay signature and place DB Order (Protected)
app.post('/api/payment/verify', authenticateToken, async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, shippingAddress } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ error: 'Payment verification details are required' });
        }

        if (!shippingAddress || !shippingAddress.name || !shippingAddress.mobile || !shippingAddress.address || !shippingAddress.city || !shippingAddress.state || !shippingAddress.pinCode) {
            return res.status(400).json({ error: 'Shipping address is required' });
        }

        // Verify the signature
        const secret = process.env.RAZORPAY_KEY_SECRET;
        const generated_signature = crypto
            .createHmac('sha256', secret)
            .update(razorpay_order_id + "|" + razorpay_payment_id)
            .digest('hex');

        if (generated_signature !== razorpay_signature) {
            return res.status(400).json({ error: 'Invalid payment signature. Verification failed.' });
        }

        await connectToDatabase();

        // Fetch user's cart populated with product pricing
        const user = await User.findById(req.user.userId).populate('cart.productId');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!user.cart || user.cart.length === 0) {
            return res.status(400).json({ error: 'Your cart is empty' });
        }

        // Generate a unique orderId
        let orderId;
        let isUnique = false;
        let attempts = 0;
        while (!isUnique && attempts < 10) {
            orderId = generateRandomOrderId();
            const existingOrder = await Order.findOne({ orderId });
            if (!existingOrder) {
                isUnique = true;
            }
            attempts++;
        }
        if (!isUnique) {
            return res.status(500).json({ error: 'Failed to generate a unique order ID.' });
        }

        // Compile items and final amount
        let totalAmount = 0;
        const items = [];

        for (const item of user.cart) {
            if (!item.productId) {
                return res.status(400).json({ error: 'Cart contains an invalid product' });
            }
            const price = parseFloat(item.productId.price) || 0;
            totalAmount += price * item.quantity;
            items.push({
                productId: item.productId._id,
                quantity: item.quantity
            });
        }

        // Create new Order document in DB
        const newOrder = new Order({
            orderId,
            userId: user._id,
            items,
            totalAmount,
            shippingAddress,
            paymentMethod: 'Online',
            status: 'Confirmed'
        });

        await newOrder.save();

        // Clear user's cart
        user.cart = [];
        await user.save();

        return res.status(201).json({
            success: true,
            message: 'Payment verified and order confirmed successfully',
            orderId: newOrder.orderId
        });
    } catch (err) {
        console.error('POST /api/payment/verify error:', err);
        return res.status(500).json({ error: 'Payment verification failed' });
    }
});

module.exports = app;
