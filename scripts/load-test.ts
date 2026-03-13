/**
 * Indefinite load and functionality test script.
 * All traffic goes through the API Gateway (no direct microservice access).
 * Creates one main user at startup and keeps lists of created users and items to reuse in each cycle.
 *
 * Usage:
 *   pnpm load-test
 *   LOAD_TEST_ADMIN_EMAIL=admin@example.com LOAD_TEST_ADMIN_PASSWORD=secret pnpm load-test
 *
 * Env:
 *   GATEWAY_BASE_URL       - Gateway base (default http://localhost:8080)
 *   LOAD_TEST_INTERVAL_MS  - Delay between cycles (default 2000)
 *   LOAD_TEST_ADMIN_EMAIL / LOAD_TEST_ADMIN_PASSWORD - If set, run admin flows (create user, get user)
 *   LOAD_TEST_REQUEST_TIMEOUT_MS - Timeout per request (default 15000); avoids script hanging if gateway/server stops responding.
 */

const GATEWAY_BASE_URL =
  process.env.GATEWAY_BASE_URL ?? "http://localhost:8080";
const INTERVAL_MS = Math.max(
  500,
  parseInt(process.env.LOAD_TEST_INTERVAL_MS ?? "2000", 10)
);
const REQUEST_TIMEOUT_MS = Math.max(
  2000,
  parseInt(process.env.LOAD_TEST_REQUEST_TIMEOUT_MS ?? "15000", 10)
);
const ADMIN_EMAIL = process.env.LOAD_TEST_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.LOAD_TEST_ADMIN_PASSWORD;

const identity = (path: string) => `${GATEWAY_BASE_URL}/identity/${path.replace(/^\//, "")}`;
const catalog = (path: string) => `${GATEWAY_BASE_URL}/catalog/${path.replace(/^\//, "")}`;

interface Stats {
  cycle: number;
  ok: number;
  fail: number;
  latencies: number[];
}

const stats: Stats = {
  cycle: 0,
  ok: 0,
  fail: 0,
  latencies: [],
};

/** Main user created once and reused (login, me, catalog create). */
interface MainUser {
  email: string;
  password: string;
  token: string | null;
  id: string | null;
}

/** Reusable state: main user + lists of created ids for read/other ops. */
const state = {
  mainUser: null as MainUser | null,
  createdUserIds: [] as string[],
  createdItemIds: [] as string[],
  adminToken: null as string | null,
};

function log(msg: string, data?: object) {
  const ts = new Date().toISOString();
  const line = data ? `${ts} ${msg} ${JSON.stringify(data)}` : `${ts} ${msg}`;
  process.stdout.write(line + "\n");
}

/** Write to stderr so progress is visible even when stdout is buffered (e.g. under pnpm). */
function heartbeat(cycle: number) {
  if (cycle % 10 === 0) process.stderr.write(` cycle ${cycle}\n`);
  else process.stderr.write(".");
}

function fetchWithTimeout(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return fetch(url, {
    ...options,
    signal: controller.signal,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  }).finally(() => clearTimeout(timeoutId));
}

async function fetchJson(
  url: string,
  options: RequestInit = {}
): Promise<{ status: number; body: unknown }> {
  const start = Date.now();
  let res: Response;
  try {
    res = await fetchWithTimeout(url, options);
  } catch (err) {
    const elapsed = Date.now() - start;
    stats.latencies.push(elapsed);
    if (stats.latencies.length > 100) stats.latencies.shift();
    throw err;
  }
  const elapsed = Date.now() - start;
  stats.latencies.push(elapsed);
  if (stats.latencies.length > 100) stats.latencies.shift();

  let body: unknown;
  const ct = res.headers.get("content-type");
  if (ct?.includes("application/json")) {
    try {
      body = await res.json();
    } catch {
      body = await res.text();
    }
  } else {
    body = await res.text();
  }
  return { status: res.status, body };
}

function record(success: boolean) {
  if (success) stats.ok++;
  else stats.fail++;
}

/** Register via gateway; returns accessToken. */
async function register(
  email: string,
  name: string,
  password: string
): Promise<string | null> {
  const { status, body } = await fetchJson(identity("/api/auth/register"), {
    method: "POST",
    body: JSON.stringify({ email, name, password }),
  });
  if (status !== 201 || typeof body !== "object" || body === null) {
    log("register failed", { status, body });
    record(false);
    return null;
  }
  const b = body as { accessToken?: string };
  if (typeof b.accessToken !== "string") {
    log("register missing accessToken", { body });
    record(false);
    return null;
  }
  record(true);
  return b.accessToken;
}

