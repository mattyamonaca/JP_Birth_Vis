import {HEIGHT_FACTOR,TYPE_LABEL,validCoordinate,valueAt,filterFacilities,pairedChange,summarize,columnFeature,coordinateKey,escapeHtml as esc} from './core.mjs';

const $=id=>document.getElementById(id),nf=new Intl.NumberFormat('ja-JP');
const state={mode:'annual',index:4,pref:'',type:'',includeQuality:false,selected:null,playing:false,threeD:true};
let data=null,outline=null,map=null,mapReady=false,fallback=false,timer=null,mapTimeout=null,popup=null;
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const years=()=>data[state.mode+'Years'];
const pool=()=>filterFacilities(data.facilities,state);
const periodLabel=(year,mode=state.mode)=>mode==='annual'?year+'年度':year+'年6月';
const safeNumber=v=>v===null||v===undefined?'—':nf.format(v);
const positiveVisible=()=>pool().filter(f=>validCoordinate(f)&&(valueAt(f,state.mode,state.index,state.includeQuality)??0)>0);
const nationalZoom=()=>Math.max(3,Math.min(4.35,4.35+Math.log2(Math.min(document.querySelector('.map-stage').clientWidth/900,document.querySelector('.map-stage').clientHeight/600))));

function showMessage(message){$('map-message').textContent=message;$('map-message').hidden=!message;}
function setPlaying(on){clearInterval(timer);timer=null;state.playing=on;$('play-label').textContent=on?'停止':'再生';$('play-icon').textContent=on?'Ⅱ':'▶';$('play').setAttribute('aria-label',on?'再生を一時停止':'年次変化を再生');if(on){if(state.index>=years().length-1)setIndex(0);timer=setInterval(()=>{if(state.index>=years().length-1){setPlaying(false);return;}setIndex(state.index+1);},1500);}}
function setIndex(index){state.index=Math.max(0,Math.min(years().length-1,index));render();}
function setMode(mode){if(mode===state.mode)return;setPlaying(false);state.mode=mode;state.index=years().length-1;document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));render();}

function comparisonText(change){if(!change.count)return '—';if(change.percent!==null)return (change.percent>0?'+':'')+change.percent.toFixed(1)+'%';return (change.difference>0?'+':'')+nf.format(change.difference)+'件';}
function renderStats(){
  const facilities=pool(),s=summarize(facilities,state.mode,state.index,state.includeQuality);
  $('region-name').textContent=state.pref||'全国';
  $('region-total').textContent=s.reported?nf.format(s.total):'—';
  $('sum-label').textContent=state.mode==='annual'?'掲載施設の年間公表値合計':'掲載施設の6月公表値合計';
  $('report-count').textContent=`${nf.format(s.reported)}施設を集計 · ${nf.format(s.excluded)}施設を除外`;
  const previous=pairedChange(facilities,state.mode,state.index,state.index-1,state.includeQuality),baseline=pairedChange(facilities,state.mode,state.index,0,state.includeQuality);
  $('previous-change').textContent=comparisonText(previous);$('previous-panel').textContent=`比較可能 ${nf.format(previous.count)}施設`;
  $('previous-label').textContent=state.mode==='annual'?'前年との比較':'前年同月比（要検証）';
  $('baseline-label').textContent=`${years()[0]}${state.mode==='annual'?'年度':'年6月'}との比較`;
  $('baseline-change').textContent=comparisonText(baseline);$('baseline-panel').textContent=`比較可能 ${nf.format(baseline.count)}施設`;
  $('previous-change').title=previous.count?`共通施設：${nf.format(previous.baseline)} → ${nf.format(previous.current)}件（${previous.difference>=0?'+':''}${nf.format(previous.difference)}件）`:'前期の比較可能な数値がありません';
  $('baseline-change').title=baseline.count?`共通施設：${nf.format(baseline.baseline)} → ${nf.format(baseline.current)}件`:'初年を選択中、または比較可能な数値がありません';
  const eligible=facilities.filter(f=>valueAt(f,state.mode,state.index,state.includeQuality)!==null),mappedTotal=eligible.filter(validCoordinate).reduce((a,f)=>a+valueAt(f,state.mode,state.index,state.includeQuality),0);
  const coveragePercent=s.total>0?(mappedTotal/s.total*100).toFixed(1)+'%':'—';
  $('coverage-label').textContent=`対象 ${nf.format(facilities.length)}施設中、座標未取得 ${nf.format(s.unlocated)}施設。集計対象の分娩件数のうち地図に位置を示せる割合 ${coveragePercent}。数値集計には座標未取得も含みます。`;
  $('map-count').textContent=`地図に表示 ${nf.format(s.locatedPositive)}施設 · 公表0件 ${nf.format(s.zero)}施設`;
  if(state.includeQuality)showMessage('原報告の要確認値を含んでいます。極端な値も補正せず表示するため、棒が大きく伸びる場合があります。');
  else if(fallback)showMessage('3D地図を利用できないため、2D地図で表示しています。施設と年の操作・集計は引き続き使えます。');
  else if(s.locatedPositive===0)showMessage('この条件で地図に表示できる正の公表値がありません。地域・施設種別・年を変更できます。');
  else showMessage('');
}

