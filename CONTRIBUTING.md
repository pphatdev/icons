# Contributing to Icons

First off, thank you for considering contributing to the `@pphatdev/registry` icons repository! It's people like you that make open source such a great community.

## How to Contribute

### 1. Adding a New Icon
We welcome additions of new brand icons. To add an icon, please follow these steps:

1. **Optimize your SVG:** Ensure your SVG is properly formatted, minified, and does not contain unnecessary tags or metadata.
2. **Add to the `brands/` folder:** Place your optimized `.svg` file into the `brands/` directory. Ensure the filename is lowercase and uses hyphens for spaces (e.g., `my-brand.svg`).
3. **Update the Registry (`index.json`):** Add a new entry to the `index.json` file in the root directory following this format:
   ```json
   {
       "name": "icon-name",
       "target": "brands/icon-name.svg"
   }
   ```
4. **Test your changes:** Verify that the JSON format in `index.json` is still valid and that the path to your new SVG is correct.

### 2. Submitting a Pull Request
1. Fork the repository and create your branch from `main`.
2. Commit your changes with a clear and descriptive commit message.
3. Push your branch to GitHub and open a Pull Request.
4. Ensure your PR describes what icon you are adding or fixing.

## Code of Conduct
By participating in this project, you are expected to uphold a welcoming and inclusive environment for everyone.

Thank you for your contributions!
