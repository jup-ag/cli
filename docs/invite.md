# Jupiter Send Invites

Requires a Jupiter API key. Sending and clawing back an invite also require an
active key. See [setup](setup.md).

The `invite` command creates Jupiter Send invites that recipients can claim
without a wallet at creation time. An invite code is sensitive: treat it like a
password because it is needed to claim an unclaimed invite.

## Send an invite

```bash
jup invite send --token USDC --amount 10
jup invite send --token SOL --amount 0.1 --key mykey
jup invite send --token USDC --raw-amount 10000000 --dry-run
```

- `--token` accepts a symbol or mint address and defaults to SOL.
- Provide exactly one of `--amount` (human-readable units) or `--raw-amount`
  (on-chain units).
- `--key` overrides the active key.
- `--dry-run` signs and simulates without submitting.

The response contains a shareable `inviteCode`, its `invitePda`, `expiry`, and
transaction `signature`. Save the invite code securely; it is not stored by the
CLI and is never printed again by list/history commands.

## Claw back an invite

```bash
jup invite clawback --invite <invitePda>
jup invite clawback --invite <invitePda> --key mykey
jup invite clawback --invite <invitePda> --dry-run
```

Use an unclaimed invite PDA returned by `jup invite list`. The sender signs the
clawback transaction; dry-run simulates it without submitting.

## List pending invites

```bash
jup invite list
jup invite list --key mykey
jup invite list --address <wallet-address>
jup invite list --page 2
```

With no wallet option, this uses the active key's wallet. `--key` and
`--address` are mutually exclusive.

## View invite history

```bash
jup invite history
jup invite history --key mykey
jup invite history --address <wallet-address>
jup invite history --page 2
```

History includes invites where the wallet was the sender or recipient.
