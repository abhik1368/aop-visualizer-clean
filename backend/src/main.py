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
        # Stressor CSV is stored under repo_root/data/aop_chemical.csv
        repo_root = os.path.abspath(os.path.join(base_path, os.pardir, os.pardir))
        stressor_csv_path = os.path.join(repo_root, "data", "aop_chemical.csv")
        
        print(f"Looking for files at:\n  EC: {aop_ke_ec_path}\n  KER: {aop_ke_ker_path}\n  MIE_AO: {aop_ke_mie_ao_path}\n  STRESSORS: {stressor_csv_path}")
        
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
        
        print(f"Loaded TSV files:\n  EC: {len(aop_ke_ec_raw)} rows\n  KER: {len(aop_ke_ker_raw)} rows\n  MIE_AO: {len(aop_ke_mie_ao_raw)} rows")
        
        nodes = {}
        edges = []
        aops = set()
        stressor_nodes = []
        stressors_by_aop = {}
        
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
            if len(row) >= 5:
                aop = str(row[0])
                source = str(row[1])
                target = str(row[2])
                rel_id = str(row[3])
                adjacency = str(row[4])
                confidence = str(row[5]) if len(row) > 5 else ""
                
                edges.append({
                    "source": source,
                    "target": target,
                    "aop": aop,
                    "relationship": rel_id,
                    "adjacency": adjacency,
                    "confidence": confidence
                })
        
        # Initialize aop_data with original data first
        aop_data = {
            "nodes": nodes,
            "edges": edges,
            "aops": sorted(list(aops))
        }

        # Attempt to load Stressor CSV and integrate as standalone nodes (no base edges)
        if os.path.exists(stressor_csv_path):
            try:
                with open(stressor_csv_path, "r", encoding="utf-8-sig") as f:
                    reader = csv.DictReader(f)
                    for r in reader:
                        # Expected columns (per aop_chemical.csv): AOP (name), ID (numeric), s.name (display), Stressor (identifier)
                        aop_name = str(r.get("AOP", "")).strip()
                        aop_id = str(r.get("ID", "")).strip()
                        stressor_name = str(r.get("s.name", "")).strip()
                        stressor_code = str(r.get("Stressor", "")).strip()

                        if not stressor_name and not stressor_code:
                            continue

                        # Build a unique node id for stressor
                        base_id = stressor_code or stressor_name or "unknown"
                        safe_fragment = base_id.replace(" ", "_").replace("/", "_").replace("\\", "_")
                        # Normalize AOP key to match internal convention (e.g., "Aop:315")
                        aop_key = f"Aop:{aop_id}" if aop_id else (aop_name or "unknown")
                        stressor_node_id = f"STRESSOR_{aop_key}_{safe_fragment}"

                        node_payload = {
                            "id": stressor_node_id,
                            "label": stressor_name or base_id,
                            "type": "Stressor",
                            # Store both where possible for robust matching in frontend
                            "aop": aop_key,
                            "aop_id": aop_id,
                            "aop_name": aop_name,
                            "stressor_code": stressor_code,
                            "stressor_name": stressor_name
                        }
                        stressor_nodes.append(node_payload)

                        # Group stressors by AOP for convenience
                        if aop_key not in stressors_by_aop:
                            stressors_by_aop[aop_key] = []
                        stressors_by_aop[aop_key].append(stressor_node_id)

                if stressor_nodes:
                    logger.info(f"Loaded {len(stressor_nodes)} stressor nodes across {len(stressors_by_aop)} AOPs")
                else:
                    logger.info("No stressor nodes found in aop_chemical.csv")
            except Exception as e:
                logger.warning(f"Failed to load stressor CSV at {stressor_csv_path}: {e}")
        else:
            logger.info(f"Stressor CSV not found at {stressor_csv_path}, skipping stressor loading")

        # Build final graph_data including stressors (as isolated nodes)
        combined_node_list = list(nodes.values()) + stressor_nodes
        
        # Don't create individual stressor-to-AO edges here
        # Let the hypergraph system handle stressor hypernode connections properly
        stressor_to_ao_edges = []
        
        # Combine all edges (just the original edges, no individual stressor connections)
        all_edges = edges
        
        # Update aop_data to include original edges only (no individual stressor connections)
        aop_data["edges"] = all_edges
        
        graph_data = {
            "nodes": combined_node_list,
            "edges": all_edges
        }

        # Store stressor summary for other endpoints if needed
        aop_data["stressors_by_aop"] = stressors_by_aop
        aop_data["stressor_nodes"] = {n["id"]: n for n in stressor_nodes}
        
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

    # Use the helper function that includes stressor nodes
    result = get_aop_graph_data(aop)
    if result:
        return jsonify(result)
    else:
        return jsonify({"nodes": [], "edges": []})

