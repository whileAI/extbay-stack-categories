let nonce;
let context = {};
const pending = new Map();
let resolveReady;
const readyPromise = new Promise((resolve) => {
  resolveReady = resolve;
});

window.addEventListener('message', (event) => {
  if (event.source !== window.parent || typeof event.data !== 'object') return;
  if (
    event.data.type === 'extbay.init' &&
    event.data.version === 1 &&
    typeof event.data.nonce === 'string'
  ) {
    nonce = event.data.nonce;
    const endpointId = event.data.context?.endpointId;
    context = Number.isSafeInteger(endpointId) && endpointId > 0 ? { endpointId } : {};
    resolveReady(context);
    return;
  }
  if (event.data.type !== 'extbay.rpc.result' || event.data.nonce !== nonce)
    return;
  const request = pending.get(event.data.requestId);
  if (!request) return;
  pending.delete(event.data.requestId);
  if (event.data.ok) request.resolve(event.data.value);
  else request.reject(new Error(event.data.error ?? 'RPC failed'));
});

function call(method, params = {}) {
  if (!nonce)
    return Promise.reject(new Error('ExtBay SDK has not been initialized'));
  const requestId = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      pending.delete(requestId);
      reject(new Error(`RPC timeout: ${method}`));
    }, 30_000);
    pending.set(requestId, {
      resolve: (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      reject: (error) => {
        clearTimeout(timer);
        reject(error);
      },
    });
    window.parent.postMessage(
      { type: 'extbay.rpc', nonce, requestId, method, params },
      '*'
    );
  });
}

export const extbay = {
  ready: () => readyPromise,
  context: () => context,
  containers: {
    list: (endpointId) => call('containers.list', { endpointId }),
    inspect: (endpointId, id) =>
      call('containers.inspect', { endpointId, id }),
    restart: (endpointId, id) =>
      call('containers.restart', { endpointId, id }),
  },
  stacks: { list: (endpointId) => call('stacks.list', { endpointId }) },
  storage: {
    get: (key) => call('storage.get', { key }),
    set: (key, value) => call('storage.set', { key, value }),
  },
};
