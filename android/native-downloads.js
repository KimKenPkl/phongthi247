(function(){
  'use strict';
  if(!window.PTWExport||window.__ptwNativeDownloads)return;
  window.__ptwNativeDownloads=true;
  const original=HTMLAnchorElement.prototype.click;
  async function save(a){
    try{
      const url=new URL(a.href,location.href);
      const template=url.origin===location.origin&&/^\/assets\/assets\/mau\/mau-[a-z-]+\.docx$/.test(url.pathname);
      if(!/^(blob:|data:)/.test(url.href)&&!template)throw Error('Chỉ hỗ trợ dữ liệu đã tạo và mẫu Word đi kèm.');
      const response=await fetch(url.href);if(!response.ok)throw Error('Không đọc được tệp.');const blob=await response.blob();
      if(blob.size>24*1024*1024)throw Error('Tệp xuất vượt 24 MB. Chia nhỏ đợt xuất.');
      const encoded=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=reject;r.readAsDataURL(blob);});
      PTWExport.save(a.download||(template?url.pathname.split('/').pop():'phongthi247-export'),blob.type||'application/octet-stream',encoded);
    }catch(e){alert('Không xuất được tệp: '+e.message);}
  }
  HTMLAnchorElement.prototype.click=function(){if(this.hasAttribute('download')){void save(this);return;}return original.call(this);};
  document.addEventListener('click',e=>{const a=e.target.closest('a[download]');if(a){e.preventDefault();void save(a);}},true);
  window.print=()=>PTWExport.printPage();
})();
