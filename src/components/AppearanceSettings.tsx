import { useEffect, useState } from "preact/hooks";
import {
  EDITOR_FONT_FAMILIES,
  hasSufficientContrast,
  normalizeHexColor,
} from "../preferences";
import type { EditorPreferences } from "../types";

interface AppearanceSettingsProps {
  preferences: EditorPreferences;
  storageWarning?: string | null;
  onChange: (patch: Partial<EditorPreferences>) => void;
  onResetColors: () => void;
}

interface ColorControlProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function ColorControl({ label, value, onChange }: ColorControlProps) {
  const [hexValue, setHexValue] = useState(value);

  useEffect(() => setHexValue(value), [value]);

  const commit = (nextValue: string) => {
    const normalized = normalizeHexColor(nextValue);
    if (normalized) {
      setHexValue(normalized);
      onChange(normalized);
    } else {
      setHexValue(value);
    }
  };

  return (
    <span class="color-control">
      <input
        class="color-picker"
        type="color"
        value={value}
        aria-label={label}
        onInput={(event) => commit(event.currentTarget.value)}
      />
      <input
        class="hex-input"
        type="text"
        inputMode="text"
        value={hexValue}
        aria-label={`${label} hex`}
        onInput={(event) => setHexValue(event.currentTarget.value)}
        onBlur={(event) => commit(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit(event.currentTarget.value);
        }}
      />
    </span>
  );
}

export function AppearanceSettings({ preferences, storageWarning, onChange, onResetColors }: AppearanceSettingsProps) {
  const contrastWarning = !hasSufficientContrast(preferences);

  return (
    <>
      <section class="settings-card" aria-labelledby="appearance-title">
        <h2 class="card-title" id="appearance-title">Appearance</h2>
        <label class="setting-row">
          <span class="setting-label">Background</span>
          <ColorControl label="Kolor tła" value={preferences.backgroundColor} onChange={(value) => onChange({ backgroundColor: value })} />
        </label>
        <label class="setting-row">
          <span class="setting-label">Font Color</span>
          <ColorControl label="Kolor tekstu" value={preferences.textColor} onChange={(value) => onChange({ textColor: value })} />
        </label>
        {contrastWarning && (
          <div class="contrast-warning" role="alert">
            <span>Kontrast kolorów jest niższy niż 4.5:1.</span>
            <button type="button" onClick={onResetColors}>Przywróć domyślne kolory</button>
          </div>
        )}
      </section>

      <section class="settings-card" aria-labelledby="typography-title">
        <h2 class="card-title" id="typography-title">Typography</h2>
        <label class="setting-row">
          <span class="setting-label">Font</span>
          <select
            class="select"
            value={preferences.fontFamily}
            onChange={(event) => onChange({ fontFamily: event.currentTarget.value as EditorPreferences["fontFamily"] })}
          >
            {EDITOR_FONT_FAMILIES.map((font) => <option value={font}>{font}</option>)}
          </select>
        </label>
        <label class="setting-row">
          <span class="setting-label">Font Size</span>
          <input
            class="number-input"
            type="number"
            min="10"
            max="24"
            step="1"
            value={preferences.fontSizePt}
            onInput={(event) => onChange({ fontSizePt: Number(event.currentTarget.value) })}
          />
        </label>
        <label class="setting-row">
          <span class="setting-label">Line Height</span>
          <input
            class="number-input"
            type="number"
            min="1.2"
            max="2.4"
            step="0.1"
            value={preferences.lineHeight}
            onInput={(event) => onChange({ lineHeight: Number(event.currentTarget.value) })}
          />
        </label>
        <label class="setting-row">
          <span class="setting-label">Width (px)</span>
          <input
            class="number-input"
            type="number"
            min="480"
            max="1200"
            step="10"
            value={preferences.editorWidthPx}
            onInput={(event) => onChange({ editorWidthPx: Number(event.currentTarget.value) })}
          />
        </label>
      </section>
      {storageWarning && <p class="preferences-warning" role="status">{storageWarning}</p>}
    </>
  );
}
