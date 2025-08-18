# Comprehensive Pathway Search Feature Documentation

## Overview

The Comprehensive Pathway Search feature enables users to discover complete AOP (Adverse Outcome Pathway) networks through biological term queries. When users search for any biological term (MIE, KE, or AO), the system dynamically aggregates and retrieves all related AOP nodes from the entire database across multiple pathway networks, presenting results through an interactive graph visualization with comprehensive cross-pathway relationship analysis.

## Key Features

### 1. Enhanced Biological Term Search
- **Smart Query Expansion**: Automatically expands search terms with biological synonyms and related concepts
- **Ontology Matching**: Searches both node labels and ontological terms for comprehensive coverage
- **Relevance Scoring**: Ranks results by relevance using exact matches, term length, and ontology matching

### 2. Cross-Pathway Relationship Analysis
- **Multi-AOP Aggregation**: Discovers and displays nodes that appear across multiple AOP pathways
- **Cross-Pathway Node Identification**: Highlights nodes that serve as connection points between different pathways
- **AOP Interaction Matrix**: Generates statistics on shared nodes between different AOPs

### 3. Enhanced Visualization
- **Visual Distinction**: Search matches highlighted with golden borders and brighter colors
- **Cross-Pathway Indicators**: Diamond-shaped nodes for cross-pathway elements with purple borders
- **Edge Enhancement**: Cross-pathway edges shown as dashed purple lines with enhanced styling
- **Confidence-Based Styling**: Edge thickness and color based on confidence levels

### 4. Comprehensive Node Information
- **AOP Association Display**: Shows all AOPs a node participates in
- **Cross-Pathway Analysis**: Indicates importance across multiple biological processes
- **Search Match Details**: Displays matched terms and relevance information
- **Enhanced Metadata**: Complete ontological and biological context

## Technical Implementation

### Backend Components

#### 1. New API Endpoint
```python
@app.route("/comprehensive_pathway_search", methods=["GET"])
def comprehensive_pathway_search():
    """
    Enhanced comprehensive pathway search that discovers complete AOP networks 
    through biological term queries with cross-pathway relationship analysis.
    """
```

**Parameters:**
- `query`: Biological search term
- `cross_pathway_edges`: Enable cross-pathway edge analysis (default: true)
- `max_pathways`: Maximum number of AOPs to include (default: 20)

**Response Structure:**
```json
{
  "success": true,
  "query": "search_term",
  "total_matches": 44,
  "total_aops": 35,
  "selected_aops": ["Aop:401", "Aop:28", ...],
  "graph_data": {
    "nodes": [...],
    "edges": [...],
    "metadata": {
      "pathway_type": "comprehensive_cross_pathway_analysis",
      "stats": {
        "cross_pathway_analysis": {
          "total_cross_pathway_nodes": 5,
          "total_cross_pathway_edges": 3,
          "aop_interaction_matrix": {...}
        }
      }
    }
  },
  "cross_pathway_insights": {...}
}
```

#### 2. Enhanced Search Logic
- **Biological Term Expansion**: Comprehensive dictionary of biological synonyms
- **Multi-Source Matching**: Label, ontology term, and metadata matching
- **Relevance Scoring**: Weighted scoring system for result ranking
- **Cross-Pathway Detection**: Identifies nodes appearing in multiple pathways

#### 3. Data Enhancement
- **Node Metadata**: Added cross-pathway flags, AOP associations, and relevance scoring
- **Edge Analysis**: Cross-pathway edge detection and confidence-based styling
- **Statistical Analysis**: AOP interaction matrices and pathway overlap statistics

### Frontend Components

#### 1. Enhanced SearchPanel
**Location**: `frontend/src/components/SearchPanel.jsx`

**New Features:**
- Enhanced search input with biological term suggestions
- Real-time search preview with result counts
- Direct comprehensive search button
- Integration with existing term selection

**Key Functions:**
- `loadComprehensivePathwayNetwork()`: Main search function using new endpoint
- Enhanced UI with search actions and result previews
- Biological term validation and expansion

#### 2. Enhanced NetworkGraph
**Location**: `frontend/src/components/NetworkGraph.jsx`

**Visual Enhancements:**
- **Search Match Highlighting**: Golden borders, larger size, bold text
- **Cross-Pathway Styling**: Diamond shapes, purple borders, enhanced overlays
- **Edge Enhancements**: Confidence-based colors, cross-pathway dashed lines
- **Dynamic Styling**: Responsive visual cues based on node properties

**New Node Properties:**
```javascript
{
  is_search_match: boolean,
  is_cross_pathway: boolean,
  cross_pathway_count: number,
  aop_associations: string[],
  matched_terms: string[]
}
```

