import { extbay } from './extbay-sdk.js';
import {
  CATEGORY_STORAGE_KEY,
  commandFromInspect,
  containerId,
  containerName,
  inferCategory,
  modelDetails,
  publishedPorts,
  stackId,
  stackName,
  stackProjectName,
} from './core.js';

const app = document.querySelector('#app');
const state = {
  endpointId: null,
  stacks: [],
  containers: [],
  categories: {},
  selectedStackId: null,
  loading: false,
};

renderShell();
extbay.ready().then((context) => {
  if (context.endpointId) {
    document.querySelector('#endpoint-id').value = String(context.endpointId);
    return loadEndpoint(context.endpointId);
  }
  setStatus('Ready. Enter a Portainer Endpoint ID.');
}).catch((error) => setStatus(errorMessage(error), true));

function renderShell() {
  app.replaceChildren(
    el('header', { className: 'hero' }, [
      el('div', { className: 'eyebrow', text: 'DOCKFRAME EXTENSION' }),
      el('h1', { text: 'Stack Categories' }),
      el('p', {
        className: 'subtitle',
        text: 'Organize stacks and inspect AI models or websites using the ExtBay SDK.',
      }),
      endpointForm(),
      el('p', { id: 'status', className: 'status', text: 'Connecting to ExtBay…' }),
    ]),
    el('section', { id: 'summary', className: 'summary hidden' }),
    el('div', { className: 'workspace' }, [
      el('aside', { id: 'stack-list', className: 'stack-list hidden' }),
      el('section', { id: 'details', className: 'details hidden' }),
    ])
  );
}

function endpointForm() {
  const input = el('input', {
    id: 'endpoint-id',
    type: 'number',
    min: '1',
    step: '1',
    placeholder: 'Endpoint ID',
    required: true,
    'aria-label': 'Portainer Endpoint ID',
  });
  const button = el('button', {
    className: 'button primary',
    type: 'submit',
    text: 'Load stacks',
  });
  const form = el('form', { className: 'endpoint-form' }, [input, button]);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const endpointId = Number(input.value);
    if (!Number.isSafeInteger(endpointId) || endpointId < 1) {
      setStatus('Enter a valid positive Endpoint ID.', true);
      return;
    }
    await loadEndpoint(endpointId);
  });
  return form;
}

async function loadEndpoint(endpointId) {
  if (state.loading) return;
  state.loading = true;
  setStatus('Loading stacks and containers…');
  try {
    await extbay.ready();
    const [stacks, containers, stored] = await Promise.all([
      extbay.stacks.list(endpointId),
      extbay.containers.list(endpointId),
      extbay.storage.get(CATEGORY_STORAGE_KEY),
    ]);
    state.endpointId = endpointId;
    state.stacks = Array.isArray(stacks) ? stacks : [];
    state.containers = Array.isArray(containers) ? containers : [];
    state.categories = isRecord(stored) ? stored : {};
    state.selectedStackId = state.stacks[0] ? stackId(state.stacks[0]) : null;
    renderData();
    setStatus(
      `${state.stacks.length} stack${state.stacks.length === 1 ? '' : 's'} loaded from endpoint ${endpointId}.`
    );
  } catch (error) {
    setStatus(errorMessage(error), true);
  } finally {
    state.loading = false;
  }
}

function renderData() {
  renderSummary();
  renderStackList();
  renderSelectedStack();
}

function renderSummary() {
  const summary = document.querySelector('#summary');
  summary.classList.remove('hidden');
  const counts = { ai: 0, website: 0, other: 0 };
  for (const stack of state.stacks) counts[getCategory(stack)] += 1;
  summary.replaceChildren(
    summaryCard('AI', counts.ai, 'AI model stacks'),
    summaryCard('Web-Sites', counts.website, 'Website stacks'),
    summaryCard('Other', counts.other, 'Uncategorized stacks')
  );
}

function summaryCard(label, value, caption) {
  return el('article', { className: 'summary-card' }, [
    el('span', { className: 'summary-value', text: String(value) }),
    el('strong', { text: label }),
    el('small', { text: caption }),
  ]);
}

function renderStackList() {
  const list = document.querySelector('#stack-list');
  list.classList.remove('hidden');
  list.replaceChildren(el('h2', { text: 'Stacks' }));
  if (!state.stacks.length) {
    list.append(el('p', { className: 'muted', text: 'No visible stacks.' }));
    return;
  }
  for (const stack of state.stacks) {
    const id = stackId(stack);
    const button = el('button', {
      className: `stack-button${id === state.selectedStackId ? ' active' : ''}`,
      type: 'button',
    }, [
      el('span', { text: stackName(stack) }),
      el('span', { className: `badge ${getCategory(stack)}`, text: categoryLabel(getCategory(stack)) }),
    ]);
    button.addEventListener('click', () => {
      state.selectedStackId = id;
      renderStackList();
      renderSelectedStack();
    });
    list.append(button);
  }
}

