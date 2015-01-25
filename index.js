'use strict';

var request = require('request');
var express = require('express');
var app = express();
var util = require('util');

var BASE_URL = 'http://translate.google.com/translate_tts?q=%s&tl=%s';

module.exports = function(nodecg) {
    var log = nodecg.log;

    app.get('/mmcn-google-tts/tts', function(req, res) {
        var text = req.query.text || '';
        var language = req.query.lang || 'en';

        log.debug('text:', text, 'language:', language);

        var url = util.format(BASE_URL, text, language);

        var speech = request.get(url);

        speech.pipe(res);
    });

    return app;
};