def get_aop_graph_data(aop):
    """Helper function to get graph data for a specific AOP"""
    global aop_data, graph_data
    
    if not aop or not aop_data:
        return None
    
    try:
        # Get nodes for this AOP
        aop_nodes = []
        for node_id, node_data in aop_data["nodes"].items():
            if node_data.get("aop") == aop:
                aop_nodes.append(node_data)
        
        # CRITICAL: Add stressor nodes for this AOP using numeric AOP ID matching
        # Extract numeric AOP ID from requested aop string (handles 'Aop:315' or 'AOP:315')
        def extract_aop_id(val: str) -> str:
            if not isinstance(val, str):
                return ""
            # Split on ':' and take the last part if present
            parts = val.split(":")
            candidate = parts[-1] if parts else val
            # Keep only digits
            digits = "".join(ch for ch in candidate if ch.isdigit())
            return digits

        target_aop_id = extract_aop_id(aop)

        for node in graph_data.get("nodes", []):
            if node.get("type") == "Stressor":
                stressor_id = str(node.get("aop_id", ""))
                if not stressor_id:
                    # Fallback to parsing from 'aop' field
                    stressor_id = extract_aop_id(str(node.get("aop", "")))
                if stressor_id and target_aop_id and stressor_id == target_aop_id:
                    aop_nodes.append(node)
        
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
        
        # Count stressor nodes for logging
        stressor_count = len([n for n in aop_nodes if n.get("type") == "Stressor"])
        
        result = {
            "nodes": aop_nodes,
            "edges": aop_edges,
            "title": f"AOP {aop}"
        }
        
        logger.debug(f"get_aop_graph_data({aop}): {len(aop_nodes)} nodes ({stressor_count} stressors), {len(aop_edges)} edges")
        return result
        
    except Exception as e:
        logger.error(f"Error in get_aop_graph_data({aop}): {e}")
        return None

@app.route("/graph")
def get_graph():
    """Get complete graph data"""
    return jsonify(graph_data)

@app.route("/search")
def search():
    """Search functionality"""
    q = request.args.get("q", "").lower()
    search_by = request.args.get("by", "all").lower()
    
    if not q:
        return jsonify([])

    results = []
    
    if search_by == "aop":
        results = [{"type": "aop", "value": aop, "label": aop} 
                  for aop in aop_data["aops"] if q in aop.lower()]
    else:
        for node in aop_data["nodes"].values():
            label = node.get("label", "").lower()
            node_type = node.get("type", "").lower()
            ontology_term = node.get("ontology_term", "").lower()
            
            if search_by == "all" or search_by in node_type:
                if q in label or q in ontology_term:
                    results.append({
                        "type": "node",
                        "id": node["id"],
                        "label": node.get("label", node["id"]),
                        "aop": node.get("aop", ""),
                        "node_type": node.get("type", ""),
                        "ontology_term": node.get("ontology_term", "")
                    })
        
        if search_by == "all":
            for aop in aop_data["aops"]:
                if q in aop.lower():
                    results.append({"type": "aop", "value": aop, "label": aop})
    
    return jsonify(results[:50])

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

@app.route("/pubmed_search")
def pubmed_search():
    """Search PubMed - demo version"""
    query = request.args.get("q", "")
    max_results = int(request.args.get("max_results", 10))
    
    if not query:
        return jsonify({"error": "Query parameter required"}), 400
    
    demo_publications = []
    
    for i in range(min(max_results, 5)):
        demo_publications.append({
            "pmid": f"1234567{i}",
            "title": f"Molecular mechanisms of {query} in toxicological pathways: A comprehensive analysis",
            "abstract": f"This study investigates the role of {query} in adverse outcome pathways, focusing on molecular initiating events and downstream biological responses. Our findings demonstrate significant associations with key events in toxicological cascades, providing insights into potential therapeutic targets and risk assessment strategies.",
            "authors": ["Smith JA", "Johnson BK", "Brown CL", "Davis MN"],
            "journal": "Toxicological Sciences" if i % 2 == 0 else "Environmental Health Perspectives",
            "year": str(2023 - i),
            "doi": f"10.1093/toxsci/example{i}",
            "pubmed_url": f"https://pubmed.ncbi.nlm.nih.gov/1234567{i}/"
        })
    
    return jsonify({
        "publications": demo_publications,
        "total_count": len(demo_publications),
        "query": query
    })

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

