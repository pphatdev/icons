# Contributing to Icons

First off, thank you for considering contributing to the `@pphatdev/registry` icons repository! It's people like you that make open source such a great community.

## How to Contribute

### 1. Adding a New Icon
We welcome additions of new brand or regular icons. To add an icon, please follow these steps:

1. **Add your Icon JSON:** Place your newly created or updated `.json` file into the appropriate category folder (`brands/` or `regular/`).
2. **Do Not Update Root JSONs Manually:** You do **not** need to manually update `brands.json` or `regular.json`. We have a GitHub Actions workflow that automatically scans the directories and rebuilds these root index files for you whenever a PR is created or merged!
3. **Test your changes locally (Optional):** If you want to preview the compiled registry locally before submitting your PR, you can run the build script:
   ```bash
   cd .github/scripts
   npm install
   npm run build
   cd ../..
   node .github/scripts/dist/update-category.mjs
   ```

### 2. Submitting a Pull Request
1. Fork the repository and create your branch from `main`.
2. Commit your changes with a clear and descriptive commit message.
3. Push your branch to GitHub and open a Pull Request.
4. Ensure your PR describes what icon you are adding or fixing.

## Code of Conduct
By participating in this project, you are expected to uphold a welcoming and inclusive environment for everyone.

Thank you for your contributions!
