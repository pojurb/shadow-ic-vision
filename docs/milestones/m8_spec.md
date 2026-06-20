# Milestone 8 Specification: BYOK Trust, Validation, And Local Provider Setup

## Summary

M8 improves the Bring Your Own Key workflow so provider setup is clearer,
safer, and easier to recover from for everyday users.

This milestone is not a full secret-vault milestone. It is a trust-and-setup
milestone that makes provider configuration more honest, more stable, and less
error-prone while preserving the local-first product model.

Outcome:

- users can configure remote AI providers with immediate validation feedback
- users can choose a local provider option for localhost-based private use
- provider setup failures show actionable recovery states instead of generic
  save failure
- upstream provider URLs no longer appear as direct browser destinations for app
  analysis calls

Non-goals:

- do not build a multi-user cloud backend
- do not promise a password-protected secret vault in M8
- do not claim protection against a user inspecting their own browser storage or
  browser-originated requests
- do not redesign the full Settings surface beyond workflow clarity and
  provider-setup behavior

## Product And UX Contract

### User Outcome

The user should be able to answer these questions without confusion:

- Which provider am I using?
- Do I need an API key for this provider?
- Did my setup save successfully?
- If setup failed, was the problem my key, the network, or a local service not
  running?

### Core Workflow

Settings remains the setup surface for:

- provider selection
- credential entry when needed
- model selection
- backup and restore

Provider setup workflow:

1. User opens Settings.
2. User selects a provider.
3. The UI shows the provider-specific setup fields.
4. User saves settings.
5. The app validates the configuration before final persistence.
6. The app either:
   - saves and confirms success
   - blocks save with field-level error
   - warns but allows save for recoverable connectivity cases defined below

### Provider Modes

M8 supports two provider modes:

- `remote provider`
  - Anthropic
  - OpenAI
  - Gemini
- `local provider`
  - Ollama

### Remote Provider Rules

- Remote providers require an API key.
- Save should validate the provider key before final persistence.
- Invalid or malformed credentials block save.
- Temporary connectivity failures do not masquerade as invalid credentials.
- The UI must distinguish:
  - invalid key
  - provider unreachable
  - request failed unexpectedly
  - model unavailable for the selected provider

### Local Provider Rules

- `Ollama` is a no-key provider in M8.
- Selecting Ollama hides the API-key requirement and instead shows localhost
  setup guidance.
- Save validates whether the configured Ollama endpoint is reachable.
- If Ollama is not reachable, save may still be allowed only if the UI makes it
  clear that local analysis will not work until Ollama is running.
- The default assumed endpoint is `http://localhost:11434/v1`.

### Save And Validation Rules

- Save is not a blind persistence action in M8.
- Validation happens before final persistence for the selected provider.
- Validation outcomes:
  - `valid`: save succeeds
  - `invalid_credentials`: save is blocked
  - `invalid_configuration`: save is blocked
  - `provider_unreachable`: save is allowed with warning for local providers,
    blocked for remote providers
  - `unexpected_error`: save is blocked with recovery copy

### Everyday-User Copy Rules

Copy must use plain language instead of infrastructure language.

Preferred user-facing phrasing:

- `Connected`
- `Could not verify this key`
- `This provider could not be reached right now`
- `Ollama is not running on this device yet`
- `Saved, but local AI will not work until Ollama is running`

Avoid making users interpret:

- proxy internals
- CORS terminology
- raw HTTP failures
- provider SDK jargon

### Trust And Disclosure Rules

The UI must describe the actual trust model honestly:

- provider requests for analysis no longer go directly from the browser to the
  upstream provider
- the app server can relay provider requests
- M8 reduces direct browser exposure of upstream provider endpoints
- M8 does not claim that locally stored keys are protected from a user with full
  browser access

The Settings copy must no longer claim:

- that keys never touch app servers, if proxy routing is enabled
- that keys are securely encrypted, unless that is truly implemented

### Required UI States

The Settings workflow must define these states:

- empty
- editing
- validating
- saved success
- invalid key
- invalid configuration
- provider unreachable
- local provider offline
- model unavailable
- legacy migrated settings

### Recovery States

Every failure state must present a next action:

- invalid key -> check key format or paste a new key
- provider unreachable -> retry later or check connection
- local provider offline -> start Ollama locally, then retry
- model unavailable -> choose another model
- unexpected error -> retry save

### Backup And Restore Rules

