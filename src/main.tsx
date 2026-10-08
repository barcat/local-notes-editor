import { render } from "preact";
import { App } from "./app";
import { applyPreferences, loadPreferences } from "./preferences";
import { restorePendingPath } from "./routing";
import "./styles.css";

restorePendingPath();
const initialPreferencesResult = loadPreferences();
applyPreferences(initialPreferencesResult.preferences);

render(
  <App
    initialPreferences={initialPreferencesResult.preferences}
  />,
  document.querySelector<HTMLDivElement>("#app")!,
);