/** Login via gateway; returns accessToken. */
async function login(email: string, password: string): Promise<string | null> {
  const { status, body } = await fetchJson(identity("/api/auth/login"), {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (status !== 200 || typeof body !== "object" || body === null) {
    log("login failed", { status, body });
    record(false);
    return null;
  }
  const b = body as { accessToken?: string };
  if (typeof b.accessToken !== "string") {
    log("login missing accessToken", { body });
    record(false);
    return null;
  }
  record(true);
  return b.accessToken;
}

/** GET /api/auth/me via gateway. */
async function me(token: string): Promise<{ id: string } | null> {
  const { status, body } = await fetchJson(identity("/api/auth/me"), {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (status !== 200 || typeof body !== "object" || body === null) {
    record(false);
    log("me failed", { status });
    return null;
  }
  // API returns user at top level: { id, email, name, createdAt }
  const b = body as { id?: string };
  const id = b.id;
  record(true);
  return typeof id === "string" ? { id } : null;
}

/** POST /api/users (admin) via gateway. */
async function createUser(
  adminToken: string,
  email: string,
  name: string
): Promise<string | null> {
  const { status, body } = await fetchJson(identity("/api/users"), {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ email, name }),
  });
  if (status !== 201 || typeof body !== "object" || body === null) {
    log("create user failed", { status, body });
    record(false);
    return null;
  }
  const b = body as { id?: string };
  if (typeof b.id !== "string") {
    log("create user missing id", { body });
    record(false);
    return null;
  }
  record(true);
  return b.id;
}

/** GET /api/users/:id via gateway. */
async function getUser(token: string, userId: string): Promise<boolean> {
  const { status } = await fetchJson(
    identity(`/api/users/${encodeURIComponent(userId)}`),
    {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  const ok = status === 200;
  record(ok);
  if (!ok) log("get user failed", { status, userId });
  return ok;
}

/** GET /api/items via gateway. */
async function listItems(): Promise<boolean> {
  const { status } = await fetchJson(catalog("/api/items"), { method: "GET" });
  const ok = status === 200;
  record(ok);
  if (!ok) log("list items failed", { status });
  return ok;
}

/** POST /api/items via gateway; returns item id. */
async function createItem(
  token: string,
  name: string,
  priceAmount: number,
  priceCurrency: string
): Promise<string | null> {
  const { status, body } = await fetchJson(catalog("/api/items"), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name, priceAmount, priceCurrency }),
  });
  if (status !== 201 || typeof body !== "object" || body === null) {
    log("create item failed", { status, body });
    record(false);
    return null;
  }
  const b = body as { id?: string };
  if (typeof b.id !== "string") {
    log("create item missing id", { body });
    record(false);
    return null;
  }
  record(true);
  return b.id;
}

/** Health checks via gateway. */
async function healthCheck(): Promise<boolean> {
  const [gatewayRes, idRes, catRes] = await Promise.all([
    fetchWithTimeout(`${GATEWAY_BASE_URL}/health`),
    fetchWithTimeout(identity("/health")),
    fetchWithTimeout(catalog("/health")),
  ]);
  const ok = gatewayRes.ok && idRes.ok && catRes.ok;
  record(ok);
  if (!ok)
    log("health check failed", {
      gateway: gatewayRes.status,
      identity: idRes.status,
      catalog: catRes.status,
    });
  return ok;
}

function latencySummary(): string {
  if (stats.latencies.length === 0) return "—";
  const sorted = [...stats.latencies].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)] ?? 0;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
  const p99 = sorted[Math.floor(sorted.length * 0.99)] ?? 0;
  return `p50=${p50}ms p95=${p95}ms p99=${p99}ms`;
}

/** Create the single main user once and store in state. */
async function ensureMainUser(): Promise<boolean> {
  if (state.mainUser && state.mainUser.token) return true;

  const email = `loadtest-${Date.now()}@loadtest.example.com`;
  const password = "LoadTestPass123";
  const token = await register(email, `LoadTest User ${Date.now()}`, password);
  if (!token) return false;

  const meResult = await me(token);
  state.mainUser = {
    email,
    password,
    token,
    id: meResult?.id ?? null,
  };
  log("main user created and saved", { email, id: state.mainUser.id });
  return true;
}

/** Refresh main user token (login) and optionally update id from me. */
async function refreshMainUserToken(): Promise<void> {
  if (!state.mainUser) return;
  const token = await login(state.mainUser.email, state.mainUser.password);
  if (token) {
    state.mainUser.token = token;
    const meResult = await me(token);
    if (meResult) state.mainUser.id = meResult.id;
  }
}

async function runCycle(): Promise<void> {
  stats.cycle++;

  await healthCheck();

  if (!state.mainUser) {
    const ok = await ensureMainUser();
    if (!ok) return;
  }

  const token = state.mainUser!.token;
  if (!token) {
    await refreshMainUserToken();
    if (!state.mainUser?.token) return;
  }

  const currentToken = state.mainUser!.token!;

  await me(currentToken);
  await listItems();

  const itemId = await createItem(
    currentToken,
    `Item ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    Math.floor(Math.random() * 50000) + 100,
    "BRL"
  );
  if (itemId) state.createdItemIds.push(itemId);

  if (state.createdUserIds.length > 0) {
    const randomId =
      state.createdUserIds[
        Math.floor(Math.random() * state.createdUserIds.length)
      ]!;
    await getUser(currentToken, randomId);
  }

  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    const adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    if (adminToken) {
      state.adminToken = adminToken;
      const newUserEmail = `created-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@loadtest.example.com`;
      const userId = await createUser(
        adminToken,
        newUserEmail,
        "Created by load test"
      );
      if (userId) {
        state.createdUserIds.push(userId);
        await getUser(adminToken, userId);
      }
    }
  }
}

async function main(): Promise<void> {
  log("load-test started (via gateway only)", {
    GATEWAY_BASE_URL,
    INTERVAL_MS,
    REQUEST_TIMEOUT_MS,
    adminFlow: Boolean(ADMIN_EMAIL && ADMIN_PASSWORD),
  });

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    log(
      "LOAD_TEST_ADMIN_EMAIL and LOAD_TEST_ADMIN_PASSWORD not set; skipping admin flows (create user, get user)"
    );
  }

  for (;;) {
    try {
      await runCycle();
    } catch (err) {
      stats.fail++;
      const message =
        err instanceof Error ? err.message : String(err);
      const reason =
        err instanceof Error && err.name === "AbortError"
          ? "request timeout"
          : message;
      log("cycle error", { error: reason });
      await refreshMainUserToken();
    }

    heartbeat(stats.cycle);
    if (stats.cycle % 10 === 0) {
      log("stats", {
        cycle: stats.cycle,
        ok: stats.ok,
        fail: stats.fail,
        usersInList: state.createdUserIds.length,
        itemsInList: state.createdItemIds.length,
        latency: latencySummary(),
      });
    }

    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
}

main();
