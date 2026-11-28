import { useState, type FormEvent } from 'react';
import {
  Check,
  Code2,
  Eye,
  Plus,
  Power,
  Save,
  ShieldAlert,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { CodeSnippetPlacement, CodeSnippetRecord } from '../data/scooterData';
import type { AppRoute } from '../types/routes';
import {
  CODE_SNIPPET_PLACEMENTS,
  SNIPPET_STARTER_TEMPLATES,
  generateSnippetId,
  getPlacementMeta,
  getSnippetCodePreview,
  validateCodeSnippetInput,
} from '../utils/codeSnippets';

interface AdminCodeSnippetsPanelProps {
  snippets: CodeSnippetRecord[];
  isFromFirestore: boolean;
  onSaveSnippet: (snippet: Omit<CodeSnippetRecord, 'updatedAtIso'>) => Promise<void>;
  onDeleteSnippet: (snippetId: string) => Promise<void>;
  onNavigate: (route: AppRoute) => void;
}

interface SnippetFormState {
  id: string;
  name: string;
  placement: CodeSnippetPlacement;
  code: string;
  enabled: boolean;
  sortOrder: number;
}

function getPreviewRouteForPlacement(placement: CodeSnippetPlacement): AppRoute {
  switch (placement) {
    case 'reviews_section':
      return '/reviews';
    case 'booking_section':
      return '/book';
    default:
      return '/';
  }
}

export function AdminCodeSnippetsPanel({
  snippets,
  isFromFirestore,
  onSaveSnippet,
  onDeleteSnippet,
  onNavigate,
}: AdminCodeSnippetsPanelProps) {
  const [creatingNew, setCreatingNew] = useState(false);
  const [newForm, setNewForm] = useState<SnippetFormState>({
    id: '',
    name: '',
    placement: 'reviews_section',
    code: '',
    enabled: true,
    sortOrder: snippets.length + 1,
  });
  const [newErrors, setNewErrors] = useState<{ name?: string; placement?: string; code?: string }>(
    {},
  );

  // Inline edit state (opens right below the selected snippet card)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<SnippetFormState | null>(null);
  const [editErrors, setEditErrors] = useState<{
    name?: string;
    placement?: string;
    code?: string;
  }>({});

  const [savingId, setSavingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [panelError, setPanelError] = useState('');
  const [panelSuccess, setPanelSuccess] = useState('');

  const showNotice = (msg: string) => {
    setPanelSuccess(msg);
    window.setTimeout(() => setPanelSuccess(''), 4000);
  };

  const openNewSnippetForm = () => {
    setPanelError('');
    setNewErrors({});
    setEditingId(null);
    setEditForm(null);
    setNewForm({
      id: '',
      name: '',
      placement: 'reviews_section',
      code: '',
      enabled: true,
      sortOrder: snippets.length + 1,
    });
    setCreatingNew(true);
  };

  const applyStarterTemplate = (templateId: string) => {
    const tpl = SNIPPET_STARTER_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    setNewForm((prev) => ({
      ...prev,
      name: tpl.name,
      placement: tpl.placement,
      code: tpl.code,
      enabled: true,
    }));
    setNewErrors({});
  };

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPanelError('');
    const validation = validateCodeSnippetInput({
      name: newForm.name,
      placement: newForm.placement,
      code: newForm.code,
    });
    if (!validation.valid) {
      setNewErrors(validation.errors);
      return;
    }

    setNewErrors({});
    const newId = generateSnippetId(newForm.name);
    setSavingId('__new__');
    try {
      await onSaveSnippet({
        id: newId,
        name: newForm.name.trim(),
        placement: newForm.placement,
        code: newForm.code.trim(),
        enabled: newForm.enabled,
        sortOrder: Number(newForm.sortOrder) || snippets.length + 1,
      });
      setCreatingNew(false);
      showNotice(`Added code snippet “${newForm.name.trim()}”.`);
    } catch (err) {
      setPanelError(err instanceof Error ? err.message : 'Failed to save code snippet.');
    } finally {
      setSavingId(null);
    }
  };

  const openInlineEdit = (snippet: CodeSnippetRecord) => {
    setPanelError('');
    setEditErrors({});
    setCreatingNew(false);
    setConfirmDeleteId(null);
    if (editingId === snippet.id) {
      setEditingId(null);
      setEditForm(null);
      return;
    }
    setEditingId(snippet.id);
    setEditForm({
      id: snippet.id,
      name: snippet.name,
      placement: snippet.placement,
      code: snippet.code,
      enabled: snippet.enabled,
      sortOrder: snippet.sortOrder,
    });
  };

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editForm) return;
    setPanelError('');
    const validation = validateCodeSnippetInput({
      name: editForm.name,
      placement: editForm.placement,
      code: editForm.code,
    });
    if (!validation.valid) {
      setEditErrors(validation.errors);
      return;
    }

    setEditErrors({});
    setSavingId(editForm.id);
    try {
      await onSaveSnippet({
        id: editForm.id,
        name: editForm.name.trim(),
        placement: editForm.placement,
        code: editForm.code.trim(),
        enabled: editForm.enabled,
        sortOrder: Number(editForm.sortOrder) || 1,
      });
      setEditingId(null);
      setEditForm(null);
      showNotice(`Updated “${editForm.name.trim()}” — changes are live on the site.`);
    } catch (err) {
      setPanelError(err instanceof Error ? err.message : 'Failed to update code snippet.');
    } finally {
      setSavingId(null);
    }
  };

  const handleToggleEnabled = async (snippet: CodeSnippetRecord) => {
    setPanelError('');
    setSavingId(snippet.id);
    try {
      await onSaveSnippet({
        id: snippet.id,
        name: snippet.name,
        placement: snippet.placement,
        code: snippet.code,
        enabled: !snippet.enabled,
        sortOrder: snippet.sortOrder,
      });
      showNotice(
        !snippet.enabled
          ? `Enabled “${snippet.name}”.`
          : `Paused “${snippet.name}” (code preserved).`,
      );
    } catch (err) {
      setPanelError(err instanceof Error ? err.message : 'Failed to toggle code snippet.');
    } finally {
      setSavingId(null);
    }
  };

  const handleConfirmDelete = async (snippet: CodeSnippetRecord) => {
    setPanelError('');
    setDeletingId(snippet.id);
    try {
      if (!isFromFirestore && snippets.length === 1) {
        // Persist as disabled if it was the unsaved default snippet so it stays off
        await onSaveSnippet({
          id: snippet.id,
          name: snippet.name,
          placement: snippet.placement,
          code: '',
          enabled: false,
          sortOrder: snippet.sortOrder,
        });
      } else {
        await onDeleteSnippet(snippet.id);
      }
      setConfirmDeleteId(null);
      if (editingId === snippet.id) {
        setEditingId(null);
        setEditForm(null);
      }
      showNotice(`Removed “${snippet.name}”.`);
    } catch (err) {
      setPanelError(err instanceof Error ? err.message : 'Failed to delete code snippet.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header + Add CTA */}
      <div className="rounded-[22px] bg-[#F4F4F0] text-[#121214] p-6 border border-black/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="font-mono text-xs text-[#52525B] flex items-center gap-1.5">
            <Code2 className="w-3.5 h-3.5 text-[#E8452C]" aria-hidden="true" />
            SITE CODE SNIPPETS &amp; EMBED WIDGETS
          </div>
          <h2 className="text-xl font-semibold">
            Paste, edit, or swap embed scripts anytime
          </h2>
          <p className="text-xs text-[#3F3F46] leading-relaxed">
            Manage your Trustindex Google Reviews code, analytics tags, chat widgets, or custom HTML
            embeds without touching code files. Changes publish immediately to the live site.
          </p>
        </div>

        <button
          type="button"
          onClick={openNewSnippetForm}
          className="min-h-[42px] px-4 py-2 rounded-[10px] bg-[#E8452C] hover:bg-[#D53A22] text-white text-xs font-semibold inline-flex items-center gap-2 shrink-0 self-start md:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Add Code Snippet
        </button>
      </div>

      {/* Admin Safety Note */}
      <div className="rounded-[14px] bg-[#131316] border border-white/10 px-4 py-3 flex items-start gap-2.5 text-xs text-[#A1A1AA]">
        <ShieldAlert className="w-4 h-4 text-[#E8452C] shrink-0 mt-0.5" aria-hidden="true" />
        <p className="leading-relaxed">
          <strong className="text-[#F4F4F0]">Admin lockout protection:</strong> Global{' '}
          <code className="text-[#F4F4F0]">&lt;head&gt;</code> and footer scripts are automatically
          paused while you are inside <code className="text-[#F4F4F0]">/admin</code>, so you can
          always pause or remove a broken snippet safely.
        </p>
      </div>

      {panelSuccess && (
        <div
          role="status"
          className="rounded-[12px] bg-[#F4F4F0] text-[#121214] px-4 py-3 text-xs font-semibold flex items-center gap-2"
        >
          <Check className="w-4 h-4 text-[#E8452C]" aria-hidden="true" />
          {panelSuccess}
        </div>
      )}

      {panelError && (
        <div
          role="alert"
          className="rounded-[12px] bg-[#E8452C]/15 border border-[#E8452C]/40 text-[#FCA5A5] px-4 py-3 text-xs"
        >
          {panelError}
        </div>
      )}

      {/* New Code Snippet Form */}
      {creatingNew && (
        <form
          onSubmit={handleCreateSubmit}
          noValidate
          className="rounded-[22px] bg-[#F4F4F0] text-[#121214] p-6 border border-[#E8452C]/40 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 pb-3">
            <div>
              <div className="font-mono text-[11px] text-[#52525B]">NEW CODE SNIPPET</div>
              <h3 className="text-lg font-semibold">Add Embed or Script to Your Site</h3>
            </div>
            <button
              type="button"
              onClick={() => setCreatingNew(false)}
              className="text-xs font-semibold text-[#52525B] hover:text-[#121214] cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] text-[#52525B] inline-flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#E8452C]" aria-hidden="true" />
              STARTER TEMPLATES:
            </span>
            {SNIPPET_STARTER_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => applyStarterTemplate(tpl.id)}
                className="min-h-[30px] px-2.5 py-1 rounded-[8px] bg-white border border-black/12 hover:border-[#E8452C] text-[11px] font-semibold text-[#121214] cursor-pointer"
              >
                {tpl.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="new-snippet-name" className="text-xs font-semibold">
                Snippet Name
              </label>
              <input
                id="new-snippet-name"
                type="text"
                maxLength={100}
                value={newForm.name}
                onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
                placeholder="e.g. Trustindex Google Reviews or Google Analytics"
                className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
              />
              {newErrors.name && (
                <p role="alert" className="text-xs font-medium text-[#C82A14]">
                  {newErrors.name}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="new-snippet-placement" className="text-xs font-semibold">
                Where on the site should it run?
              </label>
              <select
                id="new-snippet-placement"
                value={newForm.placement}
                onChange={(e) =>
                  setNewForm({ ...newForm, placement: e.target.value as CodeSnippetPlacement })
                }
                className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
              >
                {CODE_SNIPPET_PLACEMENTS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-[#52525B]">
                {getPlacementMeta(newForm.placement).description}
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="new-snippet-code" className="text-xs font-semibold">
                HTML / Script Code Snippet
              </label>
              <span className="font-mono text-[11px] text-[#52525B] tabular-nums">
                {newForm.code.length.toLocaleString()} / 10,000
              </span>
            </div>
            <textarea
              id="new-snippet-code"
              rows={6}
              maxLength={10000}
              value={newForm.code}
              onChange={(e) => setNewForm({ ...newForm, code: e.target.value })}
              placeholder="<script defer async src='https://cdn.trustindex.io/loader.js?...'></script>"
              spellCheck={false}
              className="w-full p-3 rounded-[10px] bg-[#121214] text-[#F4F4F0] border border-black/20 text-xs font-mono leading-relaxed placeholder:text-[#71717A]"
            />
            {newErrors.code && (
              <p role="alert" className="text-xs font-medium text-[#C82A14]">
                {newErrors.code}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={newForm.enabled}
                onChange={(e) => setNewForm({ ...newForm, enabled: e.target.checked })}
                className="w-4 h-4 accent-[#E8452C]"
              />
              Enable immediately on live site
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCreatingNew(false)}
                className="min-h-[40px] px-4 py-2 rounded-[10px] border border-black/15 text-xs font-semibold text-[#3F3F46] hover:bg-black/5 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingId === '__new__'}
                className="min-h-[40px] px-5 py-2 rounded-[10px] bg-[#E8452C] hover:bg-[#D53A22] disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" aria-hidden="true" />
                {savingId === '__new__' ? 'Saving...' : 'Save Code Snippet'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Existing Snippets List (Inline Edit Form opens directly below each card) */}
      <div className="space-y-4">
        {snippets.length === 0 ? (
          <div className="rounded-[20px] bg-[#131316] border border-white/10 p-8 text-center space-y-3">
            <p className="text-sm font-semibold text-[#F4F4F0]">No code snippets configured yet.</p>
            <p className="text-xs text-[#A1A1AA] max-w-md mx-auto">
              Add your Google Reviews embed, Google Analytics script, or custom widget code above.
            </p>
          </div>
        ) : (
          snippets.map((snippet) => {
            const meta = getPlacementMeta(snippet.placement);
            const isEditingThis = editingId === snippet.id && editForm !== null;
            const previewRoute = getPreviewRouteForPlacement(snippet.placement);

            return (
              <div key={snippet.id} className="space-y-2.5">
                <div className="rounded-[18px] bg-[#131316] border border-white/10 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] font-semibold text-[#E8452C]">
                        {meta.shortBadge}
                      </span>
                      <span className="text-white/20">·</span>
                      <span
                        className={`font-mono text-[11px] font-semibold ${
                          snippet.enabled ? 'text-emerald-400' : 'text-[#71717A]'
                        }`}
                      >
                        {snippet.enabled ? 'ACTIVE' : 'PAUSED'}
                      </span>
                      {!isFromFirestore && (
                        <>
                          <span className="text-white/20">·</span>
                          <span className="font-mono text-[11px] text-[#A1A1AA]">
                            DEFAULT PRESET
                          </span>
                        </>
                      )}
                    </div>

                    <h3 className="text-base font-semibold text-[#F4F4F0]">{snippet.name}</h3>

                    <code className="block rounded-[10px] bg-[#09090B] border border-white/8 px-3 py-2 text-[11px] font-mono text-[#D4D4D8] truncate">
                      {snippet.code.trim()
                        ? getSnippetCodePreview(snippet.code)
                        : '(Empty snippet)'}
                    </code>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onNavigate(previewRoute)}
                      className="min-h-[36px] px-3 py-1.5 rounded-[9px] border border-white/15 hover:bg-white/10 text-xs font-semibold text-[#D4D4D8] inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                      Preview
                    </button>

                    <button
                      type="button"
                      disabled={savingId === snippet.id}
                      onClick={() => handleToggleEnabled(snippet)}
                      className={`min-h-[36px] px-3 py-1.5 rounded-[9px] border text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60 ${
                        snippet.enabled
                          ? 'border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10'
                          : 'border-white/15 text-[#A1A1AA] hover:text-[#F4F4F0] hover:bg-white/10'
                      }`}
                    >
                      <Power className="w-3.5 h-3.5" aria-hidden="true" />
                      {snippet.enabled ? 'Enabled' : 'Paused'}
                    </button>

                    <button
                      type="button"
                      onClick={() => openInlineEdit(snippet)}
                      className={`min-h-[36px] px-3.5 py-1.5 rounded-[9px] text-xs font-semibold cursor-pointer ${
                        isEditingThis
                          ? 'bg-[#F4F4F0] text-[#121214]'
                          : 'border border-white/15 text-[#F4F4F0] hover:bg-white/10'
                      }`}
                    >
                      {isEditingThis ? 'Close Editor' : 'Edit Code'}
                    </button>

                    {confirmDeleteId === snippet.id ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={deletingId === snippet.id}
                          onClick={() => handleConfirmDelete(snippet)}
                          className="min-h-[36px] px-3 py-1 rounded-[9px] bg-[#E8452C] text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
                        >
                          {deletingId === snippet.id ? 'Deleting...' : 'Confirm Delete'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="min-h-[36px] px-2.5 py-1 rounded-[9px] border border-white/15 text-xs text-[#A1A1AA] cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        aria-label={`Delete ${snippet.name}`}
                        onClick={() => setConfirmDeleteId(snippet.id)}
                        className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-[9px] border border-white/15 text-[#A1A1AA] hover:text-[#E8452C] hover:border-[#E8452C] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline Editor directly below this card */}
                {isEditingThis && editForm && (
                  <form
                    onSubmit={handleEditSubmit}
                    noValidate
                    className="rounded-[18px] bg-[#F4F4F0] text-[#121214] p-5 border border-[#E8452C]/40 space-y-4"
                  >
                    <div className="flex items-center justify-between border-b border-black/10 pb-2.5">
                      <span className="font-mono text-[11px] text-[#52525B]">
                        EDITING CODE SNIPPET · {snippet.id}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setEditForm(null);
                        }}
                        className="text-xs font-semibold text-[#52525B] hover:text-[#121214] cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label
                          htmlFor={`edit-snippet-name-${snippet.id}`}
                          className="text-xs font-semibold"
                        >
                          Snippet Name
                        </label>
                        <input
                          id={`edit-snippet-name-${snippet.id}`}
                          type="text"
                          maxLength={100}
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
                        />
                        {editErrors.name && (
                          <p role="alert" className="text-xs font-medium text-[#C82A14]">
                            {editErrors.name}
                          </p>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label
                          htmlFor={`edit-snippet-placement-${snippet.id}`}
                          className="text-xs font-semibold"
                        >
                          Placement
                        </label>
                        <select
                          id={`edit-snippet-placement-${snippet.id}`}
                          value={editForm.placement}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              placement: e.target.value as CodeSnippetPlacement,
                            })
                          }
                          className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
                        >
                          {CODE_SNIPPET_PLACEMENTS.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                        <p className="text-[11px] text-[#52525B]">
                          {getPlacementMeta(editForm.placement).description}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <label
                          htmlFor={`edit-snippet-code-${snippet.id}`}
                          className="text-xs font-semibold"
                        >
                          HTML / Script Code Snippet
                        </label>
                        <span className="font-mono text-[11px] text-[#52525B] tabular-nums">
                          {editForm.code.length.toLocaleString()} / 10,000
                        </span>
                      </div>
                      <textarea
                        id={`edit-snippet-code-${snippet.id}`}
                        rows={6}
                        maxLength={10000}
                        value={editForm.code}
                        onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                        spellCheck={false}
                        className="w-full p-3 rounded-[10px] bg-[#121214] text-[#F4F4F0] border border-black/20 text-xs font-mono leading-relaxed"
                      />
                      {editErrors.code && (
                        <p role="alert" className="text-xs font-medium text-[#C82A14]">
                          {editErrors.code}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editForm.enabled}
                          onChange={(e) =>
                            setEditForm({ ...editForm, enabled: e.target.checked })
                          }
                          className="w-4 h-4 accent-[#E8452C]"
                        />
                        Enabled on live site
                      </label>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(null);
                            setEditForm(null);
                          }}
                          className="min-h-[38px] px-4 py-1.5 rounded-[10px] border border-black/15 text-xs font-semibold text-[#3F3F46] hover:bg-black/5 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={savingId === editForm.id}
                          className="min-h-[38px] px-5 py-1.5 rounded-[10px] bg-[#E8452C] hover:bg-[#D53A22] disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
                        >
                          <Save className="w-3.5 h-3.5" aria-hidden="true" />
                          {savingId === editForm.id ? 'Saving...' : 'Save Changes'}
                        </button>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
