# Ontology Extractor

Extracts an ontology from an AtomicServer and saves it to a JSON file.

## Prerequisites

- [Deno](https://deno.com/runtime)

## Usage

clone this repo, navigate to the directory and run:

```bash
deno task extract --in <input-url> --out <output-file>
```

example:

```bash
deno task extract --in https://atomicdata.dev/ontology/core --out ../my-projects/data/core.json
```

## Using an agent

If you need to use an agent you can set the `ATOMIC_AGENT` environment variable.

```bash
ATOMIC_AGENT=<my-agent-secret> deno task extract --in <input-url> --out <output-file>
```
