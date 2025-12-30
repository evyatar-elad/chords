import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// This constant WILL change the bundle hash
const BUILD_ID = "v2025-12-30-final";
console.log("Build:", BUILD_ID);

createRoot(document.getElementById("root")!).render(<App />);
