import { useState, type FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';

export function LoginPage(){
 const {signIn,configured}=useAuth(); const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
 async function submit(e:FormEvent){e.preventDefault();setError('');setBusy(true);try{await signIn(email.trim(),password);}catch(err){setError(err instanceof Error?err.message:'Unable to sign in.');}finally{setBusy(false);}}
 return <main className="min-h-screen bg-slate-950 flex items-center justify-center p-6"><form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl space-y-5">
  <div><p className="text-sm font-semibold tracking-widest text-slate-500">ASTRA OIL & GAS</p><h1 className="mt-2 text-2xl font-bold text-slate-900">Procurement Intelligence OS</h1><p className="mt-2 text-sm text-slate-500">Acceso interno.</p></div>
  {!configured&&<p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Supabase no está configurado en este build.</p>}
  <label className="block text-sm font-medium text-slate-700">Email<input value={email} onChange={e=>setEmail(e.target.value)} type="email" required className="mt-1 w-full rounded-lg border p-3"/></label>
  <label className="block text-sm font-medium text-slate-700">Password<input value={password} onChange={e=>setPassword(e.target.value)} type="password" required className="mt-1 w-full rounded-lg border p-3"/></label>
  {error&&<p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
  <button disabled={busy||!configured} className="w-full rounded-lg bg-slate-900 px-4 py-3 font-semibold text-white disabled:opacity-50">{busy?'Entrando…':'Entrar'}</button>
 </form></main>;
}
