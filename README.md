# pphatdev Brand Icons Registry

This repository serves as the central registry and asset storage for the `@pphatdev/registry` CLI tool. It contains the official list of available brand icons, their SVG assets, and the configuration schema for the CLI.


## Adding New Icons

To add a new icon to the registry:
1. Add the optimized SVG file to the `icons/` directory.
2. Add a new entry to `index.json` with the format:
    ```json
    {
        "name": "icon-name",
        "target": "brands/icon-name.svg"
    }
    ```
