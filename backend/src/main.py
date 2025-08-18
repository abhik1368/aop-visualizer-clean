import os
import json
import csv
import io
import logging
import requests
from collections import defaultdict, deque
from flask import Flask, jsonify, request, make_response
from flask_cors import CORS
from datetime import datetime
from hypergraph_utils import HypergraphProcessor, detect_communities, create_hypergraph
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Global variables for data
aop_data = {}
graph_data = {"nodes": [], "edges": []}

def load_aop_data():
    """Load AOP data from TSV files"""
    global aop_data, graph_data
    
    try:
        base_path = os.path.dirname(os.path.abspath(__file__))
        
        aop_ke_ec_path = os.path.join(base_path, "aop_ke_ec.tsv")
        aop_ke_ker_path = os.path.join(base_path, "aop_ke_ker.tsv")
        aop_ke_mie_ao_path = os.path.join(base_path, "aop_ke_mie_ao.tsv")
        
        # Chemical data path - look in parent data folder
        # Go up two levels: src -> backend -> root, then into data
        root_path = os.path.dirname(os.path.dirname(base_path))
        data_path = os.path.join(root_path, "data")
        aop_chemical_path = os.path.join(data_path, "aop_chemical.csv")
        
        print(f"Looking for files at:\n  EC: {aop_ke_ec_path}\n  KER: {aop_ke_ker_path}\n  MIE_AO: {aop_ke_mie_ao_path}\n  Chemicals: {aop_chemical_path}")
        
        if not all(os.path.exists(f) for f in [aop_ke_ec_path, aop_ke_ker_path, aop_ke_mie_ao_path]):
            print("TSV files not found, using sample data")
            load_sample_data()
            return True
        
        def read_tsv(filepath):
            with open(filepath, "r", encoding="utf-8") as f:
                reader = csv.reader(f, delimiter="\t")
                return list(reader)

        aop_ke_ec_raw = read_tsv(aop_ke_ec_path)
        aop_ke_ker_raw = read_tsv(aop_ke_ker_path)
        aop_ke_mie_ao_raw = read_tsv(aop_ke_mie_ao_path)
        
        # Load chemical data
        chemical_data = []
        if os.path.exists(aop_chemical_path):
            try:
                with open(aop_chemical_path, "r", encoding="utf-8") as f:
                    reader = csv.reader(f)
                    chemical_data = list(reader)
                print(f"Loaded chemical data: {len(chemical_data)} rows")
                if len(chemical_data) > 0:
                    print(f"First few rows of chemical data: {chemical_data[:3]}")
            except Exception as e:
                print(f"Error loading chemical data: {e}")
                chemical_data = []
        else:
            print(f"Chemical data file not found at: {aop_chemical_path}")
        
        print(f"Loaded TSV files:\n  EC: {len(aop_ke_ec_raw)} rows\n  KER: {len(aop_ke_ker_raw)} rows\n  MIE_AO: {len(aop_ke_mie_ao_raw)} rows\n  Chemicals: {len(chemical_data)} rows")
        
        nodes = {}
        edges = []
        aops = set()
        
        for row in aop_ke_mie_ao_raw:
            if len(row) >= 4:
                aop, event, etype, label = str(row[0]), str(row[1]), str(row[2]), str(row[3])
                aops.add(aop)
                
                ec_data = [ec_row for ec_row in aop_ke_ec_raw if len(ec_row) > 1 and ec_row[1] == event]
                ontology_info = {}
                if ec_data:
                    ec_row = ec_data[0]
                    ontology_info = {
                        "change": str(ec_row[2]) if len(ec_row) > 2 else "",
                        "ontology": str(ec_row[3]) if len(ec_row) > 3 else "",
                        "ontology_id": str(ec_row[4]) if len(ec_row) > 4 else "",
                        "ontology_term": str(ec_row[5]) if len(ec_row) > 5 else "",
                        "secondary_ontology": str(ec_row[6]) if len(ec_row) > 6 else "",
                        "secondary_id": str(ec_row[7]) if len(ec_row) > 7 else "",
                        "secondary_term": str(ec_row[8]) if len(ec_row) > 8 else ""
                    }
                
                nodes[event] = {
                    "id": event,
                    "label": label,
                    "type": etype,
                    "aop": aop,
                    **ontology_info
                }
        
        for row in aop_ke_ker_raw:
            # Accept minimal 3-column KER rows (AOP, source, target) and default the rest
            if len(row) >= 3:
                aop = str(row[0])
                source = str(row[1])
                target = str(row[2])
                rel_id = str(row[3]) if len(row) > 3 else ""
                adjacency = str(row[4]) if len(row) > 4 else "adjacent"
                confidence = str(row[5]) if len(row) > 5 else ""

                edges.append({
                    "source": source,
                    "target": target,
                    "aop": aop,
                    "relationship": rel_id,
                    "adjacency": adjacency,
                    "confidence": confidence
                })
        
        # Process chemical data and create chemical nodes
        chemical_nodes = {}  # This will store all unique chemical nodes
        aop_chemical_map = defaultdict(list)  # Maps AOP ID to list of chemicals
        aop_id_to_name = {}  # Map AOP ID (e.g., Aop:315) -> human-readable AOP name from CSV

        if chemical_data:
            # Skip header row if it exists
            chemical_rows = chemical_data[1:] if chemical_data and len(chemical_data) > 0 and str(chemical_data[0][0]).strip().lower() in ('aop', 'aop_name') else chemical_data
            print(f"Processing {len(chemical_rows)} chemical rows (skipped header)")
            
            for i, row in enumerate(chemical_rows):
                if len(row) >= 3:
                    # CSV columns: 0=AOP name, 1=ID (number), 2=s.name, 3=Stressor (optional)
                    aop_id_num = str(row[1]).strip()
                    aop_id = f"Aop:{aop_id_num}"
                    aop_name = str(row[0]).strip()
                    chemical_name = str(row[2]).strip()
                    stressor_id = str(row[3]).strip() if len(row) > 3 else ""

                    if not chemical_name:
                        continue

                    # Track AOP ID -> Name mapping
                    if aop_id and aop_name:
                        aop_id_to_name[aop_id] = aop_name

                    # Create a unique ID for the chemical itself (using s.name)
                    safe_chem_id = chemical_name.lower().replace(' ', '_').replace('/', '_')
                    chemical_node_id = f"chem_{safe_chem_id}"

                    # Create chemical node if it doesn't exist yet
                    if chemical_node_id not in chemical_nodes:
                        chemical_nodes[chemical_node_id] = {
                            "id": chemical_node_id,
                            "label": chemical_name,   # s.name as node label
                            "type": "chemical",
                            "aops": set(),            # will convert to list after processing
                        }
                    # Record association of this chemical with the AOP
                    if aop_id:
                        chemical_nodes[chemical_node_id]["aops"].add(aop_id)

                    # Map chemical to AOP using the correct AOP ID
                    if not any(c['id'] == chemical_node_id for c in aop_chemical_map[aop_id]):
                        aop_chemical_map[aop_id].append({
                            "id": chemical_node_id,
                            "name": chemical_name,
                            "stressor_id": stressor_id
                        })

        # Convert any set() to list() for JSON safety
        for chem in chemical_nodes.values():
            if isinstance(chem.get("aops"), set):
                chem["aops"] = sorted(list(chem["aops"]))

        print(f"Processed chemical data: {len(chemical_nodes)} chemical nodes, {len(aop_chemical_map)} AOPs with chemicals")
        
        aop_data = {
            "nodes": nodes,
            "edges": edges,
            "aops": sorted(list(aops)),
            "chemicals": chemical_nodes,
            "aop_chemical_map": dict(aop_chemical_map),
            "aop_id_to_name": aop_id_to_name
        }
        
        graph_data = {
            "nodes": list(nodes.values()),
            "edges": edges
        }
        
        print(f"Successfully loaded AOP data: {len(nodes)} nodes, {len(edges)} edges, {len(aops)} AOPs")
        return True
        
    except Exception as e:
        print(f"Error loading AOP data: {e}")
        load_sample_data()
        return False

def load_sample_data():
    """Load sample data as fallback"""
    global aop_data, graph_data
    
    sample_nodes = {
        "Event:142": {
            "id": "Event:142",
            "label": "Hyperplasia",
            "type": "KeyEvent",
            "aop": "Aop:1",
            "ontology": "MESH",
            "ontology_term": "hyperplasia",
            "change": "increased",
            "ontology_id": "D006965",
            "secondary_ontology": "",
            "secondary_id": "",
            "secondary_term": ""
        },
        "Event:334": {
            "id": "Event:334",
            "label": "Hepatocellular carcinoma",
            "type": "AdverseOutcome",
            "aop": "Aop:1",
            "ontology": "MESH",
            "ontology_term": "hepatocellular carcinoma",
            "change": "increased",
            "ontology_id": "D006528",
            "secondary_ontology": "",
            "secondary_id": "",
            "secondary_term": ""
        },
        "Event:57": {
            "id": "Event:57",
            "label": "Cell proliferation",
            "type": "KeyEvent",
            "aop": "Aop:1",
            "ontology": "GO",
            "ontology_term": "cell proliferation",
            "change": "increased",
            "ontology_id": "GO:0008283",
            "secondary_ontology": "",
            "secondary_id": "",
            "secondary_term": ""
        },
        "Event:294": {
            "id": "Event:294",
            "label": "Unknown MIE",
            "type": "MolecularInitiatingEvent",
            "aop": "Aop:1",
            "ontology": "",
            "ontology_term": "",
            "change": "",
            "ontology_id": "",
            "secondary_ontology": "",
            "secondary_id": "",
            "secondary_term": ""
        }
    }
    
    sample_edges = [
        {
            "source": "Event:294",
            "target": "Event:57",
            "aop": "Aop:1",
            "relationship": "Relationship:324",
            "adjacency": "adjacent",
            "confidence": "2"
        },
        {
            "source": "Event:57",
            "target": "Event:142",
            "aop": "Aop:1",
            "relationship": "Relationship:69",
            "adjacency": "adjacent",
            "confidence": "2"
        },
        {
            "source": "Event:142",
            "target": "Event:334",
            "aop": "Aop:1",
            "relationship": "Relationship:158",
            "adjacency": "adjacent",
            "confidence": "1"
        }
    ]
    
    aop_data = {
        "nodes": sample_nodes,
        "edges": sample_edges,
        "aops": ["Aop:1"]
    }
    
    graph_data = {
        "nodes": list(sample_nodes.values()),
        "edges": sample_edges
    }
    
    print("Loaded sample AOP data")

def get_available_aops():
    """Get list of available AOPs from loaded data"""
    global aop_data
    if aop_data and 'aops' in aop_data:
        return aop_data['aops']
    return []

# Load data on startup
load_aop_data()

