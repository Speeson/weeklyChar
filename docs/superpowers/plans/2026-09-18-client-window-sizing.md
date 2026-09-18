# KeystoneClient Window Sizing Plan

1. Add the saved `lockWindowAspectRatio` setting and its Settings control.
2. Implement monitor-aware initial sizing and native Windows ratio enforcement, including a safe minimum and immediate enable/disable behavior.
3. Cover setting persistence, sizing math, UI selection, and default free resizing with focused tests.
4. Validate client builds and tests, review the diff, add a Client changeset, update durable context, and run Deployment Impact.