function render(){
  if(!data)return;
  const year=years()[state.index];$('map-year').textContent=year;$('map-year-unit').textContent=state.mode==='annual'?'年度':'年6月';
  $('period-kicker').textContent=state.mode==='annual'?'ANNUAL DATA':'JUNE ONLY';
  $('map-period').textContent=state.mode==='annual'?`${year}年4月—${year+1}年3月`:`${year}年6月の1か月分`;
  $('map-scale').textContent=fallback?'2D：円の大きさが件数に応じます。小さい値は最小サイズ。':!state.threeD?'2D：施設の位置を表示。施設を選ぶと件数が見られます。':`高さ：1件＝${HEIGHT_FACTOR[state.mode]}m相当（表示上の倍率）。年を変えても固定。`;
  $('timeline-note').textContent=state.mode==='monthly'?'6月の1か月分。原報告に大きな異常値があり、地域の実態変化は要検証。年間換算はしません。'+(state.includeQuality?' 要確認値も含む。':''):state.includeQuality?'要確認値を含む · 秘匿・未報告は除外':'公表値を表示 · 原報告要確認値は除外';
  $('timeline-note').classList.toggle('monthly-warning',state.mode==='monthly');
  $('year-range').max=years().length-1;$('year-range').value=state.index;$('year-range').setAttribute('aria-valuetext',periodLabel(year));
  $('year-ticks').replaceChildren();years().forEach((y,i)=>{const b=document.createElement('button');b.type='button';b.textContent=y;b.setAttribute('aria-label',periodLabel(y)+'を表示');b.setAttribute('aria-pressed',String(i===state.index));b.addEventListener('click',()=>{setPlaying(false);setIndex(i);});$('year-ticks').append(b);});
  renderStats();updateMap();renderDetail();
}

function updateMap(){
  if(!data)return;
  if(fallback){drawFallback();return;}
  if(!mapReady)return;
  const radius=Math.min(3500,Math.max(45,3500*2**(4.4-map.getZoom())));
  const visible=positiveVisible();
  map.getSource('columns').setData({type:'FeatureCollection',features:visible.map(f=>columnFeature(f,valueAt(f,state.mode,state.index,state.includeQuality),state.mode,radius))});
  map.getSource('points').setData({type:'FeatureCollection',features:visible.map(f=>({type:'Feature',properties:{id:f.id,type:f.type,value:valueAt(f,state.mode,state.index,state.includeQuality)},geometry:{type:'Point',coordinates:[f.lon,f.lat]}}))});
  map.setFilter('selected-ring',['==',['get','id'],state.selected?.id||'']);
}