@app.route("/aops")
def get_aops():
    """Get list of all AOPs"""
    return jsonify(aop_data.get("aops", []))

@app.route("/aop_graph")
def get_aop_graph():
    """Get graph data for a specific AOP"""
    aop = request.args.get("aop")
    if not aop:
        return jsonify({"error": "aop parameter required"}), 400

    aop_nodes = [node for node in aop_data["nodes"].values() if node.get("aop") == aop]
    aop_edges = [edge for edge in aop_data["edges"] if edge.get("aop") == aop]
    
    edge_nodes = set()
    for edge in aop_edges:
        edge_nodes.add(edge["source"])
        edge_nodes.add(edge["target"])
    
    for node_id in edge_nodes:
        if node_id in aop_data["nodes"] and not any(n["id"] == node_id for n in aop_nodes):
            aop_nodes.append(aop_data["nodes"][node_id])

    return jsonify({"nodes": aop_nodes, "edges": aop_edges})

def get_aop_graph_data(aop):
    """Helper function to get graph data for a specific AOP"""
    global aop_data
    
    if not aop or not aop_data:
        return None
    
    try:
        # Get nodes for this AOP
        aop_nodes = []
        for node_id, node_data in aop_data["nodes"].items():
            if node_data.get("aop") == aop:
                aop_nodes.append(node_data)
        
        # Get edges for this AOP
        aop_edges = []
        for edge in aop_data["edges"]:
            if edge.get("aop") == aop:
                aop_edges.append(edge)
        
        # Include nodes that are connected by edges but might not have been included
        edge_node_ids = set()
        for edge in aop_edges:
            edge_node_ids.add(edge["source"])
            edge_node_ids.add(edge["target"])
        
        # Add any missing nodes that are referenced in edges
        existing_node_ids = set(node["id"] for node in aop_nodes)
        for node_id in edge_node_ids:
            if node_id not in existing_node_ids and node_id in aop_data["nodes"]:
                node_data = aop_data["nodes"][node_id]
                # Only add if it belongs to this AOP or if it's a connecting node
                aop_nodes.append(node_data)
        
        result = {
            "nodes": aop_nodes,
            "edges": aop_edges,
            "title": f"AOP {aop}"
        }
        
        logger.debug(f"get_aop_graph_data({aop}): {len(aop_nodes)} nodes, {len(aop_edges)} edges")
        return result
        
    except Exception as e:
        logger.error(f"Error in get_aop_graph_data({aop}): {e}")
        return None

@app.route("/graph")
def get_graph():
    """Get complete graph data"""
    return jsonify(graph_data)



@app.route("/node_details/<node_id>")
def get_node_details(node_id):
    """Get detailed information about a specific node"""
    if node_id not in aop_data["nodes"]:
        return jsonify({"error": "Node not found"}), 404
    
    node = aop_data["nodes"][node_id]
    
    incoming_edges = [e for e in aop_data["edges"] if e["target"] == node_id]
    outgoing_edges = [e for e in aop_data["edges"] if e["source"] == node_id]
    
    incoming_formatted = []
    for edge in incoming_edges:
        source_node = aop_data["nodes"].get(edge["source"], {})
        incoming_formatted.append({
            "source": edge["source"],
            "source_label": source_node.get("label", edge["source"]),
            "relationship": edge.get("relationship", ""),
            "confidence": edge.get("confidence", "")
        })
    
    outgoing_formatted = []
    for edge in outgoing_edges:
        target_node = aop_data["nodes"].get(edge["target"], {})
        outgoing_formatted.append({
            "target": edge["target"],
            "target_label": target_node.get("label", edge["target"]),
            "relationship": edge.get("relationship", ""),
            "confidence": edge.get("confidence", "")
        })
    
    return jsonify({
        **node,
        "incoming_edges": incoming_formatted,
        "outgoing_edges": outgoing_formatted,
        "in_degree": len(incoming_edges),
        "out_degree": len(outgoing_edges)
    })

@app.route("/export/csv")
def export_csv():
    """Export graph data as CSV with metadata"""
    aop = request.args.get("aop")
    export_type = request.args.get("type", "nodes")
    
    if aop:
        nodes = [node for node in aop_data["nodes"].values() if node.get("aop") == aop]
        edges = [edge for edge in aop_data["edges"] if edge.get("aop") == aop]
        filename_suffix = f"_{aop}"
    else:
        nodes = list(aop_data["nodes"].values())
        edges = aop_data["edges"]
        filename_suffix = "_all"
    
    output = io.StringIO()
    
    if export_type == "nodes":
        fieldnames = ["id", "label", "type", "aop", "change", "ontology", "ontology_id", 
                     "ontology_term", "secondary_ontology", "secondary_id", "secondary_term"]
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        
        for node in nodes:
            writer.writerow({
                "id": node.get("id", ""),
                "label": node.get("label", ""),
                "type": node.get("type", ""),
                "aop": node.get("aop", ""),
                "change": node.get("change", ""),
                "ontology": node.get("ontology", ""),
                "ontology_id": node.get("ontology_id", ""),
                "ontology_term": node.get("ontology_term", ""),
                "secondary_ontology": node.get("secondary_ontology", ""),
                "secondary_id": node.get("secondary_id", ""),
                "secondary_term": node.get("secondary_term", "")
            })
        
        filename = f"aop_nodes{filename_suffix}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    
    else:
        fieldnames = ["source", "target", "aop", "relationship", "adjacency", "confidence",
                     "source_label", "target_label", "source_type", "target_type"]
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        
        for edge in edges:
            source_node = aop_data["nodes"].get(edge["source"], {})
            target_node = aop_data["nodes"].get(edge["target"], {})
            
            writer.writerow({
                "source": edge.get("source", ""),
                "target": edge.get("target", ""),
                "aop": edge.get("aop", ""),
                "relationship": edge.get("relationship", ""),
                "adjacency": edge.get("adjacency", ""),
                "confidence": edge.get("confidence", ""),
                "source_label": source_node.get("label", ""),
                "target_label": target_node.get("label", ""),
                "source_type": source_node.get("type", ""),
                "target_type": target_node.get("type", "")
            })
        
        filename = f"aop_edges{filename_suffix}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    
    response = make_response(output.getvalue())
    response.headers["Content-Type"] = "text/csv"
    response.headers["Content-Disposition"] = f"attachment; filename={filename}"
    
    return response

@app.route("/export/metadata")
def export_metadata():
    """Export complete metadata as JSON"""
    aop = request.args.get("aop")
    
    if aop:
        nodes = [node for node in aop_data["nodes"].values() if node.get("aop") == aop]
        edges = [edge for edge in aop_data["edges"] if edge.get("aop") == aop]
        filename_suffix = f"_{aop}"
    else:
        nodes = list(aop_data["nodes"].values())
        edges = aop_data["edges"]
        filename_suffix = "_all"
    
    metadata = {
        "export_info": {
            "timestamp": datetime.now().isoformat(),
            "aop_filter": aop if aop else "all",
            "total_nodes": len(nodes),
            "total_edges": len(edges)
        },
        "statistics": {
            "node_types": {},
            "edge_types": {},
            "confidence_levels": {}
        },
        "nodes": nodes,
        "edges": edges
    }
    
    for node in nodes:
        node_type = node.get("type", "Unknown")
        metadata["statistics"]["node_types"][node_type] = metadata["statistics"]["node_types"].get(node_type, 0) + 1
    
    for edge in edges:
        rel_type = edge.get("relationship", "Unknown")
        confidence = edge.get("confidence", "Unknown")
        metadata["statistics"]["edge_types"][rel_type] = metadata["statistics"]["edge_types"].get(rel_type, 0) + 1
        metadata["statistics"]["confidence_levels"][confidence] = metadata["statistics"]["confidence_levels"].get(confidence, 0) + 1
    
    filename = f"aop_metadata{filename_suffix}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    
    response = make_response(json.dumps(metadata, indent=2))
    response.headers["Content-Type"] = "application/json"
    response.headers["Content-Disposition"] = f"attachment; filename={filename}"
    
    return response

@app.route("/llm_query", methods=["POST"])
def llm_query():
    """Handle LLM queries - demo version"""
    data = request.get_json()
    prompt = data.get("prompt", "")
    context = data.get("context", {})
    
    if not prompt:
        return jsonify({"error": "prompt is required"}), 400
    
    node = context.get("node")
    edge = context.get("edge")
    
    if node:
        node_info = f"Based on the selected node '{node.get('label', 'Unknown')}' (Type: {node.get('type', 'Unknown')}):\n\n"
    else:
        node_info = ""
    
    if "mechanism" in prompt.lower():
        response = f"{node_info}In AOP networks, molecular mechanisms describe how molecular initiating events (MIEs) lead to key events (KEs) and ultimately to adverse outcomes (AOs). These pathways help understand toxicological processes at multiple biological levels. The current network contains {len(aop_data['nodes'])} nodes and {len(aop_data['edges'])} relationships across {len(aop_data['aops'])} different AOPs."
    elif "relationship" in prompt.lower():
        response = f"{node_info}AOP relationships describe the causal connections between events. They can be direct (adjacent) or indirect (non-adjacent) and have different confidence levels based on available evidence. In this dataset, relationships are categorized by their adjacency and confidence scores."
    elif "evidence" in prompt.lower():
        response = f"{node_info}Evidence in AOPs comes from various sources including in vitro studies, in vivo experiments, and epidemiological data. The weight of evidence determines the confidence level of each relationship, ranging from 1 (low confidence) to 3 (high confidence)."
    elif node and "ontology" in prompt.lower():
        ontology_info = f"This node is associated with {node.get('ontology', 'no specific')} ontology"
        if node.get("ontology_term"):
            ontology_info += f" and relates to '{node.get('ontology_term')}'"
        response = f"{node_info}{ontology_info}. Ontological classifications help standardize biological concepts across different databases and research contexts."
    else:
        response = f"{node_info}This is a demonstration of the AOP Network Visualizer's LLM integration. Your question about '{prompt}' would be answered using advanced AI models that understand toxicology and biological pathways. The system has access to {len(aop_data['nodes'])} nodes across {len(aop_data['aops'])} AOPs."
    
    return jsonify({"answer": response})



@app.route("/disease_info")
def disease_info():
    """Get disease information - demo version"""
    term = request.args.get("term", "")
    
    if not term:
        return jsonify({"error": "Disease term parameter required"}), 400
    
    return jsonify({
        "disease_term": term,
        "sources": {
            "mesh": {
                "found": True,
                "description": f"MeSH database contains comprehensive information about {term} and related medical concepts, including hierarchical relationships and cross-references.",
                "mesh_ids": ["D123456", "D789012"]
            },
            "omim": {
                "found": True,
                "description": f"OMIM provides genetic and phenotypic information related to {term}, including inheritance patterns and molecular basis.",
                "omim_url": f"https://omim.org/search?index=entry&search={term}"
            },
            "publications": {
                "found": True,
                "pmid_count": 25,
                "recent_pmids": ["12345678", "87654321", "11223344", "55667788"],
                "pubmed_search_url": f"https://pubmed.ncbi.nlm.nih.gov/?term={term}+AND+(disease+OR+pathology)"
            }
        }
    })

