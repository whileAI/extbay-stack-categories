# DockFrame Stack Categories

An [ExtBay](https://github.com/whileAI/extbay) extension that organizes Portainer/DockFrame stacks into **AI**, **Web-Site**, and **Other** categories and renders purpose-built container cards.

## Features

- categories are persisted through isolated ExtBay extension storage;
- existing stacks are inferred from stack names, images, and commands;
- AI cards parse the loaded model and human-readable llama.cpp launch parameters from Docker inspect;
- website cards show real container state, image, and published ports;
- container restart uses Portainer RBAC through the ExtBay SDK;
- unknown or unavailable values are shown as `-`;
- responsive dark and light layouts with no CDN or remote UI assets.

## ExtBay 0.1.0 limitations

ExtBay extensions run on a separate sandboxed sidebar page and cannot inject frames into Portainer's native Stack details page. The current SDK also does not expose container stats, HTTP probes, arbitrary container actions, browser networking, or llama.cpp metrics. Its GPU provider returns `501`.

For that reason RAM, CPU, VRAM, GPU, tok/s, request activity, website visitors, and Cloudflare state are shown as `-`. The extension never estimates or invents those values. When ExtBay exposes these capabilities, they can be added without changing the stable extension ID.

## Permissions

| Permission | Why it is required |
| --- | --- |
| `stacks.read` | List stacks visible to the current Portainer user. |
| `containers.read` | List and inspect stack containers. |
| `containers.control` | Restart a container after confirmation. |
| `extension.storage` | Save stack categories per ExtBay user. |

The extension does not request `gpu.metrics` because the provider is not implemented in ExtBay 0.1.0.

## Build and test

Node.js 22 or newer is required.

```sh
npm test
npm run package
```

The release files are created under `release/`:

```text
dockframe-stack-categories-1.0.2.extbay
dockframe-stack-categories-1.0.2.extbay.sha256
```

The `.extbay` archive has `extbay.json` at its ZIP root as required by ExtBay.

## Install locally

```sh
extbay install ./release/dockframe-stack-categories-1.0.2.extbay
extbay list
extbay logs whileai.dockframe-stack-categories
```

Open **Stack Categories** in the ExtBay sidebar. The preferred active local environment loads automatically when DockFrame exposes it; otherwise enter the Endpoint ID shown by Portainer and select **Load stacks**.

## Publish a release

1. Use the repository `whileAI/extbay-stack-categories`.
2. Push this project.
3. Create and push the matching version tag:

```sh
git tag v1.0.2
git push origin main --tags
```

The included GitHub Action builds the package and attaches exactly one `.extbay` file plus its checksum to the release.

Install the latest GitHub release with:

```sh
extbay install github:whileAI/extbay-stack-categories
```

## Updating

Keep the extension ID `whileai.dockframe-stack-categories`, increment the semantic version in both `package.json` and `extbay.json`, and never replace the bytes of a version that has already been published.

## License

MIT
