import axios from 'axios'
export type Instrument = {
 id:string;name:string;symbol:string;category:string;value:number;unit:string;date:string;
 source:string;description:string;image?:string;change?:number;marketCap?:number;volume?:number;group?:string;stale?:boolean;
}
export type Snapshot={generatedAt:string;items:Instrument[]}
export async function loadMarkets():Promise<Snapshot>{
 const {data}=await axios.get<Snapshot>(`${import.meta.env.BASE_URL}data/markets.json`,{timeout:15000})
 if(!Array.isArray(data.items)||!data.items.length||data.items.some(i=>!i.id||typeof i.value!=='number'))throw new Error('Invalid market snapshot.')
 return data
}
