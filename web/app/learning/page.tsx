"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import { browserClient } from '@/lib/supabase';
export default function Learning() {
  const db = useMemo(() => browserClient(), []);
  const frame = useRef<HTMLIFrameElement>(null);
  const [message,setMessage] = useState('Local progress stays saved in this browser.');
  const [signed,setSigned] = useState(false), [busy,setBusy] = useState(false);
  const revision = useRef<number | null>(null);
  const pending = useRef<object | null>(null);
  const working = useRef(false);
  const paused = useRef(true);
  const send = (document:object) => frame.current?.contentWindow?.postMessage({type:'learning-load',document},location.origin);
  async function request(method:string, body?:object) {
    const session = await db?.auth.getSession();
    const token = session?.data.session?.access_token;
    if(!token) throw new Error('Sign in to sync your progress.');
    const response = await fetch('/api/learning',{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body ? JSON.stringify(body):undefined});
    const data = await response.json();
    if(!response.ok) throw new Error(data.error || 'Sync unavailable. Your local progress is safe.');
    return data;
  }
  async function flush() {
    if(working.current || paused.current || revision.current === null || !pending.current) return;
    working.current = true;
    const document = pending.current; pending.current = null;
    try {
      setMessage('Saving online…');
      const result = await request('POST',{document,revision:revision.current});
      revision.current = result.revision;
      setMessage('Saved online. Progress, streaks and drafts are synced.');
    } catch(e) {
      pending.current ||= document; paused.current = true;
      setMessage(`${(e as Error).message} Local changes retained. Use Load online or Save this device to reconnect.`);
    } finally { working.current = false; if(!paused.current && pending.current) void flush(); }
  }
  async function connect(load:boolean) {
    setBusy(true); paused.current = true;
    try {
      const remote = await request('GET');
      if(remote && !confirm(load ? 'Replace this device’s progress with your online copy?' : 'Replace online progress with this device’s progress?')) return;
      revision.current = remote?.revision || 0;
      if(load && remote) { pending.current=null; send(remote.document); setMessage('Online progress loaded. Future changes save automatically.'); }
      else { pending.current = JSON.parse(localStorage.getItem('mp-learning-v1') || '{}'); }
      paused.current=false; void flush();
    } catch(e) {setMessage((e as Error).message);}
    finally {setBusy(false);}
  }
  useEffect(() => {
    const {data} = db?.auth.onAuthStateChange((_event,session) => {
      if (_event === 'TOKEN_REFRESHED') return;
      setSigned(!!session); paused.current=true; revision.current=null;
      setMessage(session ? 'Choose Load online or Save this device to begin syncing.' : 'Local mode. Sign in to save online.');
    }) || {data:null};
    const receive = (event:MessageEvent) => {
      if(event.origin !== location.origin || event.source !== frame.current?.contentWindow || event.data?.type !== 'learning-save') return;
      pending.current=event.data.document; void flush();
    };
    window.addEventListener('message',receive);
    return () => {data?.subscription.unsubscribe();window.removeEventListener('message',receive);};
  }, [db]);
  return <main style={{height:'100dvh',display:'flex',flexDirection:'column'}}>
    <div className="studio" style={{minHeight:0,padding:'12px 18px'}}>
      <strong>Learning sync</strong>{' '}
      {!db ? <span>Online saving needs Supabase setup. Local learning is ready below.</span> : !signed ? <a href="/login?next=learning">Sign in to save online →</a> : <>
        <button disabled={busy} onClick={()=>connect(true)}>Load online</button>{' '}
        <button disabled={busy} onClick={()=>connect(false)}>Save this device</button>{' '}
        <button onClick={()=>db.auth.signOut()}>Sign out</button>
      </>}
      <p role="status" style={{fontSize:13,margin:0}}>{message}</p>
    </div>
    <iframe ref={frame} title="Interactive learning lab" src="/learning/lab.html" style={{border:0,width:'100%',flex:1}} />
  </main>;
}
