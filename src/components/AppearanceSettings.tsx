import { useEffect, useState } from "preact/hooks";
import {
  EDITOR_FONT_FAMILIES,
  hasSufficientContrast,
  normalizeHexColor,
} from "../preferences";
import type { EditorPreferences } from "../types";

interface AppearanceSettingsProps {
  preferences: EditorPreferences;
  disabled?: boolean;
  storageWarning?: string | null;
  onChange: (patch: Partial<EditorPreferences>) => void;
  onResetColors: () => void;
}

interface ColorControlProps {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

function ColorControl({ label, value, disabled, onChange }: ColorControlProps) {
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
        disabled={disabled}
        class="color-picker"
        type="color"
        value={value}
        aria-label={label}
        onInput={(event) => commit(event.currentTarget.value)}
      />
      <input
        disabled={disabled}
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

export function AppearanceSettings({ preferences, disabled, storageWarning, onChange, onResetColors }: AppearanceSettingsProps) {
  const contrastWarning = !hasSufficientContrast(preferences);

  return (
    <section class="note-settings" aria-labelledby="appearance-title">
      <h2 class="settings-title" id="appearance-title">Wygląd tej notatki</h2>
      <section class="settings-group" aria-labelledby="typography-title">
        <h3 class="settings-group-title" id="typography-title">Tekst</h3>
        <label class="setting-row">
          <span class="setting-label">Krój pisma</span>
          <select
            disabled={disabled}
            class="select"
            value={preferences.fontFamily}
            onChange={(event) => onChange({ fontFamily: event.currentTarget.value as EditorPreferences["fontFamily"] })}
          >
            {EDITOR_FONT_FAMILIES.map((font) => <option value={font}>{font}</option>)}
          </select>
        </label>
        <label class="setting-row">
          <span class="setting-label">Rozmiar tekstu</span>
          <span class="number-control">
            <input
              disabled={disabled}
              class="number-input"
              type="number"
              min="10"
              max="24"
              step="1"
              aria-label="Rozmiar tekstu"
              value={preferences.fontSizePt}
              onInput={(event) => onChange({ fontSizePt: Number(event.currentTarget.value) })}
            />
            <span class="setting-unit" aria-hidden="true">pt</span>
          </span>
        </label>
        <label class="setting-row">
          <span class="setting-label">Odstęp między wierszami</span>
          <input
            disabled={disabled}
            class="number-input"
            type="number"
            min="1.2"
            max="2.4"
            step="0.1"
            aria-label="Odstęp między wierszami"
            value={preferences.lineHeight}
            onInput={(event) => onChange({ lineHeight: Number(event.currentTarget.value) })}
          />
        </label>
        <label class="setting-row">
          <span class="setting-label">Szerokość tekstu</span>
          <span class="number-control">
            <input
              disabled={disabled}
              class="number-input"
              type="number"
              min="480"
              max="1200"
              step="10"
              aria-label="Szerokość tekstu w pikselach"
              value={preferences.editorWidthPx}
              onInput={(event) => onChange({ editorWidthPx: Number(event.currentTarget.value) })}
            />
            <span class="setting-unit" aria-hidden="true">px</span>
          </span>
        </label>
      </section>
      <section class="settings-group" aria-labelledby="colors-title">
        <h3 class="settings-group-title" id="colors-title">Kolory</h3>
        <div class="setting-row">
          <span class="setting-label">Tło</span>
          <ColorControl disabled={disabled} label="Kolor tła" value={preferences.backgroundColor} onChange={(value) => onChange({ backgroundColor: value })} />
        </div>
        <div class="setting-row">
          <span class="setting-label">Tekst</span>
          <ColorControl disabled={disabled} label="Kolor tekstu" value={preferences.textColor} onChange={(value) => onChange({ textColor: value })} />
        </div>
        {contrastWarning && (
          <div class="contrast-warning" role="alert">
            <span>Kontrast kolorów jest niższy niż 4,5:1.</span>
            <button type="button" disabled={disabled} onClick={onResetColors}>Przywróć domyślne kolory</button>
          </div>
        )}
      </section>
      {storageWarning && <p class="preferences-warning" role="status">{storageWarning}</p>}
    </section>
  );
}
