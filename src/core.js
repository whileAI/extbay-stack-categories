export const CATEGORY_STORAGE_KEY = 'stack-categories-v1';

export function stackId(stack) {
  return String(stack.Id ?? stack.ID ?? stack.id ?? stack.Name ?? stack.name);
}

export function stackName(stack) {
  return String(stack.Name ?? stack.name ?? `Stack ${stackId(stack)}`);
}

export function containerId(container) {
  return String(container.Id ?? container.ID ?? container.id ?? '');
}

export function containerName(container) {
  const names = container.Names ?? container.names;
  if (Array.isArray(names) && names[0]) return String(names[0]).replace(/^\//, '');
  return containerId(container).slice(0, 12) || '-';
}

export function stackProjectName(container) {
  return String(
    (container.Labels ?? container.labels ?? {})['com.docker.compose.project'] ??
      ''
  );
}

export function inferCategory(stack, containers = []) {
  const text = [
    stackName(stack),
    ...containers.flatMap((container) => [
      container.Image ?? container.image ?? '',
      container.Command ?? container.command ?? '',
    ]),
  ]
    .join(' ')
    .toLowerCase();
  const tokens = text.split(/[^a-z0-9]+/).filter(Boolean);
  if (
    tokens.some((token) =>
      ['llama', 'ollama', 'vllm', 'qwen', 'mistral', 'gemma', 'model'].some(
        (marker) => token === marker || token.startsWith(marker)
      )
    ) || tokens.includes('ai')
  )
    return 'ai';
  if (
    tokens.some((token) =>
      ['web', 'website', 'site', 'nginx', 'httpd', 'apache', 'caddy'].includes(
        token
      )
    )
  )
    return 'website';
  return 'other';
}

export function commandFromInspect(inspect, fallback = '') {
  const cmd = inspect?.Config?.Cmd;
  if (Array.isArray(cmd) && cmd.length) return cmd.map(String).join(' ');
  const args = Array.isArray(inspect?.Args) ? inspect.Args : [];
  return [inspect?.Path, ...args].filter(Boolean).map(String).join(' ') || fallback;
}

export function readFlag(command, flags) {
  for (const flag of flags) {
    const escaped = flag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = command.match(
      new RegExp(
        `(?:^|\\s)${escaped}(?:=|\\s+)(?:"([^"]+)"|'([^']+)'|([^\\s]+))`
      )
    );
    const value = match?.[1] ?? match?.[2] ?? match?.[3];
    if (value) return value;
  }
  return undefined;
}

export function hasFlag(command, flags) {
  return flags.some((flag) => {
    const escaped = flag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:^|\\s)${escaped}(?=\\s|$)`).test(command);
  });
}

export function modelDetails(command, image = '-') {
  const source = readFlag(command, ['--model', '-m', '--hf-repo', '-hf']);
  const alias = readFlag(command, ['--alias']);
  const model = source?.split('/').filter(Boolean).pop() ?? alias ?? image ?? '-';
  const contextRaw = readFlag(command, ['--ctx-size', '--context-size', '-c']);
  const parallelRaw = readFlag(command, ['--parallel', '-np']);
  const context = positiveInteger(contextRaw);
  const parallel = positiveInteger(parallelRaw) || 1;
  return {
    title: alias ?? model,
    model,
    launch: [
      ['Model source', source ?? '-'],
      ['Display alias', alias ?? '-'],
      ['Listen address', readFlag(command, ['--host']) ?? '-'],
      ['Internal API port', readFlag(command, ['--port']) ?? '-'],
      ['Total context window (-c)', context ? `${context.toLocaleString()} tokens` : '-'],
      ['Parallel request slots (--parallel)', parallelRaw ?? '-'],
      [
        'Context per slot',
        context ? `${Math.floor(context / parallel).toLocaleString()} tokens` : '-',
      ],
      ['CPU threads (--threads)', readFlag(command, ['--threads', '-t']) ?? '-'],
      ['Key cache type (--cache-type-k)', readFlag(command, ['--cache-type-k']) ?? '-'],
      ['Value cache type (--cache-type-v)', readFlag(command, ['--cache-type-v']) ?? '-'],
      ['Flash attention (--flash-attn)', readFlag(command, ['--flash-attn']) ?? '-'],
      ['Continuous batching', hasFlag(command, ['--cont-batching']) ? 'Enabled' : 'Disabled'],
      ['Metrics endpoint', hasFlag(command, ['--metrics']) ? 'Enabled' : 'Disabled'],
    ],
  };
}

export function publishedPorts(container) {
  const ports = container.Ports ?? container.ports ?? [];
  if (!Array.isArray(ports)) return '-';
  const values = ports
    .filter((port) => port.PublicPort ?? port.public)
    .map((port) => {
      const publicPort = port.PublicPort ?? port.public;
      const privatePort = port.PrivatePort ?? port.private;
      const protocol = port.Type ?? port.type ?? 'tcp';
      return `${publicPort}:${privatePort}/${protocol}`;
    });
  return values.length ? values.join(', ') : '-';
}

function positiveInteger(value) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
