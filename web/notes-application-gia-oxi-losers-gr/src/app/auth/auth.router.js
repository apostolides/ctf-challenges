import { Router } from "express";
import jwt from "jsonwebtoken";
import { users } from "../data/users.js";

const router = Router();

router.post("/register", (req, res) => {
    const { username, password } = req.body;

    if (!username || !password){
        return res.status(400).json({ message: "Username and password required." });
    }

    if (typeof username !== "string" || typeof password !== "string") {
        return res.status(400).json({ message: "Username and password must be strings." });
    }

    const exists = users.find(u => u.username === username);

    if(exists){
        return res.status(409).json({ message: "User already exists." });
    }

    const newUser = {
        id: users.length + 1,
        username,
        password,
        role: "user",
        notes: []
    };

    users.push(newUser);

    return res.json({ message: "User registered.", user: newUser });

});

router.post("/login", (req, res) => {

    const { username, password } = req.body;

    const user = users.find(u => u.username === username && u.password === password);

    if (!user){
        return res.status(401).json({ message: "Invalid username or password." });
    }

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role}, process.env.JWT_SECRET, { expiresIn: "1h" });

    res.cookie("token", token, {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        maxAge: 1000 * 60 * 60
    });

    return res.json({ message: "Login successful."});

});

export default router;
