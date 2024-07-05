import express from "express";
const router = express.Router();
import bodyParser from 'body-parser';
import db from '../lib/database.js';

const highScoreSchema = new db.Schema({
    name: String,
    cloud: String,
    zone: String,
    host: String,
    score: Number,
    level: Number,
    date: Date,
    referer: String,
    user_agent: String,
    hostname: String,
    ip_addr: String
});

const Highscore = new db.model('Highscore', highScoreSchema);

// create application/x-www-form-urlencoded parser
const urlencodedParser = bodyParser.urlencoded({ extended: false })

// middleware that is specific to this router
router.use(function timeLog (req, res, next) {
    console.log('Time: ', Date());
    next();
})

router.get('/list', urlencodedParser, async function(req, res, next) {
    console.log('[GET /highscores/list]');

    Highscore.find()
        .sort({score: -1})
        .limit(10)
        .then(docs => {
            let response = [];
            docs.forEach( item => {
                response.push({ name: item['name'], 
                                cloud: item['cloud'],
                                zone: item['zone'], 
                                host: item['host'],
                                score: item['score'] 
                            });
            });

        res.json(response);
    });
});

// Accessed at /highscores
router.post('/', urlencodedParser, async function(req, res, next) {
    console.log('[POST /highscores] body =', JSON.stringify(req.body),
                ' host =', req.headers.host,
                ' user-agent =', req.headers['user-agent'],
                ' referer =', req.headers.referer);

    let userScore = parseInt(req.body.score, 10),
        userLevel = parseInt(req.body.level, 10);

    let highscore = new Highscore({
        name: req.body.name,
        cloud: req.body.cloud,
        zone: req.body.zone,
        host: req.body.host,
        score: userScore,
        level: userLevel,
        date: Date(),
        referer: req.headers.referer,
        user_agent: req.headers['user-agent'],
        hostname: req.hostname,
        ip_addr: req.ip
    });

    await highscore.save();

    res.json({
        name: req.body.name,
        zone: req.body.zone,
        score: userScore,
        level: userLevel,
        rs: "ok"
    });
});

export default router