function renderSelectedStack() {
  const details = document.querySelector('#details');
  details.classList.remove('hidden');
  const stack = state.stacks.find((item) => stackId(item) === state.selectedStackId);
  if (!stack) {
    details.replaceChildren(
      el('div', { className: 'empty', text: 'Select a stack to inspect it.' })
    );
    return;
  }
  const category = getCategory(stack);
  const containers = containersForStack(stack);
  const select = categorySelect(category);
  select.addEventListener('change', async () => {
    state.categories[storageCategoryKey(stack)] = select.value;
    try {
      await extbay.storage.set(CATEGORY_STORAGE_KEY, state.categories);
      renderData();
      setStatus(`Category for ${stackName(stack)} saved.`);
    } catch (error) {
      setStatus(errorMessage(error), true);
    }
  });
  details.replaceChildren(
    el('div', { className: 'details-heading' }, [
      el('div', {}, [
        el('div', { className: 'eyebrow', text: 'SELECTED STACK' }),
        el('h2', { text: stackName(stack) }),
      ]),
      el('label', { className: 'category-field' }, [
        el('span', { text: 'Category' }),
        select,
      ]),
    ]),
    runtimePanel(category, stack, containers)
  );
}

function runtimePanel(category, stack, containers) {
  const section = el('section', { className: 'runtime-panel' });
  const title = category === 'ai' ? 'AI Models' : category === 'website' ? 'Web-Sites' : 'Other containers';
  section.append(
    el('div', { className: 'panel-heading' }, [
      el('div', { className: `panel-icon ${category}`, text: category === 'ai' ? 'AI' : category === 'website' ? 'WEB' : 'BOX' }),
      el('div', {}, [
        el('h3', { text: title }),
        el('p', {
          className: 'muted',
          text:
            category === 'ai'
              ? 'Launch configuration from Docker inspect. Unsupported live metrics are shown as -.'
              : category === 'website'
                ? 'Container state and published ports from Docker.'
                : 'Containers currently associated with this stack.',
        }),
      ]),
    ])
  );
  const grid = el('div', { className: 'card-grid' });
  if (!containers.length) {
    grid.append(el('p', { className: 'empty', text: 'No containers found for this stack.' }));
  } else {
    for (const container of containers) {
      if (category === 'ai') grid.append(aiCard(container));
      else if (category === 'website') grid.append(websiteCard(container));
      else grid.append(otherCard(container));
    }
  }
  section.append(grid);
  return section;
}

function aiCard(container) {
  const card = el('article', { className: 'runtime-card loading-card' }, [
    el('p', { className: 'muted', text: `Inspecting ${containerName(container)}…` }),
  ]);
  inspectContainer(container)
    .then((inspect) => {
      const command = commandFromInspect(inspect, container.Command ?? '');
      const model = modelDetails(command, container.Image ?? '-');
      card.classList.remove('loading-card');
      card.replaceChildren(
        cardTitle(model.title, 'AI'),
        definitionList([
          ['Loaded model', model.model],
          ['Container name', containerName(container)],
          ['Container status', value(container.Status ?? container.State)],
          ['RAM usage', '-'],
          ['CPU usage', '-'],
          ['Generation speed', '-'],
          ['KV cache usage', '-'],
          ['Context size', launchValue(model.launch, 'Total context window (-c)')],
          ['Context usage', '-'],
          ['Parallel slots', launchValue(model.launch, 'Parallel request slots (--parallel)')],
          ['Processing request', '-'],
        ]),
        collapsible('GPU telemetry', [
          ['VRAM usage', '-'],
          ['GPU usage', '-'],
          ['GPU temperature', '-'],
          ['GPU power usage', '-'],
        ]),
        collapsible('Launch parameters', model.launch),
        actionRow(container),
        note('RAM/CPU, NVIDIA and llama.cpp live metrics are not exposed by ExtBay SDK 0.1.0.')
      );
    })
    .catch((error) => {
      card.replaceChildren(cardTitle(containerName(container), 'AI'), errorBox(error));
    });
  return card;
}

