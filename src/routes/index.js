import { Router } from 'express';
import user from './user.js';
import highscores from './highscores.js';
import cloudmedatada from './location.js';
const router = Router();

router.use('/user', user);
router.use('/location', cloudmedatada);
router.use('/highscores', highscores);

export default router;