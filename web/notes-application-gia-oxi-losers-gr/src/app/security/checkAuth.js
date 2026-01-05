import jwt from "jsonwebtoken";

function checkAuth(req, res, next) {
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).json({ message: "Not authenticated." });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        res.locals.userInfo = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ message: "Invalid or expired token." });
    }
}

export default checkAuth;
