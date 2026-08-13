import { yamlToJson } from "./frontmatter";
import { EMPTY_STRUCTURE, HEADER_PREFIX, TASK_COMPLETE_MARKER, TASK_MARKER, type KnownSection, type Tasks } from "./model";

export function fromMarkdownToTasks(tasksFile: string): Tasks {
  const yaml: any = yamlToJson(tasksFile);
  const sections: Tasks = { ...EMPTY_STRUCTURE };
  const lines = tasksFile
    .split(/\r?\n/)
    .filter(l => l.length);

  let sectionTitle: KnownSection | undefined = undefined;

  for (const line of lines) {
    if (line.startsWith(HEADER_PREFIX)) sectionTitle = line.replace(HEADER_PREFIX, "").toLowerCase() as KnownSection;
    else if (sectionTitle) {
      const title = line.replace(TASK_MARKER, "").replace(TASK_COMPLETE_MARKER, "");
       sections[sectionTitle]!.push(title);
    }
  }

  sections.extras = yaml;

  return sections;
}