import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl, setAuthTokenGetter } from "@/lib";

const base = (import.meta.env.BASE_URL ?? "/").replace(/\/+$/, "");
setBaseUrl(base || null);
setAuthTokenGetter(() => localStorage.getItem("token"));

createRoot(document.getElementById("root")!).render(<App />);
