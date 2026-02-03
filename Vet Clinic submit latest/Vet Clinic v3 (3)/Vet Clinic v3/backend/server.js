const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const otplib = require('otplib');
const db = require('./database'); // Firestore instance
const { encrypt, decrypt } = require('./utils/encryption');
const { authenticateToken, authorizeRole, JWT_SECRET } = require('./middleware/auth');

const app = express();
const PORT = 5000;

app.use(helmet());
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use(limiter);

// --- AUTH ROUTES (FIRESTORE) ---
app.post('/api/auth/register', [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('name').trim().escape()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { name, email, phone, password } = req.body;

    try {
        const usersRef = db.collection('users');
        const existing = await usersRef.where('email', '==', email).limit(1).get();
        if (!existing.empty) return res.status(400).json({ message: 'Email already exists.' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUserRef = await usersRef.add({
            name,
            email,
            phone: phone || '',
            password: hashedPassword,
            role: 'client',
            two_factor_enabled: false,
            two_factor_secret: null,
        });

        await newUserRef.update({ id: newUserRef.id });

        res.json({ message: 'Registration successful' });
    } catch (e) {
        console.error('Register error', e);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password, code } = req.body;

    try {
        const usersRef = db.collection('users');
        const snap = await usersRef.where('email', '==', email).limit(1).get();
        if (snap.empty) return res.status(400).json({ message: 'Invalid credentials' });

        const doc = snap.docs[0];
        const user = { id: doc.id, ...doc.data() };

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(400).json({ message: 'Invalid credentials' });

        if (user.two_factor_enabled) {
            if (!code) return res.status(200).json({ require2FA: true });
            const isValid = otplib.authenticator.verify({ token: code, secret: user.two_factor_secret });
            if (!isValid) return res.status(400).json({ message: 'Invalid 2FA Code' });
        }

        const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '2h' });

        await db.collection('audit_logs').add({
            user_email: email,
            action: 'LOGIN',
            details: 'Successful Login',
            timestamp: new Date().toISOString(),
        });

        res.json({
            token,
            user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone },
        });
    } catch (e) {
        console.error('Login error', e);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/auth/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        await db.collection('password_requests').add({
            email,
            status: 'Pending',
            request_date: new Date().toISOString(),
        });
        res.json({ message: 'Logged' });
    } catch (e) {
        console.error('Forgot password error', e);
        res.status(500).json({ message: 'Server error' });
    }
});

// --- SETTINGS ROUTES (FIRESTORE) ---
app.put('/api/auth/profile', authenticateToken, async (req, res) => {
    const { name, phone } = req.body;
    try {
        const userRef = db.collection('users').doc(req.user.id);
        await userRef.update({ name, phone });
        res.json({ message: 'Profile updated', user: { ...req.user, name, phone } });
    } catch (e) {
        console.error('Profile update error', e);
        res.status(500).json({ message: 'Update failed' });
    }
});

app.put('/api/auth/password', authenticateToken, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    try {
        const userRef = db.collection('users').doc(req.user.id);
        const doc = await userRef.get();
        if (!doc.exists) return res.status(400).json({ message: 'User not found' });

        const data = doc.data();
        const valid = await bcrypt.compare(currentPassword, data.password);
        if (!valid) return res.status(400).json({ message: 'Incorrect password' });

        const hashedNew = await bcrypt.hash(newPassword, 10);
        await userRef.update({ password: hashedNew });

        await db.collection('audit_logs').add({
            user_email: req.user.email,
            action: 'PASSWORD_CHANGE',
            details: 'User changed password',
            timestamp: new Date().toISOString(),
        });

        res.json({ message: 'Password updated' });
    } catch (e) {
        console.error('Password update error', e);
        res.status(500).json({ message: 'Error' });
    }
});

// --- 2FA ROUTES (FIRESTORE) ---
app.post('/api/auth/2fa/setup', authenticateToken, (req, res) => {
    const secret = otplib.authenticator.generateSecret();
    res.json({ secret, otpauth: otplib.authenticator.keyuri(req.user.email, 'SecureVet', secret) });
});