function initializeMap(){
  if(!window.maplibregl){activateFallback();return;}
  try{
    map=new maplibregl.Map({container:'map',center:[137.2,36.6],zoom:nationalZoom(),pitch:48,bearing:-12,maxPitch:70,minZoom:3,maxZoom:14,attributionControl:true,style:{version:8,sources:{gsi:{type:'raster',tiles:['https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png'],tileSize:256,maxzoom:18,attribution:'<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル</a>'},japan:{type:'geojson',data:outline,attribution:'<a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth</a>'}},layers:[{id:'background',type:'background',paint:{'background-color':'#e8f0ed'}},{id:'country',type:'fill',source:'japan',paint:{'fill-color':'#f6f8f0'}},{id:'gsi',type:'raster',source:'gsi',paint:{'raster-opacity':0.66,'raster-saturation':-0.55}},{id:'country-line',type:'line',source:'japan',paint:{'line-color':'#a2b7a8','line-width':0.7}}]}});
    mapTimeout=setTimeout(()=>{if(!mapReady)activateFallback();},16000);
    map.addControl(new maplibregl.NavigationControl({visualizePitch:true}),'top-right');
    map.on('load',()=>{
      if(fallback)return;clearTimeout(mapTimeout);mapReady=true;
      map.addSource('columns',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
      map.addSource('points',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
      const color=['match',['get','type'],'hospital','#168b87','#e8a06c'];
      map.addLayer({id:'columns',type:'fill-extrusion',source:'columns',paint:{'fill-extrusion-color':color,'fill-extrusion-height':['get','height'],'fill-extrusion-base':0,'fill-extrusion-opacity':0.86,'fill-extrusion-vertical-gradient':true}});
      map.addLayer({id:'points',type:'circle',source:'points',paint:{'circle-radius':['interpolate',['linear'],['zoom'],3,2,8,4,14,6],'circle-color':color,'circle-opacity':0.9}});
      map.addLayer({id:'selected-ring',type:'circle',source:'points',filter:['==',['get','id'],''],paint:{'circle-radius':10,'circle-color':'#ffffff','circle-opacity':0.15,'circle-stroke-color':'#183c40','circle-stroke-width':2}});
      for(const layer of ['columns','points']){
        map.on('click',layer,event=>{const f=data.facilities.find(f=>f.id===event.features?.[0]?.properties.id);if(f)selectFacility(f,false);});
        map.on('mouseenter',layer,()=>{map.getCanvas().style.cursor='pointer';});map.on('mouseleave',layer,()=>{map.getCanvas().style.cursor='';if(popup){popup.remove();popup=null;}});
        map.on('mousemove',layer,event=>{const f=data.facilities.find(f=>f.id===event.features?.[0]?.properties.id);if(!f)return;if(popup)popup.remove();popup=new maplibregl.Popup({closeButton:false,closeOnClick:false,offset:12}).setLngLat(event.lngLat).setHTML(`<strong>${esc(f.name)}</strong><br>${esc(periodLabel(years()[state.index]))} · ${nf.format(valueAt(f,state.mode,state.index,state.includeQuality))}件`).addTo(map);});
      }
      map.on('zoomend',updateMap);map.getCanvas().addEventListener('webglcontextlost',()=>activateFallback());updateMap();
    });
    map.on('error',e=>{if(/webgl|context|unsupported/i.test(e.error?.message||''))activateFallback();});
  }catch(error){console.warn('3D map unavailable',error);activateFallback();}
}

function activateFallback(){
  if(fallback)return;fallback=true;clearTimeout(mapTimeout);state.threeD=false;
  if(map){try{map.remove();}catch{}map=null;}mapReady=false;$('map').hidden=true;$('fallback-map').hidden=false;$('dimension').textContent='2D';$('dimension').setAttribute('aria-pressed','false');$('dimension').disabled=true;
  render();
}

function mercator([lon,lat]){return [lon*Math.PI/180,Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))];}
function drawFallback(){
  if(!data||!outline)return;
  const host=$('fallback-map'),w=Math.max(320,host.clientWidth),h=Math.max(400,host.clientHeight),svgNS='http://www.w3.org/2000/svg';
  const bounds=state.pref?pool().filter(validCoordinate):[];
  const lo=bounds.length?Math.min(...bounds.map(f=>f.lon))-0.3:122.5,hi=bounds.length?Math.max(...bounds.map(f=>f.lon))+0.3:147.5;
  const bottom=bounds.length?Math.min(...bounds.map(f=>f.lat))-0.3:23.5,top=bounds.length?Math.max(...bounds.map(f=>f.lat))+0.3:46;
  const [x0,y0]=mercator([lo,bottom]),[x1,y1]=mercator([hi,top]);const scale=Math.min((w-90)/(x1-x0),(h-115)/(y1-y0));
  const project=coord=>{const [x,y]=mercator(coord);return [(w-(x1-x0)*scale)/2+(x-x0)*scale,55+(h-115-(y1-y0)*scale)/2+(y1-y)*scale];};
  const el=(tag,attrs={})=>{const n=document.createElementNS(svgNS,tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));return n;};
  const svg=el('svg',{viewBox:`0 0 ${w} ${h}`,role:'img','aria-label':'日本の施設別分娩数。丸の大きさは件数に比例。'});
  const defs=el('defs'),clip=el('clipPath',{id:'fallback-clip'});clip.append(el('rect',{x:0,y:0,width:w,height:h}));defs.append(clip);svg.append(defs);const group=el('g',{'clip-path':'url(#fallback-clip)'});svg.append(group);
  for(const feature of outline.features){const polygons=feature.geometry.type==='MultiPolygon'?feature.geometry.coordinates:[feature.geometry.coordinates];for(const polygon of polygons){const path=polygon.map(ring=>ring.map((c,i)=>(i?'L':'M')+project(c).map(v=>v.toFixed(2)).join(',')).join(' ')+'Z').join(' ');group.append(el('path',{d:path,fill:'#f5f7ef',stroke:'#a8bfb0','stroke-width':0.8,'fill-rule':'evenodd'}));}}
  for(const f of positiveVisible()){const value=valueAt(f,state.mode,state.index,state.includeQuality),[cx,cy]=project([f.lon,f.lat]);const dot=el('circle',{cx,cy,r:Math.max(2,Math.sqrt(value/(state.mode==='annual'?60:6))),fill:f.type==='hospital'?'#168b87':'#e8a06c',opacity:0.7,stroke:state.selected?.id===f.id?'#153c42':'none','stroke-width':2,class:'fallback-point'});const title=el('title');title.textContent=f.name+'：'+nf.format(value)+'件';dot.append(title);dot.addEventListener('click',()=>selectFacility(f,false));group.append(dot);}
  host.replaceChildren(svg);const attribution=document.createElement('div');attribution.className='fallback-attribution';attribution.innerHTML='境界：<a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth</a> · 小さい値は最小サイズ';host.append(attribution);
}

