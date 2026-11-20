import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useT } from '@/lib/i18n'

type Channel = { id: string; title: string }
type Video = { id: string; topic: string; title: string | null; status: string }
type Asset = {
  id: string; title: string; sourceName: string; sourceUrl: string; assetUrl: string
  licenseType: string; commercialUse: boolean; effectiveStatus: string; rightsEvidenceUrl: string | null
}
type Variant = { id: string; prompt: string; isSelected: boolean; previewUrl: string }
type Revenue = {
  channel: { title: string }; startDate: string; endDate: string; current: { views: string; estimatedRevenue: number | null; estimatedAdRevenue: number | null; rpm: number | null; adRpm: number | null; daysWithRevenue: number }
  previous: { views: string; estimatedRevenue: number | null }; revenueChangePct: number | null; adRevenueChangePct: number | null
  daily: Array<{ date: string; views: string; estimatedRevenue: number | null; estimatedAdRevenue: number | null }>; limitations: string[]
}
const money = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })
const compact = new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 })
const dateValue = (ago: number) => {
  const date = new Date(); date.setDate(date.getDate() - ago)
  return [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-')
}
const moneyValue = (value: number | null) => value === null ? '—' : money.format(value)
const percent = (value: number | null) => value === null ? '—' : (value > 0 ? '+' : '') + value.toFixed(1) + '%'
const licenseOptions = [['unknown','Unknown'],['public_domain','Public domain'],['cc0','CC0'],['cc_by','CC BY'],['cc_by_sa','CC BY-SA'],['commercial_stock','Commercial stock'],['editorial_only','Editorial only'],['cc_by_nc','CC BY-NC'],['cc_by_nd','CC BY-ND'],['custom','Custom']]

export function CreatorStudioDashboard() {
  const t = useT('dashboard')
  const label = (key: string) => t('creatorStudio.' + key)
  const [tab,setTab] = useState<'revenue'|'footage'|'thumbnails'>('revenue')
  const [error,setError] = useState('')
  const [busy,setBusy] = useState(false)
  const [channels,setChannels] = useState<Channel[]>([])
  const [channelId,setChannelId] = useState('')
  const [startDate,setStartDate] = useState(() => dateValue(30))
  const [endDate,setEndDate] = useState(() => dateValue(2))
  const [revenue,setRevenue] = useState<Revenue|null>(null)
  const [assets,setAssets] = useState<Asset[]>([])
  const [reviewQueue,setReviewQueue] = useState<Asset[]>([])
  const [videos,setVideos] = useState<Video[]>([])
  const [projectId,setProjectId] = useState('')
  const [variants,setVariants] = useState<Variant[]>([])
  const [prompt,setPrompt] = useState('')
  const [footage,setFootage] = useState({title:'',sourceName:'',sourceUrl:'',assetUrl:'',licenseType:'unknown',commercialUse:false,modificationAllowed:false,attributionRequired:false,attributionText:'',rightsEvidenceUrl:'',rightsEvidenceNotes:''})

  useEffect(() => {
    let alive=true
    Promise.all([
      fetch('/api/youtube/channels',{cache:'no-store'}).then(async r=>{const p=await r.json();if(!r.ok)throw new Error(p.error);return p}),
      fetch('/api/video',{cache:'no-store'}).then(async r=>{const p=await r.json();if(!r.ok)throw new Error(p.error);return p}),
    ]).then(([channelsPayload,videoPayload])=>{
      if(!alive)return
      const channelList=(channelsPayload.channels??[]) as Channel[]
      setChannels(channelList);setChannelId(channelList[0]?.id??'')
      const completed=((videoPayload.list??[]) as Video[]).filter(v=>v.status==='done')
      setVideos(completed);setProjectId(completed[0]?.id??'')
    }).catch(e=>{if(alive)setError(e instanceof Error?e.message:label('loadFailed'))})
    return ()=>{alive=false}
  },[])

  async function loadFootage() {
    const response=await fetch('/api/studio?resource=footage',{cache:'no-store'})
    const payload=await response.json()
    if(!response.ok)throw new Error(payload.error||label('loadFailed'))
    setAssets(payload.assets??[]);setReviewQueue(payload.reviewQueue??[])
  }
  async function loadVariants(id:string) {
    if(!id){setVariants([]);return}
    const response=await fetch('/api/studio?resource=thumbnails&projectId='+encodeURIComponent(id),{cache:'no-store'})
    const payload=await response.json()
    if(!response.ok)throw new Error(payload.error||label('loadFailed'))
    setVariants(payload.variants??[])
  }
  useEffect(()=>{if(tab==='footage')void loadFootage().catch(e=>setError(e instanceof Error?e.message:label('loadFailed')))},[tab])
  useEffect(()=>{if(tab==='thumbnails')void loadVariants(projectId).catch(e=>setError(e instanceof Error?e.message:label('loadFailed')))},[tab,projectId])

  async function loadRevenue(event:FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if(!channelId||startDate>endDate)return
    setBusy(true);setError('');setRevenue(null)
    try {
      const query=new URLSearchParams({resource:'revenue',channelId,startDate,endDate})
      const response=await fetch('/api/studio?'+query.toString(),{cache:'no-store'})
      const payload=await response.json()
      if(!response.ok)throw new Error(payload.error||label('reportFailed'))
      setRevenue(payload as Revenue)
    } catch(e){setError(e instanceof Error?e.message:label('reportFailed'))}
    finally{setBusy(false)}
  }
  async function addFootage(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setError('')
    try {
      const body={...footage,attributionText:footage.attributionText||undefined,rightsEvidenceUrl:footage.rightsEvidenceUrl||undefined,rightsEvidenceNotes:footage.rightsEvidenceNotes||undefined}
      const response=await fetch('/api/studio?resource=footage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
      const payload=await response.json()
      if(!response.ok)throw new Error(payload.error||label('saveFailed'))
      setFootage({title:'',sourceName:'',sourceUrl:'',assetUrl:'',licenseType:'unknown',commercialUse:false,modificationAllowed:false,attributionRequired:false,attributionText:'',rightsEvidenceUrl:'',rightsEvidenceNotes:''})
      await loadFootage()
    } catch(e){setError(e instanceof Error?e.message:label('saveFailed'))}
    finally{setBusy(false)}
  }
  async function reviewFootage(id:string,reviewStatus:'approved'|'rejected') {
    setBusy(true);setError('')
    try {
      const response=await fetch('/api/studio?resource=footage',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,reviewStatus})})
      const payload=await response.json()
      if(!response.ok)throw new Error(payload.error||label('reviewFailed'))
      await loadFootage()
    }catch(e){setError(e instanceof Error?e.message:label('reviewFailed'))}
    finally{setBusy(false)}
  }
  async function deleteFootage(id:string) {
    if(!window.confirm(label('deleteConfirm')))return
    const response=await fetch('/api/studio?resource=footage',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})})
    if(!response.ok){setError(label('deleteFailed'));return};await loadFootage()
  }
  async function generateThumbnail(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setError('')
    try {
      const response=await fetch('/api/studio?resource=thumbnails',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({videoProjectId:projectId,prompt})})
      const payload=await response.json()
      if(!response.ok)throw new Error(payload.error||label('generateFailed'))
      setPrompt('');await loadVariants(projectId)
    }catch(e){setError(e instanceof Error?e.message:label('generateFailed'))}
    finally{setBusy(false)}
  }
  async function selectThumbnail(variantId:string) {
    setBusy(true)
    try {
      const response=await fetch('/api/studio?resource=thumbnails',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({variantId})})
      const payload=await response.json()
      if(!response.ok)throw new Error(payload.error||label('selectFailed'))
      await loadVariants(projectId)
    }catch(e){setError(e instanceof Error?e.message:label('selectFailed'))}
    finally{setBusy(false)}
  }
  async function deleteThumbnail(id:string) {
    if(!window.confirm(label('deleteConfirm')))return
    const response=await fetch('/api/studio?resource=thumbnails&id='+encodeURIComponent(id),{method:'DELETE'})
    if(!response.ok){setError(label('deleteFailed'));return};await loadVariants(projectId)
  }
  const updateFootage=(key:string,value:string|boolean)=>setFootage(old=>({...old,[key]:value}))

  return <div className="space-y-6">
    <header className="space-y-2"><h1 className="text-2xl font-bold tracking-tight">{label('title')}</h1><p className="max-w-3xl text-sm text-muted-foreground">{label('subtitle')}</p></header>
    <div className="flex flex-wrap gap-2" role="tablist">
      {(['revenue','footage','thumbnails'] as const).map(key=><button key={key} role="tab" aria-selected={tab===key} onClick={()=>{setTab(key);setError('')}} className={tab===key?'h-10 rounded-md bg-primary px-4 text-sm text-primary-foreground':'h-10 rounded-md border border-border px-4 text-sm'}>{label(key+'Tab')}</button>)}
    </div>
    {error?<div role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">{error}</div>:null}

    {tab==='revenue'?<section className="space-y-4">
      <form onSubmit={loadRevenue} className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-2 text-sm"><span>{label('channel')}</span><select value={channelId} onChange={e=>setChannelId(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3">{channels.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
        <label className="space-y-2 text-sm"><span>{label('startDate')}</span><input type="date" value={startDate} max={endDate} onChange={e=>setStartDate(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3"/></label>
        <label className="space-y-2 text-sm"><span>{label('endDate')}</span><input type="date" value={endDate} min={startDate} max={dateValue(1)} onChange={e=>setEndDate(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3"/></label>
        <div className="flex items-end"><button disabled={busy||!channelId||startDate>endDate} className="h-10 w-full rounded-md bg-primary px-4 text-sm text-primary-foreground disabled:opacity-50">{busy?label('loading'):label('loadRevenue')}</button></div>
      </form>
      {!channels.length?<p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">{label('connectYouTube')}</p>:null}
      {revenue?<div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2"><h2 className="text-lg font-semibold">{revenue.channel.title}</h2><p className="text-xs text-muted-foreground">{revenue.startDate} — {revenue.endDate} · {revenue.current.daysWithRevenue} {label('daysData')}</p></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label={label('estimatedRevenue')} value={moneyValue(revenue.current.estimatedRevenue)} note={label('change')+': '+percent(revenue.revenueChangePct)}/>
          <Metric label={label('adRevenue')} value={moneyValue(revenue.current.estimatedAdRevenue)} note={label('change')+': '+percent(revenue.adRevenueChangePct)}/>
          <Metric label={label('rpm')} value={moneyValue(revenue.current.rpm)} note={label('rpmHint')}/>
          <Metric label={label('adRpm')} value={moneyValue(revenue.current.adRpm)} note={label('rpmHint')}/>
          <Metric label={label('views')} value={compact.format(BigInt(revenue.current.views))}/>
          <Metric label={label('previousRevenue')} value={moneyValue(revenue.previous.estimatedRevenue)} note={label('previousViews')+': '+compact.format(BigInt(revenue.previous.views))}/>
        </div>
        {revenue.daily.length?<div className="overflow-x-auto rounded-lg border border-border"><table className="w-full min-w-[600px] text-left text-sm"><thead className="bg-muted/60 text-xs text-muted-foreground"><tr><th className="px-3 py-3">{label('date')}</th><th className="px-3 py-3">{label('views')}</th><th className="px-3 py-3">{label('estimatedRevenue')}</th><th className="px-3 py-3">{label('adRevenue')}</th></tr></thead><tbody className="divide-y divide-border">{[...revenue.daily].reverse().map(row=><tr key={row.date}><td className="px-3 py-3">{row.date}</td><td className="px-3 py-3 tabular-nums">{compact.format(BigInt(row.views))}</td><td className="px-3 py-3 tabular-nums">{moneyValue(row.estimatedRevenue)}</td><td className="px-3 py-3 tabular-nums">{moneyValue(row.estimatedAdRevenue)}</td></tr>)}</tbody></table></div>:<p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">{label('noRevenueRows')}</p>}
        <div className="rounded-lg border border-border bg-muted/20 p-4"><h3 className="mb-2 text-sm font-semibold">{label('limitations')}</h3><ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">{revenue.limitations.map(x=><li key={x}>{x}</li>)}</ul></div>
      </div>:null}
    </section>:null}

    {tab==='footage'?<section className="space-y-5">
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">{label('rightsNotice')}</div>
      <form onSubmit={addFootage} className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-2">
        <Field label={label('assetTitle')}><input required value={footage.title} onChange={e=>updateFootage('title',e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3"/></Field>
        <Field label={label('sourceName')}><input required value={footage.sourceName} onChange={e=>updateFootage('sourceName',e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3"/></Field>
        <Field label={label('sourceUrl')}><input required type="url" placeholder="https://" value={footage.sourceUrl} onChange={e=>updateFootage('sourceUrl',e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3"/></Field>
        <Field label={label('assetUrl')}><input required type="url" placeholder="https://" value={footage.assetUrl} onChange={e=>updateFootage('assetUrl',e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3"/></Field>
        <Field label={label('license')}><select value={footage.licenseType} onChange={e=>updateFootage('licenseType',e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3">{licenseOptions.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></Field>
        <Field label={label('evidenceUrl')}><input type="url" placeholder="https://" value={footage.rightsEvidenceUrl} onChange={e=>updateFootage('rightsEvidenceUrl',e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3"/></Field>
        <Field label={label('evidenceNotes')}><textarea value={footage.rightsEvidenceNotes} onChange={e=>updateFootage('rightsEvidenceNotes',e.target.value)} className="min-h-20 w-full rounded-md border border-input bg-background p-3"/></Field>
        <div className="flex flex-wrap items-center gap-4 text-sm md:col-span-2">
          <label className="flex items-center gap-2"><input type="checkbox" checked={footage.commercialUse} onChange={e=>updateFootage('commercialUse',e.target.checked)}/>{label('commercialUse')}</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={footage.modificationAllowed} onChange={e=>updateFootage('modificationAllowed',e.target.checked)}/>{label('modifications')}</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={footage.attributionRequired} onChange={e=>updateFootage('attributionRequired',e.target.checked)}/>{label('attribution')}</label>
        </div>
        <div className="md:col-span-2"><button disabled={busy} className="h-10 rounded-md bg-primary px-4 text-sm text-primary-foreground disabled:opacity-50">{label('registerFootage')}</button></div>
      </form>
      {reviewQueue.length?<div className="space-y-3"><h2 className="text-lg font-semibold">{label('reviewQueue')}</h2>{reviewQueue.map(asset=><article key={asset.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"><div><p className="font-medium">{asset.title}</p><p className="text-xs text-muted-foreground">{asset.sourceName} · {asset.licenseType} · {asset.rightsEvidenceUrl?label('evidenceAttached'):label('evidenceMissing')}</p><a href={asset.rightsEvidenceUrl||asset.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline">{label('openEvidence')}</a></div><div className="flex gap-2"><button disabled={busy||!asset.rightsEvidenceUrl||asset.licenseType==='unknown'} onClick={()=>reviewFootage(asset.id,'approved')} className="h-9 rounded-md bg-primary px-3 text-sm text-primary-foreground disabled:opacity-40">{label('approve')}</button><button disabled={busy} onClick={()=>reviewFootage(asset.id,'rejected')} className="h-9 rounded-md border border-border px-3 text-sm">{label('reject')}</button></div></article>)}</div>:null}
      <div className="space-y-3"><h2 className="text-lg font-semibold">{label('myFootage')}</h2>{assets.length===0?<p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">{label('noFootage')}</p>:<div className="overflow-x-auto rounded-lg border border-border"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-muted/60 text-xs text-muted-foreground"><tr><th className="px-3 py-3">{label('assetTitle')}</th><th className="px-3 py-3">{label('license')}</th><th className="px-3 py-3">{label('commercialUse')}</th><th className="px-3 py-3">{label('status')}</th><th className="px-3 py-3">{label('actions')}</th></tr></thead><tbody className="divide-y divide-border">{assets.map(asset=><tr key={asset.id}><td className="px-3 py-3"><p className="font-medium">{asset.title}</p><a href={asset.assetUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline">{asset.sourceName}</a></td><td className="px-3 py-3">{asset.licenseType}</td><td className="px-3 py-3">{asset.commercialUse?label('yes'):label('no')}</td><td className="px-3 py-3">{asset.effectiveStatus}</td><td className="px-3 py-3"><button onClick={()=>deleteFootage(asset.id)} className="text-xs text-destructive underline">{label('delete')}</button></td></tr>)}</tbody></table></div>}</div>
    </section>:null}

    {tab==='thumbnails'?<section className="space-y-4">
      {videos.length===0?<p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">{label('noCompletedVideo')}</p>:<form onSubmit={generateThumbnail} className="space-y-3 rounded-xl border border-border bg-card p-4">
        <Field label={label('videoProject')}><select value={projectId} onChange={e=>setProjectId(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3">{videos.map(video=><option key={video.id} value={video.id}>{video.title||video.topic}</option>)}</select></Field>
        <Field label={label('creativeDirection')}><textarea required minLength={8} maxLength={900} value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder={label('promptPlaceholder')} className="min-h-24 w-full rounded-md border border-input bg-background p-3"/></Field>
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-muted-foreground">{label('generationNote')}</p><button disabled={busy||!projectId||prompt.trim().length<8} className="h-10 rounded-md bg-primary px-4 text-sm text-primary-foreground disabled:opacity-50">{busy?label('generating'):label('generate')}</button></div>
      </form>}
      <div className="space-y-3"><h2 className="text-lg font-semibold">{label('variations')}</h2>{variants.length===0?<p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">{label('noVariants')}</p>:<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{variants.map(v=><article key={v.id} className="overflow-hidden rounded-xl border border-border bg-card"><img src={v.previewUrl} alt={label('thumbnailAlt')} className="aspect-video w-full object-cover"/><div className="space-y-2 p-3"><p className="line-clamp-2 text-xs text-muted-foreground">{v.prompt}</p>{v.isSelected?<span className="inline-flex rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">{label('selected')}</span>:<button disabled={busy} onClick={()=>selectThumbnail(v.id)} className="h-9 rounded-md border border-border px-3 text-sm">{label('selectFinal')}</button>}<button onClick={()=>deleteThumbnail(v.id)} className="ml-3 text-xs text-destructive underline">{label('delete')}</button></div></article>)}</div>}</div>
    </section>:null}
  </div>
}
function Metric({label,value,note}:{label:string;value:string;note?:string}){return <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-xl font-semibold tabular-nums">{value}</p>{note?<p className="mt-1 text-xs text-muted-foreground">{note}</p>:null}</div>}
function Field({label,children}:{label:string;children:ReactNode}){return <label className="block space-y-2 text-sm"><span>{label}</span>{children}</label>}