def build_bidirectional_graph(data):
    """Build bidirectional adjacency list from graph data"""
    graph = defaultdict(list)
    for edge in data.get('edges', []):
        source = edge.get('source')
        target = edge.get('target')
        if source and target:
            graph[source].append(target)
            graph[target].append(source)  # Make it bidirectional
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

def filter_nodes_by_type(nodes, node_types):
    """Filter nodes by their type"""
    return [node for node in nodes if any(node_type.lower() in node.get('type', '').lower() or 
                                         node_type.lower() in node.get('id', '').lower() 
                                         for node_type in node_types)]

def find_mie_to_ao_paths(data, k=3, path_type='shortest'):
    """Find paths from MIE nodes to AO nodes"""
    nodes = data.get('nodes', [])
    
    # Find MIE and AO nodes
    mie_nodes = filter_nodes_by_type(nodes, ['MIE', 'molecular_initiating_event'])
    ao_nodes = filter_nodes_by_type(nodes, ['AO', 'adverse_outcome'])
    
    if not mie_nodes or not ao_nodes:
        return {"paths": [], "mie_nodes": [], "ao_nodes": [], "message": "No MIE or AO nodes found"}
    
    graph = build_graph_from_data(data)
    all_paths = []
    
    for mie_node in mie_nodes[:5]:  # Limit to first 5 MIE nodes
        for ao_node in ao_nodes[:5]:  # Limit to first 5 AO nodes
            mie_id = mie_node.get('id')
            ao_id = ao_node.get('id')
            
            paths = find_k_shortest_paths(graph, mie_id, ao_id, k)
            
            for path in paths:
                if path:
                    # Get path edges
                    path_edges = []
                    for i in range(len(path) - 1):
                        for edge in data.get('edges', []):
                            if edge.get('source') == path[i] and edge.get('target') == path[i + 1]:
                                path_edges.append(edge)
                                break
                    
                    all_paths.append({
                        "mie_node": mie_id,
                        "ao_node": ao_id,
                        "path": path,
                        "length": len(path) - 1,
                        "edges": path_edges
                    })
    
    # Sort paths by length
    if path_type == 'shortest':
        all_paths.sort(key=lambda x: x['length'])
    else:
        all_paths.sort(key=lambda x: x['length'], reverse=True)
    
    return {
        "paths": all_paths[:k],  # Return top k paths
        "mie_nodes": [node.get('id') for node in mie_nodes],
        "ao_nodes": [node.get('id') for node in ao_nodes],
        "total_found": len(all_paths)
    }

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

