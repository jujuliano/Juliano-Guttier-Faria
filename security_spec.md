# Firebase Signage Rules Security Specification

This specification governs read/write restrictions, schema compliance, and authorization rules for the indoor signage configurations and screen monitoring collections.

## 1. Data Invariants

1. **Owner-Only Edits**: Only the authenticated user matching `ownerId` of a signage configuration document is permitted to write or edit that configuration.
2. **Read Access**: Anyone can read a configuration (to allow TV screen devices to stream settings offline/online without needing to maintain persistent active Google User sessions, but they cannot write).
3. **Heartbeat Control**: Anyone can report Screen Device heartbeats (since TVs might be public devices), but they must follow strict naming structures and throttle spam updates.
4. **No Shadow Fields**: Signage configs must match exactly the specified keys and value types to prevent "Denial of Wallet" resource utilization or corrupt records.

---

## 2. The "Dirty Dozen" Threat Payloads

Each of these invalid payloads must return `PERMISSION_DENIED` during actual or simulated testing:

1. **Spoofed Owner Write (No Auth)**: Creating a config doc with random string ownerId without being signed in.
2. **ID Hijacking**: Modifying the ownerId field of an existing config document.
3. **Ghost Field Mutation**: Writing a key outside properties (e.g. `isSuperadmin: true`) on a signage config.
4. **Denial of Wallet Large Field**: Injected strings exceeding maximum safe sizes.
5. **Privilege Escalation**: Attempting to bypass ownership validation via custom client claim properties.
6. **Self-Appointed TV Hijacker**: Overwriting another user's configuration document with a hijacked UID.
7. **Malformed State Transition**: Submitting non-boolean keys for toggle values.
8. **Invalid Device status**: Writing unrecognized state values on screens.
9. **Spam Device Heartbeat**: Attacking ID namespaces and size constraints.
10. **Target URL Poisoning**: Writing massive redirect arrays in config.
11. **Spoofed Timestamp**: Forcing client-controlled timestamp values instead of `request.time`.
12. **Malicious ID Injection**: Creating file IDs with illegal characters (e.g., path injection `../../hijack`).

---

## 3. Firestore Rules draft (`DRAFT_firestore.rules`)

We first write our rules to `firestore.rules` ensuring complete validation structures are implemented.
