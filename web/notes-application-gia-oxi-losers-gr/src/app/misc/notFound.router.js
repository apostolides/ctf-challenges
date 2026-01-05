import express from 'express';

const router = express.Router();

router.get('/', async function(req, res, next) {
    return res.status(404).json({message: 'Not found.'});
});

export default router;