function focusRegion(){
  if(fallback){drawFallback();return;}if(!mapReady)return;
  const positive=positiveVisible(),located=positive.length?positive:pool().filter(validCoordinate);if(!state.pref||!located.length){map.easeTo({center:[137.2,36.6],zoom:nationalZoom(),pitch:state.threeD?48:0,bearing:state.threeD?-12:0,duration:reduced?0:800});return;}
  const bounds=new maplibregl.LngLatBounds();located.forEach(f=>bounds.extend([f.lon,f.lat]));map.fitBounds(bounds,{padding:{top:95,bottom:75,left:90,right:70},maxZoom:8.2,duration:reduced?0:800});
}

function selectFacility(f,fly=true){state.selected=f;$('facility-detail').hidden=false;renderDetail();updateMap();if(fly&&validCoordinate(f)&&mapReady)map.flyTo({center:[f.lon,f.lat],zoom:Math.max(map.getZoom(),8.5),pitch:state.threeD?48:0,duration:reduced?0:900});}
function renderSearch(){const q=$('facility-search').value.trim().normalize('NFKC').toLowerCase();$('search-results').replaceChildren();if(!q)return;const found=pool().filter(f=>f.name.normalize('NFKC').toLowerCase().includes(q));for(const f of found.slice(0,12)){const b=document.createElement('button');b.type='button';b.textContent=f.name;const small=document.createElement('small');small.textContent=f.pref+' · '+TYPE_LABEL[f.type]+(validCoordinate(f)?'':' · 座標未取得');b.append(small);b.addEventListener('click',()=>{selectFacility(f);$('search-results').replaceChildren();$('facility-search').value=f.name;});$('search-results').append(b);}if(!found.length){const p=document.createElement('p');p.className='micro muted';p.textContent='該当施設がありません。地域・施設種別の条件も確認できます。';$('search-results').append(p);}else if(found.length>12){const p=document.createElement('p');p.className='micro muted';p.textContent=`${nf.format(found.length)}件中、先頭12件。名称を追加すると絞り込めます。`;$('search-results').append(p);}}

function renderDetail(){
  const f=state.selected;if(!f){$('facility-detail').hidden=true;return;}
  const value=valueAt(f,state.mode,state.index,state.includeQuality),raw=f[state.mode]?.[state.index],flag=f[state.mode+'Flags']?.[state.index],status=f[state.mode+'Status']?.[state.index];
  $('detail-type').textContent=TYPE_LABEL[f.type]+' · '+f.pref;$('detail-name').textContent=f.name;$('detail-address').textContent=f.address||f.cityName||'住所の対応未取得';$('detail-value').textContent=safeNumber(value);$('detail-unit').textContent=periodLabel(years()[state.index])+' · 件';
  $('detail-status').textContent=flag?'原報告要確認：'+flag+(state.includeQuality?'（原値を表示）':`（${safeNumber(raw)}件を表示・集計から除外）`):status==='suppressed'?'秘匿のため施設合計は不明。ゼロではありません。':value===null?'この期の公表数値はありません。':'公表数値'+(f.type==='hospital'?'（病棟合計）':'');
  $('detail-location').textContent=validCoordinate(f)?'位置：2026年6月1日の公表座標。過去の移転は未追跡。':'座標未取得のため地図に配置していません。数値は地域集計に含めます。';
  const values=years().map((_,i)=>valueAt(f,state.mode,i,state.includeQuality));const max=Math.max(1,...values.filter(v=>v!==null));const width=270,height=95,left=14,right=13,top=10,bottom=12;
  const x=i=>left+i*(width-left-right)/(values.length-1),y=v=>height-bottom-v/max*(height-top-bottom);
  let path='';values.forEach((v,i)=>{if(v===null)return;path+=(i>0&&values[i-1]!==null?'L':'M')+x(i)+','+y(v)+' ';});
  const color=f.type==='hospital'?'#168b87':'#e8a06c';
  $('detail-chart').innerHTML=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(f.name)}の推移。欠測期は線を接続しません。"><line x1="${left}" x2="${width-right}" y1="${height-bottom}" y2="${height-bottom}" stroke="#dbe5dc"/><path d="${path}" stroke="${color}" stroke-width="2" fill="none"/>${values.map((v,i)=>v===null?'':`<circle cx="${x(i)}" cy="${y(v)}" r="${i===state.index?5:3}" fill="${color}"><title>${esc(periodLabel(years()[i]))}：${nf.format(v)}件</title></circle>`).join('')}</svg>`;
  $('detail-years').replaceChildren();years().forEach((year,i)=>{const cell=document.createElement('div'),label=document.createElement('span'),val=document.createElement('strong');label.textContent=year;val.textContent=values[i]===null?'—':nf.format(values[i]);cell.append(label,val);$('detail-years').append(cell);});
  const coKey=coordinateKey(f),co=coKey?data.facilities.filter(other=>other.id!==f.id&&coordinateKey(other)===coKey):[];$('colocated').replaceChildren();if(co.length){const label=document.createElement('p');label.className='micro muted';label.textContent=`同じ公表座標に別の${co.length}施設`;$('colocated').append(label);for(const other of co){const b=document.createElement('button');b.type='button';b.textContent=other.name;b.addEventListener('click',()=>selectFacility(other,false));$('colocated').append(b);}}
}

