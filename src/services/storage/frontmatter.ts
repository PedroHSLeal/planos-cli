import { parse, stringify } from "yaml";

export function yamlToJson(markdown: string) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);

  if (!match) {
    return {};
  }

  return parse(match[1]!);
}

export function jsonToYaml(data: any) {
  return stringify(data);
}

/* let test = {
  extras: {
    pomodoro: `alguma coisa...
mais forte que o aço`,
    "corrigir as fontes": [ 'cima', 'a', 'baixo']
  }
}

let yaml = jsonToYaml(test);
let json = yamlToJson(`---\n${yaml}\n---`);

console.log(yaml)
console.log(json) */