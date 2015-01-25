'use strict';

var request = require('request');
var express = require('express');
var app = express();
var fs = require('fs');
var util = require('util');
var tmp = require('tmp');
require('string.prototype.startswith');

var BASE_URL = 'http://translate.google.com/translate_tts?q=%s&tl=%s';

var MAX_CHARS_PER_REQUEST = 100;

module.exports = function(nodecg) {
    app.get('/mmcn-google-tts/tts', function(req, res) {
        var text = req.query.text || '';
        var lang = req.query.lang || 'en';

        var textSlices = app._splitText(text);

        var urls = app._getUrls(textSlices, lang);

        app._getSpeech(urls, function(path) {
            res.set('Content-Type', 'audio/mpeg');
            res.sendFile(path);
        });
    });

    app.tts = function(text, lang, callback) {
        text = text || '';
        lang = lang || 'en';

        var textSlices = this._splitText(text);

        var urls = app._getUrls(textSlices, lang);

        app._getSpeech(urls, function(path) {
            callback && callback(path);
        });
    };

    app._splitText = function(text, maxChars) {
        text = text || '';
        maxChars = maxChars || MAX_CHARS_PER_REQUEST;

        if (text.length <= maxChars) return [text];

        var textSlices = [];
        var start = 0;

        do {
            var fromStart = text.slice(start);
            while (fromStart.startsWith(' ')) {
                start += 1;
                fromStart = text.slice(start);
            }

            var spaceIndex = maxChars;
            if (fromStart.length > 100) {
                var maxSlice = fromStart.slice(0, maxChars);
                spaceIndex = maxSlice.lastIndexOf(' ');
                if(spaceIndex === -1) {
                    spaceIndex = maxChars;
                }
            }

            var slice = fromStart.slice(0, spaceIndex);
            start += slice.length;
            textSlices.push(slice);
        } while(text.length > start);

        return textSlices;
    };

    app._getUrls = function(textSlices, language) {
        var urls = [];

        textSlices.forEach(function(slice) {
            urls.push(util.format(BASE_URL, encodeURIComponent(slice), language));
        });

        return urls;
    };

    app._getSpeech = function(urls, cb) {
        tmp.file(function(err, path, fd) {
            var ws = fs.createWriteStream(path);

            ws.on('error', function(err) {
                throw new Error(err.stack);
            });

            function getUrl() {
                if (!urls.length) {
                    ws.end();
                    return;
                }

                var url = urls.shift();

                request(url)
                    .on('end', function () {
                        getUrl();
                    })
                    .pipe(ws, {end: false});
            }

            getUrl();

            ws.on('finish', function() {
                cb(path);
            });
        });
    };

    return app;
};
