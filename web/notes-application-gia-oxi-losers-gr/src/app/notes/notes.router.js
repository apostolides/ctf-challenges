import { Router } from "express";
import { users } from "../data/users.js";
import checkAuth from "../security/checkAuth.js";

const router = Router();

router.use(checkAuth);

router.get("/view/:noteid", (req, res) => {
    const { noteid } = req.params;
    const { id: currentUserId, role } = res.locals.userInfo;

    const numericId = Number(noteid);

    if (isNaN(numericId)) {
        return res.status(400).json({ message: "Invalid note id." });
    }

    let foundUser = null;
    let foundNote = null;

    for (const user of users) {
        const note = user.notes.find(n => n.noteid === numericId);

        if (note) {
            foundUser = user;
            foundNote = note;
            break;
        }
    }

    if (!foundNote) {
        return res.status(404).json({ message: "Note not found." });
    }

    if (role !== "admin" && foundUser.id !== currentUserId) {
        return res.status(403).json({ message: "Forbidden: You do not own this note." });
    }

    return res.json({
        note: {
            noteid: foundNote.noteid,
            content: foundNote.content,
            ownerId: foundUser.id
        }
    });
});

export default router;
