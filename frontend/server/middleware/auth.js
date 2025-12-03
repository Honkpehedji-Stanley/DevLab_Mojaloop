const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const token = req.headers['authorization'];

    if (!token) {
        return res.status(403).send({ message: 'No token provided!' });
    }

    // Remove Bearer prefix if present
    const tokenString = token.startsWith('Bearer ') ? token.slice(7, token.length) : token;

    jwt.verify(tokenString, process.env.JWT_SECRET || 'your_jwt_secret', (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: 'Unauthorized!' });
        }
        req.userId = decoded.id;
        next();
    });
};

module.exports = verifyToken;
