# AOP Visualizer Backend

Flask-based REST API backend for the AOP Network Visualizer.

## Technology Stack

- **Flask** - Web framework
- **Flask-CORS** - Cross-origin resource sharing
- **Pandas** - Data manipulation
- **NetworkX** - Graph analysis
- **OpenAI** - AI chat functionality

## API Endpoints

### Data Endpoints

#### GET /aops
Returns list of all available AOP identifiers.

**Response:**
```json
["AOP:1", "AOP:2", "AOP:3", ...]
```

#### GET /aop_graph
Returns network data for a specific AOP.

**Parameters:**
- `aop` (string): AOP identifier (e.g., "AOP:1")

**Response:**
```json
{
  "nodes": [
    {
      "id": "node_id",
      "label": "Node Label",
      "type": "MIE|KE|AO",
      "description": "Node description"
    }
  ],
  "edges": [
    {
      "source": "source_node_id",
      "target": "target_node_id",
      "relationship": "relationship_type"
    }
  ]
}
```

### Path Finding Endpoints

#### GET /shortest_path
Find shortest path between two nodes.

**Parameters:**
- `source` (string): Source node ID
- `target` (string): Target node ID
- `aop` (string): AOP context

#### GET /k_shortest_paths
Find top-K shortest paths between two nodes.

**Parameters:**
- `source` (string): Source node ID
- `target` (string): Target node ID
- `k` (int): Number of paths to return
- `aop` (string): AOP context

#### GET /all_paths
Find all possible paths in the network.

**Parameters:**
- `aop` (string): AOP context
- `max_paths` (int): Maximum number of paths to return

### AI Chat Endpoint

#### POST /chat
AI-powered chat about AOP networks.

**Request Body:**
```json
{
  "message": "User question",
  "context": {
    "selected_nodes": ["node1", "node2"],
    "selected_edges": ["edge1"],
    "current_aop": "AOP:1"
  },
  "api_key": "openai_api_key"
}
```

## Data Processing

The backend processes three TSV files:
- `aop_ke_ec.tsv` - Key Events and Event Components
- `aop_ke_ker.tsv` - Key Event Relationships
- `aop_ke_mie_ao.tsv` - MIE and AO mappings

Data is loaded on startup and processed into NetworkX graphs for efficient path finding and analysis.

## Security

- API keys are never stored on the server
- CORS is configured for frontend domain
- Input validation on all endpoints
- Rate limiting recommended for production

## Development

```bash
# Install dependencies
pip install -r requirements.txt

# Run development server
python main.py

# The server will start on http://localhost:5000
```

## Deployment

For production deployment:
1. Set environment variables for configuration
2. Use a production WSGI server (e.g., Gunicorn)
3. Configure reverse proxy (e.g., Nginx)
4. Enable HTTPS
5. Set up monitoring and logging

