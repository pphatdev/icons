# pphatdev Brand Icons Registry

This repository serves as the central registry and asset storage for the `pphatdev brand-icons` CLI tool. It contains the official list of available brand icons, their SVG assets, and the configuration schema for the CLI.

## Project Structure

- **`index.json`**: The master registry file. It contains an array of objects mapping icon names to their respective file paths within the `icons/` directory. The CLI uses this file to discover available icons.
- **`schema.json`**: The JSON schema for the `pphatdev brand-icons` configuration file. It defines configurable properties such as `iconDir`, which allows users to specify a custom directory for downloaded icons (defaults to `icons`).
- **`icons/`**: The directory containing all the original SVG icon files referenced in `index.json`.

## Usage

This registry is designed to be consumed by the `pphat` CLI. When a user runs a command to add a brand icon, the CLI will:
1. Fetch `index.json` to verify the icon exists and locate its path.
2. Download the corresponding SVG file from the `icons/` directory.
3. Save it to the user's local project based on their configuration (validated against `schema.json`).

## Adding New Icons

To add a new icon to the registry:
1. Add the optimized SVG file to the `icons/` directory.
2. Add a new entry to `index.json` with the format:
    ```json
    {
        "name": "icon-name",
        "target": "icons/icon-name.svg"
    }
    ```
