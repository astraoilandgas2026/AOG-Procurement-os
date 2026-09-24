import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/data/supabase-client';

type AuthContextValue = { user: User | null; loading: boolean; configured: boolean; signIn: (email:string,password:string)=>Promise<void>; signOut:()=>Promise<void>; };
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = getSupabaseClient();
  const [user,setUser]=useState<User|null>(null);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    if(!client){setLoading(false);return;}
    client.auth.getSession().then(({data})=>{setUser(data.session?.user??null);setLoading(false);});
    const {data}=client.auth.onAuthStateChange((_event,session)=>{setUser(session?.user??null);setLoading(false);});
    return ()=>data.subscription.unsubscribe();
  },[client]);
  const signIn=async(email:string,password:string)=>{if(!client)throw new Error('Supabase is not configured.');const {error}=await client.auth.signInWithPassword({email,password});if(error)throw error;};
  const signOut=async()=>{if(!client)return;const {error}=await client.auth.signOut();if(error)throw error;};
  return <AuthContext.Provider value={{user,loading,configured:Boolean(client),signIn,signOut}}>{children}</AuthContext.Provider>;
}
export function useAuth(){const value=useContext(AuthContext);if(!value)throw new Error('useAuth must be used inside AuthProvider');return value;}
