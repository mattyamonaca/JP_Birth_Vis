export const HEIGHT_FACTOR = Object.freeze({annual:80,monthly:800});
export const TYPE_LABEL = Object.freeze({hospital:'病院',clinic:'有床診療所'});
export function validCoordinate(f) {
  return Number.isFinite(f.lat)&&Number.isFinite(f.lon)&&f.lat>=20&&f.lat<=46&&f.lon>=122&&f.lon<=154;
}
export function valueAt(f,mode,index,includeQuality=false) {
  const value=f[mode]?.[index],status=f[mode+'Status']?.[index];
  if (!Number.isFinite(value)||value<0||status!=='reported') return null;
  if (!includeQuality && f[mode+'Flags']?.[index]) return null;
  return value;
}
export function filterFacilities(facilities,{pref='',type=''}={}) {
  return facilities.filter(f=>(!pref||f.pref===pref)&&(!type||f.type===type));
}
export function pairedChange(facilities,mode,current,baseline,includeQuality=false) {
  if(baseline<0||current===baseline)return {count:0,current:null,baseline:null,difference:null,percent:null};
  let count=0,now=0,before=0;
  for(const f of facilities){const a=valueAt(f,mode,current,includeQuality),b=valueAt(f,mode,baseline,includeQuality);if(a===null||b===null)continue;count++;now+=a;before+=b;}
  return {count,current:count?now:null,baseline:count?before:null,difference:count?now-before:null,percent:count&&before>0?(now-before)/before*100:null};
}
export function summarize(facilities,mode,index,includeQuality=false) {
  let total=0,reported=0,excluded=0,unlocated=0,positive=0,zero=0,locatedPositive=0;
  for(const f of facilities){if(!validCoordinate(f))unlocated++;const v=valueAt(f,mode,index,includeQuality);if(v===null){excluded++;continue;}total+=v;reported++;if(v>0){positive++;if(validCoordinate(f))locatedPositive++;}else zero++;}
  return {total,reported,excluded,unlocated,positive,zero,locatedPositive};
}
export function columnFeature(f,value,mode,radius=1000) {
  const dy=radius/111320,dx=dy/Math.cos(f.lat*Math.PI/180);
  return {type:'Feature',id:f.id,properties:{id:f.id,name:f.name,type:f.type,value,height:value*HEIGHT_FACTOR[mode]},geometry:{type:'Polygon',coordinates:[[[f.lon-dx,f.lat-dy],[f.lon+dx,f.lat-dy],[f.lon+dx,f.lat+dy],[f.lon-dx,f.lat+dy],[f.lon-dx,f.lat-dy]]]}};
}
export function coordinateKey(f){return validCoordinate(f)?f.lat.toFixed(5)+','+f.lon.toFixed(5):null;}
export function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
