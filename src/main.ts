/**
 * Ontology extractor tool.
 * This tool fetches an ontology from an AtomicServer and extracts it to a JSON file that can be imported into another AtomicServer.
 *
 * Usage:
 * deno run --allow-read --allow-write --allow-net --allow-env --allow-run main.ts --in <input-url> --out <output-file>
 *
 * If you need an agent to fetch the ontology you can set the ATOMIC_AGENT environment variable, you can also create a .env file in this directory.
 *
 */
import {
  Agent,
  commits,
  core,
  type Core,
  Datatype,
  type JSONValue,
  Store,
} from 'npm:@tomic/lib';
import 'jsr:@std/dotenv/load';
import { parseArgs } from 'jsr:@std/cli/parse-args';

class Mapping {
  private mapping: Map<string, string> = new Map();
  private ontologySubject: string;

  constructor(ontologySubject: string) {
    this.ontologySubject = ontologySubject;
  }

  add(subject: string) {
    this.mapping.set(subject, this.subjectToLocalId(subject));
  }

  mapIfExists(subject: string) {
    return this.mapping.get(subject) ?? subject;
  }

  get(subject: string) {
    const localId = this.mapping.get(subject);

    if (!localId) {
      throw new Error(`Subject ${subject} not found in mapping`);
    }

    return localId;
  }

  private subjectToLocalId(subject: string) {
    if (subject === this.ontologySubject) {
      return new URL(subject).pathname.slice(1);
    }

    const newId = subject.replace(this.ontologySubject, '');

    if (newId === subject) {
      throw new Error(
        `Resource ${subject} is not a child of this ontology and cannot be mapped to a localId`,
      );
    }

    return newId.slice(1);
  }
}

const args = parseArgs(Deno.args, {
  string: ['in', 'out'],
  boolean: ['help'],
});

if (args.help) {
  console.log(
    'Tool for extracting ontologies from an AtomicServer to a JSON file that can be imported into another AtomicServer',
  );
  console.log(
    'Usage: deno run --allow-net --allow-read --allow-write --allow-env main.ts --in <input-url> --out <output-file>',
  );
  console.log(
    'If you need an agent to fetch the ontology you can set the ATOMIC_AGENT environment variable, you can also create a .env file in the directory of the binary',
  );
  Deno.exit(0);
}

if (!args.in) {
  console.error('Please provide an input URL');
  Deno.exit(1);
}

if (!args.out) {
  console.error('Please provide an output file');
  Deno.exit(1);
}

const serverUrl = new URL(args.in).origin;
const agentSecret = Deno.env.get('ATOMIC_AGENT');
const agent = agentSecret ? Agent.fromSecret(agentSecret) : undefined;

const store = new Store({
  serverUrl,
  agent,
});

async function extractOntology(url: string) {
  console.log('Fetching ontology...');
  const ontology = await store.getResource<Core.Ontology>(url);

  if (ontology.error) {
    console.error('Could not fetch ontology:', ontology.error);
    throw new Error('Could not fetch ontology');
  }

  console.log(`Found ${ontology.title}, extracting to ${args.out}`);
  const subjects = [
    ontology.subject,
    ...(ontology.props.classes ?? []),
    ...(ontology.props.properties ?? []),
    ...(ontology.props.instances ?? []),
  ];

  const localIdMapping = new Mapping(ontology.subject);

  for (const subject of subjects) {
    localIdMapping.add(subject);
  }

  const ontologyObject = await resourceToObject(
    ontology.subject,
    localIdMapping,
  );

  // Remove the parent from the ontology object.
  delete ontologyObject[core.properties.parent];

  const classes = await Promise.all(
    ontology.props.classes?.map(c => resourceToObject(c, localIdMapping)) ?? [],
  );
  const properties = await Promise.all(
    ontology.props.properties?.map(p => resourceToObject(p, localIdMapping)) ??
      [],
  );
  const instances = await Promise.all(
    ontology.props.instances?.map(i => resourceToObject(i, localIdMapping)) ??
      [],
  );

  const objects = [ontologyObject, ...classes, ...properties, ...instances];

  console.log('Creating JSON file...');
  const json = JSON.stringify(objects, null, 2);
  Deno.writeTextFileSync(args.out!, json);

  console.log(`Done!, created ${args.out}`);
}

if (import.meta.main) {
  try {
    await extractOntology(args.in);
  } catch (e) {
    console.error(e);
    Deno.exit(1);
  }
  Deno.exit(0);
}

async function resourceToObject(
  subject: string,
  mapping: Mapping,
): Promise<Record<string, unknown>> {
  const resource = await store.getResource(subject);

  if (resource.error) {
    console.error('Could not fetch resource:', resource.error);
    throw new Error('Could not fetch resource');
  }

  const propVals: Record<string, JSONValue> = {};

  for (const [prop, value] of resource.getPropVals().entries()) {
    if (prop === '@id' || prop === commits.properties.lastCommit) {
      continue;
    }

    const propertyResource = await store.getResource<Core.Property>(prop);

    if (propertyResource.error) {
      console.error('Could not fetch property:', propertyResource.error);
      throw new Error('Could not fetch property');
    }

    // Map the properties subject to a local id if it exists in the same ontology.
    const id = mapping.mapIfExists(prop);

    // Map the value to local id if it is a resource/resource array and it points to a resource in the same ontology.
    let val = value;

    if (
      typeof val === 'string' &&
      propertyResource.props.datatype === Datatype.ATOMIC_URL
    ) {
      val = mapping.mapIfExists(val as string);
    }

    if (
      Array.isArray(val) &&
      propertyResource.props.datatype === Datatype.RESOURCEARRAY
    ) {
      val = val.map(v => mapping.mapIfExists(v as string));
    }

    propVals[id] = val;
  }

  propVals[core.properties.localId] = mapping.get(resource.subject);

  return propVals;
}
