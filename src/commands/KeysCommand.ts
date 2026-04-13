import type { Command } from "commander";
import {
  copyFileSync,
  existsSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import {
  type BackendName,
  type KeychainSignerConfig,
  resolveAddress,
} from "@solana/keychain";

import { Config } from "../lib/Config.ts";
import {
  BACKEND_NAMES,
  KeychainConfig,
  type KeychainConfigData,
} from "../lib/KeychainConfig.ts";
import { Output } from "../lib/Output.ts";
import { Signer } from "../lib/Signer.ts";

export class KeysCommand {
  private static readonly VALID_BACKENDS = BACKEND_NAMES.join(", ");

  public static register(program: Command): void {
    const keys = program.command("keys").description("Private key management");
    keys
      .command("list")
      .description("List all keys")
      .action(() => this.list());
    keys
      .command("add <name>")
      .description("Generate or import a keypair")
      .option("--overwrite", "Overwrite existing key")
      .option("--file <path>", "Import from a JSON file")
      .option("--seed-phrase <phrase>", "Import from seed phrase")
      .option(
        "--derivation-path <path>",
        "Derivation path for seed phrase",
        "m/44'/501'/0'/0'"
      )
      .option(
        "--private-key <key>",
        "Import from private key (hex, base58, base64, or JSON byte array)"
      )
      .option("--backend <type>", `Keychain backend (${this.VALID_BACKENDS})`)
      .option("--param <key=value...>", "Backend parameters (repeatable)")
      .action((name, opts) => this.add(name, opts));
    keys
      .command("delete <name>")
      .description("Delete a key")
      .action((name) => this.delete(name));
    keys
      .command("edit <name>")
      .description("Edit a key's name or credentials")
      .option("--name <new-name>", "Rename the key")
      .option("--seed-phrase <phrase>", "Replace key with new seed phrase")
      .option(
        "--derivation-path <path>",
        "Derivation path for seed phrase",
        "m/44'/501'/0'/0'"
      )
      .option("--private-key <key>", "Replace key with new private key")
      .action((name, opts) => this.edit(name, opts));
    keys
      .command("use <name>")
      .description("Set the active key")
      .action((name) => this.use(name));
    keys
      .command("solana-import")
      .description("Import a Solana CLI keypair")
      .option("--name <name>", "Name for the imported key")
      .option("--path <path>", "Path to Solana keypair file")
      .option("--overwrite", "Overwrite existing key")
      .action((opts) => this.solanaImport(opts));
  }

  private static keyExists(name: string): boolean {
    return (
      existsSync(join(Config.KEYS_DIR, `${name}.json`)) ||
      KeychainConfig.isKeychainKey(name)
    );
  }

  private static removeKey(name: string): void {
    const keypairPath = join(Config.KEYS_DIR, `${name}.json`);
    const kcPath = KeychainConfig.configPath(name);
    if (existsSync(keypairPath)) {
      rmSync(keypairPath);
    }
    if (existsSync(kcPath)) {
      rmSync(kcPath);
    }
  }

  private static parseParams(paramArgs: string[]): Record<string, string> {
    const params: Record<string, string> = {};
    for (const arg of paramArgs) {
      const eqIdx = arg.indexOf("=");
      if (eqIdx === -1) {
        throw new Error(
          `Invalid --param format: "${arg}". Expected key=value.`
        );
      }
      params[arg.slice(0, eqIdx)] = arg.slice(eqIdx + 1);
    }
    return params;
  }

  private static async list(): Promise<void> {
    if (!existsSync(Config.KEYS_DIR)) {
      throw new Error("No keys found.");
    }

    const files = readdirSync(Config.KEYS_DIR);
    const settings = Config.load();

    const keypairFiles = files.filter(
      (f) => f.endsWith(".json") && !f.endsWith(".keychain.json")
    );
    const keychainFiles = files.filter((f) => f.endsWith(".keychain.json"));

    const keypairData = await Promise.all(
      keypairFiles.map(async (file) => {
        const name = file.replace(".json", "");
        const signer = await Signer.load(name);
        return {
          name,
          address: signer.address,
          type: "keypair",
          active: settings.activeKey === name,
        };
      })
    );

    const keychainData = keychainFiles.map((file) => {
      const name = file.replace(".keychain.json", "");
      const config = KeychainConfig.load(name);
      return {
        name,
        address: config.resolvedAddress,
        type: config.signerConfig.backend,
        active: settings.activeKey === name,
      };
    });

    const data = [...keypairData, ...keychainData];

    if (Output.isJson()) {
      Output.json(data);
      return;
    }

    Output.table({
      type: "horizontal",
      headers: {
        name: "Name",
        address: "Address",
        type: "Type",
        active: "Active",
      },
      rows: data.map((d) => ({
        ...d,
        active: Output.formatBoolean(d.active),
      })),
    });
  }

  private static async add(
    name: string,
    opts: {
      overwrite?: boolean;
      file?: string;
      seedPhrase?: string;
      derivationPath?: string;
      privateKey?: string;
      backend?: string;
      param?: string[];
    } = {}
  ): Promise<void> {
    const isKeychain = !!opts.backend;

    if (isKeychain) {
      const keypairModes = [opts.file, opts.seedPhrase, opts.privateKey].filter(
        Boolean
      );
      if (keypairModes.length > 0) {
        throw new Error(
          "--backend is mutually exclusive with --file, --seed-phrase, and --private-key."
        );
      }
      return this.addKeychain(
        name,
        opts as { backend: string; param?: string[]; overwrite?: boolean }
      );
    }

    if (this.keyExists(name) && !opts.overwrite) {
      throw new Error(
        `Key "${name}" already exists. Use --overwrite to replace.`
      );
    }

    const importModes = [opts.file, opts.seedPhrase, opts.privateKey].filter(
      Boolean
    );
    if (importModes.length > 1) {
      throw new Error(
        "--file, --seed-phrase, and --private-key are mutually exclusive."
      );
    }

    let signer: Signer;
    if (opts.file) {
      const file = readFileSync(opts.file, "utf-8");
      signer = await Signer.fromPrivateKey(file);
    } else if (opts.seedPhrase) {
      signer = await Signer.fromSeedPhrase(
        opts.seedPhrase,
        opts.derivationPath
      );
    } else if (opts.privateKey) {
      signer = await Signer.fromPrivateKey(opts.privateKey);
    } else {
      signer = await Signer.generate();
    }
    if (opts.overwrite) {
      this.removeKey(name);
    }
    signer.save(name);

    this.list();
  }

  private static async addKeychain(
    name: string,
    opts: {
      backend: string;
      param?: string[];
      overwrite?: boolean;
    }
  ): Promise<void> {
    const backend = opts.backend as BackendName;
    if (!BACKEND_NAMES.includes(backend)) {
      throw new Error(
        `Unknown backend "${opts.backend}". Valid backends: ${this.VALID_BACKENDS}`
      );
    }

    if (this.keyExists(name) && !opts.overwrite) {
      throw new Error(
        `Key "${name}" already exists. Use --overwrite to replace.`
      );
    }

    const params = this.parseParams(opts.param ?? []);
    const signerConfig = { backend, ...params } as KeychainSignerConfig;

    const address = await resolveAddress(signerConfig);

    const config: KeychainConfigData = {
      signerConfig,
      resolvedAddress: address as string,
    };

    if (opts.overwrite) {
      this.removeKey(name);
    }
    KeychainConfig.save(name, config);
    this.list();
  }

  private static delete(name: string): void {
    if (!this.keyExists(name)) {
      throw new Error(`Key "${name}" not found.`);
    }
    this.removeKey(name);
    this.list();
  }

  private static async edit(
    name: string,
    opts: {
      name?: string;
      seedPhrase?: string;
      derivationPath?: string;
      privateKey?: string;
    } = {}
  ): Promise<void> {
    if (!opts.name && !opts.seedPhrase && !opts.privateKey) {
      throw new Error(
        "At least one option is required (--name, --seed-phrase, or --private-key)."
      );
    }
    if (opts.seedPhrase && opts.privateKey) {
      throw new Error(
        "--seed-phrase and --private-key are mutually exclusive."
      );
    }

    const isKeychain = KeychainConfig.isKeychainKey(name);
    const keyPath = isKeychain
      ? KeychainConfig.configPath(name)
      : join(Config.KEYS_DIR, `${name}.json`);

    if (!existsSync(keyPath)) {
      throw new Error(`Key "${name}" not found.`);
    }

    if (isKeychain && (opts.seedPhrase || opts.privateKey)) {
      throw new Error("Cannot replace credentials for a keychain-backed key.");
    }

    if (opts.seedPhrase || opts.privateKey) {
      const signer = opts.seedPhrase
        ? await Signer.fromSeedPhrase(opts.seedPhrase, opts.derivationPath)
        : await Signer.fromPrivateKey(opts.privateKey!);
      signer.save(name);
    }

    if (opts.name) {
      if (this.keyExists(opts.name)) {
        throw new Error(`Key "${opts.name}" already exists.`);
      }
      const newPath = isKeychain
        ? KeychainConfig.configPath(opts.name)
        : join(Config.KEYS_DIR, `${opts.name}.json`);
      renameSync(keyPath, newPath);
      const settings = Config.load();
      if (settings.activeKey === name) {
        Config.set({ activeKey: opts.name });
      }
    }

    this.list();
  }

  private static use(name: string): void {
    if (!this.keyExists(name)) {
      throw new Error(`Key "${name}" not found.`);
    }
    Config.set({ activeKey: name });
    this.list();
  }

  private static solanaImport(
    opts: {
      name?: string;
      path?: string;
      overwrite?: boolean;
    } = {}
  ): void {
    const name = opts.name ?? "default";
    const sourcePath =
      opts.path ?? join(homedir(), ".config", "solana", "id.json");
    if (!existsSync(sourcePath)) {
      throw new Error(`Solana keypair not found at: ${sourcePath}`);
    }

    if (this.keyExists(name) && !opts.overwrite) {
      throw new Error(
        `Key "${name}" already exists. Use --overwrite to replace.`
      );
    }

    if (opts.overwrite) {
      this.removeKey(name);
    }
    const destPath = join(Config.KEYS_DIR, `${name}.json`);
    copyFileSync(sourcePath, destPath);
    this.list();
  }
}
