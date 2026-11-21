// Real Chrome tests. No test results or student data are sent to Apps Script.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {createRequire}=require('module');
const req=createRequire(path.join(process.env.LOCALAPPDATA,'Temp/opencode/lan10-tools/package.json'));
const {chromium}=req('playwright-core');
const ROOT=path.resolve(__dirname,'../..');
const OUT=path.join(process.env.LOCALAPPDATA,'Temp/opencode/lan10-render');
const LIVE=process.argv.includes('--live');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8','.css':'text/css','.png':'image/png',
  '.svg':'image/svg+xml','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document'};
const readExam=i=>JSON.parse(fs.readFileSync(path.join(ROOT,`data/tests/on-tap-lan10-de-${i}.json`),'utf8'));

async function main(){
  let server,browser;
  const failures=[],results=[];
  try{
    let base='https://kimkenpkl.github.io/phongthi247/';
    if(!LIVE){
      server=http.createServer((req,res)=>{
        let file;
        try{file=path.resolve(ROOT,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));}
        catch{res.writeHead(400).end();return;}
        if(!file.startsWith(ROOT+path.sep)&&file!==ROOT){res.writeHead(403).end();return;}
        if(file===ROOT||fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
        fs.readFile(file,(err,data)=>{
          if(err){res.writeHead(404).end();return;}
          res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream',
            'Cache-Control':'no-store'}).end(data);
        });
      });
      await new Promise(r=>server.listen(0,'127.0.0.1',r));
      base=`http://127.0.0.1:${server.address().port}/`;
    }
    browser=await chromium.launch({headless:true,
      executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
    const context=await browser.newContext({viewport:{width:1280,height:900}});
    await context.route(/https:\/\/script\.google(?:usercontent)?\.com\/.*/,r=>r.abort());
    // Keep all testing local even on the production static site.
    const page=await context.newPage();
    page.on('pageerror',e=>failures.push(e.message));
    await page.goto(base+'?qa=lan10',{waitUntil:'networkidle'});
    await page.waitForSelector('.exam-card');
    assert.equal(await page.locator('.exam-card').count(),4);
    for(let i=1;i<=4;i++){
      const exam=readExam(i);
      await page.goto(base+`thi.html?exam=${exam.id}&mode=practice&qa=lan10`,{waitUntil:'networkidle'});
      await page.waitForSelector('#enterArea',{state:'visible'});
      await page.locator('#inpName').fill('Kiểm thử nội bộ');
      await page.locator('#inpClass').fill('QA');
      await page.locator('#inpCode').fill(exam.code);
      const cam=page.locator('#chkCamProctor');
      if(await cam.count())await cam.uncheck();
      await page.locator('#btnStart').click();
      await page.waitForSelector('#qView .question');
      assert.equal(await page.locator('#palette button').count(),28);
      const grade=await page.evaluate(e=>{
        const correct={};
        e.questions.forEach((q,i)=>correct[i]=q.part===1?q.answerIndex:
          q.part===2?q.statements.map(s=>s.answer):String(q.answer).replace('.',','));
        const perfect=gradeExam(e,correct);
        const tf=e.questions.find(q=>q.part===2);
        const tiers=[0,1,2,3,4].map(n=>gradeQuestion(e,tf,
          tf.statements.map((s,i)=>i<n?s.answer:!s.answer)).got);
        return {score:perfect.score,max:perfect.max,tiers};
      },exam);
      assert.ok(Math.abs(grade.score-10)<1e-8);
      assert.equal(grade.max,10);
      assert.deepEqual(grade.tiers,[0,.1,.25,.5,1]);
      let images=0;
      for(let j=0;j<28;j++){
        await page.locator(`#palette button[data-k="${j}"]`).click();
        const data=await page.locator('#qView').evaluate(el=>({
          text:el.innerText,sub:el.querySelectorAll('sub').length,
          sup:el.querySelectorAll('sup').length,
          bad:el.querySelector('mjx-merror')!==null,
          overflow:document.documentElement.scrollWidth>window.innerWidth+1,
          imgs:[...el.querySelectorAll('img')].map(x=>({
            complete:x.complete&&x.naturalWidth>0,width:x.width,height:x.height,
            alt:x.alt,reserved:x.hasAttribute('width')&&x.hasAttribute('height')}))
        }));
        assert.ok(!data.bad&&!/\\ce\{|\[\[|<sub>|<sup>|�/.test(data.text),`${i}/${j}: broken formula`);
        if(exam.questions[j].content.includes('<sub>'))assert.ok(data.sub>0);
        for(const img of data.imgs){
          if(!img.complete)await page.waitForFunction(()=>[...document.querySelectorAll('#qView img')].every(x=>x.complete&&x.naturalWidth));
          assert.ok(img.alt.length>15&&img.reserved);
          images++;
        }
      }
      // Mobile + dark theme, actual diagram and formula node checks.
      await page.setViewportSize({width:390,height:844});
      await page.evaluate(()=>document.documentElement.setAttribute('data-theme','dark'));
      const imageIndex=exam.questions.findIndex(q=>q.image);
      await page.locator(`#palette button[data-k="${imageIndex}"]`).click();
      await page.waitForFunction(()=>[...document.querySelectorAll('#qView img')].every(x=>x.complete&&x.naturalWidth));
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
      const imgBox=await page.locator('#qView img').boundingBox();
      assert.ok(imgBox.width<=390&&imgBox.width>200);
      await page.locator('#qView').screenshot({path:path.join(OUT,`${LIVE?'live':'local'}-de${i}-mobile.png`)});
      await page.setViewportSize({width:1280,height:900});
      await page.evaluate(()=>document.documentElement.setAttribute('data-theme','light'));
      results.push({exam:exam.id,questions:28,loadedImageQuestions:images,perfectScore:grade.score,part2Tiers:grade.tiers,mobileOverflow:false});
      for(const file of [exam.id+'-hs.docx',exam.id+'-dap-an.docx']){
        const response=await page.request.get(base+'data/docs/'+file);
        assert.equal(response.status(),200);
        assert.ok((await response.body()).length>10000);
      }
    }
    await page.goto(base+'thi.html?exam=de-cuong-hoa12-hk1',{waitUntil:'networkidle'});
    await page.waitForFunction(()=>document.body.innerText.includes('Đề đang tạm ẩn'));
    assert.equal(failures.length,0,failures.join('\n'));
    fs.writeFileSync(path.join(ROOT,'reports/lan10',LIVE?'browser-live.json':'browser-local.json'),
      JSON.stringify({base,results,hiddenLegacyBlocked:true,pageErrors:failures},null,2)+'\n');
    console.log(`PASS ${LIVE?'LIVE':'LOCAL'}: 4 cards; all 112 question screens; 10 image questions; mobile/dark; 8 Word downloads; full score and all TF tiers; old paper blocked.`);
  }finally{
    if(browser)await browser.close();
    if(server)await new Promise(r=>server.close(r));
  }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
