import { render } from "preact";
import { App } from "./app";
import "./styles.css";

render(<App />, document.querySelector<HTMLDivElement>("#app")!);
