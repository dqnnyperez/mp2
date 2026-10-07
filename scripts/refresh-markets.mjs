import axios from 'axios'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
const endpoints={forex:'/api/v1/forex/latest',crypto:'/api/v1/crypto/markets?per_page=8',quotes:'/api/v2/market/batch-quotes?symbols=%5EGSPC,%5ENDX,%5EDJI,%5EVIX',bonds:'/api/v2/fixed-income/treasury/yield-curve',sectors:'/api/v2/market/batch-quotes?symbols=XLK,XLF,XLV,XLY,XLC,XLI,XLP,XLE,XLU,XLRE,XLB'}
let key=process.env.SUGRA_API_KEY
if(!key){try{key=(await readFile('.env.local','utf8')).match(/^VITE_SUGRA_API_KEY=(.+)$/m)?.[1].trim()}catch{}}
if(!key)throw new Error('Set SUGRA_API_KEY or configure .env.local.')
const responses={}
await Promise.all(Object.entries(endpoints).map(async([name,path])=>{
 try{responses[name]=(await axios.get(`https://sugra.ai${path}`,{headers:{'x-api-key':key},timeout:45000})).data}catch{throw new Error(`Sugra ${name} request failed; existing snapshot was not changed.`)}
}))
const items=[]
const finite=v=>typeof v==='number'&&Number.isFinite(v)
const source=n=>responses[n].meta?.source??'Sugra'
for(const [code,value] of Object.entries(responses.forex.data.rates))if(finite(value))items.push({id:`fx-${code.toLowerCase()}`,name:new Intl.DisplayNames(['en'],{type:'currency'}).of(code),symbol:`EUR/${code}`,category:'Forex',value,unit:`${code} per EUR`,date:responses.forex.data.date,source:source('forex'),description:'Daily ECB reference exchange rate. One euro buys the displayed amount of the quote currency.'})
for(const c of responses.crypto.data)if(finite(c.current_price))items.push({id:`crypto-${c.id}`,name:c.name,symbol:c.symbol.toUpperCase(),category:'Crypto',value:c.current_price,unit:'USD',date:c.last_updated,source:source('crypto'),image:c.image,change:c.price_change_percentage_24h,marketCap:c.market_cap,volume:c.total_volume,group:['tether','usd-coin'].includes(c.id)?'Stablecoins':'Other crypto',description:'Cryptocurrency spot-market snapshot. Change and trading volume cover the preceding 24 hours.'})
for(const q of responses.quotes.data)if(finite(q.regularMarketPrice))items.push({id:`index-${q.symbol.replace('^','').toLowerCase()}`,name:q.shortName,symbol:q.symbol,category:q.symbol==='^VIX'?'Volatility':'Indices',value:q.regularMarketPrice,unit:'Index points',date:q.regularMarketTime?new Date(q.regularMarketTime*1000).toISOString():responses.quotes.meta.data_time,source:source('quotes'),change:q.regularMarketChangePercent,description:q.symbol==='^VIX'?'CBOE VIX: expected 30-day S&P 500 volatility implied by option prices.':'Equity index level from the consolidated market feed.'})
for(const p of responses.bonds.data.points)if(finite(p.yield))items.push({id:`bond-${p.tenor.toLowerCase()}`,name:`US Treasury · ${p.tenor}`,symbol:`UST-${p.tenor}`,category:'Bonds',value:p.yield,unit:'% annual yield',date:responses.bonds.data.date,source:source('bonds'),stale:responses.bonds.meta?.stale??false,description:'Nominal Treasury par yield for this maturity; a yield observation rather than the price of an individual bond.'})
const sectorNames={XLK:'Information Technology',XLF:'Financials',XLV:'Health Care',XLY:'Consumer Discretionary',XLC:'Communication Services',XLI:'Industrials',XLP:'Consumer Staples',XLE:'Energy',XLU:'Utilities',XLRE:'Real Estate',XLB:'Materials'}
for(const q of responses.sectors.data)if(finite(q.regularMarketPrice))items.push({id:`sector-${q.symbol.toLowerCase()}`,name:sectorNames[q.symbol],symbol:q.symbol,category:'Sectors',value:q.regularMarketPrice,unit:'USD / ETF share',date:new Date(q.regularMarketTime*1000).toISOString(),source:source('sectors'),change:q.regularMarketChangePercent,description:`${q.symbol} is a sector ETF used as a proxy for ${sectorNames[q.symbol]}. Daily change is the ETF price return, not a Bloomberg sector-index total return.`})
if(items.filter(i=>i.category==='Sectors').length!==11)throw new Error('Expected all eleven sector ETFs; snapshot was not changed.')
for(const category of ['Forex','Crypto','Indices','Volatility','Bonds'])if(!items.some(i=>i.category===category))throw new Error(`Missing ${category}; existing snapshot was not changed.`)
await mkdir('public/data',{recursive:true})
await writeFile('public/data/markets.json',JSON.stringify({generatedAt:new Date().toISOString(),items},null,2)+'\n')
console.log(`Saved ${items.length} instruments across six categories. No key is included.`)
