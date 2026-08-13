import { getExtra } from "./extras";
import { jsonToYaml } from "./frontmatter";
import { HEADER_PREFIX, SECTION_ORDER, SECTIONS, TASK_COMPLETE_MARKER, TASK_MARKER, type KnownSection, type Tasks } from "./model";

export function fromTasksToMarkdown(tasks: Tasks): string {
  const parts: string[] = [];

  for (const key of SECTION_ORDER) {
    const lines = tasks[key]?.map(t => getExtra(tasks, t)?.completedAt ? `${TASK_COMPLETE_MARKER}${t}` : `${TASK_MARKER}${t}`);
    if (!lines) continue;
    const header = SECTIONS[key as KnownSection] ?? `${HEADER_PREFIX}${key}`;
    parts.push(header, "", lines.join("\n"), "");
  }

  let yaml = jsonToYaml(tasks.extras);

  return `---\n${yaml}---\n\n${parts.join("\n")}\n`;
}