@app.route("/mie_to_ao_paths", methods=["GET"])
def get_mie_to_ao_paths():
    """Find paths from MIE nodes to AO nodes with hypergraph visualization"""
    aop = request.args.get("aop")
    k = int(request.args.get("k", 3))
    use_hypergraph = request.args.get("hypergraph", "true").lower() == "true"
    max_per_hypernode = int(request.args.get("max_per_hypernode", 4))
    use_full_database = request.args.get("full_database", "false").lower() == "true"
    
    try:
        if use_full_database or not aop:
            # Use the complete AOP database - all nodes and edges
            aop_graph_data = graph_data
            logger.info(f"Using full AOP database: {len(graph_data.get('nodes', []))} nodes, {len(graph_data.get('edges', []))} edges")
        else:
            # Use specific AOP data
            aop_graph_data = get_aop_graph_data(aop)
        
        # Find MIE to AO paths
        path_result = find_mie_to_ao_paths(aop_graph_data, k, "shortest")
        
        if not path_result["paths"]:
            return jsonify({
                "paths": [],
                "graph_data": None,
                "hypergraph_data": None,
                "message": "No paths found between MIE and AO nodes",
                "database_stats": {
                    "total_nodes": len(aop_graph_data.get('nodes', [])),
                    "total_edges": len(aop_graph_data.get('edges', [])),
                    "mie_nodes": len(path_result.get("mie_nodes", [])),
                    "ao_nodes": len(path_result.get("ao_nodes", []))
                }
            })
        
        # Create subgraph containing only nodes and edges from the paths
        path_nodes = set()
        path_edges = []
        
        for path_info in path_result["paths"]:
            path_nodes.update(path_info["path"])
            path_edges.extend(path_info["edges"])
        
        # Filter original nodes to include only those in paths
        filtered_nodes = [node for node in aop_graph_data.get('nodes', []) 
                         if node.get('id') in path_nodes]
        
        # Remove duplicate edges
        unique_edges = []
        edge_set = set()
        for edge in path_edges:
            edge_key = (edge.get('source'), edge.get('target'))
            if edge_key not in edge_set:
                edge_set.add(edge_key)
                unique_edges.append(edge)
        
        path_graph_data = {
            "nodes": filtered_nodes,
            "edges": unique_edges
        }
        
        # Create hypergraph if requested
        hypergraph_data = None
        if use_hypergraph and filtered_nodes:
            try:
                processor = HypergraphProcessor()
                hypergraph_result = processor.create_hypergraph(
                    filtered_nodes, 
                    unique_edges,
                    use_communities=False,  # Always use type-based for pathfinding
                    max_per_hypernode=max_per_hypernode
                )
                hypergraph_data = hypergraph_result
            except Exception as e:
                logger.warning(f"Failed to create hypergraph: {e}")
                hypergraph_data = None
        
        return jsonify({
            "paths": path_result["paths"],
            "graph_data": path_graph_data,
            "hypergraph_data": hypergraph_data,
            "mie_nodes": path_result["mie_nodes"],
            "ao_nodes": path_result["ao_nodes"],
            "total_found": path_result["total_found"],
            "path_type": "shortest",
            "k": k,
            "database_stats": {
                "total_nodes": len(aop_graph_data.get('nodes', [])),
                "total_edges": len(aop_graph_data.get('edges', [])),
                "mie_nodes": len(path_result.get("mie_nodes", [])),
                "ao_nodes": len(path_result.get("ao_nodes", [])),
                "used_full_database": use_full_database or not aop
            }
        })
    
    except Exception as e:
        logger.error(f"Error in MIE to AO pathfinding: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/full_database_nodes", methods=["GET"])
def get_full_database_nodes():
    """Get all nodes from the complete AOP database for source/target selection"""
    try:
        nodes = graph_data.get('nodes', [])
        
        # Group nodes by type for easier selection
        node_types = defaultdict(list)
        for node in nodes:
            node_type = node.get('type', 'Unknown')
            node_types[node_type].append({
                'id': node.get('id'),
                'label': node.get('label', node.get('id')),
                'type': node_type,
                'aop_id': node.get('aop_id', 'Unknown')
            })
        
        # Also provide flat list for dropdown
        node_list = []
        for node in nodes:
            node_list.append({
                'id': node.get('id'),
                'label': node.get('label', node.get('id')),
                'type': node.get('type', 'Unknown'),
                'aop_id': node.get('aop_id', 'Unknown')
            })
        
        # Debug: Print actual node type counts
        type_counts = {k: len(v) for k, v in node_types.items()}
        print(f"DEBUG: Actual node type distribution: {type_counts}")
        
        # Count specific types more flexibly
        mie_count = sum(len(v) for k, v in node_types.items() if 'MIE' in k.upper() or 'MOLECULAR' in k.upper())
        ao_count = sum(len(v) for k, v in node_types.items() if 'AO' in k.upper() or 'ADVERSE' in k.upper())
        ke_count = sum(len(v) for k, v in node_types.items() if 'KE' in k.upper() or 'KEY' in k.upper())
        
        return jsonify({
            "nodes": node_list,
            "nodes_by_type": dict(node_types),
            "total_nodes": len(nodes),
            "node_type_counts": type_counts,
            "categorized_counts": {
                "MIE": mie_count,
                "AO": ao_count, 
                "KE": ke_count
            }
        })
        
        return jsonify({
            "nodes": node_list,
            "nodes_by_type": dict(node_types),
            "total_nodes": len(nodes),
            "node_type_counts": {k: len(v) for k, v in node_types.items()}
        })
    
    except Exception as e:
        logger.error(f"Error getting full database nodes: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/custom_path_search", methods=["GET"])
