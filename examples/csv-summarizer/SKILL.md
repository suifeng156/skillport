---
name: csv-summarizer
description: Read a CSV file and produce a concise summary including row count, column names, inferred types per column, and any obvious data-quality issues. Activates when the user asks to summarize, profile, or describe a CSV file or any tabular dataset in the working directory.
---

# CSV Summarizer

When the user asks you to summarize or profile a CSV file, follow this protocol.

## 1. Identify the file

If the user names a specific file, use that. Otherwise list `.csv` files in the working directory and use the most recently modified one. Report the filename you chose.

## 2. Read and analyze

Read the file (or its first 1000 rows if very large). Compute:

- **Row count** — total rows excluding the header.
- **Column count** — from the header row.
- **Per-column**:
  - Inferred type: `integer`, `decimal`, `date`, `boolean`, `string`, or `mixed`.
  - Distinct value count for low-cardinality columns (< 20 distinct).
  - A representative sample value.
- **Data quality flags** — missing values, type inconsistencies inside a column, suspicious outliers, malformed dates, duplicated rows.

## 3. Report format

Produce a single response with:

1. A one-line header: `csv-summarizer: <filename> (N rows × M columns)`.
2. A markdown table of columns: `| name | inferred type | sample | notes |`.
3. A short paragraph titled "**Data quality**" describing any flags found, or "No issues detected" if none.

Do not modify the file. Read-only.