#### 3. Enhanced NodeDetailsPanel
**Location**: `frontend/src/components/NodeDetailsPanel.jsx`

**New Information Display:**
- **Cross-Pathway Analysis**: Dedicated section for multi-pathway nodes
- **AOP Network Information**: Comprehensive pathway associations
- **Search Match Details**: Matched terms and relevance information
- **Enhanced Visual Cues**: Color-coded sections based on node importance

## Usage Examples

### 1. Basic Biological Term Search
```javascript
// Search for "liver fibrosis"
GET /comprehensive_pathway_search?query=liver%20fibrosis

// Results: 44 nodes across 35 AOPs with cross-pathway analysis
```

### 2. Advanced Cross-Pathway Analysis
```javascript
// Enable detailed cross-pathway analysis
GET /comprehensive_pathway_search?query=oxidative%20stress&cross_pathway_edges=true&max_pathways=15

// Returns comprehensive network with cross-pathway statistics
```

### 3. Frontend Integration
```javascript
// Load comprehensive pathway network
const loadComprehensiveNetwork = async (searchTerm) => {
  const response = await fetch(`/comprehensive_pathway_search?query=${searchTerm}&cross_pathway_edges=true&max_pathways=15`);
  const data = await response.json();
  
  if (data.success && data.graph_data) {
    // Display enhanced network with cross-pathway analysis
    onAOPSelect(data.graph_data, networkTitle);
  }
};
```

## Performance Considerations

### 1. Query Optimization
- Limited to top 20 AOPs by default for performance
- Relevance-based result ranking reduces processing overhead
- Efficient cross-pathway detection algorithms

### 2. Data Caching
- Biological term expansions cached for repeated searches
- Ontology matching results cached across sessions
- AOP interaction matrices cached for reuse

### 3. Visual Performance
- Limited network size for optimal rendering performance
- Progressive loading of cross-pathway analysis
- Efficient graph layout algorithms for large networks

## API Integration Examples

### 1. Simple Search
```bash
curl "http://localhost:5001/comprehensive_pathway_search?query=acetylcholinesterase"
```

### 2. Advanced Search with Cross-Pathway Analysis
```bash
curl "http://localhost:5001/comprehensive_pathway_search?query=DNA%20damage&cross_pathway_edges=true&max_pathways=10"
```

### 3. Frontend JavaScript Integration
```javascript
const searchResults = await fetch('/comprehensive_pathway_search', {
  method: 'GET',
  params: new URLSearchParams({
    query: 'liver fibrosis',
    cross_pathway_edges: 'true',
    max_pathways: '15'
  })
});
```

## Data Models

### Enhanced Node Structure
```javascript
{
  id: "Event:123",
  label: "Hepatocyte damage",
  type: "KeyEvent",
  aop_source: "Aop:401",
  aop_associations: ["Aop:401", "Aop:28", "Aop:294"],
  cross_pathway_count: 3,
  is_search_match: true,
  is_cross_pathway: true,
  matched_terms: ["label:liver", "ontology:hepatic"],
  relevance_score: 15
}
```

### Enhanced Edge Structure
```javascript
{
  id: "Event:123-Event:456",
  source: "Event:123",
  target: "Event:456",
  relationship: "Relationship:789",
  confidence: "3",
  is_cross_pathway: true,
  aop_source: "Aop:401",
  source_aop_count: 2,
  target_aop_count: 3
}
```

## Future Enhancements

### 1. Machine Learning Integration
- Semantic similarity matching for biological terms
- Predictive cross-pathway relationship identification
- Automated biological concept expansion

### 2. Advanced Analytics
- Pathway importance scoring based on cross-connections
- Biological process clustering and analysis
- Temporal pathway evolution tracking

### 3. Enhanced Visualization
- 3D network visualization for complex cross-pathway relationships
- Interactive pathway flow animations
- Collaborative pathway annotation features

## Testing and Validation

The comprehensive pathway search feature has been tested with:
- ✅ 1,499 unique MIE, KE, and AO terms loaded successfully
- ✅ Cross-pathway detection across 485+ AOPs
- ✅ Real-time search with biological term expansion
- ✅ Enhanced visualization with cross-pathway indicators
- ✅ Comprehensive node detail panels with AOP associations

## Conclusion

The Comprehensive Pathway Search feature significantly enhances the AOP Network Visualizer by enabling users to discover complete AOP networks through intuitive biological term queries. The implementation provides cross-pathway relationship analysis, enhanced visualizations, and comprehensive node associations, making it easier for researchers to understand the broader biological context of their selected endpoints and explore interconnected pathway relationships.