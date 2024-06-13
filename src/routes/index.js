import { Router } from 'express';
import user from './user.js';
import highscores from './highscores.js';
import location from './location.js';
const router = Router();

router.use('/user', user);
router.use('/location', location);
router.use('/highscores', highscores);

export default router;