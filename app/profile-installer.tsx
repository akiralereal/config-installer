'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowDownToLine,
  Check,
  CheckCircle2,
  ClipboardPaste,
  CloudDownload,
  Copy,
  FileCheck2,
  FileUp,
  Globe2,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Toaster, toast } from '@/components/ui/toast';

const PROFILE_MIME = 'application/x-apple-aspen-config';
const MAX_PROFILE_BYTES = 5 * 1024 * 1024;

const SAMPLE_PROFILE = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array/>
  <key>PayloadDisplayName</key>
  <string>ProfileKit Sample</string>
  <key>PayloadIdentifier</key>
  <string>tools.profilekit.sample</string>
  <key>PayloadOrganization</key>
  <string>ProfileKit</string>
  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadUUID</key>
  <string>7D516574-4FA1-4AC8-B1B2-4A3A83D8395E</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
</dict>
</plist>`;

type Status = {
  kind: 'success' | 'error' | 'info';
  message: string;
};

function validateProfile(content: string) {
  if (!content.trim()) {
    throw new Error('The profile is empty.');
  }

  if (new Blob([content]).size > MAX_PROFILE_BYTES) {
    throw new Error('The profile is larger than 5 MB.');
  }

  const document = new DOMParser().parseFromString(content, 'application/xml');
  const hasParserError = document.getElementsByTagName('parsererror').length > 0;

  if (hasParserError || document.documentElement.nodeName !== 'plist') {
    throw new Error('This is not a valid Apple property list.');
  }

  const keys = Array.from(document.getElementsByTagName('key')).map(
    (key) => key.textContent,
  );

  if (!keys.includes('PayloadType') || !keys.includes('PayloadUUID')) {
    throw new Error('Required profile fields are missing.');
  }
}

function safeFilename(filename: string) {
  const base = filename
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!base) return 'profile.mobileconfig';
  return base.toLowerCase().endsWith('.mobileconfig')
    ? base
    : `${base}.mobileconfig`;
}

function downloadProfile(content: string, filename: string) {
  const blob = new Blob([content], { type: PROFILE_MIME });
  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = blobUrl;
  anchor.download = safeFilename(filename);
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

async function copyText(value: string) {
  try {
    if (!navigator.clipboard) return false;
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function StatusMessage({ status }: { status: Status | null }) {
  if (!status) {
    return (
      <div className="status-placeholder" aria-hidden="true">
        Your profile stays on this device.
      </div>
    );
  }

  const Icon = status.kind === 'success' ? CheckCircle2 : AlertCircle;

  return (
    <output className={`status-message status-${status.kind}`}>
      <Icon aria-hidden="true" />
      <span>{status.message}</span>
    </output>
  );
}

export default function Home() {
  const [method, setMethod] = useState('file');
  const [file, setFile] = useState<File | null>(null);
  const [profileUrl, setProfileUrl] = useState('');
  const [xml, setXml] = useState('');
  const [status, setStatus] = useState<Status | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [browserWarning, setBrowserWarning] = useState(false);
  const [safariLinkCopied, setSafariLinkCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const userAgent = navigator.userAgent;
    const isIOS =
      /iPad|iPhone|iPod/.test(userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isSafari =
      /Safari/i.test(userAgent) &&
      !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|FBAN|FBAV|Instagram/i.test(
        userAgent,
      );

    queueMicrotask(() => setBrowserWarning(isIOS && !isSafari));
  }, []);

  useEffect(() => {
    type ModelContext = {
      registerTool: (
        tool: {
          name: string;
          title: string;
          description: string;
          inputSchema: Record<string, unknown>;
          annotations: {
            readOnlyHint: boolean;
            untrustedContentHint: boolean;
          };
          execute: (input: unknown) => Promise<Record<string, string>>;
        },
        options: { signal: AbortSignal },
      ) => void | Promise<void>;
    };

    const modelContext = (
      document as Document & { modelContext?: ModelContext }
    ).modelContext;

    if (!modelContext?.registerTool) return;

    const lifecycle = new AbortController();

    try {
      void Promise.resolve(
        modelContext.registerTool(
          {
            name: 'prepare_profile_from_xml',
            title: 'Prepare MobileConfig from XML',
            description:
              'Validate Apple configuration-profile XML, show it in the editor, and start a .mobileconfig download.',
            inputSchema: {
              type: 'object',
              properties: {
                xml: {
                  type: 'string',
                  description: 'Complete Apple property-list XML.',
                },
                filename: {
                  type: 'string',
                  description: 'Optional output filename.',
                },
              },
              required: ['xml'],
              additionalProperties: false,
            },
            annotations: {
              readOnlyHint: false,
              untrustedContentHint: false,
            },
            async execute(input) {
              if (
                typeof input !== 'object' ||
                input === null ||
                typeof (input as { xml?: unknown }).xml !== 'string'
              ) {
                throw new Error('A string XML value is required.');
              }

              const values = input as { xml: string; filename?: unknown };
              validateProfile(values.xml);
              const filename =
                typeof values.filename === 'string'
                  ? safeFilename(values.filename)
                  : 'profilekit-profile.mobileconfig';

              setMethod('xml');
              setXml(values.xml);
              downloadProfile(values.xml, filename);
              setStatus({
                kind: 'success',
                message: 'Profile ready. Continue from Safari’s download prompt.',
              });

              return { status: 'download_started', filename };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => undefined);
    } catch {
      return;
    }

    return () => lifecycle.abort();
  }, []);

  const fileMeta = useMemo(() => {
    if (!file) return null;
    const size =
      file.size < 1024 ? `${file.size} B` : `${(file.size / 1024).toFixed(1)} KB`;
    return { name: file.name, size };
  }, [file]);

  function resetStatus() {
    setStatus(null);
  }

  async function copyLinkForSafari() {
    const pageUrl = `${window.location.origin}${window.location.pathname}`;
    const copied = await copyText(pageUrl);

    setSafariLinkCopied(copied);
    setStatus({
      kind: copied ? 'info' : 'error',
      message: copied
        ? 'Link copied. Open Safari, paste the link, then continue there.'
        : `Open Safari and enter this address: ${pageUrl}`,
    });
    toast.add({
      id: 'safari-handoff',
      type: copied ? 'success' : 'warning',
      priority: 'high',
      timeout: 7000,
      title: copied ? 'Link copied — open Safari' : 'Open this page in Safari',
      description: copied
        ? 'Paste the copied link into Safari to continue installing the profile.'
        : `Enter ${pageUrl} in Safari to continue.`,
    });
  }

  async function continueOnlyInSafari() {
    if (!browserWarning) return true;

    await copyLinkForSafari();
    return false;
  }

  function finishProfile(content: string, filename: string) {
    validateProfile(content);
    downloadProfile(content, filename);
    setStatus({
      kind: 'success',
      message: 'Profile ready. Continue from Safari’s download prompt.',
    });
  }

  async function installFile() {
    if (!(await continueOnlyInSafari())) return;

    if (!file) {
      setStatus({ kind: 'error', message: 'Choose a .mobileconfig file first.' });
      return;
    }

    if (!file.name.toLowerCase().endsWith('.mobileconfig')) {
      setStatus({ kind: 'error', message: 'Only .mobileconfig files are supported.' });
      return;
    }

    if (file.size > MAX_PROFILE_BYTES) {
      setStatus({ kind: 'error', message: 'The profile is larger than 5 MB.' });
      return;
    }

    setIsWorking(true);
    try {
      finishProfile(await file.text(), file.name);
    } catch (error) {
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Unable to read this file.',
      });
    } finally {
      setIsWorking(false);
    }
  }

  async function installFromUrl() {
    if (!(await continueOnlyInSafari())) return;

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(profileUrl);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error();
    } catch {
      setStatus({ kind: 'error', message: 'Enter a valid HTTP or HTTPS URL.' });
      return;
    }

    setIsWorking(true);
    setStatus({ kind: 'info', message: 'Fetching and checking the profile…' });

    try {
      const response = await fetch(parsedUrl, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`The server returned ${response.status}.`);
      }

      const filename =
        parsedUrl.pathname.split('/').pop() || 'remote-profile.mobileconfig';
      finishProfile(await response.text(), filename);
    } catch (error) {
      const detail = error instanceof Error ? error.message : '';
      setStatus({
        kind: 'error',
        message: detail.startsWith('The server')
          ? detail
          : 'Could not fetch that URL. The host may block cross-origin downloads.',
      });
    } finally {
      setIsWorking(false);
    }
  }

  async function installXml() {
    if (!(await continueOnlyInSafari())) return;

    try {
      finishProfile(xml, 'profilekit-profile.mobileconfig');
    } catch (error) {
      setStatus({
        kind: 'error',
        message:
          error instanceof Error ? error.message : 'Unable to prepare this profile.',
      });
    }
  }

  async function downloadSample() {
    if (!(await continueOnlyInSafari())) return;

    downloadProfile(SAMPLE_PROFILE, 'profilekit-sample.mobileconfig');
    setStatus({ kind: 'success', message: 'Sample profile downloaded.' });
  }

  function loadSampleUrl() {
    setProfileUrl(new URL('sample.mobileconfig', document.baseURI).href);
    setStatus({
      kind: 'info',
      message: 'Sample URL added. Select Install profile to test it.',
    });
  }

  function loadSampleXml() {
    setXml(SAMPLE_PROFILE);
    setStatus({ kind: 'info', message: 'Sample XML loaded and ready to validate.' });
  }

  return (
    <main className="site-shell">
      <Toaster />
      <header className="site-header">
        <a className="brand" href="#installer" aria-label="ProfileKit home">
          <span className="brand-mark" aria-hidden="true">
            <ShieldCheck />
          </span>
          <span>ProfileKit</span>
        </a>
        <div className="privacy-pill">
          <LockKeyhole aria-hidden="true" />
          Local by default
        </div>
      </header>

      <section className="installer-layout" id="installer">
        <aside className="context-panel">
          <div>
            <div className="eyebrow">iOS configuration</div>
            <h1>Install a profile, without the detour.</h1>
            <p className="intro-copy">
              Validate a MobileConfig file and hand it straight to your device. No
              account, upload, or server-side storage.
            </p>
          </div>

          <ol className="process-list" aria-label="Installation process">
            <li className="process-item is-active">
              <span>01</span>
              <div>
                <strong>Choose a source</strong>
                <p>File, direct URL, or XML</p>
              </div>
            </li>
            <li className="process-item">
              <span>02</span>
              <div>
                <strong>Validate locally</strong>
                <p>Check the plist structure</p>
              </div>
            </li>
            <li className="process-item">
              <span>03</span>
              <div>
                <strong>Continue in Safari</strong>
                <p>Approve from iOS Settings</p>
              </div>
            </li>
          </ol>

          <div className="context-note">
            <FileCheck2 aria-hidden="true" />
            <span>Supports unsigned XML-based .mobileconfig profiles.</span>
          </div>
        </aside>

        <section className="workspace-card" aria-labelledby="workspace-title">
          <div className="workspace-heading">
            <div>
              <span className="workspace-kicker">Profile source</span>
              <h2 id="workspace-title">Prepare your MobileConfig</h2>
            </div>
            <span className="step-badge">Step 1 of 3</span>
          </div>

          {browserWarning && (
            <div className="browser-warning" role="alert">
              <AlertCircle aria-hidden="true" />
              <div className="browser-warning-copy">
                <strong>Safari is required for profile installation.</strong>
                <span>Copy this page, then paste it into Safari.</span>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="safari-copy-button"
                onClick={copyLinkForSafari}
              >
                {safariLinkCopied ? <Check /> : <Copy />}
                {safariLinkCopied ? 'Copied' : 'Copy link'}
              </Button>
            </div>
          )}

          <Tabs
            value={method}
            onValueChange={(value) => {
              setMethod(value);
              resetStatus();
            }}
            className="profile-tabs"
          >
            <TabsList className="method-tabs" aria-label="Profile source">
              <TabsTrigger value="file">
                <FileUp />
                Device file
              </TabsTrigger>
              <TabsTrigger value="url">
                <Globe2 />
                Direct URL
              </TabsTrigger>
              <TabsTrigger value="xml">
                <ClipboardPaste />
                Paste XML
              </TabsTrigger>
            </TabsList>

            <TabsContent value="file" className="tab-panel">
              <div className="panel-label-row">
                <div>
                  <h3>Choose from this device</h3>
                  <p>Maximum recommended size: 5 MB</p>
                </div>
                <Button type="button" variant="ghost" onClick={downloadSample}>
                  <ArrowDownToLine />
                  Sample
                </Button>
              </div>

              <button
                type="button"
                className={`drop-zone ${file ? 'has-file' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const droppedFile = event.dataTransfer.files[0];
                  if (droppedFile) {
                    setFile(droppedFile);
                    resetStatus();
                  }
                }}
              >
                <span className="drop-icon">
                  {file ? (
                    <Check aria-hidden="true" />
                  ) : (
                    <CloudDownload aria-hidden="true" />
                  )}
                </span>
                {fileMeta ? (
                  <>
                    <strong>{fileMeta.name}</strong>
                    <span>{fileMeta.size} · Select to replace</span>
                  </>
                ) : (
                  <>
                    <strong>Drop a profile here</strong>
                    <span>or select a .mobileconfig file</span>
                  </>
                )}
              </button>
              <input
                ref={fileInputRef}
                className="file-input"
                type="file"
                accept=".mobileconfig,application/x-apple-aspen-config"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  resetStatus();
                }}
              />

              <Button
                type="button"
                size="lg"
                className="install-button"
                onClick={installFile}
                disabled={isWorking}
              >
                {isWorking ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <ShieldCheck />
                )}
                Validate & install
              </Button>
            </TabsContent>

            <TabsContent value="url" className="tab-panel">
              <div className="panel-label-row">
                <div>
                  <h3>Fetch a direct profile URL</h3>
                  <p>The source must allow browser downloads.</p>
                </div>
                <Button type="button" variant="ghost" onClick={loadSampleUrl}>
                  Use sample
                </Button>
              </div>

              <label className="field-label" htmlFor="profile-url">
                Profile URL
              </label>
              <Input
                id="profile-url"
                type="url"
                value={profileUrl}
                onChange={(event) => {
                  setProfileUrl(event.target.value);
                  resetStatus();
                }}
                className="profile-input"
                placeholder="https://example.com/profile.mobileconfig"
                autoComplete="url"
              />

              <div className="field-help">
                <LockKeyhole aria-hidden="true" />
                The file is fetched in your browser and is not retained.
              </div>

              <Button
                type="button"
                size="lg"
                className="install-button"
                onClick={installFromUrl}
                disabled={isWorking}
              >
                {isWorking ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <ShieldCheck />
                )}
                Install profile
              </Button>
            </TabsContent>

            <TabsContent value="xml" className="tab-panel">
              <div className="panel-label-row">
                <div>
                  <h3>Paste profile XML</h3>
                  <p>We’ll verify the property list before download.</p>
                </div>
                <Button type="button" variant="ghost" onClick={loadSampleXml}>
                  Load sample
                </Button>
              </div>

              <label className="field-label" htmlFor="profile-xml">
                XML property list
              </label>
              <Textarea
                id="profile-xml"
                value={xml}
                onChange={(event) => {
                  setXml(event.target.value);
                  resetStatus();
                }}
                className="profile-textarea"
                placeholder={'<?xml version="1.0" encoding="UTF-8"?>'}
                spellCheck={false}
              />

              <Button
                type="button"
                size="lg"
                className="install-button"
                onClick={installXml}
              >
                <ShieldCheck />
                Generate & install
              </Button>
            </TabsContent>
          </Tabs>

          <StatusMessage status={status} />
        </section>
      </section>

      <footer className="site-footer">
        <span>ProfileKit</span>
        <span className="footer-dot" aria-hidden="true" />
        <span>Private, browser-only profile preparation</span>
      </footer>
    </main>
  );
}