- Backup/export continues to exclude API keys.
- Importing workspace data must not overwrite provider credentials.
- Provider validation and backup/restore are independent actions in the UI.

## Engineering Contract

### Architecture

- Analysis-related provider calls move behind a Next.js proxy route:
  - `/api/ai/proxy`
- The browser should call the app route instead of calling upstream provider
  endpoints directly for supported provider operations.
- The proxy route is responsible for upstream request forwarding and response
  normalization where needed.

### Honest Security Boundaries

M8 security scope is limited:

- hide upstream provider URLs from normal browser-network usage for proxied app
  analysis calls
- centralize provider request routing
- improve setup validation and trust copy

M8 does not guarantee:

- secure vault-grade key storage
- protection from a user inspecting localStorage
- protection from browser-originated request inspection if the client still
  supplies credentials to the app route

### Provider Type Changes

- `ProviderId` adds `"ollama"`
- `AIProvider` adds:
  - `validateKey()` for remote providers
  - provider-specific validation behavior for no-key local providers
- provider capabilities must support no-key configuration where applicable

### Validation Contract

Validation must return structured outcomes, not just pass/fail booleans.

Minimum validation outcome shape:

- `status`:
  - `valid`
  - `invalid_credentials`
  - `invalid_configuration`
  - `provider_unreachable`
  - `unexpected_error`
- `message`
- optional `providerMetadata` such as resolved model availability when useful

### Persistence Rules

- Settings remain stored in browser localStorage in M8.
- M8 does not introduce fake security language such as "encrypted" unless
  encryption is truly implemented.
- Obfuscation alone must not be described as security.
- If no real encryption ships in M8, persist plain local settings with honest
  product copy and defer stronger secret storage to a later milestone.

### Migration Rules

- Existing saved settings for Anthropic, OpenAI, and Gemini must continue to
  load safely.
- Legacy single-key settings continue to normalize into the Anthropic slot as
  they do today.
- `ollama` must be added to defaults and settings types without corrupting
  existing saved settings.
- Existing saved remote keys are not revalidated on load; they are validated on
  next explicit save.
- If a previously saved model is no longer valid for the chosen provider, the UI
  must fall back to the provider default and explain the change before save.

### Export / Import Rules

- backup/export excludes provider credentials
- import does not replace current provider credentials
- importing workspace data must not force provider revalidation

## Implementation Slices

1. Add provider-type support for `ollama` and structured validation outcomes.
2. Add proxied provider-call infrastructure for supported analysis flows.
3. Update Settings to branch cleanly between remote-key setup and local-provider
   setup.
4. Add validation workflow and state-specific error/success copy.
5. Add settings migration support for the new provider and model behavior.
6. Update trust copy so it matches the real transport/storage model.
7. Extend tests and browser QA for provider setup, migration, and recovery
   flows.

## Verification

Automated tests:

- settings migration preserves legacy provider keys and defaults safely
- `ollama` settings normalize without requiring an API key
- invalid remote credentials block save
- unreachable remote provider returns the correct validation state
- offline local provider returns the correct warning state
- provider/model mismatch falls back or blocks as specified
- export/import continues to exclude provider credentials

Browser checks:

- select Anthropic/OpenAI/Gemini -> key field appears and save validates before
  persistence
- save malformed or invalid remote key -> observe field-level rejection
- save valid remote key -> observe success state and usable analysis flow
- simulate remote provider unreachable -> observe connectivity message rather
  than invalid-key copy
- select Ollama -> key field is hidden or disabled and localhost setup guidance
  appears
- save with Ollama offline -> observe warning/recovery state defined by the
  packet
- save with Ollama running -> observe success state and usable local analysis
  flow
- backup/export still excludes keys
- imported workspace data does not overwrite current provider credentials
- browser network usage shows app proxy requests instead of direct upstream
  provider URLs for proxied app analysis calls

Acceptance criteria:

- provider setup is understandable for an everyday user
- remote invalid-key failures are distinct from connectivity failures
- local-provider setup is distinct from API-key setup
- current saved settings survive migration without corruption
- upstream provider URLs are no longer the direct browser destinations for
  proxied app analysis calls
- settings copy truthfully describes the storage and transport model

## Assumptions And Deferrals

- M8 keeps the local-first architecture and does not add a cloud account system
- real password-protected secret-vault behavior is deferred to a later milestone
- M8 prioritizes honest trust boundaries, validation quality, and provider-setup
  clarity over strong local secret protection claims
- Ollama default endpoint is `http://localhost:11434/v1`
