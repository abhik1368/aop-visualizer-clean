# AOP Network Visualizer

A comprehensive web application for visualizing and analyzing Adverse Outcome Pathways (AOPs) with interactive network graphs, hypergraph visualization, pathfinding capabilities, and AI-powered analysis.

## Features

###  Core Visualization & Analysis
- **Interactive Network Visualization**: Color-coded nodes (Green triangles: MIE, Blue rectangles: KE, Pink ellipses: AO) with labeled relationships
- **Hypergraph View**: Advanced network analysis with community detection and type-based grouping for complex pathway visualization
- **Multi-AOP Selection**: Toggle between single/multiple AOP selection modes with combined network visualization
- **Real-time Graph Manipulation**: Interactive node and edge exploration with zoom, pan, and layout controls

###  Advanced Pathfinding & Navigation
- **Intelligent Pathfinding**: Find shortest paths between MIE (Molecular Initiating Events) and AO (Adverse Outcomes)
- **Full Database Search**: Search across entire AOP database (1,499 nodes, 2,887 edges, 485 AOPs)
- **Customizable Path Discovery**: K-paths (1, 2, 3, etc.) with automatic graph generation from results
- **Searchable Node Selection**: Type-to-search through all available nodes with smart filtering by label, type, or ID
- **No Stressor Pathways**: Focuses on biological pathways excluding stressor nodes for cleaner analysis

###  Interactive Selection & Chain Building
- **Node Chain Selection**: Click nodes to build selection sequences with numbered order display
- **Relationship-Based Selection**: Click edges to automatically select both connected nodes
- **Chain Management**: Remove individual nodes or clear entire chains with visual feedback
- **Context-Aware Analysis**: Selected chains provide context for AI analysis and pathway exploration

###  AI-Powered Features
- **Expert AI Analysis**: GPT-powered insights about AOP networks and biological pathways with toxicology expertise
- **Session-Persistent Chat**: Maintains conversation state across tab switches within browser session
- **Context-Aware Responses**: Analyzes selected node chains and relationships for targeted insights
- **Secure API Handling**: API keys stored only in sessionStorage, never persisted on servers

###  Data Export & Management
- **High-Quality PNG Export**: Professional network visualizations with 📷 button
- **Comprehensive CSV Export**: Complete metadata for nodes, edges, and pathway relationships with  button
- **Graph Data Export**: Save pathfinding results and network configurations for further analysis
- **Performance Optimized**: Efficient handling of large datasets with smart pagination and search

###  User Experience
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Streamlined Interface**: Clean, focused design with "Details" and "AI Analysis" tabs
- **Visual Feedback**: Clear indicators for selections, loading states, and user interactions
- **Keyboard Navigation**: Full keyboard support with Enter/Escape key shortcuts
- **Error Handling**: Graceful handling of API errors and edge cases with user-friendly messages

## System Requirements

- **Node.js**: v16.x or higher
- **Python**: 3.8 or higher
- **npm**: 7.x or higher
- **Modern Web Browser**: Chrome, Firefox, Safari, or Edge

## Installation & Setup

### 1. Clone the Repository
```bash
git clone <your-repository-url>
cd aop-network-visualizer
```

### 2. Backend Setup (Python Flask API)
```bash
# Navigate to backend directory
cd backend

# Create virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt

# Start the backend server
python src/main.py
```
The backend will run on `http://localhost:5001`

### 3. Frontend Setup (React Application)
```bash
# Navigate to frontend directory (in a new terminal)
cd frontend

# Install Node.js dependencies
npm install

# Start the development server
npm run dev
```
The frontend will run on `http://localhost:5173`

### 4. Access the Application
Open your web browser and navigate to `http://localhost:5173`

## Project Structure

