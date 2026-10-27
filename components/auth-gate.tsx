'use client';

import { type ReactNode, type SubmitEvent, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Atom } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [signup, setSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      if (active) { setSession(next); setLoading(false); }
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setNotice('로그인 상태를 확인하지 못했습니다. 다시 시도해 주세요.');
      setSession(data.session);
      setLoading(false);
    }).catch(() => {
      if (!active) return;
      setNotice('로그인 상태를 확인하지 못했습니다. 다시 로그인해 주세요.');
      setLoading(false);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const emailValue = form.get('email');
    const passwordValue = form.get('password');
    const email = typeof emailValue === 'string' ? emailValue.trim() : '';
    const password = typeof passwordValue === 'string' ? passwordValue : '';
    setBusy(true);
    setNotice('');
    try {
      const result = signup
        ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
        : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) {
        const message = result.error.message;
        setNotice(/invalid login/i.test(message) ? '이메일 또는 비밀번호를 확인해 주세요.'
          : /email not confirmed/i.test(message) ? '메일함에서 가입 확인 링크를 눌러 주세요.'
          : /rate limit/i.test(message) ? '요청이 많습니다. 잠시 후 다시 시도해 주세요.'
          : /fetch|network|timeout/i.test(message) ? '로그인 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.'
          : `로그인 요청을 처리하지 못했습니다: ${message}`);
      } else if (signup && !result.data.session) {
        setNotice('가입 확인 메일을 보냈습니다. 메일의 링크를 누른 뒤 로그인해 주세요.');
        setSignup(false);
      }
    } catch {
      setNotice('로그인 서비스에 연결하지 못했습니다. 다시 시도해 주세요.');
    } finally { setBusy(false); }
  }

  if (loading) return <main className="grid min-h-screen place-items-center"><output>로그인 확인 중…</output></main>;
  if (session) return <div key={session.user.id}>{children}</div>;
  return (
    <main className="grid min-h-screen place-items-center bg-background p-5">
      <section className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm">
        <Atom className="mb-5 size-10 text-primary" />
        <h1 className="text-2xl font-bold">LabFlow</h1>
        <p className="mt-2 text-sm text-muted-foreground">로그인하고 나만의 연구 기록을 안전하게 보관하세요.</p>
        <form onSubmit={submit} className="mt-7 grid gap-4">
          <label htmlFor="auth-email" className="grid gap-2 text-sm font-medium">이메일<Input id="auth-email" name="email" type="email" autoComplete="email" required disabled={busy} /></label>
          <label htmlFor="auth-password" className="grid gap-2 text-sm font-medium">비밀번호<Input id="auth-password" name="password" type="password" minLength={8} autoComplete={signup ? 'new-password' : 'current-password'} required disabled={busy} /></label>
          <p className="text-xs text-muted-foreground">비밀번호는 8자 이상 입력해 주세요.</p>
          {notice && <output className="text-sm" aria-live="polite">{notice}</output>}
          {!isSupabaseConfigured && <output className="text-sm text-destructive">연구 저장소 연결을 준비 중입니다. 잠시 후 다시 접속해 주세요.</output>}
          <Button type="submit" disabled={busy || !isSupabaseConfigured}>{busy ? '처리 중…' : signup ? '회원가입' : '로그인'}</Button>
          <Button type="button" variant="ghost" disabled={busy} onClick={() => { setSignup(!signup); setNotice(''); }}>{signup ? '이미 계정이 있어요 · 로그인' : '처음 사용해요 · 회원가입'}</Button>
        </form>
      </section>
    </main>
  );
}
