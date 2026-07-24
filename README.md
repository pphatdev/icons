## Usage

Users can easily download and install icons from this project via the `@pphatdev/registry` package CLI.

### Installation 

#### Registry Packages Requirements

```bash
# Local
npm install -D @pphatdev/registry

# Global
npm install -g @pphatdev/registry


# verify installation
pphat --version
# or
@pphatdev/registry --version
# or
pphatdev --version


# Init configuration

pphat init ## Choose what you need to use (icon or other in the future)

```


### Icons Installation

```bash
# Install icons

pphat add-icon <iconname> -f <format:{svg|nextjs|nuxtjs}>


# Example
pphat add-icon facebook -f svg
```



## Adding New Icons

To add a new icon to the registry:
1. Add your new icon `.json` file to the appropriate category directory (e.g., `brands/` or `regular/`).
2. That's it! You do not need to manually update `brands.json` or `regular.json`. A GitHub Actions workflow automatically compiles these index files when a Pull Request is opened or code is merged.

For more detailed information, please see our [CONTRIBUTING.md](CONTRIBUTING.md).