```
aop-network-visualizer/
├── data/                    # AOP data files (TSV format)
│   ├── aop_ke_ec.tsv       # Key Events and Event Components
│   ├── aop_ke_ker.tsv      # Key Event Relationships
│   ├── aop_ke_mie_ao.tsv   # MIE and AO mappings
│   └── *.csv               # Additional biological data
├── frontend/               # React frontend application
│   ├── src/
│   │   ├── components/     # React components
│   │   │   ├── ui/         # Reusable UI components
│   │   │   ├── SearchPanel.jsx     # Main search interface
│   │   │   ├── NetworkGraph.jsx    # Standard network visualization
│   │   │   └── HypergraphNetworkGraph.jsx  # Hypergraph visualization
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/           # Utility libraries
│   │   └── assets/        # Static assets
│   ├── public/            # Public assets
│   ├── package.json       # Node.js dependencies
│   └── vite.config.js     # Vite configuration
├── backend/               # Flask backend API
│   ├── src/
│   │   ├── main.py        # Main Flask application
│   │   └── hypergraph_utils.py  # Hypergraph processing
│   └── requirements.txt   # Python dependencies
├── docs/                  # Documentation
├── deployment/           # Deployment configurations
└── README.md             # This file
```

## Database Statistics

###  Comprehensive AOP Dataset
- **Total AOPs**: 485 complete Adverse Outcome Pathways
- **Total Nodes**: 1,499 biological events and outcomes
  - **MIE (Molecular Initiating Events)**: Starting points of biological pathways
  - **KE (Key Events)**: Intermediate biological processes and responses
  - **AO (Adverse Outcomes)**: Final adverse effects and endpoints
- **Total Edges**: 2,887 verified biological relationships and transitions
- **Network Coverage**: Complete pathway mappings from molecular events to adverse outcomes

###  Search Capabilities
- **Full Database Access**: Search and analyze across all 1,499 nodes simultaneously
- **Cross-AOP Analysis**: Discover connections between different pathways
- **Comprehensive Pathfinding**: Find routes through the complete biological network
- **Real-time Performance**: Optimized for large-scale network analysis

## Key Data Files

The application processes three main TSV data files:
- **`aop_ke_ec.tsv`** - Key Events and Event Components (nodes)
- **`aop_ke_ker.tsv`** - Key Event Relationships (edges)  
- **`aop_ke_mie_ao.tsv`** - MIE (Molecular Initiating Events) and AO (Adverse Outcomes) mappings

## Main API Endpoints

### Data Retrieval
- `GET /aops` - List all available AOPs
- `GET /aop_graph?aop={aop_id}` - Get network data for specific AOP
- `GET /full_database_nodes` - Get complete database statistics

### Pathfinding
- `GET /mie_to_ao_paths` - Find paths from MIE to AO nodes
- `GET /custom_path_search` - Custom pathfinding between any two nodes
- Parameters: `source`, `target`, `k` (number of paths), `full_database=true`

### Analysis
- `POST /hypergraph` - Generate hypergraph visualization
- `POST /community_detection` - Detect network communities
- `GET /network_analysis` - Analyze network properties
- `POST /chat` - AI analysis (requires API configuration)

## Usage Guide

### Basic Workflow
1. **Load Data**: Select an AOP or use "Complete AOP Pathways" for full database
2. **Explore Network**: Use standard or hypergraph view for visualization
3. **Find Paths**: Use pathfinding to discover connections between MIE and AO
4. **Analyze**: Get AI-powered insights about biological pathways
5. **Export**: Save visualizations and data for further analysis

### Pathfinding Features
- **Source/Target Selection**: Choose any nodes from the complete database
- **K-Path Search**: Find top 1, 2, 3, etc. shortest paths
- **Graph Generation**: Automatically visualize pathfinding results
- **Full Database**: Search across all 1,499 nodes and 2,887 edges

### Hypergraph Features
- **Community Detection**: Automatic grouping of related nodes
- **Type-based Grouping**: Group nodes by biological type (MIE, KE, AO)
- **Interactive Exploration**: Click to expand hypernodes and explore communities

## Development

### Frontend Development
```bash
cd frontend
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
```

### Backend Development
```bash
cd backend
python src/main.py   # Start Flask development server
```

### Environment Variables
Create `.env` files in both frontend and backend directories for:
- API endpoints
- OpenAI API keys (for AI features)
- Development configurations

## Dependencies

### Backend (Python)
- Flask - Web framework
- NetworkX - Graph analysis
- Pandas - Data processing
- NumPy - Numerical computing
- Requests - HTTP client

### Frontend (JavaScript/React)
- React 18 - UI framework
- Vite - Build tool
- Tailwind CSS - Styling
- Lucide React - Icons
- Cytoscape.js - Graph visualization

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is for research and educational purposes. Please refer to the license file for details.

## Support

For issues, questions, or contributions, please open an issue on GitHub.

