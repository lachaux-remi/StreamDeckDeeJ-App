import { Buffer } from "buffer";
import crypto from "crypto";
import { session } from "electron";
import fetch from "electron-fetch";
import ping from "ping";

import TapoCipher from "./TapoCipher";

type TapoAPIResponse = {
  error_code: number;
  result: {
    device_on: boolean;
    brightness: number;
  };
};

/* eslint-disable camelcase */
class TapoAPI {
  private cipher?: TapoCipher;

  constructor(
    protected readonly ipAddress: string,
    protected readonly email: string,
    protected readonly password: string
  ) {}

  public async getInfo() {
    return this.sendSecureRequest("get_device_info");
  }

  public async brightness() {
    const info = await this.getInfo();

    const brightness = info.result.brightness > 75 ? 25 : info.result.brightness + 25;
    await this.sendSecureRequest("set_device_info", { brightness });

    return { brightness, device_on: true };
  }

  public async toggle() {
    const info = await this.getInfo();

    const device_on = !info.result.device_on;
    await this.sendSecureRequest("set_device_info", { device_on });

    return { brightness: info.result.brightness, device_on };
  }

  public async turnOn() {
    const info = await this.getInfo();

    const device_on = true;
    await this.sendSecureRequest("set_device_info", { device_on });

    return { brightness: info.result.brightness, device_on };
  }

  public async turnOff() {
    const info = await this.getInfo();

    const device_on = false;
    await this.sendSecureRequest("set_device_info", { device_on });

    return { brightness: info.result.brightness, device_on };
  }

  private async sendSecureRequest(
    method: string,
    params: {
      [key: string]: boolean | number;
    } = {}
  ): Promise<TapoAPIResponse> {
    await this.handshake();

    const rawRequest = JSON.stringify({ method, params: (Object.keys(params).length > 0 && params) || null });
    const requestData = this.cipher!.encrypt(rawRequest);

    const response = await this.sessionPost("/request", requestData.encrypted, { seq: requestData.seq.toString() });
    if (response.status !== 200) {
      throw new Error("Request failed");
    }

    return JSON.parse(this.cipher!.decrypt(Buffer.from(await response.arrayBuffer())));
  }

  private async handshake() {
    const resultPing = await ping.promise.probe(this.ipAddress, { timeout: 60 });
    if (!resultPing.alive) {
      throw new Error("Device is not reachable");
    }

    await session.defaultSession.clearStorageData();

    const { localSeed, remoteSeed, authHash } = await this.firstHandshake();
    await this.secondHandshake(localSeed, remoteSeed, authHash);
  }

  private async firstHandshake() {
    const localSeed = crypto.randomBytes(16);
    const response = await this.sessionPost("/handshake1", localSeed);

    if (response.status !== 200) {
      throw new Error("Handshake failed");
    }

    if (response.headers.get("content-length") !== "48") {
      throw new Error("Handshake failed due to invalid content length");
    }

    const data = await response.arrayBuffer();
    const remoteSeed = Buffer.from(data.slice(0, 16));
    const serverHash = Buffer.from(data.slice(16));

    const authHash = this.hashAuth(this.email, this.password);
    const localHash = this.sha256(Buffer.concat([localSeed, remoteSeed, authHash]));

    if (Buffer.compare(localHash, serverHash) === 0) {
      return {
        localSeed,
        remoteSeed,
        authHash
      };
    }

    throw new Error("Failed to verify server hash");
  }

  private async secondHandshake(localSeed: Buffer, remoteSeed: Buffer, authHash: Buffer) {
    const payload = this.sha256(Buffer.concat([remoteSeed, localSeed, authHash]));

    const response = await this.sessionPost("/handshake2", payload);

    if (response.status === 200) {
      this.cipher = new TapoCipher(localSeed, remoteSeed, authHash);
      return;
    }

    this.cipher = undefined;
    throw new Error(`Failed to handshake ${await response.text()}`);
  }

  private async sessionPost(path: string, payload: Buffer, params?: Record<string, string>) {
    const urlParams = params ? "?" + new URLSearchParams(params).toString() : "";
    return await fetch(`http://${this.ipAddress}/app${path}${urlParams}`, {
      method: "POST",
      body: payload,
      useSessionCookies: true
    });
  }

  private sha256(data: Buffer) {
    return crypto.createHash("sha256").update(data).digest();
  }

  private sha1(data: Buffer) {
    return crypto.createHash("sha1").update(data).digest();
  }

  private hashAuth(email: string, password: string) {
    return this.sha256(
      Buffer.concat([
        this.sha1(Buffer.from(email.normalize("NFKC"))),
        this.sha1(Buffer.from(password.normalize("NFKC")))
      ])
    );
  }
}

export default TapoAPI;
