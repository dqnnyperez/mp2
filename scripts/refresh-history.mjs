import axios from 'axios'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
let key=process.env.SUGRA_API_KEY
if(!key){try{key=(await readFile('.env.local','utf8')).match(/^VITE_SUGRA_API_KEY=(.+)$/m)?.[1].trim()}catch{}}
if(!key)throw new Error('Configure a Sugra key.')
const {items}=JSON.parse(await readFile('public/data/markets.json','utf8'))
await mkdir('public/data/history',{recursive:true})
for(const item of items.filter(i=>i.category==='Crypto')){
 const coin=item.id.replace('crypto-','')
 try{
  const {data}=await axios.get(`https://sugra.ai/api/v1/crypto/${coin}/history?days=30`,{headers:{'x-api-key':key},timeout:45000})
  const points=data.data.filter(p=>Number.isFinite(p.price)&&Number.isFinite(Date.parse(p.timestamp))).map(p=>({timestamp:p.timestamp,price:p.price})).sort((a,b)=>Date.parse(a.timestamp)-Date.parse(b.timestamp))
  if(points.length<2)throw new Error('Insufficient history')
  await writeFile(`public/data/history/${coin}.json`,JSON.stringify({source:data.meta?.source??'Sugra Crypto',points})+'\n')
  console.log(`Saved ${coin}: ${points.length} observations`)
 }catch{console.error(`History unavailable for ${coin}; existing file retained.`);process.exitCode=1}
}