function bind(){
  $('pref').addEventListener('change',()=>{state.pref=$('pref').value;state.selected=null;renderSearch();render();focusRegion();});
  $('type').addEventListener('change',()=>{state.type=$('type').value;state.selected=null;renderSearch();render();});
  $('include-quality').addEventListener('change',()=>{state.includeQuality=$('include-quality').checked;render();});
  $('facility-search').addEventListener('input',renderSearch);$('close-detail').addEventListener('click',()=>{state.selected=null;renderDetail();updateMap();});
  $('play').addEventListener('click',()=>setPlaying(!state.playing));$('year-range').addEventListener('input',()=>{setPlaying(false);setIndex(Number($('year-range').value));});document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
  $('reset-map').addEventListener('click',()=>{state.pref='';$('pref').value='';render();focusRegion();});
  $('dimension').addEventListener('click',()=>{if(!mapReady)return;state.threeD=!state.threeD;$('dimension').textContent=state.threeD?'3D':'2D';$('dimension').setAttribute('aria-pressed',String(state.threeD));map.easeTo({pitch:state.threeD?48:0,bearing:state.threeD?-12:0,duration:reduced?0:600});map.setLayoutProperty('columns','visibility',state.threeD?'visible':'none');render();});
  for(const id of ['about-button','sources-button'])$(id).addEventListener('click',()=>$('about-dialog').showModal());$('close-about').addEventListener('click',()=>$('about-dialog').close());$('about-dialog').addEventListener('click',event=>{if(event.target===$('about-dialog')){const r=$('about-dialog').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)$('about-dialog').close();}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)setPlaying(false);});new ResizeObserver(()=>{if(fallback)drawFallback();else if(map)map.resize();}).observe($('map-stage')||document.querySelector('.map-stage'));
}

async function boot(){
  try{
    const [dataResponse,outlineResponse]=await Promise.all([fetch('./data/facilities.json'),fetch('./assets/japan.geojson')]);
    if(!dataResponse.ok||!outlineResponse.ok)throw new Error('データ取得に失敗しました');[data,outline]=await Promise.all([dataResponse.json(),outlineResponse.json()]);
    if(!Array.isArray(data.facilities)||!data.annualYears?.length||!data.monthlyYears?.length)throw new Error('データ形式を確認できません');
    const prefs=[...new Set(data.facilities.map(f=>f.pref))].sort((a,b)=>{const code=p=>data.facilities.find(f=>f.pref===p)?.prefCode||p;return String(code(a)).localeCompare(String(code(b)));});
    for(const p of prefs){const o=document.createElement('option');o.value=p;o.textContent=p;$('pref').append(o);}bind();render();$('loading').hidden=true;initializeMap();
  }catch(error){console.error(error);$('loading').replaceChildren();const p=document.createElement('strong');p.textContent='データを読み込めませんでした。通信状況を確認して再読み込みしてください。';const button=document.createElement('button');button.type='button';button.className='error-retry';button.textContent='再読み込み';button.addEventListener('click',()=>location.reload());$('loading').append(p,button);}
}
boot();
