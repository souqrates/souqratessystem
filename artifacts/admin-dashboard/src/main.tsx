import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { getAdminToken } from "./lib/admin-token";

// All generated react-query hooks call customFetch, which will now attach
// `Authorization: Bearer <ADMIN_TOKEN>` to every request — required by the
// requireAdmin middleware on admin routes (settings, bots, withdrawals,
// admin-only stats, etc.).
setAuthTokenGetter(() => getAdminToken());

createRoot(document.getElementById("root")!).render(<App />);
