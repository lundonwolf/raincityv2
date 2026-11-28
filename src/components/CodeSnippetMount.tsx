import { useEffect, useRef, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import type { CodeSnippetRecord } from '../data/scooterData';
import { isSafeSnippetUrl } from '../utils/codeSnippets';

interface CodeSnippetMountProps {
  snippet: CodeSnippetRecord;
  /** Docks body-appended floating Trustindex widgets cleanly inside this container */
  dockFloatingWidgets?: boolean;
  /** Light or dark surface styling for loading/error states */
  surface?: 'light' | 'dark';
}

function sanitizeClonedElement(el: Element): void {
  const urlAttrs = ['href', 'src', 'action', 'formaction'];
  for (const attr of urlAttrs) {
    const val = el.getAttribute(attr);
    if (val !== null && !isSafeSnippetUrl(val)) {
      el.removeAttribute(attr);
    }
  }
  for (const child of Array.from(el.children)) {
    sanitizeClonedElement(child);
  }
}

export function CodeSnippetMount({
  snippet,
  dockFloatingWidgets = false,
  surface = 'light',
}: CodeSnippetMountProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    setStatus('loading');
    container.replaceChildren();

    const preExistingBodyWidgets = dockFloatingWidgets
      ? new Set(Array.from(document.querySelectorAll('body > .ti-widget')))
      : new Set<Element>();

    const dockedBodyWidgets: Element[] = [];

    const dockFloatingIfNeeded = (): boolean => {
      if (!dockFloatingWidgets) return false;
      let found = false;
      const bodyWidgets = Array.from(document.querySelectorAll('body > .ti-widget'));
      for (const widget of bodyWidgets) {
        if (!preExistingBodyWidgets.has(widget)) {
          container.appendChild(widget);
          dockedBodyWidgets.push(widget);
          found = true;
        }
      }
      if (found && !cancelled) {
        setStatus('ready');
      }
      return found;
    };

    const containerObserver = new MutationObserver(() => {
      if (cancelled) return;
      const hasVisualChild = Array.from(container.children).some(
        (child) => child.tagName !== 'SCRIPT',
      );
      if (hasVisualChild) {
        setStatus('ready');
      }
    });
    containerObserver.observe(container, { childList: true, subtree: true });

    let bodyObserver: MutationObserver | null = null;
    if (dockFloatingWidgets) {
      bodyObserver = new MutationObserver(() => {
        if (!cancelled) {
          dockFloatingIfNeeded();
        }
      });
      bodyObserver.observe(document.body, { childList: true });
    }

    const parser = new DOMParser();
    const parsedDoc = parser.parseFromString(snippet.code, 'text/html');
    const parsedNodes = [
      ...Array.from(parsedDoc.head.childNodes),
      ...Array.from(parsedDoc.body.childNodes),
    ];

    let externalScriptCount = 0;
    let externalScriptsLoaded = 0;
    let externalScriptsFailed = 0;

    for (const node of parsedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        if (el.tagName.toUpperCase() === 'SCRIPT') {
          const scriptEl = document.createElement('script');
          let validScript = true;

          for (const attr of Array.from(el.attributes)) {
            const lowerName = attr.name.toLowerCase();
            if (lowerName === 'src') {
              if (!isSafeSnippetUrl(attr.value)) {
                validScript = false;
                break;
              }
              scriptEl.src = attr.value;
            } else if (lowerName === 'async') {
              scriptEl.async = true;
            } else if (lowerName === 'defer') {
              scriptEl.defer = true;
            } else if (!lowerName.startsWith('on')) {
              scriptEl.setAttribute(attr.name, attr.value);
            }
          }

          if (!validScript) continue;

          if (el.textContent && !scriptEl.src) {
            scriptEl.textContent = el.textContent;
          }

          if (scriptEl.src) {
            externalScriptCount += 1;
            scriptEl.onload = () => {
              externalScriptsLoaded += 1;
              if (cancelled) return;
              dockFloatingIfNeeded();
              if (externalScriptsLoaded + externalScriptsFailed >= externalScriptCount) {
                window.setTimeout(() => {
                  if (!cancelled) {
                    dockFloatingIfNeeded();
                    setStatus((prev) => (prev === 'loading' ? 'ready' : prev));
                  }
                }, 1200);
              }
            };
            scriptEl.onerror = () => {
              externalScriptsFailed += 1;
              if (cancelled) return;
              if (externalScriptsLoaded === 0 && externalScriptsFailed >= externalScriptCount) {
                setStatus('error');
              }
            };
          }

          container.appendChild(scriptEl);
        } else {
          const cloned = document.importNode(el, true) as Element;
          sanitizeClonedElement(cloned);
          container.appendChild(cloned);
        }
      } else if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
        container.appendChild(document.createTextNode(node.textContent));
      }
    }

    if (externalScriptCount === 0) {
      setStatus('ready');
    }

    return () => {
      cancelled = true;
      containerObserver.disconnect();
      bodyObserver?.disconnect();
      for (const widget of dockedBodyWidgets) {
        widget.remove();
      }
      container.replaceChildren();
    };
  }, [snippet.id, snippet.code, dockFloatingWidgets, reloadNonce]);

  return (
    <div className="space-y-3 w-full">
      {status === 'loading' && (
        <div
          aria-busy="true"
          aria-label={`Loading ${snippet.name}`}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 py-1 animate-pulse"
        >
          {[0, 1, 2].map((slot) => (
            <div
              key={slot}
              className={`rounded-[14px] p-4 h-32 flex flex-col justify-between border ${
                surface === 'light'
                  ? 'bg-white border-black/8'
                  : 'bg-[#1A1A20] border-white/10'
              }`}
            >
              <div className="space-y-2.5">
                <div
                  className={`h-3 w-24 rounded ${
                    surface === 'light' ? 'bg-black/10' : 'bg-white/10'
                  }`}
                />
                <div
                  className={`h-2.5 w-full rounded ${
                    surface === 'light' ? 'bg-black/8' : 'bg-white/8'
                  }`}
                />
                <div
                  className={`h-2.5 w-4/5 rounded ${
                    surface === 'light' ? 'bg-black/8' : 'bg-white/8'
                  }`}
                />
              </div>
              <div
                className={`h-3 w-32 rounded ${
                  surface === 'light' ? 'bg-black/10' : 'bg-white/10'
                }`}
              />
            </div>
          ))}
        </div>
      )}

      {status === 'error' && (
        <div
          role="alert"
          className="rounded-[14px] bg-[#E8452C]/10 border border-[#E8452C]/30 p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-[#991B1B]"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#E8452C]" aria-hidden="true" />
            <p className="leading-relaxed">
              Could not load <strong>{snippet.name}</strong> right now (a browser ad blocker or
              offline connection may have blocked its script).
            </p>
          </div>
          <button
            type="button"
            onClick={() => setReloadNonce((n) => n + 1)}
            className="min-h-[34px] px-3 py-1 rounded-[8px] bg-[#121214] hover:bg-[#27272A] text-[#F4F4F0] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            Retry
          </button>
        </div>
      )}

      <div
        ref={containerRef}
        data-testid={`code-snippet-${snippet.id}`}
        className={dockFloatingWidgets ? 'trustindex-docked w-full flex justify-center' : 'w-full'}
      />
    </div>
  );
}