app.post('/api/auth/2fa/enable', authenticateToken, async (req, res) => {
    const { token, secret } = req.body;
    const isValid = otplib.authenticator.verify({ token, secret });
    if (!isValid) return res.status(400).json({ message: 'Invalid Token' });

    try {
        const userRef = db.collection('users').doc(req.user.id);
        await userRef.update({ two_factor_enabled: true, two_factor_secret: secret });
        res.json({ message: '2FA Enabled' });
    } catch (e) {
        console.error('2FA enable error', e);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/auth/2fa/disable', authenticateToken, async (req, res) => {
    try {
        const userRef = db.collection('users').doc(req.user.id);
        await userRef.update({ two_factor_enabled: false, two_factor_secret: null });
        res.json({ message: 'Disabled' });
    } catch (e) {
        console.error('2FA disable error', e);
        res.status(500).json({ message: 'Server error' });
    }
});

// --- ADMIN ROUTES (FIRESTORE) ---
app.get('/api/admin/users', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const snap = await db.collection('users').get();
        const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        res.json(users);
    } catch (e) {
        console.error('Admin users error', e);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/admin/users', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    const { name, email, password, role, phone } = req.body;
    try {
        const usersRef = db.collection('users');
        const existing = await usersRef.where('email', '==', email).limit(1).get();
        if (!existing.empty) return res.status(400).json({ message: 'Email already exists.' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUserRef = await usersRef.add({
            name,
            email,
            phone: phone || '',
            password: hashedPassword,
            role,
            two_factor_enabled: false,
            two_factor_secret: null,
        });
        await newUserRef.update({ id: newUserRef.id });
        res.json({ message: 'User created', id: newUserRef.id });
    } catch (e) {
        console.error('Admin create user error', e);
        res.status(500).json({ message: 'Server error' });
    }
});

app.put('/api/admin/users/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    const { name, role, phone } = req.body;
    try {
        const userRef = db.collection('users').doc(req.params.id);
        await userRef.update({ name, role, phone });
        res.json({ message: 'User updated' });
    } catch (e) {
        console.error('Admin update user error', e);
        res.status(500).json({ message: 'Server error' });
    }
});

app.delete('/api/admin/users/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const userRef = db.collection('users').doc(req.params.id);
        await userRef.delete();
        res.json({ message: 'Deleted' });
    } catch (e) {
        console.error('Admin delete user error', e);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/admin/logs', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const snap = await db.collection('audit_logs').orderBy('timestamp', 'desc').limit(50).get();
        const logs = snap.docs.map((d, idx) => ({ id: d.id || idx + 1, ...d.data() }));
        res.json(logs);
    } catch (e) {
        console.error('Admin logs error', e);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/admin/password-requests', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const snap = await db.collection('password_requests').where('status', '==', 'Pending').get();
        const requests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        res.json(requests);
    } catch (e) {
        console.error('Admin password requests error', e);
        res.status(500).json({ message: 'Server error' });
    }
});

app.put('/api/admin/password-requests/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const ref = db.collection('password_requests').doc(req.params.id);
        await ref.update({ status: 'Resolved' });
        res.json({ message: 'Resolved' });
    } catch (e) {
        console.error('Admin resolve request error', e);
        res.status(500).json({ message: 'Server error' });
    }
});

// --- DATA ROUTES (FIRESTORE) ---

app.get('/api/appointments', authenticateToken, async (req, res) => {
    try {
        const apptSnap = await db.collection('appointments').get();
        const apptsRaw = apptSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const petsSnap = await db.collection('pets').get();
        const usersSnap = await db.collection('users').get();

        const pets = {};
        petsSnap.docs.forEach(d => { pets[d.id] = { id: d.id, ...d.data() }; });
        const users = {};
        usersSnap.docs.forEach(d => { users[d.id] = { id: d.id, ...d.data() }; });

        let filtered;
        if (req.user.role === 'client') {
            filtered = apptsRaw.filter(a => a.owner_id === req.user.id).map(a => ({
                ...a,
                pet_name: pets[a.pet_id]?.name || 'Unknown',
                staff_name: users[a.assigned_to]?.name || null,
            }));
        } else if (req.user.role === 'staff') {
            filtered = apptsRaw
                .filter(a => !a.assigned_to || a.assigned_to === req.user.id)
                .map(a => ({
                    ...a,
                    owner_name: users[a.owner_id]?.name || 'Unknown',
                    pet_name: pets[a.pet_id]?.name || 'Unknown',
                    staff_name: users[a.assigned_to]?.name || null,
                }));
        } else {
            filtered = apptsRaw.map(a => ({
                ...a,
                owner_name: users[a.owner_id]?.name || 'Unknown',
                pet_name: pets[a.pet_id]?.name || 'Unknown',
                staff_name: users[a.assigned_to]?.name || null,
            }));
        }

        res.json(filtered);
    } catch (e) {
        console.error('Get appointments error', e);
        res.status(500).json({ message: 'Server error' });
    }
});

