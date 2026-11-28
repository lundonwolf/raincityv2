import { useEffect } from 'react';
import type { CodeSnippetRecord } from '../data/scooterData';
import type { AppRoute } from '../types/routes';
import { getEnabledSnippetsForPlacement, isSafeSnippetUrl } from '../utils/codeSnippets';

interface GlobalSnippetsHostProps {
  snippets: CodeSnippetRecord[];
  currentRoute: AppRoute;
}

function mountNodesIntoTarget(
  target: HTMLElement,
  snippets: CodeSnippetRecord[],
  markerAttr: string,
): () => void {
  const appended: Node[] = [];
  const parser = new DOMParser();

  for (const snippet of snippets) {
    const parsedDoc = parser.parseFromString(snippet.code, 'text/html');
    const nodes = [
      ...Array.from(parsedDoc.head.childNodes),
      ...Array.from(parsedDoc.body.childNodes),
    ];

    for (const node of nodes) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      const el = node as Element;
      const tag = el.tagName.toUpperCase();

      if (tag === 'SCRIPT') {
        const scriptEl = document.createElement('script');
        let valid = true;
        for (const attr of Array.from(el.attributes)) {
          const lower = attr.name.toLowerCase();
          if (lower === 'src') {
            if (!isSafeSnippetUrl(attr.value)) {
              valid = false;
              break;
            }
            scriptEl.src = attr.value;
          } else if (lower === 'async') {
            scriptEl.async = true;
          } else if (lower === 'defer') {
            scriptEl.defer = true;
          } else if (!lower.startsWith('on')) {
            scriptEl.setAttribute(attr.name, attr.value);
          }
        }
        if (!valid) continue;
        if (el.textContent && !scriptEl.src) {
          scriptEl.textContent = el.textContent;
        }
        scriptEl.setAttribute(markerAttr, snippet.id);
        target.appendChild(scriptEl);
        appended.push(scriptEl);
      } else {
        const cloned = document.importNode(el, true) as Element;
        for (const urlAttr of ['href', 'src']) {
          const val = cloned.getAttribute(urlAttr);
          if (val !== null && !isSafeSnippetUrl(val)) {
            cloned.removeAttribute(urlAttr);
          }
        }
        cloned.setAttribute(markerAttr, snippet.id);
        target.appendChild(cloned);
        appended.push(cloned);
      }
    }
  }

  return () => {
    for (const node of appended) {
      node.parentNode?.removeChild(node);
    }
  };
}

/**
 * Mounts site-wide <head> and body-end snippets on all public routes.
 * Automatically pauses inside /admin so a faulty third-party snippet can never lock out the admin console.
 */
export function GlobalSnippetsHost({ snippets, currentRoute }: GlobalSnippetsHostProps) {
  const isAdminRoute = currentRoute === '/admin';
  const headSnippets = isAdminRoute ? [] : getEnabledSnippetsForPlacement(snippets, 'head');
  const bodySnippets = isAdminRoute ? [] : getEnabledSnippetsForPlacement(snippets, 'body_end');

  const headKey = headSnippets.map((s) => `${s.id}:${s.code}`).join('|');
  const bodyKey = bodySnippets.map((s) => `${s.id}:${s.code}`).join('|');

  useEffect(() => {
    if (headSnippets.length === 0) return;
    return mountNodesIntoTarget(document.head, headSnippets, 'data-rcs-head-snippet');
  }, [headKey]);

  useEffect(() => {
    if (bodySnippets.length === 0) return;
    return mountNodesIntoTarget(document.body, bodySnippets, 'data-rcs-body-snippet');
  }, [bodyKey]);

  return null;
}
