import { render } from "preact";
import { App } from "./app";
import { applyPreferences, loadPreferences } from "./preferences";
import "./styles.css";

const initialPreferencesResult = loadPreferences();
applyPreferences(initialPreferencesResult.preferences);

render(
  <App
    initialPreferences={initialPreferencesResult.preferences}
    initialPreferencesError={!initialPreferencesResult.storageAvailable ? "Ustawienia działają tylko do zamknięcia tej karty — localStorage jest niedostępny." : null}
  />,
  document.querySelector<HTMLDivElement>("#app")!,
);
