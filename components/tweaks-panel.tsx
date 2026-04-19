'use client';

import React, { useEffect, useState } from 'react';
import { Icon } from './atoms';
import type { TweaksSettings } from '@/lib/types';

const ACCENTS: Record<TweaksSettings['accent'], { val: string; soft: string }> = {
  amber:    { val: '#d99442', soft: 'oklch(0.95 0.03 65)' },
  rose:     { val: '#c7557a', soft: 'oklch(0.95 0.03 10)' },
  indigo:   { val: '#5a6acf', soft: 'oklch(0.95 0.03 265)' },
  teal:     { val: '#2e8a82', soft: 'oklch(0.95 0.03 180)' },
  graphite: { val: '#3a3a3a', soft: 'oklch(0.93 0.005 0)' },
};

export function applySettings(s: TweaksSettings) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.theme = s.theme;
  root.dataset.density = s.density;
  const a = ACCENTS[s.accent] || ACCENTS.amber;
  root.style.setProperty('--accent', a.val);
  root.style.setProperty('--accent-soft', a.soft);

  if (s.typography === 'serif') {
    root.style.setProperty('--font-head', "'Source Serif 4', 'Source Serif Pro', Georgia, serif");
    root.style.setProperty('--font-body', "'Inter', system-ui, sans-serif");
  } else if (s.typography === 'mono') {
    root.style.setProperty('--font-head', "'JetBrains Mono', ui-monospace, monospace");
    root.style.setProperty('--font-body', "'Inter', system-ui, sans-serif");
  } else {
    root.style.setProperty('--font-head', "'Inter', system-ui, sans-serif");
    root.style.setProperty('--font-body', "'Inter', system-ui, sans-serif");
  }
}

export function TweaksPanel({
  settings,
  setSettings,
}: {
  settings: TweaksSettings;
  setSettings: (s: TweaksSettings) => void;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    applySettings(settings);
  }, [settings]);

  const update = (patch: Partial<TweaksSettings>) => setSettings({ ...settings, ...patch });

  const accents = Object.entries(ACCENTS) as [TweaksSettings['accent'], { val: string }][];

  return (
    <>
      <button className="tweaks-fab" onClick={() => setOpen((o) => !o)}>
        <Icon name="sliders" className="ic sm" /> Tweaks
      </button>
      <div className={`tweaks-panel ${open ? 'open' : ''}`}>
        <h4>Appearance</h4>

        <div className="tweaks-row">
          <div className="lbl">Density</div>
          <div className="seg">
            {(['compact','comfy','spacious'] as const).map((d) => (
              <button key={d} className={settings.density === d ? 'on' : ''} onClick={() => update({ density: d })}>
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="tweaks-row">
          <div className="lbl">Theme</div>
          <div className="seg">
            {(['light','dark'] as const).map((t) => (
              <button key={t} className={settings.theme === t ? 'on' : ''} onClick={() => update({ theme: t })}>{t}</button>
            ))}
          </div>
        </div>

        <div className="tweaks-row">
          <div className="lbl">Typography</div>
          <div className="seg">
            {[
              { id: 'sans' as const,  label: 'Sans' },
              { id: 'serif' as const, label: 'Serif heads' },
              { id: 'mono' as const,  label: 'Mono heads' },
            ].map((t) => (
              <button key={t.id} className={settings.typography === t.id ? 'on' : ''} onClick={() => update({ typography: t.id })}>{t.label}</button>
            ))}
          </div>
        </div>

        <div className="tweaks-row">
          <div className="lbl">Pivot cell style</div>
          <div className="seg">
            {(['text','pills','dots'] as const).map((c) => (
              <button key={c} className={settings.cellStyle === c ? 'on' : ''} onClick={() => update({ cellStyle: c })}>{c}</button>
            ))}
          </div>
        </div>

        <div className="tweaks-row">
          <div className="lbl">Stats row</div>
          <div className="seg">
            {(['show','hide'] as const).map((s) => (
              <button key={s} className={settings.stats === s ? 'on' : ''} onClick={() => update({ stats: s })}>{s}</button>
            ))}
          </div>
        </div>

        <div className="tweaks-row">
          <div className="lbl">Accent</div>
          <div className="swatches">
            {accents.map(([id, a]) => (
              <button
                key={id}
                className={settings.accent === id ? 'on' : ''}
                style={{ background: a.val }}
                onClick={() => update({ accent: id })}
                title={id}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
