(function(root){
  'use strict';
  const KEY='hh60s_lab_activity_v1',LIMIT=1000,LEGACY=[
    ['hh60s_chem_labs_v2','nhiem-vu'],
    ['hh60s_grade7_molecules_v1','phan-tu']
  ];
  function read(){try{const data=JSON.parse(root.localStorage.getItem(KEY)||'[]');return Array.isArray(data)?data.filter(valid).slice(-LIMIT):[];}catch{return[];}}
  function valid(e){return e&&typeof e.eventId==='string'&&typeof e.source==='string'&&typeof e.activityId==='string'&&(typeof e.completedAt==='string'&&Number.isFinite(Date.parse(e.completedAt))||e.completedAt===null&&e.eventId.startsWith('legacy:'));}
  function record(source,activityId,metrics={}){
    if(typeof source!=='string'||typeof activityId!=='string'||!source||!activityId)return null;
    const at=Number.isFinite(metrics.completedAt)?new Date(metrics.completedAt).toISOString():new Date().toISOString();
    const safeMetrics={};for(const [k,v] of Object.entries(metrics)){if(k==='completedAt'||!/^[a-zA-Z][a-zA-Z0-9_]{0,31}$/.test(k))continue;if(typeof v==='number'&&Number.isFinite(v))safeMetrics[k]=v;else if(typeof v==='string'&&v.length<=80)safeMetrics[k]=v;}
    const eventId=`${source}:${activityId}:${at}:${JSON.stringify(safeMetrics)}`,events=read();if(events.some(e=>e.eventId===eventId))return events.find(e=>e.eventId===eventId);
    const event={eventId,source,activityId,completedAt:at,metrics:safeMetrics};events.push(event);try{root.localStorage.setItem(KEY,JSON.stringify(events.slice(-LIMIT)));}catch{}return event;
  }
  function activities(){
    const events=read(),seen=new Set(events.map(e=>e.source+'|'+e.activityId)),legacy=[];
    for(const [key,source] of LEGACY){let data;try{data=JSON.parse(root.localStorage.getItem(key)||'null');}catch{continue;}
      const entries=key==='hh60s_chem_labs_v2'&&data&&typeof data==='object'&&!Array.isArray(data)?Object.entries(data).flatMap(([kind,ids])=>Array.isArray(ids)?ids.filter(id=>typeof id==='string').map(id=>[`${kind}:${id}`,source]):[]):Array.isArray(data)?data.filter(id=>typeof id==='string').map(id=>[id,source]):[];
      for(const [id,eventSource] of entries){const pair=eventSource+'|'+id;if(seen.has(pair))continue;seen.add(pair);legacy.push({eventId:'legacy:'+pair,source:eventSource,activityId:id,completedAt:null,metrics:{}});}}
    let games={};try{games=JSON.parse(root.localStorage.getItem('hh60s_grade7_games_v1')||'{}')||{};}catch{}
    for(const [id,value] of Object.entries(games)){if(typeof value!=='number'||!Number.isFinite(value))continue;const pair='game|'+id;if(seen.has(pair))continue;seen.add(pair);legacy.push({eventId:'legacy:'+pair,source:'game',activityId:id,completedAt:null,metrics:{best:value}});}
    let review;try{review=JSON.parse(root.localStorage.getItem('hh60_review_v1')||'null');}catch{}
    if(review&&review.status==='submitted'){const pair='review|'+String(review.code||review.paper||'latest');if(!seen.has(pair))legacy.push({eventId:'legacy:'+pair,source:'review',activityId:String(review.code||review.paper||'latest'),completedAt:null,metrics:{}});}
    return [...events,...legacy].sort((a,b)=>(Date.parse(b.completedAt)||0)-(Date.parse(a.completedAt)||0));
  }
  function exportData(){return {app:'ptw-lab-progress',schemaVersion:1,events:activities()};}
  function importData(data){if(!data||data.app!=='ptw-lab-progress'||data.schemaVersion!==1||!Array.isArray(data.events)||data.events.length>LIMIT)throw Error('Tệp tiến độ Lab không hợp lệ hoặc không được hỗ trợ.');const incoming=data.events.filter(valid),merged=new Map(read().map(e=>[e.eventId,e]));for(const event of incoming)merged.set(event.eventId,event);const events=[...merged.values()].slice(-LIMIT);root.localStorage.setItem(KEY,JSON.stringify(events));return events.length;}
  function reset(){for(const key of [KEY,'hh60s_chem_labs_v2','hh60s_grade7_molecules_v1','hh60s_grade7_games_v1','hh60_review_v1'])try{root.localStorage.removeItem(key);}catch{}}
  root.PTWLabProgress={record,activities,exportData,importData,read,reset};
})(window);
