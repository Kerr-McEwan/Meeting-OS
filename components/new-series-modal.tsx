'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Icon } from './atoms';

export interface NewSeriesInput {
  series: {
    slug: string;
    name: string;
    cadence: string;
    description: string;
    color_accent: string;
  };
  agenda: { item: string; sort_order: number }[];
}

const COLOR_OPTIONS = [
  { name: 'Terracotta', value: 'oklch(0.62 0.15 40)' },
  { name: 'Indigo',     value: 'oklch(0.62 0.15 250)' },
  { name: 'Forest',     value: 'oklch(0.58 0.13 150)' },
  { name: 'Plum',       value: 'oklch(0.55 0.16 320)' },
  { name: 'Ochre',      value: 'oklch(0.68 0.14 80)' },
  { name: 'Slate',      value: 'oklch(0.55 0.04 250)' },
];

export function NewSeriesModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (input: NewSeriesInput) => void;
}) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [cadence, setCadence] = useState('Every Mon · 09:00');
  const [description, setDescription] = useState('');
  const [accent, setAccent] = useState(COLOR_OPTIONS[0].value);
  const [items, setItems] = useState([{ id: 'tmp1', item: '' }]);
  const nameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setStep(1);
      setName('');
      setCadence('Every Mon · 09:00');
      setDescription('');
      setAccent(COLOR_OPTIONS[0].value);
      setItems([{ id: 'tmp1', item: '' }]);
      setTimeout(() => nameRef.current?.focus(), 40);
    }
  }, [open]);

  if (!open) return null;

  const addItem = () =>
    setItems((prev) => [...prev, { id: `tmp${prev.length + 1}`, item: '' }]);
  const updateItem = (id: string, patch: Partial<{ item: string }>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const removeItem = (id: string) =>
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.id !== id) : prev));

  const canContinue = name.trim().length > 0;
  const validItems = items.filter((it) => it.item.trim().length > 0);
  const canCreate = canContinue && validItems.length > 0;

  const handleCreate = () => {
    const slug =
      name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) ||
      `series-${Date.now()}`;
    onCreate({
      series: {
        slug,
        name: name.trim(),
        cadence,
        description: description.trim(),
        color_accent: accent,
      },
      agenda: validItems.map((it, i) => ({
        item: it.item.trim(),
        sort_order: i + 1,
      })),
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal new-series-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-eyebrow">Step {step} of 2</div>
            <h3 className="modal-title">
              {step === 1 ? 'Create a new meeting series' : 'Add agenda items'}
            </h3>
            <div className="modal-sub">
              {step === 1
                ? 'Set up the cadence, description, and colour.'
                : 'These become the rows in the pivot view. You can edit them later.'}
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" className="ic sm" />
          </button>
        </div>

        {step === 1 && (
          <div className="modal-body">
            <label className="field">
              <span className="field-label">Series name</span>
              <input
                ref={nameRef}
                className="field-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Site managers weekly"
              />
            </label>

            <div className="field-row">
              <label className="field">
                <span className="field-label">Cadence</span>
                <input
                  className="field-input"
                  value={cadence}
                  onChange={(e) => setCadence(e.target.value)}
                  placeholder="Every Mon · 09:00"
                />
              </label>
            </div>

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
        )}

        {step === 2 && (
          <div className="modal-body">
            <div className="agenda-builder">
              {items.map((it, i) => (
                <div key={it.id} className="agenda-row">
                  <span className="agenda-row-index">{i + 1}</span>
                  <input
                    className="field-input"
                    value={it.item}
                    onChange={(e) => updateItem(it.id, { item: e.target.value })}
                    placeholder="Agenda item"
                  />
                  <button
                    className="icon-btn"
                    onClick={() => removeItem(it.id)}
                    disabled={items.length === 1}
                    aria-label="Remove"
                    title="Remove"
                  >
                    <Icon name="close" className="ic sm" />
                  </button>
                </div>
              ))}
              <button className="btn sm ghost add-item-btn" onClick={addItem}>
                + Add agenda item
              </button>
            </div>
          </div>
        )}

        <div className="modal-foot">
          {step === 2 ? (
            <>
              <button className="btn sm ghost" onClick={() => setStep(1)}>Back</button>
              <div className="spacer" />
              <span className="modal-foot-hint">
                {validItems.length} {validItems.length === 1 ? 'item' : 'items'}
              </span>
              <button className="btn sm ghost" onClick={onClose}>Cancel</button>
              <button
                className="btn sm primary"
                disabled={!canCreate}
                onClick={handleCreate}
              >
                Create series
              </button>
            </>
          ) : (
            <>
              <div className="spacer" />
              <button className="btn sm ghost" onClick={onClose}>Cancel</button>
              <button
                className="btn sm primary"
                disabled={!canContinue}
                onClick={() => setStep(2)}
              >
                Next: Agenda
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