def get_custom_path_search():
    """Find paths between any two nodes in the full database"""
    source = request.args.get("source")
    target = request.args.get("target")
    k = int(request.args.get("k", 3))
    use_hypergraph = request.args.get("hypergraph", "true").lower() == "true"
    max_per_hypernode = int(request.args.get("max_per_hypernode", 4))
    
    if not source or not target:
        return jsonify({"error": "Source and target parameters required"}), 400
    
    try:
        # Always use full database for custom search
        aop_graph_data = graph_data
        
        graph = build_graph_from_data(aop_graph_data)
        paths = find_k_shortest_paths(graph, source, target, k)
        
        if not paths:
            return jsonify({
                "paths": [],
                "graph_data": None,
                "hypergraph_data": None,
                "message": f"No paths found between {source} and {target}"
            })
        
        # Transform paths to include edge information
        result_paths = []
        all_path_nodes = set()
        all_path_edges = []
        
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
                "edges": path_edges,
                "source_node": source,
                "target_node": target
            })
            
            all_path_nodes.update(path)
            all_path_edges.extend(path_edges)
        
        # Create subgraph from all paths
        filtered_nodes = [node for node in aop_graph_data.get('nodes', []) 
                         if node.get('id') in all_path_nodes]
        
        # Remove duplicate edges
        unique_edges = []
        edge_set = set()
        for edge in all_path_edges:
            edge_key = (edge.get('source'), edge.get('target'))
            if edge_key not in edge_set:
                edge_set.add(edge_key)
                unique_edges.append(edge)
        
        path_graph_data = {
            "nodes": filtered_nodes,
            "edges": unique_edges
        }
        
        # Create hypergraph if requested
        hypergraph_data = None
        if use_hypergraph and filtered_nodes:
            try:
                processor = HypergraphProcessor()
                hypergraph_result = processor.create_hypergraph(
                    filtered_nodes, 
                    unique_edges,
                    use_communities=False,
                    max_per_hypernode=max_per_hypernode
                )
                hypergraph_data = hypergraph_result
            except Exception as e:
                logger.warning(f"Failed to create hypergraph: {e}")
                hypergraph_data = None
        
        return jsonify({
            "paths": result_paths,
            "graph_data": path_graph_data,
            "hypergraph_data": hypergraph_data,
            "source": source,
            "target": target,
            "path_type": "shortest",
            "k": k,
            "total_found": len(result_paths)
        })
    
    except Exception as e:
        logger.error(f"Error in custom path search: {e}")
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
 
