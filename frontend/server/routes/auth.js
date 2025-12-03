const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');

const SECRET_KEY = process.env.JWT_SECRET || 'your_jwt_secret';

router.post('/register', (req, res) => {
    const { email, password, name } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 8);

    db.run(`INSERT INTO users (email, password, name) VALUES (?, ?, ?)`, [email, hashedPassword, name], function (err) {
        if (err) {
            return res.status(500).send({ message: 'User registration failed.', error: err.message });
        }
        res.status(200).send({ message: 'User registered successfully.', userId: this.lastID });
    });
});

router.post('/login', (req, res) => {
    const { email, password } = req.body;

    db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
        if (err) return res.status(500).send({ message: 'Error on the server.' });
        if (!user) return res.status(404).send({ message: 'User not found.' });

        const passwordIsValid = bcrypt.compareSync(password, user.password);
        if (!passwordIsValid) return res.status(401).send({ token: null, message: 'Invalid password!' });

        const token = jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: 86400 }); // 24 hours

        res.status(200).send({
            id: user.id,
            name: user.name,
            email: user.email,
            accessToken: token
        });
    });
});

module.exports = router;
