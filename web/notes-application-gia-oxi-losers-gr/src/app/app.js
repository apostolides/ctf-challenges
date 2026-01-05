import express from 'express';
import dotenv from "dotenv";
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRouter from './auth/auth.router.js';
import indexRouter from './misc/index.router.js';
import notFoundRouter from './misc/notFound.router.js';
import profileRouter from './profile/profile.router.js';
import notesRouter from './notes/notes.router.js';
import adminRouter from './admin/report.router.js';

dotenv.config();
const app = express();

app.use(cors({origin: `http://localhost:${process.env.PORT}`}));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(express.static("public"));
app.use('/profile', profileRouter);
app.use('/notes', notesRouter);
app.use('/auth', authRouter);
app.use('/admin', adminRouter);
app.use('/', indexRouter);
app.use(notFoundRouter);

app.use(function (err, req, res, next) {
    if(err){
        console.error(err);
        return res.status(500).json(err);
    }
});

app.listen(process.env.PORT, ()=>{
    console.log(`[*] App is running on port: ${process.env.PORT}`);
});
