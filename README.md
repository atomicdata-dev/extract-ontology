# Ontology Extractor

Extracts an ontology from an AtomicServer and saves it to a JSON file.

## Prerequisites

- [Deno](https://deno.com/runtime)

## Installation

## Usage

```bash
deno task extract --in <input-url> --out <output-file>
```

## Using an agent

If you need to use an agent you can set the `ATOMIC_AGENT` environment variable.

```bash
ATOMIC_AGENT=<my-agent-secret> deno task extract --in <input-url> --out <output-file>
```
