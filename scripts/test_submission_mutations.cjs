'use strict';
// Mutate disposable copies only; never changes the working tree.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const temp=fs.mkdtempSync(path.join(process.env.LOCALAPPDATA?path.join(process.env.LOCALAPPDATA,'Temp','opencode'):os.tmpdir(),'submission-mutation-'));
try{
 for(const dir of ['assets','apps-script','scripts'])fs.mkdirSync(path.join(temp,dir));
 const files=['assets/common.js','apps-script/Code.gs','apps-script/Submission.gs','apps-script/ExamRegistry.gs','scripts/test_submission_client.cjs','scripts/test_submission_hardening.cjs'];
 for(const file of files)fs.copyFileSync(path.join(root,file),path.join(temp,file));
 for(const [file,before,after,test] of [
   ['assets/common.js','ack.revision !== p.revision','false','scripts/test_submission_client.cjs'],
   ['apps-script/Submission.gs',"if (!scope) fail_('unauthorized');","if (false) fail_('unauthorized');",'scripts/test_submission_hardening.cjs'],
   ['apps-script/Submission.gs',"same[0][ix('Submission hash')] !== d.submissionHash","false",'scripts/test_submission_hardening.cjs']
 ]){
   const original=fs.readFileSync(path.join(root,file),'utf8');assert.ok(original.includes(before));
   fs.writeFileSync(path.join(temp,file),original.replace(before,after));
   const run=spawnSync(process.execPath,[test],{cwd:temp,encoding:'utf8',timeout:15000});
   assert.equal(run.error,undefined);assert.notEqual(run.status,0,'Mutation survived: '+before);
   assert.match(run.stderr,/AssertionError/,'Must fail an assertion, not syntax/runtime setup');
   console.log('PASS mutation caught: '+before);
   fs.writeFileSync(path.join(temp,file),original);
 }
}finally{fs.rmSync(temp,{recursive:true,force:true});}
