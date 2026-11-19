import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';const audit=JSON.parse(readFileSync('BASE-3.6.2-AUDIT.json','utf8'));for(const [file,sha]of Object.entries(audit.unchangedFiles))assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),sha,file);console.log('PASS all audited 3.6.2 files preserved.');

for(const [file,value]of Object.entries(audit.startVideoChanges||{}))assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),value.currentSha256,file);

for(const [file,value]of Object.entries(audit.captionStateChanges||{}))assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),value.currentSha256,file);

for(const [file,value]of Object.entries(audit.upgrade371Changes||{}))assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),value.currentSha256,file);

for(const [file,value]of Object.entries(audit.publishAudit372Changes||{}))assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),value.currentSha256,file);

for(const [file,value]of Object.entries(audit.crossPublic380Changes||{}))assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),value.currentSha256,file);