@app.route("/reload_data", methods=["POST", "GET"])
def reload_data():
    """Reload TSV and CSV files and rebuild in-memory data structures"""
    try:
        ok = load_aop_data()
        if ok:
            return jsonify({
                "status": "reloaded",
                "nodes": len(graph_data.get("nodes", [])),
                "edges": len(graph_data.get("edges", [])),
                "stressors": len([n for n in graph_data.get("nodes", []) if n.get("type") == "Stressor"])
            })
        else:
            return jsonify({"status": "failed"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

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
            # Fallback to AOP-based data
            aop = data.get('aop')
            if aop:
                aop_graph_data = get_aop_graph_data(aop)
            else:
                aop_graph_data = graph_data
        
        min_nodes = int(data.get('min_nodes', 4))
        community_method = data.get('community_method', 'louvain')
        use_communities = data.get('use_communities', True)
        use_type_groups = data.get('use_type_groups', True)
        exclude_stressor_hypernodes = data.get('exclude_stressor_hypernodes', False)
        
        if not aop_graph_data or not aop_graph_data.get('nodes'):
            return jsonify({"error": "No graph data available"}), 400
        
        # Create hypergraph
        hypergraph_result = create_hypergraph(
            aop_graph_data['nodes'],
            aop_graph_data['edges'],
            min_nodes=min_nodes,
            community_method=community_method,
            use_communities=use_communities,
            use_type_groups=use_type_groups,
            exclude_stressor_hypernodes=exclude_stressor_hypernodes
        )
        
        # DIRECT FIX: Add stressor connections if missing
        all_nodes = aop_graph_data['nodes'] + hypergraph_result['hypernodes']
        all_edges = aop_graph_data['edges'] + hypergraph_result['hypernode_connections']
        
        # Deduplicate all edges (including original AOP edges and hypernode connections)
        print(f"\n=== FINAL EDGE DEDUPLICATION ===")
        original_total = len(all_edges)
        seen_final_edges = set()
        unique_final_edges = []
        
        # Count edges by type for debugging
        edge_type_counts = {}
        for edge in all_edges:
            edge_type = edge.get('type', 'unknown')
            edge_type_counts[edge_type] = edge_type_counts.get(edge_type, 0) + 1
        
        print(f"Edge types before deduplication: {edge_type_counts}")
        
        for edge in all_edges:
            source = edge.get('source', '')
            target = edge.get('target', '')
            edge_type = edge.get('type', '')
            aop = edge.get('aop', '')
            final_edge_key = f"{source}->{target}:{edge_type}"
            
            # Only remove exact duplicates (same source, target, AND type)
            if final_edge_key not in seen_final_edges:
                seen_final_edges.add(final_edge_key)
                unique_final_edges.append(edge)
            else:
                print(f"🗑️ Removed exact duplicate: {source} → {target} ({edge_type}) AOP: {aop}")
        
        all_edges = unique_final_edges
        final_duplicates_removed = original_total - len(all_edges)
        print(f"Final deduplication: Removed {final_duplicates_removed} exact duplicates from {original_total} total edges")
        print(f"Final unique edges: {len(all_edges)}")
        
        # Count edges by type after deduplication
        final_edge_type_counts = {}
        for edge in all_edges:
            edge_type = edge.get('type', 'unknown')
            final_edge_type_counts[edge_type] = final_edge_type_counts.get(edge_type, 0) + 1
        
        print(f"Edge types after deduplication: {final_edge_type_counts}")
        
        # Find stressor and target hypernodes
        stressor_hypernodes = [n for n in all_nodes if n.get('type') == 'stressor-hypernode']
        target_hypernodes = [n for n in all_nodes if n.get('type') == 'type-hypernode']
        
        # Check if stressor connections exist
        stressor_connections = [e for e in all_edges if 'stressor' in e.get('type', '').lower()]
        
        if stressor_hypernodes and target_hypernodes and len(stressor_connections) == 0:
            # Force create stressor connections
            target = target_hypernodes[0]
            for stressor in stressor_hypernodes:
                aop_id = stressor.get('aop', 'X')
                direct_connection = {
                    'id': f"DIRECT-{stressor['id']}-{target['id']}",
                    'source': stressor['id'],
                    'target': target['id'],
                    'type': 'stressor-hypernode-connection',
                    'weight': 0.8,
                    'label': f"AOP{aop_id}",
                    'aop': aop_id
                }
                all_edges.append(direct_connection)
                logger.info(f"DIRECT FIX: Connected {stressor['id']} to {target['id']} with AOP{aop_id}")
        
        # Combine original data with hypergraph elements
        enhanced_data = {
            'nodes': all_nodes,
            'edges': all_edges,
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
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        query = data.get('query', '')
        node_ids = data.get('node_ids', [])
        context_type = data.get('context_type', 'general')
        aop_name = data.get('aop', '')
        
        if not query:
            return jsonify({"error": "Query is required"}), 400
        
        # Get API key from environment
        api_key = os.getenv('PERPLEXITY_API_KEY')
        if not api_key or api_key == 'your_perplexity_api_key_here':
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
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": "sonar",
            "messages": [
                {"role": "user", "content": enhanced_query}
            ],
            "return_citations": True
        }
        
        response = requests.post(
            'https://api.perplexity.ai/chat/completions',
            headers=headers,
            json=payload,
            timeout=30
        )
        
        if response.status_code != 200:
            logger.error(f"Perplexity API error: {response.status_code} - {response.text}")
            return jsonify({
                "error": f"Perplexity API error: {response.status_code}",
                "status": "api_error"
            }), 500
        
        api_result = response.json()
        
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
            
            # Extract citations if available
            if 'citations' in api_result:
                result['analysis']['citations'] = api_result['citations']
            
            return jsonify(result)
        else:
            return jsonify({
                "error": "No response from Perplexity API",
                "status": "api_error"
            }), 500
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Network error calling Perplexity API: {e}")
        return jsonify({
            "error": "Network error connecting to Perplexity API",
            "status": "network_error"
        }), 500
    except Exception as e:
        logger.error(f"Perplexity analysis error: {e}")
        return jsonify({"error": str(e), "status": "error"}), 500

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

@app.route("/search_key_events", methods=["GET"])
def search_key_events():
    """Enhanced search for key events that finds all related AOPs and returns complete MIE→KE→AO pathways"""
    try:
        query = request.args.get('query', '').strip()
        limit = int(request.args.get('limit', 100))  # Increased limit for comprehensive search
        include_complete_pathways = request.args.get('complete_pathways', 'true').lower() == 'true'
        
        if not query:
            return jsonify({"success": False, "error": "No search query provided"})
        
        logger.info(f"Enhanced key event search for: '{query}' (complete_pathways: {include_complete_pathways})")
        
        # Enhanced search logic - search in multiple fields
        matching_nodes = []
        matching_aops = set()
        aop_titles = {}  # Store AOP titles for better user experience
        
        # Prepare search terms - split query and create variations
        search_terms = [query.lower()]
        search_terms.extend([term.strip().lower() for term in query.split() if len(term.strip()) > 2])
        
        # Add common variations for better matching
        if 'ache' in query.lower() or 'acetylcholinesterase' in query.lower():
            search_terms.extend(['acetylcholinesterase', 'ache', 'cholinesterase', 'acetylcholine'])
        if 'inhibition' in query.lower():
            search_terms.extend(['inhibit', 'inhibitor', 'inhibitory'])
        
        logger.info(f"Search terms: {search_terms}")
        
        # Search through all available AOP data
        for aop in get_available_aops():
            try:
                aop_data = get_aop_graph_data(aop)
                if not aop_data or 'nodes' not in aop_data:
                    continue
                
                # Store AOP title for reference
                aop_title = aop_data.get('title', aop)
                aop_titles[aop] = aop_title
                
                aop_has_matches = False
                
                # Search in AOP title first (high relevance)
                aop_title_lower = aop_title.lower()
                title_matches = any(term in aop_title_lower for term in search_terms)
                
                # Search in nodes
                for node in aop_data['nodes']:
                    node_label = (node.get('label', '') or '').lower()
                    node_id = (node.get('id', '') or '').lower()
                    node_type = node.get('type', '')
                    node_description = (node.get('description', '') or '').lower()
                    
                    # Enhanced matching logic
                    node_matches = (
                        any(term in node_label for term in search_terms) or
                        any(term in node_id for term in search_terms) or
                        any(term in node_description for term in search_terms) or
                        title_matches  # Include if AOP title matches
                    )
                    
                    if node_matches:
                        # Calculate relevance score
                        relevance_score = 0
                        if any(term in node_label for term in search_terms):
                            relevance_score += 10
                        if any(term in node_id for term in search_terms):
                            relevance_score += 5
                        if title_matches:
                            relevance_score += 3
                        if any(term in node_description for term in search_terms):
                            relevance_score += 2
                        
                        matching_nodes.append({
                            'id': node.get('id'),
                            'label': node.get('label', node.get('id')),
                            'type': node_type,
                            'description': node.get('description', ''),
                            'aop': aop,
                            'aop_title': aop_title,
                            'relevance_score': relevance_score
                        })
                        matching_aops.add(aop)
                        aop_has_matches = True
                
                # If AOP title matches but no specific nodes found, include the AOP anyway
                if title_matches and not aop_has_matches:
                    matching_aops.add(aop)
                    
            except Exception as e:
                logger.warning(f"Error searching in AOP {aop}: {e}")
                continue
        
        # Sort results by relevance score
        matching_nodes.sort(key=lambda x: x.get('relevance_score', 0), reverse=True)
        
        logger.info(f"Found {len(matching_nodes)} matching nodes across {len(matching_aops)} AOPs")
        
        # Create comprehensive network if requested
        graph_data = None
        if include_complete_pathways and matching_aops:
            try:
                # For comprehensive search, include more AOPs but with size limits
                max_aops = min(10, len(matching_aops))  # Allow up to 10 AOPs
                selected_aops = list(matching_aops)[:max_aops]
                
                logger.info(f"Creating complete pathway network for {len(selected_aops)} AOPs: {selected_aops[:5]}...")
                
                combined_nodes = []
                combined_edges = []
                node_ids = set()
                edge_ids = set()
                
                # Collect all nodes and edges from matching AOPs
                for aop in selected_aops:
                    aop_data = get_aop_graph_data(aop)
                    if not aop_data or 'nodes' not in aop_data:
                        continue
                    
                    # Add all nodes from this AOP (complete pathway) - EXCLUDE stressor nodes
                    for node in aop_data['nodes']:
                        node_id = node['id']
                        node_type = node.get('type', '')
                        
                        # Skip stressor nodes for comprehensive pathway search
                        if node_type == 'Stressor':
                            continue
                            
                        if node_id not in node_ids:
                            node_ids.add(node_id)
                            
                            # Mark if this node was a direct match
                            is_direct_match = any(
                                match_node['id'] == node_id for match_node in matching_nodes
                            )
                            
                            combined_nodes.append({
                                **node,
                                'aop_source': aop,
                                'aop_title': aop_titles.get(aop, aop),
                                'is_search_match': is_direct_match,
                                'search_query': query if is_direct_match else None
                            })
                    
                    # Add all edges from this AOP
                    if 'edges' in aop_data:
                        for edge in aop_data['edges']:
                            source_id = edge.get('source')
                            target_id = edge.get('target')
                            edge_key = f"{source_id}-{target_id}"
                            
                            if (source_id in node_ids and target_id in node_ids and 
                                edge_key not in edge_ids):
                                edge_ids.add(edge_key)
                                combined_edges.append({
                                    **edge,
                                    'aop_source': aop,
                                    'aop_title': aop_titles.get(aop, aop)
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
                
                logger.info(f"Created network with {len(combined_nodes)} nodes, {len(combined_edges)} edges from {len(selected_aops)} AOPs")
                
            except Exception as e:
                logger.error(f"Error creating comprehensive pathway network: {e}")
                graph_data = None
        
        # Always generate network data if we have matches and complete_pathways is requested
        if not graph_data and include_complete_pathways and matching_aops:
            try:
                logger.info(f"🔄 Generating network data for {len(matching_aops)} AOPs...")
                logger.info(f"First few AOPs: {list(matching_aops)[:5]}")
                max_aops = min(5, len(matching_aops))  # Reduce to 5 AOPs for better performance
                selected_aops = list(matching_aops)[:max_aops]
                logger.info(f"Selected AOPs for network: {selected_aops}")
                
                combined_nodes = []
                combined_edges = []
                node_ids = set()
                edge_ids = set()
                
                for aop in selected_aops:
                    logger.info(f"Processing AOP: {aop}")
                    aop_graph_data = get_aop_graph_data(aop)
                    logger.info(f"get_aop_graph_data({aop}) returned: {type(aop_graph_data)}")
                    
                    if not aop_graph_data or 'nodes' not in aop_graph_data:
                        logger.warning(f"No valid data for AOP {aop}")
                        continue
                    
                    logger.info(f"AOP {aop} has {len(aop_graph_data['nodes'])} nodes, {len(aop_graph_data['edges'])} edges")
                    
                    for node in aop_graph_data['nodes']:
                        node_id = node['id']
                        node_type = node.get('type', '')
                        
                        # Skip stressor nodes for comprehensive pathway search
                        if node_type == 'Stressor':
                            continue
                            
                        if node_id not in node_ids:
                            node_ids.add(node_id)
                            is_direct_match = any(
                                match_node['id'] == node_id for match_node in matching_nodes
                            )
                            combined_nodes.append({
                                **node,
                                'aop_source': aop,
                                'aop_title': aop_titles.get(aop, aop),
                                'is_search_match': is_direct_match,
                                'search_query': query if is_direct_match else None
                            })
                    
                    if 'edges' in aop_data:
                        for edge in aop_data['edges']:
                            source_id = edge.get('source')
                            target_id = edge.get('target')
                            edge_key = f"{source_id}-{target_id}"
                            
                            if (source_id in node_ids and target_id in node_ids and 
                                edge_key not in edge_ids):
                                edge_ids.add(edge_key)
                                combined_edges.append({
                                    **edge,
                                    'aop_source': aop,
                                    'aop_title': aop_titles.get(aop, aop)
                                })
                
                if combined_nodes:
                    pathway_stats = {
                        'total_nodes': len(combined_nodes),
                        'total_edges': len(combined_edges),
                        'aop_count': len(selected_aops),
                        'node_types': {},
                        'direct_matches': sum(1 for node in combined_nodes if node.get('is_search_match', False))
                    }
                    
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
                    
                    logger.info(f"Generated network: {len(combined_nodes)} nodes, {len(combined_edges)} edges")
                    
            except Exception as e:
                logger.error(f"Error generating fallback network: {e}")
        
        # Prepare result with enhanced information
        result = {
            'success': True,
            'query': query,
            'results': matching_nodes[:limit],
            'total_matches': len(matching_nodes),
            'matching_aops': [
                {'id': aop, 'title': aop_titles.get(aop, aop)} 
                for aop in list(matching_aops)[:20]  # Limit displayed AOPs
            ],
            'total_aops': len(matching_aops),
            'graph_data': graph_data,
            'search_metadata': {
                'search_terms_used': search_terms,
                'complete_pathways_included': include_complete_pathways,
                'max_aops_processed': min(5, len(matching_aops)) if include_complete_pathways else 0,
                'network_generated': graph_data is not None
            }
        }
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Enhanced key event search error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

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


