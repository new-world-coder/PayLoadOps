import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

function createDemoQuery(index: number) {
  return {
    id: `demo-${index + 1}`,
    query: {
      prompt: `Demo query ${index + 1}`,
      filters: { status: index % 2 === 0 ? "active" : "inactive" },
      limit: 10 + (index % 5)
    },
    latencyMs: 15 + index * 2,
    response: {
      rows: Array.from({ length: 2 + (index % 3) }, (_, n) => ({
        id: `${index + 1}-${n + 1}`,
        name: `Row ${n + 1}`
      }))
    }
  };
}

async function seed(): Promise<void> {
  const demoQueries = Array.from({ length: 50 }, (_, index) => createDemoQuery(index));
  const outputPath = resolve(process.cwd(), "demo-queries.json");
  await writeFile(outputPath, JSON.stringify(demoQueries, null, 2), "utf8");
  process.stdout.write(`Wrote ${demoQueries.length} demo queries to ${outputPath}\n`);
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
