import { execFile } from "node:child_process";
import os from "node:os";
import fs from "node:fs/promises";
import path from "node:path";

// Read-only introspection of the machine this process is running on. Every
// command here only *reads* state (package listings, OS security toggles,
// listening sockets, account lists) — nothing is installed, changed, or
// written, and nothing outside this host is touched. This is the "asset
// inventory" and "control effectiveness evaluation" data source for the
// live self-assessment mode (see README > Live data mode).

function run(cmd, args, timeoutMs = 6000) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 }, (err, stdout) => {
      if (err) return resolve(null);
      resolve(stdout.toString());
    });
  });
}

async function getNpmGlobalPackages() {
  const out = await run("npm", ["ls", "-g", "--depth=0", "--json"]);
  if (!out) return [];
  try {
    const json = JSON.parse(out);
    return Object.entries(json.dependencies || {})
      .filter(([name]) => name !== "npm")
      .map(([name, info]) => ({ name, version: (info.version || "").replace(/^\^|~/, ""), ecosystem: "npm" }))
      .filter((p) => p.version);
  } catch {
    return [];
  }
}

async function getPipPackages() {
  for (const bin of ["pip3", "pip"]) {
    const out = await run(bin, ["list", "--format=json"]);
    if (!out) continue;
    try {
      const json = JSON.parse(out);
      return json.map((p) => ({ name: p.name, version: p.version, ecosystem: "PyPI" }));
    } catch {
      continue;
    }
  }
  return [];
}

async function getListeningPorts() {
  const out = await run("lsof", ["-iTCP", "-sTCP:LISTEN", "-P", "-n"]);
  if (!out) return [];
  const lines = out.split("\n").slice(1).filter(Boolean);
  const seen = new Set();
  const ports = [];
  for (const line of lines) {
    const cols = line.trim().split(/\s+/);
    const proc = cols[0];
    const addr = cols[cols.length - 2];
    const m = addr && addr.match(/:(\d+)$/);
    if (!m) continue;
    const port = m[1];
    const key = `${proc}:${port}`;
    if (seen.has(key)) continue;
    seen.add(key);
    ports.push({ process: proc, port: Number(port), address: addr });
  }
  return ports;
}

async function getAccounts() {
  const out = await run("dscl", [".", "-list", "/Users", "UniqueID"]);
  if (!out) return [];
  const adminOut = await run("dscl", [".", "-read", "/Groups/admin", "GroupMembership"]);
  const admins = new Set((adminOut || "").replace("GroupMembership:", "").trim().split(/\s+/));
  return out
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [name, uid] = l.split(/\s+/);
      return { name, uid: Number(uid), isAdmin: admins.has(name) };
    })
    .filter((u) => u.uid >= 500 && !u.name.startsWith("_"));
}

async function getSshKeyHygiene() {
  const dir = path.join(os.homedir(), ".ssh");
  try {
    const files = await fs.readdir(dir);
    const keyFiles = files.filter((f) => !f.endsWith(".pub") && f !== "known_hosts" && f !== "config" && f !== "authorized_keys");
    const results = [];
    for (const f of keyFiles) {
      const full = path.join(dir, f);
      try {
        const stat = await fs.stat(full);
        const mode = (stat.mode & 0o777).toString(8);
        const out = await run("ssh-keygen", ["-lf", full]);
        const passphraseProtected = out ? !out.includes("no comment") || true : null;
        results.push({ file: f, permissive: mode !== "600", mode, info: out ? out.trim().split("\n")[0] : null });
      } catch {
        continue;
      }
    }
    return results;
  } catch {
    return [];
  }
}

async function getSecurityPosture() {
  const [fileVault, sip, firewall, firewallStealth, timeMachine, swVers] = await Promise.all([
    run("fdesetup", ["status"]),
    run("csrutil", ["status"]),
    run("/usr/libexec/ApplicationFirewall/socketfilterfw", ["--getglobalstate"]),
    run("/usr/libexec/ApplicationFirewall/socketfilterfw", ["--getstealthmode"]),
    run("tmutil", ["destinationinfo"]),
    run("sw_vers", []),
  ]);

  return {
    fileVaultOn: fileVault ? /FileVault is On/i.test(fileVault) : null,
    sipEnabled: sip ? /enabled/i.test(sip) : null,
    firewallOn: firewall ? /State = 1|enabled/i.test(firewall) : firewall === null ? null : false,
    firewallStealth: firewallStealth ? /enabled/i.test(firewallStealth) : null,
    timeMachineConfigured: timeMachine ? !/No destinations configured/i.test(timeMachine) : null,
    osVersion: swVers || null,
  };
}

export async function gatherLocalInventory() {
  const [npmPackages, pipPackages, listeningPorts, accounts, sshKeys, security] = await Promise.all([
    getNpmGlobalPackages(),
    getPipPackages(),
    getListeningPorts(),
    getAccounts(),
    getSshKeyHygiene(),
    getSecurityPosture(),
  ]);

  return {
    platform: os.platform(),
    arch: os.arch(),
    hostname: os.hostname(),
    scannedAt: new Date().toISOString(),
    npmPackages,
    pipPackages,
    packages: [...npmPackages, ...pipPackages],
    listeningPorts,
    accounts,
    sshKeys,
    security,
  };
}
