# CI/QA Pipeline

This document describes the continuous integration and quality assurance workflow for the mail slip project.

## Workflow Overview

The CI pipeline executes the following steps in order:

1. **Build** – The project is compiled and built to ensure it is in a valid state.
2. **Lint** – Static analysis is performed to catch code quality issues.

## Lint Behavior

- **Lint warnings** are reported but do **not** cause the pipeline to fail. They are informational and can be reviewed without blocking the build.
- **Lint errors** are treated as failures and will cause the pipeline to stop, preventing the change from being merged.

This configuration ensures that the project always builds before linting runs, and that only genuine lint errors, not warnings, block the QA process.
