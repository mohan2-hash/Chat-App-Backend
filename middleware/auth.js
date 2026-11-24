const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(401).json({ error: 'Access token required. Please include Authorization header.' });
    }

    // Support both 'Bearer <token>' and raw '<token>'
    let token = authHeader.trim();
    if (token.startsWith('Bearer ') || token.startsWith('bearer ')) {
        token = token.slice(7).trim();
    }

    if (!token) {
        return res.status(401).json({ error: 'Token missing from Authorization header' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key', (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token. Please log in again.' });
        }
        // Normalize payload: decoded might have userId or id
        const userId = decoded.userId || decoded.id;
        req.user = {
            ...decoded,
            userId,
            id: userId
        };
        next();
    });
};

module.exports = { authenticateToken };
