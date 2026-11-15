'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),O=require('../assets/omr-engine.js');
function image(p,values={},corners=p.anchors,lighting=1){
  const w=p.width,h=p.height,data=new Uint8ClampedArray(w*h*4),map=O.transform(p.anchors,corners);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const k=(y*w+x)*4,v=Math.round(255*lighting*(.82+.18*x/w));data[k]=data[k+1]=data[k+2]=v;data[k+3]=255;}
  function dot(cx,cy,r,value){for(let y=Math.floor(cy-r);y<=cy+r;y++)for(let x=Math.floor(cx-r);x<=cx+r;x++)if(x>=0&&x<w&&y>=0&&y<h&&(x-cx)**2+(y-cy)**2<=r*r){const k=(y*w+x)*4;data[k]=data[k+1]=data[k+2]=value;}}
  p.anchors.forEach(a=>{const [x,y]=map(...a);for(let yy=Math.round(y-12);yy<y+12;yy++)for(let xx=Math.round(x-12);xx<x+12;xx++)if(xx>=0&&yy>=0&&xx<w&&yy<h){const k=(yy*w+xx)*4;data[k]=data[k+1]=data[k+2]=0;}});
  for(const g of p.groups)for(const b of g.bubbles)if([].concat(values[g.id]??[]).includes(b.value)){const [x,y]=map(b.x,b.y);dot(x,y,p.radius*.85,30);}
  return {width:w,height:h,data};
}
test('OMR profile validates counts, bounds and duplicate groups',()=>{
  assert.equal(O.profile().groups.length,76);
  assert.throws(()=>O.profile({p1:41,p2:0,p3:0}),/Số câu/);
  const p=O.profile();p.groups.push(p.groups[0]);assert.throws(()=>O.validateProfile(p),/trùng/);
});
test('Perspective homography maps all four anchors and rejects crossed corners',()=>{
  const p=O.profile(),to=[[70,80],[900,50],[950,1300],[55,1350]],map=O.transform(p.anchors,to);
  p.anchors.forEach((pt,i)=>map(...pt).forEach((v,j)=>assert.ok(Math.abs(v-to[i][j])<1e-6)));
  assert.throws(()=>O.validateCorners([to[0],to[2],to[1],to[3]],1000,1414),/chéo|thứ tự/);
});
test('OMR detects fiducials and reads id/code, MCQ, true/false, signed decimal and blank',()=>{
  const p=O.profile({p1:4,p2:1,p3:1}),values={};
  '00000007'.split('').forEach((v,i)=>values['id.'+i]=v);'0101'.split('').forEach((v,i)=>values['code.'+i]=v);
  Object.assign(values,{'I.1':'C','I.2':'B','I.3':['A','D'],'II.1.0':'D','II.1.1':'S','II.1.2':'D','II.1.3':'S','III.1.0':'-','III.1.1':'2','III.1.2':',','III.1.3':'5'});
  const img=image(p,values),corners=O.detect(img);assert.ok(corners);const r=O.scan(img,p,corners);
  assert.equal(r.id,'00000007');assert.equal(r.code,'0101');assert.equal(r.answers['I.1'],'C');assert.equal(r.answers['I.2'],'B');assert.equal(r.answers['I.3'],'');assert.equal(r.groups.find(g=>g.id==='I.3').state,'multiple');assert.equal(r.answers['I.4'],'');assert.equal(r.answers['II.1'],'DSDS');assert.equal(r.answers['III.1'],'-2,5');
});
test('OMR reads perspective image under uneven dim illumination',()=>{
  const p=O.profile({p1:1,p2:0,p3:0}),corners=[[70,80],[900,50],[950,1300],[55,1350]],img=image(p,{'I.1':'D'},corners,.70);
  assert.equal(O.scan(img,p,corners).answers['I.1'],'D');
});
test('OMR blank/multiple/faint classification and out-of-image checks',()=>{
  assert.equal(O.classify([0,.03,0,0]).state,'blank');assert.equal(O.classify([.6,.7,0,0]).state,'multiple');assert.equal(O.classify([.28,0,0,0]).state,'faint');
  assert.equal(O.detect(image(O.profile({p1:1,p2:0,p3:0}),{},[[0,0],[1,0],[1,1],[0,1]])),null);
  const p=O.profile({p1:1,p2:0,p3:0}),img=image(p);assert.throws(()=>O.scan(img,p,[[5,5],[990,5],[990,1400],[5,1400]],{threshold:NaN}),/Ngưỡng/);
});
test('OMR preserves internal gaps in short answers and rejects incompatible group values',()=>{
  const p=O.profile({p1:0,p2:0,p3:1}),img=image(p,{'III.1.0':'1','III.1.2':'5'});
  assert.equal(O.scan(img,p,p.anchors).answers['III.1'],'1?5');
  p.groups[0].bubbles[0].value='A';assert.throws(()=>O.validateProfile(p),/giá trị sai/);
});