# Graph algorithms for path finding
def build_graph_from_data(data):
    """Build adjacency list from graph data"""
    graph = defaultdict(list)
    for edge in data.get('edges', []):
        source = edge.get('source')
        target = edge.get('target')
        if source and target:
            graph[source].append(target)
    return graph

def find_shortest_path(graph, start, end):
    """Find shortest path using BFS"""
    if start == end:
        return [start]
    
    queue = deque([(start, [start])])
    visited = {start}
    
    while queue:
        node, path = queue.popleft()
        
        for neighbor in graph[node]:
            if neighbor == end:
                return path + [neighbor]
            
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append((neighbor, path + [neighbor]))
    
    return None

def find_k_shortest_paths(graph, start, end, k=3):
    """Find k shortest paths using modified BFS"""
    if start == end:
        return [[start]]
    
    paths = []
    queue = [(0, [start])]  # (length, path)
    
    while queue and len(paths) < k:
        queue.sort(key=lambda x: x[0])  # Sort by path length
        length, path = queue.pop(0)
        current = path[-1]
        
        if current == end:
            paths.append(path)
            continue
        
        for neighbor in graph[current]:
            if neighbor not in path:  # Avoid cycles
                new_path = path + [neighbor]
                queue.append((len(new_path), new_path))
    
    return paths

