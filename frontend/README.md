# AOP Visualizer Frontend

React-based frontend application for the AOP Network Visualizer.

## Technology Stack

- **React 19** - UI framework
- **Vite** - Build tool and development server
- **Tailwind CSS** - Styling framework
- **Lucide React** - Icon library
- **Recharts** - Data visualization
- **React Hook Form** - Form handling

## Key Components

### NetworkGraph.jsx
- Main network visualization component
- Interactive node and edge rendering
- Zoom, pan, and layout controls
- Export functionality

### SearchPanel.jsx
- AOP selection (single and multi-select)
- Path finding controls
- Node chain selection
- Searchable dropdowns

### ChatPanel.jsx
- AI-powered chat interface
- OpenAI API integration
- Context-aware responses
- Secure API key handling

### NodeDetailsPanel.jsx
- Node and edge information display
- Metadata visualization
- Export controls

## Features

### Multi-AOP Selection
Toggle between single and multi-select modes to combine multiple AOP networks for comprehensive analysis.

### Advanced Path Finding
- Shortest path between any two nodes
- Top-K alternative paths
- All possible paths discovery
- Searchable node selection dropdowns

### Node Chain Selection
- Click nodes to build analysis chains
- Click relationships to select connected pairs
- Remove individual nodes or clear entire chain

### AI Chat Integration
- Secure API key input (session-only storage)
- Context-aware responses about selected nodes/chains
- Expert knowledge in AOP networks and toxicology

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Configuration

The frontend connects to the backend API using the configuration in `src/config.js`. Update the API base URL for different environments.

## Styling

The application uses Tailwind CSS with a custom theme supporting both light and dark modes. Component styles are defined using Tailwind utility classes with custom CSS for complex visualizations.

