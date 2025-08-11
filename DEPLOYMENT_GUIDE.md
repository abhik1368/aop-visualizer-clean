# AOP Network Visualizer - Deployment Guide

## Live Application URLs

**🌐 Frontend Application**: https://gqgxdymj.manus.space
**🔧 Backend API**: https://8xhpiqcloe86.manus.space

## Quick Start

The application is already deployed and ready to use! Visit the frontend URL to start exploring AOP networks.

## Features Available

### ✅ Multi-AOP Selection
- Toggle between single and multi-select modes
- Select multiple AOPs to view combined networks
- "Selected: X AOP(s)" counter and "Clear All" button

### ✅ Advanced Path Finding
- Shortest path search between any two nodes
- Top-K path searches for alternative routes
- All possible paths discovery between node types
- **Searchable dropdowns** - Type to find nodes quickly
- Keyboard navigation (Enter to select, Escape to close)

### ✅ Node Chain Selection & Relationship-Based Selection
- Click nodes to add them to a selection chain
- Click relationships to auto-select BOTH connected nodes
- "Selected Node Chain" section with numbered sequence
- Remove individual nodes or clear entire chain

### ✅ Secure Chat Functionality
- OpenAI API integration with GPT-3.5-turbo
- **Session-persistent chat** - Maintains state across tab switches
- Secure API key input (session-only, never stored on servers)
- Context-aware responses about selected node chains
- Expert knowledge in AOP networks and toxicology

### ✅ Export Functionality
- PNG export for high-quality network images
- CSV export with complete metadata for nodes and edges

## Local Development Setup

### Backend Setup
```bash
cd backend
python3.11 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python src/main.py
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

## Data Files

The application uses three main TSV data files located in the `data/` directory:
- `aop_ke_ec.tsv` - Key Events and Event Components (2,947 rows)
- `aop_ke_ker.tsv` - Key Event Relationships (2,887 rows)  
- `aop_ke_mie_ao.tsv` - MIE and AO mappings (3,252 rows)

**Total Network**: 1,499 nodes, 2,887 edges, 485 AOPs

## API Endpoints

- `GET /` - API information and available endpoints
- `GET /aops` - List all available AOPs
- `GET /aop_graph?aop={aop_id}` - Get network data for specific AOP
- `GET /shortest_path?source={node}&target={node}&aop={aop}` - Find shortest path
- `GET /k_shortest_paths?source={node}&target={node}&k={number}&aop={aop}` - Find top-K paths
- `GET /all_paths?aop={aop}&max_paths={number}` - Find all possible paths
- `GET /search?q={query}&by={filter}` - Search nodes and AOPs
- `POST /llm_query` - AI chat functionality (requires OpenAI API key)

## Security Features

- API keys stored only in sessionStorage (browser session only)
- No server-side storage of user credentials
- CORS properly configured for cross-origin requests
- Session persistence across tab switches but cleared on browser close

## Browser Compatibility

- Chrome/Chromium (recommended)
- Firefox
- Safari
- Edge

## Performance Optimizations

- Searchable dropdowns limit to 100 results for performance
- Lazy loading of network visualizations
- Efficient graph algorithms for path finding
- Responsive design for mobile and desktop

## Troubleshooting

1. **Multi-select not working**: Ensure the "Multi-select" checkbox is checked
2. **Path finding shows no results**: Verify nodes exist in the selected AOP
3. **Chat not working**: Enter a valid OpenAI API key in the chat panel
4. **Slow performance**: Try selecting fewer AOPs or using search to filter nodes

## Support

For technical issues or questions about the AOP data, refer to the documentation in the `docs/` directory or check the API endpoints for data validation.

