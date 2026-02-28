---
name: "Viki"
description: "CLI tool (V.I.K.I. — Virtual Interactive Kinesthetic Interface) for TinyBots robot assembly automation: connects to a robot on its local WiFi, reads hardware identifiers, prints DYMO box/serial/MAC labels, assigns sequential box numbers, and appends each unit's record to a serials CSV."
tags: ["backend", "cli", "assembly", "tooling"]
updated: 2026-02-28
---

> **Branch:** workspaces/tinybots
> **Last Commit:** 0bd3198
> **Last Updated:** Fri Feb 27 12:11:51 2026 +0000

## TL;DR

Viki is a Node.js CLI run during robot assembly to automate label printing and serial-tracking. An assembler connects their laptop to a new Tessa robot's WiFi, selects the hardware version, and runs `bin/viki -s <serials.csv>`. Viki then checks for a connected DYMO LabelWriter, queries the robot's hardware API, prints three label sets, and appends the unit's data to the provided CSV.

## Recent Changes Log

Initial Documentation.

## Repo Purpose & Bounded Context

- **Role:** Assembly-floor CLI tool that bootstraps each manufactured Tessa robot with a unique box number, printed labels, and a serialization record.
- **Domain:** Hardware manufacturing / robot assembly operations within TinyBots backend tooling.

## Project Structure

- `bin/viki`: Single executable Node.js entry point — contains all CLI logic (printer check, robot info fetch, box-number assignment, label printing, CSV append).
- `resource/`: DYMO `.label` template files rendered via Mustache before printing.
  - `v1-box-label.label`: Shipment/box label (1 copy).
  - `v1-cpu-serial.label`: CPU serial label for v1 hardware (4 copies).
  - `v2-mac-addresses.label`: MAC address label for v2 hardware (1 copy).
  - `v1-mac-addresses.label`: MAC address label for v1 hardware.
- `test/`: Manual test scripts (no automated test framework).
  - `test-viki`: Full-flow test entry point.
  - `test-print`: Isolated label print test.
- `package.json`: Declares dependencies and `start`/`test`/`test-print` scripts.

## Public Surface (Inbound)

- **CLI command — `bin/viki -s <serials.csv>`**
  - Required flag `-s` / `--serials`: filesystem path to the serials CSV file.
  - Interactive prompt (10-second timeout, defaults to `tessa-2.0`): selects Tessa hardware version from `tessa-1.0`, `2.0`, `2b`, `2c`, `3a`, `3b`, `3c`.

## Core Services & Logic (Internal)

- **`isPrinterConnected()`**: Queries the DYMO service at `127.0.0.1` via `dymojs`, parses XML printer list, and rejects if no `IsConnected=True` LabelWriter is found. Must succeed before any other step.
- **`getRobotInfo()`**: Fetches `http://10.0.0.10/api/v1/hardware` (robot's local WiFi IP, 500 ms timeout) to retrieve `cpuSerial`, `ethMacAddress`, `wlanMacAddress`, `language`, and `gender`. Merges in the assembler-selected `hardwareVersion`.
- **`determineBoxnumber(serialsFile, robotInfo)`**: Reads the existing serials CSV, finds the current maximum box number, rejects on duplicate CPU serial, and sets `robotInfo.boxNumber = maxBoxNumber + 1`.
- **`printLabels(robotInfo)`**: Renders all three label templates via Mustache with shipment number, MAC addresses, and CPU serial fields, then sends each to `DYMO LabelWriter 450` in parallel. CPU serial label prints 4 copies.
- **`saveToSerialsFile(serialsFile, info)`**: Appends a new CSV row with all 21 tracked fields (serial, box, hardware version, MACs, language, gender, assembly date, and lifecycle dates) using `csvdata.write` in append mode.
- **`main(serialsFile)`**: Orchestrates the full pipeline sequentially: `isPrinterConnected → getRobotInfo → determineBoxnumber → printLabels → saveToSerialsFile`.

## External Dependencies & Contracts (Outbound)

- **DYMO LabelWriter 450**: Local USB/WiFi label printer managed by DYMO service running on `127.0.0.1`. Required to be connected and running before execution.
- **Robot hardware API**: `GET http://10.0.0.10/api/v1/hardware` — robot must be powered on and the assembler's laptop connected to the robot's local WiFi network.
- **Serials CSV file**: Operator-provided file path. Viki reads and appends to this file; the CSV header is hardcoded with 21 column names.
- **Runtime libraries**: `dymojs` (DYMO service client), `node-fetch` (robot API), `csvdata` (CSV read/write), `mustache` (label templating), `inquirer` (interactive prompt), `yargs` (argument parsing), `moment` (date formatting), `numeral` (box number zero-padding).
