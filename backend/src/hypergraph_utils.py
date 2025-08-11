"""
Hypergraph utilities for AOP Network Visualizer
Provides community detection, node grouping, and hypergraph construction
"""

import numpy as np
import networkx as nx
from collections import defaultdict, Counter
import json
from typing import Dict, List, Tuple, Any, Optional
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class HypergraphProcessor:
    """Main class for hypergraph processing and community detection"""
    
    def __init__(self):
        self.graph = None
        self.communities = None
        self.node_communities = {}
        
    def build_networkx_graph(self, nodes: List[Dict], edges: List[Dict]) -> nx.Graph:
        """Build NetworkX graph from node and edge data"""
        G = nx.Graph()
        
        # Add nodes with attributes
        for node in nodes:
            G.add_node(
                node['id'], 
                label=node.get('label', ''),
                type=node.get('type', 'Unknown'),
                aop=node.get('aop', ''),
                ontology=node.get('ontology', ''),
                ontology_term=node.get('ontology_term', ''),
                change=node.get('change', '')
            )
        
        # Add edges with weights
        for edge in edges:
            source = edge.get('source')
            target = edge.get('target')
            if source and target and G.has_node(source) and G.has_node(target):
                # Calculate edge weight based on confidence and adjacency
                weight = 1.0
                if edge.get('confidence'):
                    try:
                        confidence = float(edge['confidence'])
                        weight *= confidence
                    except (ValueError, TypeError):
                        pass
                
                if edge.get('adjacency'):
                    try:
                        adjacency = float(edge['adjacency'])
                        weight *= adjacency
                    except (ValueError, TypeError):
                        pass
                
                G.add_edge(
                    source, 
                    target, 
                    weight=weight,
                    relationship=edge.get('relationship', ''),
                    aop=edge.get('aop', ''),
                    confidence=edge.get('confidence', ''),
                    adjacency=edge.get('adjacency', '')
                )
        
        self.graph = G
        logger.info(f"Built NetworkX graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")
        return G
    
    def detect_communities_louvain(self, resolution: float = 1.0) -> Dict[str, Any]:
        """Detect communities using Louvain algorithm"""
        if not self.graph:
            raise ValueError("Graph not initialized. Call build_networkx_graph first.")
        
        try:
            # Use NetworkX's Louvain implementation
            communities = nx.community.louvain_communities(self.graph, resolution=resolution)
            
            # Calculate modularity
            modularity = nx.community.modularity(self.graph, communities)
            
            # Convert to our format
            community_list = []
            node_to_community = {}
            
            for i, community in enumerate(communities):
                community_nodes = list(community)
                community_list.append({
                    'id': i,
                    'members': community_nodes,
                    'size': len(community_nodes),
                    'modularity_contribution': 0  # Could calculate individual contribution
                })
                
                for node in community_nodes:
                    node_to_community[node] = i
            
            self.communities = community_list
            self.node_communities = node_to_community
            
            logger.info(f"Louvain: Found {len(communities)} communities, modularity: {modularity:.3f}")
            
            return {
                'method': 'louvain',
                'communities': community_list,
                'modularity': modularity,
                'node_communities': node_to_community,
                'num_communities': len(communities)
            }
            
        except Exception as e:
            logger.error(f"Louvain community detection failed: {e}")
            return self._fallback_community_detection()
    
    def detect_communities_leiden(self, resolution: float = 1.0) -> Dict[str, Any]:
        """Detect communities using Leiden algorithm (simplified implementation)"""
        if not self.graph:
            raise ValueError("Graph not initialized")
        
        try:
            # For now, use Louvain as Leiden requires additional dependencies
            # In production, you would install python-igraph and leidenalg
            logger.warning("Leiden algorithm not available, falling back to Louvain")
            return self.detect_communities_louvain(resolution)
            
        except Exception as e:
            logger.error(f"Leiden community detection failed: {e}")
            return self._fallback_community_detection()
    
    def detect_communities_walktrap(self, steps: int = 4) -> Dict[str, Any]:
        """Detect communities using random walk-based method"""
        if not self.graph:
            raise ValueError("Graph not initialized")
        
        try:
            # Simplified walktrap using NetworkX
            # Use edge betweenness as a proxy for walktrap
            communities = nx.community.girvan_newman(self.graph)
            
            # Take the first partition that gives reasonable number of communities
            best_partition = None
            best_modularity = -1
            
            for partition in communities:
                if len(partition) > len(self.graph.nodes()) // 10:  # Stop if too many small communities
                    break
                    
                modularity = nx.community.modularity(self.graph, partition)
                if modularity > best_modularity:
                    best_modularity = modularity
                    best_partition = partition
            
            if not best_partition:
                return self._fallback_community_detection()
            
            # Convert to our format
            community_list = []
            node_to_community = {}
            
            for i, community in enumerate(best_partition):
                community_nodes = list(community)
                community_list.append({
                    'id': i,
                    'members': community_nodes,
                    'size': len(community_nodes)
                })
                
                for node in community_nodes:
                    node_to_community[node] = i
            
            logger.info(f"Walktrap: Found {len(community_list)} communities, modularity: {best_modularity:.3f}")
            
            return {
                'method': 'walktrap',
                'communities': community_list,
                'modularity': best_modularity,
                'node_communities': node_to_community,
                'num_communities': len(community_list)
            }
            
        except Exception as e:
            logger.error(f"Walktrap community detection failed: {e}")
            return self._fallback_community_detection()
    
    def detect_communities_spectral(self, k: Optional[int] = None) -> Dict[str, Any]:
        """Detect communities using spectral clustering"""
        if not self.graph:
            raise ValueError("Graph not initialized")
        
        try:
            from sklearn.cluster import SpectralClustering
            
            # Get adjacency matrix
            adj_matrix = nx.adjacency_matrix(self.graph).toarray()
            
            # Estimate number of clusters if not provided
            if k is None:
                # Use eigengap heuristic
                eigenvals = np.linalg.eigvals(adj_matrix)
                eigenvals = np.sort(eigenvals)[::-1]
                gaps = np.diff(eigenvals)
                k = np.argmax(gaps) + 1
                k = max(2, min(k, len(self.graph.nodes()) // 5))  # Reasonable bounds
            
            # Apply spectral clustering
            clustering = SpectralClustering(n_clusters=k, affinity='precomputed', random_state=42)
            labels = clustering.fit_predict(adj_matrix)
            
            # Convert to our format
            communities_dict = defaultdict(list)
            for node, label in zip(self.graph.nodes(), labels):
                communities_dict[label].append(node)
            
            community_list = []
            node_to_community = {}
            
            for i, (label, members) in enumerate(communities_dict.items()):
                community_list.append({
                    'id': i,
                    'members': members,
                    'size': len(members)
                })
                
                for node in members:
                    node_to_community[node] = i
            
            # Calculate modularity
            communities_nx = [set(comm['members']) for comm in community_list]
            modularity = nx.community.modularity(self.graph, communities_nx)
            
            logger.info(f"Spectral: Found {len(community_list)} communities, modularity: {modularity:.3f}")
            
            return {
                'method': 'spectral',
                'communities': community_list,
                'modularity': modularity,
                'node_communities': node_to_community,
                'num_communities': len(community_list)
            }
            
        except ImportError:
            logger.warning("sklearn not available for spectral clustering, falling back to Louvain")
            return self.detect_communities_louvain()
        except Exception as e:
            logger.error(f"Spectral community detection failed: {e}")
            return self._fallback_community_detection()
    
    def _fallback_community_detection(self) -> Dict[str, Any]:
        """Fallback community detection using simple connected components"""
        if not self.graph:
            return {'method': 'none', 'communities': [], 'modularity': 0, 'node_communities': {}}
        
        try:
            components = list(nx.connected_components(self.graph))
            
            community_list = []
            node_to_community = {}
            
            for i, component in enumerate(components):
                community_nodes = list(component)
                community_list.append({
                    'id': i,
                    'members': community_nodes,
                    'size': len(community_nodes)
                })
                
                for node in community_nodes:
                    node_to_community[node] = i
            
            # Calculate modularity
            communities_nx = [set(comm['members']) for comm in community_list]
            modularity = nx.community.modularity(self.graph, communities_nx) if len(communities_nx) > 1 else 0
            
            logger.info(f"Fallback: Found {len(community_list)} connected components")
            
            return {
                'method': 'connected_components',
                'communities': community_list,
                'modularity': modularity,
                'node_communities': node_to_community,
                'num_communities': len(community_list)
            }
            
        except Exception as e:
            logger.error(f"Fallback community detection failed: {e}")
            return {'method': 'error', 'communities': [], 'modularity': 0, 'node_communities': {}}
    
    def group_nodes_by_type(self, nodes: List[Dict], min_group_size: int = 1) -> Dict[str, Any]:
        """Group nodes by their type - creates ONE hypernode per type"""
        type_groups = defaultdict(list)
        
        for node in nodes:
            node_type = node.get('type', 'Unknown')
            # Skip stressor nodes as they're handled separately
            if node_type != 'Stressor':
                type_groups[node_type].append(node['id'])
        
        # Create ONE group per type containing ALL nodes of that type
        groups = {}
        for node_type, members in type_groups.items():
            # Always create a single group for each type, no splitting
            groups[node_type] = {
                'members': members,
                'size': len(members)
            }
        
        
        return {
            'groups': groups,
            'total_groups': len(groups)
        }
    
    def create_hypergraph_elements(self, nodes: List[Dict], edges: List[Dict], 
                                 min_nodes: int = 1, use_communities: bool = True,
                                 use_type_groups: bool = True, community_data: Optional[Dict] = None,
                                 exclude_stressor_hypernodes: bool = False) -> Dict[str, Any]:
        """Create hypergraph elements including hypernodes and hyperedges"""
        
        # Deduplicate input edges first
        print(f"\n=== DEDUPLICATING INPUT EDGES ===")
        original_edge_count = len(edges)
        seen_edges = set()
        unique_edges = []
        
        for edge in edges:
            source = edge.get('source', '')
            target = edge.get('target', '')
            edge_type = edge.get('type', '')
            edge_key = f"{source}->{target}:{edge_type}"
            
            if edge_key not in seen_edges:
                seen_edges.add(edge_key)
                unique_edges.append(edge)
            else:
                print(f"🗑️ Removed duplicate input edge: {source} → {target} ({edge_type})")
        
        edges = unique_edges
        input_duplicates_removed = original_edge_count - len(edges)
        print(f"Removed {input_duplicates_removed} duplicate input edges")
        print(f"Final unique input edges: {len(edges)}")
        
        hypernodes = []
        hyperedges = []
        hypernode_connections = []
        
        # Helper to robustly extract numeric AOP ID from various formats, e.g., 'Aop:315', 'AOP:315', '315'
        def _extract_aop_id(val: Any) -> str:
            if not isinstance(val, str):
                try:
                    return ''.join(ch for ch in str(val) if ch.isdigit())
                except Exception:
                    return ''
            parts = val.split(':')
            candidate = parts[-1] if parts else val
            return ''.join(ch for ch in candidate if ch.isdigit())
        
        # Create type-based hypernodes (split by max size per hypernode)
        # Always create type-based hypernodes regardless of use_type_groups setting
        # Always create hypernodes for all types, but split into chunks of size <= min_nodes
        type_groups = self.group_nodes_by_type(nodes, min_group_size=1)

        try:
            max_per_hypernode = max(1, int(min_nodes))
        except Exception:
            max_per_hypernode = 1

        for group_type, group_data in type_groups['groups'].items():
            members = list(group_data['members'])
            total = len(members)
            if total == 0:
                continue

            # Chunk members into groups of size <= max_per_hypernode
            chunk_index = 0
            for start in range(0, total, max_per_hypernode):
                chunk = members[start:start + max_per_hypernode]
                chunk_index += 1
                hypernode_id = f"type-hypernode-{group_type}-{chunk_index}" if total > max_per_hypernode else f"type-hypernode-{group_type}"

                hypernode = {
                    'id': hypernode_id,
                    'label': f"{group_type} Group {chunk_index} ({len(chunk)})" if total > max_per_hypernode else f"{group_type} Group ({len(chunk)})",
                    'type': 'type-hypernode',
                    'original_type': group_type,
                    'member_count': len(chunk),
                    'members': chunk
                }

                hypernodes.append(hypernode)

                # Create connections from members to this hypernode chunk
                for member_id in chunk:
                    hypernode_connections.append({
                        'id': f"{member_id}-{hypernode_id}",
                        'source': member_id,
                        'target': hypernode_id,
                        'type': 'hypernode-connection',
                        'weight': 0.5
                    })
        
        # Community-based hypernodes disabled per user request
        # Use only type-based hypernodes with max nodes per hypernode splitting
        
        # Create stressor hypernodes for ALL AOPs (removed restriction)
        stressor_nodes = [n for n in nodes if n.get('type') == 'Stressor']
        if stressor_nodes and not exclude_stressor_hypernodes:
            # Group stressors by AOP
            stressors_by_aop = defaultdict(list)
            logger.info(f"\n=== GROUPING {len(stressor_nodes)} STRESSOR NODES BY AOP ===")
            for stressor in stressor_nodes:
                aop_raw = stressor.get('aop_id') or stressor.get('aop') or ''
                aop_key = _extract_aop_id(aop_raw) or 'unknown'
                if aop_key and aop_key != 'unknown':
                    stressors_by_aop[aop_key].append(stressor)
                    if len(stressors_by_aop) <= 5:  # Log first few for debugging
                        logger.info(f"Added stressor to AOP {aop_key}: {stressor.get('id', 'no-id')}")
            logger.info(f"Stressors grouped by ALL AOPs: {dict((k, len(v)) for k, v in stressors_by_aop.items())}")
            logger.info(f"Creating stressor hypernodes for {len(stressors_by_aop)} AOPs: {list(stressors_by_aop.keys())}")
            for aop_key, aop_stressors in stressors_by_aop.items():
                if len(aop_stressors) > 0:
                    hypernode_id = f"stressor-hypernode-aop-{aop_key}"
                    # Get the AOP name from the first stressor (all stressors in group have same AOP name)
                    aop_name = aop_stressors[0].get('aop_name', '') if aop_stressors else ''
                    aop_id = aop_stressors[0].get('aop_id', aop_key) if aop_stressors else aop_key
                    
                    # Create descriptive label with AOP ID and name
                    if aop_name:
                        aop_label = f"AOP {aop_id}: {aop_name}"
                    else:
                        aop_label = f"AOP{aop_key}"
                    
                    stressor_names_preview = ', '.join(s.get('label', 'Unknown') for s in aop_stressors[:2])
                    if len(aop_stressors) > 2:
                        stressor_names_preview += f" +{len(aop_stressors)-2} more"
                    hypernode = {
                        'id': hypernode_id,
                        'label': f"Stressors ({aop_label})",
                        'description': f"{len(aop_stressors)} stressors: {stressor_names_preview}",
                        'type': 'stressor-hypernode',
                        'aop': aop_key,
                        'aop_id': aop_id,
                        'aop_name': aop_name,  # Store the AOP name for use in hyperedges
                        'member_count': len(aop_stressors),
                        'members': [s['id'] for s in aop_stressors],
                        'stressor_names': [s.get('label', s.get('name', 'Unknown')) for s in aop_stressors]
                    }
                    hypernodes.append(hypernode)
                    logger.info(f"Created stressor hypernode {hypernode_id} for AOP {aop_key} with {len(aop_stressors)} stressors")
                    # Create connections from stressor nodes to their hypernode
                    for stressor in aop_stressors:
                        hypernode_connections.append({
                            'id': f"{stressor['id']}-{hypernode_id}",
                            'source': stressor['id'],
                            'target': hypernode_id,
                            'type': 'stressor-connection',
                            'weight': 1.0,
                            'label': aop_label,
                            'aop': aop_key
                        })
                    # Note: Specific connection to AdverseOutcome hypernodes is handled later
                    logger.info(f"Created stressor hypernode {hypernode_id} for {aop_label} with {len(aop_stressors)} stressors")
            
            logger.info(f"\n=== STRESSOR HYPERNODE SUMMARY ===")
            logger.info(f"Created {len(stressors_by_aop)} stressor hypernodes for {len(stressor_nodes)} stressor nodes")
            
            # Log final connection summary
            stressor_connections = [conn for conn in hypernode_connections if conn.get('type') == 'stressor-mie-connection']
            logger.info(f"Total stressor-MIE connections created: {len(stressor_connections)}")
            
            if stressor_connections:
                logger.info("Stressor-MIE connections:")
                for conn in stressor_connections:
                    logger.info(f"  ✓ {conn['source']} → {conn['target']} (AOP {conn.get('aop', 'unknown')})")
            else:
                logger.warning("⚠️  No stressor-MIE connections were created!")
                
            # Log stressor hypernode details
            stressor_hypernodes = [hn for hn in hypernodes if hn.get('type') == 'stressor-hypernode']
            logger.info(f"Stressor hypernodes created:")
            for hn in stressor_hypernodes:
                logger.info(f"  • {hn['id']}: {hn['label']} (AOP {hn.get('aop', 'unknown')}, {hn.get('member_count', 0)} members)")
        elif stressor_nodes and exclude_stressor_hypernodes:
            logger.info(f"Skipped creating stressor hypernodes for {len(stressor_nodes)} stressor nodes (excluded for comprehensive pathway search)")
        elif not stressor_nodes:
            logger.info("No stressor nodes found in the dataset")
        else:
            logger.info("Stressor hypernode creation was skipped for unknown reasons")

        # Ensure every individual stressor node is connected to its AOP hypernode
        stressor_hypernodes = [h for h in hypernodes if h.get('type') == 'stressor-hypernode']
        aop_hypernode_map = {h.get('aop_id'): h for h in stressor_hypernodes}
        
        for stressor in stressor_nodes:
            aop_raw = stressor.get('aop_id') or stressor.get('aop') or ''
            aop_key = _extract_aop_id(aop_raw) or 'unknown'
            target_hypernode = aop_hypernode_map.get(aop_key)
            
            if target_hypernode:
                # Check if already connected
                already_connected = any(
                    conn.get('source') == stressor['id'] and conn.get('target') == target_hypernode['id']
                    for conn in hypernode_connections
                )
                
                if not already_connected:
                    hypernode_connections.append({
                        'id': f"stressor-{stressor['id']}-to-aop-{target_hypernode['id']}",
                        'source': stressor['id'],
                        'target': target_hypernode['id'],
                        'type': 'stressor-to-aop-hypernode',
                        'weight': 1.0,
                        'label': f"AOP{aop_key}",
                        'aop': aop_key
                    })
                    logger.info(f"Connected stressor {stressor['id']} to AOP{aop_key} hypernode")

        # Connect stressor hypernodes directly to AdverseOutcome hypernodes with labeled hyperedges
        stressor_hypernodes = [h for h in hypernodes if h.get('type') == 'stressor-hypernode']
        adverse_outcome_hypernodes = [h for h in hypernodes if h.get('type') == 'type-hypernode' and 'AdverseOutcome' in h.get('original_type', '')]
        
        print(f"\n=== CONNECTING STRESSOR TO ADVERSE OUTCOME HYPERNODES ===")
        print(f"Found {len(stressor_hypernodes)} stressor hypernodes")
        print(f"Found {len(adverse_outcome_hypernodes)} AdverseOutcome hypernodes")
        
        # Connect each stressor hypernode to AdverseOutcome hypernodes with labeled hyperedge
        connections_created = 0
        for stressor_hn in stressor_hypernodes:
            aop_key = stressor_hn.get('aop', 'unknown')
            aop_id = stressor_hn.get('aop_id', aop_key)
            aop_name = stressor_hn.get('aop_name', '')
            
            # Create label with AOP ID only for better aesthetics
            hyperedge_label = f"AOP {aop_id}"
            
            # Connect to the first available AdverseOutcome hypernode
            if adverse_outcome_hypernodes:
                target_hypernode = adverse_outcome_hypernodes[0]  # Use first AdverseOutcome hypernode
                connection_id = f"stressor-to-adverse-{stressor_hn['id']}-{target_hypernode['id']}"
                
                # Check if connection already exists
                already_connected = any(
                    conn.get('source') == stressor_hn['id'] and conn.get('target') == target_hypernode['id']
                    for conn in hypernode_connections
                )
                
                if not already_connected:
                    hyperedge = {
                        'id': connection_id,
                        'source': stressor_hn['id'],
                        'target': target_hypernode['id'],
                        'type': 'stressor-adverse-hyperedge',
                        'weight': 1.0,
                        'label': hyperedge_label,
                        'aop': aop_key,
                        'aop_name': aop_name,
                        'description': f"Connection from stressors to adverse outcome via {hyperedge_label}"
                    }
                    
                    hypernode_connections.append(hyperedge)
                    connections_created += 1
                    print(f"✅ CONNECTED: {stressor_hn['id']} → {target_hypernode['id']} via hyperedge '{hyperedge_label}'")
                else:
                    print(f"⚠️ Connection already exists: {stressor_hn['id']} → {target_hypernode['id']}")
            else:
                print(f"⚠️ No AdverseOutcome hypernodes found for stressor {stressor_hn['id']}")
        
        print(f"Created {connections_created} stressor-to-adverse-outcome connections")
        print(f"Total connections now: {len(hypernode_connections)}")
        
        # Remove duplicate edges - deduplicate by source-target pair
        print(f"\n=== DEDUPLICATING EDGES ===")
        original_count = len(hypernode_connections)
        seen_connections = set()
        unique_connections = []
        
        for conn in hypernode_connections:
            # Create a unique key based on source, target, and type
            source = conn.get('source', '')
            target = conn.get('target', '')
            conn_type = conn.get('type', '')
            connection_key = f"{source}->{target}:{conn_type}"
            
            if connection_key not in seen_connections:
                seen_connections.add(connection_key)
                unique_connections.append(conn)
            else:
                print(f"🗑️ Removed duplicate: {source} → {target} ({conn_type})")
        
        hypernode_connections = unique_connections
        duplicates_removed = original_count - len(hypernode_connections)
        print(f"Removed {duplicates_removed} duplicate connections")
        print(f"Final unique connections: {len(hypernode_connections)}")
        
        # Calculate statistics
        stats = {
            'original_nodes': len(nodes),
            'original_edges': len(edges),
            'hypernodes': len(hypernodes),
            'hypernode_connections': len(hypernode_connections),
            'total_nodes': len(nodes) + len(hypernodes),
            'total_edges': len(edges) + len(hypernode_connections),
            'stressor_nodes': len(stressor_nodes),
            'stressor_hypernodes': len([h for h in hypernodes if h.get('type') == 'stressor-hypernode'])
        }
        
        logger.info(f"Hypergraph creation: {stats['hypernodes']} hypernodes, {stats['hypernode_connections']} connections")
        
        return {
            'hypernodes': hypernodes,
            'hypernode_connections': hypernode_connections,
            'edges': edges,  # Return deduplicated edges
            'stats': stats,
            'config': {
                'min_nodes': min_nodes,
                'use_communities': use_communities,
                'use_type_groups': use_type_groups,
                'exclude_stressor_hypernodes': exclude_stressor_hypernodes
            }
        }
    
    def get_community_colors(self, method: str = 'louvain') -> Dict[str, str]:
        """Generate colors for community visualization"""
        if not self.node_communities:
            return {}
        
        # Color palette for communities
        colors = [
            '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7',
            '#dda0dd', '#98d8c8', '#f7dc6f', '#bb8fce', '#85c1e9',
            '#f8c471', '#82e0aa', '#aed6f1', '#f1948a', '#85c1e9'
        ]
        
        node_colors = {}
        for node_id, community_id in self.node_communities.items():
            color_index = community_id % len(colors)
            node_colors[node_id] = colors[color_index]
        
        return node_colors
    
    def analyze_network_properties(self) -> Dict[str, Any]:
        """Analyze basic network properties"""
        if not self.graph:
            return {}
        
        try:
            properties = {
                'nodes': self.graph.number_of_nodes(),
                'edges': self.graph.number_of_edges(),
                'density': nx.density(self.graph),
                'connected_components': nx.number_connected_components(self.graph),
                'average_clustering': nx.average_clustering(self.graph),
                'transitivity': nx.transitivity(self.graph)
            }
            
            # Degree statistics
            degrees = dict(self.graph.degree())
            if degrees:
                degree_values = list(degrees.values())
                properties.update({
                    'average_degree': np.mean(degree_values),
                    'max_degree': max(degree_values),
                    'min_degree': min(degree_values),
                    'degree_std': np.std(degree_values)
                })
            
            # Centrality measures (for smaller graphs)
            if self.graph.number_of_nodes() < 1000:
                try:
                    betweenness = nx.betweenness_centrality(self.graph)
                    closeness = nx.closeness_centrality(self.graph)
                    
                    properties.update({
                        'avg_betweenness_centrality': np.mean(list(betweenness.values())),
                        'avg_closeness_centrality': np.mean(list(closeness.values()))
                    })
                except:
                    pass  # Skip if computation is too expensive
            
            return properties
            
        except Exception as e:
            logger.error(f"Network analysis failed: {e}")
            return {'error': str(e)}

def detect_communities(nodes: List[Dict], edges: List[Dict], method: str = 'louvain', **kwargs) -> Dict[str, Any]:
    """Convenience function for community detection"""
    processor = HypergraphProcessor()
    processor.build_networkx_graph(nodes, edges)
    
    method_map = {
        'louvain': processor.detect_communities_louvain,
        'leiden': processor.detect_communities_leiden,
        'walktrap': processor.detect_communities_walktrap,
        'spectral': processor.detect_communities_spectral
    }
    
    if method not in method_map:
        logger.warning(f"Unknown method {method}, falling back to louvain")
        method = 'louvain'
    
    return method_map[method](**kwargs)

def create_hypergraph(nodes: List[Dict], edges: List[Dict], min_nodes: int = 4, 
                     community_method: str = 'louvain', exclude_stressor_hypernodes: bool = False, **kwargs) -> Dict[str, Any]:
    """Convenience function for hypergraph creation"""
    processor = HypergraphProcessor()
    processor.build_networkx_graph(nodes, edges)
    
    # Detect communities
    community_data = detect_communities(nodes, edges, community_method)
    
    # Create hypergraph elements
    hypergraph_data = processor.create_hypergraph_elements(
        nodes, edges, min_nodes=min_nodes, 
        community_data=community_data, exclude_stressor_hypernodes=exclude_stressor_hypernodes, **kwargs
    )
    
    # Add community data and network properties
    hypergraph_data['community_data'] = community_data
    hypergraph_data['network_properties'] = processor.analyze_network_properties()
    hypergraph_data['node_colors'] = processor.get_community_colors(community_method)
    
    return hypergraph_data
