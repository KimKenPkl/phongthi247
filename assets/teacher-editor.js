(function(root){
  'use strict';
  const need=(ok,msg)=>{if(!ok)throw new Error(msg);};
  function clean(source,{renumber=false,splitOptions=false,compact=true}={}){
    let text=String(source??'').normalize('NFC').replace(/\r\n?/g,'\n').replace(/\u00a0/g,' ');
    if(compact)text=text.split('\n').map(l=>l.replace(/[ \t]+$/,'').replace(/^[ \t]+/,'')).join('\n').replace(/\n{3,}/g,'\n\n');
    if(splitOptions)text=text.replace(/([^\n])[ \t]+([ABCD][.)])[ \t]+/g,'$1\n$2 ');
    if(renumber){
      need(!/^\s*(?:ĐÁP ÁN|BẢNG ĐÁP ÁN|LỜI GIẢI|HƯỚNG DẪN GIẢI)\s*[:.]?\s*$/mi.test(text),'Có bảng đáp án hoặc lời giải riêng. Hãy tắt đánh số để giữ đúng liên kết câu và đáp án.');
      let n=0;text=text.replace(/^(\s*)(?:Câu|Question)\s+\d+\s*[.:]/gmi,(m,space)=>`${space}Câu ${++n}.`);
    }
    return text;
  }
  function analyze(source){
    const text=String(source??'').replace(/\r/g,''), lines=text.split('\n'),questions=[];let current=null,part='I';
    lines.forEach((line,i)=>{
      const sec=line.match(/^\s*PHẦN\s+(III|II|I)\b/i);if(sec)part=sec[1].toUpperCase();
      const m=line.match(/^\s*(?:Câu|Question)\s+(\d+)\s*[.:]\s*(.*)$/i);
      if(m){current={number:Number(m[1]),part,line:i+1,text:m[2],lines:[],options:[],solution:[]};questions.push(current);}
      else if(current)current.lines.push(line);
    });
    const warnings=[],numbers=new Map(),duplicates=new Map();
    questions.forEach(q=>{
      const id=q.part+'.'+q.number;if(numbers.has(id))warnings.push(`Dòng ${q.line}: số câu ${id} bị trùng với dòng ${numbers.get(id)}.`);else numbers.set(id,q.line);
      const body=[q.text,...q.lines].join('\n');q.body=body;
      q.options=[...body.matchAll(/(?:^|\n|[ \t])([ABCD])[.)][ \t]+/g)].map(x=>x[1]);
      if(q.part==='I'&&(q.options.length!==4||new Set(q.options).size!==4))warnings.push(`Dòng ${q.line}, câu ${q.number}: chưa nhận diện đủ bốn phương án A–D.`);
      const stem=body.split(/(?:^|\n|[ \t])A[.)][ \t]+/)[0].toLocaleLowerCase('vi').replace(/\s+/g,' ').trim();
      if(stem.length>=15){if(duplicates.has(stem))warnings.push(`Dòng ${q.line}: nội dung đầu câu trùng dòng ${duplicates.get(stem)} (cần kiểm tra thủ công).`);else duplicates.set(stem,q.line);}
    });
    if(!questions.length)warnings.push('Chưa nhận diện được câu hỏi. Dùng “Câu 1.” hoặc “Question 1:”.');
    return {questions,warnings,lineCount:lines.length};
  }
  function splitSolutions(source){
    const question=[],solution=[];let solving=false,heading='';
    for(const line of String(source??'').replace(/\r/g,'').split('\n')){
      if(/^\s*(?:Câu|Question)\s+\d+\s*[.:]/i.test(line)){solving=false;heading=line.match(/^\s*((?:Câu|Question)\s+\d+\s*[.:])/i)[1];}
      if(/^\s*PHẦN\s+(?:III|II|I)\b/i.test(line)){solving=false;solution.push(line);}
      if(/^\s*(?:Lời giải|Hướng dẫn giải|Giải thích)\s*[:.]/i.test(line)){solving=true;solution.push(heading);}
      (solving?solution:question).push(line);
    }
    return {question:question.join('\n'),solution:solution.join('\n')};
  }
  const API={clean,analyze,splitSolutions};root.PTWEditor=API;if(typeof module!=='undefined')module.exports=API;
  if(typeof document==='undefined')return;
  const $=id=>document.getElementById(id);let output='',solution='';
  function status(msg,error=false){$('editor-status').textContent=msg;$('editor-status').classList.toggle('error',error);}
  $('editor-form').addEventListener('submit',e=>{
    e.preventDefault();try{
      const source=$('editor-source').value;need(source.trim(),'Dán văn bản trước khi xử lý.');need(source.length<=1e6,'Tối đa một triệu ký tự.');
      output=clean(source,{renumber:$('renumber').checked,splitOptions:$('split-options').checked,compact:$('compact').checked});
      const result=analyze(output),parts=splitSolutions(output);solution=parts.solution;
      if($('separate').checked)output=parts.question;
      $('editor-result').value=output;$('editor-actions').hidden=false;
      status(`${result.questions.length} câu, ${result.lineCount} dòng. ${result.warnings.length} lưu ý.\n${result.warnings.join('\n')}`);
    }catch(err){status(err.message,true);$('editor-status').focus();}
  });
  $('editor-source').addEventListener('input',()=>{output='';solution='';$('editor-result').value='';$('editor-actions').hidden=true;status('Văn bản đã thay đổi. Bấm xử lý để cập nhật.');});
  document.querySelectorAll('#editor-form input[type=checkbox]').forEach(x=>x.addEventListener('change',()=>{$('editor-actions').hidden=true;status('Tùy chọn đã đổi. Bấm xử lý để cập nhật.');}));
  $('editor-download').addEventListener('click',()=>PTWData.download('de-da-chuan-hoa.txt',output));
  $('editor-solutions').addEventListener('click',()=>{if(!solution.trim()){status('Không tìm thấy lời giải bắt đầu bằng “Lời giải:” hoặc “Hướng dẫn giải:”.',true);return;}PTWData.download('loi-giai.txt',solution);});
  $('editor-copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(output);status('Đã chép văn bản kết quả.');}catch(_){$('editor-result').focus();$('editor-result').select();status('Không truy cập được clipboard. Đã chọn văn bản; nhấn Ctrl+C để chép.');}});
  $('editor-to-mix').addEventListener('click',()=>{try{need(output.trim(),'Chưa có kết quả.');sessionStorage.setItem('ptw_teacher_editor_v1',output);location.href='tronde.html?teacher-editor=1';}catch(e){status(e.message,true);}});
})(typeof window!=='undefined'?window:globalThis);
