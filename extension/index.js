const request = require('request');
const express = require('express');
const app = express();
const fs = require('fs');
const util = require('util');
const tmp = require('tmp');

const BASE_URL = 'http://translate.google.com/translate_tts?ie=UTF-8&total=1&idx=0&client=tw-ob&q=%s&textlen=%s&tl=%s';
const MAX_CHARS_PER_REQUEST = 100;

let log;

function splitText(text, maxChars) {
    maxChars = maxChars || MAX_CHARS_PER_REQUEST;
    if (text.length <= maxChars) return [text];

    const textSlices = [];
    let start = 0;

    do {
        let fromStart = text.slice(start);
        while (fromStart.startsWith(' ')) {
            start += 1;
            fromStart = text.slice(start);
        }

        let spaceIndex = maxChars;
        if (fromStart.length > 100) {
            const maxSlice = fromStart.slice(0, maxChars);
            spaceIndex = maxSlice.lastIndexOf(' ');
            if(spaceIndex === -1) {
                spaceIndex = maxChars;
            }
        }

        const slice = fromStart.slice(0, spaceIndex);
        start += slice.length;
        textSlices.push(slice);
    } while(text.length > start);

    return textSlices;
}

function getUrls(textSlices, language) {
    return textSlices.map(slice => util.format(BASE_URL, encodeURIComponent(slice), slice.length, language));
}

function getSpeech(urls, cb) {
    log.debug('Getting urls');
    tmp.file((err, path) => {
        if (err) {
            log.error('Error making tmp file', err);
            return cb(err, null);
        }
        const ws = fs.createWriteStream(path);

        ws.on('error', (err) => {
            log.error(err);
            throw new Error(err.stack);
        });

        const getUrl = () => {
            if (urls.length === 0) {
                return ws.end();
            }

            const url = urls.shift();
            log.debug(`Getting url ${url}`);
            request(url)
                .on('error', err => log.error(`Unable to get url ${url}`, err))
                .on('response', response => log.debug(`Response code ${response.statusCode}`))
                .on('end', function () {
                    getUrl();
                })
                .pipe(ws, {end: false});
        };

        getUrl();

        ws.on('finish', () => cb(null, path));
    });
}

module.exports = function(nodecg) {
    log = nodecg.log;

    app.get('/mmcn-google-tts/tts', (req, res) => {
        const text = req.query.text || '';
        const lang = req.query.lang || 'en';

        const textSlices = splitText(text);

        const urls = getUrls(textSlices, lang);

        getSpeech(urls, (err, path) => {
            nodecg.log.info(`Responding to TTS request with ${path}`);
            res.set('Content-Type', 'audio/mpeg');
            res.sendFile(path);
        });
    });

    nodecg.mount(app);
};
