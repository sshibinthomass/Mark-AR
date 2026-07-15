# Target-Specific Scan Links Design

## Goal

Give every saved cloud image target a stable, unique scan URL. Opening that URL launches the camera experience for exactly one target, and only the people allowed by that target's owner can load it.

## Confirmed Requirements

- Every saved target has its own opaque scan URL in the form `#/scan/<scan_id>`.
- A target-specific URL compiles and recognizes only its assigned image target. Built-in markers, unsaved drafts, and other cloud targets are excluded.
- The target owner chooses one of four scan-access modes:
  - `anyone_with_link`: no sign-in is required;
  - `any_signed_in`: any active signed-in Web-AR account is allowed;
  - `owner_only`: only the owner is allowed;
  - `specific_accounts`: the owner and explicitly listed account emails are allowed.
- New and legacy-private targets default to `owner_only`.
- Sharing grants scan access only. Existing ownership rules continue to control editing, permission changes, and deletion.
- Specific-account email matching is case-insensitive. Stored addresses are trimmed, normalized to lowercase, and deduplicated.
- A permission change takes effect immediately without changing the target's scan URL.

## Architecture

The Web-AR Worker remains the authority for persisted target records and access decisions. Mark-AR owns the permission editor, target-link controls, target-specific routing, authentication return flow, and camera runtime.

Each image-target record adds:

- `scan_id`: a cryptographically opaque, stable identifier unrelated to the existing target ID;
- `access_mode`: one of the four confirmed modes;
- `allowed_emails`: an array used only by `specific_accounts`.

The existing `visibility` field remains readable for backward compatibility. Records without `access_mode` normalize `visibility: public` to `anyone_with_link` and all other values to `owner_only`. The Worker assigns and persists a missing `scan_id` when an owner first lists or updates a legacy target, so existing saved targets receive stable links without being recreated.

## Worker API

Create and update image-target requests accept `access_mode` and `allowed_emails`. Responses and owner-visible list results return `scan_id`, `access_mode`, and `allowed_emails`.

A dedicated read endpoint resolves a target by scan ID:

`GET /generate-3d/image-targets/scan/<scan_id>`

The endpoint accepts an optional bearer token and applies these rules:

- `anyone_with_link`: return the target without authentication;
- `any_signed_in`: return the target to any active authenticated account;
- `owner_only`: return the target only when the authenticated email matches the owner;
- `specific_accounts`: return the target when the authenticated email is the owner or appears in `allowed_emails`;
- the existing Worker administrator override remains available for operational support.

An unknown scan ID returns `404`. A mode that requires authentication returns `401` when no valid session is present. An authenticated but unauthorized account receives `403`. The endpoint never substitutes another target or returns a collection.

The dedicated endpoint is registered before the existing image-target management catch-all so `scan/<scan_id>` cannot be interpreted as a target ID.

## Mark-AR Data and Routing

`CloudImageTarget` gains the three new access fields. The client maps them to and from the Worker's snake-case wire format and exposes a focused `getImageTargetForScan` request that can run with or without a saved authentication token.

The route parser distinguishes:

- `#/scan`: the existing general scanner;
- `#/scan/<scan_id>`: the isolated scanner for one persisted target.

The full target-specific route is retained when authentication is required. After a successful sign-in, Mark-AR returns to that exact scan URL instead of the generic scan page or target editor.

Navigating away from a scan route stops the active MindAR session and releases the camera.

## Target Editor Experience

The Target inspector includes an Access section with four explicit choices. `Only me` is selected for new targets.

When `Specific accounts` is selected, an email-entry control appears. It accepts multiple addresses separated by commas or new lines, shows validation errors before save, and sends only normalized unique addresses. At least one valid non-owner email is required for this mode.

After a target is saved and has a `scan_id`, its saved-target row displays:

- its stable target-specific URL;
- a `Copy link` action;
- an `Open scanner` link that navigates to the unique route.

Permission editing and the allowed-email list remain available only in the authenticated owner workspace. Opening or copying a link does not grant edit rights.

## Target-Specific Camera Flow

Opening `#/scan/<scan_id>` performs one focused target request. If access succeeds, Mark-AR renders the scan page and immediately attempts to start the camera. The runtime target list is constructed with no built-in markers and exactly one cloud target, indexed from zero.

The status identifies the selected target while it loads, compiles, becomes active, or is lost. If the browser blocks automatic camera startup or permission is denied, the page retains a prominent `Start camera` retry action instead of falling back to a different scanner.

If sign-in is required, the Account page explains that the target needs authentication and preserves the full return route. A successful but unauthorized sign-in shows `You don't have access to this target.` Invalid or deleted links show `Target not found.` Network and compilation failures remain on the isolated scan page and never load other targets.

The existing `#/scan` route and its general scanning behavior remain available and unchanged.

## Security Boundary

The Worker authorizes the scan record before Mark-AR receives target metadata, recognition-image location, object placement, or the model list. The opaque scan ID prevents practical URL enumeration. This is access control for the hosted scan experience, not digital-rights management for assets that an authorized browser has already downloaded.

## Verification

Worker tests cover:

- creation defaults and field normalization;
- legacy access-mode normalization and scan-ID backfill;
- all four access modes with missing, valid, owner, shared, unlisted, and administrator identities;
- `401`, `403`, and `404` responses;
- permission updates taking effect while the scan ID remains stable;
- invalid and duplicate shared-email input;
- route precedence over the management endpoint.

Mark-AR tests cover:

- parsing and generating target-specific scan routes;
- wire mapping and focused scan requests with optional authentication;
- default owner-only editor state and all four controls;
- specific-account email validation and normalization;
- rendering stable Copy link and Open scanner actions per target;
- retaining the complete scan route through sign-in;
- building a runtime list containing exactly the selected target at index zero;
- never starting the general target set after `401`, `403`, `404`, or request failure;
- automatic camera-start attempt and manual retry fallback.

Completion requires focused tests in both repositories, full test suites, normal production builds, the Mark-AR GitHub Pages base-path build, and browser verification of an owner-only link plus a no-sign-in anyone-with-link flow. Camera permission behavior must be checked on a secure context (`127.0.0.1`, `localhost`, or HTTPS).

## Out of Scope

- Granting shared users edit access.
- Expiring links, link rotation, per-user usage analytics, or scan audit history.
- Recovering a target after it has been deleted.
- Replacing the existing general `#/scan` experience.
