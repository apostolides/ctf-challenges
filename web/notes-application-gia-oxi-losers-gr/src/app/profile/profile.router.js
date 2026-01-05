import express from 'express';
import checkAuth from '../security/checkAuth.js';
import { users } from '../data/users.js';

const router = express.Router();

router.use(checkAuth);

router.get("/info", (req, res) => {
  return res.json({
    user: res.locals.userInfo
  });
});

router.post("/notes", (req, res) => {
  const { content } = req.body;

  if (!content || typeof content !== "string") {
    return res.status(400).json({ message: "Note content is required." });
  }

  const user = users.find(u => u.id === res.locals.userInfo.id);

  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  const newNote = {
    noteid: user.notes.length + 1,
    content
  };

  user.notes.push(newNote);

  return res.json({
    message: "Note saved.",
    note: newNote
  });
});


router.get("/notes", (req, res) => {
  const user = users.find(u => u.id === res.locals.userInfo.id);

  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  return res.json({
    notes: user.notes
  });

});

export default router;
