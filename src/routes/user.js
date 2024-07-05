import express from "express";
const router = express.Router();
import bodyParser from 'body-parser';
import db from '../lib/database.js';

const userStatSchema = new db.Schema(
    {
        cloud: String,
        zone: String,
        host: String,
        score: Number,
        level: Number,
        lives: Number,
        elapsedTime: Number,
        date: Date,
        referer: String,
        user_agent: String,
        hostname: String,
        ip_addr: String,
        updateCounter: Number
    }
);

const UserStats = new db.model('UserStats', userStatSchema);
    

// create application/x-www-form-urlencoded parser
const urlencodedParser = bodyParser.urlencoded({ extended: false })

// middleware that is specific to this router
router.use(function timeLog (req, res, next) {
    console.log('Time: ', Date());
    next();
})

router.get('/id', async (req, res) => {
    console.log('[GET /user/id]');

    const emptyUserStats = new UserStats({
        date: Date()
    });

    emptyUserStats.save().then(doc => {
        res.json(doc._id);
    });

});

router.post('/stats', urlencodedParser, async (req, res, next) => {
    console.log('[POST /user/stats]\n',
                ' body =', JSON.stringify(req.body), '\n',
                ' host =', req.headers.host,
                ' user-agent =', req.headers['user-agent'],
                ' referer =', req.headers.referer);

    let userScore = parseInt(req.body.score, 10),
        userLevel = parseInt(req.body.level, 10),
        userLives = parseInt(req.body.lives, 10),
        userET = parseInt(req.body.elapsedTime, 10);

    let userStats = await UserStats.findById(req.body.userId).exec();
    userStats.cloud = req.body.cloud;
    userStats.zone = req.body.zone;
    userStats.host = req.body.host;
    userStats.score = userScore;
    userStats.level = userLevel;
    userStats.lives = userLives;
    userStats.elapsedTime = userET;
    userStats.date = Date();
    userStats.referer = req.headers.referer;
    userStats.user_agent = req.headers['user-agent'];
    userStats.hostname = req.hostname;
    userStats.ip_addr = req.ip;
    userStats.$inc('updateCounter', 1);
    
    await userStats.save().then(
        res.json({
            rs: "ok"
        })
    );
});

router.get('/stats', async (req, res, next) => {
    console.log('[GET /user/stats]');

    // Find all elements where the score field exists to avoid
    // undefined values
    UserStats.find({score: { $exists: true }}).sort({score: -1}).then(docs => {
        let resp = [];
        
        docs.forEach( item => {
            resp.push({
                            cloud: item['cloud'],
                            zone: item['zone'],
                            host: item['host'],
                            score: item['score'],
                            level: item['level'],
                            lives: item['lives'],
                            et: item['elapsedTime'],
                            txncount: item['updateCounter']
            });
        });

        res.json(resp);
    });
});

export default router
