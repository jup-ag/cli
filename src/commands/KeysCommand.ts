import type { Command } from "commander";
import { copyFileSync, existsSync, readdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { Config } from "../lib/Config.ts";
import { Output } from "../lib/Output.ts";
import { Signer } from "../lib/Signer.ts";

export class KeysCommand {
  public static register(program: Command): void {
    const keys = program.command("keys").description("Manage keypairs");
    keys
      .command("list")
      .description("List all keys")
      .action(() => this.list());
    keys
      .command("add [name]")
      .description("Generate or recover a keypair")
      .option("--overwrite", "Overwrite existing key")
      .option("--recover", "Recover from seed phrase or private key")
      .option("--seed-phrase <phrase>", "Seed phrase for recovery")
      .option("--private-key <key>", "Private key (base58) for recovery")
      .action((name, opts) => this.add(name, opts));
    keys
      .command("delete <name>")
      .description("Delete a key")
      .action((name) => this.delete(name));
    keys
      .command("use <name>")
      .description("Set the active key")
      .action((name) => this.use(name));
    keys
      .command("solana-import")
      .description("Import a Solana CLI keypair")
      .option("--name <name>", "Name for the imported key")
      .option("--path <path>", "Path to Solana keypair file")
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
    name: string = "default",
    opts: {
      overwrite?: boolean;
      recover?: boolean;
      seedPhrase?: string;
      privateKey?: string;
    } = {}
  ): Promise<void> {
    const keyPath = join(Config.KEYS_DIR, `${name}.json`);

    if (existsSync(keyPath) && !opts.overwrite) {
      throw new Error(
        `Key "${name}" already exists. Use --overwrite to replace.`
      );
    }

    let signer: Signer;
    if (opts.recover) {
      if (opts.seedPhrase) {
        signer = await Signer.fromSeedPhrase(opts.seedPhrase);
      } else if (opts.privateKey) {
        signer = await Signer.fromPrivateKey(opts.privateKey);
      } else {
        throw new Error("--recover requires --seed-phrase or --private-key");
      }
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
    } = {}
  ): void {
    const name = opts.name ?? "default";
    const sourcePath =
      opts.path ?? join(homedir(), ".config", "solana", "id.json");

    if (!existsSync(sourcePath)) {
      throw new Error(`Solana keypair not found at: ${sourcePath}`);
    }

    const destPath = join(Config.KEYS_DIR, `${name}.json`);
    copyFileSync(sourcePath, destPath);
    this.list();
  }
}
