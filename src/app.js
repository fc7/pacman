'use strict';

import express from "express";
import path from "path";
import {fileURLToPath} from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Routes
import routes from "./routes/index.js";

// App
const app = express();

// view engine setup
app.set('views', path.join(__dirname, '..', 'views'));
app.set('view engine', 'pug');

// Handle root web server's public directory
app.use('/', express.static(path.join(__dirname, '..', 'public')));

app.use('/', routes);

// Catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// Error Handler
app.use(function(err, req, res, next) {
    if (res.headersSent) {
        return next(err)
    }
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

const port = normalizePort(process.env.PORT || '8080');

app.listen(port, err => {
    if (err) {
      console.log(err);
      return process.exit(1);
    }
    console.log(`Server is running on ${port}`);
  });

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
    var port = parseInt(val, 10);

    if (isNaN(port)) {
        // named pipe
        return val;
    }

    if (port >= 0) {
        // port number
        return port;
    }

    return false;
}