// Assign Appointment (FIRESTORE)
app.put('/api/appointments/:id/assign', authenticateToken, authorizeRole(['staff', 'admin']), async (req, res) => {
    try {
        const apptRef = db.collection('appointments').doc(req.params.id);
        const doc = await apptRef.get();
        if (!doc.exists) return res.status(404).json({ message: 'Appointment not found' });

        const data = doc.data();
        if (req.user.role === 'staff' && data.assigned_to && data.assigned_to !== req.user.id) {
            return res.status(403).json({ message: 'Already assigned to another staff member.' });
        }

        await apptRef.update({ status: 'Confirmed', assigned_to: req.user.id });

        await db.collection('audit_logs').add({
            user_email: req.user.email,
            action: 'APPT_ASSIGN',
            details: `Staff assigned self to appt #${req.params.id}`,
            timestamp: new Date().toISOString(),
        });

        res.json({ message: 'Assigned successfully', staff_name: req.user.name });
    } catch (e) {
        console.error('Assign appointment error', e);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/appointments', authenticateToken, async (req, res) => {
    const { pet_id, date, time, reason } = req.body;
    try {
        const petRef = db.collection('pets').doc(String(pet_id));
        const petDoc = await petRef.get();
        if (!petDoc.exists || petDoc.data().owner_id !== req.user.id) {
            return res.status(403).json({ message: 'Invalid Pet' });
        }

        const apptRef = await db.collection('appointments').add({
            pet_id: String(pet_id),
            owner_id: req.user.id,
            date,
            time,
            reason,
            status: 'Pending',
            assigned_to: null,
        });
        await apptRef.update({ id: apptRef.id });
        res.json({ message: 'Requested', id: apptRef.id });
    } catch (e) {
        console.error('Create appointment error', e);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/pets', authenticateToken, async (req, res) => {
    const { name, type, breed, age, weight } = req.body;
    try {
        const petRef = await db.collection('pets').add({
            owner_id: req.user.id,
            name,
            type,
            breed,
            age,
            weight,
        });
        await petRef.update({ id: petRef.id });
        res.json({ message: 'Pet added', id: petRef.id });
    } catch (e) {
        console.error('Create pet error', e);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/pets', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'client') return res.json([]);
        const snap = await db.collection('pets').where('owner_id', '==', req.user.id).get();
        const pets = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        res.json(pets);
    } catch (e) {
        console.error('Get pets error', e);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/records', authenticateToken, authorizeRole(['staff', 'admin']), async (req, res) => {
    try {
        const snap = await db.collection('medical_records').get();
        const records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const decrypted = records.map(r => ({ ...r, notes: decrypt({ iv: r.iv, content: r.notes_encrypted }) }));
        res.json(decrypted);
    } catch (e) {
        console.error('Get records error', e);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/records', authenticateToken, authorizeRole(['staff', 'admin']), async (req, res) => {
    const { pet_id, date, diagnosis, treatment, notes } = req.body;
    try {
        const enc = encrypt(notes);
        const recRef = await db.collection('medical_records').add({
            pet_id: String(pet_id),
            date,
            diagnosis,
            treatment,
            notes_encrypted: enc.content,
            iv: enc.iv,
        });
        await recRef.update({ id: recRef.id });
        res.json({ message: 'Saved' });
    } catch (e) {
        console.error('Create record error', e);
        res.status(500).json({ message: 'Server error' });
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));