---
name: Viki CLI — Code Explanation
description: Explains what the bin/viki script does — its purpose, execution flow, and the box number collision problem it has.
tags: [viki, cli, explanation, box-number]
---

# Viki CLI — Code Explanation

## What is Viki?

`bin/viki` is a Node.js CLI tool that runs on the **assembly technician's laptop**. Its purpose is to **register a newly assembled robot** into the system by:

1. Reading hardware information from the robot over WiFi
2. Assigning the next available box number
3. Printing physical labels via a Dymo LabelWriter
4. Appending a new record to a local `serials.csv` file

---

## Execution Flow (`main`)

```
1. isPrinterConnected()    → Verify Dymo LabelWriter is connected
2. getRobotInfo()          → Fetch hardware info from robot
3. determineBoxnumber()    → Compute the next box number
4. printLabels()           → Print physical labels
5. saveToSerialsFile()     → Append record to serials.csv
```

---

## Step-by-Step Details

### Step 1 — Check Printer (`isPrinterConnected`)

- Calls the Dymo service API running locally at `127.0.0.1`
- If no printer is connected → exits immediately

### Step 2 — Get Robot Info (`getRobotInfo`)

- Prompts technician to select a hardware version (tessa-1.0, 2.0, 3a, 3b, etc.)
- Calls `http://10.0.0.10/api/v1/hardware` — the robot's own WiFi hotspot IP
- Robot responds with: CPU serial, Ethernet MAC, WiFi MAC, and other hardware details
- Times out if no selection is made within 10 seconds (defaults to `tessa-2.0`)

### Step 3 — Determine Box Number (`determineBoxnumber`)

- Reads `serials.csv` from the local laptop disk
- Scans every row to find the **current maximum box number**
- Checks if the CPU serial already exists in the file → rejects with "Duplicate serial!" if so
- Sets `robotInfo.boxNumber = maxBoxNumber + 1`

### Step 4 — Print Labels (`printLabels`)

- Prints 3 label types via the Dymo printer:
  - `v1-box-label.label` — shipping box label (box number + MAC addresses)
  - `v1-cpu-serial.label` — CPU serial label, printed **4 copies**
  - `v2-mac-addresses.label` — MAC addresses label
- Labels use Mustache templates in the `resource/` directory

### Step 5 — Save to CSV (`saveToSerialsFile`)

- Appends a new row to `serials.csv` with all robot data
- Fields such as `QABy`, `Organization`, `ShippingDate`, etc. are left blank to be filled in later

---

## The Box Number Collision Problem

Box numbers are computed **entirely from the local CSV file** on the technician's laptop. This creates a race condition risk:

- **Multiple laptops running viki in parallel** → both read the same max number → two robots get the **same box number**
- **Dashboard backend also assigns box numbers** independently → can collide with viki-generated numbers
- **Android devices** may also receive box number assignments through a separate path

### Proposed Fix

Move box number ownership to a **central database table** (`box_number`). Both `dashboard_robot` and `android_device` will only store a `box_number_id` (foreign key), making the database the single source of truth. The viki laptop tool will no longer be responsible for computing or printing box numbers — it will write `TBD` into the CSV instead.
