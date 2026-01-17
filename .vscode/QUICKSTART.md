# Quick Start Guide - Code Flow Visualizer

Follow these steps to get the extension running in 5 minutes.

## Prerequisites

- Node.js (v16 or higher) - [Download here](https://nodejs.org/)
- VS Code - [Download here](https://code.visualstudio.com/)
- Git (optional, for version control)

## Step-by-Step Instructions

### 1. Open the Project

```bash
# Navigate to the project folder
cd code-flow-visualizer

# Open in VS Code
code .
```

### 2. Install Dependencies

Open the integrated terminal in VS Code (`Ctrl+\`` or `View > Terminal`) and run:

```bash
npm install
```

This will install:
- TypeScript compiler
- VS Code type definitions
- Testing utilities
- VSCE packaging tool

### 3. Compile the TypeScript Code

```bash
npm run compile
```

You should see output like:
```
> code-flow-visualizer@0.0.1 compile
> tsc -p ./
```

Your `out/` folder will now contain the compiled JavaScript files.

### 4. Launch the Extension

**Option A: Using the Debug Panel**
1. Click the Run and Debug icon in the sidebar (or press `Ctrl+Shift+D`)
2. Click the green "Run Extension" button at the top
3. A new VS Code window titled "[Extension Development Host]" will open

**Option B: Using Keyboard**
1. Press `F5`
2. The Extension Development Host window will open

### 5. Test the Extension

In the Extension Development Host window:

1. **Create a test file**: Create a new file called `test.js` with this code:

```javascript
function calculateTotal(items) {
    let total = 0;
    for (let item of items) {
        total += calculateItemPrice(item);
    }
    return total;
}

function calculateItemPrice(item) {
    let price = item.basePrice;
    if (item.discount) {
        price = applyDiscount(price, item.discount);
    }
    return price;
}

function applyDiscount(price, discount) {
    return price * (1 - discount);
}

function main() {
    const items = getItems();
    const total = calculateTotal(items);
    console.log("Total:", total);
}

function getItems() {
    return [
        { basePrice: 100, discount: 0.1 },
        { basePrice: 50, discount: 0 }
    ];
}
```

2. **Activate the visualizer**: Press `Ctrl+Alt+V` (or `Cmd+Alt+V` on Mac)

3. **See the magic**: A panel will open on the right showing:
   - Interactive nodes representing each function
   - Lines connecting functions that call each other
   - Color-coded complexity (green/yellow/red)

4. **Interact with it**:
   - Click a node to jump to that function
   - Drag the background to pan
   - Scroll to zoom
   - Click "Change Layout" to switch visualization styles

### 6. Try Other Commands

Open Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`) and type "Code Flow":

- **Code Flow: Start Visualization** - Opens/focuses the visualizer
- **Code Flow: Analyze Current File** - Re-analyzes the active file
- **Code Flow: Analyze Entire Workspace** - Analyzes all files (try this in a real project!)

## Development Workflow

### Making Changes

1. **Edit code** in `src/` folder
2. **Recompile**:
   ```bash
   npm run compile
   ```
3. **Reload extension**: Press `Ctrl+R` (or `Cmd+R`) in the Extension Development Host window

### Auto-Compile Mode

For faster iteration, use watch mode:

```bash
npm run watch
```

This automatically recompiles when you save files. You still need to reload the extension with `Ctrl+R`.

## Testing with Different Languages

### Python Example

Create `test.py`:

```python
def calculate_total(items):
    total = 0
    for item in items:
        total += calculate_item_price(item)
    return total

def calculate_item_price(item):
    price = item['base_price']
    if 'discount' in item:
        price = apply_discount(price, item['discount'])
    return price

def apply_discount(price, discount):
    return price * (1 - discount)

def main():
    items = get_items()
    total = calculate_total(items)
    print(f"Total: {total}")

def get_items():
    return [
        {'base_price': 100, 'discount': 0.1},
        {'base_price': 50}
    ]
```

Open the file and press `Ctrl+Alt+V` to visualize!

### TypeScript Example

Create `test.ts`:

```typescript
interface Item {
    basePrice: number;
    discount?: number;
}

function calculateTotal(items: Item[]): number {
    return items.reduce((sum, item) => sum + calculateItemPrice(item), 0);
}

function calculateItemPrice(item: Item): number {
    let price = item.basePrice;
    if (item.discount) {
        price = applyDiscount(price, item.discount);
    }
    return price;
}

function applyDiscount(price: number, discount: number): number {
    return price * (1 - discount);
}

const main = (): void => {
    const items = getItems();
    const total = calculateTotal(items);
    console.log(`Total: ${total}`);
};

const getItems = (): Item[] => [
    { basePrice: 100, discount: 0.1 },
    { basePrice: 50 }
];
```

## Troubleshooting

### Issue: "Cannot find module" errors

**Solution**: Run `npm install` again

### Issue: Extension doesn't appear in Command Palette

**Solution**: 
1. Check that you pressed `F5` from the project folder (not a subfolder)
2. Look for errors in the Debug Console of the original VS Code window

### Issue: Compilation errors

**Solution**:
1. Delete the `out/` and `node_modules/` folders
2. Run `npm install` again
3. Run `npm run compile`

### Issue: Visualizer is empty

**Solution**:
1. Make sure your file has functions (not just imports/exports)
2. Try the "Code Flow: Analyze Current File" command
3. Check the Debug Console for errors

### Issue: Can't click "Run Extension"

**Solution**:
1. Make sure you have the project folder open in VS Code
2. Install the "Extension Development" dependencies: `npm install`
3. Try closing and reopening VS Code

## Next Steps

### For Hackathon Demo

1. **Test on real codebase**: Open your hackathon project and analyze it
2. **Take screenshots**: Capture the visualization for your presentation
3. **Prepare talking points**: 
   - "Visualizes function relationships without AR hardware"
   - "Click to navigate instantly"
   - "Complexity at a glance"

### For Further Development

1. Check `README.md` for architecture details
2. Explore `src/analyzer.ts` to add language support
3. Modify `src/visualizer.ts` to customize the UI
4. Add new commands in `src/extension.ts`

## Package for Sharing

When you're ready to share:

```bash
npx vsce package
```

This creates `code-flow-visualizer-0.0.1.vsix` which you can:
- Email to teammates
- Submit to the hackathon
- Install with: `code --install-extension code-flow-visualizer-0.0.1.vsix`

## Video Demo Script

1. Show a complex JavaScript file
2. Press `Ctrl+Alt+V` to open visualizer
3. Explain the color coding
4. Click a high-complexity node (red)
5. Jump to that function in code
6. Show the function's complexity
7. Click "Change Layout" to show hierarchical view
8. Zoom in on a cluster
9. Show workspace analysis on larger project

## Success Checklist

- ✅ Node.js installed
- ✅ Dependencies installed (`npm install`)
- ✅ Code compiled (`npm run compile`)
- ✅ Extension runs (`F5`)
- ✅ Test file visualizes correctly
- ✅ Click navigation works
- ✅ Layout toggle works
- ✅ Ready to demo!

**You're all set! Happy visualizing! 🚀**