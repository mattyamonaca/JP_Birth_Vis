import assert from 'node:assert/strict';
import fs from 'node:fs';
import {valueAt,pairedChange,summarize,columnFeature,filterFacilities,validCoordinate,HEIGHT_FACTOR} from '../core.mjs';
const fixture=(values,flags=values.map(()=>null),status=values.map(v=>v===null?'missing':'reported'))=>({annual:values,annualFlags:flags,annualStatus:status,type:'hospital',pref:'東京都',id:'test',lat:35.7,lon:139.7});
const a=fixture([100,80]),b=fixture([null,200]),c=fixture([0,20]),d=fixture([50,100],['要確認',null]);
assert.equal(valueAt(b,'annual',0),null);
assert.equal(valueAt(c,'annual',0),0);
assert.equal(valueAt(d,'annual',0),null);
assert.equal(valueAt(d,'annual',0,true),50);
assert.equal(valueAt(fixture([12],[],['suppressed']),'annual',0,true),null);
const change=pairedChange([a,b,c,d],'annual',1,0);
assert.deepEqual(change,{count:2,current:100,baseline:100,difference:0,percent:0});
assert.equal(pairedChange([b],'annual',1,0).percent,null);
assert.equal(pairedChange([c],'annual',1,0).percent,null);
assert.equal(pairedChange([a],'annual',0,0).count,0);
assert.equal(summarize([b],'annual',0).reported,0);
assert.equal(columnFeature(a,100,'annual').properties.height,100*HEIGHT_FACTOR.annual);
assert.equal(columnFeature(a,80,'annual').properties.height/columnFeature(a,100,'annual').properties.height,.8);
assert(!validCoordinate({...a,lat:null}));
const data=JSON.parse(fs.readFileSync(new URL('../data/facilities.json',import.meta.url)));
for(const mode of ['annual','monthly'])for(let i=0;i<data[mode+'Years'].length;i++)for(const include of [false,true]){
  const rows=data.facilities.filter(f=>Number.isFinite(f[mode][i])&&f[mode+'Status'][i]==='reported'&&(include||!f[mode+'Flags'][i]));
  const summary=summarize(data.facilities,mode,i,include);
  assert.equal(summary.reported,rows.length);
  assert.equal(summary.total,rows.reduce((sum,f)=>sum+f[mode][i],0));
  if(i){const pairs=rows.filter(f=>Number.isFinite(f[mode][i-1])&&f[mode+'Status'][i-1]==='reported'&&(include||!f[mode+'Flags'][i-1]));const delta=pairedChange(data.facilities,mode,i,i-1,include);assert.equal(delta.count,pairs.length);assert.equal(delta.current,pairs.length?pairs.reduce((s,f)=>s+f[mode][i],0):null);assert.equal(delta.baseline,pairs.length?pairs.reduce((s,f)=>s+f[mode][i-1],0):null);}
}
const clinics=filterFacilities(data.facilities,{type:'clinic',pref:'東京都'});assert(clinics.length>0&&clinics.every(f=>f.type==='clinic'&&f.pref==='東京都'));
assert.equal(data.facilities.length,new Set(data.facilities.map(f=>f.id)).size);
console.log(JSON.stringify({result:'PASS',facilities:data.facilities.length,located:data.facilities.filter(validCoordinate).length,latestClean:summarize(data.facilities,'annual',4),latestPaired:pairedChange(data.facilities,'annual',4,3)},null,2));
