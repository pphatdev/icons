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

pphat add <iconname> -f <format:{svg|nextjs|nuxtjs}>


# Example
pphat add facebook -f svg
```



## Adding New Icons

To add a new icon to the registry:
1. Add the optimized SVG file to the `brands/` directory.
2. Add a new entry to `index.json` with the format:
    ```json
    {
        "name": "icon-name",
        "target": "brands/icon-name.svg"
    }
    ```
