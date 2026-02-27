---
name: "cves-scan"
description: "A Concourse CI task that scans Docker image tarballs for Critical and High CVE vulnerabilities using Docker Scout, applying a time-bounded exception list to suppress known/accepted findings."
tags: ["security", "cve", "docker-scout", "concourse", "ci"]
---

> **Branch:** feature/fix-tar-minimatch
> **Last Commit:** 3bd40cb
> **Last Updated:** 2026-02-24

## TL;DR

`cves-scan` is a minimal Concourse CI task repository. It accepts a Docker image tarball and an image name, loads the image, runs Docker Scout CVE scanning in GitLab report format, and fails the build if any unexcepted Critical or High severity CVEs are found. A JSON-backed exception list with expiry dates allows teams to temporarily suppress known vulnerabilities.

## Recent Changes Log

Initial Documentation.

## Repo Purpose & Bounded Context

- **Role:** CI security gate — blocks deployment of Docker images with unaccepted Critical/High CVEs
- **Domain:** Security & Compliance (backend infrastructure tooling within tinybots workspace)

## Project Structure

- `ci/` — All CI task assets
  - `scan.sh` — Main Concourse task entrypoint: loads image tar, installs Docker Scout, runs CVE scan, applies exception filter
  - `local-scan.sh` — Local developer variant: runs `docker scout cves` directly against a running image (no tar loading)
  - `build-cves-scan.yml` — Concourse task definition; wires inputs (`cves-scan.git`, image tar dir) and invokes `ci/scan.sh`
  - `filters.jq` — jq filter: extracts Critical/High CVEs from a Scout GitLab-format report, applies date-bounded exceptions
  - `exceptions.json` — Exception registry: list of CVE codes with `expiryDate` fields to suppress known/accepted findings
  - `exception.schema.json` — JSON Schema for validating `exceptions.json` entries

## Public Surface (Inbound)

- **Concourse Task (`build-cves-scan.yml`):**
  - Input: `cves-scan.git` (task code), `((IMAGE_TAR_DIR))` directory containing `((IMAGE_TAR))`
  - Params: `DOCKER_ID`, `DOCKER_PASSWORD` (Concourse credentials for Docker Hub login)
  - Invokes `ci/scan.sh <image-tar-path> <image-name>`

- **Local Scan Script (`local-scan.sh`):**
  - Usage: `./ci/local-scan.sh <image-name>`
  - Requires Docker Scout CLI and `jq` installed locally

## Core Services & Logic (Internal)

- **`ci/scan.sh`:** Loads image tar via `docker load`, installs `docker-scout` v1.16.1 binary from GitHub releases, authenticates to Docker Hub, runs `docker-scout cves --format gitlab`, outputs raw JSON report to a temp file, then pipes report + exceptions through `filters.jq` via `jq -n -f`
- **`ci/filters.jq`:** Reads two JSON inputs (report, exceptions); filters vulnerabilities to Critical/High severity; computes today's date to filter only non-expired exception entries; excludes excepted CVE codes; maps remaining issues to human-readable error strings
- **`ci/exceptions.json`:** Structured list of exception rules. Each rule has at minimum a `cveCode` and `expiryDate` (ISO 8601). Active exceptions (today ≤ expiryDate) are excluded from scan failures

## External Dependencies & Contracts (Outbound)

- **Docker Hub:** Authenticated pull; login via `$DOCKER_ID` / `$DOCKER_PASSWORD`
- **Docker Scout CLI:** Downloaded at runtime from `github.com/docker/scout-cli` v1.16.1 (linux/amd64)
- **Concourse DinD base image:** `xzilde/concourse-dind-pip:latest` — provides Docker-in-Docker and shell utilities
- **jq:** Installed via `apk add jq` at task runtime; required for exception filtering
