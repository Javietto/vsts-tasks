
import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');
import fs = require('fs');
var Readable = require('stream').Readable
var Stats = require('fs').Stats

var nock = require('nock');

let taskPath = path.join(__dirname, '..', 'vsmobilecenterupload.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('serverEndpoint', 'MyTestEndpoint');
tmr.setInput('appSlug', 'testuser/testapp');
tmr.setInput('app', '/test/path/to/my.ipa');
tmr.setInput('releaseNotesSelection', 'releaseNotesInput');
tmr.setInput('releaseNotesInput', 'my release notes');
tmr.setInput('symbolsType', 'AndroidJava');
tmr.setInput('mappingTxtPath', '/test/path/to/mappings.txt');

//prepare upload
nock('https://example.test')
    .post('/v0.1/apps/testuser/testapp/package_uploads')
    .reply(201, {
        upload_id: 1,
        upload_url: 'https://example.upload.test/package_upload'
    });

//upload 
nock('https://example.upload.test')
    .post('/package_upload')
    .reply(201, {
        status: 'success'
    });

//finishing upload, commit the package
nock('https://example.test')
    .patch("/v0.1/apps/testuser/testapp/package_uploads/1", {
        status: 'committed'
    })
    .reply(200, {
        package_url: 'my_package_location' 
    });

//make it available
nock('https://example.test')
    .patch("/my_package_location", {
        status: "available",
        distribution_group_id:"00000000-0000-0000-0000-000000000000",
        release_notes:"my release notes"
    })
    .reply(200);

//begin symbol upload
nock('https://example.test')
    .post('/v0.1/apps/testuser/testapp/symbol_uploads', {
        symbol_type: "AndroidJava"
    })
    .reply(201, {
        symbol_upload_id: 100,
        upload_url: 'https://example.upload.test/symbol_upload',
        expiration_date: 1234567
    });

//upload symbols
nock('https://example.upload.test')
    .put('/symbol_upload')
    .reply(201, {
        status: 'success'
    });

//finishing symbol upload, commit the symbol 
nock('https://example.test')
    .patch("/v0.1/apps/testuser/testapp/symbol_uploads/100", {
        status: 'committed'
    })
    .reply(200);

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "checkPath" : {
        "/test/path/to/my.ipa": true
    }
};
tmr.setAnswers(a);

tmr.registerMock('./utils.js', {
    resolveSinglePath: function(s) {
        return s ? s : null;
    },
    checkAndFixFilePath: function(p, name) {
        return p;
    }
});

fs.createReadStream = (s) => {
    let stream = new Readable;
    stream.push(s);
    stream.push(null);

    return stream;
};

fs.statSync = (s) => {
    let stat = new Stats;
    stat.isFile = () => {
        return true;
    }

    return stat;
}
tmr.registerMock('fs', fs);

tmr.run();

