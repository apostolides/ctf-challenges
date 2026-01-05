import express from 'express';
import path from 'path';

const router = express.Router();
const publicPath = path.join(process.cwd(), "public");

router.get('/', (req, res) => {
    res.sendFile("index.html", { root: publicPath });
});

router.get('/login', (req, res) => {
    res.sendFile("login.html", { root: publicPath });
});

router.get('/register', (req, res) => {
    res.sendFile("register.html", { root: publicPath });
});

router.get('/home', (req, res) => {
    res.sendFile("home.html", { root: publicPath });
});

router.get('/new-note', (req, res) => {
    res.sendFile("new-note.html", { root: publicPath });
});

router.get('/notes', (req, res) => {
    res.sendFile("notes.html", { root: publicPath });
});


export default router;
