# Code Flow Visualizer

An interactive VS Code extension that visualizes code structure and function call relationships in real-time.

## Features

- 📊 **Interactive Graph Visualization**: See your code structure as an interactive node graph
- 🔍 **Function Analysis**: Analyze function calls, complexity, and relationships
- 🎯 **Click to Navigate**: Click any node to jump to that function in your code
- 🌈 **Complexity Coloring**: Visual indicators for function complexity (green=low, yellow=medium, red=high)
- 🔄 **Multiple Layouts**: Switch between force-directed and hierarchical layouts
- 🌐 **Multi-Language Support**: Works with JavaScript, TypeScript, Python, and Java
- ⚡ **Real-time Updates**: Automatically updates visualization when you save files

## Installation & Setup

### Step 1: Install Dependencies

```bash
cd code-flow-visualizer
npm install
```

### Step 2: Compile TypeScript

```bash
npm run compile
```

Or for continuous compilation during development:

```bash
npm run watch
```

### Step 3: Run the Extension

1. Open the `code-flow-visualizer` folder in VS Code
2. Press `F5` to launch the Extension Development Host
3. A new VS Code window will open with the extension loaded

## Usage

### Quick Start

1. Open any JavaScript, TypeScript, Python, or Java file
2. Press `Ctrl+Alt+V` (or `Cmd+Alt+V` on Mac)
3. The visualizer panel will open showing your code structure

### Commands

Access these via Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`):

- **Code Flow: Start Visualization** - Opens the visualizer panel
- **Code Flow: Analyze Current File** - Analyzes the currently open file
- **Code Flow: Analyze Entire Workspace** - Analyzes all supported files in workspace (up to 50 files)

### Keyboard Shortcuts

- `Ctrl+Alt+V` (Mac: `Cmd+Alt+V`) - Start visualization

### Visualizer Controls

- **Click a node** - Navigate to that function in your code
- **Drag background** - Pan the view
- **Scroll wheel** - Zoom in/out
- **Reset View** - Reset zoom and position
- **Change Layout** - Toggle between force-directed and hierarchical layouts
- **Zoom In/Out** - Manual zoom controls

### Understanding the Visualization

**Node Size**: Larger nodes indicate higher complexity (more conditional logic)

**Node Color**:
- 🟢 Green: Low complexity (0-2 decision points)
- 🟡 Yellow: Medium complexity (3-6 decision points)
- 🔴 Red: High complexity (7+ decision points)

**Connections**: Lines show function calls (from caller to callee)

**Info Panel**: Hover over nodes to see detailed information

## Development

### Project Structure

```
code-flow-visualizer/
├── src/
│   ├── extension.ts      # Main extension entry point
│   ├── analyzer.ts       # Code analysis engine
│   └── visualizer.ts     # Webview visualization manager
├── out/                  # Compiled JavaScript (generated)
├── package.json          # Extension manifest
└── tsconfig.json         # TypeScript configuration
```

### Key Components

**Analyzer (`analyzer.ts`)**:
- Parses source code to extract functions
- Identifies function calls and relationships
- Calculates cyclomatic complexity
- Supports JS/TS, Python, and Java

**Visualizer (`visualizer.ts`)**:
- Manages the webview panel
- Handles communication between extension and UI
- Implements force-directed and hierarchical layouts
- Provides interactive navigation

### Debugging

1. Set breakpoints in TypeScript files
2. Press `F5` to start debugging
3. Debug output appears in the original VS Code window
4. Extension runs in the new Extension Development Host window

### Making Changes

1. Edit TypeScript files in `src/`
2. Run `npm run compile` or use watch mode (`npm run watch`)
3. Press `Ctrl+R` (or `Cmd+R`) in the Extension Development Host to reload

## Packaging for Distribution

### Create VSIX Package

```bash
npx vsce package
```

This creates a `.vsix` file you can share or install manually.

### Install VSIX Manually

```bash
code --install-extension code-flow-visualizer-0.0.1.vsix
```

## Supported Languages

- JavaScript (.js)
- TypeScript (.ts)
- Python (.py)
- Java (.java)

Basic support for other languages with generic function pattern matching.

## Future Enhancements

- [ ] Class diagram visualization
- [ ] Export visualization as SVG/PNG
- [ ] Filter by complexity threshold
- [ ] Search/filter functions
- [ ] Call stack tracing
- [ ] Performance profiling integration
- [ ] Minimap overview
- [ ] Collaborative annotations

## Troubleshooting

**Extension doesn't activate:**
- Check that you're in a workspace with supported file types
- Look for errors in Output > Extension Host

**Visualization is empty:**
- Ensure the file contains analyzable functions
- Try "Code Flow: Analyze Current File" command

**Navigation doesn't work:**
- Make sure the file being visualized is open in the editor
- Check that line numbers are correct

## Contributing

Contributions welcome! This was built for a hackathon but can be extended.

## License
eddys a dog
MIT

## Hackathon Notes

Built during [Hackathon Name] to solve the common developer problem of understanding code structure in large codebases. The AR-like visualization helps developers "see" their code architecture without specialized hardware.
