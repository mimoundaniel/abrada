import { supabase, hasSupa } from './supabase'
const LS = 'adraba-v3'
export const DEFAULTS = {
  members: [
    { id:'m1',name:'Menny',accounts:['CST','IB','GS','FIBI','Discount','Leumi','UBS','MS','Citibank','Chase'] },
    { id:'m2',name:'Itamar',accounts:['CST','Discount','Poalim','IB','MS'] },
    { id:'m3',name:'Amir',accounts:['CST','Discount'] },
    { id:'m4',name:'Dorit',accounts:['CST','Discount'] },
    { id:'m5',name:'Rachel',accounts:['CST','Discount'] },
    { id:'m6',name:'Yechezkel',accounts:['CST','Discount'] },
  ],
  institutions:['CST','IB','GS','FIBI','Discount','Leumi','UBS','MS','Citibank','Chase','Poalim'],
  assets:[
    {id:'a1',name:'DFNS',ticker:'DFNS',desc:'Defense Stock',type:'Stock',liquid:true},
    {id:'a2',name:'POLA',ticker:'POLA',desc:'Pola Stock',type:'Stock',liquid:true},
    {id:'a3',name:'PHGE',ticker:'PHGE',desc:'Phge Stock',type:'Stock',liquid:true},
    {id:'a4',name:'Apple',ticker:'AAPL',desc:'Apple Inc.',type:'Stock',liquid:true},
    {id:'a5',name:'Citigroup',ticker:'C',desc:'Citigroup Inc.',type:'Stock',liquid:true},
  ],
  transactions:[],
  assetValues:{},
  prices:{},
}
const lsGet=()=>{try{const r=localStorage.getItem(LS);return r?JSON.parse(r):null}catch{return null}}
const lsSet=d=>localStorage.setItem(LS,JSON.stringify(d))
const sbGet=async()=>{if(!hasSupa())return null;const{data}=await supabase.from('app_state').select('state').eq('id','main').single();return data?.state&&Object.keys(data.state).length>0?data.state:null}
const sbSet=async s=>{if(!hasSupa())return;await supabase.from('app_state').upsert({id:'main',state:s,updated_at:new Date().toISOString()})}
export async function loadData(){if(hasSupa()){const d=await sbGet();if(d){lsSet(d);return d}};const ls=lsGet();if(ls)return ls;const f={...DEFAULTS};await sbSet(f);lsSet(f);return f}
export async function saveData(d){lsSet(d);await sbSet(d)}
export async function resetData(){const f={...DEFAULTS};lsSet(f);await sbSet(f);return f}