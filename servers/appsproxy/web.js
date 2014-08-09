
var express    = require('express'),
    config     = require('./conf'),
    middleware = require('./lib/middleware'),
    stats      = require('./lib/stats');

var argv       = require('minimist')(process.argv);
var KONFIG     = require('koding-config-manager').load("main."+argv.c);
var fs         = require('fs');
var http       = require('http');
var request    = require('request');

console.log("heoloo")

var app = express();

app.disable('x-powered-by');

if (app.get('env') === 'development') {
    app.use(express.responseTime());
    app.use(express.logger('tiny'));
}

app.use(express.static(config.publicDir, {maxAge: 300000}));

// Global middleware to set some security-related headers.
app.use(function (req, res, next) {


    var allow = "https://koding.com";

    var allowed, _ref,
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

    allowed = ["http://lvh.me:3020", "http://lvh.me:8090/*","http://lvh.me:8090/appsproxy/*", "http://localhost:3500", "https://latest.koding.com/*", "https://koding.com/*"];

    if (_ref = req.headers.origin, __indexOf.call(allowed, _ref) >= 0) { allow = req.headers.origin;}

    var _ref, _ref1;


    res.set({
        'X-Content-Type-Options'     : 'nosniff',
        'Access-Control-Allow-Origin': allow
    });

    if (req.url.indexOf("/appsproxy") > -1) {
      a = (req.url.replace("/appsproxy", ""));
      a = "http://localhost:"+KONFIG.appsproxy.port+a

      request(a).pipe(res)

    }
     else
    {
      next();
    }
});

app.use(app.router);

// -- Routes -------------------------------------------------------------------

// Don't allow requests for Google Webmaster Central verification files, because
// rawgithub.com isn't a hosting provider and people can't own URLs under its
// domain.
app.get('*/google[0-9a-f]{16}.html',
    middleware.error403);

// Public or private gist.
// Gist raw domain changed on 2014-02-21:
// http://developer.github.com/changes/2014-02-21-gist-raw-file-url-change/
app.get(/^\/[0-9A-Za-z-]+\/[0-9a-f]+\/raw\//,
    middleware.stats,
    middleware.blacklist,
    middleware.noRobots,
    middleware.fileRedirect('https://gist.githubusercontent.com'),
    middleware.proxyPath('https://gist.githubusercontent.com'));

// Repo file.
app.get('/:user/:repo/:branch/*',
    middleware.stats,
    middleware.blacklist,
    middleware.noRobots,
    middleware.fileRedirect('https://raw.githubusercontent.com'),
    middleware.proxyPath('https://raw.githubusercontent.com'));

// Stats API.
app.get('/api/stats', function (req, res, next) {
    var count = Math.max(0, Math.min(20, req.query.count || 10));

    res.set('Cache-Control', 'private, no-cache, no-store, max-age=0, must-revalidate');

    res.jsonp({
        status: 'success',

        data: {
            since    : stats.since(),
            files    : stats.files().slice(0, count),
            referrers: stats.referrers().slice(0, count)
        }
    });
});

// -- Error handlers -----------------------------------------------------------
app.use(function (req, res, next) {
    res.status(404);

    res.set('Cache-Control', 'public, max-age=300'); // 5 minutes

    if (req.accepts('html')) {
        res.sendfile(config.publicDir + '/errors/404.html');
        return;
    }

    if (req.accepts('json')) {
        res.send({error: 'Not found.'});
        return;
    }

    res.type('txt').send('Not found.');
});

app.use(function (err, req, res, next) {
    console.error(err.stack);

    res.status(err.status || 500);

    if (req.accepts('html')) {
        res.sendfile(config.publicDir + '/errors/500.html');
        return;
    }

    if (req.accepts('json')) {
        res.send({error: '500 Internal Server Error'});
        return;
    }

    res.type('txt').send('Internal Server Error');
});

// -- Server -------------------------------------------------------------------
/*
var port = process.env.PORT || 80;

app.listen(port, function () {
    console.log('Listening on port ' + port);
});
*/

var httpServer = http.createServer(app);

httpServer.listen(KONFIG.appsproxy.port);



