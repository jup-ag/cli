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

import { Config } from "../lib/Config.ts";
import { Output } from "../lib/Output.ts";
import { Signer } from "../lib/Signer.ts";

export class KeysCommand {
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

  private static async list(): Promise<void> {
    if (!existsSync(Config.KEYS_DIR)) {
      throw new Error("No keys found.");
    }

    const files = readdirSync(Config.KEYS_DIR).filter((f) =>
      f.endsWith(".json")
    );
    const settings = Config.load();
    const data = await Promise.all(
      files.map(async (file) => {
        const name = file.replace(".json", "");
        const signer = await Signer.load(name);
        return {
          name,
          address: signer.address,
          active: settings.activeKey === name,
        };
      })
    );

    if (Output.isJson()) {
      Output.json(data);
      return;
    }

    Output.table({
      type: "horizontal",
      headers: { name: "Name", address: "Address", active: "Active" },
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
    } = {}
  ): Promise<void> {
    const keyPath = join(Config.KEYS_DIR, `${name}.json`);
    if (existsSync(keyPath) && !opts.overwrite) {
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
    signer.save(name);

    this.list();
  }

  private static delete(name: string): void {
    const keyPath = join(Config.KEYS_DIR, `${name}.json`);
    if (!existsSync(keyPath)) {
      throw new Error(`Key "${name}" not found.`);
    }
    rmSync(keyPath);
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

    const keyPath = join(Config.KEYS_DIR, `${name}.json`);
    if (!existsSync(keyPath)) {
      throw new Error(`Key "${name}" not found.`);
    }

    if (opts.seedPhrase || opts.privateKey) {
      const signer = opts.seedPhrase
        ? await Signer.fromSeedPhrase(opts.seedPhrase, opts.derivationPath)
        : await Signer.fromPrivateKey(opts.privateKey!);
      signer.save(name);
    }

    if (opts.name) {
      const newPath = join(Config.KEYS_DIR, `${opts.name}.json`);
      if (existsSync(newPath)) {
        throw new Error(`Key "${opts.name}" already exists.`);
      }
      renameSync(keyPath, newPath);
      const settings = Config.load();
      if (settings.activeKey === name) {
        Config.set({ activeKey: opts.name });
      }
    }

    this.list();
  }

  private static use(name: string): void {
    const keyPath = join(Config.KEYS_DIR, `${name}.json`);
    if (!existsSync(keyPath)) {
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

    const destPath = join(Config.KEYS_DIR, `${name}.json`);
    if (existsSync(destPath) && !opts.overwrite) {
      throw new Error(
        `Key "${name}" already exists. Use --overwrite to replace.`
      );
    }

    copyFileSync(sourcePath, destPath);
    this.list();
  }
}
