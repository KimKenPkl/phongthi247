/* Local optical mark recognition. Coordinates and image processing share one profile. */
(function(root){
  'use strict';
  const fail=(ok,message)=>{if(!ok)throw Error(message);};
  const digits='0123456789'.split('');
  function profile(counts={p1:24,p2:4,p3:6}){
    fail(counts&&Number.isInteger(counts.p1)&&counts.p1>=0&&counts.p1<=40&&Number.isInteger(counts.p2)&&counts.p2>=0&&counts.p2<=8&&Number.isInteger(counts.p3)&&counts.p3>=0&&counts.p3<=8&&counts.p1+counts.p2+counts.p3>0,'Số câu hỗ trợ: phần I 0–40, phần II 0–8, phần III 0–8; cần ít nhất một câu.');
    const p={app:'ptw-omr-profile',version:1,name:'PTW A4 · 3 phần',width:1000,height:1414,radius:5.5,
      anchors:[[40,40],[960,40],[960,1374],[40,1374]],groups:[],counts:{...counts}};
    const add=(id,values,x,y,dx,dy)=>p.groups.push({id,bubbles:values.map((value,i)=>({value,x:x+dx*i,y:y+dy*i}))});
    for(let c=0;c<8;c++)add('id.'+c,digits,110+c*35,180,0,17);
    for(let c=0;c<4;c++)add('code.'+c,digits,740+c*35,180,0,17);
    for(let q=0;q<counts.p1;q++)add('I.'+(q+1),['A','B','C','D'],112+Math.floor(q/10)*235,450+(q%10)*24,27,0);
    for(let q=0;q<counts.p2;q++)for(let a=0;a<4;a++)add('II.'+(q+1)+'.'+a,['D','S'],135+(q%4)*235,785+Math.floor(q/4)*112+a*22,30,0);
    for(let q=0;q<counts.p3;q++)for(let c=0;c<4;c++)add('III.'+(q+1)+'.'+c,['-',',',...digits],85+q*116+c*17,1100,0,18);
    return validateProfile(p);
  }
  function validateProfile(p){
    fail(p&&p.app==='ptw-omr-profile'&&p.version===1,'Mẫu phiếu không đúng phiên bản.');
    fail(Number.isFinite(p.width)&&p.width>=200&&p.width<=4000&&Number.isFinite(p.height)&&p.height>=200&&p.height<=6000,'Kích thước mẫu không hợp lệ.');
    fail(Number.isFinite(p.radius)&&p.radius>=2&&p.radius<=30,'Bán kính ô tô không hợp lệ.');
    fail(Array.isArray(p.anchors)&&p.anchors.length===4,'Cần bốn mốc theo thứ tự trái trên, phải trên, phải dưới, trái dưới.');
    p.anchors.forEach(a=>fail(Array.isArray(a)&&a.length===2&&a.every(Number.isFinite)&&a[0]>=0&&a[0]<=p.width&&a[1]>=0&&a[1]<=p.height,'Tọa độ mốc không hợp lệ.'));
    validateCorners(p.anchors,p.width+1,p.height+1);
    fail(p.name===undefined||(typeof p.name==='string'&&p.name.length<=100),'Tên mẫu quá dài hoặc không hợp lệ.');
    fail(Array.isArray(p.groups)&&p.groups.length>0&&p.groups.length<=400,'Số nhóm ô tô không hợp lệ.');
    const seen=new Set();
    p.groups.forEach(g=>{
      fail(g&&typeof g.id==='string'&&/^(id\.[0-7]|code\.[0-3]|I\.[1-9]\d?|II\.[1-8]\.[0-3]|III\.[1-8]\.[0-3])$/.test(g.id)&&!seen.has(g.id),'Tên nhóm ô tô sai hoặc trùng.');seen.add(g.id);
      fail(Array.isArray(g.bubbles)&&g.bubbles.length>=2&&g.bubbles.length<=12,'Nhóm phải có 2–12 ô tô.');
      const values=new Set();g.bubbles.forEach(b=>{fail(b&&typeof b.value==='string'&&/^[A-DS0-9,\-]$/.test(b.value)&&!values.has(b.value),'Giá trị ô tô sai hoặc trùng.');values.add(b.value);fail(Number.isFinite(b.x)&&Number.isFinite(b.y)&&b.x>=p.radius&&b.x<=p.width-p.radius&&b.y>=p.radius&&b.y<=p.height-p.radius,'Ô tô vượt ngoài phiếu.');});
      const expected=/^(id|code)\./.test(g.id)?digits:/^I\./.test(g.id)?['A','B','C','D']:/^II\./.test(g.id)?['D','S']:['-',',',...digits];
      fail(values.size===expected.length&&expected.every(v=>values.has(v)),'Nhóm '+g.id+' thiếu ô hoặc có giá trị sai.');
    });
    return p;
  }
  function solve(a,b){
    const m=a.map((r,i)=>[...r,b[i]]),n=b.length;
    for(let i=0;i<n;i++){
      let k=i;for(let j=i+1;j<n;j++)if(Math.abs(m[j][i])>Math.abs(m[k][i]))k=j;
      fail(Math.abs(m[k][i])>1e-10,'Bốn mốc bị trùng hoặc thẳng hàng.');[m[i],m[k]]=[m[k],m[i]];
      const d=m[i][i];for(let c=i;c<=n;c++)m[i][c]/=d;
      for(let j=0;j<n;j++)if(j!==i){const f=m[j][i];for(let c=i;c<=n;c++)m[j][c]-=f*m[i][c];}
    }return m.map(r=>r[n]);
  }
  function transform(from,to){
    const a=[],b=[];from.forEach(([x,y],i)=>{const [u,v]=to[i];a.push([x,y,1,0,0,0,-u*x,-u*y],[0,0,0,x,y,1,-v*x,-v*y]);b.push(u,v);});
    const h=solve(a,b);return (x,y)=>{const d=h[6]*x+h[7]*y+1;return [(h[0]*x+h[1]*y+h[2])/d,(h[3]*x+h[4]*y+h[5])/d];};
  }
  function validateCorners(corners,w,h){
    fail(Array.isArray(corners)&&corners.length===4,'Chọn đủ bốn mốc.');
    corners.forEach(c=>fail(Array.isArray(c)&&c.length===2&&c.every(Number.isFinite)&&c[0]>=0&&c[0]<w&&c[1]>=0&&c[1]<h,'Mốc ngoài ảnh.'));
    let sign=0,area=0;
    for(let i=0;i<4;i++){const a=corners[i],b=corners[(i+1)%4],c=corners[(i+2)%4],cross=(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);fail(Math.abs(cross)>w*h*.001,'Bốn mốc quá sát nhau.');if(!sign)sign=Math.sign(cross);fail(Math.sign(cross)===sign,'Mốc phải đi theo chu vi, không được chéo.');area+=a[0]*b[1]-b[0]*a[1];}
    fail(sign>0&&area/2>w*h*.08,'Phiếu quá nhỏ hoặc thứ tự mốc chưa đúng.');return corners;
  }
  const gray=(data,w,h,x,y)=>{x=Math.round(x);y=Math.round(y);if(x<0||y<0||x>=w||y>=h)return null;const i=(y*w+x)*4;return .2126*data[i]+.7152*data[i+1]+.0722*data[i+2];};
  function detect(image){
    const {width:w,height:h,data}=image,step=Math.max(1,Math.ceil(Math.max(w,h)/1000)),sw=Math.ceil(w/step),sh=Math.ceil(h/step),mask=new Uint8Array(sw*sh),seen=new Uint8Array(sw*sh);
    for(let y=0;y<sh;y++)for(let x=0;x<sw;x++)mask[y*sw+x]=gray(data,w,h,x*step,y*step)<90?1:0;
    const list=[],queue=new Int32Array(sw*sh);
    for(let i=0;i<mask.length;i++)if(mask[i]&&!seen[i]){
      let start=0,end=1,n=0,minx=sw,miny=sh,maxx=0,maxy=0;queue[0]=i;seen[i]=1;
      while(start<end){const k=queue[start++],x=k%sw,y=Math.floor(k/sw);n++;minx=Math.min(minx,x);miny=Math.min(miny,y);maxx=Math.max(maxx,x);maxy=Math.max(maxy,y);
        const adj=[x>0?k-1:-1,x<sw-1?k+1:-1,y>0?k-sw:-1,y<sh-1?k+sw:-1];for(const j of adj)if(j>=0&&mask[j]&&!seen[j]){seen[j]=1;queue[end++]=j;}}
      const bw=maxx-minx+1,bh=maxy-miny+1,fill=n/(bw*bh);
      if(bw>=Math.max(4,sw*.009)&&bh>=Math.max(4,sh*.006)&&bw<sw*.075&&bh<sh*.075&&bw/bh>.55&&bw/bh<1.8&&fill>.70)list.push({x:(minx+maxx)*step/2,y:(miny+maxy)*step/2,n});
    }
    const regions=[p=>p.x<w*.40&&p.y<h*.35,p=>p.x>w*.60&&p.y<h*.35,p=>p.x>w*.60&&p.y>h*.65,p=>p.x<w*.40&&p.y>h*.65];
    const targets=[[0,0],[w,0],[w,h],[0,h]];
    const corners=regions.map((r,i)=>list.filter(r).sort((a,b)=>Math.hypot(a.x-targets[i][0],a.y-targets[i][1])-Math.hypot(b.x-targets[i][0],b.y-targets[i][1]))[0]).map(p=>p?[p.x,p.y]:null);
    if(corners.some(c=>!c))return null;try{return validateCorners(corners,w,h);}catch{return null;}
  }
  function classify(scores,threshold=.22,gap=.12){
    const sorted=scores.map((v,i)=>({v,i})).sort((a,b)=>b.v-a.v),a=sorted[0],b=sorted[1];
    if(a.v<threshold)return {index:-1,state:a.v>threshold*.65?'faint':'blank',confidence:a.v};
    if(b.v>=threshold||a.v-b.v<gap)return {index:-1,state:'multiple',confidence:a.v-b.v};
    return {index:a.i,state:a.v<threshold+.13?'faint':'marked',confidence:a.v-b.v};
  }
  function scan(image,p,corners,options={}){
    validateProfile(p);const {width:w,height:h,data}=image;fail(w>=200&&h>=200&&data&&data.length===w*h*4,'Ảnh không đủ dữ liệu hoặc quá nhỏ.');validateCorners(corners,w,h);
    const map=transform(p.anchors,corners),threshold=options.threshold??.22;fail(Number.isFinite(threshold)&&threshold>=.08&&threshold<=.8,'Ngưỡng tô không hợp lệ.');
    let clipped=0,background=0;
    const groups=p.groups.map(g=>{
      const scores=g.bubbles.map(b=>{
        let ink=0,inside=0,paper=0,outside=0;
        for(let dy=-1.6;dy<=1.6;dy+=.25)for(let dx=-1.6;dx<=1.6;dx+=.25){const d=dx*dx+dy*dy;if(d>.45*.45&&(d<1.25*1.25||d>1.6*1.6))continue;
          const [x,y]=map(b.x+dx*p.radius,b.y+dy*p.radius),v=gray(data,w,h,x,y);if(v===null){clipped++;continue;}if(d<=.45*.45){ink+=v;inside++;}else{paper+=v;outside++;}}
        const bg=outside?paper/outside:255; background+=bg;
        return inside?Math.max(0,(bg-ink/inside)/Math.max(40,bg)):0;
      });const c=classify(scores,threshold);return {id:g.id,scores,...c,value:c.index>=0?g.bubbles[c.index].value:''};
    });
    fail(!clipped,'Một số ô tô nằm ngoài ảnh. Chọn lại mốc hoặc chụp đầy đủ phiếu.');
    const values=Object.fromEntries(groups.map(g=>[g.id,g.value])),answers={};
    for(const g of groups){if(/^I\./.test(g.id))answers[g.id]=g.value;
      else if(/^(II|III)\./.test(g.id)){const [part,q]=g.id.split('.'),id=part+'.'+q;if(!(id in answers))answers[id]=Array(4).fill(part==='II'?'?':'');const col=Number(g.id.split('.')[2]);answers[id][col]=g.value||(part==='II'?'?':'');}}
    for(const k in answers)if(Array.isArray(answers[k])){
      const cells=answers[k];
      if(k.startsWith('III.')){while(cells.length&&!cells[cells.length-1])cells.pop();answers[k]=cells.map(v=>v||'?').join('');}
      else answers[k]=cells.join('');
    }
    return {id:Array.from({length:8},(_,i)=>values['id.'+i]||'?').join(''),code:Array.from({length:4},(_,i)=>values['code.'+i]||'?').join(''),answers,groups,quality:{background:background/p.groups.reduce((n,g)=>n+g.bubbles.length,0),review:groups.filter(g=>g.state!=='marked'&&g.state!=='blank').length},corners};
  }
  function sheet(p,filled={}){
    validateProfile(p);const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    let s=`<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" viewBox="0 0 ${p.width} ${p.height}"><rect width="100%" height="100%" fill="white"/><g fill="black" font-family="Arial,sans-serif">`;
    const text=(x,y,v,size=14)=>{s+=`<text x="${x}" y="${y}" font-size="${size}">${esc(v)}</text>`;};
    p.anchors.forEach(([x,y])=>{s+=`<rect x="${x-12}" y="${y-12}" width="24" height="24"/>`;});
    text(90,80,'PHÒNG THI 24/7 · PHIẾU TRẢ LỜI',25);text(90,108,'Họ tên: ..........................................  Lớp: .................',18);text(90,136,'Tô kín ô, không gạch chéo. Giữ đủ bốn mốc đen. Mẫu PTW A4 v1.',13);
    text(100,160,'SỐ BÁO DANH · 8 chữ số');text(720,160,'MÃ ĐỀ · 4 chữ số');text(75,410,'PHẦN I · Chọn một đáp án',20);text(75,752,'PHẦN II · Đúng / Sai',20);text(75,1060,'PHẦN III · Tối đa 4 ký tự, căn trái',20);
    p.groups.forEach(g=>{
      const first=g.bubbles[0],isChoice=/^I\./.test(g.id),isTF=/^II\./.test(g.id),isNum=/^III\./.test(g.id);
      if(isChoice)text(first.x-35,first.y+4,g.id.slice(2),13);
      if(isTF){const [,q,a]=g.id.split('.');text(first.x-55,first.y+4,q+String.fromCharCode(97+Number(a)),13);}
      if(isNum&&g.id.endsWith('.0'))text(first.x-5,first.y-20,'Câu '+g.id.split('.')[1],13);
      g.bubbles.forEach(b=>{const selected=filled[g.id]===b.value;s+=`<circle cx="${b.x}" cy="${b.y}" r="${p.radius}" stroke="black" stroke-width=".8" fill="${selected?'black':'white'}"/>`;if(!selected)s+=`<text x="${b.x-3.1}" y="${b.y+2.8}" font-size="7.5" fill="#aaa">${esc(isTF&&b.value==='D'?'Đ':b.value)}</text>`;});
    });text(90,1348,'In 100% trên A4. Không cắt mốc. Không tự co giãn riêng từng vùng.',12);return s+'</g></svg>';
  }
  const api={profile,validateProfile,validateCorners,transform,detect,classify,scan,sheet};root.PTWOMR=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
