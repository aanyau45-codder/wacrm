'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Loader2, Smartphone, AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { WhatsAppConfig } from '@/types';

/**
 * "Connect WhatsApp Business app" — Meta Embedded Signup in coexistence
 * mode. The business keeps chatting from the Business app on their phone;
 * Argon CRM receives the same conversations through the Cloud API.
 *
 * Hidden unless the server has META_APP_ID + META_APP_SECRET +
 * META_ES_CONFIG_ID (GET /api/whatsapp/embedded-signup).
 */

interface SignupSetup {
  enabled: boolean;
  appId?: string;
  configId?: string;
}

interface SessionInfo {
  event: string;
  phone_number_id?: string;
  waba_id?: string;
  business_id?: string;
}

interface FacebookSdk {
  init(opts: { appId: string; autoLogAppEvents: boolean; xfbml: boolean; version: string }): void;
  login(
    cb: (res: { authResponse?: { code?: string } | null }) => void,
    opts: Record<string, unknown>,
  ): void;
}

declare global {
  interface Window {
    FB?: FacebookSdk;
    fbAsyncInit?: () => void;
  }
}

const SDK_SRC = 'https://connect.facebook.net/en_US/sdk.js';
const GRAPH_VERSION = 'v21.0';

function loadSdk(appId: string): Promise<FacebookSdk> {
  return new Promise((resolve, reject) => {
    if (window.FB) return resolve(window.FB);
    window.fbAsyncInit = () => {
      window.FB!.init({ appId, autoLogAppEvents: true, xfbml: false, version: GRAPH_VERSION });
      resolve(window.FB!);
    };
    if (!document.querySelector(`script[src="${SDK_SRC}"]`)) {
      const s = document.createElement('script');
      s.src = SDK_SRC;
      s.async = true;
      s.defer = true;
      s.crossOrigin = 'anonymous';
      s.onerror = () => reject(new Error('sdk'));
      document.body.appendChild(s);
    }
  });
}

export function BusinessAppConnect({
  config,
  canEdit,
  onConnected,
}: {
  config: WhatsAppConfig | null;
  canEdit: boolean;
  onConnected: () => void;
}) {
  const t = useTranslations('Settings.whatsapp.businessApp');
  const [setup, setSetup] = useState<SignupSetup | null>(null);
  const [busy, setBusy] = useState(false);
  const sessionRef = useRef<SessionInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/whatsapp/embedded-signup')
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((d: SignupSetup) => !cancelled && setSetup(d))
      .catch(() => !cancelled && setSetup({ enabled: false }));
    return () => {
      cancelled = true;
    };
  }, []);

  // Embedded Signup reports which WABA / number was picked (or a cancel)
  // via postMessage from facebook.com.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      let host = '';
      try {
        host = new URL(event.origin).hostname;
      } catch {
        return;
      }
      if (host !== 'facebook.com' && !host.endsWith('.facebook.com')) return;
      let data: { type?: string; event?: string; data?: Record<string, string> };
      try {
        data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      if (data?.type !== 'WA_EMBEDDED_SIGNUP' || !data.event) return;
      sessionRef.current = { event: data.event, ...(data.data ?? {}) };
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  if (!setup?.enabled) return null;

  const isCoex = config?.connection_type === 'coexistence' && config.status === 'connected';

  const finish = async (code: string) => {
    // The code can arrive a moment before the session message.
    for (let i = 0; i < 15 && !sessionRef.current; i++) {
      await new Promise((r) => setTimeout(r, 200));
    }
    const session = sessionRef.current;
    if (session?.event === 'CANCEL') {
      toast.info(t('cancelled'));
      return;
    }
    if (session?.event === 'ERROR') {
      toast.error(t('failed'));
      return;
    }
    const res = await fetch('/api/whatsapp/embedded-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        event: session?.event,
        phone_number_id: session?.phone_number_id,
        waba_id: session?.waba_id,
        business_id: session?.business_id,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(body.error || t('failed'));
      return;
    }
    if (body.migration_missing) toast.warning(t('migrationMissing'));
    if (body.sync_errors?.length) toast.warning(`${t('syncError')}: ${body.sync_errors.join(' · ')}`);
    toast.success(t('connectedToast'));
    onConnected();
  };

  const connect = async () => {
    if (!setup.appId || !setup.configId) return;
    setBusy(true);
    sessionRef.current = null;
    let fb: FacebookSdk;
    try {
      fb = await loadSdk(setup.appId);
    } catch {
      toast.error(t('sdkFailed'));
      setBusy(false);
      return;
    }
    // FB.login rejects async callbacks, so hand off to a promise.
    fb.login(
      (res) => {
        const code = res.authResponse?.code;
        if (!code) {
          toast.info(t('cancelled'));
          setBusy(false);
          return;
        }
        finish(code)
          .catch(() => toast.error(t('failed')))
          .finally(() => setBusy(false));
      },
      {
        config_id: setup.configId,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: 'whatsapp_business_app_onboarding',
          sessionInfoVersion: '3',
        },
      },
    );
  };

  const progress = config?.history_sync_progress;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Smartphone className="size-4" />
          {t('title')}
        </CardTitle>
        <CardDescription className="text-muted-foreground">{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isCoex ? (
          <>
            <div className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              <span>{t('connectedDesc')}</span>
            </div>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>
                {t('contacts')}:{' '}
                <span className="text-foreground">
                  {config?.contacts_sync_requested_at ? t('requested') : t('notRequested')}
                </span>
              </li>
              <li>
                {t('history')}:{' '}
                <span className="text-foreground">
                  {typeof progress === 'number'
                    ? progress >= 100
                      ? t('historyDone')
                      : t('historyProgress', { progress })
                    : config?.history_sync_requested_at
                      ? t('requested')
                      : t('notRequested')}
                </span>
              </li>
            </ul>
            {config?.last_sync_error && (
              <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>{config.last_sync_error}</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground">{t('echoNote')}</p>
          </>
        ) : (
          <>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>{t('point1')}</li>
              <li>{t('point2')}</li>
              <li>{t('point3')}</li>
            </ul>
            {config?.status === 'connected' && (
              <p className="text-xs text-amber-700 dark:text-amber-300">{t('replaceWarning')}</p>
            )}
            <Button onClick={connect} disabled={!canEdit || busy} className="w-full sm:w-auto">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Smartphone className="size-4" />}
              {busy ? t('connecting') : t('connect')}
            </Button>
            {!canEdit && <p className="text-xs text-muted-foreground">{t('adminOnly')}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}
