export function serverOrigin(value) {
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw Error(
      "Enter a complete server address, such as https://voice.example.com.",
    );
  }
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback))
    throw Error(
      "Use HTTPS for a server connection. HTTP is only allowed on localhost.",
    );
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw Error(
      "Enter only the server origin, without credentials, paths, or query parameters.",
    );
  return url.origin;
}
export class RemoteVoiceEngine {
  #token;
  constructor(address, token, fetcher = globalThis.fetch) {
    this.origin = serverOrigin(address);
    if (!token || /\s/.test(token) || !/^[\x21-\x7e]{32,512}$/.test(token))
      throw Error(
        "Enter the server API access token (at least 32 characters).",
      );
    this.#token = token;
    this.fetcher = (...args) => fetcher(...args);
  }
  disconnect() {
    this.#token = "";
  }
  async request(path, body) {
    if (!this.#token)
      throw Error("Reconnect to the server with your access token.");
    let response;
    try {
      response = await this.fetcher(this.origin + "/api/" + path, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          Authorization: "Bearer " + this.#token,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: "omit",
        redirect: "error",
        cache: "no-store",
        referrerPolicy: "no-referrer",
        signal: AbortSignal.timeout(path === "generate" ? 30 * 60_000 : 10_000),
      });
    } catch {
      throw Error(
        "Cannot reach the server. Check its HTTPS address, network, and allowed app origins.",
      );
    }
    if (!response.ok) {
      const message =
        response.status === 401
          ? "Access token rejected. Reconnect with a valid server token."
          : response.status === 403
            ? "This app origin is not allowed by the server."
            : response.status === 409
              ? "The server model is not ready or another generation is running. Try again shortly."
              : "Server request failed. Check server status and logs.";
      throw Object.assign(Error(message), { status: response.status });
    }
    if (path === "generate") {
      if (!response.headers.get("Content-Type")?.startsWith("audio/wav"))
        throw Error("The server did not return WAV audio.");
      return response.blob();
    }
    let data;
    try {
      data = await response.json();
    } catch {
      throw Error("This address is not a Bek inference server.");
    }
    if (
      !["idle", "ready", "loading", "busy", "error"].includes(data.state) ||
      (path === "status" && data.engine !== "server")
    )
      throw Error(
        "This address is not an authenticated Bek server. Enable remote mode on the VPS.",
      );
    return {
      state: data.state,
      message:
        typeof data.message === "string" ? data.message : "Server connected.",
    };
  }
  status() {
    return this.request("status");
  }
  load() {
    return this.request("load", {});
  }
  generate(body) {
    return this.request("generate", body);
  }
}