@app.route("/shortest_path", methods=["GET"])
def get_shortest_path():
    """Find shortest path between two nodes"""
    source = request.args.get("source")
    target = request.args.get("target")
    aop = request.args.get("aop")
    
    if not source or not target:
        return jsonify({"error": "Source and target parameters required"}), 400
    
    try:
        if aop:
            # Get specific AOP data
            aop_graph_data = get_aop_graph_data(aop)
        else:
            # Use all graph data
            aop_graph_data = graph_data
        

        # Guard against None to avoid calling .get on None
        if not aop_graph_data or not isinstance(aop_graph_data, dict) or not aop_graph_data.get('nodes'):
            return jsonify({"error": "No graph data available"}), 400
        assert isinstance(aop_graph_data, dict)
        graph = build_graph_from_data(aop_graph_data)
        path = find_shortest_path(graph, source, target)
        
        if path:
            # Get path edges
            path_edges = []
            for i in range(len(path) - 1):
                for edge in aop_graph_data.get('edges', []):
                    if edge.get('source') == path[i] and edge.get('target') == path[i + 1]:
                        path_edges.append(edge)
                        break
            
            return jsonify({
                "path": path,
                "length": len(path) - 1,
                "edges": path_edges
            })
        else:
            return jsonify({"path": None, "message": "No path found"})
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/k_shortest_paths", methods=["GET"])
def get_k_shortest_paths():
    """Find k shortest paths between two nodes"""
    source = request.args.get("source")
    target = request.args.get("target")
    k = int(request.args.get("k", 3))
    aop = request.args.get("aop")
    
    if not source or not target:
        return jsonify({"error": "Source and target parameters required"}), 400
    
    try:
        if aop:
            # Get specific AOP data
            aop_graph_data = get_aop_graph_data(aop)
        else:
            # Use all graph data
            aop_graph_data = graph_data
        

        # Guard against None to avoid calling .get on None
        if not aop_graph_data or not isinstance(aop_graph_data, dict) or not aop_graph_data.get('nodes'):
            return jsonify({"error": "No graph data available"}), 400
        assert isinstance(aop_graph_data, dict)
        graph = build_graph_from_data(aop_graph_data)
        paths = find_k_shortest_paths(graph, source, target, k)
        
        result_paths = []
        for path in paths:
            # Get path edges
            path_edges = []
            for i in range(len(path) - 1):
                for edge in aop_graph_data.get('edges', []):
                    if edge.get('source') == path[i] and edge.get('target') == path[i + 1]:
                        path_edges.append(edge)
                        break
            
            result_paths.append({
                "path": path,
                "length": len(path) - 1,
                "edges": path_edges
            })
        
        return jsonify({
            "paths": result_paths,
            "count": len(result_paths)
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/all_paths", methods=["GET"])
def get_all_possible_paths():
    """Find all possible paths between different node types"""
    aop = request.args.get("aop")
    max_paths = int(request.args.get("max_paths", 10))
    
    try:
        if aop:
            aop_graph_data = get_aop_graph_data(aop)
        else:
            aop_graph_data = graph_data
        

        # Guard against None to avoid calling .get on None
        if not aop_graph_data or not isinstance(aop_graph_data, dict) or not aop_graph_data.get('nodes'):
            return jsonify({"error": "No graph data available"}), 400
        assert isinstance(aop_graph_data, dict)
        graph = build_graph_from_data(aop_graph_data)
        nodes = aop_graph_data.get('nodes', [])
        
        # Group nodes by type
        node_types = defaultdict(list)
        for node in nodes:
            node_type = node.get('type', 'Unknown')
            node_types[node_type].append(node.get('id'))
        
        all_paths = []
        
        # Find paths between different node types
        for source_type, source_nodes in node_types.items():
            for target_type, target_nodes in node_types.items():
                if source_type != target_type:
                    for source in source_nodes[:3]:  # Limit to avoid too many combinations
                        for target in target_nodes[:3]:
                            paths = find_k_shortest_paths(graph, source, target, 2)
                            for path in paths:
                                if len(all_paths) < max_paths:
                                    # Get path edges
                                    path_edges = []
                                    for i in range(len(path) - 1):
                                        for edge in aop_graph_data.get('edges', []):
                                            if edge.get('source') == path[i] and edge.get('target') == path[i + 1]:
                                                path_edges.append(edge)
                                                break
                                    
                                    all_paths.append({
                                        "source_type": source_type,
                                        "target_type": target_type,
                                        "path": path,
                                        "length": len(path) - 1,
                                        "edges": path_edges
                                    })
        
        return jsonify({
            "paths": all_paths,
            "count": len(all_paths),
            "node_types": dict(node_types)
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/")
def home():
    """Root endpoint"""
    return jsonify({
        "message": "AOP Network Visualizer API",
        "version": "1.0",
        "endpoints": [
            "/aops",
            "/aop_graph?aop=<aop_id>",
            "/shortest_path?source=<node>&target=<node>&aop=<aop>",
            "/k_shortest_paths?source=<node>&target=<node>&k=<number>&aop=<aop>",
            "/all_paths?aop=<aop>&max_paths=<number>",
            "/search?q=<query>&by=<filter>",
            "/chat (POST)"
        ]
    })

# Hypergraph and Community Detection Endpoints

@app.route("/community_detection", methods=["POST"])
def community_detection():
    """Detect communities in the network using various algorithms"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        method = data.get('method', 'louvain')
        aop = data.get('aop')
        resolution = float(data.get('resolution', 1.0))
        
        # Get graph data
        if aop:
            aop_graph_data = get_aop_graph_data(aop)
        else:
            aop_graph_data = graph_data
        
        if not aop_graph_data or not aop_graph_data.get('nodes'):
            return jsonify({"error": "No graph data available"}), 400
        
        # Detect communities
        result = detect_communities(
            aop_graph_data['nodes'], 
            aop_graph_data['edges'], 
            method=method,
            resolution=resolution
        )
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Community detection error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/hypergraph", methods=["POST"])
def create_hypergraph_endpoint():
    """Create hypergraph with hypernodes and hyperedges"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        # Check if nodes and edges are provided directly
        nodes = data.get('nodes')
        edges = data.get('edges')
        
        if nodes and edges:
            # Use provided nodes and edges directly
            aop_graph_data = {'nodes': nodes, 'edges': edges}
            logger.info(f"Using provided data: {len(nodes)} nodes, {len(edges)} edges")
        else:
            # Fallback to AOP-based data (support single or multiple AOPs)
            aop = data.get('aop')
            aops_list = data.get('aops') if isinstance(data.get('aops'), list) else None
            if aops_list and aop_data and isinstance(aop_data, dict):
                # Build combined subgraph for selected AOPs
                selected_set = set(str(x) for x in aops_list if x)
                combined_nodes = [nd for nd in aop_data['nodes'].values() if nd.get('aop') in selected_set]
                combined_edges = [ed for ed in aop_data['edges'] if ed.get('aop') in selected_set]
                aop_graph_data = {'nodes': combined_nodes, 'edges': combined_edges}
                logger.info(f"Using combined AOPs {len(selected_set)}: {len(combined_nodes)} nodes, {len(combined_edges)} edges")
            elif aop:
                aop_graph_data = get_aop_graph_data(aop)
            else:
                aop_graph_data = graph_data
        
        min_nodes = int(data.get('min_nodes', 4))
        community_method = data.get('community_method', 'louvain')
        use_communities = data.get('use_communities', True)
        use_type_groups = data.get('use_type_groups', True)
        # Split size for grouping chemicals into multiple hypernodes (per AOP)
        splitnode = int(data.get('splitnode', 8))
        
        if not aop_graph_data or not aop_graph_data.get('nodes'):
            return jsonify({"error": "No graph data available"}), 400
        
        # Create hypergraph
        hypergraph_result = create_hypergraph(
            aop_graph_data['nodes'],
            aop_graph_data['edges'],
            min_nodes=min_nodes,
            community_method=community_method,
            use_communities=use_communities,
            use_type_groups=use_type_groups
        )
        
        # Get chemical nodes for the selected AOP(s) only (avoid loading all chemicals)
        chemical_nodes_to_add = []
        selected_aops = []
        if isinstance(data, dict):
            if data.get('aop'):
                selected_aops = [data.get('aop')]
            else:
                aops_field = data.get('aops')
                if isinstance(aops_field, list):
                    selected_aops = list({str(x) for x in aops_field if x})
        # If not explicitly provided, infer from current subgraph
        if not selected_aops and isinstance(aop_graph_data, dict):
            try:
                selected_aops = list({nd.get('aop') for nd in aop_graph_data.get('nodes', []) if nd.get('aop')})
            except Exception:
                selected_aops = []
        if aop_data and isinstance(aop_data, dict) and selected_aops:
            chem_map = aop_data.get('aop_chemical_map', {})
            chem_dict = aop_data.get('chemicals', {})
            seen_ids = set()
            for aop_sel in selected_aops:
                for chem in chem_map.get(aop_sel, []):
                    chemical_id = chem.get('id')
                    if not chemical_id or chemical_id in seen_ids:
                        continue
                    seen_ids.add(chemical_id)
                    # Pull canonical info from chem_dict if present
                    base = chem_dict.get(chemical_id, {})
                    chemical_nodes_to_add.append({
                        'id': chemical_id,
                        'label': base.get('label', chem.get('name', chemical_id)),
                        'type': base.get('type', 'chemical'),
                        'aop': aop_sel
                    })
            print(f"Formatted {len(chemical_nodes_to_add)} chemical nodes for AOPs {selected_aops} (frontend)")

        # Add chemical connections (plain edge objects) for the selected AOP(s) only
        chemical_edges = []
        if aop_data and isinstance(aop_data, dict) and selected_aops:
            aop_names_by_id = aop_data.get('aop_id_to_name', {})
            for aop_sel in selected_aops:
                if not aop_sel:
                    continue
                chemicals = aop_data.get('aop_chemical_map', {}).get(aop_sel, [])

                # Prefer connecting chemicals to an AO node for this AOP
                aop_nodes_this = [
                    node for node in aop_graph_data['nodes']
                    if isinstance(node, dict) and node.get('aop') == aop_sel
                ]
                ao_nodes = [n.get('id') for n in aop_nodes_this if str(n.get('type', '')).upper() in ('ADVERSEOUTCOME', 'AO')]
                target_node_id = ao_nodes[0] if ao_nodes else (aop_nodes_this[0].get('id') if aop_nodes_this else None)

                if target_node_id:
                    # Build readable edge label using AOP name from CSV (fallback to ID)
                    aop_num = aop_sel.split(':')[1] if isinstance(aop_sel, str) and ':' in aop_sel else str(aop_sel)
                    aop_name = aop_names_by_id.get(aop_sel, str(aop_sel))
                    edge_label = f"AOP {aop_num}: {aop_name}"

                    for chemical in chemicals:
                        chemical_id = chemical.get('id')
                        if not chemical_id:
                            continue
                        chemical_edges.append({
                            'id': f"edge_{chemical_id}_to_{target_node_id}",
                            'source': chemical_id,
                            'target': target_node_id,
                            'label': edge_label,
                            'type': 'chemical_connection',
                            'aop': aop_sel
                        })

        # Build chemical hypernodes and hyperedges (per-AOP) for selected set
        chem_hypernodes = []
        chem_hyperedges = []
        if selected_aops:
            try:
                aop_names_by_id = aop_data.get('aop_id_to_name', {}) if isinstance(aop_data, dict) else {}
                for aop_sel in selected_aops:
                    chemicals_for_aop = aop_data.get('aop_chemical_map', {}).get(aop_sel, [])
                    # Prefer connecting to an AO node for this AOP
                    aop_nodes_this = [
                        node for node in aop_graph_data['nodes']
                        if isinstance(node, dict) and node.get('aop') == aop_sel
                    ]
                    ao_nodes = [n.get('id') for n in aop_nodes_this if str(n.get('type', '')).upper() in ('ADVERSEOUTCOME', 'AO')]
                    target_node_id = ao_nodes[0] if ao_nodes else (aop_nodes_this[0].get('id') if aop_nodes_this else None)

                    # Group chemicals into chunks of size 'splitnode' and create hypernodes/edges
                    if target_node_id and chemicals_for_aop and aop_sel:
                        chunks = [chemicals_for_aop[i:i + splitnode] for i in range(0, len(chemicals_for_aop), splitnode)]
                        aop_str = str(aop_sel)
                        aop_num = aop_str.split(':')[1] if ':' in aop_str else aop_str
                        aop_name = aop_names_by_id.get(aop_sel, aop_str)
                        edge_label = f"AOP {aop_num}: {aop_name}"
                        chem_parent_map = {}

                        for idx, group in enumerate(chunks, start=1):
                            members = [c['id'] for c in group if 'id' in c]
                            hn_id = f"chem-hypernode-{aop_sel}-{idx}"
                            chem_hypernodes.append({
                                'id': hn_id,
                                'label': f"{edge_label} - Chemicals {idx} ({len(members)})",
                                'type': 'chemical-hypernode',
                                'original_type': 'chemical',
                                'member_count': len(members),
                                'members': members,
                                'aop': aop_sel
                            })
                            # Map chemical -> parent hypernode
                            for mid in members:
                                chem_parent_map[mid] = hn_id

                            # One hyperedge from the chemical group hypernode to the AO node
                            chem_hyperedges.append({
                                'id': f"edge_{hn_id}_to_{target_node_id}",
                                'source': hn_id,
                                'target': target_node_id,
                                'label': edge_label,
                                'type': 'chemical_hyperedge',
                                'aop': aop_sel
                            })

                        # Assign parent to chemical nodes so frontend nests them under hypernode
                        for n in chemical_nodes_to_add:
                            if n.get('aop') == aop_sel:
                                pid = chem_parent_map.get(n.get('id'))
                                if pid:
                                    n['parent'] = pid

                # Do not include per-chemical edges when using chemical hypernodes
                chemical_edges = []
            except Exception:
                # Fail-safe: fall back silently to non-grouped chemical edges
                pass

        # Compose response - when AOP(s) selected, return chemical-only hypergraph
        if selected_aops:
            enhanced_data = {
                'nodes': aop_graph_data['nodes'] + chem_hypernodes + chemical_nodes_to_add,
                'edges': aop_graph_data['edges'] + chem_hyperedges,
                'hypergraph_stats': hypergraph_result['stats'],
                'community_data': hypergraph_result.get('community_data'),
                'network_properties': hypergraph_result.get('network_properties'),
                'node_colors': hypergraph_result.get('node_colors', {}),
                'config': {
                    **hypergraph_result['config'],
                    'useChemicalHypernodesOnly': True,
                    'splitnode': splitnode,
                    'aop_id_to_name': aop_data.get('aop_id_to_name', {}),
                    'selected_aops': selected_aops
                }
            }
        else:
            # Default behavior (no AOP filter): include server hypernodes and connections
            enhanced_data = {
                'nodes': aop_graph_data['nodes'] + hypergraph_result['hypernodes'] + chemical_nodes_to_add,
                'edges': aop_graph_data['edges'] + hypergraph_result['hypernode_connections'] + chemical_edges,
                'hypergraph_stats': hypergraph_result['stats'],
                'community_data': hypergraph_result.get('community_data'),
                'network_properties': hypergraph_result.get('network_properties'),
                'node_colors': hypergraph_result.get('node_colors', {}),
                'config': hypergraph_result['config']
            }
        
        return jsonify(enhanced_data)
        
    except Exception as e:
        logger.error(f"Hypergraph creation error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/network_analysis", methods=["GET"])
def network_analysis():
    """Analyze network properties and statistics"""
    try:
        aop = request.args.get('aop')
        
        # Get graph data
        if aop:
            aop_graph_data = get_aop_graph_data(aop)
        else:
            aop_graph_data = graph_data
        
        if not aop_graph_data or not aop_graph_data.get('nodes'):
            return jsonify({"error": "No graph data available"}), 400
        
        # Analyze network
        processor = HypergraphProcessor()
        processor.build_networkx_graph(aop_graph_data['nodes'], aop_graph_data['edges'])
        properties = processor.analyze_network_properties()
        
        # Add node type statistics
        node_types = defaultdict(int)
        for node in aop_graph_data['nodes']:
            node_type = node.get('type', 'Unknown')
            node_types[node_type] += 1
        
        properties['node_type_distribution'] = dict(node_types)
        
        return jsonify(properties)
        
    except Exception as e:
        logger.error(f"Network analysis error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/perplexity_analysis", methods=["POST"])
def perplexity_analysis():
    """Analyze nodes/edges using Perplexity API for scientific context"""
    try:
        logger.info("=== Perplexity Analysis Request ===")
        data = request.get_json()
        logger.info(f"Request data: {data}")
        
        if not data:
            logger.error("No data provided in request")
            return jsonify({"error": "No data provided"}), 400
        
        query = data.get('query', '')
        node_ids = data.get('node_ids', [])
        context_type = data.get('context_type', 'general')
        aop_name = data.get('aop', '')
        
        logger.info(f"Query: {query[:100]}...")
        logger.info(f"Node IDs: {node_ids}")
        logger.info(f"Context: {context_type}")
        logger.info(f"AOP: {aop_name}")
        
        if not query:
            logger.error("Query is required but not provided")
            return jsonify({"error": "Query is required"}), 400
        
        # Get API key from environment
        api_key = os.getenv('PERPLEXITY_API_KEY')
        logger.info(f"API key configured: {bool(api_key and api_key != 'your_perplexity_api_key_here')}")
        
        if not api_key or api_key == 'your_perplexity_api_key_here':
            logger.error("Perplexity API key not configured")
            return jsonify({
                "error": "Perplexity API key not configured. Please set PERPLEXITY_API_KEY in .env file",
                "status": "configuration_error"
            }), 400
        
        # Build context from graph data
        context_info = []
        if node_ids and aop_name in aop_data:
            aop_graph = aop_data[aop_name]
            for node_id in node_ids:
                for node in aop_graph.get('nodes', []):
                    if node.get('id') == node_id:
                        context_info.append(f"Node: {node.get('label', node_id)} (Type: {node.get('type', 'Unknown')})")
        
        # Enhance query with AOP context
        enhanced_query = f"""
        Context: This question is about Adverse Outcome Pathways (AOPs) in toxicology and systems biology.
        {f"Current AOP: {aop_name}" if aop_name else ""}
        {f"Selected network elements: {', '.join(context_info)}" if context_info else ""}
        
        Question: {query}
        
        Please provide a scientific analysis focusing on:
        1. Biological mechanisms and pathways
        2. Molecular interactions and processes
        3. Toxicological significance
        4. Relevant scientific literature
        """
        
        # Call Perplexity API
        headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }
        
        payload = {
            'model': 'sonar',
            'messages': [
                {
                    'role': 'system',
                    'content': 'You are a scientific expert in toxicology, systems biology, and adverse outcome pathways. Provide detailed, accurate scientific analysis with references when possible.'
                },
                {
                    'role': 'user',
                    'content': enhanced_query
                }
            ],
            'return_citations': True,
            'search_recency_filter': 'month'
        }
        
        logger.info(f"Sending request to Perplexity API...")
        logger.info(f"Model: {payload['model']}")
        logger.info(f"Query length: {len(enhanced_query)} characters")
        
        response = requests.post(
            'https://api.perplexity.ai/chat/completions',
            headers=headers,
            json=payload,
            timeout=30
        )
        
        logger.info(f"Perplexity API response status: {response.status_code}")
        logger.info(f"Response headers: {dict(response.headers)}")
        
        if response.status_code != 200:
            logger.error(f"Perplexity API error: {response.status_code}")
            logger.error(f"Response text: {response.text}")
            
            error_detail = "Unknown API error"
            try:
                error_response = response.json()
                logger.error(f"Error response JSON: {error_response}")
                if isinstance(error_response, dict):
                    if 'error' in error_response:
                        if isinstance(error_response['error'], dict):
                            error_detail = error_response['error'].get('message', str(error_response['error']))
                        else:
                            error_detail = str(error_response['error'])
                    elif 'message' in error_response:
                        error_detail = str(error_response['message'])
                    else:
                        error_detail = str(error_response)
                else:
                    error_detail = str(error_response)
            except Exception as e:
                logger.error(f"Failed to parse error response: {e}")
                error_detail = response.text[:200] if response.text else f"HTTP {response.status_code}"
            
            return jsonify({
                "error": f"Perplexity API error: {error_detail}",
                "status": "api_error",
                "status_code": response.status_code,
                "raw_response": response.text[:500] if response.text else None
            }), 500
        
        logger.info("Successfully received response from Perplexity API")
        api_result = response.json()
        logger.info(f"API result keys: {list(api_result.keys()) if isinstance(api_result, dict) else type(api_result)}")
        
        # Extract and format the response
        if 'choices' in api_result and len(api_result['choices']) > 0:
            content = api_result['choices'][0]['message']['content']
            
            result = {
                'query': query,
                'context_type': context_type,
                'aop': aop_name,
                'analysis': {
                    'content': content,
                    'usage': api_result.get('usage', {}),
                    'model': 'sonar'
                },
                'selected_nodes': len(node_ids),
                'status': 'success',
                'timestamp': datetime.now().isoformat()
            }
            
            # Extract citations from various possible locations in the API response
            citations = []
            
            # Check multiple possible citation locations
            if 'citations' in api_result:
                citations = api_result['citations']
                logger.info(f"Found citations in main response: {len(citations)}")
            elif 'choices' in api_result and api_result['choices']:
                choice = api_result['choices'][0]
                if 'citations' in choice:
                    citations = choice['citations']
                    logger.info(f"Found citations in choice: {len(citations)}")
                elif 'message' in choice and 'citations' in choice['message']:
                    citations = choice['message']['citations']
                    logger.info(f"Found citations in message: {len(citations)}")
            
            # Also check for citation URLs in the response metadata
            if not citations and 'web_results' in api_result:
                citations = api_result['web_results']
                logger.info(f"Found web results as citations: {len(citations)}")
            
            if citations:
                result['analysis']['citations'] = citations
                logger.info(f"Successfully extracted {len(citations)} citations")
                logger.info(f"First citation example: {citations[0] if citations else 'None'}")
            else:
                logger.warning("No citations found in API response")
                logger.info(f"API result keys: {list(api_result.keys())}")
            
            return jsonify(result)
        else:
            return jsonify({
                "error": "No response from Perplexity API",
                "status": "api_error"
            }), 500
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Network error calling Perplexity API: {e}")
        return jsonify({
            "error": f"Network error connecting to Perplexity API: {str(e)}",
            "status": "network_error"
        }), 500
    except Exception as e:
        logger.error(f"Perplexity analysis error: {e}")
        logger.error(f"Error type: {type(e)}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        return jsonify({
            "error": f"Internal server error: {str(e)}",
            "status": "error",
            "error_type": str(type(e).__name__)
        }), 500

@app.route("/aops_detailed", methods=["GET"])
def get_aops_detailed():
    """Get detailed AOP information with titles and descriptions"""
    try:
        # For now, return the simple AOP list with enhanced info
        # In production, this would query a database with AOP metadata
        simple_aops = get_available_aops()
        
        detailed_aops = []
        for aop in simple_aops:
            # Extract AOP number if present
            aop_number = ''.join(filter(str.isdigit, aop))
            
            # Create enhanced AOP object
            aop_obj = {
                'id': aop,
                'name': aop,
                'title': aop,
                'number': aop_number,
                'description': f"Adverse Outcome Pathway {aop_number}" if aop_number else f"AOP: {aop}"
            }
            
            # Add specific descriptions for known AOPs
            if '431' in aop:
                aop_obj['description'] = 'Liver fibrosis and cirrhosis pathway'
            elif '100' in aop:
                aop_obj['description'] = 'Oxidative stress leading to cellular damage'
            elif '101' in aop:
                aop_obj['description'] = 'DNA damage and repair mechanisms'
            elif 'liver' in aop.lower():
                aop_obj['description'] = 'Hepatic toxicity and liver-related adverse outcomes'
            elif 'fibrosis' in aop.lower():
                aop_obj['description'] = 'Tissue fibrosis and scarring pathways'
                
            detailed_aops.append(aop_obj)
        
        return jsonify(detailed_aops)
        
    except Exception as e:
        logger.error(f"Error getting detailed AOPs: {e}")
        return jsonify({"error": str(e)}), 500

# Removed stray duplicate get_ke_mie_terms logic block
        
@app.route("/get_ke_mie_terms", methods=["GET"])
def get_ke_mie_terms():
    """Get all available KE and MIE terms for multi-select"""
    try:
        global aop_data
        logger.info("Getting all KE/MIE terms")
        
        all_terms = []
        term_ids = set()
        
        # Check if aop_data is available
        if not aop_data or 'nodes' not in aop_data:
            logger.error("No AOP data loaded")
            return jsonify({"success": True, "terms": [], "total": 0})
        
        # aop_data['nodes'] is a dictionary where keys are node IDs and values are node data
        nodes_dict = aop_data['nodes']
        logger.info(f"Processing {len(nodes_dict)} nodes")
        
        # Process each node in the dictionary
        for node_id, node_data in nodes_dict.items():
            if not isinstance(node_data, dict):
                continue
                
            node_type = node_data.get('type', '')
            node_label = node_data.get('label', node_id)
            
            # Only include KE, MIE, and AO nodes
            if node_type in ['KeyEvent', 'MolecularInitiatingEvent', 'AdverseOutcome'] and node_id not in term_ids:
                term_ids.add(node_id)
                all_terms.append({
                    'id': node_id,
                    'name': node_label,
                    'label': node_label,
                    'type': node_type,
                    'aop_source': node_data.get('aop', 'unknown')
                })
        
        logger.info(f"Found {len(all_terms)} KE/MIE/AO terms")
        
        # Sort terms by type and then by label
        all_terms.sort(key=lambda x: (x['type'], x['label']))
        
        result = {
            'success': True,
            'terms': all_terms,
            'total': len(all_terms)
        }
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error getting KE/MIE terms: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/search_key_events", methods=["GET"])
def search_key_events():
    """Search for biological terms across all MIE, KE, and AO nodes and optionally return complete AOP networks"""
    try:
        query = request.args.get('query', '').strip()
        limit = int(request.args.get('limit', 100))
        complete_pathways = request.args.get('complete_pathways', 'false').lower() == 'true'
        
        if not query:
            return jsonify({"success": False, "error": "Query parameter is required"})
        
        logger.info(f"Searching for: '{query}' (complete_pathways: {complete_pathways})")
        
        global aop_data
        if not aop_data or 'nodes' not in aop_data:
            return jsonify({"success": False, "error": "No AOP data loaded"})
        
        # Prepare search terms (split query and create variations)
        search_terms = [query.lower()]
        query_words = query.lower().split()
        search_terms.extend(query_words)
        
        # Add common biological term variations
        if 'ache' in query.lower() or 'acetylcholinesterase' in query.lower():
            search_terms.extend(['acetylcholinesterase', 'ache', 'cholinesterase', 'acetylcholine'])
        if 'inhibition' in query.lower():
            search_terms.extend(['inhibit', 'inhibitor', 'inhibitory'])
        if 'dna' in query.lower():
            search_terms.extend(['deoxyribonucleic', 'genetic', 'genomic'])
        if 'oxidative' in query.lower() or 'stress' in query.lower():
            search_terms.extend(['ros', 'reactive oxygen', 'oxidative stress', 'antioxidant'])
        
        logger.info(f"Expanded search terms: {search_terms}")
        
        # Search through all nodes
        matching_nodes = []
        matching_aops = set()
        aop_titles = {}
        
        nodes_dict = aop_data['nodes']
        
        for node_id, node_data in nodes_dict.items():
            if not isinstance(node_data, dict):
                continue
                
            node_label = (node_data.get('label', '') or '').lower()
            node_type = node_data.get('type', '')
            node_aop = node_data.get('aop', 'unknown')
            
            # Only search MIE, KE, and AO nodes
            if node_type not in ['KeyEvent', 'MolecularInitiatingEvent', 'AdverseOutcome']:
                continue
            
            # Check if any search term matches the node label
            relevance_score = 0
            node_matches = False
            
            for term in search_terms:
                if term in node_label:
                    node_matches = True
                    # Higher score for exact matches and longer terms
                    if term == query.lower():
                        relevance_score += 10  # Exact query match
                    elif len(term) > 3:
                        relevance_score += 5   # Substantial term match
                    else:
                        relevance_score += 1   # Partial match
            
            if node_matches:
                matching_nodes.append({
                    'id': node_id,
                    'label': node_data.get('label', node_id),
                    'type': node_type,
                    'aop': node_aop,
                    'aop_title': f"AOP {node_aop}",
                    'relevance_score': relevance_score,
                    'is_search_match': True
                })
                matching_aops.add(node_aop)
                aop_titles[node_aop] = f"AOP {node_aop}"
        
        # Sort results by relevance score
        matching_nodes.sort(key=lambda x: x.get('relevance_score', 0), reverse=True)
        
        # Limit results for display
        limited_results = matching_nodes[:limit]
        
        logger.info(f"Found {len(matching_nodes)} matching nodes across {len(matching_aops)} AOPs")
        
        response_data = {
            'success': True,
            'query': query,
            'results': limited_results,
            'total_matches': len(matching_nodes),
            'total_aops': len(matching_aops),
            'matching_aops': list(matching_aops)
        }
        
        # Generate complete pathway network if requested
        if complete_pathways and matching_aops:
            try:
                logger.info(f"Creating complete pathway network for {len(matching_aops)} AOPs")
                
                # Limit AOPs for performance (max 15 AOPs)
                max_aops = min(15, len(matching_aops))
                selected_aops = list(matching_aops)[:max_aops]
                
                combined_nodes = []
                combined_edges = []
                node_ids = set()
                
                # Collect all nodes and edges from matching AOPs
                for node_id, node_data in aop_data['nodes'].items():
                    node_aop = node_data.get('aop', 'unknown')
                    if node_aop in selected_aops:
                        if node_id not in node_ids:
                            node_ids.add(node_id)
                            # Mark nodes that were direct search matches
                            is_match = any(n['id'] == node_id for n in matching_nodes)
                            combined_nodes.append({
                                'id': node_id,
                                'label': node_data.get('label', node_id),
                                'type': node_data.get('type', ''),
                                'aop_source': node_aop,
                                'is_search_match': is_match,
                                **node_data
                            })
                
                # Collect edges from matching AOPs
                for edge in aop_data['edges']:
                    edge_aop = edge.get('aop', 'unknown')
                    if edge_aop in selected_aops:
                        # Only include edges where both source and target are in our node set
                        if edge.get('source') in node_ids and edge.get('target') in node_ids:
                            combined_edges.append({
                                **edge,
                                'aop_source': edge_aop
                            })
                
                # Create pathway statistics
                pathway_stats = {
                    'total_nodes': len(combined_nodes),
                    'total_edges': len(combined_edges),
                    'aop_count': len(selected_aops),
                    'node_types': {},
                    'direct_matches': sum(1 for node in combined_nodes if node.get('is_search_match', False))
                }
                
                # Count node types
                for node in combined_nodes:
                    node_type = node.get('type', 'Unknown')
                    pathway_stats['node_types'][node_type] = pathway_stats['node_types'].get(node_type, 0) + 1
                
                graph_data = {
                    'nodes': combined_nodes,
                    'edges': combined_edges,
                    'metadata': {
                        'search_query': query,
                        'pathway_type': 'complete_aop_pathways',
                        'included_aops': [{'id': aop, 'title': aop_titles.get(aop, aop)} for aop in selected_aops],
                        'stats': pathway_stats
                    }
                }
                
                response_data['graph_data'] = graph_data
                logger.info(f"Generated complete network: {len(combined_nodes)} nodes, {len(combined_edges)} edges")
                
            except Exception as e:
                logger.error(f"Error generating complete pathway network: {e}")
                response_data['graph_data'] = None
                response_data['error'] = f"Failed to generate complete network: {str(e)}"
        
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"Error in search_key_events: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

def find_comprehensive_associated_network(query_terms, matching_nodes, include_cross_pathway=True):
    """
    Universal function to find complete AOP networks associated with any search terms.
    Discovers all AOPs connected through shared events and pulls complete pathway networks.
    Includes cross-pathway connections and highlights matched nodes.
    """
    global aop_data
    
    logger.info(f"Comprehensive network analysis for query terms: {query_terms}")
    
    nodes_dict = aop_data.get('nodes', {})
    edges_list = aop_data.get('edges', [])
    
    # Step 1: Identify initial matching AOPs and events
    initial_aops = set()
    initial_node_ids = set()
    event_to_aops = defaultdict(set)
    aop_to_events = defaultdict(set)
    node_to_event = {}
    
    # Extract event IDs from matching nodes and build mappings
    for match in matching_nodes:
        node_id = match['id']
        node_aop = match.get('aop', 'unknown')
        initial_aops.add(node_aop)
        initial_node_ids.add(node_id)
        
        # Try to extract event ID from node ID
        event_id = node_id.replace('node_', 'Event:') if node_id.startswith('node_') else node_id
        node_to_event[node_id] = event_id
        event_to_aops[event_id].add(node_aop)
        aop_to_events[node_aop].add(event_id)
    
    # Step 2: Find all nodes that share events with our initial matches (cross-AOP discovery)
    shared_events = set()
    connected_aops = set(initial_aops)
    
    for node_id, node_data in nodes_dict.items():
        if not isinstance(node_data, dict):
            continue
            
        node_aop = node_data.get('aop', 'unknown')
        event_id = node_id.replace('node_', 'Event:') if node_id.startswith('node_') else node_id
        
        # Check if this node shares an event with our initial matches
        if event_id in event_to_aops and len(event_to_aops[event_id]) > 1:
            shared_events.add(event_id)
            connected_aops.add(node_aop)
            event_to_aops[event_id].add(node_aop)
            aop_to_events[node_aop].add(event_id)
    
    # Step 3: Pull ALL nodes from connected AOPs (complete pathway networks)
    comprehensive_nodes = []
    comprehensive_node_ids = set()
    
    for node_id, node_data in nodes_dict.items():
        if not isinstance(node_data, dict):
            continue
            
        node_aop = node_data.get('aop', 'unknown')
        node_type = node_data.get('type', '')
        node_label = (node_data.get('label', '') or '').lower()
        
        # Include ALL nodes from connected AOPs
        if node_aop in connected_aops:
            event_id = node_id.replace('node_', 'Event:') if node_id.startswith('node_') else node_id
            
            # Determine node characteristics
            is_initial_match = node_id in initial_node_ids
            is_query_match = any(term.lower() in node_label for term in query_terms)
            is_shared_event = event_id in shared_events
            is_cross_pathway = len(event_to_aops.get(event_id, set())) > 1
            
            # Calculate relevance score
            relevance_score = 0
            if is_initial_match:
                relevance_score += 20
            if is_query_match:
                relevance_score += 15
            if is_shared_event:
                relevance_score += 10
            if is_cross_pathway:
                relevance_score += 5
            
            enhanced_node = {
                'id': node_id,
                'label': node_data.get('label', node_id),
                'type': node_type,
                'aop': node_aop,
                'aop_source': node_aop,
                'event_id': event_id,
                'is_initial_match': is_initial_match,
                'is_query_match': is_query_match,
                'is_shared_event': is_shared_event,
                'is_cross_pathway_node': is_cross_pathway,
                'associated_aops': list(event_to_aops.get(event_id, set())),
                'relevance_score': relevance_score,
                'highlight_color': 'yellow' if is_initial_match or is_query_match else 'lightblue' if is_shared_event else 'white',
                'node_size': 30 if is_initial_match else 25 if is_query_match else 20,
                **node_data
            }
            
            comprehensive_nodes.append(enhanced_node)
            comprehensive_node_ids.add(node_id)
    
    # Step 4: Find additional cross-pathway connections through edges
    if include_cross_pathway:
        edge_connected_nodes = set()
        
        for edge in edges_list:
            source_id = edge.get('source')
            target_id = edge.get('target')
            edge_aop = edge.get('aop', 'unknown')
            
            # If one node is in our network, consider including the other
            if source_id in comprehensive_node_ids and target_id not in comprehensive_node_ids:
                if target_id in nodes_dict:
                    edge_connected_nodes.add(target_id)
                    
            elif target_id in comprehensive_node_ids and source_id not in comprehensive_node_ids:
                if source_id in nodes_dict:
                    edge_connected_nodes.add(source_id)
        
        # Add edge-connected nodes
        for node_id in edge_connected_nodes:
            if node_id in nodes_dict:
                node_data = nodes_dict[node_id]
                node_aop = node_data.get('aop', 'unknown')
                
                enhanced_node = {
                    'id': node_id,
                    'label': node_data.get('label', node_id),
                    'type': node_data.get('type', ''),
                    'aop': node_aop,
                    'aop_source': node_aop,
                    'is_edge_connected': True,
                    'is_cross_pathway_connected': node_aop not in initial_aops,
                    'highlight_color': 'lightgreen',
                    'node_size': 15,
                    **node_data
                }
                
                comprehensive_nodes.append(enhanced_node)
                comprehensive_node_ids.add(node_id)
    
    # Step 5: Collect ALL relevant edges with deduplication
    comprehensive_edges = []
    edge_stats = {'within_aop': 0, 'cross_aop': 0, 'total': 0}
    edge_deduplication = {}  # (source, target) -> edge data for deduplication
    
    for edge in edges_list:
        source_id = edge.get('source')
        target_id = edge.get('target')
        edge_aop = edge.get('aop', 'unknown')
        
        if source_id in comprehensive_node_ids and target_id in comprehensive_node_ids:
            # Create edge key for deduplication (undirected - same edge regardless of direction)
            edge_key = tuple(sorted([source_id, target_id]))
            
            # Determine edge characteristics
            source_aop = next((n['aop'] for n in comprehensive_nodes if n['id'] == source_id), 'unknown')
            target_aop = next((n['aop'] for n in comprehensive_nodes if n['id'] == target_id), 'unknown')
            
            is_cross_aop_edge = source_aop != target_aop
            is_initial_connection = (source_id in initial_node_ids or target_id in initial_node_ids)
            
            # If this edge already exists, merge the information
            if edge_key in edge_deduplication:
                existing_edge = edge_deduplication[edge_key]
                # Keep the more important edge (cross-AOP or initial connection takes priority)
                if is_cross_aop_edge and not existing_edge.get('is_cross_aop_edge', False):
                    # Replace with cross-AOP edge
                    pass  # Will replace below
                elif is_initial_connection and not existing_edge.get('is_initial_connection', False):
                    # Replace with initial connection edge
                    pass  # Will replace below
                elif existing_edge.get('is_cross_aop_edge', False) or existing_edge.get('is_initial_connection', False):
                    # Keep existing more important edge
                    continue
                # Merge AOP information
                existing_aops = existing_edge.get('aops', [edge_aop])
                if edge_aop not in existing_aops:
                    existing_aops.append(edge_aop)
                    existing_edge['aops'] = existing_aops
                    existing_edge['aop_count'] = len(existing_aops)
                continue
            
            enhanced_edge = {
                'source': source_id,
                'target': target_id,
                'aop': edge_aop,
                'aop_source': edge_aop,
                'aops': [edge_aop],
                'aop_count': 1,
                'source_aop': source_aop,
                'target_aop': target_aop,
                'is_cross_pathway': is_cross_aop_edge,  # Frontend looks for this
                'is_cross_aop_edge': is_cross_aop_edge,
                'is_initial_connection': is_initial_connection,
                'edge_color': 'red' if is_cross_aop_edge else 'blue' if is_initial_connection else 'gray',
                'edge_width': 3 if is_initial_connection else 2 if is_cross_aop_edge else 1,
                'relationship': edge.get('relationship', ''),
                'type': edge.get('type', 'relationship'),
                'label': edge.get('label', ''),
                'confidence': edge.get('confidence', '2'),  # Default to medium confidence
                'evidence': edge.get('evidence', ''),
                'adjacency': edge.get('adjacency', ''),
                'id': edge.get('id', f"{source_id}-{target_id}"),
                'deduplicated': False  # Mark as original
            }
            
            edge_deduplication[edge_key] = enhanced_edge
    
    # Convert deduplicated edges to list and update statistics
    for edge_data in edge_deduplication.values():
        if edge_data['is_cross_aop_edge']:
            edge_stats['cross_aop'] += 1
        else:
            edge_stats['within_aop'] += 1
        edge_stats['total'] += 1
        comprehensive_edges.append(edge_data)
    
    # Log deduplication results
    original_edge_count = len([e for e in edges_list 
                              if e.get('source') in comprehensive_node_ids and 
                                 e.get('target') in comprehensive_node_ids])
    deduplicated_count = len(comprehensive_edges)
    logger.info(f"Edge deduplication: {original_edge_count} -> {deduplicated_count} edges (removed {original_edge_count - deduplicated_count} duplicates)")
    
    # Step 6: Calculate comprehensive network statistics
    shared_event_analysis = {}
    for event_id, sharing_aops in event_to_aops.items():
        if len(sharing_aops) > 1:
            event_nodes = [n for n in comprehensive_nodes if n.get('event_id') == event_id]
            if event_nodes:
                shared_event_analysis[event_id] = {
                    'sharing_aops': list(sharing_aops),
                    'sharing_count': len(sharing_aops),
                    'node_labels': [n['label'] for n in event_nodes],
                    'is_cross_pathway': len(sharing_aops) > 1
                }
    
    aop_statistics = {}
    for aop in connected_aops:
        aop_nodes = [n for n in comprehensive_nodes if n['aop'] == aop]
        aop_statistics[aop] = {
            'node_count': len(aop_nodes),
            'events': list(aop_to_events.get(aop, set())),
            'event_count': len(aop_to_events.get(aop, set())),
            'initial_matches': len([n for n in aop_nodes if n.get('is_initial_match', False)]),
            'query_matches': len([n for n in aop_nodes if n.get('is_query_match', False)])
        }
    
    return {
        'comprehensive_nodes': comprehensive_nodes,
        'comprehensive_edges': comprehensive_edges,
        'connected_aops': list(connected_aops),
        'initial_aops': list(initial_aops),
        'shared_events': list(shared_events),
        'shared_event_analysis': shared_event_analysis,
        'aop_statistics': aop_statistics,
        'edge_statistics': edge_stats,
        'stats': {
            'total_node_count': len(comprehensive_nodes),
            'total_edge_count': len(comprehensive_edges),
            'connected_aop_count': len(connected_aops),
            'initial_aop_count': len(initial_aops),
            'shared_event_count': len(shared_events),
            'cross_aop_connections': edge_stats['cross_aop']
        }
    }

@app.route("/comprehensive_pathway_search", methods=["GET"])
def comprehensive_pathway_search():
    """
    Enhanced comprehensive pathway search that discovers complete AOP networks through biological term queries.
    Aggregates all related AOP nodes (MIE, KE, AO) from entire database across multiple pathway networks.
    Provides cross-pathway relationship analysis and comprehensive node association mapping.
    """
    try:
        query = request.args.get('query', '').strip()
        include_cross_pathway_edges = request.args.get('cross_pathway_edges', 'true').lower() == 'true'
        max_pathways = int(request.args.get('max_pathways', 20))
        # Optional explicit AOP filter: aops=Aop:494,Aop:130 or aop=Aop:494
        aops_param = request.args.get('aops') or request.args.get('aop')
        requested_aops = []
        if aops_param:
            requested_aops = [x.strip() for x in aops_param.split(',') if x.strip()]
        
        if not query:
            return jsonify({"success": False, "error": "Query parameter is required"})
        
        logger.info(f"Comprehensive pathway search for: '{query}' (cross_pathway_edges: {include_cross_pathway_edges}, max_pathways: {max_pathways})")
        
        global aop_data
        if not aop_data or 'nodes' not in aop_data:
            return jsonify({"success": False, "error": "No AOP data loaded"})
        
        # Check for liver fibrosis specific queries (maintain backward compatibility)
        liver_fibrosis_keywords = ['liver fibrosis', 'fibrosis', 'aop 494', 'aop:494', 'stellate', 'collagen accumulation']
        is_liver_fibrosis_query = any(keyword in query.lower() for keyword in liver_fibrosis_keywords)
        
        # Enhanced search with biological term variations and ontology matching
        search_terms = [query.lower()]
        query_words = query.lower().split()
        search_terms.extend(query_words)
        
        # Add comprehensive biological term variations
        biological_expansions = {
            'acetylcholinesterase': ['ache', 'cholinesterase', 'acetylcholine', 'neurotransmitter'],
            'ache': ['acetylcholinesterase', 'cholinesterase', 'acetylcholine'],
            'dna': ['deoxyribonucleic', 'genetic', 'genomic', 'nucleotide', 'chromosome'],
            'oxidative': ['ros', 'reactive oxygen', 'free radical', 'antioxidant', 'redox'],
            'stress': ['oxidative stress', 'cellular stress', 'metabolic stress'],
            'inflammation': ['inflammatory', 'immune response', 'cytokine', 'interleukin'],
            'apoptosis': ['cell death', 'programmed cell death', 'caspase'],
            'proliferation': ['cell division', 'mitosis', 'growth', 'hyperplasia'],
            'fibrosis': ['collagen', 'scar tissue', 'fibrous', 'fibrotic'],
            'carcinoma': ['cancer', 'tumor', 'neoplasm', 'malignant'],
            'hepatic': ['liver', 'hepatocyte', 'hepatotoxic'],
            'renal': ['kidney', 'nephrotoxic', 'glomerular'],
            'cardiac': ['heart', 'cardiotoxic', 'myocardial']
        }
        
        for term in query_words:
            if term in biological_expansions:
                search_terms.extend(biological_expansions[term])
        
        logger.info(f"Expanded search terms: {search_terms[:10]}...")  # Log first 10 for brevity
        
        # Search through all nodes with enhanced matching
        matching_nodes = []
        matching_aops = set()
        node_aop_associations = {}  # node_id -> set of AOPs
        aop_node_counts = {}  # aop -> count of matching nodes
        
        nodes_dict = aop_data['nodes']
        
        for node_id, node_data in nodes_dict.items():
            if not isinstance(node_data, dict):
                continue
                
            node_label = (node_data.get('label', '') or '').lower()
            node_type = node_data.get('type', '')
            node_aop = node_data.get('aop', 'unknown')
            ontology_term = (node_data.get('ontology_term', '') or '').lower()
            
            # Only search MIE, KE, and AO nodes
            if node_type not in ['KeyEvent', 'MolecularInitiatingEvent', 'AdverseOutcome']:
                continue
            
            # Enhanced matching: label, ontology terms, and biological variations
            relevance_score = 0
            node_matches = False
            matched_terms = []
            
            for term in search_terms:
                # Label matching
                if term in node_label:
                    node_matches = True
                    matched_terms.append(f"label:{term}")
                    if term == query.lower():
                        relevance_score += 15  # Exact query match in label
                    elif len(term) > 3:
                        relevance_score += 8   # Substantial term match
                    else:
                        relevance_score += 2   # Partial match
                
                # Ontology term matching
                if term in ontology_term:
                    node_matches = True
                    matched_terms.append(f"ontology:{term}")
                    relevance_score += 5   # Ontology match
            
            if node_matches:
                # Track node-AOP associations
                if node_id not in node_aop_associations:
                    node_aop_associations[node_id] = set()
                node_aop_associations[node_id].add(node_aop)
                
                # Count matching nodes per AOP
                aop_node_counts[node_aop] = aop_node_counts.get(node_aop, 0) + 1
                
                matching_nodes.append({
                    'id': node_id,
                    'label': node_data.get('label', node_id),
                    'type': node_type,
                    'aop': node_aop,
                    'ontology': node_data.get('ontology', ''),
                    'ontology_term': node_data.get('ontology_term', ''),
                    'relevance_score': relevance_score,
                    'matched_terms': matched_terms,
                    'is_search_match': True
                })
                matching_aops.add(node_aop)
        
        # Sort by relevance and limit pathways for performance
        matching_nodes.sort(key=lambda x: x.get('relevance_score', 0), reverse=True)
        
        # Limit AOPs for performance but prioritize by node count
        sorted_aops = sorted(matching_aops, key=lambda aop: aop_node_counts.get(aop, 0), reverse=True)
        selected_aops = sorted_aops[:max_pathways]
        # If user requested specific AOPs, restrict to those (preserving ranking where possible)
        if requested_aops:
            requested_set = set(requested_aops)
            ranked = [a for a in sorted_aops if a in requested_set]
            # Include any requested that didn't get into sorted_aops due to zero matches, as a fallback
            ranked += [a for a in requested_aops if a not in ranked]
            # Enforce max_pathways bound
            selected_aops = ranked[:max_pathways] if ranked else requested_aops[:max_pathways]
        
        logger.info(f"Found {len(matching_nodes)} matching nodes across {len(matching_aops)} AOPs, selected top {len(selected_aops)} AOPs")
        
        # Use the enhanced universal comprehensive network discovery
        comprehensive_network = find_comprehensive_associated_network(
            query_words, matching_nodes, include_cross_pathway_edges
        )
        
        # Build comprehensive response
        graph_data = {
            'nodes': comprehensive_network['comprehensive_nodes'],
            'edges': comprehensive_network['comprehensive_edges'],
            'metadata': {
                'search_query': query,
                'search_terms_used': search_terms[:10],  # First 10 for brevity
                'pathway_type': 'comprehensive_cross_pathway_analysis',
                'included_aops': [{'id': aop, 'matching_nodes': aop_node_counts.get(aop, 0)} for aop in selected_aops],
                'connected_aops': comprehensive_network['connected_aops'],
                'initial_aops': comprehensive_network['initial_aops'],
                'shared_events': comprehensive_network['shared_events'],
                'stats': comprehensive_network['stats'],
                'aop_statistics': comprehensive_network['aop_statistics'],
                'edge_statistics': comprehensive_network['edge_statistics'],
                'cross_pathway_enabled': include_cross_pathway_edges,
                'search_term_node': None,
                'requested_aops': requested_aops,
                'is_liver_fibrosis_query': is_liver_fibrosis_query
            }
        }
        
        # Enhanced response with comprehensive network insights
        response_data = {
            'success': True,
            'query': query,
            'matching_nodes_summary': matching_nodes[:20],  # First 20 for summary
            'total_matches': len(matching_nodes),
            'total_aops': len(matching_aops),
            'selected_aops': selected_aops,
            'graph_data': graph_data,
            'comprehensive_network_insights': {
                'connected_aop_count': len(comprehensive_network['connected_aops']),
                'shared_event_count': len(comprehensive_network['shared_events']),
                'cross_aop_connections': comprehensive_network['edge_statistics']['cross_aop'],
                'shared_event_analysis': comprehensive_network['shared_event_analysis'],
                'aop_statistics': comprehensive_network['aop_statistics']
            }
        }
        
        # Add liver fibrosis specific verification if detected
        if is_liver_fibrosis_query:
            liver_aops = ['Aop:494', 'Aop:144', 'Aop:383', 'Aop:38']
            found_liver_aops = [aop for aop in liver_aops if aop in comprehensive_network['connected_aops']]
            
            response_data['liver_fibrosis_verification'] = {
                'detected': True,
                'aop_494_verified': 'Aop:494' in comprehensive_network['connected_aops'],
                'related_aops_found': found_liver_aops,
                'liver_specific_shared_events': [
                    event_id for event_id, analysis in comprehensive_network['shared_event_analysis'].items()
                    if any('liver' in str(label).lower() or 'fibrosis' in str(label).lower() 
                           for label in analysis.get('node_labels', []))
                ]
            }
        
        logger.info(f"Comprehensive search completed: {comprehensive_network['stats']['total_node_count']} nodes, {comprehensive_network['stats']['total_edge_count']} edges, {comprehensive_network['stats']['cross_aop_connections']} cross-pathway connections")
        
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"Error in comprehensive_pathway_search: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/liver_fibrosis_verification", methods=["GET"])
def liver_fibrosis_verification():
    """
    Dedicated endpoint for liver fibrosis AOP 494 verification and related network discovery.
    Verifies connections and returns AOPs 144, 383, 38 with shared MIE/KE nodes.
    """
    try:
        query = request.args.get('query', 'liver fibrosis').strip()
        include_cross_pathway = request.args.get('cross_pathway', 'true').lower() == 'true'
        
        global aop_data
        if not aop_data or 'nodes' not in aop_data:
            return jsonify({"success": False, "error": "No AOP data loaded"})
        
        logger.info(f"Liver fibrosis verification requested for query: '{query}'")
        
        # Find liver fibrosis related nodes first
        liver_fibrosis_keywords = ['liver', 'fibrosis', 'stellate', 'collagen', 'extracellular matrix']
        matching_nodes = []
        
        nodes_dict = aop_data['nodes']
        for node_id, node_data in nodes_dict.items():
            if not isinstance(node_data, dict):
                continue
                
            node_label = (node_data.get('label', '') or '').lower()
            node_aop = node_data.get('aop', 'unknown')
            
            # Focus on liver fibrosis AOPs or matching keywords
            if (node_aop in ['Aop:494', 'Aop:144', 'Aop:383', 'Aop:38'] or 
                any(keyword in node_label for keyword in liver_fibrosis_keywords)):
                
                matching_nodes.append({
                    'id': node_id,
                    'label': node_data.get('label', node_id),
                    'type': node_data.get('type', ''),
                    'aop': node_aop,
                    'relevance_score': 20 if node_aop in ['Aop:494', 'Aop:144', 'Aop:383', 'Aop:38'] else 10
                })
        
        # Use comprehensive network discovery
        query_words = query.lower().split() if query else ['liver', 'fibrosis']
        comprehensive_network = find_comprehensive_associated_network(
            query_words, matching_nodes, include_cross_pathway
        )
        
        # Specific liver fibrosis verification
        liver_aops = ['Aop:494', 'Aop:144', 'Aop:383', 'Aop:38']
        found_liver_aops = [aop for aop in liver_aops if aop in comprehensive_network['connected_aops']]
        
        # Key liver fibrosis events verification
        key_liver_fibrosis_events = {
            'Event:344': 'Liver fibrosis (Adverse Outcome)',
            'Event:55': 'Cell injury/death',
            'Event:265': 'Stellate cell activation',
            'Event:1501': 'Extracellular matrix deposition',
            'Event:18': 'AhR activation (MIE)',
            'Event:459': 'Liver steatosis'
        }
        
        verified_events = {}
        for node in comprehensive_network['comprehensive_nodes']:
            event_id = node.get('event_id', '')
            if event_id in key_liver_fibrosis_events:
                verified_events[event_id] = {
                    'description': key_liver_fibrosis_events[event_id],
                    'node_label': node.get('label', ''),
                    'node_type': node.get('type', ''),
                    'aop': node.get('aop', ''),
                    'verified': True
                }
        
        verification_report = {
            'aop_494_status': {
                'present': 'Aop:494' in found_liver_aops,
                'verified_events': verified_events,
                'verification_score': len(verified_events) / len(key_liver_fibrosis_events) * 100
            },
            'related_aops_found': found_liver_aops,
            'network_connectivity': {
                'total_shared_events': len(comprehensive_network['shared_events']),
                'cross_aop_connections': comprehensive_network['stats']['cross_aop_connections'],
                'total_connected_aops': len(comprehensive_network['connected_aops'])
            }
        }
        
        # Enhanced graph data with highlighting
        enhanced_nodes = []
        for node in comprehensive_network['comprehensive_nodes']:
            node_aop = node.get('aop', '')
            is_liver_aop = node_aop in liver_aops
            is_key_event = node.get('event_id', '') in key_liver_fibrosis_events
            
            enhanced_node = {
                **node,
                'verification_status': 'liver_fibrosis_verified' if is_liver_aop else 'connected',
                'is_liver_fibrosis_aop': is_liver_aop,
                'is_key_liver_event': is_key_event,
                'highlight_color': 'yellow' if is_liver_aop and is_key_event else 
                                 'orange' if is_liver_aop else 
                                 'lightgreen' if is_key_event else node.get('highlight_color', 'white'),
                'node_size': 35 if is_liver_aop and is_key_event else 
                            30 if is_liver_aop else 
                            25 if is_key_event else node.get('node_size', 20)
            }
            enhanced_nodes.append(enhanced_node)
        
        graph_data = {
            'nodes': enhanced_nodes,
            'edges': comprehensive_network['comprehensive_edges'],
            'metadata': {
                'search_query': query,
                'search_type': 'liver_fibrosis_verification',
                'pathway_type': 'liver_fibrosis_verification_network',
                'verification_report': verification_report,
                'liver_fibrosis_aops': liver_aops,
                'found_liver_aops': found_liver_aops,
                'shared_events': comprehensive_network['shared_event_analysis'],
                'stats': comprehensive_network['stats'],
                'verification_timestamp': datetime.now().isoformat()
            }
        }
        
        response_data = {
            'success': True,
            'query': query,
            'verification_type': 'liver_fibrosis_aop_494_verification',
            'verification_summary': {
                'aop_494_verified': 'Aop:494' in found_liver_aops,
                'related_aops_found': found_liver_aops,
                'verification_score': verification_report['aop_494_status']['verification_score'],
                'summary': f"Liver fibrosis verification: Found {len(found_liver_aops)}/{len(liver_aops)} target AOPs with {len(verified_events)} key events verified"
            },
            'verification_details': verification_report,
            'graph_data': graph_data,
            'comprehensive_network_insights': comprehensive_network['shared_event_analysis']
        }
        
        logger.info(f"Liver fibrosis verification completed: {verification_report['aop_494_status']['verification_score']:.1f}% verification score")
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"Error in liver_fibrosis_verification: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/generate_ke_mie_network", methods=["POST"])
def generate_ke_mie_network():
    """Generate a network from selected KE/MIE terms with unique nodes"""
    try:
        data = request.get_json()
        term_ids = data.get('term_ids', [])
        unique_nodes = data.get('unique_nodes', True)
        
        if not term_ids:
            return jsonify({"success": False, "error": "No term IDs provided"})
        
        logger.info(f"Generating network for {len(term_ids)} KE/MIE terms")
        
        global aop_data
        if not aop_data or 'nodes' not in aop_data or 'edges' not in aop_data:
            return jsonify({"success": False, "error": "No AOP data loaded"})
        
        # Find all AOPs that contain the selected terms
        matching_aops = set()
        target_node_ids = set(term_ids)
        
        # Check which AOPs contain our target nodes
        for node_id, node_data in aop_data['nodes'].items():
            if node_id in target_node_ids:
                aop_source = node_data.get('aop', 'unknown')
                matching_aops.add(aop_source)
        
        logger.info(f"Found {len(matching_aops)} AOPs containing selected terms: {list(matching_aops)[:5]}")
        
        # Show only the complete AOPs that contain the selected terms
        # This gives users the specific AOP pathways for their selected KE/MIE terms
        
        logger.info(f"Collecting all nodes and edges from {len(matching_aops)} matching AOPs")
        
        combined_nodes = []
        combined_edges = []
        node_ids = set()
        edge_ids = set()
        
        # Add all nodes from the matching AOPs (complete AOP pathways)
        for node_id, node_data in aop_data['nodes'].items():
            node_aop = node_data.get('aop', 'unknown')
            if node_aop in matching_aops:
                if unique_nodes:
                    if node_id not in node_ids:
                        node_ids.add(node_id)
                        combined_nodes.append({
                            'id': node_id,
                            'label': node_data.get('label', node_id),
                            'type': node_data.get('type', ''),
                            'aop_source': node_aop,
                            'is_selected': node_id in target_node_ids,  # Mark selected nodes
                            **node_data
                        })
                else:
                    # Include all nodes, even duplicates
                    unique_id = f"{node_id}_{node_aop}"
                    combined_nodes.append({
                        'id': unique_id,
                        'label': node_data.get('label', node_id),
                        'type': node_data.get('type', ''),
                        'original_id': node_id,
                        'aop_source': node_aop,
                        'is_selected': node_id in target_node_ids,
                        **node_data
                    })
                    node_ids.add(unique_id)
        
        # Add all edges from matching AOPs only
        for edge in aop_data['edges']:
            source_id = edge.get('source')
            target_id = edge.get('target')
            edge_aop = edge.get('aop', 'unknown')
            
            # Only include edges from the matching AOPs
            if edge_aop in matching_aops:
                if unique_nodes:
                    # Only add edge if both nodes exist in our node set
                    if source_id in node_ids and target_id in node_ids:
                        edge_key = f"{source_id}-{target_id}"
                        if edge_key not in edge_ids:
                            edge_ids.add(edge_key)
                            combined_edges.append({
                                'source': source_id,
                                'target': target_id,
                                'aop_source': edge_aop,
                                'id': edge.get('id', edge_key),
                                'label': edge.get('label', ''),
                                'type': edge.get('type', 'relationship'),
                                **edge
                            })
                else:
                    # Adjust edge IDs for non-unique mode
                    unique_source = f"{source_id}_{edge_aop}"
                    unique_target = f"{target_id}_{edge_aop}"
                    if unique_source in node_ids and unique_target in node_ids:
                        combined_edges.append({
                            'source': unique_source,
                            'target': unique_target,
                            'aop_source': edge_aop,
                            'id': edge.get('id', f"{source_id}-{target_id}_{edge_aop}"),
                            'label': edge.get('label', ''),
                            'type': edge.get('type', 'relationship'),
                            **edge
                        })
        
        graph_data = {
            'nodes': combined_nodes,
            'edges': combined_edges
        }
        
        result = {
            'success': True,
            'graph_data': graph_data,
            'selected_terms': term_ids,
            'matching_aops': list(matching_aops),
            'stats': {
                'nodes': len(combined_nodes),
                'edges': len(combined_edges),
                'aops': len(matching_aops)
            }
        }
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error generating KE/MIE network: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)


