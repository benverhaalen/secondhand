import type { State, Fact } from './select.ts';
export type Expected = [string,string,unknown];
export type Event = {patch:Partial<State>; questions:Expected[]; status:'shooting'|'asking'|'done'; cls?:string; keys?:string[]};
const f=(value:unknown,source:Fact['source']='you_said',confidence=1,rest:Partial<Fact>={}):Fact=>({value,source,confidence,...rest});
const q=(field:string,kind='pick_one',value:unknown=null):Expected=>[field,kind,value];
const base=(patch:Partial<State>):State=>({capture_id:'walk',item_id:'item',purpose:'sell',confirm_mode:'tap',has_lidar:true,sites:['ebay'],type:null,kept:[],retakes:{},facts:{},lookups:'running',refused:[],...patch});
export type Walk = {name:string; initial:State; cls:string; keys:string[]; events:Event[]};
export const walks: Walk[] = [];
function walk(name:string, initial:Partial<State>, cls:string, keys:string[], events:Event[]): void {
  walks.push({name,initial:base(initial),cls,keys,events});
}
for(const mode of ['tap','auto'] as const) {
 const size=mode==='tap'?[q('size_label','pick_one','M')]:[];
 walk(`A T-shirt ${mode}`,{sites:['ebay','depop','poshmark'],confirm_mode:mode,suggestion:{family:'apparel',p:.86,second_p:.05}},'flat_garment',['front','back','tag'],[
  {patch:{kept:['front'],facts:{dimensions:f({pit_to_pit:52,length:71},'measured',.85),colour:f(['black'],'seen',.9)}},questions:[q('type','pick_one','apparel')],status:'shooting'},
  {patch:{type:'apparel'},questions:[],status:'shooting'},
  {patch:{kept:['front','back']},questions:[],status:'shooting'},
  {patch:{kept:['front','back','tag'],lookups:'done',facts:{size_label:f('M','label',.97),brand:f('Gildan','label',.96),fabric:f('cotton','label',.9),condition:f('good','seen',.7),department:f('unisex','lookup',.92)}},questions:[q('condition','pick_one','good'),...size],status:'asking'},
  {patch:{facts:{condition:f('good')}},questions:size,status:size.length?'asking':'done'},
  ...(size.length?[{patch:{facts:{size_label:f('M')}},questions:[],status:'done' as const}]:[]),
 ]);
}
walk('B Sneakers',{sites:['ebay','depop','mercari'],suggestion:{family:'shoes',p:.91,second_p:.04}},'footwear',['scan','size_label','soles'],[
 {patch:{kept:['scan'],facts:{colour:f(['white'],'seen',.9)}},questions:[q('type','pick_one','shoes')],status:'shooting'},
 {patch:{type:'shoes'},questions:[],status:'shooting'},
 {patch:{kept:['scan','size_label'],lookups:'done',facts:{size:f(10,'label',.96),brand:f('Nike','label',.95),model:f('Air Force 1','lookup',.93)}},questions:[],status:'shooting'},
 {patch:{kept:['scan','size_label','soles'],facts:{condition:f('good','seen',.7)}},questions:[q('condition','pick_one','good'),q('size','number_with_unit',10),q('box','yes_no')],status:'asking'},
 {patch:{facts:{condition:f('good')}},questions:[q('size','number_with_unit',10),q('box','yes_no')],status:'asking'},
 {patch:{facts:{size:f(10)}},questions:[q('box','yes_no')],status:'asking'},
 {patch:{facts:{box:f(false)}},questions:[],status:'done'},
]);
walk('C Handbag',{sites:['ebay','poshmark','depop'],has_lidar:false,suggestion:{family:'bags',p:.78,second_p:.12}},'bag',['ring','inside_tab'],[
 {patch:{kept:['ring'],facts:{colour:f(['brown'],'seen',.9),accessories:f(['dust_bag'],'seen',.92)}},questions:[q('type','pick_one','bags')],status:'shooting'},
 {patch:{type:'bags'},questions:[],status:'shooting'},
 {patch:{kept:['ring','inside_tab'],lookups:'done',facts:{brand:f('Coach','label',.94),condition:f('excellent','seen',.7)}},questions:[q('condition','pick_one','excellent'),q('accessories','pick_many',['dust_bag']),q('dimensions','number_with_unit'),q('model','text')],status:'asking'},
 {patch:{facts:{condition:f('excellent')}},questions:[q('accessories','pick_many',['dust_bag']),q('dimensions','number_with_unit'),q('model','text')],status:'asking'},
 {patch:{facts:{accessories:f(['dust_bag'])}},questions:[q('dimensions','number_with_unit'),q('model','text')],status:'asking'},
 {patch:{facts:{dimensions:f({width:30,height:22,depth:12})}},questions:[q('model','text')],status:'asking'},
 {patch:{refused:['model']},questions:[],status:'done'},
]);
const phoneQs=[q('function'),q('signed_out','yes_no')];
walk('D Phone',{sites:['ebay','mercari','facebook'],kind:'phones_laptops',suggestion:{family:'electronics',p:.88,second_p:.05}},'small_hard',['about_screenshot','front_screen_on','back'],[
 {patch:{kept:['about_screenshot'],facts:{model:f('iPhone 13','label',.97),storage_gb:f(128,'label',.97),battery_health_pct:f(87,'label',.96),brand:f('Apple','label',.97)}},questions:[q('type','pick_one','electronics')],status:'shooting'},
 {patch:{type:'electronics'},questions:[],status:'shooting'},
 {patch:{kept:['about_screenshot','front_screen_on']},questions:[],status:'shooting'},
 {patch:{kept:['about_screenshot','front_screen_on','back'],lookups:'done',facts:{colour:f(['blue'],'seen',.9),condition:f('good','seen',.7)}},questions:[q('condition','pick_one','good'),...phoneQs,q('carrier_lock')],status:'asking'},
 {patch:{facts:{condition:f('good')}},questions:[...phoneQs,q('carrier_lock')],status:'asking'},
 {patch:{facts:{function:f('works')}},questions:[q('signed_out','yes_no'),q('carrier_lock')],status:'asking'},
 {patch:{facts:{signed_out:f(true)}},questions:[q('carrier_lock')],status:'asking'},
 {patch:{facts:{carrier_lock:f('unlocked')}},questions:[],status:'done'},
]);
walk('E Chair',{sites:['facebook','ebay'],rigid:true,extent_cm:85,profile:{handover:'pickup'},suggestion:{family:'furniture',p:.45,second_p:.4}},'medium_hard',['front','scan'],[
 {patch:{kept:['front']},questions:[q('type')],status:'shooting'},
 {patch:{type:'furniture'},cls:'large_bulky',keys:['scan'],questions:[],status:'shooting'},
 {patch:{kept:['front','scan'],lookups:'done',facts:{dimensions:f({width:52,depth:55,height:84},'measured',.9),colour:f(['brown'],'seen',.88),material:f('wood','seen',.82),condition:f('good','seen',.7)}},questions:[q('condition','pick_one','good')],status:'asking'},
 {patch:{facts:{condition:f('good')}},questions:[],status:'done'},
]);
const bundleKeys=['group',...Array.from({length:3},(_,i)=>['front','back','tag'].map(s=>`${s}.${i+1}`)).flat()];
const bundleFacts:Record<string,Fact>={colour:f(['multi'],'seen',.9),department:f('unisex','seen',.85),condition:f('good','seen',.7)};
for(let i=1;i<=3;i++)bundleFacts[`dimensions.${i}`]=f({pit_to_pit:52,length:71},'measured',.85);
Object.assign(bundleFacts,{'size_label.1':f('M','label',.96),'brand.1':f('Gildan','label',.95),'size_label.2':f(null,'label',0,{unknown_reason:'not_read',step:'tag.2'}),'brand.2':f(null,'label',0,{unknown_reason:'not_read',step:'tag.2'}),'size_label.3':f('L','label',.95),'brand.3':f('Hanes','label',.95)});
const bundleQs=[q('condition','pick_one','good'),q('size_label.1','pick_one','M'),q('size_label.2','pick_one'),q('size_label.3','pick_one','L'),q('brand.2','text')];
walk('F Three T-shirts',{sites:['depop','poshmark'],pieces:3,suggestion:{family:'apparel',p:.9,second_p:.03}},'set_bundle',bundleKeys,[
 {patch:{kept:['group'],facts:{lot_count:f(3,'seen',.9)}},questions:[q('type','pick_one','apparel'),q('lot_count','pick_one',3)],status:'shooting'},
 {patch:{type:'apparel',facts:{lot_count:f(3)}},questions:[],status:'shooting'},
 {patch:{kept:bundleKeys,lookups:'none',facts:bundleFacts},questions:[q('tag.2','shot'),q('condition','pick_one','good'),q('size_label.1','pick_one','M'),q('size_label.3','pick_one','L')],status:'asking'},
 {patch:{retakes:{'tag.2':1}},questions:[q('tag.2','shot'),q('condition','pick_one','good'),q('size_label.1','pick_one','M'),q('size_label.3','pick_one','L')],status:'asking'},
 {patch:{retakes:{'tag.2':2}},questions:bundleQs,status:'asking'},
 ...bundleQs.map((entry,i)=>({patch:{facts:{[entry[0]]:f(entry[0]==='condition'?'good':entry[0]==='brand.2'?'Gildan':entry[0]==='size_label.3'?'L':'M')}},questions:bundleQs.slice(i+1),status:i===bundleQs.length-1?'done' as const:'asking' as const})),
]);
const tableVariants=[{label:'120 x 75 cm',value:{width:120,depth:75,height:75},p:.55},{label:'140 x 80 cm',value:{width:140,depth:80,height:75},p:.45}];
for(const has_lidar of [true,false]) {
 const key=has_lidar?'scan':'ring';
 walk(`G${has_lidar?1:2} Close table variants`,{sites:['facebook','ebay'],type:'furniture',rigid:true,extent_cm:120,profile:{handover:'pickup'},has_lidar,variants:{dimensions:tableVariants}},'large_bulky',[key],[
  {patch:{kept:[key],lookups:'done',facts:{condition:f('good','seen',.7),colour:f(['brown'],'seen',.9),material:f('wood','seen',.9),...(has_lidar?{dimensions:f({width:120.6,depth:75.2,height:74.8},'measured',.9)}:{})}},questions:[q('condition','pick_one','good'),...(!has_lidar?[q('dimensions')]:[])],status:'asking'},
  {patch:{facts:{condition:f('good')}},questions:has_lidar?[]:[q('dimensions')],status:has_lidar?'done':'asking'},
  ...(!has_lidar?[{patch:{facts:{dimensions:f(tableVariants[1].value)}},questions:[],status:'done' as const}]:[]),
 ]);
}
