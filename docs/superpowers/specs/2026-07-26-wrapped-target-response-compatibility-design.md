# Wrapped Target Response Compatibility

## Problem

The deployed Mark-AR target Worker returns successful create, update, delete,
and scan payloads in a `{ "target": { ... } }` envelope. The frontend target
parser still expects create, update, and scan responses to contain the target
fields at the top level.

Because the HTTP request succeeds before parsing fails, saving can persist the
target and then show `Worker response did not include an image target.`. The
scanner fails with the same message before camera startup because it uses the
same parser.

## Design

Normalize successful single-target responses at the frontend API boundary.
The shared parser will:

1. Read the JSON response once.
2. Preserve existing HTTP error handling.
3. Use `body.target` when it is an object.
4. Otherwise treat `body` as the legacy flat target response.
5. Pass the normalized entry through the existing target mapper and retain the
   existing invalid-target error when neither shape contains a valid target.

The Worker response contract will not change. List responses remain
`{ "targets": [...] }`, and delete handling remains unchanged.

## Compatibility

Supporting both wrapped and flat responses keeps compatibility with the
deployed Mark-AR Worker and any legacy target endpoints. The normalization is
implemented once in the shared client, so create, update, and scan cannot drift.

## Tests

Automated regression coverage will prove:

- create accepts a wrapped target;
- update accepts a wrapped target;
- scan accepts a wrapped target;
- legacy flat single-target responses still work;
- a successful response without a valid target still reports the existing
  validation error;
- the complete repository suite and production build remain green.

The published application will then be exercised through the in-app browser:

- save a target and confirm the success state rather than the parser error;
- open its scan link and confirm the scanner loads the experience without the
  parser error;
- clean up any temporary target created by the test.

## Out of Scope

- Changing the Worker envelope.
- Changing target validation or media persistence.
- Refactoring unrelated Studio or scanner UI.