function websiteCard(container) {
  return el('article', { className: 'runtime-card' }, [
    cardTitle(containerName(container), 'WEB'),
    definitionList([
      ['Container name', containerName(container)],
      ['Container status', value(container.Status ?? container.State)],
      ['Image', value(container.Image)],
      ['Published ports', publishedPorts(container)],
      ['RAM usage', '-'],
      ['CPU usage', '-'],
      ['Users online', '-'],
      ['Cloudflare', '-'],
    ]),
    actionRow(container),
    note('Visitor counts, HTTP probes and Cloudflare detection require SDK capabilities not available in ExtBay 0.1.0.'),
  ]);
}

function otherCard(container) {
  return el('article', { className: 'runtime-card' }, [
    cardTitle(containerName(container), 'BOX'),
    definitionList([
      ['Container status', value(container.Status ?? container.State)],
      ['Image', value(container.Image)],
      ['Published ports', publishedPorts(container)],
    ]),
    actionRow(container),
  ]);
}

function cardTitle(title, icon) {
  return el('div', { className: 'card-title' }, [
    el('span', { className: 'small-icon', text: icon }),
    el('h4', { text: value(title) }),
  ]);
}

function definitionList(fields) {
  const list = el('dl', { className: 'definition-list' });
  for (const [label, rawValue] of fields) {
    list.append(
      el('div', { className: 'definition-row' }, [
        el('dt', { text: label }),
        el('span', { className: 'leader', 'aria-hidden': 'true' }),
        el('dd', { text: value(rawValue) }),
      ])
    );
  }
  return list;
}

function collapsible(title, fields) {
  const details = el('details', { className: 'collapsible' });
  details.append(el('summary', { text: title }), definitionList(fields));
  return details;
}

function actionRow(container) {
  const restart = el('button', {
    className: 'button secondary',
    type: 'button',
    text: 'Restart',
  });
  const cancel = el('button', {
    className: 'button secondary hidden',
    type: 'button',
    text: 'Cancel',
  });
  let confirming = false;
  cancel.addEventListener('click', () => {
    confirming = false;
    restart.textContent = 'Restart';
    cancel.classList.add('hidden');
  });
  restart.addEventListener('click', async () => {
    if (!confirming) {
      confirming = true;
      restart.textContent = 'Confirm restart';
      cancel.classList.remove('hidden');
      return;
    }
    restart.disabled = true;
    cancel.disabled = true;
    try {
      await extbay.containers.restart(state.endpointId, containerId(container));
      setStatus(`${containerName(container)} restarted.`);
      await loadEndpoint(state.endpointId);
    } catch (error) {
      setStatus(errorMessage(error), true);
    } finally {
      restart.disabled = false;
      cancel.disabled = false;
    }
  });
  return el('div', { className: 'actions' }, [restart, cancel]);
}

function categorySelect(current) {
  const select = el('select', { 'aria-label': 'Stack category' });
  for (const [id, label] of [
    ['ai', 'AI'],
    ['website', 'Web-Site'],
    ['other', 'Other'],
  ]) {
    const option = el('option', { value: id, text: label });
    option.selected = id === current;
    select.append(option);
  }
  return select;
}

function getCategory(stack) {
  return (
    state.categories[storageCategoryKey(stack)] ??
    inferCategory(stack, containersForStack(stack))
  );
}

function storageCategoryKey(stack) {
  return `${state.endpointId}:${stackId(stack)}`;
}

function containersForStack(stack) {
  const name = stackName(stack);
  return state.containers.filter((container) => stackProjectName(container) === name);
}

async function inspectContainer(container) {
  return extbay.containers.inspect(state.endpointId, containerId(container));
}

function launchValue(fields, label) {
  return fields.find(([fieldLabel]) => fieldLabel === label)?.[1] ?? '-';
}

function categoryLabel(category) {
  return category === 'website' ? 'Web-Site' : category === 'ai' ? 'AI' : 'Other';
}

function note(text) {
  return el('p', { className: 'note', text });
}

function errorBox(error) {
  return el('p', { className: 'error-box', text: errorMessage(error) });
}

function value(input) {
  if (input === undefined || input === null || input === '' || input === 'N/A')
    return '-';
  return String(input);
}

function setStatus(message, isError = false) {
  const status = document.querySelector('#status');
  status.textContent = message;
  status.classList.toggle('error', isError);
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function el(tag, attributes = {}, children = []) {
  const node = document.createElement(tag);
  for (const [name, rawValue] of Object.entries(attributes)) {
    if (name === 'className') node.className = rawValue;
    else if (name === 'text') node.textContent = rawValue;
    else node.setAttribute(name, rawValue);
  }
  for (const child of children) node.append(child);
  return node;
}
