'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Icon } from './atoms';
import type { MeetingSeries } from '@/lib/types';

const COLOR_OPTIONS = [
  { name: 'Terracotta', value: 'oklch(0.62 0.15 40)' },
  { name: 'Indigo',     value: 'oklch(0.62 0.15 250)' },
  { name: 'Forest',     value: 'oklch(0.58 0.13 150)' },
  { name: 'Plum',       value: 'oklch(0.55 0.16 320)' },
  { name: 'Ochre',      value: 'oklch(0.68 0.14 80)' },
  { name: 'Slate',      value: 'oklch(0.55 0.04 250)' },
];

export interface SeriesEditPatch {
  name: string;
  cadence: string;
  description: string;
  color_accent: string;
}

export function SeriesEditModal({
  open,
  series,
  onClose,
  onSave,
  onArchive,
  onRestore,
}: {
  open: boolean;
  series: MeetingSeries | null;
  onClose: () => void;
  onSave: (patch: SeriesEditPatch) => Promise<void>;
  onArchive: () => Promise<void>;
  onRestore: () => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [cadence, setCadence] = useState('');
  const [description, setDescription] = useState('');
  const [accent, setAccent] = useState(COLOR_OPTIONS[0].value);
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open || !series) return;
    setName(series.name || '');
    setCadence(series.cadence || '');
    setDescription(series.description || '');
    setAccent(series.color_accent || COLOR_OPTIONS[0].value);
    setTimeout(() => nameRef.current?.focus(), 40);
  }, [open, series]);

  if (!open || !series) return null;

  const handleSave = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    await onSave({
      name: name.trim(),
      cadence: cadence.trim(),
      description: description.trim(),
      color_accent: accent,
    });
    setSaving(false);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal series-edit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-eyebrow">Series settings</div>
            <h3 className="modal-title">Edit {series.name}</h3>
            <div className="modal-sub">Update the series details, archive it, or restore from archive.</div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" className="ic sm" />
          </button>
        </div>

        <div className="modal-body">
          <label className="field">
            <span className="field-label">Series name</span>
            <input
              ref={nameRef}
              className="field-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Leadership weekly"
            />
          </label>

          <label className="field">
            <span className="field-label">Cadence</span>
            <input
              className="field-input"
              value={cadence}
              onChange={(e) => setCadence(e.target.value)}
              placeholder="Every Mon · 09:00"
            />
          </label>

          <label className="field">
            <span className="field-label">
              Description <span className="field-hint">Optional</span>
            </span>
            <textarea
              className="field-input"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this meeting for?"
            />
          </label>

          <div className="field">
            <span className="field-label">Accent colour</span>
            <div className="color-swatches">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  className={`color-swatch ${accent === c.value ? 'selected' : ''}`}
                  style={{ background: c.value }}
                  onClick={() => setAccent(c.value)}
                  title={c.name}
                  aria-label={c.name}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="modal-foot">
          {series.archived_at ? (
            <button
              className="btn sm ghost me-archive-btn"
              onClick={async () => { setSaving(true); await onRestore(); setSaving(false); onClose(); }}
              disabled={saving}
              title="Restore this series to the picker"
            >
              Restore series
            </button>
          ) : (
            <button
              className="btn sm ghost me-archive-btn"
              onClick={async () => {
                if (!window.confirm(
                  `Archive "${series.name}"?\n\nThe series will disappear from the picker. All meetings, notes, decisions, and actions inside it stay in the database. You can restore from the "Show archived" toggle in the picker.`,
                )) return;
                setSaving(true);
                await onArchive();
                setSaving(false);
                onClose();
              }}
              disabled={saving}
              title="Hide this series from the picker (not deleted)"
            >
              Archive series
            </button>
          )}
          <div className="spacer" />
          <button className="btn sm ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn sm primary" onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
